"""
API Integration Health Monitor
GET /api/v1/health/integrations  → 각 외부 API 상태 반환 (OK/오류/응답시간)
결과는 60초 캐시.
"""
import asyncio
import logging
import time as _time
from datetime import datetime

import requests
import yfinance as yf
from fastapi import APIRouter

logger = logging.getLogger(__name__)
router = APIRouter()

_health_cache: dict = {}
HEALTH_CACHE_TTL = 60  # 60초 캐시


async def _check(name: str, fn) -> dict:
    """단일 외부 API 체크. 응답시간(ms) + ok/error 반환."""
    t0 = _time.monotonic()
    try:
        await asyncio.to_thread(fn)
        latency = int((_time.monotonic() - t0) * 1000)
        return {"ok": True, "latency_ms": latency}
    except Exception as e:
        latency = int((_time.monotonic() - t0) * 1000)
        return {"ok": False, "error": str(e)[:120], "latency_ms": latency}


# ── 개별 체크 함수 ──────────────────────────────────────────────────────────────

def _check_yfinance_history():
    """yfinance Ticker.history(start/end) 검증 - 현재 권장 방식."""
    from datetime import timedelta
    end = datetime.now()
    start = (end - timedelta(days=5)).strftime("%Y-%m-%d")
    t = yf.Ticker("^GSPC")
    df = t.history(start=start, end=end.strftime("%Y-%m-%d"), auto_adjust=True)
    if df.empty:
        raise ValueError("Empty response from yfinance history")


def _check_yfinance_period():
    """yfinance period= 방식 검증 - 구 방식 (Yahoo Finance API 변경으로 자주 깨짐)."""
    t = yf.Ticker("^GSPC")
    df = t.history(period="5d")
    if df.empty:
        raise ValueError("Empty response from yfinance period")


def _check_oecd_cli():
    """OECD CLI API 연결 테스트 (경기선행지수 데이터 소스)."""
    # stats.oecd.org SDMX-JSON API - 안정적
    url = (
        "https://stats.oecd.org/SDMX-JSON/data/MEI_CLI/"
        "LOLITOAASTSAM.KOR.M/all?startTime=2024-01&endTime=2024-06"
    )
    resp = requests.get(url, timeout=12, headers={"Accept": "application/json"})
    if resp.status_code != 200:
        raise ValueError(f"OECD HTTP {resp.status_code}")
    if len(resp.text) < 100:
        raise ValueError("OECD returned too little data")


def _check_fred():
    """FRED CSV API 연결 테스트 (timeout=5s, 차단 여부 확인용)."""
    url = "https://fred.stlouisfed.org/graph/fredgraph.csv?id=FEDFUNDS"
    resp = requests.get(url, timeout=5, headers={"User-Agent": "Mozilla/5.0"})
    if resp.status_code != 200:
        raise ValueError(f"FRED HTTP {resp.status_code}")


def _check_gemini():
    """Gemini API 연결 테스트 (1-token ping)."""
    import os
    import google.generativeai as genai
    api_key = os.getenv("GEMINI_API_KEY", "")
    if not api_key:
        raise ValueError("GEMINI_API_KEY not set")
    genai.configure(api_key=api_key)
    model = genai.GenerativeModel("gemini-1.5-flash")
    resp = model.generate_content("ping", generation_config={"max_output_tokens": 1})
    if not resp.text:
        raise ValueError("Empty Gemini response")


def _check_naver_finance():
    """Naver Finance 모바일 API 연결 테스트 (ETF 이름 소스)."""
    import ssl
    import urllib.request
    ctx = ssl._create_unverified_context()
    url = "https://m.stock.naver.com/api/stock/069500/integration"  # KODEX 200
    req = urllib.request.Request(url, headers={"User-Agent": "Mozilla/5.0"})
    resp = urllib.request.urlopen(req, timeout=8, context=ctx).read()
    import json
    data = json.loads(resp)
    if not data.get("stockName"):
        raise ValueError("Naver stockName missing in response")


# ── 라우터 ─────────────────────────────────────────────────────────────────────

@router.get("")
async def get_integration_health():
    """
    모든 외부 API 통합 상태를 병렬로 테스트하고 결과를 반환합니다.
    - ok: True/False
    - latency_ms: 응답시간(ms)
    - error: 실패 시 오류 메시지
    60초 캐시.
    """
    global _health_cache
    now = _time.time()
    if _health_cache.get("ts") and now - _health_cache["ts"] < HEALTH_CACHE_TTL:
        return _health_cache["data"]

    # 병렬 체크 (각각 독립 실행)
    results = await asyncio.gather(
        _check("yfinance_history", _check_yfinance_history),
        _check("yfinance_period",  _check_yfinance_period),
        _check("oecd_cli",         _check_oecd_cli),
        _check("fred",             _check_fred),
        _check("naver_finance",    _check_naver_finance),
        return_exceptions=False,
    )

    # Gemini는 별도 (api key 없을 수 있음)
    gemini_result = await _check("gemini", _check_gemini)

    checks = {
        "yfinance_history": results[0],
        "yfinance_period":  results[1],
        "oecd_cli":         results[2],
        "fred":             results[3],
        "naver_finance":    results[4],
        "gemini":           gemini_result,
    }

    # 전체 상태 계산
    # naver_finance: ETF 이름 소스 → 실패 시 degraded (DB name fallback 있어서 서비스 중단 아님)
    critical_ok = checks["yfinance_history"]["ok"] and checks["oecd_cli"]["ok"] and checks["naver_finance"]["ok"]
    any_failed = any(not v["ok"] for v in checks.values())

    if critical_ok and not any_failed:
        overall = "ok"
    elif critical_ok:
        overall = "degraded"   # 핵심 OK, 일부 실패
    else:
        overall = "error"      # 핵심 실패

    response = {
        "status": overall,
        "checks": checks,
        "checked_at": datetime.now().strftime("%Y-%m-%dT%H:%M:%S"),
        "notes": {
            "fred": "FRED는 일부 네트워크에서 차단됨. OECD API로 대체 사용 중.",
            "yfinance_period": "period= 방식은 Yahoo Finance API 변경으로 불안정. start/end 방식 사용 권장.",
            "naver_finance": "비공개 API. 차단/변경 시 ETF 이름이 DB 값(pykrx 기반)으로 fallback됨. 서비스 중단 없음.",
        }
    }

    _health_cache = {"ts": now, "data": response}
    return response
