import pytest
import asyncio
from httpx import AsyncClient
from db.database import engine, Base, AsyncSessionLocal
from main import app
from db.models import ETFMaster
import json


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
            # Insert mock ETF data
            # Use columns: code, name, tot_fee, basic_info_json
            etf1_info = {
                "분배율": 2.0,
                "factor_scores": {"수익성": 80, "배당": 50},
                "holdings": [
                    {"name": "Samsung", "weight": "20.0"},
                    {"name": "Apple", "weight": "10.0"},
                ],
            }
            etf1 = ETFMaster(
                code="123456",
                name="Mock ETF 1",
                tot_fee=0.1,
                basic_info_json=json.dumps(etf1_info),
            )
            etf2_info = {
                "분배율": 1.5,
                "factor_scores": {"수익성": 60, "배당": 70},
                "holdings": [
                    {"name": "Apple", "weight": "30.0"},
                    {"name": "Tesla", "weight": "15.0"},
                ],
            }
            etf2 = ETFMaster(
                code="654321",
                name="Mock ETF 2",
                tot_fee=0.5,
                basic_info_json=json.dumps(etf2_info),
            )
            db.add_all([etf1, etf2])
            await db.commit()

    event_loop.run_until_complete(_setup_db())

    yield

    async def _teardown_db():
        async with engine.begin() as conn:
            await conn.run_sync(Base.metadata.drop_all)

    event_loop.run_until_complete(_teardown_db())


@pytest.mark.asyncio
async def test_portfolio_analyzer():
    from core.portfolio_analyzer import analyze_portfolio

    async with AsyncSessionLocal() as db:
        mock_holdings = [
            {"code": "123456", "name": "Mock ETF 1", "eval_amount": 1000},
            {"code": "654321", "name": "Mock ETF 2", "eval_amount": 2000},
            {
                "code": "999999",
                "name": "Individual Stock",
                "eval_amount": 1000,
            },  # Not an ETF
        ]

        result = await analyze_portfolio(mock_holdings, db)

        assert "factor_balance" in result
        assert "true_holdings_top10" in result

        # Total portfolio eval = 4000
        # ETF1 weight = 1000/4000 = 0.25
        # ETF2 weight = 2000/4000 = 0.50
        # Ind Stock weight = 1000/4000 = 0.25
        # ETF Ratio = 3000/4000 = 0.75

        assert result["metrics"]["etf_ratio"] == 0.75

        # True Holdings Check
        true_holdings_dict = {
            item["name"]: item["weight"] for item in result["true_holdings_top10"]
        }

        # Individual stock should have its full weight (0.25)
        assert abs(true_holdings_dict["Individual Stock"] - 0.25) < 0.001

        # Apple = (ETF1 w * 0.1) + (ETF2 w * 0.3) = (0.25 * 0.1) + (0.50 * 0.3) = 0.025 + 0.15 = 0.175
        assert abs(true_holdings_dict["Apple"] - 0.175) < 0.001
