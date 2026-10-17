import pytest
from core.macro_alert_engine import _classify_asset_impact, format_macro_alert_message, check_macro_smart_alerts
from fastapi.testclient import TestClient
from main import app

client = TestClient(app)


def test_classify_asset_impact():
    # 에너지/원유/조선/방산 -> BENEFIT
    assert _classify_asset_impact("KODEX 미국에너지(합성)", "에너지") == "BENEFIT"
    assert _classify_asset_impact("HD현대중공업", "조선") == "BENEFIT"
    assert _classify_asset_impact("TIGER 원유선물Enhanced", "원자재") == "BENEFIT"
    assert _classify_asset_impact("한화에어로스페이스", "방산") == "BENEFIT"

    # 항공/운송/화학 -> VULNERABLE
    assert _classify_asset_impact("대한항공", "운송") == "VULNERABLE"
    assert _classify_asset_impact("US Global Jets ETF", "항공") == "VULNERABLE"
    assert _classify_asset_impact("LG화학", "화학") == "VULNERABLE"

    # 기타
    assert _classify_asset_impact("삼성전자", "반도체") == "NEUTRAL"


def test_format_macro_alert_message():
    oil_mock = {
        "wti_price": 78.50,
        "wti_change_pct": 3.85,
        "brent_price": 82.10,
        "brent_wti_spread": 3.60
    }
    geo_mock = {
        "risk_score": 75,
        "status": "경계"
    }
    portfolio_mock = {
        "total_eval": 100_000_000,
        "beneficiaries": [{"name": "KODEX 에너지", "amount": 15_000_000}],
        "vulnerables": [{"name": "대한항공", "amount": 10_000_000}],
        "benefit_ratio": 15.0,
        "vuln_ratio": 10.0
    }

    msg = format_macro_alert_message(
        oil_data=oil_mock,
        geo_data=geo_mock,
        vix_val=22.5,
        vix_change=1.8,
        portfolio_impact=portfolio_mock,
        trigger_reason="WTI 원유 +3.85% 급등 및 VIX 22.5 돌파",
        is_test=True
    )

    assert "🚨" in msg
    assert "WTI: <code>$78.50</code>" in msg
    assert "+3.85%" in msg
    assert "VIX: <code>22.50</code>" in msg
    assert "수혜 방어군 (15.0%):" in msg
    assert "취약 노출군 (10.0%):" in msg
    assert "투자자 행동 수칙" in msg


@pytest.mark.asyncio
async def test_check_macro_smart_alerts():
    res = await check_macro_smart_alerts()
    assert isinstance(res, dict)
    assert "alert_sent" in res


def test_notification_settings_oil_vix_fields():
    res = client.get("/api/v1/notification/settings")
    assert res.status_code == 200
    data = res.json()
    assert "alert_oil_shock" in data
    assert "alert_vix_spike" in data
