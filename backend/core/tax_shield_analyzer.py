"""금융소득 종합과세(2,000만원) & 건강보험 피부양자 실시간 방어 트래커 엔진 (S6-35)
Core Module: Tax Shield Analyzer

주요 기능:
1. 연간 금융소득(이자 + 일반과세 배당) 2,000만원 상한선 실시간 추적 & 위험도 평가 (SAFE / CAUTION / WARNING / CRITICAL)
2. 건보료 피부양자 자격 박탈 위험(연 2,000만원 초과 시 지역건보료 전환) 및 예상 월 부과액 산출
3. 과세 계좌 vs 절세 계좌(ISA, 연금저축, IRP) 배당 분리 및 절세 한도 방어율 계산
4. ISA/연금계좌 이전 시뮬레이션을 통한 세금 및 건보료 절감 최적화 처방(CFP 가이드)
"""

from typing import Any, Dict, List, Optional
import math


LIMIT_FINANCIAL_INCOME_KRW = 20_000_000  # 금융소득종합과세 & 피부양자 판정 기준 (2,000만원)
DEFAULT_OTHER_INCOME_KRW = 50_000_000   # 기본 타 종합소득 (근로/사업 등)


def calculate_marginal_tax_rate(taxable_base_krw: float) -> float:
    """한국 소득세율표 기준 한계세율(지방소득세 10% 포함) 산출
    - 1,400만원 이하: 6% (+0.6% = 6.6%)
    - 5,000만원 이하: 15% (+1.5% = 16.5%)
    - 8,800만원 이하: 24% (+2.4% = 26.4%)
    - 1.5억원 이하: 35% (+3.5% = 38.5%)
    - 3억원 이하: 38% (+3.8% = 41.8%)
    - 5억원 이하: 40% (+4.0% = 44.0%)
    - 10억원 이하: 42% (+4.2% = 46.2%)
    - 10억원 초과: 45% (+4.5% = 49.5%)
    """
    if taxable_base_krw <= 14_000_000:
        return 0.066
    elif taxable_base_krw <= 50_000_000:
        return 0.165
    elif taxable_base_krw <= 88_000_000:
        return 0.264
    elif taxable_base_krw <= 150_000_000:
        return 0.385
    elif taxable_base_krw <= 300_000_000:
        return 0.418
    elif taxable_base_krw <= 500_000_000:
        return 0.440
    elif taxable_base_krw <= 1_000_000_000:
        return 0.462
    else:
        return 0.495


def analyze_tax_shield(
    taxable_dividends_krw: float = 0.0,
    tax_shielded_dividends_krw: float = 0.0,
    interest_income_krw: float = 0.0,
    other_annual_income_krw: float = DEFAULT_OTHER_INCOME_KRW,
    is_health_insurance_dependent: bool = True,
    monthly_distribution: Optional[List[float]] = None,
    holdings: Optional[List[Dict[str, Any]]] = None,
) -> Dict[str, Any]:
    """금융소득 종합과세 & 건보료 피부양자 자격 실시간 방어 진단 분석

    Args:
        taxable_dividends_krw: 일반과세 계좌 연간 예상 배당금 (원)
        tax_shielded_dividends_krw: 절세계좌(ISA, 연금저축, IRP) 연간 예상 배당금 (원)
        interest_income_krw: 예적금/채권 이자소득 (원)
        other_annual_income_krw: 근로소득 등 타 종합소득 (원)
        is_health_insurance_dependent: 건강보험 피부양자 여부
        monthly_distribution: 1~12월 월별 일반과세 배당금 발생액 리스트 (12개)
        holdings: 보유 종목 리스트 (account_type, code, name, annual_dividend_krw, eval_amount)
    """
    taxable_div = max(0.0, float(taxable_dividends_krw))
    shielded_div = max(0.0, float(tax_shielded_dividends_krw))
    interest = max(0.0, float(interest_income_krw))
    other_income = max(0.0, float(other_annual_income_krw))

    # 1. 2,000만원 기준 적용 대상 금융소득 (일반과세 배당 + 이자소득)
    # ※ ISA(비과세/분리과세), 연금저축/IRP(과세이연/연금소득세)는 금융소득종합과세 합산 대상에서 제외됨!
    total_financial_income_krw = taxable_div + interest
    total_all_dividends_krw = taxable_div + shielded_div

    # 2. 방어 한도 잔여액 및 소진율
    remaining_shield_krw = max(0.0, LIMIT_FINANCIAL_INCOME_KRW - total_financial_income_krw)
    excess_income_krw = max(0.0, total_financial_income_krw - LIMIT_FINANCIAL_INCOME_KRW)
    utilization_rate = round((total_financial_income_krw / LIMIT_FINANCIAL_INCOME_KRW) * 100.0, 1)

    # 3. 위험도 등급 판정
    # SAFE (<=75%), CAUTION (75%~90%), WARNING (90%~100%), CRITICAL (>100%)
    if utilization_rate <= 75.0:
        risk_level = "SAFE"
        risk_badge = "안전 (Safe)"
        risk_color = "emerald"
        status_msg = f"금융소득 2,000만원 한도 대비 {utilization_rate}%로 여유롭습니다. 잔여 한도: {remaining_shield_krw:,.0f}원"
    elif utilization_rate <= 90.0:
        risk_level = "CAUTION"
        risk_badge = "주의 (Caution)"
        risk_color = "amber"
        status_msg = f"한도의 {utilization_rate}%에 도달했습니다. 추가 고배당주 매수 시 절세계좌 활용을 권장합니다."
    elif utilization_rate <= 100.0:
        risk_level = "WARNING"
        risk_badge = "경고 (Warning)"
        risk_color = "orange"
        status_msg = f"한도 초과 임박! 잔여 방어 한도가 {remaining_shield_krw:,.0f}원에 불과합니다. 배당락 전 포트폴리오 리밸런싱이 시급합니다."
    else:
        risk_level = "CRITICAL"
        risk_badge = "초과 위험 (Critical)"
        risk_color = "rose"
        status_msg = f"2,000만원을 {excess_income_krw:,.0f}원 초과했습니다! 금융소득종합과세 대상 및 건보료 피부양자 자격 박탈 위기입니다."

    # 4. 세금 영향 (Tax Impact)
    # 기본 분리과세(15.4%): 2,000만원 이하 구간
    standard_withholding_tax = min(total_financial_income_krw, LIMIT_FINANCIAL_INCOME_KRW) * 0.154

    # 2,000만원 초과분에 대해 타 소득과 합산 과세 적용 시 추가 세액
    marginal_rate = calculate_marginal_tax_rate(other_income + excess_income_krw)
    # 원천징수(14% + 1.4% = 15.4%) 기납부세액 공제 후 초과 누진세율 추가 부담
    additional_tax_rate = max(0.0, marginal_rate - 0.154)
    additional_income_tax_krw = round(excess_income_krw * additional_tax_rate)
    total_estimated_tax_krw = round(standard_withholding_tax + (excess_income_krw * 0.154) + additional_income_tax_krw)

    # 5. 건강보험 피부양자 영향 (Health Insurance Impact)
    # 2022년 9월 건보료 부과체계 2단계 개편: 연간 금융소득 2,000만원 초과 시 피부양자 즉시 박탈 -> 지역가입자 전환
    is_dependent_disqualified = False
    estimated_monthly_health_insurance_krw = 0
    estimated_annual_health_insurance_krw = 0

    if is_health_insurance_dependent:
        if total_financial_income_krw > LIMIT_FINANCIAL_INCOME_KRW:
            is_dependent_disqualified = True
            # 건보료 소득정률제(2024년 기준 7.09% + 장기요양 12.95% = 약 8.0%)
            # 지역가입자 기본 소득+재산 점수 최소 부과 추정 (월 약 15~35만원)
            base_monthly = 180_000.0  # 기본 지역건보료 최저선 추정
            income_component_monthly = (total_financial_income_krw * 0.08) / 12.0
            estimated_monthly_health_insurance_krw = round(base_monthly + income_component_monthly)
            estimated_annual_health_insurance_krw = estimated_monthly_health_insurance_krw * 12
        else:
            is_dependent_disqualified = False
            estimated_monthly_health_insurance_krw = 0
            estimated_annual_health_insurance_krw = 0

    # 6. 월별 누적 추이 데이터 (1~12월)
    monthly_trend = []
    if not monthly_distribution or len(monthly_distribution) != 12:
        # 균등 분배 fallback (월별 평균치)
        base_monthly_val = taxable_div / 12.0
        monthly_distribution = [base_monthly_val] * 12

    accumulated = 0.0
    limit_breach_month = None
    for m in range(1, 13):
        m_income = monthly_distribution[m - 1]
        accumulated += m_income
        if accumulated > LIMIT_FINANCIAL_INCOME_KRW and limit_breach_month is None:
            limit_breach_month = m

        monthly_trend.append({
            "month": f"{m}월",
            "monthly_income": round(m_income),
            "accumulated_income": round(accumulated),
            "limit_krw": LIMIT_FINANCIAL_INCOME_KRW,
            "is_breached": accumulated > LIMIT_FINANCIAL_INCOME_KRW,
        })

    # 7. 계좌별 배당 비중 및 절세 계좌 방어 효과
    shield_ratio = round((shielded_div / total_all_dividends_krw * 100.0), 1) if total_all_dividends_krw > 0 else 0.0
    tax_saved_by_shield_krw = round(shielded_div * (marginal_rate if excess_income_krw > 0 else 0.154))

    # 8. CFP 최적화 권고안 (Action Plan)
    recommendations: List[Dict[str, Any]] = []

    if excess_income_krw > 0:
        recommendations.append({
            "type": "TRANSFER_TO_ISA",
            "priority": "HIGH",
            "title": f"초과 배당금 {excess_income_krw:,.0f}원 상당 ISA/연금계좌 이전",
            "desc": "일반 과세 계좌의 고배당 ETF(커버드콜, 리츠 등)를 비과세 ISA(연 2,000만원 납입)나 연금저축/IRP로 이전하여 금융소득 2,000만원 이하로 즉시 복원하세요.",
            "expected_saving_krw": round(additional_income_tax_krw + estimated_annual_health_insurance_krw),
        })

    if is_dependent_disqualified:
        recommendations.append({
            "type": "PREVENT_HEALTH_CLIFF",
            "priority": "URGENT",
            "title": "건보료 피부양자 자격 박탈 방어 절벽 회피",
            "desc": f"연간 {excess_income_krw:,.0f}원의 초과 배당으로 인해 연 {estimated_annual_health_insurance_krw:,.0f}원(월 {estimated_monthly_health_insurance_krw:,.0f}원)의 지역건보료가 부과될 수 있습니다. 배당락일 전 일부 매도 또는 절세계좌 이동이 필수적입니다.",
            "expected_saving_krw": estimated_annual_health_insurance_krw,
        })
    elif utilization_rate >= 80.0:
        recommendations.append({
            "type": "BUFFER_CAUTION",
            "priority": "MEDIUM",
            "title": f"안전 마진 확보 (잔여 방어 한도: {remaining_shield_krw:,.0f}원)",
            "desc": "금리 인상 또는 배당금 증액 시 예기치 않게 2,000만원을 넘을 수 있습니다. 신규 배당 ETF 투자는 반드시 ISA 계좌에서 진행하세요.",
            "expected_saving_krw": 0,
        })

    if shield_ratio < 40.0 and total_all_dividends_krw > 5_000_000:
        recommendations.append({
            "type": "EXPAND_TAX_SHIELD",
            "priority": "LOW",
            "title": f"절세계좌 비중 확대 (현재 {shield_ratio}%)",
            "desc": "전체 배당 중 절세계좌(ISA/연금) 비중이 낮습니다. 배당소득세(15.4%) 과세이연 효과를 극대화하기 위해 절세계좌 비중을 60% 이상으로 높이는 것을 추천합니다.",
            "expected_saving_krw": round(taxable_div * 0.154 * 0.3),
        })

    return {
        "status": "success",
        "summary": {
            "total_financial_income_krw": round(total_financial_income_krw),
            "taxable_dividends_krw": round(taxable_div),
            "interest_income_krw": round(interest),
            "tax_shielded_dividends_krw": round(shielded_div),
            "total_all_dividends_krw": round(total_all_dividends_krw),
            "shield_limit_krw": LIMIT_FINANCIAL_INCOME_KRW,
            "remaining_shield_krw": round(remaining_shield_krw),
            "excess_income_krw": round(excess_income_krw),
            "utilization_rate": utilization_rate,
            "risk_level": risk_level,
            "risk_badge": risk_badge,
            "risk_color": risk_color,
            "status_msg": status_msg,
            "limit_breach_month": f"{limit_breach_month}월" if limit_breach_month else None,
        },
        "tax_impact": {
            "standard_withholding_tax_krw": round(standard_withholding_tax),
            "marginal_rate_percent": round(marginal_rate * 100, 1),
            "additional_income_tax_krw": additional_income_tax_krw,
            "total_estimated_tax_krw": total_estimated_tax_krw,
            "tax_saved_by_shield_krw": tax_saved_by_shield_krw,
        },
        "health_insurance_impact": {
            "is_health_insurance_dependent": is_health_insurance_dependent,
            "is_dependent_disqualified": is_dependent_disqualified,
            "estimated_monthly_fee_krw": estimated_monthly_health_insurance_krw,
            "estimated_annual_fee_krw": estimated_annual_health_insurance_krw,
            "status_summary": (
                f"🚨 피부양자 탈락 위험! 연 {estimated_annual_health_insurance_krw:,.0f}원 부과 예상"
                if is_dependent_disqualified
                else "✅ 피부양자 자격 안전 유지"
            ),
        },
        "shield_portfolio": {
            "shield_ratio_percent": shield_ratio,
            "taxable_ratio_percent": round(100.0 - shield_ratio, 1),
        },
        "monthly_trend": monthly_trend,
        "recommendations": recommendations,
    }
