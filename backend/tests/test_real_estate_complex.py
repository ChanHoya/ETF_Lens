# backend/tests/test_real_estate_complex.py
import pytest
from httpx import AsyncClient, ASGITransport
from main import app
from core.real_estate_complex_service import real_estate_complex_service


def test_complex_history_service():
    """주요 대단지 및 미등록 단지 2개년 시계열 생성 검증"""
    res = real_estate_complex_service.get_complex_history("잠실엘스")
    assert res["meta"]["complex_name"] == "잠실엘스"
    assert len(res["history"]) == 24
    assert res["summary"]["latest_avg_price"] > 20.0
    assert "drop_from_peak_pct" in res["summary"]

    # 미등록 단지 스마트 fallback
    fallback_res = real_estate_complex_service.get_complex_history("행복마을푸르지오")
    assert fallback_res["meta"]["complex_name"] == "행복마을푸르지오"
    assert len(fallback_res["history"]) == 24


def test_evaluate_user_apartment():
    """사용자 아파트 자산 가치 및 LTV/DSR 진단 로직 검증"""
    eval_res = real_estate_complex_service.evaluate_user_apartment(
        complex_name="잠실엘스",
        area_sqm=84.8,
        purchase_price_won=20.0,
        loan_balance_won=5.0,
        jeonse_deposit_won=0.0,
        annual_income_won=1.2,
        mortgage_rate_pct=4.0
    )
    assert eval_res["complex_name"] == "잠실엘스"
    assert eval_res["estimated_market_price_won"] > 20.0
    assert eval_res["unrealized_gain_won"] > 0
    assert eval_res["ltv_pct"] < 30.0
    assert eval_res["health_grade"] in ("SAFE", "MODERATE", "RISK")


@pytest.mark.asyncio
async def test_complex_api_endpoints():
    """부동산 복합단지 관련 API 엔드포인트 통합 검증"""
    async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as ac:
        # 대단지 목록
        r1 = await ac.get("/api/v1/real-estate/complexes")
        assert r1.status_code == 200
        complexes = r1.json()
        assert len(complexes) >= 10

        # 대단지 2개년 시계열
        r2 = await ac.get("/api/v1/real-estate/complex-history?complex_name=마포래미안푸르지오")
        assert r2.status_code == 200
        h_data = r2.json()
        assert len(h_data["history"]) == 24

        # 사용자 아파트 진단
        r3 = await ac.post("/api/v1/real-estate/evaluate-apartment", json={
            "complex_name": "고덕그라시움",
            "area_sqm": 84.2,
            "purchase_price_won": 14.5,
            "loan_balance_won": 6.0,
            "jeonse_deposit_won": 0.0,
            "annual_income_won": 1.0,
            "mortgage_rate_pct": 4.2
        })
        assert r3.status_code == 200
        eval_json = r3.json()
        assert eval_json["complex_name"] == "고덕그라시움"
        assert eval_json["ltv_pct"] > 0
