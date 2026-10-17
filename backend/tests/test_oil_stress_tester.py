import pytest
from core.stress_tester import SCENARIOS, run_stress_test
from db.database import AsyncSessionLocal


def test_stress_tester_has_9_scenarios():
    assert len(SCENARIOS) == 9
    assert "oil_shock_spike" in SCENARIOS
    assert "oil_demand_crash" in SCENARIOS
    assert "covid_2020" in SCENARIOS
    assert "inflation_2022" in SCENARIOS
    assert "black_monday_2024" in SCENARIOS
    assert "svb_crisis_2023" in SCENARIOS
    assert "russia_ukraine_2022" in SCENARIOS
    assert "markdown_2011" in SCENARIOS
    assert "subprime_2008" in SCENARIOS


@pytest.mark.asyncio
async def test_oil_shock_scenarios_execution():
    test_portfolio = [
        {"code": "069500", "weight": 0.5, "name": "KODEX 200"},
        {"code": "261220", "weight": 0.3, "name": "KODEX WTI원유선물(H)"},
        {"code": "114800", "weight": 0.2, "name": "KODEX 인버스"}
    ]

    async with AsyncSessionLocal() as session:
        results = await run_stress_test(session, test_portfolio)

        assert "oil_shock_spike" in results
        assert "oil_demand_crash" in results

        oil_spike = results["oil_shock_spike"]
        assert oil_spike["scenario_name"] == "오일 쇼크 & 유가 $120 폭등 (1970s/2022)"
        assert "portfolio_return" in oil_spike
        assert "expected_mdd" in oil_spike
        assert "defense_score" in oil_spike

        oil_crash = results["oil_demand_crash"]
        assert oil_crash["scenario_name"] == "마이너스 유가 & 원유 수요 붕괴 (2020.04)"
        assert "portfolio_return" in oil_crash
