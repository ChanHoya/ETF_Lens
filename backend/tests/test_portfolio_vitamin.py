import pytest
from httpx import AsyncClient, ASGITransport
from main import app

@pytest.mark.asyncio
async def test_portfolio_vitamin_endpoint():
    async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as ac:
        response = await ac.get("/api/v1/rebalance/portfolio-vitamin")
        assert response.status_code == 200
        data = response.json()
        assert data["status"] == "success"
        
        # 현재 vs 최적화 메트릭 검증
        curr = data["current_metrics"]
        opt = data["optimized_metrics"]
        assert curr["sharpe_ratio"] < opt["sharpe_ratio"]
        assert curr["volatility"] > opt["volatility"]
        
        # 비타민 ETF 3종 검증
        vitamins = data["vitamin_recommendations"]
        assert len(vitamins) == 3
        tickers = [v["ticker"] for v in vitamins]
        assert "411060" in tickers  # 금현물
        assert "449170" in tickers  # KOFR
        assert "453850" in tickers  # 미국배당다우존스(H)
        
        # 효율적 투자선 곡선 검증
        curve = data["efficient_frontier_curve"]
        assert len(curve) >= 5
        assert "ai_commentary" in data
