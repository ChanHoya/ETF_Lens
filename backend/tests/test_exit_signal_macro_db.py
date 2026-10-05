import pytest
import pytest_asyncio
from unittest.mock import AsyncMock, patch, MagicMock
from datetime import datetime, timedelta, timezone as _tz
from sqlalchemy.ext.asyncio import create_async_engine, AsyncSession, async_sessionmaker

from db.database import Base
from db.models import MarketMacroLog, ExitSignalCache, MarketSentimentLog, USMacroIndicatorLog
from api.exit_signal import (
    get_cached_market_macro_series,
    sync_market_macro_indicators_job,
    seed_market_macro_db_if_empty,
    get_exit_signal_data,
    _KST,
)


@pytest.fixture
def test_engine():
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


@pytest.mark.asyncio
async def test_get_cached_market_macro_series(async_db):
    """DB에 저장된 MarketMacroLog 시계열이 딕셔너리로 정상 로드되는지 검증"""
    async_db.add_all([
        MarketMacroLog(date="2026-10-01", dollar_index=102.5, krw=1330.0, t10y2y=0.15, hy_spread=3.2),
        MarketMacroLog(date="2026-10-02", dollar_index=103.0, krw=1335.0, t10y2y=0.18, hy_spread=3.1),
    ])
    await async_db.commit()

    with patch("db.database.AsyncSessionLocal", return_value=async_db):
        dx, krw, t10y, hy = await get_cached_market_macro_series(days=10)

        assert "2026-10-01" in dx
        assert dx["2026-10-01"] == 102.5
        assert krw["2026-10-02"] == 1335.0
        assert t10y["2026-10-02"] == 0.18
        assert hy["2026-10-01"] == 3.2


@pytest.mark.asyncio
async def test_sync_market_macro_indicators_job(async_db):
    """외부 FRED 및 Yahoo 소스로부터 수집된 데이터가 MarketMacroLog에 정상 적재되는지 검증"""
    mock_dx = {"2026-10-03": 103.5}
    mock_krw = {"2026-10-03": 1340.0}
    mock_t10y = {"2026-10-03": 0.20}
    mock_hy = {"2026-10-03": 3.0}

    with patch("db.database.AsyncSessionLocal", return_value=async_db), \
         patch("api.exit_signal._fetch_fred_series", new_callable=AsyncMock) as mock_fred, \
         patch("api.exit_signal._fetch_yahoo_v8", new_callable=AsyncMock) as mock_yahoo:
        
        mock_fred.side_effect = lambda sym, days: mock_dx if sym == "DTWEXBGS" else (mock_t10y if sym == "T10Y2Y" else mock_hy)
        mock_yahoo.return_value = mock_krw

        success = await sync_market_macro_indicators_job(force_days=10)
        assert success is True

        # DB 검증
        from sqlalchemy import select
        res = await async_db.execute(select(MarketMacroLog).where(MarketMacroLog.date == "2026-10-03"))
        row = res.scalar()
        assert row is not None
        assert row.dollar_index == 103.5
        assert row.krw == 1340.0
        assert row.t10y2y == 0.20
        assert row.hy_spread == 3.0
