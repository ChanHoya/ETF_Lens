import pytest
import time
from unittest.mock import patch, AsyncMock
import pandas as pd
from api.backtest import (
    HoldingItem,
    BacktestRequest,
    _make_backtest_cache_key,
    _BACKTEST_CACHE,
    run_backtest,
    load_backtest_close_prices,
)

@pytest.mark.asyncio
async def test_backtest_cache_key_consistency():
    """종목 순서가 바뀌어도 비중이 같으면 동일한 캐시 키가 생성되는지 검증"""
    h1 = [
        HoldingItem(code="069500", amount=5000000, name="KODEX 200"),
        HoldingItem(code="379800", amount=5000000, name="TIGER 미국S&P500"),
    ]
    h2 = [
        HoldingItem(code="379800", amount=5000000, name="TIGER 미국S&P500"),
        HoldingItem(code="069500", amount=5000000, name="KODEX 200"),
    ]
    
    key1 = _make_backtest_cache_key(h1)
    key2 = _make_backtest_cache_key(h2)
    assert key1 == key2, "정렬 순서가 달라도 동일한 캐시 키가 생성되어야 함"

    # 비중이 달라지면 다른 키가 생성되어야 함
    h3 = [
        HoldingItem(code="069500", amount=7000000, name="KODEX 200"),
        HoldingItem(code="379800", amount=3000000, name="TIGER 미국S&P500"),
    ]
    key3 = _make_backtest_cache_key(h3)
    assert key1 != key3, "비중이 다르면 캐시 키가 달라져야 함"


@pytest.mark.asyncio
async def test_load_backtest_close_prices_mock():
    """하이브리드 시계열 배치 데이터가 DataFrame으로 정상 조립 및 결측 처리되는지 검증"""
    mock_dates = [f"2023-01-{i:02d}" for i in range(1, 21)]
    mock_batch = {
        "069500.KS": {
            "dates": mock_dates,
            "prices": [30000.0 + i * 50 for i in range(20)],
            "last_price": 31000.0,
            "source": "db_hit"
        },
        "^KS11": {
            "dates": mock_dates,
            "prices": [2500.0 + i * 10 for i in range(20)],
            "last_price": 2700.0,
            "source": "db_hit"
        }
    }

    with patch("api.backtest.get_hybrid_daily_prices_batch", new_callable=AsyncMock) as mock_get:
        mock_get.return_value = mock_batch
        df = await load_backtest_close_prices(["069500.KS", "^KS11"], db=None, days=365)
        
        assert not df.empty
        assert "069500.KS" in df.columns
        assert "^KS11" in df.columns
        assert len(df) == 20


@pytest.mark.asyncio
async def test_run_backtest_caching_lifecycle():
    """백테스트 1회차 연산 및 2회차 인메모리 캐시 히트 라이프사이클 검증"""
    _BACKTEST_CACHE.clear()

    # 모의 10년치 일봉 데이터 생성 (현재 시점 기준 2600 거래일 = 약 10년)
    now_ts = pd.Timestamp.now()
    dates = pd.date_range(end=now_ts, periods=2600, freq="B")
    mock_prices = pd.DataFrame(
        {
            "069500.KS": [30000.0 * (1 + 0.0002 * i) for i in range(2600)],
            "^KS11": [2500.0 * (1 + 0.0001 * i) for i in range(2600)],
            "^KQ11": [800.0 * (1 + 0.0001 * i) for i in range(2600)],
            "^GSPC": [4000.0 * (1 + 0.0002 * i) for i in range(2600)],
            "^IXIC": [12000.0 * (1 + 0.0003 * i) for i in range(2600)],
        },
        index=dates
    )

    req = BacktestRequest(
        holdings=[
            HoldingItem(code="069500", amount=10000000, name="KODEX 200", category="국내시장대표")
        ]
    )

    with patch("api.backtest.load_backtest_close_prices", new_callable=AsyncMock) as mock_load:
        mock_load.return_value = mock_prices

        # 1회차 실행: 계산 수행 및 cached=False
        t0 = time.time()
        res1 = await run_backtest(req, db=None)
        t_first = time.time() - t0
        
        assert res1["status"] == "success"
        assert res1["cached"] is False
        assert "Portfolio" in res1["results"]["1Y"]
        assert mock_load.call_count == 1

        # 2회차 실행: 인메모리 캐시 히트 검증 (load_backtest_close_prices 호출 안 됨)
        t1 = time.time()
        res2 = await run_backtest(req, db=None)
        t_second = time.time() - t1
        
        assert res2["status"] == "success"
        assert res2["cached"] is True
        assert mock_load.call_count == 1, "캐시 히트 시 데이터베이스나 시계열 로더를 호출하지 않아야 함"
        assert t_second < t_first + 0.05, "캐시 히트 응답은 초고속(0.01s 미만)이어야 함"
        assert res1["results"] == res2["results"]
