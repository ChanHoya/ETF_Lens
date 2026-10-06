# 금리 탭 계산 로직 단위 테스트 — 네트워크 없이 가짜 시계열로 검증
from datetime import date, timedelta

import pandas as pd

from api.rates_dashboard import (REGIMES, _changes, _implied, _last_change, _yoy, build_overview, curve_shape,
                                 inversion_episodes, recession_periods)

TODAY = date(2026, 10, 5)


def _daily(start: date, end: date, fn):
    out, d = {}, start
    while d <= end:
        if d.weekday() < 5:
            out[d.isoformat()] = fn(d)
        d += timedelta(days=1)
    return out


def _s(d: dict) -> pd.Series:
    s = pd.Series(d, dtype=float)
    s.index = pd.to_datetime(s.index)
    return s.sort_index()


def _base_rate(d: date) -> float:
    """실제와 같은 모양의 계단: 2025-05-29 2.75→2.50 인하, 2026-07-16 2.75 → 2026-08-27 3.00 인상."""
    if d >= date(2026, 8, 27):
        return 3.0
    if d >= date(2026, 7, 16):
        return 2.75
    if d >= date(2025, 5, 29):
        return 2.5
    return 2.75


def test_last_change_and_implied_moves():
    s = _s(_daily(date(2026, 1, 1), date(2026, 10, 2), _base_rate))
    assert _last_change(s) == {"date": "2026-08-27", "from": 2.75, "to": 3.0, "bp": 25.0}
    ch = _changes(s)  # 종합 탭 회의 결과 판정용 — 오래된 순, 마지막은 last_change와 같다
    assert ch[-1] == _last_change(s) and [c["date"] for c in ch] == sorted(c["date"] for c in ch)
    assert _implied(3.73, 3.0) == {"gap": 0.73, "moves": 2.9, "label": "1년 내 인상 약 2.9회 반영"}
    assert _implied(2.6, 3.0)["label"] == "1년 내 인하 약 1.6회 반영"
    assert _implied(3.05, 3.0)["label"] == "동결 예상"


def test_curve_shape_classification():
    idx = sorted(_daily(date(2026, 8, 1), date(2026, 10, 2), lambda d: 0))

    def ramp(total_bp):  # 8/1~10/2 동안 total_bp 만큼 선형 변화
        return _s({k: 4 + total_bp / 100 * i / (len(idx) - 1) for i, k in enumerate(idx)})
    assert curve_shape(ramp(20), ramp(60))["name"] == "베어 스티프닝"
    assert curve_shape(ramp(-60), ramp(-20))["name"] == "불 스티프닝"
    assert curve_shape(ramp(60), ramp(20))["name"] == "베어 플래트닝"
    assert curve_shape(ramp(-20), ramp(-60))["name"] == "불 플래트닝"
    assert curve_shape(ramp(30), ramp(32))["name"] == "기울기 유지"


def test_yoy_uses_calendar_month_not_row_offset():
    # 2025-10이 비어 있어도(셧다운) 2026-08은 12행 전(2025-07)이 아니라 2025-08과 비교해야 한다
    months = [m for m in pd.date_range("2025-01-01", "2026-08-01", freq="MS") if m != pd.Timestamp("2025-10-01")]
    s = pd.Series(100.0, index=months)
    s[pd.Timestamp("2025-07-01")] = 90.0
    s[pd.Timestamp("2026-08-01")] = 103.4
    assert round(_yoy(s)[pd.Timestamp("2026-08-01")], 1) == 3.4


def test_recession_and_inversion_attribution():
    usrec = _s({f"{y}-{m:02d}-01": (1.0 if (y == 2001 and 4 <= m <= 11) else 0.0)
                for y in range(1997, 2004) for m in range(1, 13)})
    recs = recession_periods(usrec)
    assert recs == [{"start": "2001-04-01", "end": "2001-12-01"}]

    # 1998년 짧은 역전(거짓 신호)과 2000년 역전 — 침체는 직전 역전(2000)에만 연결
    def sp(d):
        if date(1998, 5, 1) <= d <= date(1998, 7, 15) or date(2000, 2, 1) <= d <= date(2000, 12, 20):
            return -0.3
        return 0.5
    eps = inversion_episodes(_s(_daily(date(1997, 1, 1), date(2003, 12, 31), sp)), recs, TODAY)
    assert [(e["start"][:7], e["status"], e["lead_months"]) for e in eps] == [
        ("1998-05", "no_recession", None), ("2000-02", "recession", 14)]
    # 침체 구간이 데이터 첫 달부터 이어지면 시작일을 알 수 없어 제외
    assert recession_periods(_s({"1981-11-01": 1.0, "1981-12-01": 1.0, "1982-01-01": 0.0})) == []


def test_recent_inversion_is_watching_until_window_passes():
    eps = inversion_episodes(_s(_daily(date(2025, 1, 1), date(2026, 9, 30),
                                       lambda d: -0.2 if date(2025, 3, 1) <= d <= date(2025, 9, 1) else 0.3)),
                             [], TODAY)
    assert eps[0]["status"] == "watching"


def test_overview_snapshot_spreads_and_regimes():
    s, e = date(2005, 1, 1), date(2026, 10, 2)
    raw = {
        "kr_base": _daily(s, e, _base_rate),
        "kr1y": _daily(s, e, lambda d: 3.73), "kr3y": _daily(s, e, lambda d: 3.94), "kr10y": _daily(s, e, lambda d: 4.37),
        "fed_upper": _daily(date(2008, 12, 16), e, lambda d: 4.0 if d >= date(2026, 9, 17) else 3.75),
        "fed_target": _daily(s, date(2008, 12, 15), lambda d: 1.0),
        "fed_eff": _daily(s, e, lambda d: 3.88), "us1y": _daily(s, e, lambda d: 4.44),
        "us2y": _daily(s, e, lambda d: 4.78), "us3y": _daily(s, e, lambda d: 4.91), "us10y": _daily(s, e, lambda d: 5.24),
        "us_10_2": _daily(s, e, lambda d: 0.45), "us_10_3m": _daily(s, e, lambda d: 1.07),
    }
    out = build_overview(raw, TODAY)
    snap = out["snapshot"]
    assert snap["kr_base"]["next_meeting"] == {"date": "2026-10-22", "d_day": 17}
    assert snap["us_policy"]["lower"] == 3.75 and snap["us_policy"]["last_change"]["date"] == "2026-09-17"
    assert snap["policy_gap"] == -1.0
    assert snap["implied"]["kr"]["moves"] == 2.9 and snap["implied"]["us"]["moves"] == 2.2
    assert snap["phase"]["kr"].startswith("한국 인상 국면")
    assert out["spreads"]["kr_10_3"]["value"] == 0.43 and not out["spreads"]["kr_10_3"]["inverted"]
    # 한·미 같은 기준(10년−3년) + 미국 10년−3개월은 참고, 10년−2년은 화면 비교에서 제외
    sp = out["spreads"]
    assert list(sp) == ["kr_10_3", "us_10_3", "us_10_3m"] and sp["us_10_3"]["value"] == 0.33
    assert sp["us_10_3"]["basis"] == "common" and sp["us_10_3m"]["basis"] == "reference"
    assert out["weekly"][-1]["us_10_3"] == 0.33 and "3년" in [p["tenor"] for p in out["curves"]["us"]["now"]]
    assert out["weekly"][-1]["date"] <= TODAY.isoformat()
    last = out["regimes"][-1]
    assert (last["kind"], last["from"], last["to"], last["changes"]) == ("hike", 2.5, 3.0, 2)
    hold = next(r for r in out["regimes"] if r["start"] == "2025-05-29" and r["kind"] == "hold")
    assert (hold["from"], hold["to"], hold["changes"]) == (2.5, 2.5, 0)


def test_missing_ecos_degrades_to_us_only():
    s, e = date(2005, 1, 1), date(2026, 10, 2)
    out = build_overview({"fed_upper": _daily(date(2008, 12, 16), e, lambda d: 4.0),
                          "us2y": _daily(s, e, lambda d: 4.78), "us10y": _daily(s, e, lambda d: 5.24)}, TODAY)
    assert "kr_base" not in out["snapshot"] and out["snapshot"]["implied"]["kr"] is None
    assert out["snapshot"]["phase"]["kr"] is None and out["regimes"] == []
    assert "us_policy" in out["snapshot"] and out["weekly"]
    assert len(REGIMES) >= 15


def test_term_compare_buckets_premium_and_insights():
    from api.rates_dashboard import term_compare
    s, e = date(2024, 1, 1), date(2026, 10, 2)
    year_ago = date(2025, 10, 2)
    up = lambda now, before: (lambda d: now if d > year_ago else before)  # noqa: E731
    S = {k: _s(_daily(s, e, f)) for k, f in {
        "kr1y": up(3.73, 2.31), "kr10y": up(4.37, 2.96), "kr30y": up(4.50, 2.82), "kr50y": up(4.49, 2.80),
        "us1y": up(4.44, 3.62), "us10y": up(5.24, 4.12), "us30y": up(5.61, 4.72)}.items()}
    t = term_compare(lambda k: S.get(k, pd.Series(dtype=float, index=pd.DatetimeIndex([]))))
    by = {r["key"]: r for r in t["rows"]}
    assert (by["short"]["gap"], by["long"]["gap"], by["ultra"]["gap"]) == (-0.71, -0.87, -1.11)
    assert by["ultra"]["kr_chg_1y"] == 168.0
    assert t["premium"]["kr"] == {"now": 0.13, "y1": -0.14} and t["premium"]["us"]["now"] == 0.37
    assert t["kr50y"]["value"] == 4.49
    text = " ".join(t["insights"])
    assert "만기가 길수록 격차가 커져" in text
    assert "미국 초장기 프리미엄" in text and "한국 30년−10년 +0.13%p로 평탄" in text
    assert "한국 최근 1년 금리는 30년물이 가장 크게 올라(+168bp) 기간 프리미엄이 이끈 상승" in text
    assert "좁혀져 원화 약세 압력이 줄었습니다" in text
