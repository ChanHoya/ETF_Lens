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


@pytest.mark.asyncio
async def test_get_kr_export_by_industry():
    transport = ASGITransport(app=app)
    async with AsyncClient(transport=transport, base_url="http://test") as client:
        # 1. 6대 업종 메타데이터 및 월간 분해 검증
        res = await client.get("/api/v1/exit-signal/macro/kr/export?period=monthly")
        assert res.status_code == 200
        json_data = res.json()
        assert "industries_meta" in json_data
        assert len(json_data["industries_meta"]) == 6
        expected_ids = {"semiconductor", "auto", "petrochem", "machinery", "steel", "bio_battery"}
        assert {item["id"] for item in json_data["industries_meta"]} == expected_ids

        # 최신 월 데이터 검증
        latest = json_data["data"][-1]
        assert "industries" in latest
        for ind_id in expected_ids:
            assert ind_id in latest["industries"]
            assert "amt" in latest["industries"][ind_id]
            assert "share" in latest["industries"][ind_id]
            assert latest["industries"][ind_id]["amt"] > 0

        # 업종 비중 합이 약 100%인지 확인
        total_share = sum(latest["industries"][ind_id]["share"] for ind_id in expected_ids)
        assert 99.0 <= total_share <= 101.0

        # 2. 단일 업종(semiconductor) 필터링 쿼리 검증
        res_semi = await client.get("/api/v1/exit-signal/macro/kr/export?period=monthly&industry=semiconductor")
        assert res_semi.status_code == 200
        json_semi = res_semi.json()
        assert json_semi["industry"] == "semiconductor"
        latest_semi = json_semi["data"][-1]
        assert "selected_industry_amt" in latest_semi
        assert "selected_industry_share" in latest_semi
        assert latest_semi["selected_industry"] == "semiconductor"

