"""실서버 배포 점검 및 라이브 E2E 동기화 검증 테스트 (S6-36)
File: backend/tests/test_live_e2e_sync.py

검증 대상 (S6-31 ~ S6-35 신규 5대 핵심 파이프라인):
1. S6-31: POST /api/v1/analyze/portfolio/stress-test
2. S6-32: POST /api/v1/analyze/portfolio/rebalance
3. S6-33: GET /api/v1/macro/regime & POST /api/v1/macro/regime/fit
4. S6-34: POST /api/v1/my/backtest/multi
5. S6-35: POST /api/v1/dividends/tax-shield
"""

import pytest
from httpx import AsyncClient, ASGITransport
from main import app


@pytest.fixture
def anyio_backend():
    return "asyncio"


@pytest.mark.anyio
async def test_s6_31_stress_tester_e2e():
    """S6-31 포트폴리오 스트레스 테스터 엔드포인트 E2E 검증"""
    transport = ASGITransport(app=app)
    async with AsyncClient(transport=transport, base_url="http://test") as ac:
        payload = {
            "portfolio": [
                {"code": "069500", "weight": 0.4},
                {"code": "379180", "weight": 0.6}
            ],
            "total_eval_amount": 50_000_000.0
        }
        res = await ac.post("/api/v1/analyze/portfolio/stress-test", json=payload)
        assert res.status_code == 200
        data = res.json()
        assert "covid_2020" in data
        assert "black_monday_2024" in data
        assert data["covid_2020"]["total_eval_amount"] == 50_000_000.0
        assert "defense_score" in data["covid_2020"]
        assert "prescription" in data["covid_2020"]


@pytest.mark.anyio
async def test_s6_32_portfolio_rebalancer_e2e():
    """S6-32 포트폴리오 드리프트 & 스마트 리밸런싱 주문기 엔드포인트 E2E 검증"""
    transport = ASGITransport(app=app)
    async with AsyncClient(transport=transport, base_url="http://test") as ac:
        payload = {
            "holdings": [
                {"code": "069500", "name": "KODEX 200", "current_price": 35000, "current_qty": 100, "current_val": 3500000},
                {"code": "379800", "name": "TIGER S&P500", "current_price": 15000, "current_qty": 100, "current_val": 1500000},
            ],
            "target_weights": {
                "069500": 50.0,
                "379800": 50.0
            },
            "cash_injection": 500000,
            "mode": "cash_only"
        }
        res = await ac.post("/api/v1/analyze/portfolio/rebalance", json=payload)
        assert res.status_code == 200
        data = res.json()
        assert "drift_score" in data
        assert "items" in data
        assert len(data["items"]) == 2
        assert data["cash_injection"] == 500000


@pytest.mark.anyio
async def test_s6_33_macro_regime_e2e():
    """S6-33 매크로 거시경제 4국면 나침반 및 적합도 진단 E2E 검증"""
    transport = ASGITransport(app=app)
    async with AsyncClient(transport=transport, base_url="http://test") as ac:
        # 1. 4국면 조회
        res1 = await ac.get("/api/v1/macro/regime")
        assert res1.status_code == 200
        regime_data = res1.json()
        assert "regime_key" in regime_data
        assert regime_data["regime_key"] in ["GOLDILOCKS", "OVERHEAT", "STAGFLATION", "CONTRACTION"]
        assert len(regime_data["quadrants"]) == 4
        assert len(regime_data["trajectory"]) >= 4

        # 2. 포트폴리오 적합도 진단
        fit_payload = {
            "holdings": [
                {"code": "133690", "name": "TIGER 미국나스닥100", "current_price": 36000, "current_qty": 100, "current_val": 3600000},
                {"code": "379800", "name": "TIGER 미국S&P500", "current_price": 18000, "current_qty": 200, "current_val": 3600000},
            ]
        }
        res2 = await ac.post("/api/v1/macro/regime/fit", json=fit_payload)
        assert res2.status_code == 200
        fit_data = res2.json()
        assert "fit_score" in fit_data
        assert "fit_grade" in fit_data


@pytest.mark.anyio
async def test_s6_34_multi_backtester_e2e():
    """S6-34 올웨더 & 멀티 자산배분 백테스터 2.0 E2E 검증"""
    transport = ASGITransport(app=app)
    async with AsyncClient(transport=transport, base_url="http://test") as ac:
        payload = {
            "assets": [
                {"code": "379800", "weight": 60.0, "name": "S&P500"},
                {"code": "305080", "weight": 40.0, "name": "미국채10년"}
            ],
            "initial_capital": 10000000,
            "years": 3,
            "rebalance_freq": "quarterly"
        }
        res = await ac.post("/api/v1/my/backtest/multi", json=payload)
        assert res.status_code == 200
        data = res.json()
        assert data["status"] == "ok"
        assert "metrics" in data
        assert "cagr" in data["metrics"]
        assert "mdd" in data["metrics"]
        assert "sharpe" in data["metrics"]
        assert len(data["time_series"]) >= 20


@pytest.mark.anyio
async def test_s6_35_tax_shield_e2e():
    """S6-35 금융소득 2,000만원 & 건보료 피부양자 방어 트래커 E2E 검증"""
    transport = ASGITransport(app=app)
    async with AsyncClient(transport=transport, base_url="http://test") as ac:
        payload = {
            "taxable_dividends_krw": 16000000,
            "tax_shielded_dividends_krw": 6000000,
            "interest_income_krw": 1500000,
            "other_annual_income_krw": 50000000,
            "is_health_insurance_dependent": True,
        }
        res = await ac.post("/api/v1/dividends/tax-shield", json=payload)
        assert res.status_code == 200
        data = res.json()
        assert data["status"] == "success"
        assert data["summary"]["utilization_rate"] == 87.5
        assert data["summary"]["risk_level"] == "CAUTION"
        assert data["health_insurance_impact"]["is_dependent_disqualified"] is False
        assert len(data["monthly_trend"]) == 12


@pytest.mark.anyio
async def test_live_deployment_summary():
    """실서버 배포 요약 엔드포인트(/api/v1/health/live-summary) 검증"""
    transport = ASGITransport(app=app)
    async with AsyncClient(transport=transport, base_url="http://test") as ac:
        res = await ac.get("/api/v1/health/live-summary")
        assert res.status_code == 200
        data = res.json()
        assert data["status"] == "healthy"
        assert "pipelines" in data
        assert "S6-31_stress_tester" in data["pipelines"]
        assert "S6-35_tax_shield_radar" in data["pipelines"]
        assert data["scheduler_jobs_count"] == 13
