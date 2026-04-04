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
    category: str = "기타"

class BacktestRequest(BaseModel):
    holdings: List[HoldingItem]

class BacktestResultData(BaseModel):
    results: dict  # Contains 3M, 6M, 1Y, 3Y, 10Y MDD and Return metrics
    weights: dict

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

    weights = {}
    cat_weights = {} # category -> { ticker: amount }
    overall_tickers = set()

    for h in req.holdings:
        if h.amount > 0:
            ticker = format_ticker(h.code)
            weights[ticker] = weights.get(ticker, 0) + (h.amount / total_amount)
            overall_tickers.add(ticker)
            
            # exclude cash/spot from specific sub-portfolios, but keep in overall
            if "현금" not in h.category and "현물" not in h.category:
                if h.category not in cat_weights:
                    cat_weights[h.category] = {}
                cat_weights[h.category][ticker] = cat_weights[h.category].get(ticker, 0) + h.amount
    
    tickers = list(overall_tickers)
    benchmarks = ["^KS11", "^KQ11", "^GSPC", "^IXIC"]  # 코스피, 코스닥, S&P500, 나스닥
    
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
        
        # 분야별 포트폴리오 수익률 계산
        for cat, cw in cat_weights.items():
            cat_total = sum(cw.values())
            if cat_total == 0: continue
            
            sub_pf = pd.Series(0.0, index=daily_returns.index)
            for t, amt in cw.items():
                if t in daily_returns:
                    sub_pf += daily_returns[t] * (amt / cat_total)
            daily_returns[f'Portfolio_{cat}'] = sub_pf
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
            # Portfolio, Sub-portfolios & Benchmarks
            targets = ["Portfolio"] + [f"Portfolio_{cat}" for cat in cat_weights.keys()] + benchmarks
            for t in targets:
                if t in cum_returns.columns:
                    final_ret = (cum_returns[t].iloc[-1] - 1) * 100 if not cum_returns[t].empty else 0
                    mdd = calculate_mdd(cum_returns[t]) if not cum_returns[t].empty else 0
                    period_summary[t] = {
                        "return": final_ret,
                        "mdd": mdd
                    }
                    
            results[p_name] = period_summary
            
            # 차트 데이터 준비
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
            # AI Insight는 성능 분리를 위해 더 이상 여기서 반환하지 않고
            # 빈 배열만 반환하여 하위호환 유지
            "insights": [] 
        }

    except Exception as e:
        logger.error(f"Backtest failed: {e}", exc_info=True)
        raise HTTPException(status_code=500, detail=str(e))

@router.post("/insight")
async def generate_backtest_insight(req: BacktestResultData):
    """
    백테스트 결과(수익률, MDD 등)를 전달받아 Gemini를 통해
    방어력 및 상관관계 인사이트를 생성해 반환합니다.
    """
    import os
    import asyncio
    
    api_key = os.environ.get("GEMINI_API_KEY", "")
    if not api_key:
        return {"status": "error", "insight_md": "Gemini API 키가 설정되지 않았습니다."}
        
    results = req.results
    weights = req.weights
    
    if not results or "1Y" not in results:
        return {"status": "error", "insight_md": "데이터가 부족하여 AI 분석을 수행할 수 없습니다."}
        
    try:
        from google import genai
        client = genai.Client(api_key=api_key)
        
        # Build prompt using existing results
        prompt = f"""당신은 최고 수준의 퀀트 투자 전문가이자 자산배분 매니저입니다.
다음은 사용자의 포트폴리오와 벤치마크 지수들의 과거 수익률 및 최대 낙폭(MDD, 숫자가 낮을수록 하락폭이 큼) 데이터입니다.

포트폴리오 비중: {weights}

[1년 (1Y) 성과]
- 내 포트폴리오: 수익률 {results.get('1Y', {}).get('Portfolio', {}).get('return', 0):.2f}%, MDD {results.get('1Y', {}).get('Portfolio', {}).get('mdd', 0):.2f}%
- KOSPI: 수익률 {results.get('1Y', {}).get('^KS11', {}).get('return', 0):.2f}%, MDD {results.get('1Y', {}).get('^KS11', {}).get('mdd', 0):.2f}%
- S&P 500: 수익률 {results.get('1Y', {}).get('^GSPC', {}).get('return', 0):.2f}%, MDD {results.get('1Y', {}).get('^GSPC', {}).get('mdd', 0):.2f}%
- NASDAQ: 수익률 {results.get('1Y', {}).get('^IXIC', {}).get('return', 0):.2f}%, MDD {results.get('1Y', {}).get('^IXIC', {}).get('mdd', 0):.2f}%

[3년 (3Y) 성과 (가능할 경우)]
- 내 포트폴리오: 수익률 {results.get('3Y', {}).get('Portfolio', {}).get('return', 0):.2f}%, MDD {results.get('3Y', {}).get('Portfolio', {}).get('mdd', 0):.2f}%
- S&P 500: 수익률 {results.get('3Y', {}).get('^GSPC', {}).get('return', 0):.2f}%, MDD {results.get('3Y', {}).get('^GSPC', {}).get('mdd', 0):.2f}%

이 데이터를 객관적으로 분석하여 개인 투자자에게 도움이 될 보고서를 작성하세요. 다음 사항을 반드시 포함하세요:
1. 방어력 평가 (하방 경직성): KOSPI 및 S&P500 대비 하락(MDD)을 얼마나 잘 방어했는가?
2. 성장성 평가: 시장 대비 초과 수익을 달성했는가? 변동성 대비 수익을 잘 뽑아냈는가?
3. 위험 요소 및 보유 비중에 대한 짧은 조언.

마크다운 형식(Bold, Bullet point 적용)으로 3~4문단 이내로 아주 전문적이고 간결하게 작성하세요. 인사말이나 꼬릿말은 생략하세요.
"""
        response = await asyncio.to_thread(
            client.models.generate_content,
            model="gemini-2.5-flash",
            contents=prompt,
        )
        
        return {
            "status": "success",
            "insight_md": response.text.strip()
        }
    except Exception as e:
        logger.error(f"Insight generation failed: {e}")
        return {"status": "error", "insight_md": "AI 분석 중 오류가 발생했습니다."}

