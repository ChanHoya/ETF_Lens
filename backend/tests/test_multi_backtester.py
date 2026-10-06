"""
backend/tests/test_multi_backtester.py

올웨더 & 멀티 자산배분 포트폴리오 백테스터 2.0 유닛/통합 테스트
"""

import pytest
from core.multi_backtester import MultiAssetBacktester


@pytest.fixture
def anyio_backend():
    return "asyncio"


@pytest.mark.anyio
async def test_multi_asset_backtest_calculation():
    assets = [
        {"code": "379800", "weight": 60.0, "name": "TIGER 미국S&P500"},
        {"code": "305080", "weight": 40.0, "name": "TIGER 미국채10년선물"},
    ]

    res = await MultiAssetBacktester.run_backtest(
        assets=assets,
        initial_capital=10000000,
        years=3,
        rebalance_freq="quarterly"
    )

    assert res["status"] == "ok"
    assert res["initial_capital"] == 10000000
    assert "metrics" in res
    metrics = res["metrics"]
    assert "cagr" in metrics
    assert "mdd" in metrics
    assert "sharpe" in metrics
    assert "volatility" in metrics
    assert len(res["time_series"]) >= 20
    assert "presets" in res


@pytest.mark.anyio
async def test_rebalance_frequencies():
    assets = [
        {"code": "379800", "weight": 50.0},
        {"code": "133690", "weight": 50.0},
    ]

    for freq in ["monthly", "quarterly", "annually", "none"]:
        res = await MultiAssetBacktester.run_backtest(
            assets=assets,
            initial_capital=5000000,
            years=1,
            rebalance_freq=freq
        )
        assert res["status"] == "ok"
        assert res["rebalance_freq"] == freq


@pytest.mark.anyio
async def test_multi_backtest_api_endpoint():
    from httpx import AsyncClient, ASGITransport
    from main import app

    async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as ac:
        payload = {
            "assets": [
                {"code": "379800", "weight": 60.0, "name": "S&P500"},
                {"code": "305080", "weight": 40.0, "name": "미국채10년"}
            ],
            "initial_capital": 10000000,
            "years": 3,
            "rebalance_freq": "quarterly"
        }
        resp = await ac.post("/api/v1/my/backtest/multi", json=payload)
        assert resp.status_code == 200
        data = resp.json()
        assert data["status"] == "ok"
        assert "metrics" in data
        assert "time_series" in data
