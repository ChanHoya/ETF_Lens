import logging
from typing import List
from pydantic import BaseModel
from fastapi import APIRouter, HTTPException
import yfinance as yf
import pandas as pd
from datetime import datetime, timedelta, timezone

logger = logging.getLogger(__name__)

router = APIRouter(tags=["backtest"])

class HoldingItem(BaseModel):
    code: str
    amount: float
    name: str

class BacktestRequest(BaseModel):
    holdings: List[HoldingItem]

def format_ticker(code: str) -> str:
    # 6자리 숫자는 한국 주식/ETF로 간주
    if len(code) == 6 and code.isdigit():
        return f"{code}.KS"
    return code

def calculate_mdd(cum_returns: pd.Series) -> float:
    roll_max = cum_returns.cummax()
    drawdown = cum_returns / roll_max - 1.0
    return drawdown.min() * 100  # percentage

@router.post("/run")
async def run_backtest(req: BacktestRequest):
    if not req.holdings:
        raise HTTPException(status_code=400, detail="포트폴리오가 비어있습니다.")
    
    total_amount = sum(h.amount for h in req.holdings if h.amount > 0)
    if total_amount == 0:
         return {"status": "error", "message": "투자 금액이 없습니다."}

    # 계산할 자산 가중치
    weights = {}
    for h in req.holdings:
        if h.amount > 0:
            ticker = format_ticker(h.code)
            weights[ticker] = weights.get(ticker, 0) + (h.amount / total_amount)
    
    tickers = list(weights.keys())
    benchmarks = ["^KS11", "^GSPC", "^IXIC"]  # 코스피, S&P500, 나스닥
    
    all_tickers = tickers + benchmarks
    
    try:
        # 최근 10년 데이터 가져오기
        logger.info(f"Downloading backtest data for: {all_tickers}")
        df = yf.download(all_tickers, period="10y", interval="1d", group_by="ticker", auto_adjust=True)
        
        # DataFrame 평탄화 (단일 종목일 경우 구조가 다를 수 있음 처리)
        if len(all_tickers) == 1:
            close_prices = pd.DataFrame({all_tickers[0]: df['Close']})
        else:
            close_prices = pd.DataFrame()
            for t in all_tickers:
                if t in df and 'Close' in df[t]:
                    close_prices[t] = df[t]['Close']

        # 결측치 처리 (전일가로 채움)
        close_prices = close_prices.ffill().dropna(how='all')
        
        # 일간 수익률 계산
        daily_returns = close_prices.pct_change().fillna(0)
        
        # 포트폴리오 일간 수익률 (단순 가중 평균)
        pf_returns = pd.Series(0.0, index=daily_returns.index)
        for t, w in weights.items():
            if t in daily_returns:
                pf_returns += daily_returns[t] * w

        daily_returns['Portfolio'] = pf_returns
        
        # 기준일 설정
        KST = timezone(timedelta(hours=9))
        end_date = datetime.now(KST).replace(tzinfo=None)
        
        periods = {
            "3M": 90,
            "6M": 180,
            "1Y": 365,
            "3Y": 365 * 3,
            "10Y": 365 * 10
        }
        
        results = {}
        chart_data = {}
        
        for p_name, p_days in periods.items():
            start_date = end_date - timedelta(days=p_days)
            # 해당 날짜 이후 데이터 필터링
            mask = daily_returns.index >= pd.Timestamp(start_date)
            period_returns = daily_returns.loc[mask]
            
            if period_returns.empty:
                continue
                
            # 누적 수익률 계산
            cum_returns = (1 + period_returns).cumprod()
            
            period_summary = {}
            # Portfolio & Benchmarks
            targets = ["Portfolio"] + benchmarks
            for t in targets:
                if t in cum_returns.columns:
                    final_ret = (cum_returns[t].iloc[-1] - 1) * 100 if not cum_returns[t].empty else 0
                    mdd = calculate_mdd(cum_returns[t]) if not cum_returns[t].empty else 0
                    period_summary[t] = {
                        "return": final_ret,
                        "mdd": mdd
                    }
                    
            results[p_name] = period_summary
            
            # 차트 데이터 준비 (1Y까지만 차트 데이터 반환하여 트래픽 최소화, 필요시 전체도 가능하지만 여기서는 3Y로 제한 설정)
            if p_name in ["3M", "6M", "1Y", "3Y"]:
                # 샘플링해서 100개 포인트 정도로 줄이기
                step = max(1, len(cum_returns) // 100)
                sampled = cum_returns.iloc[::step]
                # 마지막 날짜 포함
                if sampled.index[-1] != cum_returns.index[-1]:
                    sampled = pd.concat([sampled, cum_returns.iloc[-1:]])
                
                chart_points = []
                for idx, row in sampled.iterrows():
                    point = {"date": idx.strftime("%Y-%m-%d")}
                    for t in targets:
                        if t in row and not pd.isna(row[t]):
                            point[t] = (row[t] - 1) * 100
                    chart_points.append(point)
                chart_data[p_name] = chart_points
                
        # 인사이트 뼈대 생성
        pf_1y = results.get("1Y", {}).get("Portfolio", {})
        spx_1y = results.get("1Y", {}).get("^GSPC", {})
        
        insights = []
        if pf_1y and spx_1y:
            if pf_1y["mdd"] > spx_1y["mdd"]:
                insights.append("지난 1년간 S&P500 대비 하락 방어력이 우수했습니다.")
            else:
                insights.append("지난 1년간 S&P500 대비 최대 낙폭(MDD)이 컸습니다. 포트폴리오의 변동성 관리가 필요할 수 있습니다.")
                
            if pf_1y["return"] > spx_1y["return"]:
                insights.append("수익률 측면에서 시장 (S&P500) 수익률을 상회했습니다!")
            else:
                insights.append("시장(S&P500) 대비 상승폭이 다소 밑돌았습니다.")
        
        return {
            "status": "success",
            "weights": weights,
            "results": results,
            "chart_data": chart_data,
            "insights": insights
        }

    except Exception as e:
        logger.error(f"Backtest failed: {e}", exc_info=True)
        raise HTTPException(status_code=500, detail=str(e))
