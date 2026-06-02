import pytest
from unittest.mock import patch, AsyncMock
from fastapi.testclient import TestClient
from main import app

client = TestClient(app)

def mock_fetch_yahoo_v8_history(symbol, days=370):
    # Return some mock stock history
    import datetime
    base_date = datetime.date(2026, 6, 2)
    result = []
    # Start price at 100 for large_cap and 105 for small_cap or similar
    price = 100.0
    for i in range(days):
        dt = base_date - datetime.timedelta(days=(days - i))
        # Add a small drift
        price += 0.05
        result.append({
            "date": dt.strftime("%Y-%m-%d"),
            "close": price
        })
    return result

def mock_fetch_naver_stock_fundamentals(code):
    return {
        "per": 10.0,
        "pbr": 1.2,
        "roe": 12.0,
        "div_yield": 2.5,
        "market_cap_str": "1조 5,000억원",
        "close": 50000.0
    }

@patch("api.next_leader._fetch_yahoo_v8_history", side_effect=mock_fetch_yahoo_v8_history)
def test_get_polarization_ratio(mock_yahoo):
    response = client.get("/api/v1/analyze/polarization")
    assert response.status_code == 200
    data = response.json()
    assert data["status"] == "success"
    assert "chart" in data
    assert "spread_now" in data
    assert len(data["chart"]) > 0
    # Check key structure of the chart entries
    entry = data["chart"][0]
    assert "date" in entry
    assert "large_cap_close" in entry
    assert "small_cap_close" in entry
    assert "large_cap_return" in entry
    assert "small_cap_return" in entry
    assert "spread" in entry

@patch("api.next_leader._fetch_yahoo_v8_history", side_effect=mock_fetch_yahoo_v8_history)
def test_get_m7_capex_and_semi_temp(mock_yahoo):
    response = client.get("/api/v1/analyze/m7-capex")
    assert response.status_code == 200
    data = response.json()
    assert data["status"] == "success"
    assert "capex_chart" in data
    assert "semiconductor_temp" in data
    
    # Check temp structure
    temp = data["semiconductor_temp"]
    assert "samsung" in temp
    assert "hynix" in temp
    assert "average_distance_pct" in temp
    assert "signal" in temp
    assert "signal_level" in temp

# We need to mock ETFHarvester as well to prevent real browser initialization
@patch("api.next_leader._fetch_yahoo_v8_history", side_effect=mock_fetch_yahoo_v8_history)
@patch("api.next_leader._fetch_naver_stock_fundamentals", side_effect=mock_fetch_naver_stock_fundamentals)
@patch("api.next_leader.ETFHarvester")
def test_get_next_leader_screener(mock_harvester_class, mock_naver, mock_yahoo):
    # Setup mock harvester instance
    mock_harvester = AsyncMock()
    mock_harvester_class.return_value = mock_harvester
    
    # ETFHarvester.fetch_naver_etf_data returns dict with holdings
    mock_harvester.fetch_naver_etf_data.return_value = {
        "holdings": [
            {"ticker": "한화오션", "weight": 10.0},
            {"ticker": "삼성중공업", "weight": 8.5},
            {"ticker": "한화에어로스페이스", "weight": 12.0},
            {"ticker": "두산에너빌리티", "weight": 15.0},
            {"ticker": "효성중공업", "weight": 9.0},
            {"ticker": "삼성SDI", "weight": 11.0},
            {"ticker": "셀트리온", "weight": 14.0},
            {"ticker": "한미반도체", "weight": 13.0},
            {"ticker": "JYP Ent.", "weight": 8.0},
            {"ticker": "한국콜마", "weight": 7.5},
            {"ticker": "엔씨소프트", "weight": 6.5}
        ]
    }
    
    response = client.get("/api/v1/analyze/screener")
    assert response.status_code == 200
    data = response.json()
    assert data["status"] == "success"
    assert "sectors" in data
    assert "kospi_6m_return" in data
    
    # Verify sectors are in the response
    sectors = data["sectors"]
    assert "조선" in sectors
    assert "방산" in sectors
    assert "원자력" in sectors
    
    # Verify top stock entries have quant scores and fundamentals
    first_sector_stocks = sectors["조선"]
    if len(first_sector_stocks) > 0:
        stock = first_sector_stocks[0]
        assert "name" in stock
        assert "code" in stock
        assert "quant_score" in stock
        assert "fundamental_score" in stock
        assert "technical_score" in stock
        assert "per" in stock
        assert "roe" in stock
