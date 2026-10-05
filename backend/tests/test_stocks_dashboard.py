# 주식 탭 계산 로직(build_overview) 단위 테스트 — 네트워크 없이 가짜 시계열로 검증
from datetime import date, timedelta

from api.stocks_dashboard import build_overview, parse_multpl

TODAY = date(2026, 10, 5)
S0, E0 = date(2006, 10, 2), date(2026, 10, 2)


def _weekly(start: date, end: date, fn):
    out, d = {}, start
    while d <= end:
        out[d.isoformat()] = fn(d)
        d += timedelta(days=7)
    return out


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
    peak = date(2026, 6, 19)

    def kospi(d):  # 2,000 → 2026-06 고점 9,000 → 현재 7,000(고점 대비 −22%)
        if d <= peak:
            return 2000 + 7000 * (d - S0).days / (peak - S0).days
        return 9000 - 2000 * (d - peak).days / (E0 - peak).days
    return {
        "kospi": _weekly(date(2006, 10, 1), E0, kospi),          # 일요일 날짜(한국 시간대 봉)
        "spx": _weekly(S0, E0, lambda d: 1000 * 1.1 ** ((d - S0).days / 365)),
        "ndx": _weekly(S0, E0, lambda d: 2000 * 1.15 ** ((d - S0).days / 365)),
        "krw": _daily(S0, E0, lambda d: 1000.0 if d.year < 2026 else 1400.0),
        "us10": _daily(S0, E0, lambda d: 5.24),
        "pe": _monthly(date(2000, 1, 1), E0, lambda d: 26.34 if d.year == 2026 else 20.0),
        "cape": _monthly(date(2000, 1, 1), E0, lambda d: 41.38 if d.year == 2026 else 25.0),
        "ey": _monthly(date(2000, 1, 1), E0, lambda d: 3.8 if d.year == 2026 else 5.0),
    }


def test_cards_returns_drawdown_and_cagr():
    c = build_overview(_raw(), TODAY)["cards"]
    assert -23 < c["kospi"]["drawdown"] < -20 and c["kospi"]["ath_date"][:7] == "2026-06"  # 주간 표본이라 정확히 −22%는 아님
    assert abs(c["spx"]["cagr10"] - 10.0) < 0.2 and abs(c["spx"]["cagr20"] - 10.0) < 0.2
    assert abs(c["ndx"]["chg_1y"] - 15.0) < 0.5
    assert c["kospi_usd"]["value"] < c["kospi"]["value"]          # 원/달러 1,400 → 달러 환산이 더 낮다
    assert c["spx"]["w52_pos"] == 100 and c["spx"]["drawdown"] == 0.0


def test_us_indices_in_krw_show_fx_effect():
    u = build_overview(_raw(), TODAY)["cards"]["us_krw"]
    # S&P는 달러 기준 사상 최고(0%)지만 원/달러가 1,400 → 1,400 유지라 원화 기준도 고점, 2026년 환율 점프(1,000→1,400) 반영
    assert u["spx"]["dd_usd"] == 0.0 and u["spx"]["dd_krw"] == 0.0 and u["spx"]["fx_effect"] == 0.0
    assert u["spx"]["chg_1y_krw"] > u["spx"]["chg_1y_usd"] + 30   # 1년 새 원화 약세 40%가 원화 수익에 더해짐
    assert u["spx"]["ath_krw_date"][:4] == "2026"


def test_us_indices_krw_drawdown_when_won_strengthens():
    raw = _raw()
    raw["krw"] = _daily(S0, E0, lambda d: 1400.0 if d < date(2026, 7, 1) else 1260.0)  # 마지막 석 달 원화 10% 강세
    u = build_overview(raw, TODAY)["cards"]["us_krw"]["ndx"]
    # 원화 10% 강세 − 같은 기간 나스닥 상승(연 15% → 석 달 약 3.5%) ≈ 원화 기준 고점 대비 −6.6%
    assert u["dd_usd"] == 0.0 and -8 < u["dd_krw"] < -5 and u["fx_effect"] == u["dd_krw"]


def test_weekly_rows_align_indices_with_different_bar_dates():
    rows = build_overview(_raw(), TODAY)["weekly"]
    # KOSPI(일요일 봉)와 S&P(월요일 봉)가 같은 주 행에 함께 들어가야 한다
    both = [r for r in rows if r.get("kospi") is not None and r.get("spx") is not None]
    assert len(both) >= len(rows) - 2
    assert rows[-1]["date"] <= TODAY.isoformat()
    assert all(r["dd_spx"] == 0.0 for r in rows if r.get("dd_spx") is not None)


def test_valuation_erp_and_percentiles():
    v = build_overview(_raw(), TODAY)["valuation"]
    assert v["erp"]["value"] == round(3.8 - 5.24, 2)
    assert v["cape"]["pct20y"] == 100 and v["pe"]["value"] == 26.34
    assert v["rows"][-1]["date"] == "2026-10" and v["rows"][-1]["erp"] == -1.44


def test_regimes_bull_then_open_bear_for_kospi():
    segs = build_overview(_raw(), TODAY)["regimes"]["kospi"]
    assert segs[-1]["kind"] == "bear" and segs[-1]["end"] is None and segs[-1]["auto"]
    assert segs[-1]["title"] == "약세장" and segs[-2]["kind"] == "bull"


def test_parse_multpl_rows():
    html = ('<tr><td class="left">Oct 2, 2026</td><td class="right">&#x2002;26.34</td></tr>'
            '<tr><td class="left">Sep 1, 2026</td><td class="right"><abbr title="Estimate">†</abbr> 26.04</td></tr>')
    assert parse_multpl(html) == {"2026-10-02": 26.34, "2026-09-01": 26.04}


def test_missing_sources_degrade():
    out = build_overview({"spx": _raw()["spx"]}, TODAY)
    assert "spx" in out["cards"] and "kospi" not in out["cards"] and out["valuation"] is None
    assert out["corr_ks"] is None and out["regimes"].keys() == {"spx"}
