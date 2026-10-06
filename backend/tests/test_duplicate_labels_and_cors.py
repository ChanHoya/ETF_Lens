import pytest
import pandas as pd
import numpy as np
from unittest.mock import patch, AsyncMock
from fastapi.testclient import TestClient

from main import app
from core.hybrid_series import get_hybrid_daily_prices
from api.backtest import load_backtest_close_prices


@pytest.fixture
def client():
    return TestClient(app)


def test_cors_headers_for_localhost_3005(client):
    """http://localhost:3005 및 다중 포트에서 CORS가 정상 허용되는지 검증"""
    headers = {
        "Origin": "http://localhost:3005",
        "Access-Control-Request-Method": "POST",
        "Access-Control-Request-Headers": "Content-Type",
    }
    response = client.options("/api/v1/analyze/efficient-frontier", headers=headers)
    assert response.status_code == 200
    assert response.headers.get("access-control-allow-origin") == "http://localhost:3005"


@pytest.mark.asyncio
async def test_load_backtest_close_prices_strips_duplicate_labels():
    """중복 날짜 레이블이 포함된 데이터가 공급되어도 인덱스 유일성이 보장되는지 검증"""
    # 의도적으로 동일 날짜("2024-01-02")가 2번 들어간 mock batch data
    mock_batch = {
        "069500.KS": {
            "dates": ["2024-01-01", "2024-01-02", "2024-01-02", "2024-01-03", "2024-01-04", "2024-01-05"],
            "prices": [100.0, 101.0, 102.0, 103.0, 104.0, 105.0]
        },
        "^KS11": {
            "dates": ["2024-01-01", "2024-01-02", "2024-01-03", "2024-01-04", "2024-01-05"],
            "prices": [2000.0, 2010.0, 2020.0, 2030.0, 2040.0]
        }
    }

    with patch("api.backtest.get_hybrid_daily_prices_batch", new_callable=AsyncMock) as mock_get_batch:
        mock_get_batch.return_value = mock_batch
        df = await load_backtest_close_prices(["069500.KS", "^KS11"], db=None, days=365)
        
        assert not df.empty
        # 인덱스에 중복 라벨이 없어야 함
        assert df.index.is_unique
        assert len(df.index) == 5  # 2024-01-01 ~ 2024-01-05 (2024-01-02 중복 제거됨)
        # 마지막 값(102.0)이 유지되었는지 확인
        assert df.loc[pd.Timestamp("2024-01-02"), "069500.KS"] == 102.0


def test_run_backtest_with_duplicate_labels_in_series(client):
    """일반 백테스터: 중복 라벨이 있어도 cannot reindex on an axis with duplicate labels 없이 성공해야 함"""
    # 100일치 데이터 생성 (일부 중복 날짜 포함)
    dates = pd.date_range("2023-01-01", periods=100, freq="D").tolist()
    dates.insert(10, dates[10]) # 중복 날짜 의도적 주입
    
    prices1 = np.linspace(100, 150, len(dates)).tolist()
    prices2 = np.linspace(2000, 2500, len(dates)).tolist()

    mock_batch = {
        "069500.KS": {"dates": [d.strftime("%Y-%m-%d") for d in dates], "prices": prices1},
        "^KS11": {"dates": [d.strftime("%Y-%m-%d") for d in dates], "prices": prices2},
        "^KQ11": {"dates": [d.strftime("%Y-%m-%d") for d in dates], "prices": prices2},
        "^GSPC": {"dates": [d.strftime("%Y-%m-%d") for d in dates], "prices": prices2},
        "^IXIC": {"dates": [d.strftime("%Y-%m-%d") for d in dates], "prices": prices2},
    }

    with patch("api.backtest.get_hybrid_daily_prices_batch", new_callable=AsyncMock) as mock_get_batch:
        mock_get_batch.return_value = mock_batch
        payload = {
            "holdings": [
                {"code": "069500", "name": "KODEX 200", "amount": 1000000, "category": "국내주식"}
            ]
        }
        res = client.post("/api/v1/my/backtest/run", json=payload)
        assert res.status_code == 200
        data = res.json()
        assert "results" in data
        assert "chart_data" in data


def test_run_rebalance_backtest_3y_period_with_duplicates(client):
    """AI 리밸런싱 백테스터: 3Y 기간 선택 및 중복 날짜 데이터가 있어도 정상 연산되는지 검증"""
    # 3년(1100일)치 데이터 생성
    dates = pd.date_range(end="2026-10-06", periods=1100, freq="D").tolist()
    dates.insert(50, dates[50]) # 중복 주입
    dates.insert(200, dates[200]) # 중복 주입

    prices_kodex = np.linspace(10000, 15000, len(dates)).tolist()
    prices_safe = np.linspace(100000, 105000, len(dates)).tolist()
    prices_bm1 = np.linspace(2500, 3000, len(dates)).tolist()
    prices_bm2 = np.linspace(4000, 5000, len(dates)).tolist()

    date_strs = [d.strftime("%Y-%m-%d") for d in dates]
    mock_batch = {
        "069500.KS": {"dates": date_strs, "prices": prices_kodex},
        "272580.KS": {"dates": date_strs, "prices": prices_safe},
        "^KS11": {"dates": date_strs, "prices": prices_bm1},
        "^GSPC": {"dates": date_strs, "prices": prices_bm2},
    }

    with patch("api.backtest.get_hybrid_daily_prices_batch", new_callable=AsyncMock) as mock_get_batch:
        mock_get_batch.return_value = mock_batch
        payload = {
            "holdings": [
                {"code": "069500", "name": "KODEX 200", "amount": 1000000, "category": "국내주식"}
            ],
            "period": "3Y",
            "defense_factor": 0.5,
            "safe_asset_code": "272580"
        }
        res = client.post("/api/v1/my/backtest/rebalance", json=payload)
        assert res.status_code == 200
        data = res.json()
        assert "timeline" in data
        assert len(data["timeline"]) > 50  # 다운샘플링 후 약 100여 개 포인트
        assert "metrics" in data
        assert "ai_rebalance" in data["metrics"]


def test_efficient_frontier_with_duplicate_labels(client):
    """포트폴리오 최적화: 중복 라벨 포함 데이터 공급 시에도 200 성공 및 프론티어 정상 산출 검증"""
    dates = pd.date_range(end="2026-10-06", periods=300, freq="D").tolist()
    dates.insert(25, dates[25])

    date_strs = [d.strftime("%Y-%m-%d") for d in dates]
    prices1 = (100 + np.cumsum(np.random.normal(0.05, 1.0, len(dates)))).tolist()
    prices2 = (200 + np.cumsum(np.random.normal(0.03, 0.8, len(dates)))).tolist()

    mock_batch = {
        "069500.KS": {"dates": date_strs, "prices": prices1},
        "005930.KS": {"dates": date_strs, "prices": prices2},
    }

    with patch("api.efficient_frontier.get_hybrid_daily_prices_batch", new_callable=AsyncMock) as mock_get_batch:
        mock_get_batch.return_value = mock_batch
        payload = {
            "holdings": [
                {"code": "069500", "name": "KODEX 200", "amount": 5000000, "category": "국내주식"},
                {"code": "005930", "name": "삼성전자", "amount": 5000000, "category": "국내주식"}
            ],
            "lookback_years": 1.0,
            "risk_free_rate": 3.0,
            "simulations": 1000
        }
        res = client.post("/api/v1/analyze/efficient-frontier", json=payload)
        assert res.status_code == 200
        data = res.json()
        assert "frontier" in data
        assert "max_sharpe" in data
        assert "scatter" in data
