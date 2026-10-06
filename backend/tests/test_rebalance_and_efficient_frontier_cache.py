import pytest
import time
from unittest.mock import patch, AsyncMock
import pandas as pd
from api.backtest import (
    HoldingItem,
    RebalanceBacktestRequest,
    run_rebalance_backtest,
    _REBALANCE_CACHE,
    _make_rebalance_cache_key,
)
from api.efficient_frontier import (
    HoldingItem as EFHoldingItem,
    EfficientFrontierRequest,
    calculate_efficient_frontier,
    _EF_CACHE,
    _make_ef_cache_key,
)

@pytest.mark.asyncio
async def test_rebalance_backtest_caching_lifecycle():
    """리밸런스 백테스트 캐시 1회차 연산 및 2회차 즉시 반환 라이프사이클 검증"""
    _REBALANCE_CACHE.clear()

    # 1년치 일봉 데이터 모의 생성
    now_ts = pd.Timestamp.now()
    dates = pd.date_range(end=now_ts, periods=300, freq="B")
    mock_prices = pd.DataFrame(
        {
            "069500.KS": [30000.0 * (1 + 0.0002 * i) for i in range(300)],
            "272580.KS": [100000.0 * (1 + 0.0001 * i) for i in range(300)],
            "^KS11": [2500.0 * (1 + 0.0001 * i) for i in range(300)],
            "^GSPC": [4000.0 * (1 + 0.0002 * i) for i in range(300)],
        },
        index=dates
    )

    req = RebalanceBacktestRequest(
        holdings=[
            HoldingItem(code="069500", amount=10000000, name="KODEX 200", category="국내시장대표")
        ],
        period="1Y",
        defense_factor=0.5,
        safe_asset_code="272580"
    )

    with patch("api.backtest.load_backtest_close_prices", new_callable=AsyncMock) as mock_load:
        mock_load.return_value = mock_prices

        # 1회차: 계산 실행
        res1 = await run_rebalance_backtest(req, db=None)
        assert res1["status"] == "success"
        assert res1["cached"] is False
        assert "metrics" in res1
        assert mock_load.call_count == 1

        # 2회차: 캐시 히트 (load_backtest_close_prices 미호출)
        t0 = time.time()
        res2 = await run_rebalance_backtest(req, db=None)
        t_elapsed = time.time() - t0

        assert res2["status"] == "success"
        assert res2["cached"] is True
        assert mock_load.call_count == 1, "캐시 히트 시 데이터베이스 또는 로더를 호출하지 않아야 함"
        assert t_elapsed < 0.05, "인메모리 캐시 히트는 0.01초 내외로 완료되어야 함"
        assert res1["metrics"] == res2["metrics"]


@pytest.mark.asyncio
async def test_efficient_frontier_caching_lifecycle():
    """효율적 투자선 캐시 1회차 연산 및 2회차 즉시 반환 검증"""
    _EF_CACHE.clear()

    mock_dates = [f"2023-01-{i:02d}" for i in range(1, 21)]
    mock_batch = {
        "069500.KS": {
            "dates": mock_dates,
            "prices": [30000.0 + i * 50 for i in range(20)],
            "last_price": 31000.0,
            "source": "db_hit"
        },
        "379800.KS": {
            "dates": mock_dates,
            "prices": [15000.0 + i * 30 for i in range(20)],
            "last_price": 15600.0,
            "source": "db_hit"
        }
    }

    req = EfficientFrontierRequest(
        holdings=[
            EFHoldingItem(code="069500", amount=5000000, name="KODEX 200"),
            EFHoldingItem(code="379800", amount=5000000, name="TIGER 미국S&P500"),
        ],
        lookback_years=1.0,
        simulations=500  # 빠른 테스트를 위해 500회 설정
    )

    with patch("api.efficient_frontier.get_hybrid_daily_prices_batch", new_callable=AsyncMock) as mock_batch_get:
        mock_batch_get.return_value = mock_batch

        # 1회차 실행
        res1 = await calculate_efficient_frontier(req, db=None)
        assert res1["status"] == "success"
        assert res1["cached"] is False
        assert "max_sharpe" in res1
        assert mock_batch_get.call_count == 1

        # 2회차 실행: 캐시 히트
        t0 = time.time()
        res2 = await calculate_efficient_frontier(req, db=None)
        t_elapsed = time.time() - t0

        assert res2["status"] == "success"
        assert res2["cached"] is True
        assert mock_batch_get.call_count == 1, "캐시 히트 시 배치 조회를 재호출하지 않아야 함"
        assert t_elapsed < 0.05
        assert res1["max_sharpe"] == res2["max_sharpe"]
