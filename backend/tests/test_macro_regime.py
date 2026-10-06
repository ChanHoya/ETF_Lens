"""
backend/tests/test_macro_regime.py

매크로 거시경제 4국면 나침반 및 국면 적합도 유닛/통합 테스트
"""

import pytest
from core.macro_regime import MacroRegimeEngine


@pytest.fixture
def anyio_backend():
    return "asyncio"


def test_macro_regime_classification():
    # 1. 골디락스 (성장+, 물가-)
    assert MacroRegimeEngine._classify_regime(30.0, -20.0) == "GOLDILOCKS"
    # 2. 인플레이션 과열 (성장+, 물가+)
    assert MacroRegimeEngine._classify_regime(25.0, 35.0) == "OVERHEAT"
    # 3. 스태그플레이션 (성장-, 물가+)
    assert MacroRegimeEngine._classify_regime(-15.0, 20.0) == "STAGFLATION"
    # 4. 디플레이션 수축 (성장-, 물가-)
    assert MacroRegimeEngine._classify_regime(-30.0, -10.0) == "CONTRACTION"


def test_current_regime_metadata():
    res = MacroRegimeEngine.get_current_regime()
    assert "regime_key" in res
    assert res["regime_key"] in ["GOLDILOCKS", "OVERHEAT", "STAGFLATION", "CONTRACTION"]
    assert "growth_score" in res
    assert "inflation_score" in res
    assert "quadrants" in res
    assert len(res["quadrants"]) == 4
    assert "trajectory" in res
    assert len(res["trajectory"]) >= 4

    info = res["regime_info"]
    assert "recommended_etfs" in info
    assert len(info["recommended_etfs"]) >= 3


def test_portfolio_fit_evaluation():
    # 골디락스 주도 자산(나스닥, S&P500, 반도체) 포트폴리오
    holdings = [
        {"code": "133690", "name": "TIGER 미국나스닥100", "current_price": 36000, "current_qty": 100, "current_val": 3600000},
        {"code": "379800", "name": "TIGER 미국S&P500", "current_price": 18000, "current_qty": 200, "current_val": 3600000},
        {"code": "381180", "name": "TIGER 미국필라델피아반도체나스닥", "current_price": 20000, "current_qty": 100, "current_val": 2000000},
    ]

    fit = MacroRegimeEngine.evaluate_portfolio_fit(holdings)
    assert fit["fit_score"] >= 80
    assert fit["fit_grade"] == "OPTIMAL"
    assert len(fit["synergy_items"]) >= 2
    assert fit["synergy_weight"] >= 80.0


def test_portfolio_fit_headwind():
    # 스태그플레이션/수축 대비 자산(단기채, CD금리, 곱버스) 위주 포트폴리오
    holdings = [
        {"code": "449170", "name": "KODEX CD금리액티브", "current_price": 100000, "current_qty": 50, "current_val": 5000000},
        {"code": "252670", "name": "KODEX 200선물인버스2X", "current_price": 2000, "current_qty": 1000, "current_val": 2000000},
    ]

    fit = MacroRegimeEngine.evaluate_portfolio_fit(holdings)
    assert fit["headwind_weight"] >= 80.0
    assert fit["fit_score"] < 60
    assert fit["fit_grade"] == "MISALIGNED"


@pytest.mark.anyio
async def test_macro_regime_api_endpoints():
    from httpx import AsyncClient, ASGITransport
    from main import app

    async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as ac:
        # 1. GET /api/v1/macro/regime
        resp = await ac.get("/api/v1/macro/regime")
        assert resp.status_code == 200
        data = resp.json()
        assert "regime_key" in data
        assert "quadrants" in data

        # 2. POST /api/v1/macro/regime/fit
        payload = {
            "holdings": [
                {"code": "379800", "name": "TIGER 미국S&P500", "current_price": 18000, "current_qty": 100, "current_val": 1800000}
            ]
        }
        fit_resp = await ac.post("/api/v1/macro/regime/fit", json=payload)
        assert fit_resp.status_code == 200
        fit_data = fit_resp.json()
        assert "fit_score" in fit_data
        assert "fit_grade" in fit_data
