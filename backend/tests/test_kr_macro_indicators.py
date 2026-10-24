# 한국 경기선행지수(순환변동치 및 OECD CLI)와 한국 수출액 시계열 API 검증 테스트
import pytest
import pytest_asyncio
from httpx import AsyncClient, ASGITransport
from main import app
from db.database import engine, Base
import db.models

@pytest_asyncio.fixture(autouse=True)
async def init_db():
    async with engine.begin() as conn:
        await conn.run_sync(Base.metadata.create_all)
    yield


@pytest.mark.asyncio
async def test_get_kr_macro_indicators():
    transport = ASGITransport(app=app)
    async with AsyncClient(transport=transport, base_url="http://test") as client:
        res = await client.get("/api/v1/exit-signal/macro/kr")
        assert res.status_code == 200
        data = res.json()
        assert isinstance(data, list)
        assert len(data) > 0
        latest = data[-1]
        assert "date" in latest
        assert "leading_cycle" in latest
        assert "oecd_cli" in latest


@pytest.mark.asyncio
async def test_get_kr_export_series_periods():
    transport = ASGITransport(app=app)
    async with AsyncClient(transport=transport, base_url="http://test") as client:
        # 1. 월간
        res_m = await client.get("/api/v1/exit-signal/macro/kr/export?period=monthly")
        assert res_m.status_code == 200
        json_m = res_m.json()
        assert json_m["period"] == "monthly"
        assert len(json_m["data"]) > 0
        assert "export_amt" in json_m["data"][-1]

        # 2. 연간
        res_y = await client.get("/api/v1/exit-signal/macro/kr/export?period=yearly")
        assert res_y.status_code == 200
        json_y = res_y.json()
        assert json_y["period"] == "yearly"
        assert len(json_y["data"]) > 0
        assert "export_amt" in json_y["data"][-1]

        # 3. 일별
        res_d = await client.get("/api/v1/exit-signal/macro/kr/export?period=daily")
        assert res_d.status_code == 200
        json_d = res_d.json()
        assert json_d["period"] == "daily"
        assert len(json_d["data"]) > 0
        assert "export_daily_avg" in json_d["data"][-1]
