# 시장동향 > 금리 탭용 한·미 기준금리·국채금리·장단기 금리차·시장 내재 기대·기준금리 국면 타임라인 API
"""
GET /api/v1/rates/overview  (?refresh=true 로 캐시 무시)

- 원천: 한국은행 ECOS(인증키 ECOS_API_KEY) + FRED fredgraph CSV(키 불필요).
- 접속 시점 현행화: 서버 캐시 10분, 실패 시 마지막 성공값 유지. 계산(build_overview)은 네트워크와 분리해 테스트한다.
- 지표 정의는 docs/rates-tab-context-notes.md.
"""
import asyncio
import logging
import os
import time
from datetime import date, datetime, timedelta, timezone

import pandas as pd
import requests
from fastapi import APIRouter, HTTPException, Query

from core.overview_cache import OverviewCache, fred_csv, timed
from core.regime_auto import attach_text, enrich_texts, rate_cycles, template_text

logger = logging.getLogger(__name__)
router = APIRouter()

YEARS = 20
CACHE_TTL = 10 * 60
HIKE_STEP = 0.25
_KST = timezone(timedelta(hours=9))

FRED_IDS = {
    "fed_upper": "DFEDTARU",   # 연방기금 목표 상단 (2008-12~)
    "fed_target": "DFEDTAR",   # 단일 목표 (~2008-12)
    "fed_eff": "DFF",          # 실효 연방기금금리
    "us3m": "DGS3MO", "us1y": "DGS1", "us2y": "DGS2", "us5y": "DGS5", "us10y": "DGS10", "us30y": "DGS30",
    "us_10_2": "T10Y2Y", "us_10_3m": "T10Y3M",
    "usrec": "USREC",          # 미국 경기침체 구간(NBER, 월간 0/1)
    "ecb": "ECBDFR",           # ECB 예금금리
    "us_cpi": "CPIAUCSL",
}
# 역전 이력은 1970년대부터 봐야 해서 길게 받는다
LONG_FRED = {"us_10_3m", "us_10_2", "usrec"}
LONG_YEARS = 50

ECOS_SERIES = {  # key: (통계표, 주기, 항목)
    "kr_base": ("722Y001", "D", "0101000"),
    "kr1y": ("817Y002", "D", "010190000"),
    "kr3y": ("817Y002", "D", "010200000"),
    "kr5y": ("817Y002", "D", "010200001"),
    "kr10y": ("817Y002", "D", "010210000"),
    "kr20y": ("817Y002", "D", "010220000"),
    "kr30y": ("817Y002", "D", "010230000"),
    "kr50y": ("817Y002", "D", "010240000"),  # 2016-10~
    "kr_cpi": ("901Y009", "M", "0"),
}

# 남은 회의 일정(현지 기준 결정일) — 연 1회 갱신
BOK_MEETINGS = ["2026-10-22", "2026-11-26"]
FOMC_MEETINGS = ["2026-10-28", "2026-12-09"]

# 한국 기준금리 국면 문구 — 구간 경계는 rate_cycles가 변경 이력으로 자동 계산하고, 시작일·종류가 같은 구간에 이 제목·배경을 붙인다.
# 새 사이클은 자동 감지되어 AI 문구(없으면 기본 문구)로 표시된다. end는 참고용(자동 경계가 우선).
REGIMES = [
    {"start": "2008-10-09", "end": "2009-02-12", "kind": "cut", "title": "글로벌 금융위기 급속 인하",
     "drivers": ["리먼 파산 이후 신용경색", "5개월 새 3.25%p 인하", "한미 통화스와프(2008.10)"]},
    {"start": "2009-02-12", "end": "2010-07-09", "kind": "hold", "title": "위기 대응 초저금리 유지",
     "drivers": ["2.00% 유지로 경기 회복 지원"]},
    {"start": "2010-07-09", "end": "2011-06-10", "kind": "hike", "title": "위기 후 정상화",
     "drivers": ["경기 회복과 물가 상승", "1년간 1.25%p 인상"]},
    {"start": "2011-06-10", "end": "2012-07-12", "kind": "hold", "title": "유럽 재정위기 경계",
     "drivers": ["대외 불확실성으로 3.25% 유지"]},
    {"start": "2012-07-12", "end": "2016-06-09", "kind": "cut", "title": "저성장·저물가 장기 인하",
     "drivers": ["수출 부진·엔저", "세월호(2014)·메르스(2015) 내수 충격", "사상 최저 1.25%까지 인하"]},
    {"start": "2016-06-09", "end": "2017-11-30", "kind": "hold", "title": "사상 최저 금리 유지",
     "drivers": ["1.25% 유지", "가계부채 급증"]},
    {"start": "2017-11-30", "end": "2018-11-30", "kind": "hike", "title": "연준 추종 인상",
     "drivers": ["연준 인상으로 한미 금리 역전", "가계부채 누증 대응"]},
    {"start": "2018-11-30", "end": "2019-07-18", "kind": "hold", "title": "인상 후 관망",
     "drivers": ["경기 둔화 신호 점검"]},
    {"start": "2019-07-18", "end": "2020-05-28", "kind": "cut", "title": "무역분쟁·코로나 인하",
     "drivers": ["미중 무역분쟁·반도체 부진", "코로나19 빅컷(2020.3, 0.50%p)", "사상 최저 0.50%"]},
    {"start": "2020-05-28", "end": "2021-08-26", "kind": "hold", "title": "제로금리 유동성",
     "drivers": ["0.50% 유지", "자산가격 급등"]},
    {"start": "2021-08-26", "end": "2023-01-13", "kind": "hike", "title": "인플레이션 긴축",
     "drivers": ["40년 만의 글로벌 인플레이션", "연준 급격 인상", "빅스텝(2022.7·10)으로 1.5년간 3.00%p 인상"]},
    {"start": "2023-01-13", "end": "2024-10-11", "kind": "hold", "title": "고금리 장기 유지",
     "drivers": ["3.50% 유지", "물가 둔화 확인까지 대기"]},
    {"start": "2024-10-11", "end": "2025-05-29", "kind": "cut", "title": "경기 방어 인하",
     "drivers": ["내수 부진", "8개월간 1.00%p 인하"]},
    {"start": "2025-05-29", "end": "2026-07-16", "kind": "hold", "title": "집값·가계부채 경계",
     "drivers": ["2.50% 유지", "수도권 주택가격·가계부채 경계"]},
    {"start": "2026-07-16", "end": None, "kind": "hike", "title": "인상 재개",
     "drivers": ["물가 3% 안팎, 근원물가 오름세", "중동 리스크 비용 전이", "수도권 주택·가계부채 위험"],
     "source": "한국은행 2026년 9월 통화신용정책보고서(연합뉴스)"},
]

# ── 공통 유틸 ────────────────────────────────────────────────────────────────
def _empty() -> pd.Series:
    """빈 시계열도 날짜 인덱스를 갖게 해 날짜 비교가 깨지지 않게 한다."""
    return pd.Series(dtype=float, index=pd.DatetimeIndex([]))


def _series(d: dict[str, float]) -> pd.Series:
    if not d:
        return _empty()
    s = pd.Series(d, dtype=float)
    s.index = pd.to_datetime(s.index)
    return s.sort_index()


def _r(v, n=2):
    return None if v is None or pd.isna(v) else round(float(v), n)


def _at(s: pd.Series, when: pd.Timestamp):
    """when 이전(포함) 마지막 관측값."""
    past = s[s.index <= when]
    return None if past.empty else float(past.iloc[-1])


def _bp_change(s: pd.Series, days: int) -> float | None:
    if len(s) < 2:
        return None
    prev = _at(s, s.index[-1] - timedelta(days=days))
    return None if prev is None else round((float(s.iloc[-1]) - prev) * 100, 1)


def _pct_rank(s: pd.Series, value: float) -> int | None:
    return None if s.empty else int(round((s <= value).mean() * 100))


def _yoy(index: pd.Series) -> pd.Series:
    """월간 지수 → 전년동월비(%). 행 12개 전이 아니라 날짜로 1년 전 같은 달과 비교한다
    (미국 CPI는 2025-10 셧다운으로 한 달이 비어 행 기준이면 엉뚱한 달과 비교된다)."""
    if index.empty:
        return index
    prev = index.copy()
    prev.index = prev.index + pd.DateOffset(years=1)
    return ((index / prev.reindex(index.index) - 1) * 100).dropna()


def _weekly(s: pd.Series) -> pd.Series:
    return s.resample("W-FRI").last() if not s.empty else _empty()


def _last_change(s: pd.Series) -> dict | None:
    """계단형 정책금리의 마지막 변경(날짜·이전·이후·bp)."""
    if len(s) < 2:
        return None
    diff = s.diff()
    changed = diff[diff.abs() > 1e-9]
    if changed.empty:
        return None
    d = changed.index[-1]
    after = float(s.loc[d])
    before = after - float(changed.iloc[-1])
    return {"date": d.strftime("%Y-%m-%d"), "from": _r(before), "to": _r(after), "bp": _r((after - before) * 100, 0)}


def _next_meeting(dates: list[str], today: date) -> dict | None:
    for d in dates:
        dd = date.fromisoformat(d)
        if dd >= today:
            return {"date": d, "d_day": (dd - today).days}
    return None


def _implied(one_year: float | None, policy: float | None) -> dict | None:
    """1년물 − 정책금리 → 1년 내 반영된 인상(+)/인하(−) 횟수(0.25%p 기준, 근사)."""
    if one_year is None or policy is None:
        return None
    gap = one_year - policy
    n = gap / HIKE_STEP
    if gap >= HIKE_STEP / 2:
        label = f"1년 내 인상 약 {n:.1f}회 반영"
    elif gap <= -HIKE_STEP / 2:
        label = f"1년 내 인하 약 {abs(n):.1f}회 반영"
    else:
        label = "동결 예상"
    return {"gap": _r(gap), "moves": _r(n, 1), "label": label}


def curve_shape(short: pd.Series, long: pd.Series, days: int = 30) -> dict | None:
    """최근 days일 단기·장기 금리 변화로 수익률곡선 형태 판정."""
    ds, dl = _bp_change(short, days), _bp_change(long, days)
    if ds is None or dl is None:
        return None
    slope = dl - ds
    level_up = (ds + dl) / 2 > 0
    if abs(slope) <= 5:
        name, meaning = "기울기 유지", "단기·장기 금리가 비슷하게 움직였습니다."
    elif slope > 0:
        name, meaning = ("베어 스티프닝", "장기금리가 더 많이 올랐습니다 — 물가·재정 우려나 기간 프리미엄 상승 신호입니다.") if level_up \
            else ("불 스티프닝", "단기금리가 더 많이 내렸습니다 — 금리 인하 기대가 커질 때 나타납니다.")
    else:
        name, meaning = ("베어 플래트닝", "단기금리가 더 많이 올랐습니다 — 정책금리 인상 기대가 반영될 때 나타납니다.") if level_up \
            else ("불 플래트닝", "장기금리가 더 많이 내렸습니다 — 경기 둔화 우려가 커질 때 나타납니다.")
    return {"name": name, "meaning": meaning, "short_bp": ds, "long_bp": dl, "slope_bp": _r(slope, 1), "days": days}


def recession_periods(usrec: pd.Series) -> list[dict]:
    """USREC(월간 0/1) → 침체 구간 목록. 데이터 첫 달부터 이어진 침체는 시작일을 알 수 없어 뺀다."""
    out, start = [], None
    truncated = not usrec.empty and usrec.iloc[0] >= 0.5
    for d, v in usrec.items():
        if v >= 0.5 and start is None:
            start = d
        elif v < 0.5 and start is not None:
            if not (truncated and start == usrec.index[0]):
                out.append({"start": start.strftime("%Y-%m-%d"), "end": d.strftime("%Y-%m-%d")})
            start = None
    if start is not None:
        out.append({"start": start.strftime("%Y-%m-%d"), "end": None})
    return out


def inversion_episodes(spread: pd.Series, recessions: list[dict], today: date | None = None, merge_days: int = 120,
                       min_obs: int = 20, lead_months: int = 36) -> list[dict]:
    """금리차 < 0 구간(merge_days 이내 끊김은 이어 붙임). 침체는 그 직전 역전 구간에만 연결한다
    (1998년처럼 짧은 역전이 2000년 역전의 침체를 가져가지 않게). status: recession·no_recession·watching."""
    neg = spread[spread < 0]
    if neg.empty:
        return []
    groups, cur = [], [neg.index[0]]
    for d in neg.index[1:]:
        if (d - cur[-1]).days <= merge_days:
            cur.append(d)
        else:
            groups.append(cur)
            cur = [d]
    groups.append(cur)
    groups = [g for g in groups if len(g) >= min_obs]
    rec_starts = [pd.Timestamp(r["start"]) for r in recessions]
    now = pd.Timestamp(today) if today else spread.index[-1]
    episodes = []
    for i, g in enumerate(groups):
        s, e = g[0], g[-1]
        nxt_ep = groups[i + 1][0] if i + 1 < len(groups) else None
        rec = next((r for r in rec_starts if s <= r <= s + pd.DateOffset(months=lead_months)
                    and (nxt_ep is None or r < nxt_ep)), None)
        if rec is not None:
            status = "recession"
        elif now > s + pd.DateOffset(months=lead_months) or nxt_ep is not None:
            status = "no_recession"
        else:
            status = "watching"
        episodes.append({
            "start": s.strftime("%Y-%m-%d"), "end": e.strftime("%Y-%m-%d"),
            "min": _r(spread[(spread.index >= s) & (spread.index <= e)].min()),
            "recession": rec.strftime("%Y-%m-%d") if rec is not None else None,
            "lead_months": int(round((rec - s).days / 30.44)) if rec is not None else None,
            "status": status,
        })
    return episodes


def _curve(points: list[tuple[str, pd.Series]], when: pd.Timestamp) -> list[dict]:
    return [{"tenor": t, "value": _r(_at(s, when))} for t, s in points if not s.empty]


TERM_BUCKETS = [  # (키, 이름, 한국, 미국) — 단기는 양국 모두 국채 1년물로 같은 상품끼리 비교
    ("short", "단기 (1년)", "kr1y", "us1y"),
    ("long", "장기 (10년)", "kr10y", "us10y"),
    ("ultra", "초장기 (30년)", "kr30y", "us30y"),
]
TENOR = {"short": "1년물", "long": "10년물", "ultra": "30년물"}  # 해석 문장용 (모두 받침 있어 조사 '이')


def term_compare(g) -> dict | None:
    """단기·장기·초장기 한·미 비교 + 초장기 프리미엄(30년−10년) + 자동 해석 문장."""
    rows = []
    for key, label, k, u in TERM_BUCKETS:
        ks, us_ = g(k), g(u)
        if ks.empty or us_.empty:
            continue
        kv, uv = float(ks.iloc[-1]), float(us_.iloc[-1])
        k1, u1 = _at(ks, ks.index[-1] - timedelta(days=365)), _at(us_, us_.index[-1] - timedelta(days=365))
        rows.append({"key": key, "label": label, "kr": _r(kv), "us": _r(uv), "gap": _r(kv - uv),
                     "gap_1y": _r(k1 - u1) if k1 is not None and u1 is not None else None,
                     "kr_chg_1y": _bp_change(ks, 365), "us_chg_1y": _bp_change(us_, 365)})
    if not rows:
        return None
    by = {r["key"]: r for r in rows}
    premium = {}
    for c in ("kr", "us"):
        if "ultra" in by and "long" in by:
            l, u = g(f"{c}10y"), g(f"{c}30y")
            now = by["ultra"][c] - by["long"][c]
            y1l, y1u = _at(l, l.index[-1] - timedelta(days=365)), _at(u, u.index[-1] - timedelta(days=365))
            premium[c] = {"now": _r(now), "y1": _r(y1u - y1l) if y1l is not None and y1u is not None else None}

    insights = []
    gaps = [r["gap"] for r in rows]
    if all(x < 0 for x in gaps):
        widening = all(b <= a for a, b in zip(gaps, gaps[1:]))
        insights.append(f"모든 만기에서 미국 금리가 더 높습니다({TENOR[rows[0]['key']]} {gaps[0]:+.2f}%p → {TENOR[rows[-1]['key']]} {gaps[-1]:+.2f}%p)"
                        + (" — 만기가 길수록 격차가 커져 장기 자금이 미국으로 향하기 쉬운 구조입니다." if widening else "."))
    elif all(x > 0 for x in gaps):
        insights.append("모든 만기에서 한국 금리가 더 높습니다 — 원화 자산의 금리 매력이 큰 구간입니다.")
    else:
        insights.append("만기에 따라 한·미 금리 우위가 엇갈립니다(" + ", ".join(f"{TENOR[r['key']]} {r['gap']:+.2f}%p" for r in rows) + ").")
    names = {"kr": "한국", "us": "미국"}
    for c, pr in premium.items():
        v = pr["now"]
        if v >= 0.3:
            msg = f"{names[c]} 초장기 프리미엄(30년−10년) {v:+.2f}%p — 재정·인플레 우려로 30년물에 더 높은 보상을 요구하고 있습니다."
        elif v < 0:
            msg = f"{names[c]} 초장기 역전(30년−10년 {v:+.2f}%p) — 연기금·보험사의 초장기채 수요나 장기 저성장 기대가 초장기 금리를 누르고 있습니다."
        else:
            msg = f"{names[c]} 30년−10년 {v:+.2f}%p로 평탄 — 초장기 금리가 장기 금리와 비슷하게 움직입니다."
        if pr["y1"] is not None and abs(v - pr["y1"]) >= 0.1:
            msg += f" (1년 전 {pr['y1']:+.2f}%p에서 {'확대' if v > pr['y1'] else '축소'})"
        insights.append(msg)
    for c in ("kr", "us"):
        moves = [(r[f"{c}_chg_1y"], r["key"]) for r in rows if r[f"{c}_chg_1y"] is not None]
        if not moves:
            continue
        up = sum(m for m, _ in moves) > 0
        lead = max(moves, key=lambda x: x[0] if up else -x[0])
        why = {"short": "정책금리 기대가 이끈", "long": "성장·물가 기대가 이끈", "ultra": "기간 프리미엄이 이끈"}[lead[1]]
        insights.append(f"{names[c]} 최근 1년 금리는 {TENOR[lead[1]]}이 가장 크게 {'올라' if up else '내려'}({lead[0]:+.0f}bp) {why} "
                        f"{'상승' if up else '하락'}입니다.")
    if "long" in by and by["long"]["gap_1y"] is not None:
        a, b = by["long"]["gap_1y"], by["long"]["gap"]
        if abs(b - a) >= 0.15:
            insights.append(f"한미 10년물 격차가 1년 전 {a:+.2f}%p에서 {b:+.2f}%p로 {'벌어져 원화 약세 압력이 커졌' if abs(b) > abs(a) else '좁혀져 원화 약세 압력이 줄었'}습니다(환율 탭 참고).")
    kr50 = g("kr50y")
    return {"rows": rows, "premium": premium, "insights": insights,
            "kr50y": {"value": _r(kr50.iloc[-1]), "date": kr50.index[-1].strftime("%Y-%m-%d")} if not kr50.empty else None}


def _rate_card(s: pd.Series, ten_years_ago: pd.Timestamp) -> dict | None:
    if s.empty:
        return None
    s10 = s[s.index >= ten_years_ago]
    return {"value": _r(s.iloc[-1], 3), "date": s.index[-1].strftime("%Y-%m-%d"),
            "chg_1w": _bp_change(s, 7), "chg_1m": _bp_change(s, 30), "chg_1y": _bp_change(s, 365),
            "pct10y": _pct_rank(s10, s.iloc[-1])}


# ── 계산 ────────────────────────────────────────────────────────────────────
def build_overview(raw: dict[str, dict[str, float]], today: date) -> dict:
    S = {k: _series(v) for k, v in raw.items()}
    g = lambda k: S.get(k, _empty())  # noqa: E731
    # 미 정책금리 상단: 2008-12 이전은 단일 목표로 잇는다
    fed = pd.concat([g("fed_target")[g("fed_target").index < g("fed_upper").index.min()] if not g("fed_upper").empty
                     else g("fed_target"), g("fed_upper")]).sort_index()
    kr_cpi_yoy, us_cpi_yoy = _yoy(g("kr_cpi")), _yoy(g("us_cpi"))
    kr_10_3 = (g("kr10y") - g("kr3y")).dropna()

    start = pd.Timestamp(today) - pd.DateOffset(years=YEARS)
    ten_years_ago = pd.Timestamp(today) - pd.DateOffset(years=10)

    # 스냅샷
    snap: dict = {}
    if not g("kr_base").empty:
        snap["kr_base"] = {"value": _r(g("kr_base").iloc[-1]), "date": g("kr_base").index[-1].strftime("%Y-%m-%d"),
                           "last_change": _last_change(g("kr_base")), "next_meeting": _next_meeting(BOK_MEETINGS, today)}
    if not fed.empty:
        snap["us_policy"] = {"upper": _r(fed.iloc[-1]), "lower": _r(fed.iloc[-1] - HIKE_STEP),
                             "effective": _r(g("fed_eff").iloc[-1]) if not g("fed_eff").empty else None,
                             "date": fed.index[-1].strftime("%Y-%m-%d"),
                             "last_change": _last_change(fed), "next_meeting": _next_meeting(FOMC_MEETINGS, today)}
    if "kr_base" in snap and "us_policy" in snap:
        snap["policy_gap"] = _r(snap["kr_base"]["value"] - snap["us_policy"]["upper"])
    for key in ("kr3y", "kr10y", "us2y", "us10y"):
        card = _rate_card(g(key), ten_years_ago)
        if card:
            snap[key] = card
    snap["implied"] = {
        "kr": _implied(float(g("kr1y").iloc[-1]) if not g("kr1y").empty else None,
                       snap.get("kr_base", {}).get("value")),
        "us": _implied(float(g("us1y").iloc[-1]) if not g("us1y").empty else None,
                       float(g("fed_eff").iloc[-1]) if not g("fed_eff").empty else None),
    }
    snap["real"] = {}
    if "kr_base" in snap and not kr_cpi_yoy.empty:
        snap["real"]["kr"] = {"value": _r(snap["kr_base"]["value"] - kr_cpi_yoy.iloc[-1]),
                              "cpi": _r(kr_cpi_yoy.iloc[-1], 1), "cpi_month": kr_cpi_yoy.index[-1].strftime("%Y-%m")}
    if not g("fed_eff").empty and not us_cpi_yoy.empty:
        snap["real"]["us"] = {"value": _r(g("fed_eff").iloc[-1] - us_cpi_yoy.iloc[-1]),
                              "cpi": _r(us_cpi_yoy.iloc[-1], 1), "cpi_month": us_cpi_yoy.index[-1].strftime("%Y-%m")}

    # 국면 배지: 최근 1년 안의 변경 방향 + 시장 내재 기대
    def _phase(card: dict | None, implied: dict | None, name: str) -> str | None:
        if not card:
            return None
        lc = card.get("last_change")
        recent = lc is not None and (pd.Timestamp(today) - pd.Timestamp(lc["date"])).days <= 365
        stance = ("인상 국면" if lc["bp"] > 0 else "인하 국면") if recent else "동결 국면"
        return f"{name} {stance}" + (f" · 시장은 {implied['label']}" if implied else "")
    snap["phase"] = {"kr": _phase(snap.get("kr_base"), snap["implied"]["kr"], "한국"),
                     "us": _phase(snap.get("us_policy"), snap["implied"]["us"], "미국")}

    # 장단기 금리차
    recessions = recession_periods(g("usrec"))
    spreads = {}
    for key, s, label in (("kr_10_3", kr_10_3, "한국 10년−3년"), ("us_10_2", g("us_10_2"), "미국 10년−2년"),
                          ("us_10_3m", g("us_10_3m"), "미국 10년−3개월")):
        if s.empty:
            continue
        s20 = s[s.index >= start]
        spreads[key] = {"label": label, "value": _r(s.iloc[-1]), "date": s.index[-1].strftime("%Y-%m-%d"),
                        "inverted": bool(s.iloc[-1] < 0), "chg_1m": _bp_change(s, 30),
                        "pct20y": _pct_rank(s20, s.iloc[-1]),
                        "inversions": inversion_episodes(s, recessions, today)}
    shapes = {"kr": curve_shape(g("kr3y"), g("kr10y")), "us": curve_shape(g("us2y"), g("us10y"))}
    curve_pts = {
        "kr": [("1년", g("kr1y")), ("3년", g("kr3y")), ("5년", g("kr5y")), ("10년", g("kr10y")),
               ("20년", g("kr20y")), ("30년", g("kr30y"))],
        "us": [("3개월", g("us3m")), ("1년", g("us1y")), ("2년", g("us2y")), ("5년", g("us5y")),
               ("10년", g("us10y")), ("30년", g("us30y"))],
    }
    curves = {}
    for c, pts in curve_pts.items():
        anchor = max((s.index[-1] for _, s in pts if not s.empty), default=None)
        if anchor is None:
            continue
        curves[c] = {"date": anchor.strftime("%Y-%m-%d"),
                     "now": _curve(pts, anchor), "m1": _curve(pts, anchor - timedelta(days=30)),
                     "y1": _curve(pts, anchor - timedelta(days=365))}

    # 주간 차트 데이터
    cols = {"kr_base": g("kr_base"), "us_upper": fed, "ecb": g("ecb"), "kr3y": g("kr3y"), "kr10y": g("kr10y"),
            "us2y": g("us2y"), "us10y": g("us10y"), "kr_10_3": kr_10_3, "us_10_2": g("us_10_2"),
            "us_10_3m": g("us_10_3m"), "kr1y": g("kr1y"), "us1y": g("us1y"), "kr30y": g("kr30y"),
            "us30y": g("us30y"), "kr50y": g("kr50y")}
    wk = pd.DataFrame({k: _weekly(v) for k, v in cols.items()})
    wk = wk[wk.index >= start].ffill(limit=4)
    rows = [{"date": i.strftime("%Y-%m-%d"), **{k: _r(r[k], 3) for k in cols}} for i, r in wk.iterrows()]
    if rows:  # 진행 중인 주는 다가올 금요일 대신 오늘로 표시
        rows[-1]["date"] = min(rows[-1]["date"], today.isoformat())

    # 기준금리 국면
    regimes = []
    kb = g("kr_base")
    changes = kb.diff()
    changes = changes[changes.abs() > 1e-9]
    for r in (attach_text(rate_cycles(kb, today), REGIMES) if not kb.empty else []):
        st, en = pd.Timestamp(r["start"]), pd.Timestamp(r["end"] or today.isoformat())
        if r["kind"] == "hold":  # 동결: 시작일 변경은 앞 구간, 종료일 변경은 다음 구간 몫
            v0, v1 = _at(kb, st), _at(kb, en - timedelta(days=1))
            n = int(((changes.index > st) & (changes.index < en)).sum())
        else:                    # 인상·인하: 시작일 변경부터 종료일 변경까지 포함
            v0, v1 = _at(kb, st - timedelta(days=1)), _at(kb, en)
            n = int(((changes.index >= st) & (changes.index <= en)).sum())
        if v0 is None or v1 is None:
            continue
        reg = {"start": r["start"], "end": r["end"], "kind": r["kind"], "auto": r["auto"],
               "from": _r(v0), "to": _r(v1), "bp": _r((v1 - v0) * 100, 0), "changes": n}
        reg.update(template_text("rates", reg) if r["auto"] else
                   {"title": r["title"], "drivers": r["drivers"], "source": r.get("source")})
        regimes.append(reg)

    return {"snapshot": snap, "spreads": spreads, "shapes": shapes, "curves": curves, "terms": term_compare(g),
            "recessions": [r for r in recessions if (r["end"] or "9999") >= start.strftime("%Y-%m-%d")],
            "weekly": rows, "regimes": regimes,
            "data_dates": {k: s.index[-1].strftime("%Y-%m-%d") for k, s in S.items() if not s.empty},
            "updated_at": datetime.now(timezone.utc).isoformat(timespec="seconds")}


# ── 수집 ────────────────────────────────────────────────────────────────────
def _fetch_ecos(stat: str, cycle: str, item: str, years: int = YEARS + 2) -> dict[str, float]:
    key = os.environ.get("ECOS_API_KEY")
    if not key:
        return {}
    end = datetime.now(_KST)
    begin = end - timedelta(days=365 * years)
    fmt = "%Y%m%d" if cycle == "D" else "%Y%m"
    url = (f"https://ecos.bok.or.kr/api/StatisticSearch/{key}/json/kr/1/100000/{stat}/{cycle}/"
           f"{begin.strftime(fmt)}/{end.strftime(fmt)}/{item}")
    try:
        rows = requests.get(url, timeout=20).json().get("StatisticSearch", {}).get("row", [])
        out = {}
        for r in rows:
            t, v = r.get("TIME", ""), r.get("DATA_VALUE")
            if not v:
                continue
            d = f"{t[:4]}-{t[4:6]}-{t[6:8]}" if cycle == "D" else f"{t[:4]}-{t[4:6]}-01"
            out[d] = float(v)
        return out
    except Exception as e:  # 키가 들어 있는 URL은 로그에 남기지 않는다
        logger.warning(f"ECOS {stat}/{item} failed: {type(e).__name__}")
        return {}


async def _collect_raw() -> tuple[dict[str, dict[str, float]], dict[str, float]]:
    """FRED·ECOS 전부를 전용 I/O 풀에서 동시에 받는다. 반환: (raw, 시리즈별 걸린 초)."""
    today = date.today()
    start = (today - timedelta(days=365 * (YEARS + 2))).isoformat()
    start_long = (today - timedelta(days=365 * LONG_YEARS)).isoformat()
    jobs = {k: (fred_csv, FRED_IDS[k], start_long if k in LONG_FRED else start) for k in FRED_IDS}
    jobs.update({k: (_fetch_ecos, *ECOS_SERIES[k]) for k in ECOS_SERIES})
    names = list(jobs)
    res = await asyncio.gather(*(timed(*jobs[n]) for n in names))
    return {n: r[0] for n, r in zip(names, res)}, {n: r[1] for n, r in zip(names, res)}


async def _build() -> dict | None:
    t0 = time.perf_counter()
    raw, timings = await _collect_raw()
    sources = {k: len(v) for k, v in raw.items()}  # 0이면 그 원천이 실패(ECOS 키 누락 포함)
    if not raw.get("kr_base") and not raw.get("us10y"):
        logger.warning(f"rates overview: 수집 실패 {sources}")
        return None
    today = datetime.now(_KST).date()
    data = build_overview(raw, today)
    snap = data["snapshot"]
    cpi = snap.get("real", {}).get("kr", {}).get("cpi")
    us = snap.get("us_policy", {}).get("upper")
    await enrich_texts("rates", data["regimes"], lambda g: (
        f"기준금리 {g['from']:.2f}→{g['to']:.2f}% ({g['bp']:+.0f}bp, 변경 {g['changes']}회)"
        + (f", 최신 소비자물가 {cpi}%" if cpi is not None else "") + (f", 미국 정책금리 상단 {us}%" if us is not None else "")),
        "한국은행 기준금리", today)
    data["sources"] = sources
    data["timings"] = {**timings, "total": round(time.perf_counter() - t0, 2)}
    data["ecos_key"] = bool(os.environ.get("ECOS_API_KEY"))
    return data if data["weekly"] else None


overview_cache = OverviewCache("rates", CACHE_TTL, _build)


@router.get("/overview")
async def rates_overview(refresh: bool = Query(False)):
    data = await overview_cache.get(force=refresh)
    if data is None:
        raise HTTPException(status_code=503, detail="금리 원천 데이터 수집 실패 — 잠시 후 다시 시도해 주세요.")
    return data
