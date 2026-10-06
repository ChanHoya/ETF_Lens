import pytest
from core.portfolio_rebalancer import PortfolioRebalancer


@pytest.fixture
def anyio_backend():
    return "asyncio"



def test_empty_holdings():
    res = PortfolioRebalancer.analyze_and_rebalance(
        holdings=[],
        target_weights={},
        cash_injection=1000000,
        mode="full"
    )
    assert res["drift_score"] == 100
    assert res["status"] == "EMPTY"
    assert res["items"] == []


def test_drift_calculation_and_status():
    # 2종목: A(700만원, 70%), B(300만원, 30%)
    # 목표 비중: A 50%, B 50%
    holdings = [
        {"code": "069500", "name": "KODEX 200", "current_price": 35000, "current_qty": 200, "current_val": 7000000},
        {"code": "379800", "name": "TIGER 미국S&P500", "current_price": 15000, "current_qty": 200, "current_val": 3000000},
    ]
    target_weights = {
        "069500": 50.0,
        "379800": 50.0,
    }

    res = PortfolioRebalancer.analyze_and_rebalance(
        holdings=holdings,
        target_weights=target_weights,
        cash_injection=0,
        mode="full"
    )

    # 전체 평가금액 1,000만원
    assert res["total_current_val"] == 10000000
    # A는 70% (목표 50% 대비 +20%p 괴리 -> CRITICAL)
    # B는 30% (목표 50% 대비 -20%p 괴리 -> CRITICAL)
    items = {item["code"]: item for item in res["items"]}
    assert items["069500"]["current_weight"] == 70.0
    assert items["069500"]["drift_pct"] == 20.0
    assert items["069500"]["drift_status"] == "CRITICAL"

    assert items["379800"]["current_weight"] == 30.0
    assert items["379800"]["drift_pct"] == -20.0
    assert items["379800"]["drift_status"] == "CRITICAL"

    # 드리프트 점수 (100 - (40 / 2) = 80점)
    assert res["drift_score"] == 80.0
    assert res["prescription"]["urgency"] == "HIGH"


def test_full_rebalance_orders():
    # 총 1,000만원, A(700만원, 200주 @ 35,000), B(300만원, 200주 @ 15,000)
    # 목표 비중: 50% : 50% -> 각 500만원
    # A 목표: 500만원 / 35,000 = 143주 (매도 57주)
    # B 목표: 500만원 / 15,000 = 333주 (매수 133주)
    holdings = [
        {"code": "069500", "name": "KODEX 200", "current_price": 35000, "current_qty": 200, "current_val": 7000000},
        {"code": "379800", "name": "TIGER 미국S&P500", "current_price": 15000, "current_qty": 200, "current_val": 3000000},
    ]
    target_weights = {
        "069500": 50.0,
        "379800": 50.0,
    }

    res = PortfolioRebalancer.analyze_and_rebalance(
        holdings=holdings,
        target_weights=target_weights,
        cash_injection=0,
        mode="full"
    )

    items = {item["code"]: item for item in res["items"]}
    assert items["069500"]["action"] == "SELL"
    assert items["069500"]["order_qty"] == 57

    assert items["379800"]["action"] == "BUY"
    assert items["379800"]["order_qty"] == 133

    # 리밸런싱 후 점수는 99점 이상으로 대폭 개선
    assert res["post_drift_score"] >= 98.0


def test_cash_only_rebalance_no_sell():
    # 총 1,000만원, A(700만원), B(300만원)
    # 신규 현금 400만원 추가 투입 (총 1,400만원)
    # 목표 비중: 50% : 50% -> 각 700만원 이상
    # A는 이미 700만원이므로 매수 0주, 매도도 0주!
    # B는 400만원어치 전액 매수!
    holdings = [
        {"code": "069500", "name": "KODEX 200", "current_price": 35000, "current_qty": 200, "current_val": 7000000},
        {"code": "379800", "name": "TIGER 미국S&P500", "current_price": 15000, "current_qty": 200, "current_val": 3000000},
    ]
    target_weights = {
        "069500": 50.0,
        "379800": 50.0,
    }

    res = PortfolioRebalancer.analyze_and_rebalance(
        holdings=holdings,
        target_weights=target_weights,
        cash_injection=4000000,
        mode="cash_only"
    )

    items = {item["code"]: item for item in res["items"]}
    # 매도 절대 없음
    assert res["total_sell_val"] == 0
    assert items["069500"]["action"] == "HOLD"
    assert items["069500"]["order_qty"] == 0

    # B만 매수
    assert items["379800"]["action"] == "BUY"
    assert items["379800"]["order_qty"] > 250
    assert res["post_drift_score"] > res["drift_score"]


@pytest.mark.anyio
async def test_rebalance_api_endpoint():
    from httpx import AsyncClient, ASGITransport
    from main import app

    async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as ac:
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
        resp = await ac.post("/api/v1/analyze/portfolio/rebalance", json=payload)
        assert resp.status_code == 200
        data = resp.json()
        assert "drift_score" in data
        assert "items" in data
        assert len(data["items"]) == 2
        assert data["cash_injection"] == 500000
