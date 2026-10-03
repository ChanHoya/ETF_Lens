import pytest
from core.brazil_total_return import TRParams, simulate, bond_price, modified_duration, coupon_per_period

def test_coupon_per_period():
    # NTN-F 10% coupon on 1,000 BRL face value
    c_ntnf = coupon_per_period("ntnf", 10.0)
    expected_semi = 1000.0 * ((1 + 0.10) ** 0.5 - 1)
    assert abs(c_ntnf - expected_semi) < 1e-6
    assert abs(c_ntnf - 48.808848) < 1e-4

    # LTN zero coupon
    c_ltn = coupon_per_period("ltn", 0.0)
    assert c_ltn == 0.0


def test_bond_price_and_duration():
    # At maturity
    p_mat = bond_price(14.0, 0.0, "ntnf", 10.0)
    assert p_mat == 1000.0

    # 7-year NTN-F at 14%
    p_7y = bond_price(14.0, 7.0, "ntnf", 10.0)
    assert 700.0 < p_7y < 1000.0  # Discount bond because yield (14%) > coupon (10%)

    # Duration should be positive and less than maturity
    dur = modified_duration(14.0, 7.0, "ntnf", 10.0)
    assert 3.0 < dur < 7.0


def test_simulate_held_to_maturity():
    p = TRParams(
        invest_krw=10_000_000,
        bond_type="ntnf",
        maturity_years=7.0,
        coupon_rate=10.0,
        entry_yield=14.0,
        exit_yield=14.0,
        holding_years=7.0,
        entry_fx=260.0,
        fx_change_pct=0.0,
        buy_cost_pct=1.0,
        sell_cost_pct=0.0,
        tax_rate_pct=0.0,
    )
    res = simulate(p)
    summary = res["summary"]

    assert summary["held_to_maturity"] is True
    assert summary["krw_profit"] > 0
    assert summary["krw_return_pct"] > 100.0  # Over 7 years at ~14% compound, return exceeds 100%
    assert summary["breakeven_fx"] < 260.0    # Substantial buffer against currency depreciation
    assert summary["breakeven_fx_change_pct"] < -40.0

    # Matrix should be 7x6
    matrix = res["matrix"]
    assert len(matrix["yield_offsets_bp"]) == 7
    assert len(matrix["fx_changes_pct"]) == 6
    assert len(matrix["rows"]) == 7


def test_simulate_early_exit_capital_gain():
    # Yield drops from 14% to 11% (-300bp) in 3 years -> substantial capital gain
    p = TRParams(
        invest_krw=10_000_000,
        bond_type="ntnf",
        maturity_years=10.0,
        coupon_rate=10.0,
        entry_yield=14.0,
        exit_yield=11.0,
        holding_years=3.0,
        entry_fx=260.0,
        fx_change_pct=0.0,
        buy_cost_pct=1.0,
        sell_cost_pct=0.5,
        tax_rate_pct=0.0,
    )
    res = simulate(p)
    summary = res["summary"]
    breakdown = res["breakdown"]

    assert summary["held_to_maturity"] is False
    assert breakdown["capital"] > 0           # Positive capital gain
    assert summary["krw_cagr_pct"] > 14.0     # CAGR higher than coupon due to capital gain


def test_simulate_ltn_discount():
    p = TRParams(
        invest_krw=10_000_000,
        bond_type="ltn",
        maturity_years=2.0,
        coupon_rate=0.0,
        entry_yield=13.5,
        exit_yield=13.5,
        holding_years=2.0,
        entry_fx=260.0,
        fx_change_pct=0.0,
        buy_cost_pct=0.8,
        sell_cost_pct=0.0,
        tax_rate_pct=0.0,
    )
    res = simulate(p)
    summary = res["summary"]
    breakdown = res["breakdown"]

    assert summary["coupon_count"] == 0
    assert breakdown["coupon"] == 0
    assert summary["krw_profit"] > 0
    assert 20.0 < summary["krw_return_pct"] < 35.0  # Approx (1.135)^2 - 1 ~ 28.8%
