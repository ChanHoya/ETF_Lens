"""
AI Macro Rotation Compass
Determines US and Korea economic cycle phases (Recovery / Expansion / Slowdown / Recession)
using Yahoo Finance v8 chart API (yfinance 대체) and Gemini AI explanations.
Results are cached for 24 hours to minimise API costs.

Indicators:
  US:  XLI(ISM proxy), ^TNX(인플레), XLY/XLP 비율(고용심리), ^IRX(단기금리), VIX(FGI), ^GSPC
  KR:  EWY(CLI proxy), SOXX(수출proxy), KRW=X inverse(BOK 금리환경), ^KS11(KOSPI)
"""
import asyncio
import logging
import os
from datetime import datetime
from typing import Optional

import pandas as pd
from fastapi import APIRouter, Depends
from sqlalchemy.ext.asyncio import AsyncSession

from db.database import get_db

logger = logging.getLogger(__name__)
router = APIRouter(tags=["macro_compass"])

# 24-hour cache
_compass_cache: dict = {}
CACHE_TTL = 3600 * 24  # seconds


def _last_value(s: pd.Series) -> tuple[Optional[float], Optional[str]]:
    """Return (latest non-NaN value, date string). Returns (None, None) if empty."""
    if s is None or s.empty:
        return None, None
    val = float(s.iloc[-1])
    date_str = str(s.index[-1].date()) if hasattr(s.index[-1], "date") else str(s.index[-1])
    return val, date_str


def _momentum(s: pd.Series) -> tuple[Optional[float], Optional[str]]:
    """3-month % change of series. Returns (pct_change, last_date)."""
    if s is None or s.empty or len(s) < 2:
        return None, None
    base = float(s.iloc[0])
    if base == 0:
        return None, None
    pct = round((float(s.iloc[-1]) - base) / abs(base) * 100, 2)
    d = str(s.index[-1].date()) if hasattr(s.index[-1], "date") else str(s.index[-1])
    return pct, d


# ---------------------------------------------------------------------------
# Indicator collection
# ---------------------------------------------------------------------------

async def _get_us_indicators() -> dict:
    """
    US 매크로 지표 수집 (Yahoo v8 chart API 병렬 호출 - yfinance 대체).
    """
    import requests

    def _yv8(symbol: str, days: int = 95) -> pd.Series:
        """Yahoo Finance v8 chart API → pd.Series (날짜 인덱스, Close 값)."""
        try:
            rng = "3mo" if days <= 100 else ("1y" if days <= 400 else "3y")
            # ^VIX, ^TNX 등 특수문자 URL 인코딩
            sym_enc = symbol.replace("^", "%5E")
            url = f"https://query1.finance.yahoo.com/v8/finance/chart/{sym_enc}?interval=1d&range={rng}"
            r = requests.get(url, headers={"User-Agent": "Mozilla/5.0"}, timeout=15)
            if r.status_code != 200:
                logger.warning(f"Yahoo v8 {symbol} status={r.status_code}")
                return pd.Series(dtype=float)
            rb = r.json().get("chart", {}).get("result", [])
            if not rb:
                return pd.Series(dtype=float)
            ts  = rb[0].get("timestamp", [])
            cls = rb[0].get("indicators", {}).get("quote", [{}])[0].get("close", [])
            rows = {}
            for t, c in zip(ts, cls):
                if c is None:
                    continue
                rows[pd.Timestamp.fromtimestamp(t).normalize()] = float(c)
            s = pd.Series(rows)
            s.index = pd.DatetimeIndex(s.index)
            return s.sort_index()
        except Exception as e:
            logger.warning(f"Yahoo v8 {symbol} failed: {e}")
            return pd.Series(dtype=float)

    # Run all 7 tickers in parallel
    gspc, vix_s, tnx, irx, xli, xly, xlp = await asyncio.gather(
        asyncio.to_thread(_yv8, "^GSPC"),
        asyncio.to_thread(_yv8, "^VIX"),
        asyncio.to_thread(_yv8, "^TNX"),
        asyncio.to_thread(_yv8, "^IRX"),
        asyncio.to_thread(_yv8, "XLI"),
        asyncio.to_thread(_yv8, "XLY"),
        asyncio.to_thread(_yv8, "XLP"),
    )

    # ISM proxy: XLI 3M 모멘텀
    ism_v, ism_d = _momentum(xli)

    # 인플레 proxy: 10년물 국채금리
    pce_v, pce_d = _last_value(tnx)

    # 고용 proxy: XLY/XLP 비율 3M 변화
    if not xly.empty and not xlp.empty:
        common = xly.index.intersection(xlp.index)
        ratio = (xly.loc[common] / xlp.loc[common]).dropna()
        unemp_v, unemp_d = _momentum(ratio)
    else:
        unemp_v, unemp_d = None, None

    # Fed Rate proxy: ^IRX (13주 T-bill 연환산 금리)
    fed_v, fed_d = _last_value(irx)

    # FGI: VIX 기반
    vix_v, vix_d = _last_value(vix_s)
    fgi_v = None
    if vix_v is not None:
        fgi_v = round(max(0.0, min(100.0, 50.0 - (vix_v - 18.0) * 3.0)), 1)

    # S&P500 3M 모멘텀
    sp_momentum, sp_d = _momentum(gspc)

    return {
        "ism":            {"value": ism_v,       "updated_at": ism_d,   "label": "산업재(XLI) 3M 모멘텀"},
        "pce":            {"value": pce_v,        "updated_at": pce_d,   "label": "10년물 금리(인플레 대용)"},
        "unemployment":   {"value": unemp_v,      "updated_at": unemp_d, "label": "소비심리비율(XLY/XLP)"},
        "fed_rate":       {"value": fed_v,        "updated_at": fed_d,   "label": "단기금리(^IRX, Fed 대용)"},
        "fgi":            {"value": fgi_v,        "updated_at": vix_d,   "label": "공포탐욕지수(VIX 기반)"},
        "sp500_momentum": {"value": sp_momentum,  "updated_at": sp_d,    "label": "S&P500 3M 모멘텀"},
    }


async def _get_kr_indicators() -> dict:
    """
    한국 매크로 지표 수집 (Yahoo v8 chart API 병렬 호출 - yfinance 대체).
    """
    import requests

    def _yv8(symbol: str, days: int = 95) -> pd.Series:
        try:
            rng = "3mo" if days <= 100 else "1y"
            sym_enc = symbol.replace("^", "%5E")
            url = f"https://query1.finance.yahoo.com/v8/finance/chart/{sym_enc}?interval=1d&range={rng}"
            r = requests.get(url, headers={"User-Agent": "Mozilla/5.0"}, timeout=15)
            if r.status_code != 200:
                return pd.Series(dtype=float)
            rb = r.json().get("chart", {}).get("result", [])
            if not rb:
                return pd.Series(dtype=float)
            ts  = rb[0].get("timestamp", [])
            cls = rb[0].get("indicators", {}).get("quote", [{}])[0].get("close", [])
            rows = {}
            for t, c in zip(ts, cls):
                if c is None:
                    continue
                rows[pd.Timestamp.fromtimestamp(t).normalize()] = float(c)
            s = pd.Series(rows)
            s.index = pd.DatetimeIndex(s.index)
            return s.sort_index()
        except Exception as e:
            logger.warning(f"Yahoo v8 {symbol} failed: {e}")
            return pd.Series(dtype=float)

    # Run all 4 tickers in parallel
    ks_s, krw_s, ewy_s, soxx_s = await asyncio.gather(
        asyncio.to_thread(_yv8, "^KS11"),
        asyncio.to_thread(_yv8, "KRW=X"),
        asyncio.to_thread(_yv8, "EWY"),
        asyncio.to_thread(_yv8, "SOXX"),
    )

    # CLI proxy: EWY 3M 모멘텀
    cli_v, cli_d = _momentum(ewy_s)

    # 수출 proxy: SOXX 3M 모멘텀
    exp_v, exp_d = _momentum(soxx_s)

    # BOK Rate proxy: USD/KRW 3M 변화의 역수
    krw_chg, krw_chg_d = _momentum(krw_s)
    bok_v = round(-krw_chg, 2) if krw_chg is not None else None
    bok_d = krw_chg_d

    # KOSPI 3M 모멘텀
    kospi_mom, ks_d = _momentum(ks_s)

    # USD/KRW 현재값
    krw_v, krw_d = _last_value(krw_s)

    return {
        "cli":            {"value": cli_v,      "updated_at": cli_d,  "label": "한국ETF(EWY) 선행모멘텀"},
        "export_growth":  {"value": exp_v,      "updated_at": exp_d,  "label": "반도체(SOXX) 수출 대용"},
        "bok_rate":       {"value": bok_v,      "updated_at": bok_d,  "label": "원화강도(환율역수 = BOK 대용)"},
        "kospi_momentum": {"value": kospi_mom,  "updated_at": ks_d,   "label": "KOSPI 3M 모멘텀"},
        "usd_krw":        {"value": krw_v,      "updated_at": krw_d,  "label": "USD/KRW 현재 환율"},
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
    US 지표 스코어링 → (phase_en, confidence%)
    yfinance 프록시 기준:
      XLI 모멘텀(ISM proxy) / ^TNX(인플레) / XLY/XLP 비율변화(고용심리)
      ^IRX(단기금리) / FGI / S&P500 모멘텀
    """
    scores = {"recovery": 0, "expansion": 0, "slowdown": 0, "recession": 0}
    available = 0

    ism   = ind["ism"]["value"]          # XLI 3M % 모멘텀
    pce   = ind["pce"]["value"]          # 10년물 금리%
    unemp = ind["unemployment"]["value"] # XLY/XLP 비율 3M 변화%
    fed   = ind["fed_rate"]["value"]     # ^IRX %
    fgi   = ind["fgi"]["value"]          # 0-100
    sp_m  = ind["sp500_momentum"]["value"] # S&P500 3M %

    # XLI 3M 모멘텀 (>5% = 확장, 0~5% = 회복, <0% = 수축)
    if ism is not None:
        available += 1
        if ism > 5:
            scores["expansion"] += 2
        elif ism > 0:
            scores["recovery"]  += 1
        elif ism > -5:
            scores["slowdown"]  += 2
        else:
            scores["recession"] += 2

    # 10년물 금리 (2~3.5% = 정상, >4.5% = 과열, <2% = 침체)
    if pce is not None:
        available += 1
        if 2.0 < pce < 3.5:
            scores["expansion"] += 2
        elif pce <= 2.0:
            scores["recession"] += 1
        elif pce < 4.5:
            scores["slowdown"]  += 1
        else:
            scores["recession"] += 2

    # 소비심리(XLY/XLP) 3M 변화
    if unemp is not None:
        available += 1
        if unemp > 5:
            scores["expansion"] += 2
        elif unemp > 0:
            scores["recovery"]  += 1
        elif unemp > -5:
            scores["slowdown"]  += 2
        else:
            scores["recession"] += 2

    # 단기금리 ^IRX (<1.5% = 긴급완화, 1.5~3.5% = 완화적, 3.5~5.5% = 중립, >5.5% = 긴축)
    if fed is not None:
        available += 1
        if fed < 1.5:
            scores["recovery"]  += 2
        elif fed < 3.5:
            scores["expansion"] += 1
        elif fed < 5.5:
            scores["slowdown"]  += 1
        else:
            scores["recession"] += 2

    # FGI
    if fgi is not None:
        available += 1
        if fgi >= 65:
            scores["expansion"] += 2
        elif fgi >= 45:
            scores["recovery"]  += 1
        elif fgi >= 25:
            scores["slowdown"]  += 2
        else:
            scores["recession"] += 2

    # S&P500 3M 모멘텀
    if sp_m is not None:
        available += 1
        if sp_m >= 8:
            scores["expansion"] += 2
        elif sp_m >= 2:
            scores["recovery"]  += 1
        elif sp_m >= -5:
            scores["slowdown"]  += 1
        else:
            scores["recession"] += 2

    if available == 0:
        return "expansion", 30

    best_phase = max(scores, key=lambda k: scores[k])
    best_score = scores[best_phase]
    total      = sum(scores.values()) or 1
    confidence = min(95, max(35, round(best_score / total * 100)))

    return best_phase, confidence


def _score_kr_phase(ind: dict) -> tuple[str, int]:
    """
    한국 지표 스코어링 → (phase_en, confidence%)
    yfinance 프록시 기준:
      EWY 모멘텀(CLI proxy) / SOXX 모멘텀(수출) / 원화강도(BOK 대용) / KOSPI / USD/KRW
    """
    scores = {"recovery": 0, "expansion": 0, "slowdown": 0, "recession": 0}
    available = 0

    cli     = ind["cli"]["value"]           # EWY 3M %
    export  = ind["export_growth"]["value"] # SOXX 3M %
    bok     = ind["bok_rate"]["value"]      # -(USD/KRW 3M 변화%) : 원화강도
    kospi_m = ind["kospi_momentum"]["value"] # ^KS11 3M %
    krw     = ind["usd_krw"]["value"]       # USD/KRW 현재값

    # EWY 선행모멘텀
    if cli is not None:
        available += 1
        if cli > 5:
            scores["expansion"] += 2
        elif cli > 0:
            scores["recovery"]  += 1
        elif cli > -5:
            scores["slowdown"]  += 2
        else:
            scores["recession"] += 2

    # 반도체(SOXX) 수출 대용
    if export is not None:
        available += 1
        if export > 5:
            scores["expansion"] += 2
        elif export > 0:
            scores["recovery"]  += 1
        elif export > -10:
            scores["slowdown"]  += 2
        else:
            scores["recession"] += 2

    # 원화강도 proxy (양수 = 원화 강세 = 긍정, 음수 = 원화 약세 = 부정)
    if bok is not None:
        available += 1
        if bok > 3:
            scores["expansion"] += 2
        elif bok > -3:
            scores["recovery"]  += 1
        else:
            scores["recession"] += 2

    # KOSPI 3M 모멘텀
    if kospi_m is not None:
        available += 1
        if kospi_m >= 8:
            scores["expansion"] += 2
        elif kospi_m >= 2:
            scores["recovery"]  += 1
        elif kospi_m >= -5:
            scores["slowdown"]  += 1
        else:
            scores["recession"] += 2

    # USD/KRW 환율 수준
    if krw is not None:
        available += 1
        if krw >= 1450:
            scores["recession"] += 2
        elif krw >= 1350:
            scores["slowdown"]  += 1
        elif krw >= 1250:
            scores["recovery"]  += 1
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

    from google import genai  # type: ignore
    client = genai.Client(api_key=api_key)

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
        response = await asyncio.to_thread(
            client.models.generate_content,
            model="gemini-2.5-flash",
            contents=prompt,
        )
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
    cache_key = "macro_compass_v3"
    now_ts = __import__("time").time()
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

# ---------------------------------------------------------------------------
# AI Market Insight endpoint
# ---------------------------------------------------------------------------

_insight_cache: dict = {}
INSIGHT_CACHE_TTL = 3600 * 4  # 4시간 캐시
_etf_catalogue_cache: dict | None = None  # 24시간 ETF 목록 캐시
_etf_catalogue_ts: float = 0.0

_ETF_BOND_KW = ["국고채", "회사채", "채권", "단기채", "장기채", "미국채", "국채", "크레딧", "하이일드", "금리"]
_ETF_ALT_KW = ["금선물", "금현물", "달러", "원자재", "인버스", "레버리지", "혼합", "멀티에셋", "머니마켓", "CD금리", "SOFR"]


def _classify_etf(name: str) -> str:
    for kw in _ETF_BOND_KW:
        if kw in name:
            return "bond"
    for kw in _ETF_ALT_KW:
        if kw in name:
            return "alt"
    return "equity"


async def _load_etf_catalogue_from_fdr() -> dict[str, list[str]]:
    """finance-datareader를 사용해 KRX 실제 ETF 전체 목록을 조회합니다."""
    import time as _time
    global _etf_catalogue_cache, _etf_catalogue_ts

    # 24시간 캐시
    if _etf_catalogue_cache and _time.time() - _etf_catalogue_ts < 86400:
        return _etf_catalogue_cache

    try:
        import finance_datareader as fdr  # type: ignore
        df = await asyncio.to_thread(fdr.StockListing, "ETF/KR")
        catalogue: dict[str, list[str]] = {"equity": [], "bond": [], "alt": []}
        for _, row in df.iterrows():
            code = str(row.get("Symbol", row.get("Code", ""))).strip().zfill(6)
            name = str(row.get("Name", row.get("ISU_ABBRV", ""))).strip()
            if not code or not name or len(code) != 6:
                continue
            cat = _classify_etf(name)
            catalogue[cat].append(f"{code} {name}")
        if any(catalogue.values()):
            _etf_catalogue_cache = catalogue
            _etf_catalogue_ts = _time.time()
            logger.info(f"ETF catalogue loaded: equity={len(catalogue['equity'])}, bond={len(catalogue['bond'])}, alt={len(catalogue['alt'])}")
            return catalogue
    except Exception as e:
        logger.warning(f"fdr ETF catalogue failed: {e}")

    # --- fdr 실패 시 DB fallback ---
    return {"equity": [], "bond": [], "alt": []}


@router.get("/ai-insight")
async def get_ai_insight(
    dollar: float | None = None,
    krw: float | None = None,
    vix: float | None = None,
    fgi: float | None = None,
    sp500_mom: float | None = None,
    kospi_mom: float | None = None,
    db: AsyncSession = Depends(get_db),
):
    """
    모니터링 탭의 모든 데이터를 종합하여 Gemini가 최고 주식 전문가 관점의
    시장 인사이트를 생성합니다. 4시간 캐시.
    """
    import time
    cache_key = "ai_insight_v5"
    now_ts = time.time()
    if cache_key in _insight_cache:
        cached, ts = _insight_cache[cache_key]
        if now_ts - ts < INSIGHT_CACHE_TTL:
            return cached

    # 1. 나침반 데이터 수집 (캐시 활용)
    compass_key = "macro_compass_v3"
    compass_data = None
    if compass_key in _compass_cache:
        compass_data, _ = _compass_cache[compass_key]

    if compass_data is None:
        us_ind, kr_ind = await asyncio.gather(
            _get_us_indicators(),
            _get_kr_indicators(),
        )
        us_phase_en, us_conf = _score_us_phase(us_ind)
        kr_phase_en, kr_conf = _score_kr_phase(kr_ind)
        compass_data = {
            "us": {"phase": PHASE_NAMES[us_phase_en], "confidence": us_conf, "indicators": us_ind},
            "kr": {"phase": PHASE_NAMES[kr_phase_en], "confidence": kr_conf, "indicators": kr_ind},
        }

    api_key = os.environ.get("GEMINI_API_KEY", "")
    analyzed_at = datetime.now().strftime("%Y-%m-%d %H:%M")

    if not api_key:
        result = {
            "insight": "Gemini API 키가 설정되지 않아 AI 인사이트를 생성할 수 없습니다.",
            "analyzed_at": analyzed_at,
        }
        _insight_cache[cache_key] = (result, now_ts)
        return result

    # 2. 실제 ETF 목록 조회 (fdr → DB(충분할 때만))
    etf_catalogue = await _load_etf_catalogue_from_fdr()

    # fdr 실패 시 DB에서 보완 — DB에 50개 이상 있을 때만 사용 (배치 미실행 상태 차단)
    if not any(etf_catalogue.values()):
        try:
            from sqlalchemy import select as sa_select
            from db.models import ETFMaster
            rows = (await db.execute(sa_select(ETFMaster.code, ETFMaster.name))).all()
            total = len(rows)
            if total >= 50:  # 배치가 정상 실행된 상태에서만 사용
                for code, name in rows:
                    if code and name:
                        etf_catalogue[_classify_etf(name)].append(f"{code} {name}")
                logger.info(f"DB ETF fallback used: {total} ETFs")
            else:
                logger.warning(f"DB ETF fallback skipped: only {total} ETFs (batch not yet run)")
        except Exception as e:
            logger.warning(f"DB ETF fallback failed: {e}")

    def _fmt_cat(etfs: list[str], n: int = 25) -> str:
        import random
        sample = random.sample(etfs, min(n, len(etfs))) if len(etfs) > n else etfs
        return "\n".join(f"  - {e}" for e in sample)

    # ETF 목록 섹션 (비어 있으면 생략)
    has_etf_list = any(etf_catalogue.values())
    if has_etf_list:
        etf_list_block = f"""아래는 KRX 실제 상장 ETF 목록입니다. 반드시 이 목록에서만 선택하고, 목록에 없는 ETF는 절대 추천하지 마세요:

[주식형 ETF 후보]
{_fmt_cat(etf_catalogue['equity'])}

[채권형 ETF 후보]
{_fmt_cat(etf_catalogue['bond'])}

[현금·금·대안 ETF 후보]
{_fmt_cat(etf_catalogue['alt'])}"""
    else:
        etf_list_block = "※ ETF 목록 로드 실패 — 실제 KRX 상장 ETF 이름과 정확한 종목코드만 사용하세요."

    # 3. 프롬프트 작성
    us = compass_data.get("us", {})
    kr = compass_data.get("kr", {})
    us_ind = us.get("indicators", {})
    kr_ind = kr.get("indicators", {})

    lines = [
        "[미국 매크로]",
        f"  경기 사이클: {us.get('phase','N/A')} (확신도: {us.get('confidence','N/A')}%)",
        f"  ISM 모멘텀: {us_ind.get('ism',{}).get('value','N/A')}",
        f"  10년물 금리: {us_ind.get('pce',{}).get('value','N/A')}%",
        f"  단기금리(IRX): {us_ind.get('fed_rate',{}).get('value','N/A')}%",
        f"  S&P500 3M: {us_ind.get('sp500_momentum',{}).get('value','N/A')}%",
        f"  FGI(VIX기반): {us_ind.get('fgi',{}).get('value','N/A')}",
        "",
        "[한국 매크로]",
        f"  경기 사이클: {kr.get('phase','N/A')} (확신도: {kr.get('confidence','N/A')}%)",
        f"  KOSPI 3M: {kr_ind.get('kospi_momentum',{}).get('value','N/A')}%",
        f"  수출(SOXX): {kr_ind.get('export_growth',{}).get('value','N/A')}%",
        f"  USD/KRW: {kr_ind.get('usd_krw',{}).get('value','N/A')}",
    ]

    if dollar is not None:
        lines.append("\n[달러인덱스/환율]")
        lines.append(f"  달러인덱스(DXY): {dollar:.2f}")
    if krw is not None:
        lines.append(f"  USD/KRW: {krw:.0f}원")
    if vix is not None:
        lines.append(f"  VIX(공포지수): {vix:.1f}")
    if fgi is not None:
        lines.append(f"  FGI(탐욕지수): {fgi:.0f}")

    data_summary = "\n".join(lines)

    prompt = f"""당신은 월스트리트 탑티어 헤지펀드 매니저이자 거시경제 전문가입니다.
아래는 현재 실시간 글로벌 매크로 데이터입니다:

{data_summary}

{etf_list_block}

위 데이터를 바탕으로 다음 형식으로 정확히 작성하세요. 각 섹션 헤더를 반드시 그대로 사용하세요:

**📊 현재 시장 상황 진단**
(미국/한국 경기 현황, 핵심 지표 해석 2-3문장)

**⚠️ 주요 리스크 요인**
(현재 가장 주목해야 할 위험 요소 2가지, 번호 매김)

**💡 투자 전략 제언**
현재 경기 사이클에 맞는 추천 포트폴리오:

📌 자산 배분 비중: 주식 X% : 채권 Y% : 현금/금 Z%
(현재 사이클 근거 1문장)

🇰🇷 국내 ETF 추천 (위의 ETF 목록에서만 선택):

▶ 주식형 ETF (3~5개)
- [종목코드] ETF명: 추천 이유 한 줄

▶ 채권형 ETF (2~3개)
- [종목코드] ETF명: 추천 이유 한 줄

▶ 현금·금·대안 ETF (2~3개)
- [종목코드] ETF명: 추천 이유 한 줄

**🔍 핵심 모니터링 포인트**
(앞으로 주시해야 할 지표 2가지와 그 이유)

중요: ETF 추천은 반드시 위에 제공된 실제 상장 ETF 목록에서만 선택하고, 목록에 없는 ETF는 절대 추천하지 마세요."""

    try:
        from google import genai  # type: ignore
        client = genai.Client(api_key=api_key)
        response = await asyncio.to_thread(
            client.models.generate_content,
            model="gemini-2.5-flash",
            contents=prompt,
        )
        insight_text = response.text.strip()
    except Exception as e:
        logger.warning(f"Gemini insight failed: {e}")
        insight_text = f"현재 글로벌 경기는 미국 {us.get('phase','N/A')}, 한국 {kr.get('phase','N/A')} 국면입니다. AI 분석 생성 중 오류가 발생했습니다."

    result = {
        "insight": insight_text,
        "us_phase": us.get("phase"),
        "kr_phase": kr.get("phase"),
        "analyzed_at": analyzed_at,
    }
    _insight_cache[cache_key] = (result, now_ts)
    return result


@router.post("/ai-insight/reset-cache")
async def reset_insight_cache():
    _insight_cache.clear()
    return {"status": "ok", "message": "AI Insight cache cleared."}

