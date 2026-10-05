import pytest
import asyncio
import time
from unittest.mock import patch, MagicMock
from db.database import engine, Base, AsyncSessionLocal
from db.models import ETFDividendSummary
from api.dividends import get_portfolio_cashflow, PortfolioCashflowRequest, PortfolioHoldingItem, _CASHFLOW_CACHE
from api.router import compare_etfs, CompareRequest, _COMPARE_CACHE


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
            
        async with AsyncSessionLocal() as db:
            # Mock ETFDividendSummary (격리된 테스트 코드 사용)
            d1 = ETFDividendSummary(
                code="MOCK_DIV1",
                name="KODEX 200 Mock",
                dividend_frequency="QUARTERLY",
                dividend_yield_ttm=2.1,
                last_dividend_amount=250.0,
                annual_dividend_amount=1000.0,
                dividend_months="1,4,7,10",
                currency="KRW",
            )
            d2 = ETFDividendSummary(
                code="MOCK_DIV2",
                name="ACE 미국배당다우존스 Mock",
                dividend_frequency="MONTHLY",
                dividend_yield_ttm=3.8,
                last_dividend_amount=35.0,
                annual_dividend_amount=420.0,
                dividend_months="1,2,3,4,5,6,7,8,9,10,11,12",
                currency="KRW",
            )
            await db.merge(d1)
            await db.merge(d2)
            await db.commit()

    event_loop.run_until_complete(_setup_db())


@pytest.mark.asyncio
async def test_portfolio_cashflow_batch_db():
    async with AsyncSessionLocal() as db:
        _CASHFLOW_CACHE.clear()
        
        req = PortfolioCashflowRequest(
            holdings=[
                PortfolioHoldingItem(code="MOCK_DIV1", shares=100, name="KODEX 200 Mock"),
                PortfolioHoldingItem(code="MOCK_DIV2", shares=200, name="ACE 미국배당다우존스 Mock"),
            ]
        )
        
        # 1차 호출 (DB 1회 일괄 쿼리 수행)
        t0 = time.time()
        res1 = await get_portfolio_cashflow(req, db=db)
        duration1 = time.time() - t0
        
        assert res1["status"] == "success"
        assert res1["total_annual_krw"] > 0
        assert len(res1["monthly_cashflow_krw"]) == 12
        assert len(res1["holdings"]) == 2
        # KODEX 200: 250원 * 100주 * 4회 = 100,000원
        # ACE 미국배당다우존스: 35원 * 200주 * 12회 = 84,000원
        assert res1["total_annual_krw"] == pytest.approx(184000.0, abs=1.0)
        
        # 2차 호출 (캐시 히트, 0.05초 미만)
        t1 = time.time()
        res2 = await get_portfolio_cashflow(req, db=db)
        duration2 = time.time() - t1
        
        assert res2 == res1
        assert duration2 < 0.05


@pytest.mark.asyncio
async def test_compare_etfs_caching():
    async with AsyncSessionLocal() as db:
        _COMPARE_CACHE.clear()
        
        req = CompareRequest(
            etf_codes=["069500", "102110"],
            skip_holdings=True,
            skip_chart=True,
        )
        
        # Mock harvester & hybrid helpers to avoid real external network
        dummy_etf = {
            "etf_code": "069500",
            "etf_name": "KODEX 200",
            "market_data": {"price": 35000, "nav": 35100},
            "basic_info": {},
            "historical_data": {"dates": ["2026-10-01", "2026-10-02"], "prices": [34800, 35000]},
        }
        dummy_etf2 = {
            "etf_code": "102110",
            "etf_name": "TIGER 200",
            "market_data": {"price": 35050, "nav": 35120},
            "basic_info": {},
            "historical_data": {"dates": ["2026-10-01", "2026-10-02"], "prices": [34850, 35050]},
        }
        
        with patch("api.router.fetch_etf_hybrid") as mock_hybrid, \
             patch("api.router.fetch_naver_live_price", return_value=35000):
            mock_hybrid.side_effect = [dummy_etf, dummy_etf2]
            
            # 1차 호출
            res1 = await compare_etfs(req, db=db)
            assert res1["intent"] == "comparison"
            assert "data_payload" in res1
            
            # 2차 호출 (캐시 히트 검증)
            mock_hybrid.reset_mock()
            res2 = await compare_etfs(req, db=db)
            assert res2 == res1
            # 캐시 히트 시 fetch_etf_hybrid가 호출되지 않아야 함
            mock_hybrid.assert_not_called()
