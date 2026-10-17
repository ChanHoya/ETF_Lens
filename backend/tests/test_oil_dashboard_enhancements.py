"""
backend/tests/test_oil_dashboard_enhancements.py
유가 대시보드 고도화 (S16) 단위 테스트:
1. 최상단 Executive Market Insight 반환 검증
2. 원유 수급 & 정제마진 주식시장 영향 분석 (stock_market_impact) 검증
3. 2026년도 최근 6개월 정제마진 복합 추이 날짜 검증
4. 지표별 팝업 히스토리 (6M, 1Y, 5Y, 10Y) 및 매크로 오버레이 (S&P500, Nasdaq, DXY, CPI, PPI, PCE) API 검증
"""

import pytest
from httpx import AsyncClient, ASGITransport
from main import app
from db.database import AsyncSessionLocal
from api.oil_dashboard import (
    get_oil_market_overview,
    get_oil_fundamentals,
    get_oil_indicator_history
)


@pytest.mark.asyncio
async def test_executive_market_insight_in_overview():
    """최상단 AI 유가 종합 진단 및 증시 인사이트 검증"""
    res = await get_oil_market_overview()
    assert "executive_market_insight" in res
    exec_insight = res["executive_market_insight"]
    assert "headline" in exec_insight
    assert "market_drivers" in exec_insight
    assert len(exec_insight["market_drivers"]) == 4
    assert "stock_market_verdict" in exec_insight
    assert "risk_threshold" in exec_insight


@pytest.mark.asyncio
async def test_stock_market_impact_in_fundamentals():
    """원유 수급 펀더멘털 및 정제마진의 주식시장 영향 분석 및 2026년 날짜 검증"""
    res = await get_oil_fundamentals()
    assert "stock_market_impact" in res
    impact = res["stock_market_impact"]
    assert "core_takeaway" in impact
    assert "mechanisms" in impact
    assert len(impact["mechanisms"]) >= 3
    assert "judgment_rules" in impact
    assert len(impact["judgment_rules"]) >= 4

    # 최근 6개월 날짜가 2026년도인지 검증
    spreads = res.get("historical_spreads", [])
    assert len(spreads) == 6
    for item in spreads:
        assert item["date"].startswith("2026-")
        assert "refining_margin" in item
        assert "wti" in item
        assert "brent" in item


@pytest.mark.asyncio
async def test_oil_indicator_history_api():
    """/api/v1/oil/indicator-history 엔드포인트 6M, 1Y, 5Y, 10Y 및 매크로 지표 오버레이 검증"""
    async with AsyncSessionLocal() as db:
        # 1. 6M WTI
        res_6m = await get_oil_indicator_history(indicator="wti", period="6M", db=db)
        assert res_6m["indicator"] == "wti"
        assert res_6m["period"] == "6M"
        assert len(res_6m["series"]) == 6
        last_pt = res_6m["series"][-1]
        assert "value" in last_pt
        assert "sp500" in last_pt
        assert "nasdaq" in last_pt
        assert "dollar_index" in last_pt
        assert "cpi" in last_pt
        assert "ppi" in last_pt
        assert "pce" in last_pt
        assert last_pt["date"] == "2026-10"

        # 2. 1Y Refining Margin
        res_1y = await get_oil_indicator_history(indicator="refining_margin", period="1Y", db=db)
        assert len(res_1y["series"]) == 12
        assert "correlations" in res_1y
        assert "time_horizon_guide" in res_1y

        # 3. 5Y Rig Count
        res_5y = await get_oil_indicator_history(indicator="rig_count", period="5Y", db=db)
        assert len(res_5y["series"]) == 60

        # 4. 10Y EIA Inventory
        res_10y = await get_oil_indicator_history(indicator="eia_inventory", period="10Y", db=db)
        assert len(res_10y["series"]) == 120
        assert res_10y["series"][0]["date"] == "2016-11"
        assert res_10y["series"][-1]["date"] == "2026-10"


@pytest.mark.asyncio
async def test_http_endpoint_indicator_history():
    """FastAPI HTTP 라우팅을 통한 /api/v1/oil/indicator-history E2E 테스트"""
    async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as client:
        resp = await client.get("/api/v1/oil/indicator-history?indicator=geopolitics&period=6M")
        assert resp.status_code == 200
        data = resp.json()
        assert data["indicator"] == "geopolitics"
        assert len(data["series"]) == 6
