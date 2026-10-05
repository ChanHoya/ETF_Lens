import pytest
import asyncio
from unittest.mock import patch, MagicMock
from db.database import engine, Base, AsyncSessionLocal
from db.models import SectorLeaderQuant, ETFHoldings
from core.scheduler import scheduler, setup_scheduler
from api.next_leader import get_next_leader_screener
from api.router import get_semi_holdings


@pytest.fixture(scope="session")
def event_loop():
    loop = asyncio.new_event_loop()
    yield loop
    loop.close()


@pytest.fixture(autouse=True, scope="module")
def setup_db(event_loop):
    async def _setup_db():
        from sqlalchemy import select, delete
        async with engine.begin() as conn:
            await conn.run_sync(Base.metadata.create_all)
            
        async with AsyncSessionLocal() as db:
            # 1. Mock SectorLeaderQuant
            item = SectorLeaderQuant(
                sector="조선",
                code="042660",
                name="한화오션",
                weight=15.5,
                rank=1,
                quant_score=88.5,
                out_of_favor_score=80.0,
                fundamental_score=90.0,
                turnaround_score=95.0,
                per=12.5,
                pbr=1.2,
                roe=14.0,
                div_yield=1.5,
                stock_6m_ret=25.0,
                kospi_6m_ret=5.0,
            )
            await db.merge(item)
            
            # 2. Mock ETFHoldings for semi (396500)
            await db.execute(delete(ETFHoldings).where(ETFHoldings.code == "396500"))
            h1 = ETFHoldings(
                code="396500",
                ticker="삼성전자",
                weight=25.0,
            )
            h2 = ETFHoldings(
                code="396500",
                ticker="SK하이닉스",
                weight=25.0,
            )
            db.add_all([h1, h2])
            await db.commit()

    event_loop.run_until_complete(_setup_db())
    yield


@pytest.mark.asyncio
async def test_scheduler_sector_quant_registered():
    """스케줄러에 10대 섹터 퀀트 사전 계산 크론 잡이 등록되어 있는지 검증."""
    with patch.object(scheduler, "start"):
        setup_scheduler()
    job_ids = [j.id for j in scheduler.get_jobs()]
    assert "market_close_sector_quant_sync" in job_ids, "market_close_sector_quant_sync job must be registered"


@pytest.mark.asyncio
async def test_screener_db_fast_retrieval():
    """DB에 사전 계산된 퀀트 결과가 있을 때 0.01초 database_precomputed로 즉시 반환되는지 검증."""
    from api.next_leader import _LEADER_CACHE
    _LEADER_CACHE.pop("screener", None)
    mock_request = MagicMock()
    async with AsyncSessionLocal() as db:
        data = await get_next_leader_screener(request=mock_request, db=db)
        assert data.get("status") == "success"
        assert data.get("source") == "database_precomputed"
        assert "조선" in data.get("sectors", {})
        stocks = data["sectors"]["조선"]
        assert len(stocks) >= 1
        assert stocks[0]["name"] == "한화오션"
        assert stocks[0]["quant_score"] == 88.5


@pytest.mark.asyncio
async def test_sector_holdings_db_priority():
    """semi-holdings 엔드포인트가 DB ETFHoldings를 우선 사용하여 피벗 테이블을 구성하는지 검증."""
    async with AsyncSessionLocal() as db:
        data = await get_semi_holdings(db=db)
        assert "keys" in data
        assert "table_data" in data
        assert len(data["table_data"]) > 0
        constituents = [r["constituent"] for r in data["table_data"]]
        assert "삼성전자" in constituents
        assert "SK하이닉스" in constituents
