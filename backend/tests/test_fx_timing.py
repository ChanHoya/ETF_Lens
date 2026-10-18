import pytest
from httpx import AsyncClient, ASGITransport
from main import app

@pytest.mark.asyncio
async def test_fx_timing_index_endpoint():
    async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as ac:
        response = await ac.get("/api/v1/fx/timing-index")
        assert response.status_code == 200
        data = response.json()
        assert data["status"] == "success"
        
        # USD/KRW 검증
        usd = data["usd_krw"]
        assert "rate" in usd
        assert usd["rate"] > 1000
        assert "overheat_score" in usd
        assert 0 <= usd["overheat_score"] <= 100
        assert "signal" in usd
        assert "recommendation" in usd
        assert "target_hedge_ratio" in usd
        
        # BRL/KRW 검증
        brl = data["brl_krw"]
        assert "rate" in brl
        assert brl["rate"] > 100
        assert "undervalued_score" in brl
        assert 0 <= brl["undervalued_score"] <= 100
        assert "signal" in brl
        assert "carry_margin_bp" in brl
        assert len(brl["split_tranche_guide"]) > 0
        
        # Macro summary
        assert "macro_summary" in data
        assert "verdict" in data["macro_summary"]
