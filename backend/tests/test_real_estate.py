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
    assert summary["latest_month"] in ("2026.10", "26.10")


def test_real_estate_districts_all():
    """GET /api/v1/real-estate/districts 서울 및 수도권 전체 38개 거점 및 갭투자 위험단지 반환 검증"""
    res = client.get("/api/v1/real-estate/districts")
    assert res.status_code == 200
    data = res.json()
    assert "meta" in data
    assert "districts" in data
    assert "risk_complexes" in data
    assert len(data["districts"]) == 38
    assert len(data["risk_complexes"]) >= 8
    assert data["meta"]["total_districts"] == 38
    assert data["meta"]["avg_seoul_jeonse_ratio"] > 50.0
    assert data["meta"]["avg_gyeonggi_jeonse_ratio"] > 50.0
    assert data["meta"]["avg_incheon_jeonse_ratio"] > 60.0

    # 필수 필드 무결성 확인
    gangnam = next(d for d in data["districts"] if d["name"] == "강남구")
    assert gangnam["avg_sale_price"] > 20.0
    assert gangnam["risk_level"] == "prime"

    bundang = next(d for d in data["districts"] if "분당구" in d["name"])
    assert bundang["region"] == "gyeonggi"
    assert bundang["avg_sale_price"] > 15.0

    songdo = next(d for d in data["districts"] if "송도" in d["name"])
    assert songdo["region"] == "incheon"


def test_real_estate_districts_filtering_and_sorting():
    """GET /api/v1/real-estate/districts 광역 지역 및 권역 필터, 정렬 옵션 검증"""
    # 1. region=seoul 서울 25개 구 필터
    res_seoul = client.get("/api/v1/real-estate/districts?region=seoul")
    assert res_seoul.status_code == 200
    assert len(res_seoul.json()["districts"]) == 25

    # 2. region=gyeonggi 경기 10개 핵심지 필터
    res_gyeonggi = client.get("/api/v1/real-estate/districts?region=gyeonggi")
    assert res_gyeonggi.status_code == 200
    assert len(res_gyeonggi.json()["districts"]) == 10

    # 3. region=incheon 인천 3개 거점 필터
    res_incheon = client.get("/api/v1/real-estate/districts?region=incheon")
    assert res_incheon.status_code == 200
    assert len(res_incheon.json()["districts"]) == 3

    # 4. gangnam_plus 권역 필터
    res_zone = client.get("/api/v1/real-estate/districts?zone=gangnam_plus")
    assert res_zone.status_code == 200
    data_zone = res_zone.json()
    assert len(data_zone["districts"]) == 4
    names = {d["name"] for d in data_zone["districts"]}
    assert names == {"강남구", "서초구", "송파구", "용산구"}

    # 5. price_desc 매매가순 정렬
    res_price = client.get("/api/v1/real-estate/districts?sort_by=price_desc")
    assert res_price.status_code == 200
    districts_price = res_price.json()["districts"]
    assert districts_price[0]["name"] == "강남구"
    assert districts_price[0]["avg_sale_price"] >= districts_price[1]["avg_sale_price"]

    # 6. jeonse_desc 전세가율 역순 정렬
    res_jeonse = client.get("/api/v1/real-estate/districts?sort_by=jeonse_desc")
    assert res_jeonse.status_code == 200
    districts_jeonse = res_jeonse.json()["districts"]
    assert districts_jeonse[0]["risk_level"] == "critical"
    assert districts_jeonse[0]["jeonse_ratio"] >= districts_jeonse[1]["jeonse_ratio"]


