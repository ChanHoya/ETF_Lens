import pytest
from unittest.mock import patch
import pandas as pd
import numpy as np
from fastapi.testclient import TestClient
from main import app

client = TestClient(app)

def test_efficient_frontier_missing_holdings():
    response = client.post("/api/v1/analyze/efficient-frontier", json={
        "holdings": [],
        "lookback_years": 1.0,
        "risk_free_rate": 3.0,
        "simulations": 1000
    })
    assert response.status_code == 400
    assert "포트폴리오 자산이 비어있습니다" in response.json()["detail"]

def test_efficient_frontier_insufficient_holdings():
    response = client.post("/api/v1/analyze/efficient-frontier", json={
        "holdings": [
            {"code": "CASH", "amount": 10000000, "name": "현금"},
            {"code": "005930", "amount": 5000000, "name": "삼성전자"}
        ],
        "lookback_years": 1.0,
        "risk_free_rate": 3.0,
        "simulations": 1000
    })
    assert response.status_code == 400
    assert "최적화를 위해서는 최소 2개 이상의 위험 자산" in response.json()["detail"]

# Mock fetch_ticker_prices
def mock_fetch_ticker_prices(symbol, start_str, end_str):
    # Return a pandas series with some fake upward trend closes
    dates = pd.date_range(start=start_str, end=end_str, freq="B").date
    np.random.seed(42 if "AAPL" in symbol else 24)
    # Generate random walk prices starting at 100
    returns = np.random.normal(0.0005, 0.015, len(dates))
    prices = 100.0 * np.exp(np.cumsum(returns))
    return pd.Series(prices, index=dates)

@patch("api.efficient_frontier.fetch_ticker_prices", side_effect=mock_fetch_ticker_prices)
def test_efficient_frontier_success(mock_fetch):
    response = client.post("/api/v1/analyze/efficient-frontier", json={
        "holdings": [
            {"code": "AAPL", "amount": 6000000, "name": "Apple"},
            {"code": "MSFT", "amount": 4000000, "name": "Microsoft"}
        ],
        "lookback_years": 1.0,
        "risk_free_rate": 3.0,
        "simulations": 1000
    })
    
    assert response.status_code == 200
    data = response.json()
    assert data["status"] == "success"
    assert "tickers" in data
    assert "AAPL" in data["tickers"]
    assert "MSFT" in data["tickers"]
    
    assert "max_sharpe" in data
    assert "min_var" in data
    assert "current" in data
    assert "frontier" in data
    assert "scatter" in data
    
    # Check max_sharpe return is higher than or equal to min_var
    assert data["max_sharpe"]["sharpe"] >= data["min_var"]["sharpe"]
    
    # Check weights sum up to ~1.0
    ms_weights = data["max_sharpe"]["weights"]
    assert abs(sum(ms_weights.values()) - 1.0) < 1e-4
    
    mv_weights = data["min_var"]["weights"]
    assert abs(sum(mv_weights.values()) - 1.0) < 1e-4
    
    curr_weights = data["current"]["weights"]
    assert abs(sum(curr_weights.values()) - 1.0) < 1e-4
    
    # Validate structure of frontier and scatter
    assert len(data["frontier"]) > 0
    assert len(data["scatter"]) > 0
    
    for pt in data["frontier"]:
        assert "return" in pt
        assert "volatility" in pt
        assert "sharpe" in pt
        assert "weights" in pt
