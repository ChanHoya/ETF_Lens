"""ETF 배당(분배금) 수집기 및 API 종합 유닛 테스트 (S6-4)
"""

import pytest
import asyncio
from datetime import datetime
from httpx import AsyncClient, ASGITransport

from main import app
from db.database import AsyncSessionLocal
from db.models import ETFDividendHistory, ETFDividendSummary
from core.dividend_scraper import (
    normalize_symbol,
    calculate_dividend_summary,
    compute_portfolio_monthly_cashflow,
    scrape_and_save_etf_dividend,
    get_etf_dividend_detail,
)


def test_normalize_symbol():
    """심볼 정규화 및 통화 판정 테스트"""
    s_kr, c_kr = normalize_symbol("069500")
    assert s_kr == "069500.KS"
    assert c_kr == "KRW"

    s_us, c_us = normalize_symbol("schd")
    assert s_us == "SCHD"
    assert c_us == "USD"


def test_calculate_dividend_summary_frequency():
    """배당 주기 판별 및 요약 계산 단위 테스트"""
    # 1. 월배당 (12회)
    monthly_hist = [
        {"ex_date": f"2026-{m:02d}-15", "dividend_amount": 30.0, "currency": "KRW"}
        for m in range(1, 13)
    ]
    res_m = calculate_dividend_summary(
        code="453850",
        name="ACE 미국30년국채",
        history_list=monthly_hist,
        naver_info={"dividend_yield_ttm": 4.5, "price": 8000},
        yf_meta={"currency": "KRW"},
    )
    assert res_m["dividend_frequency"] == "MONTHLY"
    assert res_m["dividend_count_1y"] == 12
    assert res_m["annual_dividend_amount"] == 360.0
    assert res_m["dividend_yield_ttm"] == 4.5
    assert res_m["dividend_months"] == "1,2,3,4,5,6,7,8,9,10,11,12"

    # 2. 분기배당 (4회)
    quarterly_hist = [
        {"ex_date": "2026-01-30", "dividend_amount": 100.0, "currency": "KRW"},
        {"ex_date": "2026-04-29", "dividend_amount": 120.0, "currency": "KRW"},
        {"ex_date": "2026-07-30", "dividend_amount": 110.0, "currency": "KRW"},
        {"ex_date": "2026-10-30", "dividend_amount": 130.0, "currency": "KRW"},
    ]
    res_q = calculate_dividend_summary(
        code="069500",
        name="KODEX 200",
        history_list=quarterly_hist,
        naver_info={"dividend_yield_ttm": None, "price": 40000},
        yf_meta={"currency": "KRW"},
    )
    assert res_q["dividend_frequency"] == "QUARTERLY"
    assert res_q["dividend_count_1y"] == 4
    assert res_q["annual_dividend_amount"] == 460.0
    assert res_q["dividend_months"] == "1,4,7,10"
    # 자체 연산 배당수익률: (460 / 40000) * 100 = 1.15%
    assert res_q["dividend_yield_ttm"] == 1.15


def test_compute_portfolio_monthly_cashflow():
    """보유 포트폴리오 기반 월별 캐시플로우 산출 테스트"""
    holdings = [
        {"code": "453850", "shares": 1000},  # 월 25원 * 1000주 = 월 25,000원
        {"code": "SCHD", "shares": 100},     # 3,6,9,12월 주당 $0.75 * 100주 = 분기 $75
    ]
    summaries = {
        "453850": {
            "name": "ACE 미국30년국채",
            "currency": "KRW",
            "dividend_frequency": "MONTHLY",
            "last_dividend_amount": 25.0,
            "annual_dividend_amount": 300.0,
            "dividend_months": "1,2,3,4,5,6,7,8,9,10,11,12",
            "dividend_yield_ttm": 4.2,
        },
        "SCHD": {
            "name": "Schwab US Dividend",
            "currency": "USD",
            "dividend_frequency": "QUARTERLY",
            "last_dividend_amount": 0.75,
            "annual_dividend_amount": 3.0,
            "dividend_months": "3,6,9,12",
            "dividend_yield_ttm": 3.5,
        },
    }

    cf = compute_portfolio_monthly_cashflow(holdings, summaries)
    assert len(cf["monthly_cashflow_krw"]) == 12
    assert len(cf["monthly_cashflow_usd"]) == 12
    # 1월 KRW 배당금: 25,000원
    assert cf["monthly_cashflow_krw"][0] == 25000
    # 3월 USD 배당금: $75.0
    assert cf["monthly_cashflow_usd"][2] == 75.0
    # 연간 총액
    assert cf["total_annual_krw"] == 300000.0
    assert cf["total_annual_usd"] == 300.0


@pytest.mark.asyncio
async def test_get_dividend_detail_api():
    """FastAPI GET /api/v1/dividends/{code} 엔드포인트 테스트"""
    transport = ASGITransport(app=app)
    async with AsyncClient(transport=transport, base_url="http://test") as client:
        # 453850 (ACE 미국30년국채) 조회
        resp = await client.get("/api/v1/dividends/453850")
        assert resp.status_code == 200
        data = resp.json()
        assert data["status"] == "success"
        assert "summary" in data
        assert data["summary"]["code"] == "453850"
        assert data["summary"]["dividend_frequency"] == "MONTHLY"
        assert "history" in data
        assert len(data["history"]) > 0


@pytest.mark.asyncio
async def test_portfolio_cashflow_api():
    """FastAPI POST /api/v1/dividends/portfolio-cashflow 엔드포인트 테스트"""
    transport = ASGITransport(app=app)
    async with AsyncClient(transport=transport, base_url="http://test") as client:
        payload = {
            "holdings": [
                {"code": "453850", "shares": 500, "name": "ACE미국30년"}
            ]
        }
        resp = await client.post("/api/v1/dividends/portfolio-cashflow", json=payload)
        assert resp.status_code == 200
        data = resp.json()
        assert data["status"] == "success"
        assert "monthly_cashflow_krw" in data
        assert len(data["monthly_cashflow_krw"]) == 12
        assert data["total_annual_krw"] > 0


@pytest.mark.asyncio
async def test_dividend_rankings_api():
    """FastAPI GET /api/v1/dividends/rankings 엔드포인트 테스트"""
    transport = ASGITransport(app=app)
    async with AsyncClient(transport=transport, base_url="http://test") as client:
        resp = await client.get("/api/v1/dividends/rankings?frequency=MONTHLY&limit=10")
        assert resp.status_code == 200
        data = resp.json()
        assert data["status"] == "success"
        assert "rankings" in data
