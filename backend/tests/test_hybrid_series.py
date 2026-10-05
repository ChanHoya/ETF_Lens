import pytest
import pytest_asyncio
from unittest.mock import AsyncMock, patch, MagicMock
from datetime import datetime, timedelta, timezone as _tz
import pandas as pd
from sqlalchemy.ext.asyncio import create_async_engine, AsyncSession, async_sessionmaker
from sqlalchemy.orm import declarative_base

from db.database import Base
from db.models import ETFDailyPrice, BenchmarkPrice, ETFMaster
from core.hybrid_series import (
    _clean_ticker,
    _is_korean_asset,
    _normalize_korean_code,
    get_hybrid_daily_prices,
    get_hybrid_daily_prices_batch,
    _KST,
)


@pytest.fixture
def test_engine():
    # SQLite in-memory engine for async testing
    engine = create_async_engine(
        "sqlite+aiosqlite:///:memory:",
        echo=False,
    )
    return engine


@pytest_asyncio.fixture
async def async_db(test_engine):
    async with test_engine.begin() as conn:
        await conn.run_sync(Base.metadata.create_all)

    session_maker = async_sessionmaker(bind=test_engine, class_=AsyncSession, expire_on_commit=False)
    async with session_maker() as session:
        yield session

    async with test_engine.begin() as conn:
        await conn.run_sync(Base.metadata.drop_all)
    await test_engine.dispose()


def test_ticker_utilities():
    assert _clean_ticker(" 005930.KS \n") == "005930.KS"
    assert _is_korean_asset("005930") is True
    assert _is_korean_asset("005930.KS") is True
    assert _is_korean_asset("058470.KQ") is True
    assert _is_korean_asset("NVDA") is False
    assert _is_korean_asset("^KS11") is False

    assert _normalize_korean_code("005930.KS") == "005930"
    assert _normalize_korean_code("058470.KQ") == "058470"
    assert _normalize_korean_code("NVDA") == "NVDA"


@pytest.mark.asyncio
async def test_get_hybrid_daily_prices_db_hit(async_db):
    """DB에 이미 최신 시계열이 있는 경우 DB에서 즉시 조회되어야 한다."""
    now_kst = datetime.now(_KST)
    yesterday_str = (now_kst - timedelta(days=1)).strftime("%Y-%m-%d")
    prev_str = (now_kst - timedelta(days=2)).strftime("%Y-%m-%d")

    # BenchmarkPrice 에 테스트 데이터 삽입
    async_db.add_all([
        BenchmarkPrice(symbol="NVDA", date=prev_str, close=120.0),
        BenchmarkPrice(symbol="NVDA", date=yesterday_str, close=125.0),
    ])
    await async_db.commit()

    with patch("core.hybrid_series.fetch_live_price", new_callable=AsyncMock) as mock_live:
        mock_live.return_value = 130.0

        res = await get_hybrid_daily_prices("NVDA", async_db, days=10, include_live=True)

        assert res["ticker"] == "NVDA"
        assert res["source"] == "db_hit"
        # 어제/그저께 데이터 + 오늘 실시간 시세
        assert yesterday_str in res["dates"]
        assert prev_str in res["dates"]
        today_str = now_kst.strftime("%Y-%m-%d")
        if now_kst.date().weekday() < 5:
            assert today_str in res["dates"]
            assert res["last_price"] == 130.0


@pytest.mark.asyncio
async def test_get_hybrid_daily_prices_gap_fill(async_db):
    """DB 데이터가 3일 전에서 멈춰있으면 누락된 과거 일자만 증분 수집(Gap-fill)해야 한다."""
    now_kst = datetime.now(_KST)
    old_date_str = (now_kst - timedelta(days=5)).strftime("%Y-%m-%d")
    gap_date_str = (now_kst - timedelta(days=2)).strftime("%Y-%m-%d")

    # DB에 5일 전 데이터 1건만 넣어둠 (10건 이상이어야 gap-fill 모드로 진입하므로 더미 10건 추가)
    init_records = []
    for i in range(15, 4, -1):
        dt = (now_kst - timedelta(days=i)).strftime("%Y-%m-%d")
        init_records.append(BenchmarkPrice(symbol="SMH", date=dt, close=200.0 + i))
    async_db.add_all(init_records)
    await async_db.commit()

    # 모의 gap DataFrame
    mock_df = pd.DataFrame(
        {"Close": [220.0]},
        index=[pd.to_datetime(gap_date_str)],
    )

    with patch("yfinance.download", return_value=mock_df), \
         patch("core.hybrid_series.fetch_live_price", new_callable=AsyncMock) as mock_live:
        mock_live.return_value = 225.0

        res = await get_hybrid_daily_prices("SMH", async_db, days=30, include_live=True)

        assert res["ticker"] == "SMH"
        assert res["source"] == "db_gapfilled"
        assert gap_date_str in res["dates"]

        # DB에 gap_date_str 가 커밋되었는지 검증
        from sqlalchemy import select
        db_rows = (await async_db.execute(
            select(BenchmarkPrice).where(BenchmarkPrice.symbol == "SMH", BenchmarkPrice.date == gap_date_str)
        )).scalars().all()
        assert len(db_rows) == 1
        assert db_rows[0].close == 220.0


@pytest.mark.asyncio
async def test_get_hybrid_daily_prices_batch(async_db):
    """다중 티커 일괄 조회 검증"""
    now_kst = datetime.now(_KST)
    yesterday_str = (now_kst - timedelta(days=1)).strftime("%Y-%m-%d")

    async_db.add_all([
        BenchmarkPrice(symbol="AAPL", date=yesterday_str, close=180.0),
        BenchmarkPrice(symbol="MSFT", date=yesterday_str, close=400.0),
    ])
    await async_db.commit()

    with patch("core.hybrid_series.fetch_live_price", new_callable=AsyncMock) as mock_live:
        mock_live.return_value = None  # 라이브 없이 DB 데이터만 검증

        results = await get_hybrid_daily_prices_batch(["AAPL", "MSFT"], async_db, days=10, include_live=False)

        assert "AAPL" in results
        assert "MSFT" in results
        assert results["AAPL"]["prices"] == [180.0]
        assert results["MSFT"]["prices"] == [400.0]


@pytest.mark.asyncio
async def test_get_hybrid_daily_prices_etf_master(async_db):
    """ETFMaster에 등록된 국내 ETF의 경우 ETFDailyPrice 테이블을 사용해야 한다."""
    now_kst = datetime.now(_KST)
    yesterday_str = (now_kst - timedelta(days=1)).strftime("%Y-%m-%d")

    # ETFMaster & ETFDailyPrice 등록
    async_db.add(ETFMaster(code="396500", name="TIGER 반도체TOP10"))
    await async_db.flush()
    async_db.add(ETFDailyPrice(code="396500", date=yesterday_str, close=15000.0, nav=15010.0, disparity_rate=0.07))
    await async_db.commit()

    with patch("core.hybrid_series.fetch_live_price", new_callable=AsyncMock) as mock_live:
        mock_live.return_value = None

        res = await get_hybrid_daily_prices("396500", async_db, days=10, include_live=False)

        assert res["ticker"] == "396500"
        assert res["source"] == "db_hit"
        assert res["prices"] == [15000.0]
