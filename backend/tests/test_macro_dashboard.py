# 종합분석 계산 로직 테스트 — 세 탭 응답 모양의 가짜 dict로 국면 진단·유사 국면·상관·배분·타임라인 검증
from datetime import date, timedelta

import numpy as np

import pandas as pd

from api.macro_dashboard import (_reaction, build_overview, comment_prompt, due_ai_events, events_sig, scenarios,
                                 valid_event_result, EVENTS)

TODAY = date(2026, 10, 2)
WEEKS = [date(2006, 10, 6) + timedelta(weeks=i) for i in range(1044)]


def _wave(i, period, amp, base):
    return base + amp * np.sin(2 * np.pi * i / period)


def _fx():
    return {"weekly": [{"date": d.isoformat(), "krw": _wave(i, 260, 150, 1200), "dxy": _wave(i, 260, 8, 95),
                        "vix": 20 + 5 * np.sin(i / 7)} for i, d in enumerate(WEEKS)],
            "snapshot": {"dxy": {"chg_1y": 4.8}, "krw": {"value": 1345.0, "pct10y": 85, "pct3y": 60, "chg_1y": -4.3},
                         "verdict": {"level": "strong_krw", "strong": ["10년 상위", "실질가치 저평가", "순유입"], "weak": []},
                         "reer": {"gap_pct": -14.0}, "spread10": {"value": 0.95, "year_ago": 1.2}},
            "regimes": [{"start": "2025-06-30", "end": None, "kind": "down", "title": "원화 강세", "drivers": [],
                         "from": 1556.0, "to": 1345.0, "chg_pct": -13.6}], "updated_at": "2026-10-05T00:00:00+00:00"}


def _rates():
    return {"weekly": [{"date": d.isoformat(), "kr_base": 2.5 if i < 1030 else 3.0, "us10y": _wave(i, 300, 1.5, 3.5),
                        "us_10_2": _wave(i, 400, 1.0, 0.5), "kr10y": _wave(i, 300, 1.0, 3.0)} for i, d in enumerate(WEEKS)],
            "snapshot": {"phase": {"kr": "한국 인상 국면 · 시장은 1년 내 인상 약 2.9회 반영", "us": "미국 동결 국면"},
                         "implied": {"kr": {"moves": 2.9, "label": "1년 내 인상 약 2.9회 반영"}, "us": None},
                         "us10y": {"value": 5.24, "pct10y": 100},
                         "kr_base": {"value": 3.0, "date": "2026-10-02", "next_meeting": {"date": "2026-10-22", "d_day": 20},
                                     "changes": [{"date": "2026-07-16", "from": 2.5, "to": 3.0, "bp": 50}]},
                         "us_policy": {"upper": 4.0, "date": "2026-10-01", "next_meeting": {"date": "2026-10-28", "d_day": 26},
                                       "changes": [{"date": "2025-12-11", "from": 3.75, "to": 4.0, "bp": 25}]}},
            "terms": {"rows": [{"key": "short", "kr": 3.73}]},
            "regimes": [{"start": "2026-07-16", "end": None, "kind": "hike", "title": "인상 재개", "drivers": [],
                         "from": 2.5, "to": 3.0, "bp": 50}], "updated_at": "2026-10-05T00:00:00+00:00"}


def _stocks():
    return {"weekly": [{"date": d.isoformat(), "kospi": _wave(i, 200, 500, 2500) * (1 + i / 2000), "spx": 1000 * 1.0018 ** i,
                        "ndx": 2000 * 1.0025 ** i} for i, d in enumerate(WEEKS)],
            "cards": {"kospi": {"drawdown": -22.6, "chg_1y": 107.0}, "spx": {"drawdown": -0.8}},
            "valuation": {"erp": {"value": -1.44}, "cape": {"pct20y": 100}},
            "regimes": {"kospi": [{"start": "2026-06-19", "end": None, "kind": "bear", "title": "약세장", "drivers": [],
                                   "from": 9052.0, "to": 7004.0, "chg_pct": -22.6}],
                        "spx": [{"start": "2022-10-14", "end": None, "kind": "bull", "title": "강세장", "drivers": [],
                                 "from": 3583.0, "to": 7722.0, "chg_pct": 115.5}]},
            "updated_at": "2026-10-05T00:00:00+00:00"}


def test_diagnosis_headline_and_rows():
    d = build_overview(_fx(), _rates(), _stocks(), TODAY)["diagnosis"]
    assert d["headline"] == "긴축 · 달러 강세 · KOSPI 약세장 · S&P500 강세장"
    assert [r["axis"] for r in d["rows"]] == ["한국 금리", "미국 금리", "원화", "달러", "KOSPI", "S&P500"]  # 왼쪽 한국·오른쪽 미국
    tones = {r["axis"]: r["tone"] for r in d["rows"]}
    assert tones == {"한국 금리": 1, "미국 금리": 0, "달러": 1, "원화": -1, "KOSPI": -1, "S&P500": 1}
    assert "3년 중 60%" in next(r["status"] for r in d["rows"] if r["axis"] == "원화")


def test_analogs_exclude_recent_and_keep_gap():
    a = build_overview(_fx(), _rates(), _stocks(), TODAY)["analogs"]
    dates = [date.fromisoformat(x["date"]) for x in a["analogs"]]
    assert len(dates) == 3 and all((TODAY - d).days >= 104 * 7 - 7 for d in dates)
    assert all(abs((x - y).days) >= 26 * 7 for i, x in enumerate(dates) for y in dates[i + 1:])
    assert set(a["average"]["after_12m"]) >= {"kospi", "spx", "krw", "us10y_bp"}
    assert set(a["now"]) == {"us10_chg", "krbase_chg", "dxy_chg", "krw_chg", "spx_chg", "kospi_chg", "curve", "vix"}


def test_correlation_matrix_shape_and_notable_sorted():
    c = build_overview(_fx(), _rates(), _stocks(), TODAY)["correlation"]
    n = len(c["assets"])
    assert n == 8 and len(c["now"]) == n and all(len(r) == n for r in c["now"])
    diffs = [abs(p["diff"]) for p in c["notable"]]
    assert diffs == sorted(diffs, reverse=True) and len(diffs) <= 5


def test_allocation_scores():
    alloc = {a["asset"]: a for a in build_overview(_fx(), _rates(), _stocks(), TODAY)["allocation"]}
    assert alloc["주식"]["score"] == -3 and alloc["주식"]["label"] == "비중 축소 근거 우세"
    assert alloc["채권"]["score"] == 0 and alloc["달러"]["score"] == -3 and alloc["현금·단기"]["score"] == 1
    assert alloc["달러"]["reasons"][0]["text"] == "[원화 강세] 10년 상위"


def test_dollar_allocation_counts_krw_weakness_evidence():
    fx = _fx()
    fx["snapshot"]["verdict"] = {"level": "neutral", "strong": ["a"], "weak": ["b", "c"]}
    alloc = {a["asset"]: a for a in build_overview(fx, _rates(), _stocks(), TODAY)["allocation"]}
    assert alloc["달러"]["score"] == 1 and [r["sign"] for r in alloc["달러"]["reasons"]] == [-1, 1, 1]


def test_timeline_lanes_and_scenarios():
    out = build_overview(_fx(), _rates(), _stocks(), TODAY)
    lanes = {l["key"]: l for l in out["timeline"]["lanes"]}
    assert lanes["rates"]["segments"][0]["summary"] == "2.50→3.00% (+50bp)"
    assert lanes["fx"]["segments"][0]["summary"] == "1,556→1,345원 (-13.6%)"
    assert lanes["kospi"]["segments"][0]["summary"] == "9,052→7,004 (-22.6%)"
    assert out["scenarios"]["items"][0]["d_day"] == 20 and len(out["timeline"]["series"]) > 1000
    assert "인상" in comment_prompt(out)


def _rates_on(kr_date, kr_changes=(), us_date="2026-10-01", us_changes=()):
    r = _rates()
    r["snapshot"]["kr_base"].update(date=kr_date, changes=[{"date": "2026-07-16", "from": 2.5, "to": 3.0, "bp": 50}, *kr_changes])
    r["snapshot"]["us_policy"].update(date=us_date, changes=list(us_changes))
    return r


def test_items_are_chronological_and_upcoming():
    items = scenarios(_rates(), None, TODAY)["items"]
    assert [(i["kind"], i["date"], i["d_day"], i["status"]) for i in items] == [
        ("bok", "2026-10-22", 20, "upcoming"), ("fomc", "2026-10-28", 26, "upcoming"), ("event", "2026-11-03", 32, "upcoming")]
    assert items[0]["implied"] == "1년 내 인상 약 2.9회 반영" and [c["case"] for c in items[0]["cases"]] == ["인상", "동결", "인하"]
    assert items[2]["cols"][1] == "미국 금리" and items[2]["result"] is None


def test_bok_hike_detected_after_meeting_and_next_meeting_shown():
    r = _rates_on("2026-10-23", [{"date": "2026-10-22", "from": 3.0, "to": 3.25, "bp": 25}])
    items = scenarios(r, None, date(2026, 10, 24))["items"]
    bok = [i for i in items if i["kind"] == "bok"]
    assert [i["date"] for i in bok] == ["2026-10-22", "2026-11-26"]
    assert bok[0]["status"] == "done" and bok[0]["result"] == {"case": "인상", "text": "인상 3.00→3.25% (+25bp)"}
    assert bok[1]["status"] == "upcoming"


def test_bok_pending_until_data_reaches_meeting_then_hold():
    assert scenarios(_rates_on("2026-10-21"), None, date(2026, 10, 22))["items"][0]["status"] == "pending"
    bok = scenarios(_rates_on("2026-10-22"), None, date(2026, 10, 22))["items"][0]
    assert bok["status"] == "done" and bok["result"]["case"] == "동결" and bok["result"]["text"] == "동결 · 3.00% 유지"
    # 이후에 다른 변경이 있어도 그 회의 시점의 금리(변경 전 값)로 동결을 표시
    later = _rates_on("2026-11-20", [{"date": "2026-11-10", "from": 3.0, "to": 2.75, "bp": -25}])
    assert scenarios(later, None, date(2026, 11, 20))["items"][0]["result"]["text"] == "동결 · 3.00% 유지"


def test_fomc_needs_next_day_data():
    fomc = lambda r, t: next(i for i in scenarios(r, None, t)["items"] if i["kind"] == "fomc")  # noqa: E731
    assert fomc(_rates_on("2026-10-28", us_date="2026-10-28"), date(2026, 10, 28))["status"] == "upcoming"  # 현지 결정 전
    assert fomc(_rates_on("2026-10-29", us_date="2026-10-28"), date(2026, 10, 29))["status"] == "pending"
    done = fomc(_rates_on("2026-10-28", us_date="2026-10-29", us_changes=[{"date": "2026-10-29", "from": 4.0, "to": 4.25, "bp": 25}]),
                date(2026, 10, 29))
    assert done["result"]["case"] == "인상"


def test_ai_event_status_window_and_due():
    res = {"2026-11-03": {"summary": "민주당이 하원을 탈환", "points": [], "case": "민주당 하원 이상 탈환(분점)"}}
    ev = lambda t, r=None: [i for i in scenarios(_rates(), None, t, r)["items"] if i["kind"] == "event"]  # noqa: E731
    assert ev(date(2026, 11, 3))[0]["status"] == "upcoming" and ev(date(2026, 11, 3))[0]["d_day"] == 0
    assert ev(date(2026, 11, 5))[0]["status"] == "pending"
    assert ev(date(2026, 11, 5), res)[0]["status"] == "done"
    assert ev(date(2026, 12, 4)) == []                                   # 31일 지나면 목록에서 빠짐
    assert due_ai_events(date(2026, 11, 3)) == [] and len(due_ai_events(date(2026, 11, 4))) == 1


def test_valid_event_result_rules():
    ev = EVENTS[0]
    ok = valid_event_result({"summary": "민주당이 하원 다수당을 탈환했다", "points": ["상원은 공화 유지"], "case": "민주당 하원 이상 탈환(분점)"}, ev)
    assert ok["case"] == "민주당 하원 이상 탈환(분점)"
    assert valid_event_result({"summary": "민주당이 하원 다수당을 탈환했다", "points": [], "case": "무승부"}, ev)["case"] == "기타"
    assert valid_event_result({"summary": "", "points": [], "case": "기타"}, ev) is None             # 결과 미확인
    assert valid_event_result({"summary": "주가가 크게 올랐다는 소식이 이어졌다", "points": []}, ev) is None  # 키워드 없음


def test_reaction_since_week_before_event():
    idx = pd.to_datetime(["2026-10-16", "2026-10-23", "2026-10-30"])
    w = pd.DataFrame({"krw": [1400, 1386, 1372], "kospi": [7000, 7140, 7070], "us10y": [5.0, 5.1, 5.2], "kr10y": [4.3, 4.3, 4.25]}, index=idx)
    r = _reaction(w, "2026-10-22")
    assert r == {"since": "2026-10-16", "krw": -2.0, "kospi": 1.0, "us10y_bp": 20.0, "kr10y_bp": -5.0}
    assert _reaction(w, "2026-11-03") is None                            # 이벤트 뒤 데이터가 아직 없음


def test_event_results_feed_comment_and_signature():
    r = _rates_on("2026-10-23", [{"date": "2026-10-22", "from": 3.0, "to": 3.25, "bp": 25}])
    out = build_overview(_fx(), r, _stocks(), date(2026, 10, 24))
    assert events_sig(out) == "2026-10-22:bok:인상"
    assert "2026-10-22 한국은행 금통위: 인상 3.00→3.25% (+25bp)" in comment_prompt(out)
    assert events_sig(build_overview(_fx(), _rates(), _stocks(), TODAY)) == ""


def test_missing_schedule_flagged():
    assert scenarios(_rates(), None, date(2026, 12, 20))["missing"] == ["한국은행 금통위", "미국 FOMC"]


def test_missing_tabs_degrade():
    out = build_overview(None, None, _stocks(), TODAY)
    assert out["diagnosis"]["rows"][0]["status"] == "데이터 없음"
    assert out["correlation"] is None or len(out["correlation"]["assets"]) <= 3
    assert {a["asset"] for a in out["allocation"]} == {"주식", "채권", "달러", "현금·단기"}
