import pytest
import time
from fastapi.testclient import TestClient
from main import app
from unittest.mock import patch, AsyncMock
import pandas as pd
from api.backtest import _BACKTEST_CACHE, _REBALANCE_CACHE
from api.efficient_frontier import _EF_CACHE

client = TestClient(app)

@pytest.fixture(autouse=True)
def clear_caches():
    _BACKTEST_CACHE.clear()
    _REBALANCE_CACHE.clear()
    _EF_CACHE.clear()


def test_s7_e2e_portfolio_backtest_acceleration():
    """S7-1: 포트폴리오 백테스터 10년치 시계열 캐싱 & 초고속 응답 E2E 무결성 검증"""
    payload = {
        "holdings": [
            {"code": "069500", "amount": 10000000, "name": "KODEX 200", "category": "국내시장대표"},
            {"code": "379800", "amount": 10000000, "name": "TIGER 미국S&P500", "category": "해외시장대표"}
        ]
    }

    # 모의 10년치 일봉 데이터
    now_ts = pd.Timestamp.now()
    dates = pd.date_range(end=now_ts, periods=2600, freq="B")
    mock_prices = pd.DataFrame(
        {
            "069500.KS": [30000.0 * (1 + 0.0002 * i) for i in range(2600)],
            "379800.KS": [15000.0 * (1 + 0.0003 * i) for i in range(2600)],
            "^KS11": [2500.0 * (1 + 0.0001 * i) for i in range(2600)],
            "^KQ11": [800.0 * (1 + 0.0001 * i) for i in range(2600)],
            "^GSPC": [4000.0 * (1 + 0.0002 * i) for i in range(2600)],
            "^IXIC": [12000.0 * (1 + 0.0003 * i) for i in range(2600)],
        },
        index=dates
    )

    with patch("api.backtest.load_backtest_close_prices", new_callable=AsyncMock) as mock_load:
        mock_load.return_value = mock_prices

        # 1차 호출 (계산 실행)
        t0 = time.time()
        res1 = client.post("/api/v1/my/backtest/run", json=payload)
        t_first = time.time() - t0

        assert res1.status_code == 200
        d1 = res1.json()
        assert d1["status"] == "success"
        assert d1["cached"] is False
        assert "1Y" in d1["results"]
        assert "Portfolio" in d1["results"]["1Y"]
        assert mock_load.call_count == 1

        # 2차 호출 (인메모리 캐시 히트)
        t1 = time.time()
        res2 = client.post("/api/v1/my/backtest/run", json=payload)
        t_cached = time.time() - t1

        assert res2.status_code == 200
        d2 = res2.json()
        assert d2["status"] == "success"
        assert d2["cached"] is True
        assert mock_load.call_count == 1, "캐시 히트 시 데이터베이스 또는 네트워크 로더 호출 금지"
        assert t_cached < t_first + 0.05
        assert d1["results"] == d2["results"]


def test_s7_e2e_rebalance_backtest_acceleration():
    """S7-2: AI 스마트 리밸런서 시나리오 백테스터 캐싱 E2E 무결성 검증"""
    payload = {
        "holdings": [
            {"code": "069500", "amount": 10000000, "name": "KODEX 200", "category": "국내시장대표"}
        ],
        "period": "1Y",
        "defense_factor": 0.5,
        "safe_asset_code": "272580"
    }

    now_ts = pd.Timestamp.now()
    dates = pd.date_range(end=now_ts, periods=300, freq="B")
    mock_prices = pd.DataFrame(
        {
            "069500.KS": [30000.0 * (1 + 0.0002 * i) for i in range(300)],
            "272580.KS": [100000.0 * (1 + 0.0001 * i) for i in range(300)],
            "^KS11": [2500.0 * (1 + 0.0001 * i) for i in range(300)],
            "^GSPC": [4000.0 * (1 + 0.0002 * i) for i in range(300)],
        },
        index=dates
    )

    with patch("api.backtest.load_backtest_close_prices", new_callable=AsyncMock) as mock_load:
        mock_load.return_value = mock_prices

        # 1차 호출
        res1 = client.post("/api/v1/my/backtest/rebalance", json=payload)
        assert res1.status_code == 200
        d1 = res1.json()
        assert d1["status"] == "success"
        assert d1["cached"] is False
        assert "metrics" in d1
        assert "buy_and_hold" in d1["metrics"]
        assert "ai_rebalance" in d1["metrics"]

        # 2차 호출 (캐시 히트)
        res2 = client.post("/api/v1/my/backtest/rebalance", json=payload)
        assert res2.status_code == 200
        d2 = res2.json()
        assert d2["status"] == "success"
        assert d2["cached"] is True
        assert d1["metrics"] == d2["metrics"]


def test_s7_e2e_efficient_frontier_acceleration():
    """S7-2: 효율적 투자선 몬테카를로 최적화 캐싱 E2E 무결성 검증"""
    payload = {
        "holdings": [
            {"code": "069500", "amount": 5000000, "name": "KODEX 200", "category": "기타"},
            {"code": "379800", "amount": 5000000, "name": "TIGER 미국S&P500", "category": "기타"}
        ],
        "lookback_years": 1.0,
        "simulations": 500
    }

    mock_dates = [f"2023-01-{i:02d}" for i in range(1, 21)]
    mock_batch = {
        "069500.KS": {
            "dates": mock_dates,
            "prices": [30000.0 + i * 50 for i in range(20)],
            "last_price": 31000.0,
            "source": "db_hit"
        },
        "379800.KS": {
            "dates": mock_dates,
            "prices": [15000.0 + i * 30 for i in range(20)],
            "last_price": 15600.0,
            "source": "db_hit"
        }
    }

    with patch("api.efficient_frontier.get_hybrid_daily_prices_batch", new_callable=AsyncMock) as mock_batch:
        mock_batch.return_value = mock_batch

        # 1차 호출
        res1 = client.post("/api/v1/analyze/efficient-frontier", json=payload)
        assert res1.status_code == 200
        d1 = res1.json()
        assert d1["status"] == "success"
        assert d1["cached"] is False
        assert "max_sharpe" in d1

        # 2차 호출 (캐시 히트)
        res2 = client.post("/api/v1/analyze/efficient-frontier", json=payload)
        assert res2.status_code == 200
        d2 = res2.json()
        assert d2["status"] == "success"
        assert d2["cached"] is True
        assert d1["max_sharpe"] == d2["max_sharpe"]


def test_s7_e2e_kis_integrated_sync_resilience():
    """S7-3: 종합자산 ↔ KIS 양방향 매핑 및 계좌 메타데이터 무결성 검증"""
    # 1. KIS 매핑 목록 조회 시 4대 기본 계좌 노출 확인
    res_maps = client.get("/api/v1/my/kis-mappings")
    assert res_maps.status_code == 200
    maps_data = res_maps.json()
    assert len(maps_data) >= 4
    accs = [m["account_no"] for m in maps_data]
    assert "64490078-01" in accs
    assert "81060777-22" in accs

    # 2. 종합자산 엔드포인트 조회 시 kis_accounts 무결성 확인
    res_integrated = client.get("/api/v1/my/integrated-assets")
    assert res_integrated.status_code == 200
    int_data = res_integrated.json()
    assert int_data["status"] == "success"
    assert "kis_accounts" in int_data
    assert len(int_data["kis_accounts"]) >= 4
