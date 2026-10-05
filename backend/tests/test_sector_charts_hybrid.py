import pytest
import pytest_asyncio
from unittest.mock import AsyncMock, patch
import pandas as pd
from sqlalchemy.ext.asyncio import create_async_engine, AsyncSession, async_sessionmaker

from db.database import Base
from db.models import ETFDailyPrice, BenchmarkPrice, ETFMaster
from api.router import get_semi_chart_data, get_space_chart_data, get_energy_chart_data, get_bio_chart_data, get_semiparts_chart_data


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
async def test_sector_charts_hybrid_integration(async_db):
    """5대 섹터 차트 엔드포인트가 하이브리드 엔진을 통해 정상적으로 차트 데이터를 반환하는지 통합 검증"""
    # 더미 데이터 모의 (모든 티커에 대해 3일치 시계열 반환)
    dummy_dates = pd.to_datetime(["2026-10-01", "2026-10-02", "2026-10-05"])
    dummy_series = pd.Series([10000.0, 10200.0, 10500.0], index=dummy_dates)

    with patch("core.hybrid_series.get_hybrid_series_as_pd_series", new_callable=AsyncMock) as mock_hybrid:
        mock_hybrid.return_value = dummy_series

        # 1. Semi Chart
        res_semi = await get_semi_chart_data(etf=None, db=async_db)
        assert "line_chart_data" in res_semi
        assert "keys" in res_semi
        assert len(res_semi["line_chart_data"]) > 0

        # 2. Space Chart
        res_space = await get_space_chart_data(etf=None, db=async_db)
        assert "line_chart_data" in res_space
        assert len(res_space["line_chart_data"]) > 0

        # 3. Energy Chart
        res_energy = await get_energy_chart_data(etf=None, db=async_db)
        assert "line_chart_data" in res_energy
        assert len(res_energy["line_chart_data"]) > 0

        # 4. Bio Chart
        res_bio = await get_bio_chart_data(etf=None, db=async_db)
        assert "line_chart_data" in res_bio
        assert len(res_bio["line_chart_data"]) > 0

        # 5. Semi-parts Chart
        res_parts = await get_semiparts_chart_data(etf=None, db=async_db)
        assert "line_chart_data" in res_parts
        assert len(res_parts["line_chart_data"]) > 0
