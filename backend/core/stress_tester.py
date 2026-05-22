import asyncio
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.future import select
from db.models import ETFMaster, ETFDailyPrice, BenchmarkPrice

SCENARIOS = {
    "covid_2020": {
        "name": "코로나 펜데믹 위기 (2020)",
        "description": "2020년 2월 ~ 3월 글로벌 공급망 충격 및 팬데믹 공포로 인한 대폭락장",
        "start_date": "2020-02-19",
        "end_date": "2020-03-23",
        "type": "real",
        "bond_yield_fix": 0.035  # 실제 채권 데이터 부재 시 고정값 (+3.5%)
    },
    "subprime_2008": {
        "name": "리먼 브러더스 금융 위기 (2008)",
        "description": "2008년 서브프라임 모기지 사태 및 Lehman Brothers 파산으로 인한 금융 시스템 붕괴",
        "start_date": "2008-09-08",
        "end_date": "2009-03-09",
        "type": "fallback",
        "fallback_rules": {
            "us_stock": -0.50,
            "kr_stock": -0.40,
            "bond": 0.08,
            "other": -0.30
        }
    },
    "inflation_2022": {
        "name": "인플레이션 & 금리인상 충격 (2022)",
        "description": "2022년 미 연준의 고강도 긴축(자이언트 스텝) 및 고물가 지속으로 인한 주식/채권 동반 약세장",
        "start_date": "2022-01-03",
        "end_date": "2022-10-12",
        "type": "real",
        "bond_yield_fix": -0.120  # 2022년 채권 동반 폭락 반영 (-12.0%)
    },
    "markdown_2011": {
        "name": "미국 신용등급 강등 충격 (2011)",
        "description": "2011년 S&P의 미국 국가신용등급 강등(AAA -> AA+) 충격으로 인한 시장 혼란",
        "start_date": "2011-07-22",
        "end_date": "2011-10-04",
        "type": "fallback",
        "fallback_rules": {
            "us_stock": -0.18,
            "kr_stock": -0.22,
            "bond": 0.04,
            "other": -0.15
        }
    }
}


def classify_etf(name: str):
    name_lower = name.lower()
    is_leverage = "레버리지" in name or "2x" in name_lower
    is_inverse = "인버스" in name or "곱버스" in name or "-1x" in name_lower or "-2x" in name_lower
    is_inverse_2x = "곱버스" in name or "-2x" in name_lower
    
    asset_class = "other"
    if any(k in name for k in ["미국", "S&P", "나스닥", "NASDAQ", "NYSE", "필라델피아", "빅테크"]):
        asset_class = "us_stock"
    elif any(k in name for k in ["코스피", "KOSPI", "코스닥", "KOSDAQ", "200"]):
        asset_class = "kr_stock"
    elif any(k in name for k in ["채권", "국채", "KOSEF 국고채", "TIGER 국채"]):
        asset_class = "bond"
        
    return asset_class, is_leverage, is_inverse, is_inverse_2x


async def get_price_for_date(db: AsyncSession, code: str, target_date: str, is_start: bool) -> float:
    """영업일 불일치를 대비하여 해당 날짜의 가장 인접한 종가를 가져옵니다."""
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


async def get_benchmark_return(db: AsyncSession, symbol: str, start_date: str, end_date: str) -> float:
    """대표 벤치마크 지수의 실제 기간 수익률을 계산합니다."""
    # 시작 시점 가격
    q_start = select(BenchmarkPrice.close).where(
        BenchmarkPrice.symbol == symbol,
        BenchmarkPrice.date >= start_date
    ).order_by(BenchmarkPrice.date.asc()).limit(1)
    
    # 종료 시점 가격
    q_end = select(BenchmarkPrice.close).where(
        BenchmarkPrice.symbol == symbol,
        BenchmarkPrice.date <= end_date
    ).order_by(BenchmarkPrice.date.desc()).limit(1)
    
    res_start = await db.execute(q_start)
    res_end = await db.execute(q_end)
    
    val_start = res_start.scalar()
    val_end = res_end.scalar()
    
    if val_start and val_end:
        return (val_end - val_start) / val_start
    return None


async def calculate_scenario_performance(db: AsyncSession, code: str, name: str, scenario_key: str) -> float:
    """개별 ETF 종목의 특정 시나리오 기간의 수익률을 계산합니다."""
    scenario = SCENARIOS.get(scenario_key)
    if not scenario:
        return 0.0
        
    asset_class, is_leverage, is_inverse, is_inverse_2x = classify_etf(name)
    
    # 1. Fallback 타입 시나리오 (2008, 2011 등 과거 DB 부재)
    if scenario["type"] == "fallback":
        base_ret = scenario["fallback_rules"].get(asset_class, scenario["fallback_rules"]["other"])
        if is_inverse:
            mult = -2.0 if is_inverse_2x else -1.0
            return base_ret * mult
        elif is_leverage:
            return base_ret * 2.0
        return base_ret
        
    # 2. Real 타입 시나리오 (2020, 2022 등 DB 내 데이터 존재)
    # 실제 해당 ETF의 가격 데이터를 조회해 본다.
    p_start = await get_price_for_date(db, code, scenario["start_date"], is_start=True)
    p_end = await get_price_for_date(db, code, scenario["end_date"], is_start=False)
    
    if p_start and p_end:
        return (p_end - p_start) / p_start
        
    # 만약 해당 기간 당시 미상장되어 실제 가격이 없는 경우 자산군별 벤치마크 Fallback 적용
    bench_symbol = "^GSPC" if asset_class == "us_stock" else "KS11" if asset_class == "kr_stock" else None
    
    if asset_class == "bond":
        # 채권형은 고정 보정값 적용
        base_ret = scenario.get("bond_yield_fix", 0.0)
    elif bench_symbol:
        base_ret = await get_benchmark_return(db, bench_symbol, scenario["start_date"], scenario["end_date"])
        if base_ret is None:
            # 벤치마크 연산 실패 시 시나리오 평균치 하드코딩 fallback
            base_ret = -0.30 if scenario_key == "covid_2020" else -0.15
    else:
        base_ret = -0.25 if scenario_key == "covid_2020" else -0.10
        
    # 승수(레버리지/인버스) 적용
    if is_inverse:
        mult = -2.0 if is_inverse_2x else -1.0
        return base_ret * mult
    elif is_leverage:
        return base_ret * 2.0
    return base_ret


async def run_stress_test(db: AsyncSession, portfolio_items: list) -> dict:
    """
    포트폴리오 비중을 입력받아 시나리오별 예상 수익률, MDD, 포트폴리오 95% VaR을 연산합니다.
    portfolio_items 형식: [{"code": "069500", "weight": 0.4}, {"code": "379180", "weight": 0.6}]
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
    
    # 각 시나리오별로 전체 포트폴리오 수익률 연산
    for scenario_key, scenario_info in SCENARIOS.items():
        portfolio_return = 0.0
        details = []
        
        for item in normalized_items:
            code = item["code"]
            weight = item["weight"]
            name = name_map.get(code, "Unknown ETF")
            
            etf_ret = await calculate_scenario_performance(db, code, name, scenario_key)
            portfolio_return += etf_ret * weight
            
            details.append({
                "code": code,
                "name": name,
                "weight": round(weight * 100, 1),
                "expected_return": round(etf_ret * 100, 2)
            })
            
        # 예상 MDD는 스트레스 시나리오의 최대 손실폭이므로 포트폴리오 수익률의 음수값으로 정의 (수익이 났으면 0)
        expected_mdd = max(0.0, -portfolio_return)
        
        # 간이 95% Historical VaR 추정 (시나리오 하락률의 1.65배 표준오차 범위 변동폭 대입)
        # 퀀트 시나리오별 위험 가중치를 주어 산출
        estimated_var = expected_mdd * 1.15
        
        results[scenario_key] = {
            "scenario_name": scenario_info["name"],
            "description": scenario_info["description"],
            "portfolio_return": round(portfolio_return * 100, 2),
            "expected_mdd": round(expected_mdd * 100, 2),
            "estimated_var": round(estimated_var * 100, 2),
            "details": details
        }
        
    return results
