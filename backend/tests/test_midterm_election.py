"""
backend/tests/test_midterm_election.py
미국 중간선거('26.11) 영향 분석 API 단위 테스트
"""

import pytest
from httpx import AsyncClient, ASGITransport
from main import app


@pytest.mark.asyncio
async def test_midterm_overview_endpoint():
    """1. 미국 대통령 중간선거 개요 엔드포인트 검증"""
    async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as ac:
        res = await ac.get("/api/v1/midterm/overview")
    
    assert res.status_code == 200
    data = res.json()
    assert data["election_date"] == "2026-11-03"
    assert "d_day" in data
    assert data["seats_contested"]["house"]["total_seats"] == 435
    assert data["seats_contested"]["senate"]["total_seats"] == 100
    assert data["seats_contested"]["senate"]["contested_seats"] == 33
    assert data["constitutional_facts"]["reelection_possible"] is False
    assert "재선거를 실시하지 않습니다" in data["constitutional_facts"]["core_qa"]["answer"]


@pytest.mark.asyncio
async def test_midterm_radar_endpoint():
    """2. 사전 분위기 및 판세 트래커 검증"""
    async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as ac:
        res = await ac.get("/api/v1/midterm/radar")
    
    assert res.status_code == 200
    data = res.json()
    assert "probabilities" in data
    assert "house" in data["probabilities"]
    assert "senate" in data["probabilities"]
    assert data["probabilities"]["divided_government_prob"] > 50.0
    assert len(data["key_policy_issues"]) >= 4
    assert len(data["battleground_races"]) >= 4


@pytest.mark.asyncio
async def test_midterm_scenarios_endpoint():
    """3. 3대 선거 시나리오별 금융시장 영향 매트릭스 검증"""
    async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as ac:
        res = await ac.get("/api/v1/midterm/scenarios")
    
    assert res.status_code == 200
    data = res.json()
    assert "scenarios" in data
    scenarios = data["scenarios"]
    assert len(scenarios) == 3
    
    scenario_ids = [s["id"] for s in scenarios]
    assert "gridlock" in scenario_ids
    assert "red_hold" in scenario_ids
    assert "blue_wave" in scenario_ids
    
    gridlock = next(s for s in scenarios if s["id"] == "gridlock")
    assert gridlock["is_base"] is True
    assert "yield_10y" in gridlock["macro_outlook"]
    assert len(gridlock["sector_impacts"]) >= 3


@pytest.mark.asyncio
async def test_midterm_historical_endpoint():
    """4. 역대 중간선거 S&P 500 계절성 통계 검증"""
    async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as ac:
        res = await ac.get("/api/v1/midterm/historical")
    
    assert res.status_code == 200
    data = res.json()
    assert "historical_stats" in data
    stats = data["historical_stats"]
    assert stats["post_election_12m_positive_rate"] > 90.0
    assert stats["post_election_12m_avg_return"] > 10.0
    assert len(data["trajectory"]) >= 12


@pytest.mark.asyncio
async def test_midterm_portfolio_guide_endpoint():
    """5. AI 맞춤형 포트폴리오 리밸런싱 컨설턴트 검증"""
    payload = {
        "tech_weight": 60.0,
        "risk_profile": "neutral",
        "interested_themes": ["big_tech", "semi_hardware", "b2b_saas", "dividend_growth"]
    }
    async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as ac:
        res = await ac.post("/api/v1/midterm/portfolio-guide", json=payload)
    
    assert res.status_code == 200
    data = res.json()
    assert data["diagnosis"]["status"] == "warning"
    assert data["current_vs_target"]["trim_needed_pct"] > 0
    assert len(data["action_plans"]) == 3
    assert any("SCHD" in str(plan) for plan in data["action_plans"])
