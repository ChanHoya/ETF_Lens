# backend/tests/test_portfolio_xray.py
import pytest
from httpx import AsyncClient, ASGITransport
from main import app
from core.portfolio_xray import portfolio_xray_analyzer


def test_portfolio_xray_analyzer_unit():
    """포트폴리오 X-Ray 엔진의 중복도 및 숨은 실질비용 산출 검증"""
    sample_holdings = [
        {"code": "379800", "name": "TIGER 미국S&P500", "eval_amount": 50000000},
        {"code": "133690", "name": "TIGER 미국나스닥100", "eval_amount": 30000000},
        {"code": "465580", "name": "ACE 미국빅테크TOP7Plus", "eval_amount": 20000000},
    ]

    res = portfolio_xray_analyzer.analyze_portfolio(sample_holdings)
    assert res["total_eval_amount"] == 100000000

    # 1. 중복도 검증: S&P500, 나스닥, 빅테크에 공통으로 들어간 엔비디아/애플/마소 확인
    overlap = res["overlap_analysis"]
    top_stocks = overlap["top_underlying_stocks"]
    assert len(top_stocks) > 0
    stock_names = [s["stock_name"] for s in top_stocks]
    assert any("NVIDIA" in s or "Apple" in s or "Microsoft" in s for s in stock_names)

    # 2. 비용 검증: 공시 TER 대비 실질 TER이 더 크게 계산되는지 확인
    cost = res["cost_analysis"]
    assert cost["weighted_real_ter"] > cost["weighted_stated_ter"]
    assert cost["annual_hidden_cost_won"] > 0
    assert cost["cost_grade"] in ("OPTIMAL", "MODERATE", "HIGH")


@pytest.mark.asyncio
async def test_portfolio_xray_api():
    """포트폴리오 X-Ray API 엔드포인트 동작 검증"""
    async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as ac:
        # POST 방식
        post_res = await ac.post("/api/v1/my/portfolio/xray", json={
            "holdings": [
                {"name": "TIGER 미국S&P500", "eval_amount": 60000000},
                {"name": "SOL 미국배당다우존스", "eval_amount": 40000000}
            ]
        })
        assert post_res.status_code == 200
        data = post_res.json()
        assert "overlap_analysis" in data
        assert "cost_analysis" in data
        assert data["cost_analysis"]["weighted_real_ter"] > 0
