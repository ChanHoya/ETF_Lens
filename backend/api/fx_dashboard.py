# 시장동향 > 환율 탭용 원/달러·달러지수·금리차·실질실효환율 시계열과 스냅샷·국면 타임라인을 제공하는 API
"""
GET /api/v1/fx/overview  (?refresh=true 로 캐시 무시)

- 원천: FRED fredgraph CSV(키 불필요) + Yahoo v8 chart. 수집은 6시간 메모리 캐시, 실패 시 마지막 성공값 유지.
- 계산(build_overview)은 네트워크와 분리해 테스트한다.
"""
import asyncio
import logging
import time
from datetime import date, datetime, timedelta, timezone

import pandas as pd
import requests
from fastapi import APIRouter, Query

from api.exit_signal import _fetch_fred_series, _fetch_yahoo_v8

logger = logging.getLogger(__name__)
router = APIRouter()

YEARS = 20
CACHE_TTL = 6 * 3600
FRED_IDS = {
    "krw": "DEXKOUS",           # 원/달러 (뉴욕 정오, 일간)
    "us10": "DGS10",            # 미 10년물
    "kr10": "IRLTLT01KRM156N",  # 한 10년물 (월간, OECD)
    "reer": "RBKRBIS",          # 원화 실질실효환율 (월간, BIS)
    "jpy": "DEXJPUS",           # 엔/달러 — 원/엔 교차 계산용
    "cny": "DEXCHUS",           # 위안/달러 — 원/위안 교차 계산용
    "dff": "DFF",               # 미 실효연방기금금리
    "kr3m": "IR3TIB01KRM156N",  # 한 3개월 금리 (월간) — 헤지 비용 근사
}

# 원/달러 국면 — 날짜는 DEXKOUS 고점·저점일, 구간 값은 데이터에서 계산한다.
# kind="range"는 추세가 아닌 박스권.
REGIMES = [
    {"start": "2007-10-31", "end": "2009-03-02", "title": "글로벌 금융위기",
     "drivers": ["서브프라임 부실·리먼브라더스 파산(2008.9)", "외화 유동성 경색과 외국인 자금 이탈",
                 "한미 통화스와프 300억달러 체결(2008.10)로 진정 시작"]},
    {"start": "2009-03-02", "end": "2011-07-26", "title": "위기 후 회복",
     "drivers": ["연준 양적완화(QE1·QE2)로 달러 약세", "위험자산 회복과 신흥국 자금 유입", "경상수지 흑자 확대"]},
    {"start": "2011-07-26", "end": "2011-10-04", "title": "유럽 재정위기",
     "drivers": ["그리스·이탈리아 등 유럽 재정위기 확산", "S&P 미국 신용등급 강등(2011.8)", "안전자산 선호 급증"]},
    {"start": "2013-06-24", "end": "2014-07-03", "title": "경상흑자 원화 강세",
     "drivers": ["테이퍼 탠트럼(2013.5~6) 충격에도 신흥국 중 차별화", "사상 최대 경상수지 흑자"]},
    {"start": "2014-07-03", "end": "2016-02-26", "title": "1차 킹달러",
     "drivers": ["미 양적완화 종료(2014.10)·금리 인상 개시(2015.12)", "위안화 기습 절하(2015.8)",
                 "유가 급락과 신흥국 자금 이탈"]},
    {"start": "2016-02-26", "end": "2018-04-03", "title": "글로벌 동반 성장",
     "drivers": ["세계 경기 동반 회복과 약달러", "반도체 슈퍼사이클로 수출 호조"]},
    {"start": "2018-04-03", "end": "2020-03-23", "title": "무역분쟁·코로나",
     "drivers": ["미중 무역분쟁·관세 전쟁", "반도체 다운사이클(2019)",
                 "코로나19 팬데믹 충격, 한미 통화스와프 600억달러(2020.3)"]},
    {"start": "2020-03-23", "end": "2021-01-04", "title": "유동성 랠리",
     "drivers": ["연준 제로금리·무제한 양적완화", "달러 약세, 수출·증시 회복"]},
    {"start": "2021-06-01", "end": "2022-09-28", "title": "2차 킹달러",
     "drivers": ["40년 만의 미국 인플레이션", "연준 자이언트 스텝(0.75%p) 연속 인상",
                 "한미 기준금리 역전(2022.7), 에너지 가격 급등에 무역적자"]},
    {"start": "2022-09-28", "end": "2024-09-27", "title": "고금리 박스권", "kind": "range",
     "drivers": ["연준 금리 정점, SVB 사태(2023.3)", "한미 기준금리 역전 폭 최대 2.0%p(2023)",
                 "거주자 해외투자 확대로 원화 구조적 약세 논의"]},
    {"start": "2024-09-27", "end": "2025-04-09", "title": "정치·관세 충격",
     "drivers": ["미 대선 후 강달러(트럼프 트레이드)", "12·3 비상계엄과 탄핵 정국", "미국 상호관세 발표(2025.4)"]},
    {"start": "2025-04-09", "end": "2025-06-30", "title": "관세 유예·약달러",
     "drivers": ["상호관세 90일 유예", "달러인덱스 상반기 약 10% 하락", "6·3 대선으로 정치 불확실성 해소"]},
    {"start": "2025-06-30", "end": "2026-06-05", "title": "원화 고유 약세·외국인 이탈",
     "drivers": ["거주자 해외주식 투자 확대로 구조적 달러 수요", "외국인 사상 최대 국내주식 순매도·역송금(2026.6)",
                 "연준 인상 전망에 달러 강세, 약 40년 만의 엔저"],
     "source": "한국경제·머니투데이 2026-06-30"},
    {"start": "2026-06-05", "end": "2026-09-09", "title": "환전 수급·금리차 축소",
     "drivers": ["SK하이닉스 ADR 조달 265억달러 원화 환전", "한은 금리 인상으로 한미 금리차 축소",
                 "미 고용 부진·약달러, 미·일 엔화 공조 매입", "외국인 순매수 전환과 경상수지 흑자"],
     "source": "한국경제 2026-07-31 · 서울신문 2026-08-20"},
]

_cache: dict = {"data": None, "ts": 0.0}


def _series(d: dict[str, float]) -> pd.Series:
    if not d:
        return pd.Series(dtype=float)
    s = pd.Series(d, dtype=float)
    s.index = pd.to_datetime(s.index)
    return s.sort_index()


def _pct_rank(s: pd.Series, value: float) -> int | None:
    """value 이하 관측 비율(%) — 10년 중 현재 위치."""
    if s.empty:
        return None
    return int(round((s <= value).mean() * 100))


def _change(s: pd.Series, days: int) -> float | None:
    """마지막 값 대비 days일 전(그 이전 가장 가까운 관측) 변화율 %."""
    if len(s) < 2:
        return None
    past = s[s.index <= s.index[-1] - timedelta(days=days)]
    if past.empty or past.iloc[-1] == 0:
        return None
    return round(float(s.iloc[-1] / past.iloc[-1] - 1) * 100, 2)


def _r(v, n=2):
    return None if v is None or pd.isna(v) else round(float(v), n)


def _weekly(s: pd.Series) -> pd.Series:
    return s.resample("W-FRI").last() if not s.empty else pd.Series(dtype=float)


def _verdict(pct10y: int | None, reer_gap: float | None) -> dict:
    """참고용 판정 — 규칙은 docs/fx-tab-context-notes.md."""
    if pct10y is not None and pct10y >= 80 and reer_gap is not None and reer_gap <= -10:
        return {"level": "weak_krw", "label": "원화 저평가 — 달러 자산 신규 매수 신중"}
    if pct10y is not None and pct10y <= 20:
        return {"level": "strong_krw", "label": "원화 강세 — 달러 자산 분할 매수 유리"}
    return {"level": "neutral", "label": "중립 — 환율 방향성 관망"}


def build_overview(raw: dict[str, dict[str, float]], today: date) -> dict:
    """원천 시계열(raw) → 스냅샷·주간 차트 데이터·국면 타임라인."""
    fred_krw = _series(raw.get("krw", {}))
    live = _series(raw.get("krw_live", {}))
    krw = fred_krw
    if not live.empty:  # FRED 지연 구간(약 1주)을 Yahoo 일간으로 잇는다
        tail = live if fred_krw.empty else live[live.index > fred_krw.index[-1]]
        krw = pd.concat([fred_krw, tail])
    dxy = _series(raw.get("dxy", {}))
    us10, kr10 = _series(raw.get("us10", {})), _series(raw.get("kr10", {}))
    reer = _series(raw.get("reer", {}))
    jpy, cny = _series(raw.get("jpy", {})), _series(raw.get("cny", {}))
    dff, kr3m = _series(raw.get("dff", {})), _series(raw.get("kr3m", {}))

    start = pd.Timestamp(today) - pd.DateOffset(years=YEARS)
    ten_years_ago = pd.Timestamp(today) - pd.DateOffset(years=10)

    # 주간(금요일) 축 — 월간 지표는 앞채움
    wk = pd.DataFrame({"krw": _weekly(krw), "dxy": _weekly(dxy), "us10": _weekly(us10), "kr10": _weekly(kr10)})
    wk = wk[wk.index >= start]
    if not krw.empty:  # 진행 중인 주는 다가올 금요일이 아니라 마지막 관측일로 표시
        last = krw.index[-1]
        wk.index = wk.index.where(wk.index <= last, last)
    wk["kr10"] = wk["kr10"].ffill(limit=10)
    wk[["krw", "dxy", "us10"]] = wk[["krw", "dxy", "us10"]].ffill(limit=2)
    wk["spread10"] = wk["us10"] - wk["kr10"]
    rows = [
        {"date": idx.strftime("%Y-%m-%d"), "krw": _r(r.krw, 1), "dxy": _r(r.dxy), "us10": _r(r.us10),
         "kr10": _r(r.kr10), "spread10": _r(r.spread10)}
        for idx, r in wk.iterrows() if not pd.isna(r.krw)
    ]

    snapshot: dict = {}
    if not krw.empty:
        krw10 = krw[krw.index >= ten_years_ago]
        snapshot["krw"] = {
            "value": _r(krw.iloc[-1], 1), "date": krw.index[-1].strftime("%Y-%m-%d"),
            "chg_1w": _change(krw, 7), "chg_1m": _change(krw, 30), "chg_1y": _change(krw, 365),
            "pct10y": _pct_rank(krw10, krw.iloc[-1]),
            "min10y": _r(krw10.min(), 1), "max10y": _r(krw10.max(), 1),
        }
    if not dxy.empty:
        dxy10 = dxy[dxy.index >= ten_years_ago]
        snapshot["dxy"] = {
            "value": _r(dxy.iloc[-1]), "date": dxy.index[-1].strftime("%Y-%m-%d"),
            "chg_1m": _change(dxy, 30), "chg_1y": _change(dxy, 365), "pct10y": _pct_rank(dxy10, dxy.iloc[-1]),
        }
    for key, s, scale, label in (("jpy100", jpy, 100, "원/100엔"), ("cny", cny, 1, "원/위안")):
        cross = (fred_krw / s * scale).dropna() if not fred_krw.empty and not s.empty else pd.Series(dtype=float)
        if not cross.empty:
            snapshot[key] = {"label": label, "value": _r(cross.iloc[-1]), "date": cross.index[-1].strftime("%Y-%m-%d"),
                             "chg_1m": _change(cross, 30), "chg_1y": _change(cross, 365)}
    if not us10.empty and not kr10.empty:
        hist = wk["spread10"].dropna()
        ago = hist[hist.index <= hist.index[-1] - timedelta(days=365)] if not hist.empty else hist
        snapshot["spread10"] = {"value": _r(us10.iloc[-1] - kr10.iloc[-1]), "us10": _r(us10.iloc[-1]),
                                "kr10": _r(kr10.iloc[-1]), "kr10_date": kr10.index[-1].strftime("%Y-%m"),
                                "year_ago": _r(ago.iloc[-1]) if not ago.empty else None}
    if not dff.empty and not kr3m.empty:
        snapshot["hedge"] = {"value": _r(dff.iloc[-1] - kr3m.iloc[-1]), "us": _r(dff.iloc[-1]), "kr": _r(kr3m.iloc[-1]),
                             "kr_date": kr3m.index[-1].strftime("%Y-%m")}
    if not reer.empty:
        avg = reer[reer.index >= start].mean()
        snapshot["reer"] = {"value": _r(reer.iloc[-1], 1), "date": reer.index[-1].strftime("%Y-%m"),
                            "avg20y": _r(avg, 1), "gap_pct": _r((reer.iloc[-1] / avg - 1) * 100, 1)}
    snapshot["verdict"] = _verdict(snapshot.get("krw", {}).get("pct10y"), snapshot.get("reer", {}).get("gap_pct"))

    regimes = []
    for g in REGIMES:
        a, b = krw[krw.index <= g["start"]], krw[krw.index <= g["end"]]
        seg = krw[(krw.index >= g["start"]) & (krw.index <= g["end"])]
        if a.empty or b.empty or seg.empty:
            continue
        v0, v1 = a.iloc[-1], b.iloc[-1]
        regimes.append({
            "start": g["start"], "end": g["end"], "title": g["title"], "drivers": g["drivers"],
            "source": g.get("source"), "kind": g.get("kind") or ("up" if v1 > v0 else "down"),
            "from": _r(v0, 1), "to": _r(v1, 1), "chg_pct": _r((v1 / v0 - 1) * 100, 1),
            "low": _r(seg.min(), 1), "high": _r(seg.max(), 1),
        })

    return {"snapshot": snapshot, "weekly": rows, "regimes": regimes,
            "updated_at": datetime.now(timezone.utc).isoformat(timespec="seconds")}


def _yahoo_weekly(symbol: str, years: int = YEARS) -> dict[str, float]:
    """Yahoo v8 주간 종가 {YYYY-MM-DD: float} — 기존 _fetch_yahoo_v8은 최대 10년 일간이라 20년 주간은 따로 받는다."""
    try:
        url = f"https://query1.finance.yahoo.com/v8/finance/chart/{symbol}?range={years}y&interval=1wk"
        resp = requests.get(url, headers={"User-Agent": "Mozilla/5.0"}, timeout=15)
        if resp.status_code != 200:
            logger.warning(f"Yahoo weekly {symbol} status={resp.status_code}")
            return {}
        rb = resp.json()["chart"]["result"][0]
        closes = rb["indicators"]["quote"][0]["close"]
        return {datetime.fromtimestamp(ts, tz=timezone.utc).strftime("%Y-%m-%d"): float(c)
                for ts, c in zip(rb["timestamp"], closes) if isinstance(c, (int, float))}
    except Exception as e:
        logger.warning(f"Yahoo weekly {symbol} failed: {e}")
        return {}


async def _collect_raw() -> dict[str, dict[str, float]]:
    keys = list(FRED_IDS)
    results = await asyncio.gather(
        *(_fetch_fred_series(FRED_IDS[k], days=365 * (YEARS + 1)) for k in keys),
        asyncio.to_thread(_yahoo_weekly, "DX-Y.NYB"),
        _fetch_yahoo_v8("KRW=X", days=60),
    )
    raw = dict(zip(keys, results[:len(keys)]))
    raw["dxy"], raw["krw_live"] = results[len(keys)], results[len(keys) + 1]
    return raw


@router.get("/overview")
async def fx_overview(refresh: bool = Query(False)):
    now = time.time()
    if not refresh and _cache["data"] and now - _cache["ts"] < CACHE_TTL:
        return _cache["data"]
    raw = await _collect_raw()
    sources = {k: len(v) for k, v in raw.items()}  # 시리즈별 관측 수 — 0이면 그 원천이 실패한 것
    if not raw.get("krw") and _cache["data"]:
        logger.warning(f"FX overview: 원/달러 수집 실패, 마지막 성공값 반환 {sources}")
        return {**_cache["data"], "stale": True, "sources": sources}
    data = build_overview(raw, date.today())
    data["sources"] = sources
    if data["weekly"]:
        _cache.update(data=data, ts=now)
    return data
