# 시장동향 > 종합분석 탭용 API — 환율·금리·주식 탭 캐시를 결합해 국면 진단, 과거 유사 국면, 자산 연결 지도, 통합 타임라인, 시나리오, 자산배분 시사점
"""
GET /api/v1/macro/overview  (?refresh=true 로 세 탭 캐시까지 새로)
POST /api/v1/macro/events/refresh  (수동 '결과 업데이트' — 금리 원천·이벤트 AI 결과를 다시 확인, 1분 간격 제한)

- 새 원천을 모으지 않고 fx·rates·stocks의 OverviewCache를 읽는다(숫자가 세 탭과 같다).
- 계산(build_overview)은 세 탭 응답 dict를 받는 순수 함수로 두고 테스트한다. 규칙은 docs/macro-tab-context-notes.md.
"""
import asyncio
import json
import logging
import os
import time
from datetime import date, datetime, timedelta, timezone

import numpy as np
import pandas as pd
from fastapi import APIRouter, HTTPException, Query

from core.overview_cache import OverviewCache, run_io

logger = logging.getLogger(__name__)
router = APIRouter()

CACHE_TTL = 10 * 60
AI_TTL = 6 * 3600
LOOKBACK = 52            # 특징 계산 창(주)
EXCLUDE_RECENT = 104     # 최근 2년은 유사 국면 후보에서 제외
MIN_GAP = 26             # 유사 국면끼리 최소 간격(주)
FEATURES = {             # key: (설명, 단위)
    "us10_chg": ("미 10년물 1년 변화", "bp"), "krbase_chg": ("한국 기준금리 1년 변화", "bp"),
    "dxy_chg": ("달러지수 1년 변화", "%"), "krw_chg": ("원/달러 1년 변화", "%"),
    "spx_chg": ("S&P500 1년 변화", "%"), "kospi_chg": ("KOSPI 1년 변화", "%"),
    "curve": ("미 10년−2년 금리차", "%p"), "vix": ("VIX", ""),
}
CORR_ASSETS = {"kospi": "KOSPI", "spx": "S&P500", "ndx": "Nasdaq", "krw": "원/달러", "dxy": "달러지수",
               "us10y": "미 10년물", "kr10y": "한 10년물", "vix": "VIX"}


def _r(v, n=2):
    return None if v is None or pd.isna(v) else round(float(v), n)


def weekly_frame(fx: dict | None, rates: dict | None, stocks: dict | None) -> pd.DataFrame:
    """세 탭의 주간 표를 주 기간(금요일 끝)으로 맞춰 결합."""
    parts = []
    for src, cols in ((fx, ["krw", "dxy", "vix"]), (rates, ["kr_base", "us10y", "us_10_2", "kr10y"]),
                      (stocks, ["kospi", "spx", "ndx"])):
        rows = (src or {}).get("weekly") or []
        if not rows:
            continue
        df = pd.DataFrame(rows)
        df.index = pd.to_datetime(df["date"]).dt.to_period("W-FRI").dt.end_time.dt.normalize()
        df = df[[c for c in cols if c in df.columns]]
        parts.append(df[~df.index.duplicated(keep="last")])
    if not parts:
        return pd.DataFrame()
    return pd.concat(parts, axis=1).sort_index().ffill(limit=3)


def features(w: pd.DataFrame) -> pd.DataFrame:
    """각 주 기준 52주 변화·수준 특징."""
    f = pd.DataFrame(index=w.index)
    sh = w.shift(LOOKBACK)
    if "us10y" in w:
        f["us10_chg"] = (w["us10y"] - sh["us10y"]) * 100
    if "kr_base" in w:
        f["krbase_chg"] = (w["kr_base"] - sh["kr_base"]) * 100
    for k, c in (("dxy_chg", "dxy"), ("krw_chg", "krw"), ("spx_chg", "spx"), ("kospi_chg", "kospi")):
        if c in w:
            f[k] = (w[c] / sh[c] - 1) * 100
    if "us_10_2" in w:
        f["curve"] = w["us_10_2"]
    if "vix" in w:
        f["vix"] = w["vix"]
    return f


def _active(regimes: list[dict], when: pd.Timestamp) -> str | None:
    for g in regimes or []:
        end = pd.Timestamp(g["end"]) if g.get("end") else pd.Timestamp.max
        if pd.Timestamp(g["start"]) <= when <= end:
            return g.get("title")
    return None


def find_analogs(w: pd.DataFrame, f: pd.DataFrame, regimes: dict, top: int = 3) -> dict | None:
    """현재 특징과 가장 비슷한 과거 주(최근 2년 제외, 서로 26주 이상 떨어짐)와 이후 26·52주 결과."""
    f = f.dropna()
    if len(f) < EXCLUDE_RECENT + 60:
        return None
    z = ((f - f.mean()) / f.std(ddof=0).replace(0, np.nan)).dropna(axis=1)
    now = z.iloc[-1]
    cand = z[z.index <= z.index[-1] - pd.Timedelta(weeks=EXCLUDE_RECENT)]
    dist = np.sqrt(((cand - now) ** 2).sum(axis=1)).sort_values()
    picks: list[pd.Timestamp] = []
    for t in dist.index:
        if all(abs((t - p).days) >= MIN_GAP * 7 for p in picks):
            picks.append(t)
        if len(picks) == top:
            break

    def fwd(t: pd.Timestamp, weeks: int) -> dict:
        row0, row1 = w.loc[:t].iloc[-1], w.loc[:t + pd.Timedelta(weeks=weeks)].iloc[-1]
        out = {}
        for k in ("kospi", "spx", "krw"):
            if k in w and not pd.isna(row0.get(k)) and not pd.isna(row1.get(k)) and row0[k]:
                out[k] = _r((row1[k] / row0[k] - 1) * 100, 1)
        if "us10y" in w and not pd.isna(row0.get("us10y")) and not pd.isna(row1.get("us10y")):
            out["us10y_bp"] = _r((row1["us10y"] - row0["us10y"]) * 100, 0)
        return out

    max_d = float(dist.max()) or 1.0
    items = [{
        "date": t.strftime("%Y-%m-%d"), "similarity": int(round((1 - float(dist[t]) / max_d) * 100)),
        "features": {k: _r(f.loc[t, k], 1) for k in f.columns},
        "after_6m": fwd(t, 26), "after_12m": fwd(t, 52),
        "context": {k: _active(regimes.get(k, []), t) for k in ("rates", "fx", "kospi")},
    } for t in picks]
    avg = {}
    for h in ("after_6m", "after_12m"):
        keys = sorted(set().union(*(i[h].keys() for i in items))) if items else []
        avg[h] = {k: _r(np.mean([i[h][k] for i in items if k in i[h]]), 1) for k in keys}
    return {"now": {k: _r(f.iloc[-1][k], 1) for k in f.columns}, "labels": {k: FEATURES[k] for k in f.columns},
            "analogs": items, "average": avg}


def correlation_map(w: pd.DataFrame) -> dict | None:
    """주간 변화 상관 — 최근 52주 vs 10년, 평소와 가장 달라진 쌍."""
    cols = [c for c in CORR_ASSETS if c in w]
    if len(cols) < 3 or len(w) < 120:
        return None
    ch = pd.DataFrame(index=w.index)
    for c in cols:
        ch[c] = w[c].diff() if c in ("us10y", "kr10y") else np.log(w[c]).diff()
    now, long = ch.tail(52).corr(), ch.tail(520).corr()
    pairs = []
    for i, a in enumerate(cols):
        for b in cols[i + 1:]:
            n, l = now.loc[a, b], long.loc[a, b]
            if pd.isna(n) or pd.isna(l):
                continue
            pairs.append({"a": a, "b": b, "now": _r(n), "long": _r(l), "diff": _r(n - l)})
    pairs.sort(key=lambda p: -abs(p["diff"]))
    for p in pairs:
        p["text"] = (f"{CORR_ASSETS[p['a']]}–{CORR_ASSETS[p['b']]}: 최근 1년 {p['now']:+.2f} (10년 {p['long']:+.2f}) — "
                     + ("평소보다 강하게 연결" if abs(p["now"]) > abs(p["long"]) else "평소보다 느슨하게 연결"))
    return {"assets": [{"key": c, "label": CORR_ASSETS[c]} for c in cols],
            "now": [[_r(now.loc[a, b]) for b in cols] for a in cols],
            "long": [[_r(long.loc[a, b]) for b in cols] for a in cols], "notable": pairs[:5]}


def _lane_summary(key: str, g: dict) -> str:
    if key == "rates":
        return f"{g['from']:.2f}% 유지" if g["kind"] == "hold" else f"{g['from']:.2f}→{g['to']:.2f}% ({g['bp']:+.0f}bp)"
    unit = "원" if key == "fx" else ""
    return f"{g['from']:,.0f}→{g['to']:,.0f}{unit} ({g['chg_pct']:+.1f}%)"


def timeline(fx, rates, stocks, w: pd.DataFrame) -> dict:
    """통합 타임라인: 금리·환율·KOSPI 국면 3트랙 + 차트용 KOSPI·원/달러·기준금리 주간 시계열."""
    lanes = []
    for key, label, segs in (("rates", "한국 기준금리", (rates or {}).get("regimes") or []),
                             ("fx", "원/달러", (fx or {}).get("regimes") or []),
                             ("kospi", "KOSPI", ((stocks or {}).get("regimes") or {}).get("kospi") or [])):
        lanes.append({"key": key, "label": label, "segments": [
            {k: g.get(k) for k in ("start", "end", "kind", "title", "drivers", "source")} | {"summary": _lane_summary(key, g)}
            for g in segs]})
    series = [{"date": i.strftime("%Y-%m-%d"), "kospi": _r(r.get("kospi")), "krw": _r(r.get("krw"), 1),
               "kr_base": _r(r.get("kr_base"))} for i, r in w.iterrows()] if not w.empty else []
    return {"lanes": lanes, "series": series}


def diagnosis(fx, rates, stocks) -> dict:
    """한 줄 국면 진단과 축별 상태(tone: +1 긴축·강세 / −1 완화·약세)."""
    fs, rs = (fx or {}).get("snapshot", {}), (rates or {}).get("snapshot", {})
    cards, sreg = (stocks or {}).get("cards", {}), (stocks or {}).get("regimes", {})
    rows = []
    for c, name in (("kr", "한국 금리"), ("us", "미국 금리")):
        ph = (rs.get("phase") or {}).get(c)
        head = ph.split("·")[0] if ph else ""
        rows.append({"axis": name, "status": ph or "데이터 없음", "tone": 1 if "인상" in head else -1 if "인하" in head else 0})
    dxy = (fs.get("dxy") or {}).get("chg_1y")
    if dxy is None:
        dollar = {"axis": "달러", "status": "데이터 없음", "tone": 0}
    else:
        word, tone = ("달러 강세", 1) if dxy > 3 else ("달러 약세", -1) if dxy < -3 else ("달러 보합", 0)
        dollar = {"axis": "달러", "status": f"{word} (달러지수 1년 {dxy:+.1f}%)", "tone": tone}
    krw = fs.get("krw") or {}
    if krw.get("value") is not None and krw.get("pct10y") is not None and krw.get("chg_1y") is not None:
        p3 = f" · 3년 중 {krw['pct3y']}%" if krw.get("pct3y") is not None else ""
        level = (fs.get("verdict") or {}).get("level")  # 환율 탭의 강세·약세 근거 비교 결과
        rows.append({"axis": "원화", "status": f"원/달러 {krw['value']:,.0f}원 · 10년 중 {krw['pct10y']}%{p3} · 1년 {krw['chg_1y']:+.1f}%",
                     "tone": 1 if level == "weak_krw" else -1 if level == "strong_krw" else 0})
    rows.append(dollar)  # 2열 격자에서 왼쪽 한국(원화)·오른쪽 미국(달러)이 되도록 원화 다음에 둔다
    for k, name in (("kospi", "KOSPI"), ("spx", "S&P500")):
        last = (sreg.get(k) or [None])[-1]
        if last:
            dd = (cards.get(k) or {}).get("drawdown", 0) or 0
            rows.append({"axis": name, "status": f"{'강세장' if last['kind'] == 'bull' else '약세장'} · 고점 대비 {dd:.1f}%",
                         "tone": 1 if last["kind"] == "bull" else -1})
    rate_tones = [r["tone"] for r in rows[:2]]
    rate_word = "긴축" if any(t > 0 for t in rate_tones) else "완화" if rate_tones and all(t < 0 for t in rate_tones) else "금리 관망"
    stock_words = [f"{r['axis']} {r['status'].split(' ·')[0]}" for r in rows if r["axis"] in ("KOSPI", "S&P500")]
    headline = " · ".join([rate_word, dollar["status"].split(" (")[0], *stock_words])
    return {"headline": headline, "rows": rows}


def allocation(fx, rates, stocks) -> list[dict]:
    """자산군별 근거(+1/−1)와 점수 — 참고용 규칙(docs/macro-tab-context-notes.md)."""
    fs, rs = (fx or {}).get("snapshot", {}), (rates or {}).get("snapshot", {})
    val, cards, sreg = (stocks or {}).get("valuation") or {}, (stocks or {}).get("cards", {}), (stocks or {}).get("regimes", {})
    out = []

    def add(asset, reasons):
        score = sum(s for s, _ in reasons)
        label = "비중 확대 근거 우세" if score >= 2 else "비중 축소 근거 우세" if score <= -2 else "중립"
        out.append({"asset": asset, "score": score, "label": label,
                    "reasons": [{"sign": s, "text": t} for s, t in reasons] or [{"sign": 0, "text": "뚜렷한 근거 없음"}]})

    r = []
    erp = (val.get("erp") or {}).get("value")
    if erp is not None and erp < 0:
        r.append((-1, f"S&P 위험 프리미엄 {erp:+.2f}%p — 국채가 주식 이익수익률보다 높음"))
    cape = (val.get("cape") or {}).get("pct20y")
    if cape is not None and cape >= 90:
        r.append((-1, f"S&P CAPE가 20년 중 {cape}% 위치(고평가)"))
    kl = (sreg.get("kospi") or [None])[-1]
    if kl and kl["kind"] == "bear":
        r.append((-1, f"KOSPI 약세장 진행(고점 대비 {(cards.get('kospi') or {}).get('drawdown', 0):.1f}%)"))
    sl = (sreg.get("spx") or [None])[-1]
    if sl and sl["kind"] == "bull":
        r.append((1, "S&P500 강세장 지속"))
    k1y = (cards.get("kospi") or {}).get("chg_1y")
    if k1y is not None and k1y >= 50:
        r.append((-1, f"KOSPI 1년 {k1y:+.0f}% — 단기 과열 부담"))
    add("주식", r)

    r = []
    im = (rs.get("implied") or {}).get("kr")
    if im and (im.get("moves") or 0) >= 1:
        r.append((-1, f"한국 시장이 1년 내 인상 {im['moves']:.1f}회 반영 — 장기채보다 단기채 유리"))
    us10 = rs.get("us10y") or {}
    if (us10.get("pct10y") or 0) >= 90:
        r.append((1, f"미 10년물 {us10.get('value')}%로 10년 중 {us10.get('pct10y')}% — 채권 금리 매력"))
    add("채권", r)

    # 달러 자산: 환율 탭과 같은 근거 — 원화 강세 근거는 환차손 위험(−1), 약세 근거는 환차익 여지(+1)
    v = fs.get("verdict") or {}
    add("달러", [(-1, f"[원화 강세] {t}") for t in v.get("strong", [])] + [(1, f"[원화 약세] {t}") for t in v.get("weak", [])])

    r = []
    rows = ((rates or {}).get("terms") or {}).get("rows") or []
    kr1y = next((x.get("kr") for x in rows if x.get("key") == "short"), None)
    if kr1y is not None and kr1y >= 3.5:
        r.append((1, f"한국 1년물 {kr1y:.2f}% — 단기 금리만으로도 수익"))
    add("현금·단기", r)
    return out


RESULT_DAYS = 30   # 지난 이벤트를 결과와 함께 남겨 두는 기간(일)
MEETING_COLS = ["원/달러", "국내 채권금리", "KOSPI"]
MEETING_CASES = {
    "bok": [("인상", "하락(원화 강세)", "상승(가격 하락)", "부담(금리 민감 업종)"),
            ("동결", "상승(인상 기대가 클수록)", "하락(기대 되돌림)", "안도"),
            ("인하", "상승(원화 약세)", "하락(가격 상승)", "유동성 호재")],
    "fomc": [("인상", "상승(달러 강세)", "상승 압력", "위험자산 부담"),
             ("동결", "하락(인상 기대가 클수록)", "안정", "안도"),
             ("인하", "하락(달러 약세)", "하락 압력", "위험자산 호재")],
}
# 회의 외 주요 이벤트(현지 날짜) — 결과는 날짜 이후 뉴스 헤드라인 + AI 요약(keywords가 빠진 요약은 버린다). 연 1회 갱신.
EVENTS = [{
    "date": "2026-11-03", "title": "미국 중간선거",
    "note": "의회 구성에 따라 재정·관세 정책 기대가 바뀌며 달러·미국 금리 변동이 커질 수 있음",
    "cols": ["원/달러", "미국 금리", "KOSPI"],
    "cases": [("공화당 상·하원 유지", "상승 압력(감세·관세 기조 지속, 달러 강세)", "상승 압력(재정적자 확대 기대)", "관세 불확실성 지속"),
              ("민주당 하원 이상 탈환(분점)", "하락 여지(정책 교착, 달러 약세)", "안정(추가 재정 확대 제동)", "관세·무역 완화 기대")],
    "query": "미국 중간선거 결과 하원 상원", "keywords": ("하원", "상원"),
}]


def _meeting_result(card: dict, d: str, lag: int, rate_key: str) -> dict | None:
    """정책금리 카드(date·changes)로 회의일 d의 결정을 판정. 데이터가 d+lag일에 못 미치면 None(결과 대기)."""
    if not card or not card.get("date"):
        return None
    day = date.fromisoformat(d)
    if date.fromisoformat(card["date"]) < day + timedelta(days=lag):
        return None
    ch = card.get("changes") or []
    hit = next((c for c in ch if day <= date.fromisoformat(c["date"]) <= day + timedelta(days=3)), None)
    if hit:
        word = "인상" if hit["bp"] > 0 else "인하"
        return {"case": word, "text": f"{word} {hit['from']:.2f}→{hit['to']:.2f}% ({hit['bp']:+.0f}bp)"}
    later = next((c for c in ch if date.fromisoformat(c["date"]) > day + timedelta(days=3)), None)
    rate = later["from"] if later else card.get(rate_key)
    return {"case": "동결", "text": f"동결 · {rate:.2f}% 유지" if rate is not None else "동결"}


def _reaction(w: pd.DataFrame, d: str) -> dict | None:
    """이벤트 직전 주 대비 최신 주의 시장 반응(주간 표 기준)."""
    if w is None or w.empty:
        return None
    before = w[w.index < pd.Timestamp(d)]
    if before.empty or w.index[-1] <= before.index[-1]:
        return None
    b, n = before.iloc[-1], w.iloc[-1]
    out = {"since": before.index[-1].strftime("%Y-%m-%d")}
    for k in ("krw", "kospi"):
        if k in w and not pd.isna(b.get(k)) and not pd.isna(n.get(k)) and b[k]:
            out[k] = _r((n[k] / b[k] - 1) * 100)
    for k in ("us10y", "kr10y"):
        if k in w and not pd.isna(b.get(k)) and not pd.isna(n.get(k)):
            out[f"{k}_bp"] = _r((n[k] - b[k]) * 100, 0)
    return out if len(out) > 1 else None


def _shown(dates: list[str], today: date) -> tuple[list[str], bool]:
    """보일 날짜: 오늘 포함 최근 RESULT_DAYS일 안의 지난 일정 + 다음 일정 하나. 두 번째 값은 다음 일정 유무."""
    past = [d for d in dates if 0 <= (today - date.fromisoformat(d)).days <= RESULT_DAYS]
    nxt = next((d for d in dates if date.fromisoformat(d) > today), None)
    return past + ([nxt] if nxt else []), nxt is not None


def scenarios(rates, w: pd.DataFrame | None, today: date, event_results: dict | None = None) -> dict:
    """금통위·FOMC·기타 이벤트를 날짜순 한 목록으로. 지난 이벤트는 결과(case·text)와 직전 주 대비 반응을 붙인다."""
    from api.rates_dashboard import BOK_MEETINGS, FOMC_MEETINGS
    rs = (rates or {}).get("snapshot", {})
    implied = rs.get("implied") or {}
    items, missing = [], []
    meetings = (("bok", "한국은행 금통위", BOK_MEETINGS, rs.get("kr_base") or {}, "value", 0, "kr"),
                ("fomc", "미국 FOMC", FOMC_MEETINGS, rs.get("us_policy") or {}, "upper", 1, "us"))
    for kind, title, dates, card, rate_key, lag, ck in meetings:
        shown, has_next = _shown(dates, today)
        if not has_next:
            missing.append(title)
        for d in shown:
            # 미국 현지 날짜 이벤트(FOMC)는 결과가 다음 날 나오므로 그날까지는 '예정'으로 둔다
            upcoming = date.fromisoformat(d) + timedelta(days=lag) > today
            res = None if upcoming else _meeting_result(card, d, lag, rate_key)
            items.append({"kind": kind, "date": d, "d_day": (date.fromisoformat(d) - today).days, "title": title,
                          "status": "upcoming" if upcoming else "done" if res else "pending",
                          "rate": card.get(rate_key), "implied": (implied.get(ck) or {}).get("label") if upcoming else None,
                          "cols": MEETING_COLS, "cases": [{"case": c, "cells": list(v)} for c, *v in MEETING_CASES[kind]],
                          "result": res, "reaction": _reaction(w, d) if res else None})
    for ev in EVENTS:
        day = date.fromisoformat(ev["date"])
        if (today - day).days > RESULT_DAYS:
            continue
        upcoming = day + timedelta(days=1) > today   # 결과는 다음 날부터 확인
        res = None if upcoming else (event_results or {}).get(ev["date"])
        items.append({"kind": "event", "date": ev["date"], "d_day": (day - today).days, "title": ev["title"],
                      "status": "upcoming" if upcoming else "done" if res else "pending",
                      "note": ev["note"], "cols": ev["cols"], "cases": [{"case": c, "cells": list(v)} for c, *v in ev["cases"]],
                      "result": res, "reaction": _reaction(w, ev["date"]) if res else None})
    items.sort(key=lambda x: (x["date"], {"bok": 0, "fomc": 1, "event": 2}[x["kind"]]))
    return {"items": items, "missing": missing,
            "note": "일반적인 방향입니다. 실제 반응은 결과가 시장 기대(1년물에 반영된 경로)와 얼마나 다른지가 결정합니다."}


# ── 이벤트 결과(AI, DB 저장) ──────────────────────────────────────────────────
EVENT_RETRY_SEC = 6 * 3600
_event_results: dict[str, dict] = {}     # date → {summary, points, case, at}
_event_loaded = False
_event_attempt: dict[str, float] = {}


def due_ai_events(today: date) -> list[dict]:
    """결과를 확인할 때가 된 기타 이벤트(다음 날부터 RESULT_DAYS일까지)."""
    return [ev for ev in EVENTS if 1 <= (today - date.fromisoformat(ev["date"])).days <= RESULT_DAYS]


def event_headlines(query: str, since: date, limit: int = 12) -> list[str]:
    """Google 뉴스 RSS에서 since 이후 발행 헤드라인만 — 지난 선거 기사로 요약이 오염되지 않게."""
    from email.utils import parsedate_to_datetime
    from urllib.parse import quote
    from xml.etree import ElementTree

    import requests
    try:
        url = f"https://news.google.com/rss/search?q={quote(query)}&hl=ko&gl=KR&ceid=KR:ko"
        root = ElementTree.fromstring(requests.get(url, timeout=15, headers={"User-Agent": "Mozilla/5.0"}).content)
        out = []
        for it in root.iter("item"):
            title, pub = it.findtext("title"), it.findtext("pubDate")
            try:
                ok = pub and parsedate_to_datetime(pub).date() >= since
            except Exception:
                ok = False
            if title and ok:
                out.append(title)
        return out[:limit]
    except Exception as e:
        logger.warning(f"event headlines failed: {type(e).__name__}")
        return []


def event_prompt(ev: dict, headlines: list[str]) -> str:
    cases = "\n".join(f"- {c[0]}" for c in ev["cases"])
    news = "\n".join(f"- {h}" for h in headlines)
    return f"""너는 한국 투자자를 돕는 거시 애널리스트다. {ev['date']}에 있었던 '{ev['title']}'의 결과를 아래 헤드라인만 근거로 정리한다.
헤드라인({ev['date']} 이후 발행):
{news}
미리 정한 시나리오:
{cases}
규칙:
- summary: 결과를 한국어 1~2문장(120자 이내). 헤드라인에서 최종 결과가 확인되지 않으면 빈 문자열.
- points: 시장에 중요한 포인트 2~3개, 각 40자 이내.
- case: 위 시나리오 이름 중 하나를 그대로, 어느 쪽도 아니면 "기타".
반드시 JSON만 반환: {{"summary": "...", "points": ["..."], "case": "..."}}"""


def valid_event_result(t: dict, ev: dict) -> dict | None:
    summary, points = t.get("summary"), t.get("points") or []
    if not isinstance(summary, str) or not 10 <= len(summary.strip()) <= 200:
        return None
    if not isinstance(points, list) or not all(isinstance(x, str) for x in points):
        return None
    if not any(k in summary + " ".join(points) for k in ev["keywords"]):
        return None
    names = [c[0] for c in ev["cases"]]
    return {"summary": summary.strip(), "points": [x.strip()[:60] for x in points if x.strip()][:3],
            "case": t.get("case") if t.get("case") in names else "기타"}


async def _load_event_results():
    global _event_loaded
    if _event_loaded:
        return
    try:
        from sqlalchemy import select

        from db.database import AsyncSessionLocal
        from db.models import SectorInsight
        async with AsyncSessionLocal() as db:
            for ev in EVENTS:
                row = (await db.execute(select(SectorInsight).where(SectorInsight.sector == f"event_result:{ev['date']}"))).scalar_one_or_none()
                if row and row.content:
                    _event_results[ev["date"]] = json.loads(row.content)
        _event_loaded = True
    except Exception as e:
        logger.warning(f"event results load failed: {type(e).__name__}")


async def check_events(today: date, force: bool = False) -> bool:
    """확인할 때가 된 이벤트 결과를 AI로 채운다. force면 저장된 결과도 다시 쓴다(실패하면 기존 결과 유지). 새로 저장하면 True."""
    key = os.environ.get("GEMINI_API_KEY")
    if not key:
        return False
    saved = False
    for ev in due_ai_events(today):
        d = ev["date"]
        if not force and (d in _event_results or time.time() - _event_attempt.get(d, 0) < EVENT_RETRY_SEC):
            continue
        _event_attempt[d] = time.time()
        headlines = await run_io(event_headlines, ev["query"], date.fromisoformat(d))
        if not headlines:
            continue
        try:
            from api.brazil_bond import _call_gemini_sync, _extract_json
            res = valid_event_result(_extract_json(await run_io(_call_gemini_sync, key, event_prompt(ev, headlines))), ev)
        except Exception as e:
            logger.warning(f"event result AI failed {d}: {type(e).__name__}")
            res = None
        if not res:
            continue
        res["at"] = datetime.now(timezone.utc).isoformat(timespec="seconds")
        res["source"] = f"AI 요약 · {d} 이후 뉴스 {len(headlines)}건"
        _event_results[d] = res
        saved = True
        try:
            from sqlalchemy import select

            from db.database import AsyncSessionLocal
            from db.models import SectorInsight
            async with AsyncSessionLocal() as db:
                sector = f"event_result:{d}"
                row = (await db.execute(select(SectorInsight).where(SectorInsight.sector == sector))).scalar_one_or_none()
                payload, at = json.dumps(res, ensure_ascii=False), datetime.now(timezone.utc).replace(tzinfo=None)
                if row:
                    row.content, row.generated_at = payload, at
                else:
                    db.add(SectorInsight(sector=sector, content=payload, generated_at=at))
                await db.commit()
        except Exception as e:
            logger.warning(f"event result save failed {d}: {type(e).__name__}")
    return saved


def build_overview(fx: dict | None, rates: dict | None, stocks: dict | None, today: date,
                   event_results: dict | None = None) -> dict:
    w = weekly_frame(fx, rates, stocks)
    regs = {"rates": (rates or {}).get("regimes") or [], "fx": (fx or {}).get("regimes") or [],
            "kospi": ((stocks or {}).get("regimes") or {}).get("kospi") or []}
    return {
        "diagnosis": diagnosis(fx, rates, stocks),
        "analogs": find_analogs(w, features(w), regs) if not w.empty else None,
        "correlation": correlation_map(w) if not w.empty else None,
        "timeline": timeline(fx, rates, stocks, w),
        "scenarios": scenarios(rates, w, today, event_results),
        "allocation": allocation(fx, rates, stocks),
        "sources": {"fx": (fx or {}).get("updated_at"), "rates": (rates or {}).get("updated_at"),
                    "stocks": (stocks or {}).get("updated_at")},
        "updated_at": datetime.now(timezone.utc).isoformat(timespec="seconds"),
    }


# ── AI 종합 코멘트(6시간, 백그라운드) ──────────────────────────────────────────
_comment: dict = {"text": None, "at": None}
_bg: set = set()


def events_sig(d: dict) -> str:
    """결과가 나온 이벤트 서명 — 바뀌면 AI 종합 코멘트를 다시 쓴다."""
    return "|".join(f"{i['date']}:{i['kind']}:{(i.get('result') or {}).get('case')}"
                    for i in (d.get("scenarios") or {}).get("items", []) if i["status"] == "done")


def _event_line(i: dict) -> str:
    r = i["result"] or {}
    return f"- {i['date']} {i['title']}: {r.get('text') or r.get('summary')}"


def comment_prompt(d: dict) -> str:
    done = [i for i in (d.get("scenarios") or {}).get("items", []) if i["status"] == "done"]
    events = ("최근 이벤트 결과:\n" + "\n".join(_event_line(i) for i in done) + "\n") if done else ""
    alloc = "\n".join(f"- {a['asset']}: {a['label']} ({'; '.join(x['text'] for x in a['reasons'])})" for a in d["allocation"])
    diag = "\n".join(f"- {r['axis']}: {r['status']}" for r in d["diagnosis"]["rows"])
    an = (d.get("analogs") or {}).get("average", {}).get("after_12m", {})
    return f"""너는 한국 개인투자자를 돕는 거시 애널리스트다. 아래 수치만 근거로 지금 시장을 한국어 3~4문장으로 요약한다.
국면: {d['diagnosis']['headline']}
{diag}
자산별 근거:
{alloc}
과거 유사 국면 이후 12개월 평균(%, us10y_bp는 bp): {json.dumps(an, ensure_ascii=False)}
{events}규칙: 최근 이벤트 결과가 있으면 그 결과가 지금 국면에 주는 의미를 한 문장 포함한다. 수치에 없는 사건·전망을 지어내지 않는다. 매수·매도 권유 문장을 쓰지 않는다. 문장만 반환."""


async def _refresh_comment(d: dict):
    key = os.environ.get("GEMINI_API_KEY")
    if not key:
        return
    try:
        from api.brazil_bond import _call_gemini_sync
        text = (await run_io(_call_gemini_sync, key, comment_prompt(d))).strip()
        if not text:
            return
        at = datetime.now(timezone.utc)
        _comment.update(text=text, at=at.isoformat(timespec="seconds"), events_sig=events_sig(d))
        d["comment"] = dict(_comment)
        from sqlalchemy import select

        from db.database import AsyncSessionLocal
        from db.models import SectorInsight
        async with AsyncSessionLocal() as db:
            row = (await db.execute(select(SectorInsight).where(SectorInsight.sector == "macro_comment"))).scalar_one_or_none()
            payload = json.dumps(_comment, ensure_ascii=False)
            if row:
                row.content, row.generated_at = payload, at.replace(tzinfo=None)
            else:
                db.add(SectorInsight(sector="macro_comment", content=payload, generated_at=at.replace(tzinfo=None)))
            await db.commit()
    except Exception as e:
        logger.warning(f"macro comment failed: {type(e).__name__}: {e}")


async def _load_comment():
    if _comment["text"]:
        return
    try:
        from sqlalchemy import select

        from db.database import AsyncSessionLocal
        from db.models import SectorInsight
        async with AsyncSessionLocal() as db:
            row = (await db.execute(select(SectorInsight).where(SectorInsight.sector == "macro_comment"))).scalar_one_or_none()
            if row and row.content:
                _comment.update(json.loads(row.content))
    except Exception as e:
        logger.warning(f"macro comment load failed: {type(e).__name__}")


async def _build(force_sources: bool = False) -> dict | None:
    from api.fx_dashboard import overview_cache as fx_c
    from api.rates_dashboard import overview_cache as rates_c
    from api.stocks_dashboard import overview_cache as stocks_c
    res = await asyncio.gather(fx_c.get(force_sources), rates_c.get(force_sources), stocks_c.get(force_sources),
                               return_exceptions=True)
    fx, rates, stocks = [None if isinstance(x, BaseException) else x for x in res]
    if not any((fx, rates, stocks)):
        return None
    today = date.today()
    await _load_event_results()
    data = build_overview(fx, rates, stocks, today, _event_results)
    await _load_comment()
    data["comment"] = dict(_comment)
    at = datetime.fromisoformat(_comment["at"]) if _comment.get("at") else None
    stale = at is None or (datetime.now(timezone.utc) - at).total_seconds() > AI_TTL
    if stale or _comment.get("events_sig", "") != events_sig(data):  # 새 이벤트 결과가 나오면 바로 다시 쓴다
        _spawn(_refresh_comment(data))
    if any(ev["date"] not in _event_results for ev in due_ai_events(today)):
        _spawn(_bg_check_events(today))
    return data


def _spawn(coro):
    t = asyncio.create_task(coro)
    _bg.add(t)
    t.add_done_callback(_bg.discard)


async def _bg_check_events(today: date):
    if await check_events(today):  # 새 결과 → 캐시를 만료시켜 다음 조회 때 다시 계산
        overview_cache.ts = 0


overview_cache = OverviewCache("macro", CACHE_TTL, _build)


@router.get("/overview")
async def macro_overview(refresh: bool = Query(False)):
    if refresh:  # 세 탭 캐시까지 새로 받는다
        data = await _build(force_sources=True)
        if data:
            overview_cache.data, overview_cache.ts = data, time.time()
    else:
        data = await overview_cache.get()
    if data is None:
        raise HTTPException(status_code=503, detail="종합분석에 필요한 환율·금리·주식 데이터를 불러오지 못했습니다.")
    return data


_manual = {"at": 0.0}
MANUAL_MIN_SEC = 60


@router.post("/events/refresh")
async def refresh_events():
    """수동 '결과 업데이트': 금리 원천을 새로 받고, 이벤트 AI 결과를 다시 확인한 뒤 종합분석을 다시 계산한다."""
    if time.time() - _manual["at"] < MANUAL_MIN_SEC and overview_cache.data:  # 연타 방지
        return {**overview_cache.data, "throttled": True}
    _manual["at"] = time.time()
    from api.rates_dashboard import overview_cache as rates_c
    await rates_c.get(force=True)
    await _load_event_results()
    await check_events(date.today(), force=True)
    data = await _build()
    if data is None:
        raise HTTPException(status_code=503, detail="종합분석 데이터를 다시 계산하지 못했습니다.")
    overview_cache.data, overview_cache.ts = data, time.time()
    return data
