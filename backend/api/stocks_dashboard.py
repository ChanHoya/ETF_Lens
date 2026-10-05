# 시장동향 > 주식 탭용 KOSPI·S&P500·Nasdaq 20년 추이·낙폭·수익률, S&P 밸류에이션·위험 프리미엄, 강세장·약세장 이정표 API
"""
GET /api/v1/stocks/overview  (?refresh=true 로 캐시 무시)

- 원천: Yahoo v8 주간(지수), FRED(원/달러·미 10년), multpl.com 월간 표(S&P PER·CAPE·이익수익률).
- 계산(build_overview)은 네트워크와 분리해 테스트한다. 정의는 docs/stocks-tab-context-notes.md.
"""
import asyncio
import logging
import re
import time
from datetime import date, datetime, timedelta, timezone
from urllib.parse import quote

import numpy as np
import pandas as pd
import requests
from fastapi import APIRouter, HTTPException, Query

from core.overview_cache import OverviewCache, fred_csv, timed
from core.regime_auto import ASSET_NAME, enrich_texts, template_text, zigzag_auto

logger = logging.getLogger(__name__)
router = APIRouter()

YEARS = 20
CACHE_TTL = 30 * 60
BEAR = 0.20          # 강세장·약세장 경계(관행)
CORR_WINDOW = 52
INDICES = {"kospi": "^KS11", "spx": "^GSPC", "ndx": "^IXIC"}
MULTPL = {"pe": "s-p-500-pe-ratio", "cape": "shiller-pe", "ey": "s-p-500-earnings-yield"}


def _empty() -> pd.Series:
    return pd.Series(dtype=float, index=pd.DatetimeIndex([]))


def _series(d: dict[str, float]) -> pd.Series:
    if not d:
        return _empty()
    s = pd.Series(d, dtype=float)
    s.index = pd.to_datetime(s.index)
    return s.sort_index()


def _weekly(s: pd.Series) -> pd.Series:
    """주 단위(금요일 끝)로 맞춘다 — Yahoo 주간 봉 날짜가 시장 시간대에 따라 일요일·월요일로 달라 그대로는 지수끼리 어긋난다."""
    return s.resample("W-FRI").last().dropna() if not s.empty else _empty()


def _monthly(s: pd.Series) -> pd.Series:
    """월 단위(월초)로 맞춘다 — multpl 표는 최신 행만 월중 날짜다."""
    if s.empty:
        return _empty()
    m = s.copy()
    m.index = m.index.to_period("M").to_timestamp()
    return m[~m.index.duplicated(keep="last")]


def _r(v, n=2):
    return None if v is None or pd.isna(v) else round(float(v), n)


def _at(s: pd.Series, when: pd.Timestamp):
    past = s[s.index <= when]
    return None if past.empty else float(past.iloc[-1])


def _pct_change(s: pd.Series, days: int) -> float | None:
    prev = _at(s, s.index[-1] - timedelta(days=days)) if len(s) > 1 else None
    return None if not prev else _r((float(s.iloc[-1]) / prev - 1) * 100)


def _pct_rank(s: pd.Series, value: float) -> int | None:
    return None if s.empty else int(round((s <= value).mean() * 100))


def _cagr(s: pd.Series, years: int) -> float | None:
    since = s.index[-1] - pd.DateOffset(years=years)
    if s.index[0] > since + timedelta(days=14):  # 데이터가 그 기간을 다 덮지 못하면 계산하지 않는다
        return None
    start = _at(s, since) or float(s.iloc[0])  # 첫 관측이 그 날짜보다 며칠 늦으면 첫 값으로
    return _r(((float(s.iloc[-1]) / start) ** (1 / years) - 1) * 100)


def index_card(s: pd.Series, today: date) -> dict:
    """지수 스냅샷: 기간 수익률, 고점 대비 낙폭, 52주 범위 위치, 연평균 수익률."""
    last, v = s.index[-1], float(s.iloc[-1])
    prev_year_end = _at(s, pd.Timestamp(date(today.year - 1, 12, 31)))
    w52 = s[s.index >= last - timedelta(days=365)]
    lo, hi = float(w52.min()), float(w52.max())
    return {
        "value": _r(v), "date": last.strftime("%Y-%m-%d"),
        "chg_1w": _pct_change(s, 7), "chg_1m": _pct_change(s, 30), "chg_1y": _pct_change(s, 365),
        "ytd": _r((v / prev_year_end - 1) * 100) if prev_year_end else None,
        "drawdown": _r((v / float(s.max()) - 1) * 100), "ath": _r(s.max()), "ath_date": s.idxmax().strftime("%Y-%m-%d"),
        "w52_low": _r(lo), "w52_high": _r(hi), "w52_pos": int(round((v - lo) / (hi - lo) * 100)) if hi > lo else None,
        "cagr10": _cagr(s, 10), "cagr20": _cagr(s, 20),
    }


def stock_regimes(key: str, s: pd.Series) -> list[dict]:
    """주간 종가 지그재그(20% 반전)로 강세장·약세장. 마지막 전환점 이후는 진행 중 구간으로 항상 둔다."""
    if len(s) < 10:
        return []
    pivots, _ = zigzag_auto(s, BEAR)
    spans = [(d0, d1, v0, v1) for (d0, v0, _), (d1, v1, _) in zip(pivots, pivots[1:])]
    d_last, v_last, _ = pivots[-1]
    if s.index[-1] > d_last:
        spans.append((d_last, None, v_last, float(s.iloc[-1])))
    segs = []
    for d0, d1, v0, v1 in spans:
        seg = {"start": d0.strftime("%Y-%m-%d"), "end": d1.strftime("%Y-%m-%d") if d1 is not None else None,
               "kind": "bull" if v1 > v0 else "bear", "auto": True,
               "from": _r(v0), "to": _r(v1), "chg_pct": _r((v1 / v0 - 1) * 100, 1),
               "weeks": int(round(((d1 if d1 is not None else s.index[-1]) - d0).days / 7))}
        seg.update(template_text(key, seg))
        segs.append(seg)
    return segs


def _valuation(g, start: pd.Timestamp) -> dict | None:
    """S&P500 PER·CAPE·이익수익률(월간)과 주식 위험 프리미엄(이익수익률 − 미 10년)."""
    pe, cape, ey = _monthly(g("pe")), _monthly(g("cape")), _monthly(g("ey"))
    if pe.empty or ey.empty:
        return None
    us10 = g("us10")
    erp = (ey - us10.resample("MS").mean().reindex(ey.index)).dropna() if not us10.empty else _empty()

    def pack(s: pd.Series):
        if s.empty:
            return None
        s20 = s[s.index >= start]
        return {"value": _r(s.iloc[-1]), "date": s.index[-1].strftime("%Y-%m"), "avg20y": _r(s20.mean()),
                "pct20y": _pct_rank(s20, s.iloc[-1])}
    months = pe[pe.index >= start].index
    return {"pe": pack(pe), "cape": pack(cape), "ey": pack(ey), "erp": pack(erp),
            "us10": _r(us10.iloc[-1]) if not us10.empty else None,
            "rows": [{"date": m.strftime("%Y-%m"), "pe": _r(pe.get(m)), "cape": _r(cape.get(m)), "erp": _r(erp.get(m))}
                     for m in months]}


def build_overview(raw: dict[str, dict[str, float]], today: date) -> dict:
    S = {k: _series(v) for k, v in raw.items()}
    g = lambda k: S.get(k, _empty())  # noqa: E731
    start = pd.Timestamp(today) - pd.DateOffset(years=YEARS)
    idx = {k: w[w.index >= start] for k in INDICES if not (w := _weekly(g(k))).empty}

    cards = {k: index_card(s, today) for k, s in idx.items() if len(s) > 52}

    # KOSPI 달러 환산(외국인 투자자 관점): 주간 KOSPI ÷ 그 시점 원/달러 × 1000
    kospi, krw = idx.get("kospi", _empty()), g("krw")
    kospi_usd = (kospi / krw.reindex(kospi.index, method="ffill") * 1000).dropna() if not kospi.empty and not krw.empty else _empty()
    if len(kospi_usd) > 52:
        prev = _at(kospi_usd, pd.Timestamp(date(today.year - 1, 12, 31)))
        cards["kospi_usd"] = {"value": _r(kospi_usd.iloc[-1]), "chg_1y": _pct_change(kospi_usd, 365),
                              "ytd": _r((float(kospi_usd.iloc[-1]) / prev - 1) * 100) if prev else None,
                              "drawdown": _r((kospi_usd.iloc[-1] / kospi_usd.max() - 1) * 100)}

    wk = pd.DataFrame(idx)
    if not kospi_usd.empty:
        wk["kospi_usd"] = kospi_usd
    for k in INDICES:
        if k in wk:
            wk[f"dd_{k}"] = (wk[k] / wk[k].cummax() - 1) * 100
    if {"kospi", "spx"} <= set(wk.columns):
        rets = np.log(wk[["kospi", "spx"]]).diff()
        wk["corr_ks"] = rets["kospi"].rolling(CORR_WINDOW, min_periods=40).corr(rets["spx"])
    rows = [{"date": i.strftime("%Y-%m-%d"), **{c: _r(r[c]) for c in wk.columns}} for i, r in wk.iterrows()]
    if rows:  # 진행 중인 주는 다가올 금요일 대신 오늘로
        rows[-1]["date"] = min(rows[-1]["date"], today.isoformat())
    corr = wk["corr_ks"].dropna() if "corr_ks" in wk else _empty()

    return {"cards": cards, "corr_ks": _r(corr.iloc[-1]) if not corr.empty else None, "weekly": rows,
            "valuation": _valuation(g, start), "regimes": {k: stock_regimes(k, s) for k, s in idx.items()},
            "data_dates": {k: s.index[-1].strftime("%Y-%m-%d") for k, s in S.items() if not s.empty},
            "updated_at": datetime.now(timezone.utc).isoformat(timespec="seconds")}


# ── 수집 ────────────────────────────────────────────────────────────────────
def yahoo_weekly(symbol: str, years: int = YEARS) -> dict[str, float]:
    try:
        url = f"https://query1.finance.yahoo.com/v8/finance/chart/{quote(symbol)}?range={years}y&interval=1wk"
        resp = requests.get(url, headers={"User-Agent": "Mozilla/5.0"}, timeout=20)
        if resp.status_code != 200:
            logger.warning(f"Yahoo weekly {symbol} status={resp.status_code}")
            return {}
        rb = resp.json()["chart"]["result"][0]
        closes = rb["indicators"]["quote"][0]["close"]
        return {datetime.fromtimestamp(t, tz=timezone.utc).strftime("%Y-%m-%d"): float(c)
                for t, c in zip(rb["timestamp"], closes) if isinstance(c, (int, float))}
    except Exception as e:
        logger.warning(f"Yahoo weekly {symbol} failed: {type(e).__name__}")
        return {}


_MULTPL_ROW = re.compile(r"<td[^>]*>\s*([A-Z][a-z]{2} \d{1,2}, \d{4})\s*</td>\s*<td[^>]*>\s*(?:&#x2002;|<abbr[^>]*>[^<]*</abbr>)?\s*([\d.]+)")


def parse_multpl(html: str) -> dict[str, float]:
    return {datetime.strptime(d, "%b %d, %Y").strftime("%Y-%m-%d"): float(v) for d, v in _MULTPL_ROW.findall(html)}


def multpl_monthly(slug: str) -> dict[str, float]:
    """multpl.com 월간 표 — 구조가 바뀌면 빈 값(그 섹션만 비고 나머지는 동작)."""
    try:
        resp = requests.get(f"https://www.multpl.com/{slug}/table/by-month", headers={"User-Agent": "Mozilla/5.0"}, timeout=20)
        return parse_multpl(resp.text)
    except Exception as e:
        logger.warning(f"multpl {slug} failed: {type(e).__name__}")
        return {}


async def _collect_raw() -> tuple[dict[str, dict[str, float]], dict[str, float]]:
    start = (date.today() - timedelta(days=365 * (YEARS + 1))).isoformat()
    jobs = {k: (yahoo_weekly, sym) for k, sym in INDICES.items()}
    jobs.update({"krw": (fred_csv, "DEXKOUS", start), "us10": (fred_csv, "DGS10", start)})
    jobs.update({k: (multpl_monthly, slug) for k, slug in MULTPL.items()})
    names = list(jobs)
    res = await asyncio.gather(*(timed(*jobs[n]) for n in names))
    return {n: r[0] for n, r in zip(names, res)}, {n: r[1] for n, r in zip(names, res)}


def _context(key: str):
    return lambda g: (f"{ASSET_NAME[key]} {g['from']:,.0f}→{g['to']:,.0f} ({g['chg_pct']:+.1f}%), "
                      f"기간 {g['start']}~{g['end'] or '현재'} ({g['weeks']}주)")


NEWS_QUERY = {"kospi": "코스피 증시", "spx": "S&P500 뉴욕증시", "ndx": "나스닥 증시"}
_bg_tasks: set = set()


async def _build() -> dict | None:
    t0 = time.perf_counter()
    raw, timings = await _collect_raw()
    sources = {k: len(v) for k, v in raw.items()}
    if not any(raw.get(k) for k in INDICES):
        logger.warning(f"stocks overview: 지수 수집 실패 {sources}")
        return None
    today = date.today()
    data = build_overview(raw, today)
    # 이정표 문구: DB 캐시는 바로 적용, AI 생성은 백그라운드(같은 dict를 갱신하므로 캐시 응답에 곧 반영)
    for k, segs in data["regimes"].items():
        await enrich_texts(k, segs, _context(k), NEWS_QUERY[k], today, ai=False)

    async def _ai_fill():
        for k, segs in data["regimes"].items():
            await enrich_texts(k, segs, _context(k), NEWS_QUERY[k], today, budget=4)
    task = asyncio.create_task(_ai_fill())
    _bg_tasks.add(task)
    task.add_done_callback(_bg_tasks.discard)
    data["sources"] = sources
    data["timings"] = {**timings, "total": round(time.perf_counter() - t0, 2)}
    return data if data["weekly"] else None


overview_cache = OverviewCache("stocks", CACHE_TTL, _build)


@router.get("/overview")
async def stocks_overview(refresh: bool = Query(False)):
    data = await overview_cache.get(force=refresh)
    if data is None:
        raise HTTPException(status_code=503, detail="주식 원천 데이터 수집 실패 — 잠시 후 다시 시도해 주세요.")
    return data
