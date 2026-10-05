import pytest
import asyncio
from datetime import datetime, timedelta
from unittest.mock import patch, AsyncMock
from db.database import engine, Base, AsyncSessionLocal
from db.models import ETFDividendSummary
from api.my_assets import record_daily_asset_snapshot_job
from core.dividend_scraper import refresh_stale_dividends_job
from core.scheduler import scheduler


@pytest.fixture(scope="session")
def event_loop():
    loop = asyncio.new_event_loop()
    yield loop
    loop.close()


@pytest.fixture(autouse=True, scope="module")
def setup_db(event_loop):
    async def _setup_db():
        async with engine.begin() as conn:
            await conn.run_sync(Base.metadata.create_all)
    event_loop.run_until_complete(_setup_db())
    yield


@pytest.mark.asyncio
async def test_scheduler_jobs_registered():
    """스케줄러 시작 시 신규 등록된 잡 ID가 정상 존재하는지 확인."""
    from core.scheduler import setup_scheduler
    
    with patch.object(scheduler, "start"):
        setup_scheduler()
    
    job_ids = [j.id for j in scheduler.get_jobs()]
    assert "market_close_asset_snapshot" in job_ids, "market_close_asset_snapshot job must be registered"
    assert "weekly_dividend_refresh" in job_ids, "weekly_dividend_refresh job must be registered"


@pytest.mark.asyncio
async def test_record_daily_asset_snapshot_job():
    """장 마감 일일 스냅샷 잡의 정상 동작 검증."""
    mock_res = {
        "aggregated_summary": {
            "total_asset": 125000000,
            "total_profit": 15000000,
            "total_return_pct": 13.6,
        }
    }
    with patch("api.my_assets.get_my_portfolio", new_callable=AsyncMock) as mock_get_portfolio:
        mock_get_portfolio.return_value = mock_res
        success = await record_daily_asset_snapshot_job()
        assert success is True
        mock_get_portfolio.assert_awaited_once()


@pytest.mark.asyncio
async def test_refresh_stale_dividends_job():
    """14일 경과된 배당 데이터의 자동 stale 감지 및 재스크래핑 갱신 검증."""
    code = "999999"
    async with AsyncSessionLocal() as db:
        # 20일 전 레코드 삽입
        old_time = datetime.utcnow() - timedelta(days=20)
        summary = ETFDividendSummary(
            code=code,
            name="Stale Test ETF",
            dividend_frequency="MONTHLY",
            dividend_yield_ttm=5.0,
            updated_at=old_time,
        )
        await db.merge(summary)
        await db.commit()

    with patch("core.dividend_scraper.scrape_and_save_etf_dividend", new_callable=AsyncMock) as mock_scrape:
        mock_scrape.return_value = {"code": code, "status": "ok"}
        refreshed = await refresh_stale_dividends_job(limit=10)
        
        # 999999 코드가 stale 항목으로 감지되어 scrape_and_save_etf_dividend가 호출되어야 함
        assert refreshed >= 1
        mock_scrape.assert_awaited()
