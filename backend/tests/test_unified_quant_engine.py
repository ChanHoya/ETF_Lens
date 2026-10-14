"""Unit tests for UnifiedQuantEngine (Sprint 10: S10-1)"""

import pytest
import numpy as np
import pandas as pd
from datetime import datetime, timedelta, timezone

from core.unified_quant_engine import UnifiedQuantEngine, calculate_mdd, quant_engine


def test_singleton_instance():
    """Verify UnifiedQuantEngine acts as a singleton"""
    e1 = UnifiedQuantEngine()
    e2 = UnifiedQuantEngine()
    assert e1 is e2
    assert quant_engine is e1


def test_normalize_series_index():
    """Verify timezone removal, date normalization, and duplicate dropping"""
    engine = UnifiedQuantEngine()

    # Timezone-aware with timestamps and duplicates
    tz_kst = timezone(timedelta(hours=9))
    dates = [
        datetime(2026, 1, 1, 9, 30, tzinfo=tz_kst),
        datetime(2026, 1, 1, 15, 30, tzinfo=tz_kst),  # duplicate date
        datetime(2026, 1, 2, 10, 0, tzinfo=tz_kst),
    ]
    raw_s = pd.Series([100.0, 105.0, 110.0], index=dates)

    normalized = engine.normalize_series_index(raw_s)

    # Must be tz-naive
    assert normalized.index.tz is None
    # Must have 2 unique dates (duplicate on 1/1 merged keeping last)
    assert len(normalized) == 2
    assert normalized.iloc[0] == 105.0
    assert normalized.iloc[1] == 110.0
    assert normalized.index[0] == pd.Timestamp("2026-01-01")
    assert normalized.index[1] == pd.Timestamp("2026-01-02")


def test_calculate_mdd():
    """Verify maximum drawdown calculation"""
    cum = pd.Series([1.0, 1.2, 0.9, 1.1, 0.8, 1.0])
    # Peak is 1.2, trough is 0.8 -> MDD = (0.8 / 1.2 - 1.0) = -33.333%
    mdd = calculate_mdd(cum)
    assert pytest.approx(mdd, 0.01) == -33.33


def test_calculate_risk_metrics():
    """Verify risk metrics calculation against known reference values"""
    engine = UnifiedQuantEngine()

    # Synthetic daily returns over 252 trading days (~1 year)
    np.random.seed(42)
    daily_rets = pd.Series(np.random.normal(0.0008, 0.01, 252))
    cum_ret = (1.0 + daily_rets).cumprod()

    metrics = engine.calculate_risk_metrics(daily_rets, cum_ret, rf_annual=3.0)

    assert "return" in metrics
    assert "mdd" in metrics
    assert "volatility" in metrics
    assert "sharpe" in metrics
    assert "sortino" in metrics
    assert "calmar" in metrics
    assert "annualized_return" in metrics
    assert "var_95" in metrics
    assert "var_99" in metrics

    # Volatility should be positive and around 10-20%
    assert 5.0 < metrics["volatility"] < 30.0
    # MDD should be negative
    assert metrics["mdd"] <= 0.0
    # VaR should be positive percentage loss
    assert metrics["var_95"] > 0.0
    assert metrics["var_99"] >= metrics["var_95"]


def test_calculate_risk_metrics_empty():
    """Verify graceful fallback for empty data"""
    engine = UnifiedQuantEngine()
    empty_res = engine.calculate_risk_metrics(pd.Series(dtype=float), pd.Series(dtype=float))
    assert empty_res["return"] == 0.0
    assert empty_res["volatility"] == 0.0
    assert empty_res["sharpe"] == 0.0


def test_calculate_correlation_matrix():
    """Verify correlation matrix output"""
    engine = UnifiedQuantEngine()

    dates = pd.date_range("2026-01-01", periods=100)
    # Perfectly correlated assets
    p1 = pd.Series(np.linspace(100, 200, 100), index=dates)
    p2 = pd.Series(np.linspace(50, 100, 100), index=dates)
    df = pd.DataFrame({"A": p1, "B": p2})

    corr = engine.calculate_correlation_matrix(df)
    assert corr.shape == (2, 2)
    assert pytest.approx(corr.loc["A", "B"], 0.001) == 1.0


def test_calculate_portfolio_returns():
    """Verify portfolio return aggregation with weight normalization"""
    engine = UnifiedQuantEngine()

    dates = pd.date_range("2026-01-01", periods=5)
    prices = pd.DataFrame(
        {
            "A": [100.0, 110.0, 120.0, 110.0, 130.0],
            "B": [100.0, 100.0, 100.0, 100.0, 100.0],
        },
        index=dates,
    )

    # 50:50 allocation
    weights = {"A": 50.0, "B": 50.0}
    daily, cum = engine.calculate_portfolio_returns(weights, prices)

    assert len(daily) == 4  # 5 periods - 1
    assert len(cum) == 4
    # On Day 2, A rose 10%, B rose 0% -> Port rose 5%
    assert pytest.approx(daily.iloc[0], 0.001) == 0.05
    assert pytest.approx(cum.iloc[0], 0.001) == 1.05
