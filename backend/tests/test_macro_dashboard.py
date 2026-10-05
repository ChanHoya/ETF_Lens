# 종합분석 계산 로직 테스트 — 세 탭 응답 모양의 가짜 dict로 국면 진단·유사 국면·상관·배분·타임라인 검증
from datetime import date, timedelta

import numpy as np

from api.macro_dashboard import build_overview, comment_prompt

TODAY = date(2026, 10, 2)
WEEKS = [date(2006, 10, 6) + timedelta(weeks=i) for i in range(1044)]


def _wave(i, period, amp, base):
    return base + amp * np.sin(2 * np.pi * i / period)


def _fx():
    return {"weekly": [{"date": d.isoformat(), "krw": _wave(i, 260, 150, 1200), "dxy": _wave(i, 260, 8, 95),
                        "vix": 20 + 5 * np.sin(i / 7)} for i, d in enumerate(WEEKS)],
            "snapshot": {"dxy": {"chg_1y": 4.8}, "krw": {"value": 1345.0, "pct10y": 85, "chg_1y": -4.3},
                         "reer": {"gap_pct": -14.0}, "spread10": {"value": 0.95, "year_ago": 1.2}},
            "regimes": [{"start": "2025-06-30", "end": None, "kind": "down", "title": "원화 강세", "drivers": [],
                         "from": 1556.0, "to": 1345.0, "chg_pct": -13.6}], "updated_at": "2026-10-05T00:00:00+00:00"}


def _rates():
    return {"weekly": [{"date": d.isoformat(), "kr_base": 2.5 if i < 1030 else 3.0, "us10y": _wave(i, 300, 1.5, 3.5),
                        "us_10_2": _wave(i, 400, 1.0, 0.5), "kr10y": _wave(i, 300, 1.0, 3.0)} for i, d in enumerate(WEEKS)],
            "snapshot": {"phase": {"kr": "한국 인상 국면 · 시장은 1년 내 인상 약 2.9회 반영", "us": "미국 동결 국면"},
                         "implied": {"kr": {"moves": 2.9, "label": "1년 내 인상 약 2.9회 반영"}, "us": None},
                         "us10y": {"value": 5.24, "pct10y": 100},
                         "kr_base": {"value": 3.0, "next_meeting": {"date": "2026-10-22", "d_day": 20}},
                         "us_policy": {"upper": 4.0, "next_meeting": {"date": "2026-10-28", "d_day": 26}}},
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
    assert tones == {"한국 금리": 1, "미국 금리": 0, "달러": 1, "원화": 1, "KOSPI": -1, "S&P500": 1}


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


def test_timeline_lanes_and_scenarios():
    out = build_overview(_fx(), _rates(), _stocks(), TODAY)
    lanes = {l["key"]: l for l in out["timeline"]["lanes"]}
    assert lanes["rates"]["segments"][0]["summary"] == "2.50→3.00% (+50bp)"
    assert lanes["fx"]["segments"][0]["summary"] == "1,556→1,345원 (-13.6%)"
    assert lanes["kospi"]["segments"][0]["summary"] == "9,052→7,004 (-22.6%)"
    assert out["scenarios"]["bok"]["meeting"]["d_day"] == 20 and len(out["timeline"]["series"]) > 1000
    assert "인상" in comment_prompt(out)


def test_missing_tabs_degrade():
    out = build_overview(None, None, _stocks(), TODAY)
    assert out["diagnosis"]["rows"][0]["status"] == "데이터 없음"
    assert out["correlation"] is None or len(out["correlation"]["assets"]) <= 3
    assert {a["asset"] for a in out["allocation"]} == {"주식", "채권", "달러", "현금·단기"}
