# 환율 탭 계산 로직(build_overview) 단위 테스트 — 네트워크 없이 가짜 시계열로 검증
import math
from datetime import date, timedelta

from api.fx_dashboard import REGIMES, _hedge_judgment, _verdict, build_overview

TODAY = date(2026, 10, 5)


def _daily(start: date, end: date, fn):
    out, d = {}, start
    while d <= end:
        if d.weekday() < 5:
            out[d.isoformat()] = fn(d)
        d += timedelta(days=1)
    return out


def _monthly(start: date, end: date, fn):
    out, d = {}, start.replace(day=1)
    while d <= end:
        out[d.isoformat()] = fn(d)
        d = (d.replace(day=28) + timedelta(days=4)).replace(day=1)
    return out


def _raw():
    s, e = date(2005, 1, 1), date(2026, 9, 25)
    # 원/달러: 2009-03-02에 최고 1,570, 그 외에는 연도에 따라 1,000→1,400으로 완만히 상승
    krw = _daily(s, e, lambda d: 1570.0 if d == date(2009, 3, 2) else 1000 + (d.year - 2005) * 18)
    return {
        "krw": krw,
        "krw_live": {"2026-09-30": 1360.0, "2026-10-02": 1350.0, "2026-09-20": 9999.0},  # FRED 마지막(9/25) 이전 값은 무시
        "dxy": _daily(s, e, lambda d: 95.0),
        "us10": _daily(s, e, lambda d: 4.5),
        "kr10": _monthly(s, e, lambda d: 3.5),
        "reer": _monthly(s, date(2026, 7, 1), lambda d: 85.0 if d >= date(2026, 1, 1) else 100.0),
        "jpy": _daily(s, e, lambda d: 150.0),
        "cny": _daily(s, e, lambda d: 7.0),
        "dff": _daily(s, e, lambda d: 3.9),
        "kr3m": _monthly(s, e, lambda d: 3.0),
    }


def test_live_quote_extends_fred_tail_only():
    out = build_overview(_raw(), TODAY)
    krw = out["snapshot"]["krw"]
    assert krw["value"] == 1350.0 and krw["date"] == "2026-10-02"
    assert out["weekly"][-1]["krw"] == 1350.0  # 마지막 주(10/2 금)에 실시간 값 반영
    assert 9999.0 not in [r["krw"] for r in out["weekly"]]


def test_weekly_rows_span_twenty_years_with_spread():
    rows = build_overview(_raw(), TODAY)["weekly"]
    assert rows[0]["date"] >= "2006-10-05"
    assert 1000 < len(rows) < 1100
    assert all(r["spread10"] == 1.0 for r in rows if r["spread10"] is not None)  # 4.5 - 3.5 (월간 앞채움)


def test_snapshot_cross_rates_hedge_and_reer():
    snap = build_overview(_raw(), TODAY)["snapshot"]
    fred_last = 1000 + 21 * 18  # 2026년 값 = 1,378
    assert snap["jpy100"]["value"] == round(fred_last / 150 * 100, 2)
    assert snap["cny"]["value"] == round(fred_last / 7, 2)
    assert snap["hedge"]["value"] == 0.9
    assert snap["spread10"]["value"] == 1.0 and snap["spread10"]["year_ago"] == 1.0
    assert snap["reer"]["value"] == 85.0 and snap["reer"]["gap_pct"] < -10


def test_regime_values_come_from_data():
    regimes = build_overview(_raw(), TODAY)["regimes"]
    gfc = next(g for g in regimes if g["title"] == "글로벌 금융위기")
    assert gfc["to"] == 1570.0 and gfc["high"] == 1570.0 and gfc["kind"] == "up"
    recovery = next(g for g in regimes if g["title"] == "위기 후 회복")
    assert recovery["kind"] == "down" and recovery["from"] == 1570.0
    box = next(g for g in regimes if g["title"] == "고금리 박스권")
    assert box["kind"] == "range"
    assert len(regimes) == len(REGIMES)


def test_verdict_weighs_both_sides():
    # 평균 회귀 근거만 있으면 원화 강세 우세
    v = _verdict({"krw": {"pct10y": 85, "pct3y": 90}, "reer": {"gap_pct": -15}}, 6)
    assert v["level"] == "strong_krw" and len(v["strong"]) == 3 and v["weak"] == []
    # 같은 위치라도 3년 기준 중간·상승 추세·자금 순유출·큰 금리차가 있으면 약세 근거가 이긴다
    v = _verdict({"krw": {"pct10y": 75, "pct3y": 40, "ma26_gap": 2.0}, "flows": {"net_12m": -120},
                  "spread10": {"value": 1.2}, "reer": {"gap_pct": -15}}, None)
    assert v["level"] == "weak_krw" and len(v["weak"]) == 4 and len(v["strong"]) == 1
    assert any("새 보통" in t for t in v["weak"])
    assert _verdict({}, None) == {"level": "neutral", "label": "강세·약세 근거 팽팽 — 방향 관망", "strong": [], "weak": []}


def _bop(raw):
    s, e = date(2014, 1, 1), date(2026, 7, 1)
    raw.update(bop_ca=_monthly(s, e, lambda d: 300.0), bop_di_a=_monthly(s, e, lambda d: 100.0),
               bop_pi_a=_monthly(s, e, lambda d: 300.0 if d.year == 2026 else 100.0),
               bop_di_l=_monthly(s, e, lambda d: 20.0), bop_pi_l=_monthly(s, e, lambda d: 30.0))
    return raw


def test_flows_twelve_month_net_in_hundred_million_dollars():
    f = build_overview(_bop(_raw()), TODAY)["snapshot"]["flows"]
    # 2025-08~2026-07: 경상 3,600 − (직접 1,200 + 증권 5×100+7×300=2,600) + (240+360) = 400백만 → 4억달러
    assert f["month"] == "2026-07" and f["ca_12m"] == 36 and f["out_12m"] == 38 and f["in_12m"] == 6 and f["net_12m"] == 4
    assert f["net_year_ago"] == 18 and f["rows"][-1]["out"] == -38   # 차트는 유출을 음수로
    assert f["rows"][0]["date"] >= "2016-07"


def test_krw_three_year_position_and_trend():
    k = build_overview(_raw(), TODAY)["snapshot"]["krw"]
    # 최근 3년 값: 2023년 말 1,324·2024년 1,342(≤1,350) / 2025년 1,360·2026년 1,378(>1,350) → 약 42%
    assert 40 <= k["pct3y"] <= 44 and k["pct10y"] > k["pct3y"]
    assert k["ma26"] is not None and k["ma26_gap"] < 0  # 마지막 실시간 1,350 < 26주 평균


def test_missing_sources_degrade_gracefully():
    out = build_overview({"krw": _raw()["krw"]}, TODAY)
    assert "krw" in out["snapshot"] and "dxy" not in out["snapshot"] and "reer" not in out["snapshot"]
    assert out["weekly"] and out["weekly"][0]["dxy"] is None
    assert out["snapshot"]["verdict"]["level"] == "neutral"


# ── 2단계 분석 블록 ─────────────────────────────────────────────

def _tracking_raw(shock_from: date | None = None, shock: float = 0.0):
    """원/달러 = 14 × DXY (탄력성 1). shock_from 이후에는 원화 고유 약세 shock만큼 더 오른다."""
    s, e = date(2005, 1, 1), date(2026, 9, 25)
    dxy = lambda d: 95 + 10 * math.sin(d.toordinal() / 90)
    krw = lambda d: 14 * dxy(d) * (1 + shock if shock_from and d >= shock_from else 1)
    raw = _raw()
    raw.update(krw=_daily(s, e, krw), dxy=_daily(s, e, dxy), krw_live={},
               vix=_daily(s, e, lambda d: 20 + 5 * math.sin(d.toordinal() / 7)))
    return raw


def test_analysis_tracks_dollar_when_krw_follows_dxy():
    an = build_overview(_tracking_raw(), TODAY)["analysis"]
    assert an["corr_now"]["dxy"] > 0.99
    assert abs(an["fair"]["elasticity"] - 1) < 0.01 and an["fair"]["r2"] > 0.99
    assert abs(an["fair"]["now"]["gap_pct"]) < 0.5
    assert abs(an["beta"]["value"] - 1) < 0.01
    d = an["decomp_1y"]
    assert abs(d["krw_part"]) < 0.5  # 전부 달러 몫
    assert abs(d["dollar_part"] - d["krw_chg"]) < 0.5


def test_analysis_isolates_krw_specific_shock():
    an = build_overview(_tracking_raw(date(2026, 6, 1), 0.10), TODAY)["analysis"]
    assert an["fair"]["now"]["gap_pct"] > 8          # 달러로 설명되지 않는 원화 고유 약세
    assert an["decomp_1y"]["krw_part"] > 8
    assert an["hedge"]["pick"] in ("H", "MIX") and any("원화 고유 약세" in r["text"] for r in an["hedge"]["reasons"])


def test_reer_band_rows_and_stats():
    an = build_overview(_raw(), TODAY)["analysis"]
    assert an["reer"]["rows"][-1] == {"date": "2026-07", "reer": 85.0}
    assert an["reer"]["avg"] > 95 and an["reer"]["std"] > 0


def test_hedge_judgment_scoring():
    assert _hedge_judgment(85, -15, 0.3, 6)["pick"] == "H"
    assert _hedge_judgment(20, 8, 2.0, None)["pick"] == "UH"
    mixed = _hedge_judgment(73, -14, 0.91, 1.0)
    assert mixed["pick"] == "MIX" and mixed["score_h"] == 1
    assert _hedge_judgment(None, None, None, None)["reasons"][0]["side"] == "MIX"
