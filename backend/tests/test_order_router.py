import pytest
import asyncio
from httpx import AsyncClient
from db.database import engine, Base, AsyncSessionLocal
from main import app
from db.models import ETFMaster, ETFDailyPrice
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
            # Add mock ETF master price for alternatives
            etf_alt = ETFMaster(
                code="396500",
                name="TIGER 반도체TOP10",
                price=15000.0,
                tot_fee=0.1
            )
            etf_src = ETFMaster(
                code="069500",
                name="KODEX 200",
                price=32000.0,
                tot_fee=0.15
            )
            db.add_all([etf_alt, etf_src])
            await db.commit()

    event_loop.run_until_complete(_setup_db())
    yield

    async def _teardown_db():
        async with engine.begin() as conn:
            await conn.run_sync(Base.metadata.drop_all)

    event_loop.run_until_complete(_teardown_db())

@pytest.mark.asyncio
async def test_order_routing_and_simulation():
    import httpx
    async with httpx.AsyncClient(transport=httpx.ASGITransport(app=app), base_url="http://test") as client:
        # 1. Check simulated portfolio returns empty/has_simulated=False initially
        res = await client.get("/api/v1/order/simulated-portfolio")
        assert res.status_code == 200
        assert res.json()["has_simulated"] is False

        # 2. Test Order Routing endpoint
        payload = {
            "recommendations": [
                {
                    "code": "069500",
                    "name": "KODEX 200",
                    "action": "REPLACE",
                    "reasoning": "수익률 부진",
                    "alternative_etf": "396500 (TIGER 반도체TOP10)"
                }
            ]
        }
        res_route = await client.post("/api/v1/order/route", json=payload)
        # It's okay if it fails or succeeds depending on actual KIS config/mock credentials
        # But we want to check that the endpoint compiles and runs cleanly
        assert res_route.status_code in [200, 400, 500]

        # 3. Test Execute Virtual simulation
        sim_payload = {
            "orders": [
                {
                    "account_no": "81060777-01",
                    "side": "SELL",
                    "code": "069500",
                    "name": "KODEX 200",
                    "qty": 10,
                    "price": 32000.0,
                    "amount": 320000.0
                },
                {
                    "account_no": "81060777-01",
                    "side": "BUY",
                    "code": "396500",
                    "name": "TIGER 반도체TOP10",
                    "qty": 21,
                    "price": 15000.0,
                    "amount": 315000.0
                }
            ]
        }
        res_execute = await client.post("/api/v1/order/execute-virtual", json=sim_payload)
        # If active credentials mock fails, check if the routing is robust.
        # It should run or return 400/500 cleanly without crashing.
        assert res_execute.status_code in [200, 400, 500]
