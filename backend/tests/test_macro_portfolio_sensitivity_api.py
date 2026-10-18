import pytest
from httpx import AsyncClient, ASGITransport
from main import app

@pytest.mark.asyncio
async def test_get_macro_portfolio_sensitivity():
    transport = ASGITransport(app=app)
    async with AsyncClient(transport=transport, base_url="http://test") as client:
        res = await client.get("/api/v1/macro/portfolio-sensitivity")
        assert res.status_code == 200
        data = res.json()
        assert "total_eval" in data
        assert "usd_exposure_ratio" in data
        assert "krw_exposure_ratio" in data
        assert "scenario_results" in data
        assert len(data["scenario_results"]) >= 4
        assert "top_fx_beneficiaries" in data
        assert "shield_stance" in data
