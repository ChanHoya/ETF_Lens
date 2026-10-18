import pytest
from core.macro_portfolio_bridge import classify_holding_macro_factor, calculate_portfolio_macro_sensitivity

def test_classify_holding_macro_factor():
    # 1. 미국 환노출 ETF
    h1 = {"code": "379800", "name": "KODEX 미국S&P500TR"}
    meta1 = classify_holding_macro_factor(h1)
    assert meta1["currency_exposure"] == "USD"
    assert meta1["is_hedged"] is False
    assert meta1["asset_class"] == "EQUITY"

    # 2. 미국 환헤지 ETF
    h2 = {"code": "449190", "name": "ACE 미국S&P500(H)"}
    meta2 = classify_holding_macro_factor(h2)
    assert meta2["currency_exposure"] == "HEDGED"
    assert meta2["is_hedged"] is True

    # 3. 미국채 30년 초장기 채권
    h3 = {"code": "453850", "name": "ACE 미국30년국채액티브"}
    meta3 = classify_holding_macro_factor(h3)
    assert meta3["currency_exposure"] == "USD"
    assert meta3["asset_class"] == "BOND"
    assert meta3["estimated_duration"] >= 15.0

    # 4. 국내 순수 주식
    h4 = {"code": "069500", "name": "KODEX 200"}
    meta4 = classify_holding_macro_factor(h4)
    assert meta4["currency_exposure"] == "KRW"
    assert meta4["estimated_duration"] == 0.0

def test_calculate_portfolio_macro_sensitivity():
    holdings = [
        {"code": "379800", "name": "KODEX 미국S&P500TR", "eval_amount": 50000000},  # 5,000만 USD 노출
        {"code": "449190", "name": "ACE 미국S&P500(H)", "eval_amount": 20000000},   # 2,000만 환헤지
        {"code": "069500", "name": "KODEX 200", "eval_amount": 30000000},          # 3,000만 KRW 노출
    ]
    # 총자산 1억
    res = calculate_portfolio_macro_sensitivity(holdings, current_fx=1360.0)
    assert res["total_eval"] == 100000000.0
    assert res["usd_exposure_ratio"] == 50.0
    assert res["hedged_ratio"] == 20.0
    assert res["krw_exposure_ratio"] == 30.0
    assert len(res["scenario_results"]) >= 4
    assert len(res["top_fx_beneficiaries"]) >= 1
    assert res["top_fx_beneficiaries"][0]["name"] == "KODEX 미국S&P500TR"
