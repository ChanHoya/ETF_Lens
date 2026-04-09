"""
peer_analysis.py — 완전 재작성 (2026-04-09)
────────────────────────────────────────────────────
동종 ETF 대비 성과 비교 + 벤치마크 알파 + 포트폴리오 기여도
엔드포인트: GET /api/v1/my/peer-analysis

데이터 소스 우선순위:
  1순위: pykrx  — KRX 공식 API, SSL/rate limit 문제 없음
  2순위: Yahoo Finance v8 chart API  — SSL 우회 가능
  3순위: yfinance  — 마지막 폴백 (SSL 불안정)

캐시: 4시간 (전체 분석 결과)
"""

from __future__ import annotations
import logging
import time
import asyncio
import requests
from datetime import datetime, timedelta
from typing import Any
from fastapi import APIRouter, Depends, Request
from sqlalchemy.ext.asyncio import AsyncSession
from db.database import get_db

logger = logging.getLogger(__name__)
router = APIRouter()

# ── 캐시 ──────────────────────────────────────────────────────────────────────
_PEER_CACHE: dict[str, dict] = {}
_PEER_CACHE_TTL = 3600 * 4       # 4시간

# 종목별 종가 캐시 (종목코드 → list[float])
_PRICE_CACHE: dict[str, list[float]] = {}
_PRICE_CACHE_TIME: dict[str, float] = {}
_PRICE_CACHE_TTL = 14400         # 4시간

# KIS 컨텍스트 (async endpoint에서 주입)
_KIS_CTX: dict = {}

# ── 카테고리 정의 ──────────────────────────────────────────────────────────────
CATEGORY_PEERS: list[dict] = [
    {
        "keywords": ["반도체top10", "반도체 top10", "반도체top", "반도체탑10", "반도체탑", "반도체"],
        "group": "반도체",
        "benchmark": "^KS11",
    },
    {
        "keywords": ["코스닥150", "코스닥 150"],
        "group": "코스닥150",
        "benchmark": "^KQ11",
    },
    {
        "keywords": ["바이오", "헬스케어", "바이오헬스"],
        "group": "바이오·헬스케어",
        "benchmark": "^KQ11",
    },
    {
        "keywords": ["2차전지", "배터리", "전기차"],
        "group": "2차전지·배터리",
        "benchmark": "^KQ11",
    },
    {
        "keywords": ["s&p500", "s&p 500", "미국s&p", "미국 s&p", "미국s&p500", "미국S&P"],
        "group": "미국 S&P500",
        "benchmark": "^GSPC",
    },
    {
        "keywords": ["나스닥", "nasdaq", "미국필라", "미국테크", "미국빅테크", "미국우주", "필라델피아반도체"],
        "group": "나스닥·빅테크",
        "benchmark": "^IXIC",
    },
    {
        "keywords": ["미국배당커버드콜", "미국성장커버드콜", "미국배당다우존스", "미국배당"],
        "group": "미국 배당/커버드콜",
        "benchmark": "^GSPC",
    },
    {
        "keywords": ["200고배당", "주주환원고배당", "배당주"],
        "group": "한국 고배당",
        "benchmark": "^KS11",
    },
    {
        "keywords": ["금현물", "국제금", "krx금", "금선물", "gold"],
        "group": "금·귀금속",
        "benchmark": "GC=F",
    },
    {
        "keywords": ["tdf"],
        "group": "TDF 생애주기",
        "benchmark": "^KS11",
    },
    {
        "keywords": ["방산", "우주항공", "방위산업"],
        "group": "방산·우주항공",
        "benchmark": "^KS11",
    },
    {
        "keywords": ["코스피200", "kospi200"],
        "group": "코스피200",
        "benchmark": "^KS11",
    },
    {
        "keywords": ["고배당", "배당성장", "주주환원", "배당주", "코리아배당"],
        "group": "배당·주주환원",
        "benchmark": "^KS11",
    },
    {
        "keywords": ["머니마켓", "cd금리", "kofr", "단기채", "파킹"],
        "group": "단기채·현금성",
        "benchmark": None,
    },
]


def _match_category(name: str) -> dict | None:
    """ETF 이름으로 카테고리 매칭 — 더 긴 키워드 우선."""
    name_l = name.lower().replace(" ", "")

    # "200"이 있고 미국/해외 키워드 없으면 → 국내 코스피200 / 고배당
    if "200" in name_l and not any(k in name_l for k in ["미국", "s&p", "나스닥", "nasdaq"]):
        if "배당" in name_l or "커버드콜" in name_l:
            return next((c for c in CATEGORY_PEERS if c["group"] == "한국 고배당"), None)
        return next((c for c in CATEGORY_PEERS if c["group"] == "코스피200"), None)

    best: dict | None = None
    best_len = 0
    for cat in CATEGORY_PEERS:
        # 미국/나스닥 그룹 → 해당 키워드가 종목명에 없으면 건너뜀
        if "미국" in cat["group"] or "나스닥" in cat["group"]:
            if not any(k in name_l for k in ["미국", "나스닥", "nasdaq", "s&p", "빅테크", "qqq", "필라델피아"]):
                continue

        for kw in cat["keywords"]:
            kw_norm = kw.replace(" ", "").lower()
            if kw_norm in name_l and len(kw_norm) > best_len:
                best = cat
                best_len = len(kw_norm)
    return best


# ─────────────────────────────────────────────────────────────────────────────
# 가격 조회 함수 (3단계 폴백)
# ─────────────────────────────────────────────────────────────────────────────

def _fetch_via_pykrx(code: str, days: int = 140) -> list[float]:
    """1순위: pykrx — KRX 공식 데이터, SSL 문제 없음.
    
    KRX 종목코드는 6자리이며, 숫자만(예: 396500) 또는 숫자+알파벳(예: 0093A0) 모두 존재함.
    pykrx는 숫자 6자리 코드만 조회 가능. 알파벳 포함 코드는 조회 불가.
    """
    # 알파벳 포함 코드는 pykrx 조회 불가
    if not code.isdigit():
        logger.debug(f"[pykrx] {code}: 알파벳 포함 코드 → skip")
        return []
    try:
        from pykrx import stock as pykrx_stock
        end_dt = datetime.now()
        start_dt = end_dt - timedelta(days=days)
        df = pykrx_stock.get_market_ohlcv(
            start_dt.strftime("%Y%m%d"),
            end_dt.strftime("%Y%m%d"),
            code
        )
        if df is None or df.empty:
            return []
        close_col = None
        for cn in ["종가", "Close", "close"]:
            if cn in df.columns:
                close_col = cn
                break
        if close_col is None:
            num_cols = df.select_dtypes(include="number").columns.tolist()
            if num_cols:
                close_col = num_cols[-1]
            else:
                return []
        closes = [float(v) for v in df[close_col].dropna().tolist() if v > 0]
        logger.info(f"[pykrx] {code}: {len(closes)} bars")
        return closes
    except Exception as e:
        logger.warning(f"[pykrx] {code} failed: {e}")
        return []


def _fetch_via_yf_v8(code: str, days: int = 140) -> list[float]:
    """2순위: Yahoo Finance v8 chart API — SSL을 requests로 직접 호출."""
    try:
        rng = "6mo" if days <= 200 else "1y"
        sym_enc = f"{code}.KS"
        url = f"https://query1.finance.yahoo.com/v8/finance/chart/{sym_enc}?interval=1d&range={rng}"
        resp = requests.get(url, headers={"User-Agent": "Mozilla/5.0"}, timeout=12)
        if resp.status_code != 200:
            # .KQ 시도
            sym_enc = f"{code}.KQ"
            url = f"https://query1.finance.yahoo.com/v8/finance/chart/{sym_enc}?interval=1d&range={rng}"
            resp = requests.get(url, headers={"User-Agent": "Mozilla/5.0"}, timeout=12)
        if resp.status_code != 200:
            return []
        rb = resp.json().get("chart", {}).get("result", [])
        if not rb:
            return []
        cls_list = rb[0].get("indicators", {}).get("quote", [{}])[0].get("close", [])
        closes = [float(c) for c in cls_list if c is not None and c > 0]
        if closes:
            logger.info(f"[YF-v8] {code}: {len(closes)} bars")
        return closes
    except Exception as e:
        logger.warning(f"[YF-v8] {code} failed: {e}")
        return []


def _fetch_via_yfinance(code: str) -> list[float]:
    """3순위: yfinance — 최후 폴백 (SSL 불안정할 수 있음)."""
    try:
        import yfinance as yf
        from datetime import timedelta
        end_dt = datetime.now()
        start_dt = end_dt - timedelta(days=140)
        for suffix in [".KS", ".KQ"]:
            hist = yf.Ticker(f"{code}{suffix}").history(
                start=start_dt.strftime("%Y-%m-%d"),
                end=end_dt.strftime("%Y-%m-%d"),
                auto_adjust=True
            )
            if hist is not None and not hist.empty and len(hist) >= 20:
                closes = [float(c) for c in hist["Close"].dropna().tolist() if c > 0]
                if closes:
                    logger.info(f"[yfinance] {code}{suffix}: {len(closes)} bars")
                    return closes
    except Exception as e:
        logger.warning(f"[yfinance] {code} failed: {e}")
    return []


def _fetch_via_kis(code: str) -> list[float]:
    """KIS 일봉 차트 API — 국내 주식/ETF 모두 지원."""
    ctx = _KIS_CTX
    if not ctx.get("token") or not ctx.get("url_base"):
        return []
    try:
        today = datetime.today()
        start = (today - timedelta(days=140)).strftime("%Y%m%d")
        end = today.strftime("%Y%m%d")
        url = f"{ctx['url_base']}/uapi/domestic-stock/v1/quotations/inquire-daily-itemchartprice"
        headers = {
            "content-type": "application/json; charset=utf-8",
            "authorization": f"Bearer {ctx['token']}",
            "appkey": ctx["app_key"],
            "appsecret": ctx["app_secret"],
            "tr_id": "FHKST03010100",
        }
        # ETF는 FID_COND_MRKT_DIV_CODE "ETF" 또는 "J" 모두 시도
        for mrkt_code in ["J", "ETF"]:
            params = {
                "FID_COND_MRKT_DIV_CODE": mrkt_code,
                "FID_INPUT_ISCD": code,
                "FID_INPUT_DATE_1": start,
                "FID_INPUT_DATE_2": end,
                "FID_PERIOD_DIV_CODE": "D",
                "FID_ORG_ADJ_PRC": "0",
            }
            resp = requests.get(url, headers=headers, params=params, timeout=8)
            if resp.status_code == 200:
                data = resp.json()
                if data.get("rt_cd") == "0":
                    output2 = data.get("output2", [])
                    kis_closes = []
                    for row in reversed(output2):
                        try:
                            c = float(row.get("stck_clpr", 0))
                            if c > 0:
                                kis_closes.append(c)
                        except Exception:
                            continue
                    if len(kis_closes) >= 20:
                        logger.info(f"[KIS] {code}: {len(kis_closes)} bars (mrkt={mrkt_code})")
                        return kis_closes
    except Exception as e:
        logger.warning(f"[KIS] {code} failed: {e}")
    return []


def _fetch_one_ks(code: str) -> list[float]:
    """
    단일 KRX 종목 종가 목록 반환 (최근 ~100 거래일).
    캐시 → pykrx(1순위) → Yahoo v8(2순위) → yfinance(3순위) → KIS.
    """
    now = time.time()
    if code in _PRICE_CACHE and now - _PRICE_CACHE_TIME.get(code, 0) < _PRICE_CACHE_TTL:
        return _PRICE_CACHE[code]

    closes: list[float] = []

    # 1순위: pykrx
    closes = _fetch_via_pykrx(code)

    # 2순위: Yahoo Finance v8
    if len(closes) < 22:
        closes = _fetch_via_yf_v8(code)

    # 3순위: yfinance 폴백
    if len(closes) < 22:
        closes = _fetch_via_yfinance(code)

    # 4순위: KIS (토큰 있을 때만)
    if len(closes) < 22:
        closes = _fetch_via_kis(code)

    if len(closes) >= 22:
        _PRICE_CACHE[code] = closes
        _PRICE_CACHE_TIME[code] = now
        return closes

    logger.warning(f"[fetch] {code}: 모든 소스 실패 또는 데이터 부족 ({len(closes)} rows)")
    return closes  # 빈 리스트나 부족한 데이터도 반환 (None 아님)


def _fetch_bench_closes(bench_sym: str) -> list[float]:
    """벤치마크 지수 종가 (Yahoo Finance v8 API)."""
    now = time.time()
    cache_key = f"_bench_{bench_sym}"
    if cache_key in _PRICE_CACHE and now - _PRICE_CACHE_TIME.get(cache_key, 0) < _PRICE_CACHE_TTL:
        return _PRICE_CACHE[cache_key]

    closes: list[float] = []
    try:
        sym_enc = bench_sym.replace("^", "%5E").replace("=", "%3D")
        url = f"https://query1.finance.yahoo.com/v8/finance/chart/{sym_enc}?interval=1d&range=6mo"
        resp = requests.get(url, headers={"User-Agent": "Mozilla/5.0"}, timeout=12)
        if resp.status_code == 200:
            rb = resp.json().get("chart", {}).get("result", [])
            if rb:
                cls_list = rb[0].get("indicators", {}).get("quote", [{}])[0].get("close", [])
                closes = [float(c) for c in cls_list if c is not None and c > 0]
    except Exception as e:
        logger.warning(f"[bench YF-v8] {bench_sym} failed: {e}")

    # yahoo v8 실패 시 yfinance 폴백
    if len(closes) < 22:
        try:
            import yfinance as yf
            from datetime import timedelta
            end_dt = datetime.now()
            start_dt = end_dt - timedelta(days=140)
            hist = yf.Ticker(bench_sym).history(
                start=start_dt.strftime("%Y-%m-%d"),
                end=end_dt.strftime("%Y-%m-%d"),
                auto_adjust=True
            )
            if hist is not None and not hist.empty:
                closes = [float(c) for c in hist["Close"].dropna().tolist() if c > 0]
        except Exception as e:
            logger.warning(f"[bench yfinance] {bench_sym} failed: {e}")

    if closes:
        _PRICE_CACHE[cache_key] = closes
        _PRICE_CACHE_TIME[cache_key] = now
        logger.info(f"[bench] {bench_sym}: {len(closes)} bars")

    return closes


# ─────────────────────────────────────────────────────────────────────────────
# 수익률 계산
# ─────────────────────────────────────────────────────────────────────────────

def _calc_return_pct(closes: list[float], days: int) -> float | None:
    """최근 N 거래일 수익률(%). closes 부족하면 None."""
    if len(closes) < days + 1:
        return None
    end = closes[-1]
    start = closes[-(days + 1)]
    if start <= 0:
        return None
    return round((end - start) / start * 100, 2)


# ─────────────────────────────────────────────────────────────────────────────
# 동적 피어 조회 (DB)
# ─────────────────────────────────────────────────────────────────────────────

async def get_dynamic_peers(cat: dict | None, db: AsyncSession) -> list[tuple[str, str]]:
    """DB에서 AUM 기준 상위 10개 동종 ETF 조회.
    
    알파벳 포함 코드(예: 0093A0)는 pykrx 조회 불가이므로 피어 목록에서 제외.
    """
    if not cat:
        return []
    try:
        from sqlalchemy import select, or_
        from db.models import ETFMaster
        query = select(ETFMaster.code, ETFMaster.name, ETFMaster.aum)
        conditions = [ETFMaster.name.ilike(f"%{kw}%") for kw in cat["keywords"]]
        if conditions:
            query = query.where(or_(*conditions))
        result = await db.execute(query)
        rows = result.all()

        def parse_aum(aum_str):
            if not aum_str:
                return 0.0
            s = str(aum_str).replace(",", "").replace("억", "")
            try:
                return float(s)
            except Exception:
                return 0.0

        sorted_rows = sorted(rows, key=lambda x: parse_aum(x.aum), reverse=True)
        # 알파벳 포함 코드는 pykrx 조회 불가 → 피어 목록에서 제외
        valid_rows = [
            (r.code, r.name) for r in sorted_rows
            if r.code and r.code.isdigit() and len(r.code) == 6
        ]
        logger.info(f"[get_dynamic_peers] {cat['group']}: DB {len(sorted_rows)}개 중 pykrx 가능 {len(valid_rows)}개")
        return valid_rows[:10]
    except Exception as e:
        logger.error(f"[get_dynamic_peers] {cat.get('group', '?')}: {e}")
        return []


# ─────────────────────────────────────────────────────────────────────────────
# rebalance_proposal 등 외부에서 호출하는 단일 종목 분석
# ─────────────────────────────────────────────────────────────────────────────

def _analyze_one(
    code: str,
    name: str,
    eval_amount: float,
    total_portfolio: float,
    peers_raw: list[tuple[str, str]] | None = None,
) -> dict:
    """단일 종목 전체 분석 (동기 — ThreadPoolExecutor에서 실행 가능)."""
    cat = _match_category(name)

    base: dict[str, Any] = {
        "code": code,
        "name": name,
        "eval_amount": eval_amount,
        "weight_pct": round(eval_amount / total_portfolio * 100, 2) if total_portfolio > 0 else 0,
        "category": cat["group"] if cat else "기타",
        "benchmark_sym": cat["benchmark"] if cat else None,
        "peer_count": 0,
        "rank_1m": None,
        "rank_3m": None,
        "total_valid_1m": 0,
        "total_valid_3m": 0,
        "return_1m": None,
        "return_3m": None,
        "peer_avg_1m": None,
        "peer_avg_3m": None,
        "excess_1m": None,
        "excess_3m": None,
        "bench_return_1m": None,
        "bench_return_3m": None,
        "alpha_1m": None,
        "alpha_3m": None,
        "peers_sorted_1m": [],
        "peers_sorted_3m": [],
    }

    if cat is None:
        return base

    # 피어 목록 추가 로직: 내 종목이 반드시 10개 안에 포함되도록 보장
    if peers_raw is None:
        peers_raw = []
    seen = {p[0] for p in peers_raw}
    if code not in seen:
        if len(peers_raw) >= 10:
            peers_raw.pop()  # AUM 가장 낮은 10번째 제거
        peers_raw.append((code, name))
    peers_raw = peers_raw[:10]

    # 피어 종가 + 수익률
    peer_results: list[dict] = []
    for pc, pn in peers_raw:
        closes = _fetch_one_ks(pc)
        r1m = _calc_return_pct(closes, 21)
        r3m = _calc_return_pct(closes, 63)
        peer_results.append({"code": pc, "name": pn, "return_1m": r1m, "return_3m": r3m, "is_mine": pc == code})
        time.sleep(0.1)

    # 벤치마크
    bench_sym = cat.get("benchmark")
    bench_r1m: float | None = None
    bench_r3m: float | None = None
    if bench_sym:
        bc = _fetch_bench_closes(bench_sym)
        bench_r1m = _calc_return_pct(bc, 21)
        bench_r3m = _calc_return_pct(bc, 63)

    # 순위 계산
    valid1 = [p for p in peer_results if p["return_1m"] is not None]
    valid3 = [p for p in peer_results if p["return_3m"] is not None]
    s1 = sorted(valid1, key=lambda x: x["return_1m"], reverse=True)  # type: ignore
    s3 = sorted(valid3, key=lambda x: x["return_3m"], reverse=True)  # type: ignore
    my_r1 = next((p["return_1m"] for p in peer_results if p["is_mine"]), None)
    my_r3 = next((p["return_3m"] for p in peer_results if p["is_mine"]), None)
    rank1 = next((i + 1 for i, p in enumerate(s1) if p["is_mine"]), None)
    rank3 = next((i + 1 for i, p in enumerate(s3) if p["is_mine"]), None)
    avg1 = round(sum(p["return_1m"] for p in valid1) / len(valid1), 2) if valid1 else None  # type: ignore
    avg3 = round(sum(p["return_3m"] for p in valid3) / len(valid3), 2) if valid3 else None  # type: ignore

    base.update({
        "peer_count": len(peer_results),
        "rank_1m": rank1, "rank_3m": rank3,
        "total_valid_1m": len(valid1), "total_valid_3m": len(valid3),
        "return_1m": my_r1, "return_3m": my_r3,
        "peer_avg_1m": avg1, "peer_avg_3m": avg3,
        "excess_1m": round(my_r1 - avg1, 2) if (my_r1 is not None and avg1 is not None) else None,
        "excess_3m": round(my_r3 - avg3, 2) if (my_r3 is not None and avg3 is not None) else None,
        "bench_return_1m": bench_r1m, "bench_return_3m": bench_r3m,
        "alpha_1m": round(my_r1 - bench_r1m, 2) if (my_r1 is not None and bench_r1m is not None) else None,
        "alpha_3m": round(my_r3 - bench_r3m, 2) if (my_r3 is not None and bench_r3m is not None) else None,
        "peers_sorted_1m": [{"code": p["code"], "name": p["name"], "return_1m": p["return_1m"], "is_mine": p["is_mine"]} for p in s1],
        "peers_sorted_3m": [{"code": p["code"], "name": p["name"], "return_3m": p["return_3m"], "is_mine": p["is_mine"]} for p in s3],
    })
    return base


# ─────────────────────────────────────────────────────────────────────────────
# 메인 엔드포인트
# ─────────────────────────────────────────────────────────────────────────────

@router.get("/peer-analysis")
async def get_peer_analysis(request: Request, db: AsyncSession = Depends(get_db)):
    """
    보유 종목별 동종 ETF 대비 성과 분석
    - 1M / 3M 수익률 카테고리 순위
    - 벤치마크 대비 알파
    - 포트폴리오 기여도(비중)
    캐시: 4시간
    """
    from api.my_assets import get_my_portfolio, TOKEN_CACHE

    now_ts = time.time()

    # ── 보유 종목 조회 ──────────────────────────────────────────────────────
    portfolio = await get_my_portfolio(request=request, db=db)
    all_h = portfolio.get("kis_raw", {}).get("holdings", [])
    # KRX 국내 ETF/종목 필터: 6자리 코드 (숫자 또는 숫자+알파벳 모두 포함)
    # 예: 396500(숫자), 0093A0(알파벳 포함) 모두 국내 종목
    # 영문 티커(예: TSLA, AAPL)와 구분: 6자리이고 첫 글자가 숫자인 코드
    domestic = [
        h for h in all_h
        if (
            h.get("code", "") and
            len(h.get("code", "")) == 6 and
            h.get("code", "")[0].isdigit()  # 첫 글자가 숫자 → KRX 코드
        )
    ]
    if not domestic:
        return {"status": "success", "count": 0, "items": [], "cached": False}

    total_portfolio = sum(h.get("eval_amount", 0) for h in domestic)

    # ── KIS 토큰 컨텍스트 주입 ─────────────────────────────────────────────
    import os as _os
    from dotenv import load_dotenv
    _env_path = _os.path.join(_os.path.dirname(_os.path.dirname(__file__)), ".env")
    load_dotenv(dotenv_path=_env_path, override=True)
    _kis_url_base = _os.environ.get("KIS_URL_BASE", "https://openapi.koreainvestment.com:9443")
    for _app_key, _cached in TOKEN_CACHE.items():
        if _cached.get("expires_at", 0) > time.time():
            _KIS_CTX.update({
                "token": _cached["access_token"],
                "app_key": _app_key,
                "app_secret": _cached.get("app_secret", ""),
                "url_base": _kis_url_base,
            })
            logger.info(f"[peer] KIS CTX set: key={_app_key[:8]}...")
            break

    # ── 1단계: 카테고리 + 피어 목록 수집 (async DB 조회) ──────────────────
    holding_peers: dict[str, list[tuple[str, str]]] = {}
    all_needed_codes: set[str] = set()
    bench_syms: set[str] = set()

    for h in domestic:
        code = h.get("code", "")
        name = h.get("name", "")
        all_needed_codes.add(code)
        cat = _match_category(name)
        if cat:
            peers_raw = await get_dynamic_peers(cat, db)
            # 내 종목이 피어 목록에 없으면 맨 끝 항목과 교체해서라도 반드시 추가
            seen = {p[0] for p in peers_raw}
            if code not in seen:
                if len(peers_raw) >= 10:
                    peers_raw.pop()
                peers_raw.append((code, name))
            peers_raw = peers_raw[:10]
            holding_peers[code] = peers_raw
            for pc, _ in peers_raw:
                all_needed_codes.add(pc)
            if cat.get("benchmark"):
                bench_syms.add(cat["benchmark"])
        else:
            # 카테고리 미매칭 — 내 종목만 포함
            holding_peers[code] = [(code, name)]
            all_needed_codes.add(code)

    # ── 2단계: 모든 종목 종가 사전 수집 ───────────────────────────────────
    # 캐시 미등록 종목만
    uncached = [
        c for c in all_needed_codes
        if c not in _PRICE_CACHE or now_ts - _PRICE_CACHE_TIME.get(c, 0) >= _PRICE_CACHE_TTL
    ]
    logger.info(f"[peer] Pre-fetching {len(uncached)}/{len(all_needed_codes)} tickers")

    loop = asyncio.get_event_loop()
    for code_to_fetch in uncached:
        try:
            await loop.run_in_executor(None, _fetch_one_ks, code_to_fetch)
        except Exception as e:
            logger.warning(f"[peer pre-fetch] {code_to_fetch}: {e}")
        await asyncio.sleep(0.2)   # pykrx / KIS 속도 제한 보호

    # ── 3단계: 벤치마크 수익률 수집 ───────────────────────────────────────
    bench_cache: dict[str, tuple[float | None, float | None]] = {}
    for bs in bench_syms:
        bench_key = f"_bench_{bs}"
        if bench_key in _PRICE_CACHE and now_ts - _PRICE_CACHE_TIME.get(bench_key, 0) < _PRICE_CACHE_TTL:
            bc = _PRICE_CACHE[bench_key]
        else:
            bc = await loop.run_in_executor(None, _fetch_bench_closes, bs)
        b1m = _calc_return_pct(bc, 21)
        b3m = _calc_return_pct(bc, 63)
        bench_cache[bs] = (b1m, b3m)
        await asyncio.sleep(0.2)

    # ── 4단계: 분석 (캐시에서 계산 — 네트워크 없음) ───────────────────────
    def _analyze_cached(code: str, name: str, eval_amount: float, peers_raw: list[tuple[str, str]]) -> dict:
        cat = _match_category(name)
        base: dict = {
            "code": code, "name": name, "eval_amount": eval_amount,
            "weight_pct": round(eval_amount / total_portfolio * 100, 2) if total_portfolio > 0 else 0,
            "category": cat["group"] if cat else "기타",
            "benchmark_sym": cat["benchmark"] if cat else None,
            "peer_count": 0, "rank_1m": None, "rank_3m": None,
            "total_valid_1m": 0, "total_valid_3m": 0,
            "return_1m": None, "return_3m": None,
            "peer_avg_1m": None, "peer_avg_3m": None,
            "excess_1m": None, "excess_3m": None,
            "bench_return_1m": None, "bench_return_3m": None,
            "alpha_1m": None, "alpha_3m": None,
            "peers_sorted_1m": [], "peers_sorted_3m": [],
        }
        if cat is None:
            return base

        bench_sym = cat.get("benchmark")
        bench_r1m, bench_r3m = bench_cache.get(bench_sym, (None, None)) if bench_sym else (None, None)

        peer_results: list[dict] = []
        for pc, pn in peers_raw:
            closes = _PRICE_CACHE.get(pc, [])
            r1m = _calc_return_pct(closes, 21)
            r3m = _calc_return_pct(closes, 63)
            peer_results.append({"code": pc, "name": pn, "return_1m": r1m, "return_3m": r3m, "is_mine": pc == code})

        valid1 = [p for p in peer_results if p["return_1m"] is not None]
        valid3 = [p for p in peer_results if p["return_3m"] is not None]
        s1 = sorted(valid1, key=lambda x: x["return_1m"], reverse=True)  # type: ignore
        s3 = sorted(valid3, key=lambda x: x["return_3m"], reverse=True)  # type: ignore
        my_r1 = next((p["return_1m"] for p in peer_results if p["is_mine"]), None)
        my_r3 = next((p["return_3m"] for p in peer_results if p["is_mine"]), None)
        rank1 = next((i + 1 for i, p in enumerate(s1) if p["is_mine"]), None)
        rank3 = next((i + 1 for i, p in enumerate(s3) if p["is_mine"]), None)
        avg1 = round(sum(p["return_1m"] for p in valid1) / len(valid1), 2) if valid1 else None  # type: ignore
        avg3 = round(sum(p["return_3m"] for p in valid3) / len(valid3), 2) if valid3 else None  # type: ignore

        base.update({
            "peer_count": len(peer_results),
            "rank_1m": rank1, "rank_3m": rank3,
            "total_valid_1m": len(valid1), "total_valid_3m": len(valid3),
            "return_1m": my_r1, "return_3m": my_r3,
            "peer_avg_1m": avg1, "peer_avg_3m": avg3,
            "excess_1m": round(my_r1 - avg1, 2) if (my_r1 is not None and avg1 is not None) else None,
            "excess_3m": round(my_r3 - avg3, 2) if (my_r3 is not None and avg3 is not None) else None,
            "bench_return_1m": bench_r1m, "bench_return_3m": bench_r3m,
            "alpha_1m": round(my_r1 - bench_r1m, 2) if (my_r1 is not None and bench_r1m is not None) else None,
            "alpha_3m": round(my_r3 - bench_r3m, 2) if (my_r3 is not None and bench_r3m is not None) else None,
            "peers_sorted_1m": [{"code": p["code"], "name": p["name"], "return_1m": p["return_1m"], "is_mine": p["is_mine"]} for p in s1],
            "peers_sorted_3m": [{"code": p["code"], "name": p["name"], "return_3m": p["return_3m"], "is_mine": p["is_mine"]} for p in s3],
        })

        # 카테고리에 데이터가 없더라도(valid1=0) 내 종목 수익률만이라도 표시
        if my_r1 is not None or my_r3 is not None:
            base["peer_count"] = max(base["peer_count"], 1)

        return base

    items = []
    for h in domestic:
        code = h.get("code", "")
        name = h.get("name", "")
        peers_raw = holding_peers.get(code, [(code, name)])
        item = _analyze_cached(code, name, float(h.get("eval_amount", 0)), peers_raw)
        item["account_no"] = h.get("account_no", "")
        items.append(item)

    items.sort(key=lambda x: x.get("eval_amount", 0), reverse=True)

    analysed = sum(1 for it in items if it.get("return_1m") is not None)
    logger.info(f"[peer] Done: {len(items)} holdings, {analysed} with 1M data")

    return {
        "status": "success",
        "count": len(items),
        "total_portfolio": total_portfolio,
        "items": items,
        "cached": False,
    }
