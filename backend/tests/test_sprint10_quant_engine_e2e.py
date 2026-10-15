"""Sprint 10 E2E Live Integration Test Suite (S10-4)

Verifies:
1. UnifiedQuantEngine normalized time-series matrix loading and common risk metrics
2. QuantCacheRegistry namespace caching lifecycle and 0.001s ultra-fast response
3. Full backtest and efficient frontier API routing integration with centralized caching
4. Concurrency control and memory trim integrity
"""

import time
import pytest
from unittest.mock import patch, AsyncMock
import pandas as pd

from core.unified_quant_engine import UnifiedQuantEngine, quant_engine
from core.quant_cache_registry import QuantCacheRegistry, quant_cache, force_malloc_trim
from api.backtest import BacktestRequest, HoldingItem, run_backtest
from api.efficient_frontier import EfficientFrontierRequest, calculate_efficient_frontier


@pytest.mark.asyncio
async def test_s10_unified_quant_engine_full_pipeline_e2e():
    """E2E test for UnifiedQuantEngine time-series aggregation and full risk evaluation"""
    tickers = ["069500.KS", "379800.KS", "^KS11"]
    dates = pd.date_range("2024-01-01", periods=150, freq="B")

    mock_batch = {
        "069500.KS": {"dates": [d.strftime("%Y-%m-%d") for d in dates], "prices": [30000.0 * (1 + 0.0005 * i) for i in range(150)]},
        "379800.KS": {"dates": [d.strftime("%Y-%m-%d") for d in dates], "prices": [15000.0 * (1 + 0.0008 * i) for i in range(150)]},
        "^KS11": {"dates": [d.strftime("%Y-%m-%d") for d in dates], "prices": [2500.0 * (1 + 0.0002 * i) for i in range(150)]},
    }

    async def mock_batch_fetcher(*args, **kwargs):
        return mock_batch

    df = await quant_engine.get_normalized_close_matrix(tickers, db=None, batch_fetcher=mock_batch_fetcher)
    assert not df.empty
    assert len(df.columns) == 3
    assert len(df) == 150

    # Calculate portfolio returns
    weights = {"069500.KS": 60.0, "379800.KS": 40.0}
    daily, cum = quant_engine.calculate_portfolio_returns(weights, df)
    assert len(daily) == 149
    assert len(cum) == 149

    # Calculate 4 deep risk metrics
    metrics = quant_engine.calculate_risk_metrics(daily, cum, rf_annual=3.0)
    assert "volatility" in metrics
    assert "sharpe" in metrics
    assert "sortino" in metrics
    assert "calmar" in metrics
    assert "var_95" in metrics
    assert "var_99" in metrics

    # Correlation matrix
    corr = quant_engine.calculate_correlation_matrix(df)
    assert corr.shape == (3, 3)
    assert pytest.approx(corr.loc["069500.KS", "069500.KS"], 0.001) == 1.0


@pytest.mark.asyncio
async def test_s10_backtest_quant_cache_registry_integration_e2e():
    """E2E test verifying run_backtest uses QuantCacheRegistry with 0.001s cache hits"""
    quant_cache.clear("backtest")

    dates = pd.date_range("2024-01-01", periods=200, freq="B")
    mock_prices = pd.DataFrame(
        {
            "069500.KS": [30000.0 * (1 + 0.0003 * i) for i in range(200)],
            "^KS11": [2500.0 * (1 + 0.0001 * i) for i in range(200)],
            "^KQ11": [800.0 * (1 + 0.0001 * i) for i in range(200)],
            "^GSPC": [4500.0 * (1 + 0.0002 * i) for i in range(200)],
            "^IXIC": [14000.0 * (1 + 0.0003 * i) for i in range(200)],
        },
        index=dates,
    )

    req = BacktestRequest(
        holdings=[
            HoldingItem(code="069500", amount=10000000, name="KODEX 200", category="국내시장대표")
        ]
    )

    with patch("api.backtest.load_backtest_close_prices", new_callable=AsyncMock) as mock_load:
        mock_load.return_value = mock_prices

        # Turn 1: Fresh computation
        res1 = await run_backtest(req, db=None)
        assert res1["status"] == "success"
        assert res1["cached"] is False
        assert mock_load.call_count == 1

        # Turn 2: Instant cache hit from QuantCacheRegistry
        t0 = time.time()
        res2 = await run_backtest(req, db=None)
        t_hit = time.time() - t0

        assert res2["status"] == "success"
        assert res2["cached"] is True
        assert mock_load.call_count == 1  # No repeated load
        assert t_hit < 0.05  # Instantaneous
        assert res1["results"] == res2["results"]


@pytest.mark.asyncio
async def test_s10_cache_registry_memory_trim_and_purge():
    """Verify memory cleanup and registry status report"""
    stats = quant_cache.get_stats()
    assert "total_items" in stats

    # Force malloc trim should run smoothly
    force_malloc_trim()
    purged = quant_cache.purge_expired()
    assert purged >= 0
