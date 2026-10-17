"""
backend/tests/test_oil_dashboard.py
국제 유가 및 에너지 시장 동향 API 단위 테스트
"""

import pytest
from httpx import AsyncClient, ASGITransport
from main import app


@pytest.mark.asyncio
async def test_oil_overview_endpoint():
    """1. 유가 개요 및 3대 벤치마크 시세 검증"""
    async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as ac:
        res = await ac.get("/api/v1/oil/overview")
    
    assert res.status_code == 200
    data = res.json()
    assert "regime_status" in data
    assert "benchmarks" in data
    bm = data["benchmarks"]
    assert "wti" in bm
    assert "brent" in bm
    assert "dubai" in bm
    assert "brent_wti_spread" in bm
    assert bm["wti"]["price"] > 0
    assert bm["brent"]["price"] > 0
    assert len(data["expert_insights"]) >= 3


@pytest.mark.asyncio
async def test_oil_fundamentals_endpoint():
    """2. 원유 수급 펀더멘털 및 정제마진 검증"""
    async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as ac:
        res = await ac.get("/api/v1/oil/fundamentals")
    
    assert res.status_code == 200
    data = res.json()
    assert "inventory" in data
    assert "supply_metrics" in data
    assert "refining_margins" in data
    assert data["supply_metrics"]["us_crude_production_mbpd"] > 10.0
    assert data["refining_margins"]["current_margin"] > 0
    assert len(data["historical_spreads"]) >= 5


@pytest.mark.asyncio
async def test_oil_geopolitics_endpoint():
    """3. 지정학적 리스크 및 3대 초크포인트 검증"""
    async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as ac:
        res = await ac.get("/api/v1/oil/geopolitics")
    
    assert res.status_code == 200
    data = res.json()
    assert "risk_index" in data
    assert len(data["chokepoints"]) >= 3
    choke_names = [c["name"] for c in data["chokepoints"]]
    assert any("호르무즈" in n for n in choke_names)
    assert any("홍해" in n for n in choke_names)


@pytest.mark.asyncio
async def test_oil_etf_playbook_endpoint():
    """4. 유가 시나리오별 실전 ETF 플레이북 검증"""
    async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as ac:
        res = await ac.get("/api/v1/oil/etf-playbook")
    
    assert res.status_code == 200
    data = res.json()
    assert "scenarios" in data
    assert len(data["scenarios"]) >= 2
    assert len(data["actionable_rules"]) >= 3
