"""
AI Macro Rotation Compass
Determines US and Korea economic cycle phases (Recovery / Expansion / Slowdown / Recession)
using publicly available data (FRED CSVs + yfinance) and generates human-readable
explanations via Gemini. Results are cached for 24 hours to minimise API costs.
"""
import asyncio
import logging
import os
import time
from datetime import datetime, timedelta
from typing import Optional

import pandas as pd
import requests
import yfinance as yf
from fastapi import APIRouter

logger = logging.getLogger(__name__)
router = APIRouter(tags=["macro_compass"])

# 24-hour cache
_compass_cache: dict = {}
CACHE_TTL = 3600 * 24  # seconds

# ---------------------------------------------------------------------------
# FRED public CSV helper
# ---------------------------------------------------------------------------

def _fetch_fred_csv(series_id: str) -> pd.Series:
    """Download a FRED series as a pandas Series (date index, float values)."""
    url = f"https://fred.stlouisfed.org/graph/fredgraph.csv?id={series_id}"
    try:
        resp = requests.get(url, timeout=15,
                            headers={"User-Agent": "ETFLens/1.0 macro-compass"})
        resp.raise_for_status()
        from io import StringIO
        df = pd.read_csv(StringIO(resp.text), parse_dates=["DATE"], index_col="DATE")
        s = df.iloc[:, 0].replace(".", float("nan")).astype(float).dropna()
        return s
    except Exception as e:
        logger.warning(f"FRED CSV fetch failed for {series_id}: {e}")
        return pd.Series(dtype=float)


def _last_value(s: pd.Series) -> tuple[Optional[float], Optional[str]]:
    """Return (latest non-NaN value, date string). Returns (None, None) if empty."""
    if s.empty:
        return None, None
    val = float(s.iloc[-1])
    date_str = str(s.index[-1].date()) if hasattr(s.index[-1], "date") else str(s.index[-1])
    return val, date_str


# ---------------------------------------------------------------------------
# Indicator collection
# ---------------------------------------------------------------------------

async def _get_us_indicators() -> dict:
    """Collect 6 US macro indicators with latest value + update date."""
    end = datetime.now()
    start = end - timedelta(days=90)

    def fetch_fred_us():
        """Fetch all 4 FRED series sequentially in one thread (avoids FRED rate-limit)."""
        import time as _time
        results = {}
        for key, sid in [("ism", "NAPM"), ("pce", "PCEPILFE"),
                         ("unemployment", "UNRATE"), ("fed_rate", "FEDFUNDS")]:
            results[key] = _fetch_fred_csv(sid)
            _time.sleep(0.5)   # small delay to be polite (0.5s * 4 = ~2s extra)
        return results

    def fetch_yf_us():
        try:
            df = yf.download(["^VIX", "^GSPC"],
                             start=start.strftime("%Y-%m-%d"),
                             end=end.strftime("%Y-%m-%d"),
                             progress=False)
            close = df["Close"] if isinstance(df.columns, pd.MultiIndex) else df
            vix_s = close["^VIX"].dropna() if "^VIX" in close.columns else pd.Series(dtype=float)
            sp_s  = close["^GSPC"].dropna() if "^GSPC" in close.columns else pd.Series(dtype=float)
            return vix_s, sp_s
        except Exception as e:
            logger.warning(f"yfinance US fetch failed: {e}")
            return pd.Series(dtype=float), pd.Series(dtype=float)

    # FRED (sequential) + yfinance run concurrently
    fred_data, yf_result = await asyncio.gather(
        asyncio.to_thread(fetch_fred_us),
        asyncio.to_thread(fetch_yf_us),
    )
    vix_s, sp_s = yf_result

    ism_v,   ism_d   = _last_value(fred_data["ism"])
    pce_v,   pce_d   = _last_value(fred_data["pce"])
    unemp_v, unemp_d = _last_value(fred_data["unemployment"])
    fed_v,   fed_d   = _last_value(fred_data["fed_rate"])

    vix_v, vix_d = _last_value(vix_s)
    fgi_v = None
    if vix_v is not None:
        fgi_v = round(max(0.0, min(100.0, 50.0 - (vix_v - 18.0) * 3.0)), 1)

    sp_momentum = None
    sp_d = None
    if not sp_s.empty and len(sp_s) >= 2:
        sp_now = float(sp_s.iloc[-1])
        sp_90d = float(sp_s.iloc[0])
        sp_momentum = round((sp_now - sp_90d) / sp_90d * 100, 2)
        sp_d = str(sp_s.index[-1].date()) if hasattr(sp_s.index[-1], "date") else str(sp_s.index[-1])

    return {
        "ism":            {"value": ism_v,       "updated_at": ism_d},
        "pce":            {"value": pce_v,        "updated_at": pce_d},
        "unemployment":   {"value": unemp_v,      "updated_at": unemp_d},
        "fed_rate":       {"value": fed_v,        "updated_at": fed_d},
        "fgi":            {"value": fgi_v,        "updated_at": vix_d},
        "sp500_momentum": {"value": sp_momentum,  "updated_at": sp_d},
    }


async def _get_kr_indicators() -> dict:
    """Collect 5 Korea macro indicators with latest value + update date."""
    end = datetime.now()
    start = end - timedelta(days=90)

    def fetch_fred_kr():
        import time as _time
        results = {}
        for key, sid in [("cli", "KORLOLITOAASTSAM"),
                         ("export", "XTEXVA01KRM664S"),
                         ("bok_rate", "IRSTCI01KRM156N")]:
            results[key] = _fetch_fred_csv(sid)
            _time.sleep(0.5)
        return results

    def fetch_yf_kr():
        try:
            df = yf.download(["^KS11", "KRW=X"],
                             start=start.strftime("%Y-%m-%d"),
                             end=end.strftime("%Y-%m-%d"),
                             progress=False)
            close = df["Close"] if isinstance(df.columns, pd.MultiIndex) else df
            ks_s  = close["^KS11"].dropna() if "^KS11" in close.columns else pd.Series(dtype=float)
            krw_s = close["KRW=X"].dropna() if "KRW=X" in close.columns else pd.Series(dtype=float)
            return ks_s, krw_s
        except Exception as e:
            logger.warning(f"yfinance KR fetch failed: {e}")
            return pd.Series(dtype=float), pd.Series(dtype=float)

    fred_data, yf_result = await asyncio.gather(
        asyncio.to_thread(fetch_fred_kr),
        asyncio.to_thread(fetch_yf_kr),
    )
    ks_s, krw_s = yf_result

    cli_v, cli_d = _last_value(fred_data["cli"])
    exp_v, exp_d = _last_value(fred_data["export"])
    bok_v, bok_d = _last_value(fred_data["bok_rate"])

    kospi_mom = None
    ks_d = None
    if not ks_s.empty and len(ks_s) >= 2:
        kospi_mom = round((float(ks_s.iloc[-1]) - float(ks_s.iloc[0])) / float(ks_s.iloc[0]) * 100, 2)
        ks_d = str(ks_s.index[-1].date()) if hasattr(ks_s.index[-1], "date") else str(ks_s.index[-1])

    krw_v, krw_d = _last_value(krw_s)

    return {
        "cli":            {"value": cli_v,     "updated_at": cli_d},
        "export_growth":  {"value": exp_v,     "updated_at": exp_d},
        "bok_rate":       {"value": bok_v,     "updated_at": bok_d},
        "kospi_momentum": {"value": kospi_mom, "updated_at": ks_d},
        "usd_krw":        {"value": krw_v,     "updated_at": krw_d},
    }


# ---------------------------------------------------------------------------
# Rule-based phase scoring
# ---------------------------------------------------------------------------

PHASE_NAMES = {
    "recovery":  "회복기",
    "expansion": "확장기",
    "slowdown":  "둔화기",
    "recession": "침체기",
}

def _score_us_phase(ind: dict) -> tuple[str, int]:
    """
    Score US indicators → (phase_en, confidence%).
    Scoring based on Investment Clock logic:
      - ISM:         >52 expansion signal; <48 contraction
      - PCE:         >3.0 inflationary pressure
      - Unemployment: <4.0 tight; >4.5 loosening
      - Fed rate:    compare level; trend matters more but we use level proxy
      - FGI:         >60 greedy/expansion; <30 fear/recession
      - SP500 mom:   >5% expansion; <-5% contraction
    """
    scores = {"recovery": 0, "expansion": 0, "slowdown": 0, "recession": 0}

    ism   = ind["ism"]["value"]
    pce   = ind["pce"]["value"]
    unemp = ind["unemployment"]["value"]
    fed   = ind["fed_rate"]["value"]
    fgi   = ind["fgi"]["value"]
    sp_m  = ind["sp500_momentum"]["value"]

    available = 0  # count available indicators for confidence normalization

    # ISM
    if ism is not None:
        available += 1
        if ism > 53:
            scores["expansion"] += 2
        elif ism > 50:
            scores["recovery"]  += 1; scores["expansion"] += 1
        elif ism > 47:
            scores["slowdown"]  += 2
        else:
            scores["recession"] += 2

    # PCE (core inflation level)
    if pce is not None:
        available += 1
        if pce > 3.5:
            scores["slowdown"]  += 2     # stagflation pressure
        elif pce > 2.5:
            scores["expansion"] += 1
        elif pce > 1.5:
            scores["recovery"]  += 1
        else:
            scores["recession"] += 1     # deflation risk

    # Unemployment
    if unemp is not None:
        available += 1
        if unemp < 3.8:
            scores["expansion"] += 2
        elif unemp < 4.3:
            scores["recovery"]  += 1; scores["expansion"] += 1
        elif unemp < 5.0:
            scores["slowdown"]  += 2
        else:
            scores["recession"] += 2

    # Fed rate level (very high → slowdown/recession pressure)
    if fed is not None:
        available += 1
        if fed >= 5.0:
            scores["slowdown"]  += 1; scores["recession"] += 1
        elif fed >= 3.5:
            scores["expansion"] += 1; scores["slowdown"]  += 1
        elif fed >= 2.0:
            scores["recovery"]  += 1; scores["expansion"] += 1
        else:
            scores["recovery"]  += 2     # low rates → stimulus

    # FGI
    if fgi is not None:
        available += 1
        if fgi >= 65:
            scores["expansion"] += 2
        elif fgi >= 45:
            scores["recovery"]  += 1; scores["expansion"] += 1
        elif fgi >= 25:
            scores["slowdown"]  += 2
        else:
            scores["recession"] += 2

    # SP500 3-month momentum
    if sp_m is not None:
        available += 1
        if sp_m >= 8:
            scores["expansion"] += 2
        elif sp_m >= 2:
            scores["recovery"]  += 1; scores["expansion"] += 1
        elif sp_m >= -5:
            scores["slowdown"]  += 1
        else:
            scores["recession"] += 2

    if available == 0:
        return "expansion", 30   # default fallback

    best_phase = max(scores, key=lambda k: scores[k])
    best_score = scores[best_phase]
    total      = sum(scores.values()) or 1
    confidence = min(95, max(35, round(best_score / total * 100)))

    return best_phase, confidence


def _score_kr_phase(ind: dict) -> tuple[str, int]:
    """Score Korea indicators → (phase_en, confidence%)."""
    scores = {"recovery": 0, "expansion": 0, "slowdown": 0, "recession": 0}

    cli     = ind["cli"]["value"]
    export  = ind["export_growth"]["value"]
    bok     = ind["bok_rate"]["value"]
    kospi_m = ind["kospi_momentum"]["value"]
    krw     = ind["usd_krw"]["value"]

    available = 0

    # OECD CLI (Korea): >100 and rising → expansion
    if cli is not None:
        available += 1
        if cli >= 101.0:
            scores["expansion"] += 2
        elif cli >= 100.0:
            scores["recovery"]  += 1; scores["expansion"] += 1
        elif cli >= 99.0:
            scores["slowdown"]  += 2
        else:
            scores["recession"] += 2

    # Export YoY growth
    if export is not None:
        available += 1
        if export >= 10:
            scores["expansion"] += 2
        elif export >= 0:
            scores["recovery"]  += 1; scores["expansion"] += 1
        elif export >= -5:
            scores["slowdown"]  += 2
        else:
            scores["recession"] += 2

    # BOK base rate (high → potentially restrictive)
    if bok is not None:
        available += 1
        if bok >= 3.5:
            scores["slowdown"]  += 1; scores["recession"] += 1
        elif bok >= 2.5:
            scores["expansion"] += 1; scores["slowdown"]  += 1
        else:
            scores["recovery"]  += 2

    # KOSPI 3-month momentum
    if kospi_m is not None:
        available += 1
        if kospi_m >= 8:
            scores["expansion"] += 2
        elif kospi_m >= 2:
            scores["recovery"]  += 1; scores["expansion"] += 1
        elif kospi_m >= -5:
            scores["slowdown"]  += 1
        else:
            scores["recession"] += 2

    # USD/KRW: high KRW (weak) → risk-off / recession pressure
    if krw is not None:
        available += 1
        if krw >= 1450:
            scores["recession"] += 2
        elif krw >= 1350:
            scores["slowdown"]  += 1
        elif krw >= 1250:
            scores["expansion"] += 1; scores["recovery"] += 1
        else:
            scores["expansion"] += 2

    if available == 0:
        return "expansion", 30

    best_phase = max(scores, key=lambda k: scores[k])
    best_score = scores[best_phase]
    total      = sum(scores.values()) or 1
    confidence = min(95, max(35, round(best_score / total * 100)))

    return best_phase, confidence


# ---------------------------------------------------------------------------
# Sector weights & ETF tables
# ---------------------------------------------------------------------------

SECTOR_HEAT = {
    "us": {
        "recovery":  [
            {"sector": "중소형주",  "weight": "비중확대", "score": 1.5},
            {"sector": "소비재",    "weight": "비중확대", "score": 1.3},
            {"sector": "하이일드",  "weight": "비중확대", "score": 1.2},
            {"sector": "금융",      "weight": "중립",     "score": 1.0},
            {"sector": "헬스케어",  "weight": "중립",     "score": 1.0},
            {"sector": "유틸리티",  "weight": "비중축소", "score": 0.7},
            {"sector": "장기국채",  "weight": "비중축소", "score": 0.6},
        ],
        "expansion": [
            {"sector": "기술",      "weight": "비중확대", "score": 1.5},
            {"sector": "반도체",    "weight": "비중확대", "score": 1.4},
            {"sector": "에너지",    "weight": "비중확대", "score": 1.3},
            {"sector": "금융",      "weight": "비중확대", "score": 1.2},
            {"sector": "소재",      "weight": "중립",     "score": 1.0},
            {"sector": "헬스케어",  "weight": "비중축소", "score": 0.8},
            {"sector": "유틸리티",  "weight": "비중축소", "score": 0.6},
        ],
        "slowdown":  [
            {"sector": "헬스케어",  "weight": "비중확대", "score": 1.5},
            {"sector": "유틸리티",  "weight": "비중확대", "score": 1.4},
            {"sector": "필수소비재","weight": "비중확대", "score": 1.3},
            {"sector": "단기채권",  "weight": "비중확대", "score": 1.2},
            {"sector": "금",        "weight": "중립",     "score": 1.0},
            {"sector": "기술",      "weight": "비중축소", "score": 0.7},
            {"sector": "에너지",    "weight": "비중축소", "score": 0.6},
        ],
        "recession": [
            {"sector": "장기국채",  "weight": "비중확대", "score": 1.5},
            {"sector": "금",        "weight": "비중확대", "score": 1.4},
            {"sector": "헬스케어",  "weight": "비중확대", "score": 1.3},
            {"sector": "단기채권",  "weight": "비중확대", "score": 1.2},
            {"sector": "유틸리티",  "weight": "중립",     "score": 1.0},
            {"sector": "기술",      "weight": "비중축소", "score": 0.6},
            {"sector": "에너지",    "weight": "비중축소", "score": 0.5},
        ],
    },
    "kr": {
        "recovery":  [
            {"sector": "소비재",        "weight": "비중확대", "score": 1.5},
            {"sector": "중소형",        "weight": "비중확대", "score": 1.3},
            {"sector": "하이일드채권",  "weight": "비중확대", "score": 1.2},
            {"sector": "은행",          "weight": "중립",     "score": 1.0},
            {"sector": "헬스케어",      "weight": "중립",     "score": 1.0},
            {"sector": "채권",          "weight": "비중축소", "score": 0.7},
            {"sector": "금",            "weight": "비중축소", "score": 0.7},
        ],
        "expansion": [
            {"sector": "반도체",        "weight": "비중확대", "score": 1.5},
            {"sector": "2차전지",       "weight": "비중확대", "score": 1.4},
            {"sector": "수출대형주",    "weight": "비중확대", "score": 1.3},
            {"sector": "에너지",        "weight": "비중확대", "score": 1.2},
            {"sector": "인터넷/플랫폼", "weight": "중립",     "score": 1.0},
            {"sector": "채권",          "weight": "비중축소", "score": 0.6},
            {"sector": "금",            "weight": "비중축소", "score": 0.6},
        ],
        "slowdown":  [
            {"sector": "헬스케어",      "weight": "비중확대", "score": 1.5},
            {"sector": "단기채권",      "weight": "비중확대", "score": 1.4},
            {"sector": "금",            "weight": "비중확대", "score": 1.3},
            {"sector": "필수소비재",    "weight": "비중확대", "score": 1.2},
            {"sector": "배당주",        "weight": "중립",     "score": 1.0},
            {"sector": "반도체",        "weight": "비중축소", "score": 0.7},
            {"sector": "2차전지",       "weight": "비중축소", "score": 0.6},
        ],
        "recession": [
            {"sector": "단기채권",      "weight": "비중확대", "score": 1.5},
            {"sector": "금",            "weight": "비중확대", "score": 1.4},
            {"sector": "미국채",        "weight": "비중확대", "score": 1.3},
            {"sector": "헬스케어",      "weight": "비중확대", "score": 1.2},
            {"sector": "달러자산",      "weight": "중립",     "score": 1.0},
            {"sector": "반도체",        "weight": "비중축소", "score": 0.5},
            {"sector": "2차전지",       "weight": "비중축소", "score": 0.5},
        ],
    },
}

ETF_RECO = {
    "us": {
        "recovery":  [
            {"ticker": "IWM",  "name": "러셀2000 중소형",  "reason": "경기 반등 초기 중소형주 강세"},
            {"ticker": "XLY",  "name": "임의소비재",       "reason": "소비 회복 수혜"},
            {"ticker": "HYG",  "name": "하이일드 채권",    "reason": "신용 스프레드 축소 수혜"},
            {"ticker": "SCHD", "name": "배당성장주",       "reason": "안정적 배당 + 회복 참여"},
            {"ticker": "XLF",  "name": "금융섹터",         "reason": "금리 정상화 수혜"},
        ],
        "expansion": [
            {"ticker": "QQQ",  "name": "나스닥100",        "reason": "기술 성장주 주도 장세"},
            {"ticker": "SOXX", "name": "필라델피아반도체", "reason": "반도체 사이클 상승"},
            {"ticker": "XLK",  "name": "기술섹터",         "reason": "이익 성장 최대 구간"},
            {"ticker": "XLE",  "name": "에너지섹터",       "reason": "경기 확장시 에너지 수요 증가"},
            {"ticker": "VTI",  "name": "미국 전체시장",    "reason": "광범위한 확장기 수혜"},
        ],
        "slowdown":  [
            {"ticker": "XLV",  "name": "헬스케어",         "reason": "경기 방어 + 안정적 수익"},
            {"ticker": "XLU",  "name": "유틸리티",         "reason": "고배당 방어주"},
            {"ticker": "TLT",  "name": "장기국채 20Y+",    "reason": "금리 하락 기대 수혜"},
            {"ticker": "GLD",  "name": "금",               "reason": "인플레이션 헤지"},
            {"ticker": "LQD",  "name": "투자등급 회사채",  "reason": "안전 채권 수요 증가"},
        ],
        "recession": [
            {"ticker": "SHY",  "name": "단기국채 1-3Y",   "reason": "최고 안전자산"},
            {"ticker": "TLT",  "name": "장기국채 20Y+",   "reason": "경기침체 = 금리 인하 수혜"},
            {"ticker": "GLD",  "name": "금",              "reason": "위기 헤지 자산"},
            {"ticker": "USMV", "name": "최소변동성",      "reason": "낮은 변동성 방어"},
            {"ticker": "VIG",  "name": "배당성장",        "reason": "안정 배당 보호"},
        ],
    },
    "kr": {
        "recovery":  [
            {"ticker": "KODEX 소비재",    "name": "소비재",     "reason": "경기 반등 초기 내수 소비 회복"},
            {"ticker": "TIGER 중소형",    "name": "중소형주",   "reason": "회복기 중소형 강세"},
            {"ticker": "KODEX 하이일드",  "name": "하이일드채","reason": "크레딧 스프레드 축소 수혜"},
            {"ticker": "KODEX 은행",      "name": "은행",       "reason": "금리 정상화 + 대출 성장"},
            {"ticker": "TIGER 코스닥150", "name": "코스닥150",  "reason": "성장주 반등 선행"},
        ],
        "expansion": [
            {"ticker": "KODEX 반도체",          "name": "반도체",     "reason": "수출 주도 반도체 사이클 상승"},
            {"ticker": "TIGER 미국필라델피아반도체나스닥", "name": "미국반도체","reason": "글로벌 반도체 확장 수혜"},
            {"ticker": "KODEX 2차전지",         "name": "2차전지",    "reason": "전기차 수요 확장"},
            {"ticker": "KODEX 200",             "name": "코스피200",  "reason": "대형 수출주 강세"},
            {"ticker": "TIGER 에너지화학",      "name": "에너지화학","reason": "원자재 수요 증가"},
        ],
        "slowdown":  [
            {"ticker": "KODEX 헬스케어",     "name": "헬스케어",  "reason": "경기 방어 섹터"},
            {"ticker": "TIGER 단기통안채",   "name": "단기채권",  "reason": "안전 단기 금리 수혜"},
            {"ticker": "ACE KRX금현물",      "name": "금",        "reason": "인플레이션 + 위험 헤지"},
            {"ticker": "KODEX 배당가치",     "name": "배당가치",  "reason": "안정 배당주 방어"},
            {"ticker": "TIGER 미국채10년선물","name": "미국장기채","reason": "금리 인하 기대 수혜"},
        ],
        "recession": [
            {"ticker": "KODEX 단기종합채권",  "name": "단기채권",  "reason": "최고 안전자산"},
            {"ticker": "ACE KRX금현물",       "name": "금",        "reason": "위기 헤지 최우선"},
            {"ticker": "TIGER 미국채10년선물","name": "미국장기채","reason": "경기침체 = 금리 인하"},
            {"ticker": "KODEX 미국달러선물",  "name": "달러",      "reason": "안전통화 달러 강세"},
            {"ticker": "KODEX 헬스케어",      "name": "헬스케어",  "reason": "경기 무관 방어"},
        ],
    },
}

# ---------------------------------------------------------------------------
# Gemini explanation
# ---------------------------------------------------------------------------

async def _get_gemini_explanation(phase_en: str, indicators: dict,
                                   market: str, confidence: int) -> str:
    """Generate a concise Korean explanation of the current macro phase."""
    api_key = os.environ.get("GEMINI_API_KEY", "")
    if not api_key:
        return f"현재 {PHASE_NAMES[phase_en]} 단계로 판단됩니다. (Gemini API 키 미설정)"

    import google.generativeai as genai  # type: ignore
    genai.configure(api_key=api_key)

    market_name = "미국" if market == "us" else "한국"
    phase_ko = PHASE_NAMES[phase_en]

    # Build indicator summary for prompt
    ind_lines = []
    for k, v in indicators.items():
        val = v.get("value")
        upd = v.get("updated_at", "N/A")
        if val is not None:
            ind_lines.append(f"  - {k}: {val:.2f} (최신: {upd})")

    prompt = f"""당신은 거시경제 투자 전문가입니다.
현재 {market_name} 경기 사이클 분석 결과:
- 단계: {phase_ko} (확신도: {confidence}%)
- 주요 지표:
{chr(10).join(ind_lines)}

위 내용을 바탕으로 투자자를 위한 3문장 이내의 간결하고 명확한 한국어 설명을 작성하세요.
현재 단계의 특징, 주요 근거 지표 1-2개, 투자 시사점을 포함하세요.
전문 용어를 사용하되 이해하기 쉽게 작성하세요."""

    try:
        model = genai.GenerativeModel("gemini-1.5-flash")
        response = await asyncio.to_thread(model.generate_content, prompt)
        return response.text.strip()
    except Exception as e:
        logger.warning(f"Gemini explanation failed: {e}")
        phase_ko = PHASE_NAMES[phase_en]
        return f"현재 {market_name} 경제는 {phase_ko} 단계로 판단됩니다."


# ---------------------------------------------------------------------------
# Main endpoint
# ---------------------------------------------------------------------------

@router.get("/macro-compass")
async def get_macro_compass():
    """
    Returns US and Korea economic cycle phase with:
    - phase name, confidence, AI explanation
    - sector heatmap (weight guidance)
    - ETF recommendations (5 each)
    - per-indicator values and their last update dates
    24h cached.
    """
    cache_key = "macro_compass_v1"
    now_ts = time.time()
    if cache_key in _compass_cache:
        cached, ts = _compass_cache[cache_key]
        if now_ts - ts < CACHE_TTL:
            return cached

    # Fetch indicators concurrently
    us_ind, kr_ind = await asyncio.gather(
        _get_us_indicators(),
        _get_kr_indicators(),
    )

    us_phase_en, us_conf = _score_us_phase(us_ind)
    kr_phase_en, kr_conf = _score_kr_phase(kr_ind)

    # Generate Gemini explanations concurrently
    us_explanation, kr_explanation = await asyncio.gather(
        _get_gemini_explanation(us_phase_en, us_ind, "us", us_conf),
        _get_gemini_explanation(kr_phase_en, kr_ind, "kr", kr_conf),
    )

    analyzed_at = datetime.now().strftime("%Y-%m-%d %H:%M")

    result = {
        "us": {
            "phase":           PHASE_NAMES[us_phase_en],
            "phase_en":        us_phase_en,
            "confidence":      us_conf,
            "explanation":     us_explanation,
            "sector_weights":  SECTOR_HEAT["us"][us_phase_en],
            "etf_recommendations": ETF_RECO["us"][us_phase_en],
            "indicators":      us_ind,
            "analyzed_at":     analyzed_at,
        },
        "kr": {
            "phase":           PHASE_NAMES[kr_phase_en],
            "phase_en":        kr_phase_en,
            "confidence":      kr_conf,
            "explanation":     kr_explanation,
            "sector_weights":  SECTOR_HEAT["kr"][kr_phase_en],
            "etf_recommendations": ETF_RECO["kr"][kr_phase_en],
            "indicators":      kr_ind,
            "analyzed_at":     analyzed_at,
        },
    }

    _compass_cache[cache_key] = (result, now_ts)
    return result
