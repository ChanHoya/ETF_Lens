import asyncio
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.future import select
from db.models import ETFMaster, ETFDailyPrice, MarketMacroLog
from datetime import datetime, timedelta

def clean_etf_name_for_hedging(name: str) -> str:
    """이름에서 (H), (H)(합성), H, H(합성) 등을 제거하여 매칭용 베이스 이름을 얻습니다."""
    base = name
    for suffix in ["(H)", " (H)", "(H)(합성)", " (H)(합성)", " H", "H", "(H) (합성)"]:
        if base.endswith(suffix):
            base = base[:-len(suffix)].strip()
            break
    return base


async def get_currency_hedged_pairs(db: AsyncSession) -> list:
    """마스터 DB를 뒤져 환헤지(H) 상품과 그에 상응하는 환노출 상품의 페어 목록을 자동 감지하여 반환합니다."""
    query = select(ETFMaster.code, ETFMaster.name, ETFMaster.aum, ETFMaster.issuer)
    res = await db.execute(query)
    all_etfs = res.all()
    
    hedged_etfs = []
    unhedged_etfs = []
    
    for etf in all_etfs:
        name = etf.name
        # (H)가 붙어있는지 체크
        if "(H)" in name or " H" in name or name.endswith("H"):
            hedged_etfs.append(etf)
        else:
            unhedged_etfs.append(etf)
            
    pairs = []
    # 매핑 시도
    for h_etf in hedged_etfs:
        h_base = clean_etf_name_for_hedging(h_etf.name)
        
        # 환노출 목록 중에서 베이스 이름이 정확히 같거나, 베이스 이름이 환노출 이름에 포함되는 녀석 매핑
        best_match = None
        for u_etf in unhedged_etfs:
            u_base = clean_etf_name_for_hedging(u_etf.name)
            if h_base == u_base:
                best_match = u_etf
                break
                
        if best_match:
            pairs.append({
                "hedged": {
                    "code": h_etf.code,
                    "name": h_etf.name,
                    "aum": h_etf.aum,
                    "issuer": h_etf.issuer
                },
                "unhedged": {
                    "code": best_match.code,
                    "name": best_match.name,
                    "aum": best_match.aum,
                    "issuer": best_match.issuer
                },
                "base_name": h_base
            })
            
    return pairs


async def analyze_fx_impact(db: AsyncSession, h_code: str, u_code: str) -> dict:
    """
    환헤지(H) ETF와 환노출 ETF의 가격 추이 및 환율 추이를 1년 간 매칭해 분석하고,
    미래 환율 시나리오별 시뮬레이션 결과를 산출합니다.
    """
    # 1. ETF 메타데이터 로드
    q_meta = select(ETFMaster).where(ETFMaster.code.in_([h_code, u_code]))
    res_meta = await db.execute(q_meta)
    meta_list = res_meta.scalars().all()
    
    h_etf = next((e for e in meta_list if e.code == h_code), None)
    u_etf = next((e for e in meta_list if e.code == u_code), None)
    
    if not h_etf or not u_etf:
        return {"error": "환헤지 혹은 환노출 ETF를 찾을 수 없습니다."}
        
    # 2. 1년 기간 구하기
    end_date_str = datetime.now().strftime("%Y-%m-%d")
    start_date_str = (datetime.now() - timedelta(days=365)).strftime("%Y-%m-%d")
    
    # 3. 1년치 일별 가격 데이터 로드
    q_h_prices = select(ETFDailyPrice.date, ETFDailyPrice.close).where(
        ETFDailyPrice.code == h_code,
        ETFDailyPrice.date >= start_date_str
    ).order_by(ETFDailyPrice.date.asc())
    
    q_u_prices = select(ETFDailyPrice.date, ETFDailyPrice.close).where(
        ETFDailyPrice.code == u_code,
        ETFDailyPrice.date >= start_date_str
    ).order_by(ETFDailyPrice.date.asc())
    
    # 4. 환율 추이 데이터 로드 (market_macro_log)
    q_fx = select(MarketMacroLog.date, MarketMacroLog.krw).where(
        MarketMacroLog.date >= start_date_str,
        MarketMacroLog.krw.is_not(None)
    ).order_by(MarketMacroLog.date.asc())
    
    h_res, u_res, fx_res = await asyncio.gather(
        db.execute(q_h_prices),
        db.execute(q_u_prices),
        db.execute(q_fx)
    )
    
    h_data = {row.date: row.close for row in h_res.all()}
    u_data = {row.date: row.close for row in u_res.all()}
    fx_data = {row.date: row.krw for row in fx_res.all()}
    
    all_dates = sorted(set(h_data.keys()) & set(u_data.keys()))
    if not all_dates:
        return {"error": "매칭되는 공통 영업일 시계열 데이터가 없습니다."}
        
    # 첫날 기준 인덱스 100으로 지수화
    h_start_val = h_data[all_dates[0]]
    u_start_val = u_data[all_dates[0]]
    
    # 환율 첫 시점 구하기
    first_fx_date = all_dates[0]
    fx_start_val = fx_data.get(first_fx_date)
    if not fx_start_val:
        # 가장 가까운 과거 환율 찾기 fallback
        fallback_fx = [val for d, val in fx_data.items() if d <= first_fx_date]
        fx_start_val = fallback_fx[-1] if fallback_fx else 1300.0
        
    chart_data = []
    
    for d in all_dates:
        h_close = h_data[d]
        u_close = u_data[d]
        # 해당 날짜의 환율. 없으면 직전 영업일 환율로 메꿈
        fx_val = fx_data.get(d)
        if not fx_val:
            past_fx = [val for f_date, val in fx_data.items() if f_date <= d]
            fx_val = past_fx[-1] if past_fx else fx_start_val
            
        h_cum_return = (h_close - h_start_val) / h_start_val
        u_cum_return = (u_close - u_start_val) / u_start_val
        fx_cum_change = (fx_val - fx_start_val) / fx_start_val
        
        chart_data.append({
            "date": d,
            "hedged_close": h_close,
            "unhedged_close": u_close,
            "fx_rate": fx_val,
            "hedged_return": round(h_cum_return * 100, 2),
            "unhedged_return": round(u_cum_return * 100, 2),
            "fx_return": round(fx_cum_change * 100, 2),
            "gap": round((u_cum_return - h_cum_return) * 100, 2)
        })
        
    # 최근 1년 최종 성과 비교
    final_h_ret = chart_data[-1]["hedged_return"]
    final_u_ret = chart_data[-1]["unhedged_return"]
    final_fx_change = chart_data[-1]["fx_return"]
    final_gap = chart_data[-1]["gap"]
    
    # 시나리오 시뮬레이션 (원/달러 환율의 가상 변화 시 환헤지 대비 환노출의 최종 격차 분석)
    # 환노출 성과 = 환헤지 성과 + 환율 변동률 - (대략적인 헤지 수수료 등 연산)
    # 연간 환헤지 프리미엄/비용 추정치 = 한국-미국 금리차 차감 및 거래 비용 (평균 연 1.5% 수준 발생)
    hedge_cost_est = 1.25  # 연 1.25% 비용 발생 가정
    
    scenarios = [
        {"change": -15, "label": "급격한 원화 강세 (-15%)", "expected_fx": fx_data.get(all_dates[-1], fx_start_val) * 0.85},
        {"change": -5, "label": "완만한 원화 강세 (-5%)", "expected_fx": fx_data.get(all_dates[-1], fx_start_val) * 0.95},
        {"change": 0, "label": "환율 보합 (0%)", "expected_fx": fx_data.get(all_dates[-1], fx_start_val) * 1.0},
        {"change": 5, "label": "완만한 원화 약세 (+5%)", "expected_fx": fx_data.get(all_dates[-1], fx_start_val) * 1.05},
        {"change": 15, "label": "급격한 원화 약세 (+15%)", "expected_fx": fx_data.get(all_dates[-1], fx_start_val) * 1.15},
    ]
    
    simulation_results = []
    for sc in scenarios:
        # 환헤지는 환율 변동 0%이므로 헤지 비용만 발생
        h_sim_ret = final_h_ret
        # 환노출은 환율 변동에 직접 노출됨 (환헤지 대비 환율 변동만큼 격차 발생)
        u_sim_ret = final_h_ret + sc["change"] + hedge_cost_est
        
        simulation_results.append({
            "label": sc["label"],
            "fx_change_pct": sc["change"],
            "expected_fx": round(sc["expected_fx"], 2),
            "hedged_return": round(h_sim_ret, 2),
            "unhedged_return": round(u_sim_ret, 2),
            "advantage_unhedged": round(u_sim_ret - h_sim_ret, 2)
        })
        
    return {
        "hedged_info": {
            "code": h_code,
            "name": h_etf.name,
            "aum": h_etf.aum,
            "tot_fee": h_etf.tot_fee
        },
        "unhedged_info": {
            "code": u_code,
            "name": u_etf.name,
            "aum": u_etf.aum,
            "tot_fee": u_etf.tot_fee
        },
        "statistics": {
            "start_date": all_dates[0],
            "end_date": all_dates[-1],
            "hedged_1y_return": final_h_ret,
            "unhedged_1y_return": final_u_ret,
            "fx_1y_change": final_fx_change,
            "gap_1y": final_gap,
            "estimated_annual_hedge_cost": hedge_cost_est
        },
        "chart_data": chart_data,
        "scenarios": simulation_results
    }
