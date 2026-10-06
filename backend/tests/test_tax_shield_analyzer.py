"""금융소득 종합과세(2,000만원) & 건강보험 피부양자 실시간 방어 트래커 테스트 (S6-35)
File: backend/tests/test_tax_shield_analyzer.py
"""

import pytest
from httpx import AsyncClient, ASGITransport
from main import app
from core.tax_shield_analyzer import (
    analyze_tax_shield,
    calculate_marginal_tax_rate,
    LIMIT_FINANCIAL_INCOME_KRW,
)


def test_calculate_marginal_tax_rate():
    """소득세 과표별 한계세율(지방소득세 포함) 산출 테스트"""
    assert calculate_marginal_tax_rate(10_000_000) == pytest.approx(0.066)
    assert calculate_marginal_tax_rate(30_000_000) == pytest.approx(0.165)
    assert calculate_marginal_tax_rate(60_000_000) == pytest.approx(0.264)
    assert calculate_marginal_tax_rate(100_000_000) == pytest.approx(0.385)


def test_safe_tax_shield():
    """안전(SAFE) 구간: 1,200만원 (소진율 60%) 테스트"""
    res = analyze_tax_shield(
        taxable_dividends_krw=10_000_000,
        tax_shielded_dividends_krw=5_000_000,
        interest_income_krw=2_000_000,
        other_annual_income_krw=50_000_000,
        is_health_insurance_dependent=True,
    )

    assert res["status"] == "success"
    summary = res["summary"]
    assert summary["total_financial_income_krw"] == 12_000_000
    assert summary["remaining_shield_krw"] == 8_000_000
    assert summary["utilization_rate"] == 60.0
    assert summary["risk_level"] == "SAFE"
    assert summary["excess_income_krw"] == 0

    health = res["health_insurance_impact"]
    assert health["is_dependent_disqualified"] is False
    assert health["estimated_monthly_fee_krw"] == 0


def test_caution_and_warning_tax_shield():
    """주의(CAUTION: 85%) 및 경고(WARNING: 95%) 구간 테스트"""
    caution_res = analyze_tax_shield(
        taxable_dividends_krw=17_000_000,
        interest_income_krw=0,
    )
    assert caution_res["summary"]["risk_level"] == "CAUTION"
    assert caution_res["summary"]["utilization_rate"] == 85.0

    warning_res = analyze_tax_shield(
        taxable_dividends_krw=19_000_000,
        interest_income_krw=0,
    )
    assert warning_res["summary"]["risk_level"] == "WARNING"
    assert warning_res["summary"]["utilization_rate"] == 95.0
    assert warning_res["summary"]["remaining_shield_krw"] == 1_000_000


def test_critical_tax_shield_and_dependent_disqualification():
    """초과위험(CRITICAL): 2,500만원 (125%) & 건보료 피부양자 박탈 테스트"""
    res = analyze_tax_shield(
        taxable_dividends_krw=22_000_000,
        tax_shielded_dividends_krw=8_000_000,
        interest_income_krw=3_000_000,
        other_annual_income_krw=60_000_000,
        is_health_insurance_dependent=True,
    )

    summary = res["summary"]
    assert summary["total_financial_income_krw"] == 25_000_000
    assert summary["excess_income_krw"] == 5_000_000
    assert summary["utilization_rate"] == 125.0
    assert summary["risk_level"] == "CRITICAL"

    tax = res["tax_impact"]
    assert tax["additional_income_tax_krw"] > 0

    health = res["health_insurance_impact"]
    assert health["is_dependent_disqualified"] is True
    assert health["estimated_monthly_fee_krw"] > 0
    assert health["estimated_annual_fee_krw"] > 0

    # 권고안에 건보료 절벽 방어 및 절세계좌 이전 권고 포함 여부
    rec_types = [r["type"] for r in res["recommendations"]]
    assert "TRANSFER_TO_ISA" in rec_types
    assert "PREVENT_HEALTH_CLIFF" in rec_types


@pytest.mark.asyncio
async def test_tax_shield_api_endpoint():
    """POST /api/v1/dividends/tax-shield API 엔드포인트 통합 테스트"""
    transport = ASGITransport(app=app)
    async with AsyncClient(transport=transport, base_url="http://test") as ac:
        payload = {
            "taxable_dividends_krw": 18_500_000,
            "tax_shielded_dividends_krw": 4_000_000,
            "interest_income_krw": 500_000,
            "other_annual_income_krw": 45_000_000,
            "is_health_insurance_dependent": True,
        }
        res = await ac.post("/api/v1/dividends/tax-shield", json=payload)
        assert res.status_code == 200
        data = res.json()
        assert data["status"] == "success"
        assert data["summary"]["total_financial_income_krw"] == 19_000_000
        assert data["summary"]["risk_level"] == "WARNING"
        assert len(data["monthly_trend"]) == 12
