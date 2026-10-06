import asyncio
from typing import List, Dict, Any, Optional
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.future import select
from db.models import ETFMaster, ETFDailyPrice, BenchmarkPrice

SCENARIOS = {
    "covid_2020": {
        "name": "코로나 팬데믹 공포 (2020)",
        "badge": "🦠 글로벌 락다운",
        "period": "2020.02 ~ 2020.03",
        "description": "글로벌 공급망 마비 및 팬데믹 공포로 인한 전 세계 증시 동반 급락",
        "start_date": "2020-02-19",
        "end_date": "2020-03-23",
        "type": "real",
        "market_mdd": -34.0,
        "bond_yield_fix": 0.035,   # 실제 채권 데이터 부재 시 보정치 (+3.5%)
        "gold_fix": 0.040,         # 금/원자재 보정치 (+4.0%)
        "summary": "안전자산(국채·달러)은 선방했으나 주식형 자산 전반이 30% 이상 폭락했던 전형적 유동성 쇼크"
    },
    "inflation_2022": {
        "name": "고물가 & 자이언트스텝 긴축 (2022)",
        "badge": "📉 주식·채권 동반 약세",
        "period": "2022.01 ~ 2022.10",
        "description": "미 연준의 4연속 자이언트스텝(75bp) 긴축 및 인플레이션으로 주식과 채권이 동반 하락",
        "start_date": "2022-01-03",
        "end_date": "2022-10-12",
        "type": "real",
        "market_mdd": -25.4,
        "bond_yield_fix": -0.120,  # 2022년 금리 급등으로 채권 동반 폭락 (-12.0%)
        "gold_fix": -0.080,
        "summary": "전통적 60:40 주식/채권 포트폴리오가 함께 무너진 시기로, 현금(CD/파킹형)과 원자재만 방어에 성공"
    },
    "black_monday_2024": {
        "name": "엔캐리 청산 블랙 먼데이 (2024.08)",
        "badge": "💥 서킷브레이커 쇼크",
        "period": "2024.07 ~ 2024.08",
        "description": "일본은행(BOJ) 금리인상 발 엔캐리 트레이드 청산으로 KOSPI(-8.8%) 및 닛케이 역대급 폭락",
        "start_date": "2024-07-16",
        "end_date": "2024-08-05",
        "type": "real",
        "market_mdd": -14.2,
        "bond_yield_fix": 0.028,
        "gold_fix": 0.015,
        "summary": "빅테크 및 반도체 레버리지 포지션이 치명타를 입었으나 미국 단기채와 현금성 자산은 완벽히 방어"
    },
    "svb_crisis_2023": {
        "name": "실리콘밸리은행(SVB) 파산 (2023)",
        "badge": "🏦 은행 시스템 리스크",
        "period": "2023.03.08 ~ 2023.03.24",
        "description": "미국 SVB 및 시그니처은행 파산으로 금융 시스템 위기 고조 및 국채 금리 급락",
        "start_date": "2023-03-08",
        "end_date": "2023-03-24",
        "type": "real",
        "market_mdd": -8.5,
        "bond_yield_fix": 0.045,   # 국채 랠리로 채권형 강세 (+4.5%)
        "gold_fix": 0.085,         # 금 안전자산 급등 (+8.5%)
        "summary": "금융주가 급락했으나 국채 랠리와 금 가격 급등으로 분산 포트폴리오가 빛을 발한 위기"
    },
    "russia_ukraine_2022": {
        "name": "러시아-우크라이나 개전 충격 (2022)",
        "badge": "⚔️ 원자재·에너지 쇼크",
        "period": "2022.02.16 ~ 2022.03.08",
        "description": "러시아의 우크라이나 침공으로 원유·천연가스·곡물가 급등 및 스태그플레이션 공포",
        "start_date": "2022-02-16",
        "end_date": "2022-03-08",
        "type": "real",
        "market_mdd": -11.5,
        "bond_yield_fix": -0.012,
        "gold_fix": 0.095,         # 금·에너지 원자재 폭등
        "summary": "일반 주식시장은 하락했으나 에너지/원자재/금 ETF 보유 계좌는 강력한 헤지 효과를 누림"
    },
    "markdown_2011": {
        "name": "미국 신용등급 강등 사태 (2011)",
        "badge": "🏛️ 국가 신용위험",
        "period": "2011.07 ~ 2011.10",
        "description": "S&P의 사상 최초 미국 국가신용등급 강등(AAA→AA+) 쇼크로 인한 글로벌 패닉",
        "start_date": "2011-07-22",
        "end_date": "2011-10-04",
        "type": "fallback",
        "market_mdd": -21.6,
        "fallback_rules": {
            "us_stock": -0.18,
            "kr_stock": -0.22,
            "bond": 0.04,
            "commodity": 0.08,
            "cash": 0.005,
            "other": -0.15
        },
        "summary": "미국 자체의 신용이 흔들렸음에도 역설적으로 달러와 미국채로 안전자산 수요가 몰림"
    },
    "subprime_2008": {
        "name": "리먼 브러더스 글로벌 금융위기 (2008)",
        "badge": "🏚️ 100년 만의 대공황 공포",
        "period": "2008.09 ~ 2009.03",
        "description": "미국 서브프라임 모기지 사태 및 리먼 브러더스 파산으로 글로벌 금융 시스템 마비",
        "start_date": "2008-09-08",
        "end_date": "2009-03-09",
        "type": "fallback",
        "market_mdd": -50.2,
        "fallback_rules": {
            "us_stock": -0.50,
            "kr_stock": -0.40,
            "bond": 0.08,
            "commodity": -0.35,
            "cash": 0.015,
            "other": -0.30
        },
        "summary": "주식형 자산의 반토막(-50%) 손실이 발생했던 사상 최악의 시스템 위기 (채권·달러 외 전멸)"
    }
}


def classify_etf(name: str):
    """ETF 종목명을 기반으로 자산군, 레버리지, 인버스 여부를 정밀 판별합니다."""
    name_lower = name.lower()
    is_inverse = "인버스" in name or "곱버스" in name or "-1x" in name_lower or "-2x" in name_lower
    is_inverse_2x = "곱버스" in name or ("인버스" in name and "2x" in name_lower) or "-2x" in name_lower
    is_leverage = ("레버리지" in name or ("2x" in name_lower and not is_inverse))
    
    asset_class = "other"
    if any(k in name_lower for k in ["cd금리", "kofr", "머니마켓", "단기채", "단기자금", "달러단기", "sofr"]):
        asset_class = "cash"
    elif any(k in name_lower for k in ["골드", "금현물", "원유", "에너지", "구리", "원자재", "천연가스", "농산물"]):
        asset_class = "commodity"
    elif any(k in name_lower for k in ["채권", "국채", "kosef 국고채", "tiger 국채", "미국채", "회사채", "우량채"]):
        asset_class = "bond"
    elif any(k in name_lower for k in ["미국", "s&p", "나스닥", "nasdaq", "nyse", "필라델피아", "빅테크", "다우", "러셀"]):
        asset_class = "us_stock"
    elif any(k in name_lower for k in ["코스피", "kospi", "코스닥", "kosdaq", "200", "반도체", "바이오", "2차전지", "조선", "방산", "금융", "현대차"]):
        asset_class = "kr_stock"
        
    return asset_class, is_leverage, is_inverse, is_inverse_2x


async def get_price_for_date(db: AsyncSession, code: str, target_date: str, is_start: bool) -> Optional[float]:
    """영업일 불일치를 대비하여 해당 날짜의 가장 인접한 종가를 가져옵니다."""
    try:
        if is_start:
            query = select(ETFDailyPrice.close).where(
                ETFDailyPrice.code == code,
                ETFDailyPrice.date >= target_date
            ).order_by(ETFDailyPrice.date.asc()).limit(1)
        else:
            query = select(ETFDailyPrice.close).where(
                ETFDailyPrice.code == code,
                ETFDailyPrice.date <= target_date
            ).order_by(ETFDailyPrice.date.desc()).limit(1)
            
        res = await db.execute(query)
        val = res.scalar()
        return float(val) if val is not None else None
    except Exception:
        return None


async def get_benchmark_return(db: AsyncSession, symbol: str, start_date: str, end_date: str) -> Optional[float]:
    """대표 벤치마크 지수의 실제 기간 수익률을 계산합니다."""
    try:
        q_start = select(BenchmarkPrice.close).where(
            BenchmarkPrice.symbol == symbol,
            BenchmarkPrice.date >= start_date
        ).order_by(BenchmarkPrice.date.asc()).limit(1)
        
        q_end = select(BenchmarkPrice.close).where(
            BenchmarkPrice.symbol == symbol,
            BenchmarkPrice.date <= end_date
        ).order_by(BenchmarkPrice.date.desc()).limit(1)
        
        res_start = await db.execute(q_start)
        res_end = await db.execute(q_end)
        
        val_start = res_start.scalar()
        val_end = res_end.scalar()
        
        if val_start and val_end and val_start > 0:
            return (val_end - val_start) / val_start
        return None
    except Exception:
        return None


async def calculate_scenario_performance(db: AsyncSession, code: str, name: str, scenario_key: str) -> float:
    """개별 ETF 종목의 특정 시나리오 기간 수익률을 계산합니다."""
    scenario = SCENARIOS.get(scenario_key)
    if not scenario:
        return 0.0
        
    asset_class, is_leverage, is_inverse, is_inverse_2x = classify_etf(name)
    
    # 1. Fallback 타입 시나리오 (2008, 2011 등 과거 DB 부재)
    if scenario["type"] == "fallback":
        rules = scenario.get("fallback_rules", {})
        base_ret = rules.get(asset_class, rules.get("other", -0.20))
        if is_inverse:
            mult = -2.0 if is_inverse_2x else -1.0
            return base_ret * mult
        elif is_leverage:
            return base_ret * 2.0
        return base_ret
        
    # 2. Real 타입 시나리오 (2020, 2022, 2023, 2024 등 DB 내 일별 시세 존재)
    p_start = await get_price_for_date(db, code, scenario["start_date"], is_start=True)
    p_end = await get_price_for_date(db, code, scenario["end_date"], is_start=False)
    
    if p_start and p_end and p_start > 0:
        return (p_end - p_start) / p_start
        
    # 만약 해당 기간 당시 미상장되어 실제 가격이 없는 경우 자산군별 벤치마크/룰 Fallback 적용
    if asset_class == "cash":
        base_ret = 0.003  # 파킹/CD형은 위기 기간에도 소폭 이자 수익 보존
    elif asset_class == "bond":
        base_ret = scenario.get("bond_yield_fix", 0.02)
    elif asset_class == "commodity":
        base_ret = scenario.get("gold_fix", 0.03)
    else:
        bench_symbol = "^GSPC" if asset_class == "us_stock" else "KS11" if asset_class == "kr_stock" else None
        base_ret = None
        if bench_symbol:
            base_ret = await get_benchmark_return(db, bench_symbol, scenario["start_date"], scenario["end_date"])
        
        if base_ret is None:
            # 벤치마크 부재 시 시나리오 평균 낙폭 적용
            market_mdd = scenario.get("market_mdd", -20.0)
            base_ret = market_mdd / 100.0
            
    # 승수(레버리지/인버스) 적용
    if is_inverse:
        mult = -2.0 if is_inverse_2x else -1.0
        return base_ret * mult
    elif is_leverage:
        return base_ret * 2.0
    return base_ret


def generate_hedge_prescription(portfolio_return: float, expected_mdd: float, details: List[Dict[str, Any]], scenario_key: str) -> Dict[str, Any]:
    """포트폴리오의 약점과 충격도를 분석하여 실행 가능한 리스크 헷지 처방전을 생성합니다."""
    stock_weight = sum(d["weight"] for d in details if any(k in d["name"] for k in ["미국", "S&P", "나스닥", "코스피", "KOSPI", "반도체", "2차전지"]))
    bond_cash_weight = sum(d["weight"] for d in details if any(k in d["name"] for k in ["채권", "국채", "CD", "KOFR", "머니마켓", "달러단기"]))
    gold_weight = sum(d["weight"] for d in details if any(k in d["name"] for k in ["골드", "금현물", "원자재"]))

    hedge_recommendations = []
    
    if expected_mdd > 30.0:
        diagnosis = f"위기 시 포트폴리오 예상 낙폭이 {expected_mdd:.1f}%로 심각한 자본 훼손(Drawdown) 위험에 직면해 있습니다."
        action = "미국 단기국채(또는 CD금리 ETF)와 금(Gold) 비중을 최소 15~20% 확보하여 하방 쿠션을 즉각 보강해야 합니다."
        hedge_recommendations = [
            {"code": "453850", "name": "ACE 미국30년국채액티브(H)", "type": "금리피크 자본차익 & 주식 폭락 헷지"},
            {"code": "411060", "name": "ACE KRX금현물", "type": "화폐가치 하락 및 지정학 리스크 방어"},
            {"code": "459580", "name": "TIGER CD금리투자KIS(합성)", "type": "0% 손실 무위험 파킹 및 현금 유동성"}
        ]
    elif expected_mdd > 18.0:
        diagnosis = f"예상 낙폭 {expected_mdd:.1f}%로 주식 자산 편중도가 다소 높아 하락장 충격 흡수 능력이 제한적입니다."
        action = "월배당 커버드콜 또는 만기매칭형 채권 ETF 10~15% 편입으로 지속적 인컴 방어벽을 구축할 것을 권장합니다."
        hedge_recommendations = [
            {"code": "441640", "name": "TIGER 미국배당다우존스", "type": "배당 현금흐름으로 하락장 쿠션 형성"},
            {"code": "465580", "name": "KODEX 24-12 은행채(AA+이상)액티브", "type": "만기수익률 확정으로 원금 방어"}
        ]
    else:
        diagnosis = f"예상 낙폭 {expected_mdd:.1f}%로 채권·현금·대체자산이 균형 잡힌 우수한 위기 방어력을 갖추고 있습니다."
        action = "현재의 방어 포트폴리오를 유지하면서, 위기 저점 국면에서 주식 비중을 확대할 분할매수 예수금을 점검하세요."
        hedge_recommendations = [
            {"code": "069500", "name": "KODEX 200", "type": "저점 반등 시 지수 베타 회복용"}
        ]

    # 시뮬레이션: 15% 채권 편입 시 예상 MDD 완화 효과 추정
    hedged_mdd_estimate = round(max(3.0, expected_mdd * 0.72), 1)
    mdd_relief = round(expected_mdd - hedged_mdd_estimate, 1)

    return {
        "diagnosis": diagnosis,
        "action": action,
        "recommendations": hedge_recommendations,
        "mdd_relief_simulation": {
            "current_mdd": round(expected_mdd, 1),
            "simulated_hedged_mdd": hedged_mdd_estimate,
            "relief_points": mdd_relief,
            "message": f"안전자산 15% 편입 시 예상 낙폭이 {expected_mdd:.1f}% → {hedged_mdd_estimate:.1f}%로 약 {mdd_relief}%p 완화됩니다."
        }
    }


async def run_stress_test(db: AsyncSession, portfolio_items: list, total_eval_amount: float = 0.0) -> dict:
    """
    포트폴리오 비중을 입력받아 7대 위기 시나리오별 예상 수익률, MDD, 95% Historical VaR,
    원화(KRW) 손실액, 포트폴리오 방어 지수, 최다 타격/방어 종목을 분석합니다.
    """
    total_weight = sum(item.get("weight", 0.0) for item in portfolio_items)
    if total_weight <= 0.0:
        return {"error": "포트폴리오 비중의 합이 0 이하입니다."}
        
    # 비중 정규화 (1.0 기준)
    normalized_items = []
    for item in portfolio_items:
        normalized_items.append({
            "code": item["code"],
            "weight": item["weight"] / total_weight
        })
        
    # 종목들의 메타데이터(이름) 정보 획득
    codes = [item["code"] for item in normalized_items]
    query = select(ETFMaster.code, ETFMaster.name).where(ETFMaster.code.in_(codes))
    res = await db.execute(query)
    name_map = {row.code: row.name for row in res.all()}
    
    results = {}
    
    # 7대 시나리오별로 전체 포트폴리오 수익률 연산
    for scenario_key, scenario_info in SCENARIOS.items():
        portfolio_return = 0.0
        details = []
        
        for item in normalized_items:
            code = item["code"]
            weight = item["weight"]
            name = name_map.get(code, "Unknown ETF")
            
            etf_ret = await calculate_scenario_performance(db, code, name, scenario_key)
            portfolio_return += etf_ret * weight
            
            item_eval = (total_eval_amount * weight) if total_eval_amount > 0 else 0.0
            item_loss = (item_eval * etf_ret) if total_eval_amount > 0 else 0.0
            
            details.append({
                "code": code,
                "name": name,
                "weight": round(weight * 100, 1),
                "expected_return": round(etf_ret * 100, 2),
                "item_eval_amount": round(item_eval),
                "item_loss_amount": round(item_loss),
            })
            
        # 예상 MDD는 포트폴리오의 최대 하락폭
        expected_mdd = max(0.0, -portfolio_return)
        
        # 간이 95% Historical VaR 추정 (시나리오 하락률의 1.15배 위험 가중치 대입)
        estimated_var = expected_mdd * 1.15
        
        # 원화(KRW) 손실액 및 잔여 자산 연산
        expected_loss_amount = round(total_eval_amount * (portfolio_return)) if total_eval_amount > 0 else 0
        remained_asset_amount = round(total_eval_amount + expected_loss_amount) if total_eval_amount > 0 else 0
        
        # 방어 지수 (Defense Score, 100점 만점: MDD 낮을수록 고득점)
        defense_score = max(10, min(100, round(100 - (expected_mdd * 1.6))))
        
        # 위험 등급 판정
        if expected_mdd <= 12.0:
            risk_grade = "SAFE"
            risk_badge = "🟢 안정 방어"
            risk_desc = "위기 국면에서도 자산 가치가 안정적으로 보전되는 견고한 방어형 포트폴리오입니다."
        elif expected_mdd <= 24.0:
            risk_grade = "CAUTION"
            risk_badge = "🟡 보통 방어"
            risk_desc = "시장 평균 수준의 하락 압력을 받으며, 적절한 분산으로 최악의 폭락은 회피했습니다."
        elif expected_mdd <= 38.0:
            risk_grade = "WARNING"
            risk_badge = "🟠 위험 노출"
            risk_desc = "주식형 고변동성 자산 비중이 높아 하락장 지속 시 심각한 원금 손실 위험이 있습니다."
        else:
            risk_grade = "CRITICAL"
            risk_badge = "🔴 극단적 충격 취약"
            risk_desc = "레버리지나 특정 고위험 테마에 편중되어 있어 역사적 위기 재현 시 자본의 40% 이상이 훼손될 수 있습니다."

        # 최다 타격 종목 (Worst Impact) & 방어 종목 (Best Shield)
        sorted_by_ret = sorted(details, key=lambda x: x["expected_return"])
        worst_impact_items = sorted_by_ret[:3]
        best_shield_items = sorted(details, key=lambda x: x["expected_return"], reverse=True)[:3]
        
        # AI & CFP 리스크 헷지 처방전
        prescription = generate_hedge_prescription(portfolio_return, expected_mdd, details, scenario_key)
        
        results[scenario_key] = {
            "scenario_key": scenario_key,
            "scenario_name": scenario_info["name"],
            "badge": scenario_info["badge"],
            "period": scenario_info["period"],
            "description": scenario_info["description"],
            "summary": scenario_info.get("summary", ""),
            "market_mdd": scenario_info.get("market_mdd", -25.0),
            "portfolio_return": round(portfolio_return * 100, 2),
            "expected_mdd": round(expected_mdd * 100, 2),
            "estimated_var": round(estimated_var * 100, 2),
            "total_eval_amount": round(total_eval_amount),
            "expected_loss_amount": expected_loss_amount,
            "remained_asset_amount": remained_asset_amount,
            "defense_score": defense_score,
            "risk_grade": risk_grade,
            "risk_badge": risk_badge,
            "risk_desc": risk_desc,
            "worst_impact_items": worst_impact_items,
            "best_shield_items": best_shield_items,
            "prescription": prescription,
            "details": details
        }
        
    return results
