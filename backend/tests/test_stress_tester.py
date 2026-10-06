import pytest
from httpx import AsyncClient, ASGITransport
from main import app
from core.stress_tester import classify_etf, run_stress_test, SCENARIOS
from db.database import AsyncSessionLocal


def test_classify_etf():
    # US Stock
    cls, lev, inv, inv2 = classify_etf("TIGER 미국S&P500")
    assert cls == "us_stock" and not lev and not inv

    # KR Stock & Leverage
    cls, lev, inv, inv2 = classify_etf("KODEX 코스닥150레버리지")
    assert cls == "kr_stock" and lev and not inv

    # Inverse 2X (곱버스)
    cls, lev, inv, inv2 = classify_etf("KODEX 200선물인버스2X")
    assert cls == "kr_stock" and not lev and inv and inv2

    # Bond
    cls, lev, inv, inv2 = classify_etf("ACE 미국30년국채액티브(H)")
    assert cls == "bond" and not lev and not inv

    # Cash / Parking
    cls, lev, inv, inv2 = classify_etf("TIGER CD금리투자KIS(합성)")
    assert cls == "cash" and not lev and not inv

    # Commodity
    cls, lev, inv, inv2 = classify_etf("ACE KRX금현물")
    assert cls == "commodity" and not lev and not inv


@pytest.mark.asyncio
async def test_run_stress_test_calculation():
    portfolio = [
        {"code": "069500", "weight": 0.5},  # KODEX 200
        {"code": "453850", "weight": 0.5},  # ACE 미국30년국채액티브
    ]
    total_eval = 50_000_000.0  # 5,000만원

    async with AsyncSessionLocal() as db:
        res = await run_stress_test(db, portfolio, total_eval_amount=total_eval)

        # 7대 시나리오 모두 포함 검증
        assert len(res) == 7
        for key in SCENARIOS.keys():
            assert key in res
            sc = res[key]
            assert "portfolio_return" in sc
            assert "expected_mdd" in sc
            assert "expected_loss_amount" in sc
            assert "remained_asset_amount" in sc
            assert "defense_score" in sc
            assert "risk_grade" in sc
            assert "worst_impact_items" in sc
            assert "best_shield_items" in sc
            assert "prescription" in sc
            assert sc["total_eval_amount"] == 50_000_000

            # 원화 손실액 + 총 평가금액 = 잔여 자산 정합성 검증
            assert sc["total_eval_amount"] + sc["expected_loss_amount"] == sc["remained_asset_amount"]


@pytest.mark.asyncio
async def test_portfolio_stress_test_api():
    transport = ASGITransport(app=app)
    async with AsyncClient(transport=transport, base_url="http://test") as client:
        payload = {
            "portfolio": [
                {"code": "069500", "weight": 0.4},
                {"code": "379180", "weight": 0.6}
            ],
            "total_eval_amount": 100_000_000.0
        }
        res = await client.post("/api/v1/analyze/portfolio/stress-test", json=payload)
        assert res.status_code == 200
        data = res.json()
        assert "covid_2020" in data
        assert "black_monday_2024" in data
        assert data["covid_2020"]["total_eval_amount"] == 100_000_000
