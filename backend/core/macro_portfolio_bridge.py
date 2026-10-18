"""
Macro-Portfolio Sensitivity Bridge Engine
거시경제 지표(환율, 금리) 변동에 따른 사용자 실시간 포트폴리오 민감도(Beta) 및 스트레스 시뮬레이션 엔진
"""
from typing import Dict, List, Any, Optional
import re
import logging

logger = logging.getLogger(__name__)


def classify_holding_macro_factor(holding: Dict[str, Any]) -> Dict[str, Any]:
    """
    종목명과 종목 코드를 기반으로 환노출 여부, 자산군, 추정 듀레이션을 분류합니다.
    """
    name = holding.get("name", "")
    code = str(holding.get("code", ""))
    
    # 1. 해외 직접 투자 (티커가 알파벳인 경우)
    is_overseas_stock = bool(re.match(r'^[A-Za-z]+$', code))
    
    # 2. 환헤지 (H) 여부 체크
    is_hedged = bool(re.search(r'\(H\)| H$|H\(합성\)', name, re.IGNORECASE))
    
    # 3. 미국/글로벌 기초자산 여부 판별
    is_us_or_global = bool(re.search(
        r'미국|S&P|나스닥|Nasdaq|글로벌|다우|필라델피아|반도체TOP|테크TOP|빅테크|혁신|배당다우존스|차이나|인도|유로|일본|니케이',
        name, re.IGNORECASE
    )) or is_overseas_stock
    
    # 4. 환노출 여부 결정
    if is_hedged:
        currency_exposure = "HEDGED"
    elif is_us_or_global:
        currency_exposure = "USD"
    else:
        currency_exposure = "KRW"
        
    # 5. 자산군 및 채권 듀레이션 추정
    asset_class = "EQUITY"
    duration = 0.0
    
    if re.search(r'채권|국채|미국채|회사채|단기채|Bond|Treasury|KOFR|SOFR|CD금리|머니마켓', name, re.IGNORECASE):
        asset_class = "BOND"
        if re.search(r'30년|초장기|STRIP', name):
            duration = 17.5
        elif re.search(r'10년', name):
            duration = 7.8
        elif re.search(r'3년|5년', name):
            duration = 3.2
        elif re.search(r'단기|1년|KOFR|SOFR|CD', name):
            duration = 0.3
        else:
            duration = 4.5
    elif re.search(r'리츠|REIT|부동산', name, re.IGNORECASE):
        asset_class = "REAL_ESTATE"
        duration = 2.0  # 금리 민감 자산
    elif re.search(r'금|골드|원유|원자재|구리|농산물', name, re.IGNORECASE):
        asset_class = "COMMODITY"
    else:
        asset_class = "EQUITY"

    return {
        "currency_exposure": currency_exposure,
        "is_hedged": is_hedged,
        "asset_class": asset_class,
        "estimated_duration": duration
    }


def calculate_portfolio_macro_sensitivity(
    holdings: List[Dict[str, Any]],
    current_fx: float = 1360.0,
    target_fx: Optional[float] = None,
    current_kr_yield: float = 3.85,
    current_us_yield: float = 4.15,
    delta_yield_bp: float = 0.0
) -> Dict[str, Any]:
    """
    포트폴리오의 환율·금리 민감도 및 시나리오 충격 분석을 수행합니다.
    """
    total_eval = sum(float(h.get("eval_amount", 0.0)) for h in holdings)
    if total_eval <= 0:
        return {
            "total_eval": 0.0,
            "usd_exposure_ratio": 0.0,
            "krw_exposure_ratio": 100.0,
            "hedged_ratio": 0.0,
            "bond_ratio": 0.0,
            "average_duration": 0.0,
            "scenario_results": [],
            "top_fx_beneficiaries": [],
            "top_rate_vulnerabilities": []
        }

    enriched = []
    usd_eval = 0.0
    hedged_eval = 0.0
    krw_eval = 0.0
    bond_eval = 0.0
    weighted_duration_sum = 0.0

    for h in holdings:
        eval_amt = float(h.get("eval_amount", 0.0))
        meta = classify_holding_macro_factor(h)
        
        c_exp = meta["currency_exposure"]
        if c_exp == "USD":
            usd_eval += eval_amt
        elif c_exp == "HEDGED":
            hedged_eval += eval_amt
        else:
            krw_eval += eval_amt
            
        if meta["asset_class"] == "BOND":
            bond_eval += eval_amt
            weighted_duration_sum += eval_amt * meta["estimated_duration"]
            
        enriched.append({
            **h,
            **meta,
            "weight": round(eval_amt / total_eval * 100, 2)
        })

    usd_ratio = round(usd_eval / total_eval * 100, 1)
    hedged_ratio = round(hedged_eval / total_eval * 100, 1)
    krw_ratio = round(krw_eval / total_eval * 100, 1)
    bond_ratio = round(bond_eval / total_eval * 100, 1)
    avg_duration = round(weighted_duration_sum / total_eval, 2) if total_eval > 0 else 0.0

    # 프리셋 시나리오 4종
    scenarios = [
        {"name": "원화 강세 (환율 1,300원)", "fx": 1300.0, "delta_rate_bp": 0.0},
        {"name": "현재 수준 (기준)", "fx": current_fx, "delta_rate_bp": 0.0},
        {"name": "원화 약세 (환율 1,420원)", "fx": 1420.0, "delta_rate_bp": 0.0},
        {"name": "고환율·고금리 복합충격 (1,450원 + 금리 50bp 인상)", "fx": 1450.0, "delta_rate_bp": 50.0},
        {"name": "금리 인하 국면 (환율 1,320원 + 금리 50bp 인하)", "fx": 1320.0, "delta_rate_bp": -50.0},
    ]

    scenario_outputs = []
    for sc in scenarios:
        sc_fx = sc["fx"]
        sc_delta_bp = sc["delta_rate_bp"]
        
        fx_pct = (sc_fx - current_fx) / current_fx * 100.0
        # 환율 변동으로 인한 USD 노출 자산의 손익
        fx_pnl = usd_eval * (fx_pct / 100.0)
        
        # 금리 변동으로 인한 채권 자산의 손익 (-Duration * delta_yield)
        rate_pct = - (avg_duration * (sc_delta_bp / 100.0))
        rate_pnl = total_eval * (rate_pct / 100.0)
        
        total_pnl = fx_pnl + rate_pnl
        total_pnl_pct = (total_pnl / total_eval) * 100.0
        
        scenario_outputs.append({
            "scenario_name": sc["name"],
            "fx_rate": sc_fx,
            "delta_rate_bp": sc_delta_bp,
            "fx_impact_amount": round(fx_pnl, 0),
            "rate_impact_amount": round(rate_pnl, 0),
            "expected_pnl_amount": round(total_pnl, 0),
            "expected_pnl_rate": round(total_pnl_pct, 2)
        })

    # 환율 상승 수혜 TOP 3 (환노출 비중 높은 종목)
    usd_holdings = [item for item in enriched if item["currency_exposure"] == "USD"]
    usd_holdings.sort(key=lambda x: x["eval_amount"], reverse=True)
    top_fx_beneficiaries = [
        {
            "code": item["code"],
            "name": item["name"],
            "eval_amount": item["eval_amount"],
            "weight": item["weight"],
            "impact_per_50krw": round(item["eval_amount"] * (50.0 / current_fx), 0)
        }
        for item in usd_holdings[:4]
    ]

    # 금리 인상 시 취약 종목 TOP 3 (듀레이션 긴 채권/리츠)
    interest_sensitive = [item for item in enriched if item["estimated_duration"] > 0]
    interest_sensitive.sort(key=lambda x: x["eval_amount"] * x["estimated_duration"], reverse=True)
    top_rate_vulnerabilities = [
        {
            "code": item["code"],
            "name": item["name"],
            "eval_amount": item["eval_amount"],
            "duration": item["estimated_duration"],
            "weight": item["weight"],
            "loss_per_50bp": round(item["eval_amount"] * (item["estimated_duration"] * 0.005), 0)
        }
        for item in interest_sensitive[:4]
    ]

    # 평가 등급 및 해석 가이드
    if usd_ratio >= 60.0:
        shield_stance = "적극적 달러 헤지형"
        shield_comment = "환노출 비중이 매우 높아 원화 가치 급락(고환율) 시 방어력이 뛰어나지만, 원화 강세 전환 시 평가익 반납에 유의하세요."
    elif usd_ratio >= 35.0:
        shield_stance = "균형 잡힌 글로벌 분산형"
        shield_comment = "달러 환노출과 국내 자산이 이상적인 4:6 비율로 배분되어 환율 변동성에 매우 안정적입니다."
    else:
        shield_stance = "원화 자산 편중형"
        shield_comment = "환노출 비중이 낮아 환율 급등 시 글로벌 자산 인플레이션 방어 효과가 제한적입니다."

    return {
        "total_eval": round(total_eval, 0),
        "current_fx": current_fx,
        "usd_exposure_ratio": usd_ratio,
        "hedged_ratio": hedged_ratio,
        "krw_exposure_ratio": krw_ratio,
        "bond_ratio": bond_ratio,
        "average_duration": avg_duration,
        "shield_stance": shield_stance,
        "shield_comment": shield_comment,
        "scenario_results": scenario_outputs,
        "top_fx_beneficiaries": top_fx_beneficiaries,
        "top_rate_vulnerabilities": top_rate_vulnerabilities,
        "enriched_holdings_count": len(enriched)
    }
