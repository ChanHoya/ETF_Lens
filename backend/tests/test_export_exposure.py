# 포트폴리오 수출 노출도 분석 엔진, 무역수지 시계열, 텔레그램 인라인 인터랙션 단위 테스트
import sys
import os
sys.path.insert(0, os.path.abspath(os.path.join(os.path.dirname(__file__), '..')))

import pytest
from fastapi.testclient import TestClient
from main import app
from core.export_exposure import analyze_portfolio_export_exposure

client = TestClient(app)

def test_analyze_portfolio_export_exposure_basic():
    """포트폴리오 수출 노출도 엔진이 정상적으로 6대 업종 가중치를 산출하는지 검증"""
    holdings = [
        {"name": "삼성전자", "code": "005930", "eval_amount": 10000000},
        {"name": "현대차", "code": "005380", "eval_amount": 5000000},
        {"name": "LG화학", "code": "051910", "eval_amount": 3000000},
        {"name": "삼성바이오로직스", "code": "207940", "eval_amount": 2000000},
    ]
    result = analyze_portfolio_export_exposure(holdings)
    
    assert "total_eval_amt" in result
    assert result["total_eval_amt"] == 20000000
    assert result["total_export_exposure"] > 0
    assert "industry_exposures" in result
    assert len(result["industry_exposures"]) == 6
    assert "fit_score" in result
    assert 0 <= result["fit_score"] <= 100
    assert result["status_level"] in ["HIGH", "BALANCED", "UNDERWEIGHT"]

def test_analyze_portfolio_export_exposure_tff_format():
    """TFF 공동 펀드 자산 포맷(endValue, weight) 호환 검증"""
    tff_holdings = [
        {"name": "KODEX 200", "code": "069500", "endValue": 15000000, "weight": 50.0},
        {"name": "TIGER 반도체", "code": "091230", "endValue": 10000000, "weight": 33.3},
        {"name": "KODEX 2차전지산업", "code": "305720", "endValue": 5000000, "weight": 16.7},
    ]
    result = analyze_portfolio_export_exposure(tff_holdings)
    assert result["total_eval_amt"] == 30000000
    assert result["total_export_exposure"] > 10.0
    # 반도체와 배터리 비중이 포함되어 있는지 확인
    ind_map = {item["id"]: item for item in result["industry_exposures"]}
    assert ind_map["semiconductor"]["weight"] > 0
    assert ind_map["bio_battery"]["weight"] > 0

def test_api_portfolio_export_exposure_get():
    """GET /api/v1/macro/portfolio-export-exposure 엔드포인트 동작 검증"""
    # 1. source=my
    res_my = client.get("/api/v1/macro/portfolio-export-exposure?source=my")
    assert res_my.status_code == 200
    data_my = res_my.json()
    assert "total_export_exposure" in data_my
    assert "industry_exposures" in data_my
    assert data_my["source"] == "my"
    
    # 2. source=tff
    res_tff = client.get("/api/v1/macro/portfolio-export-exposure?source=tff")
    assert res_tff.status_code == 200
    data_tff = res_tff.json()
    assert "total_export_exposure" in data_tff
    assert "industry_exposures" in data_tff
    assert data_tff["source"] == "tff"

def test_api_portfolio_export_exposure_post():
    """POST /api/v1/macro/portfolio-export-exposure 커스텀 페이로드 검증"""
    payload = {
        "holdings": [
            {"name": "SK하이닉스", "code": "000660", "eval_amount": 7000000},
            {"name": "HD현대중공업", "code": "329180", "eval_amount": 3000000},
        ]
    }
    res = client.post("/api/v1/macro/portfolio-export-exposure", json=payload)
    assert res.status_code == 200
    data = res.json()
    assert "total_export_exposure" in data
    assert data["total_eval_amt"] == 10000000

def test_api_kr_trade_balance():
    """GET /api/v1/exit-signal/macro/kr/trade-balance 무역수지 시계열 검증"""
    res = client.get("/api/v1/exit-signal/macro/kr/trade-balance")
    assert res.status_code == 200
    data = res.json()
    assert data["status"] == "success"
    assert "data" in data
    assert len(data["data"]) > 0
    latest = data["data"][-1]
    assert "export_amt" in latest
    assert "import_amt" in latest
    assert "trade_balance" in latest
    assert "terms_of_trade" in latest
    assert "latest" in data

def test_telegram_callback_queries():
    """텔레그램 callback_query (플레이북 및 노출도 진단) 응답 검증"""
    # 1. 플레이북 버튼 클릭 시뮬레이션
    cb_playbook = {
        "update_id": 99901,
        "callback_query": {
            "id": "cb_001",
            "from": {"id": 12345678, "first_name": "Tester"},
            "message": {"chat": {"id": 12345678}, "message_id": 101},
            "data": "macro_playbook:semiconductor"
        }
    }
    res1 = client.post("/api/v1/telegram/webhook", json=cb_playbook)
    assert res1.status_code == 200
    assert res1.json()["action"] == "playbook_semiconductor"

    # 2. 내 포트폴리오 노출도 버튼 클릭 시뮬레이션
    cb_exposure = {
        "update_id": 99902,
        "callback_query": {
            "id": "cb_002",
            "from": {"id": 12345678, "first_name": "Tester"},
            "message": {"chat": {"id": 12345678}, "message_id": 102},
            "data": "macro_exposure:my"
        }
    }
    res2 = client.post("/api/v1/telegram/webhook", json=cb_exposure)
    assert res2.status_code == 200
    assert res2.json()["action"] == "exposure_checked"
