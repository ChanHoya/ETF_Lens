# backend/tests/test_real_estate.py
"""
부동산 인텔리전스 API 및 수집기 단위 테스트
- sample 키 및 미설정 키에 대한 안전한 Fallback Cache 작동 검증
- 1Y / 2Y / ALL 기간 필터링 및 시계열 무결성 검증
- 4대 거시 지표 서머리 반환 검증
"""

import pytest
import os
from unittest.mock import patch
from fastapi.testclient import TestClient

from main import app
from core.real_estate_collector import real_estate_collector, FALLBACK_MONTHLY_DATASET

client = TestClient(app)


def test_real_estate_fallback_detection():
    """SEOUL_OPEN_DATA_KEY가 없거나 'sample'일 때 fallback 감지 검증"""
    with patch.dict(os.environ, {"SEOUL_OPEN_DATA_KEY": "sample"}):
        collector = real_estate_collector.__class__()
        collector.api_key = "sample"
        assert collector.is_sample_or_missing is True

    with patch.dict(os.environ, {"SEOUL_OPEN_DATA_KEY": ""}):
        collector = real_estate_collector.__class__()
        collector.api_key = ""
        assert collector.is_sample_or_missing is True


def test_real_estate_status_endpoint():
    """GET /api/v1/real-estate/status 엔드포인트 응답 검증"""
    res = client.get("/api/v1/real-estate/status")
    assert res.status_code == 200
    data = res.json()
    assert data["status"] == "ready"
    assert "api_mode" in data
    assert "notice" in data


def test_real_estate_market_trends_all():
    """GET /api/v1/real-estate/market-trends?period=ALL 검증"""
    res = client.get("/api/v1/real-estate/market-trends?period=ALL")
    assert res.status_code == 200
    payload = res.json()
    assert payload["period"] == "ALL"
    assert len(payload["data"]) >= 30
    first_item = payload["data"][0]
    last_item = payload["data"][-1]
    assert "month" in first_item
    assert "listings" in first_item
    assert "volume" in first_item
    assert first_item["month"] == "24.01"
    assert last_item["month"] == "26.10"


def test_real_estate_market_trends_1y():
    """GET /api/v1/real-estate/market-trends?period=1Y 12개월 슬라이싱 검증"""
    res = client.get("/api/v1/real-estate/market-trends?period=1Y")
    assert res.status_code == 200
    payload = res.json()
    assert payload["period"] == "1Y"
    assert len(payload["data"]) == 12
    assert payload["data"][-1]["month"] == "26.10"


def test_real_estate_market_trends_2y():
    """GET /api/v1/real-estate/market-trends?period=2Y 24개월 슬라이싱 검증"""
    res = client.get("/api/v1/real-estate/market-trends?period=2Y")
    assert res.status_code == 200
    payload = res.json()
    assert payload["period"] == "2Y"
    assert len(payload["data"]) == 24


def test_real_estate_summary():
    """GET /api/v1/real-estate/summary 4대 지표 요약 검증"""
    res = client.get("/api/v1/real-estate/summary")
    assert res.status_code == 200
    summary = res.json()
    assert "active_listings" in summary
    assert "monthly_trade_volume" in summary
    assert "mortgage_rate" in summary
    assert "pir_ratio" in summary
    assert summary["latest_month"] in ("2026.10", "26.10")
