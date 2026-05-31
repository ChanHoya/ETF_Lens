import logging
import asyncio
import numpy as np
import pandas as pd
from typing import List
from datetime import datetime, timedelta
from pydantic import BaseModel, Field
from fastapi import APIRouter, HTTPException

logger = logging.getLogger(__name__)
router = APIRouter(tags=["efficient-frontier"])

class HoldingItem(BaseModel):
    code: str
    amount: float
    name: str
    category: str = "기타"

class EfficientFrontierRequest(BaseModel):
    holdings: List[HoldingItem]
    lookback_years: float = Field(default=1.0, ge=0.25, le=5.0, description="과거 데이터 기간 (년 단위, 0.25~5.0)")
    risk_free_rate: float = Field(default=3.0, ge=0.0, le=20.0, description="연율화 무위험 이자율 (%, 0~20)")
    simulations: int = Field(default=5000, ge=100, le=20000, description="몬테카를로 시뮬레이션 반복 횟수 (100~20,000)")

def format_ticker(code: str) -> str:
    # 6자리 숫자는 한국 주식/ETF로 간주
    if len(code) == 6 and code.isdigit():
        return f"{code}.KS"
    return code

def clean_ticker_for_kr(symbol: str) -> str:
    # Extract raw 6 digit KR ticker code
    if len(symbol) == 9 and (symbol.endswith(".KS") or symbol.endswith(".KQ")) and symbol[:-3].isdigit():
        return symbol[:-3]
    return symbol

def fetch_ticker_prices(symbol: str, start_str: str, end_str: str) -> pd.Series:
    # 1. Check if Korean ticker
    kr_code = clean_ticker_for_kr(symbol)
    is_kr = len(kr_code) == 6 and kr_code.isdigit()
    
    closes = None
    
    # --- Step 1: Try FinanceDataReader ---
    if is_kr:
        try:
            import FinanceDataReader as fdr
            df = fdr.DataReader(kr_code, start_str, end_str)
            if df is not None and not df.empty:
                for col in ["종가", "Close", "close"]:
                    if col in df.columns:
                        closes = df[col]
                        break
        except Exception as e:
            logger.warning(f"[EF-Fetch] FDR failed for {kr_code}: {e}")
            
        # --- Step 2: Try pykrx ---
        if closes is None or closes.empty:
            try:
                from pykrx import stock
                s_date = start_str.replace("-", "")
                e_date = end_str.replace("-", "")
                df = stock.get_market_ohlcv_by_date(s_date, e_date, kr_code)
                if df is not None and not df.empty and "종가" in df.columns:
                    closes = df["종가"]
            except Exception as e:
                logger.warning(f"[EF-Fetch] pykrx failed for {kr_code}: {e}")
                
    # --- Step 3: Try Yahoo Finance v8 Chart API (for both KR and US) ---
    if closes is None or closes.empty:
        try:
            import requests
            import time
            # Convert string dates to timestamps
            p1 = int(time.mktime(time.strptime(start_str, "%Y-%m-%d")))
            p2 = int(time.mktime(time.strptime(end_str, "%Y-%m-%d"))) + 86400
            
            # For KR code, try both .KS and .KQ if suffix was not explicit
            suffixes = [""] if (".KS" in symbol or ".KQ" in symbol) else [".KS", ".KQ"]
            for suff in suffixes:
                sym_enc = f"{symbol}{suff}".replace("^", "%5E").replace("=", "%3D")
                url = f"https://query1.finance.yahoo.com/v8/finance/chart/{sym_enc}?interval=1d&period1={p1}&period2={p2}"
                resp = requests.get(url, headers={"User-Agent": "Mozilla/5.0"}, timeout=12, verify=False)
                if resp.status_code == 200:
                    rb = resp.json().get("chart", {}).get("result", [])
                    if rb:
                        quote = rb[0].get("indicators", {}).get("quote", [{}])[0]
                        cls_list = quote.get("close", [])
                        timestamps = rb[0].get("timestamp", [])
                        if len(cls_list) == len(timestamps) and len(cls_list) > 0:
                            # Create pandas series with date index
                            dates = [datetime.fromtimestamp(ts).date() for ts in timestamps]
                            temp_series = pd.Series(cls_list, index=pd.to_datetime(dates))
                            closes = temp_series.dropna()
                            if not closes.empty:
                                break
        except Exception as e:
            logger.warning(f"[EF-Fetch] Yahoo v8 failed for {symbol}: {e}")
            
    # --- Step 4: Try yfinance as last resort ---
    if closes is None or closes.empty:
        try:
            import yfinance as yf
            suffixes = [""] if (".KS" in symbol or ".KQ" in symbol or not is_kr) else [".KS", ".KQ"]
            for suff in suffixes:
                hist = yf.Ticker(f"{symbol}{suff}").history(start=start_str, end=end_str, auto_adjust=True)
                if hist is not None and not hist.empty:
                    closes = hist["Close"].dropna()
                    if not closes.empty:
                        break
        except Exception as e:
            logger.warning(f"[EF-Fetch] yfinance failed for {symbol}: {e}")
            
    if closes is not None and not closes.empty:
        # Normalise index to plain date objects for cross-source alignment
        try:
            closes.index = pd.to_datetime(closes.index).date
        except Exception:
            pass  # Index already in date format
        closes = closes[closes > 0]
        
    return closes

@router.post("/efficient-frontier")
async def calculate_efficient_frontier(req: EfficientFrontierRequest):
    if not req.holdings:
        raise HTTPException(status_code=400, detail="포트폴리오 자산이 비어있습니다.")
        
    # 1. 현금 및 예수금 등 자산배분 제외 종목 필터링
    risky_holdings = []
    for h in req.holdings:
        name_lower = h.name.lower()
        code_upper = h.code.upper()
        if (
            code_upper == "CASH" 
            or "현금" in name_lower 
            or "예수금" in name_lower 
            or "usd" in name_lower 
            or "krw" in name_lower 
            or h.amount <= 0
        ):
            continue
        risky_holdings.append(h)
        
    if len(risky_holdings) < 2:
        raise HTTPException(
            status_code=400, 
            detail="최적화를 위해서는 최소 2개 이상의 위험 자산(주식, 채권, ETF 등)이 필요합니다."
        )
        
    tickers = [format_ticker(h.code) for h in risky_holdings]
    ticker_to_name = {format_ticker(h.code): h.name for h in risky_holdings}
    ticker_to_code = {format_ticker(h.code): h.code for h in risky_holdings}
    
    # 2. 날짜 범위 지정 (로컬 시간 기준, 서버 TZ = KST)
    end_date = datetime.now()
    # lookback_years 입력 범위는 Pydantic Field(ge=0.25, le=5.0)로 보장됨
    start_date = end_date - timedelta(days=int(req.lookback_years * 365))
    start_str = start_date.strftime("%Y-%m-%d")
    end_str = end_date.strftime("%Y-%m-%d")
    
    # 3. 비동기/병렬 가격 수집 실행
    logger.info(f"[EF] Start fetching historical prices for {tickers} from {start_str}")
    tasks = [asyncio.to_thread(fetch_ticker_prices, sym, start_str, end_str) for sym in tickers]
    fetched_list = await asyncio.gather(*tasks)
    
    price_dict = {}
    for sym, closes in zip(tickers, fetched_list):
        if closes is not None and len(closes) >= 5:
            price_dict[sym] = closes
            
    if len(price_dict) < 2:
        raise HTTPException(
            status_code=400, 
            detail="최적화 분석을 위한 충분한 가격 데이터(최소 2개 자산)가 확보되지 않았습니다."
        )
        
    # 4. 판다스 데이터프레임 정렬 및 결측치 보정
    df_prices = pd.DataFrame(price_dict)
    df_prices = df_prices.ffill().dropna(how='all')
    df_prices = df_prices.dropna()  # 공통 영업일 기준 필터
    
    if len(df_prices) < 10:
        raise HTTPException(
            status_code=400, 
            detail="자산 간의 공통 거래일 데이터가 부족하여 상관관계를 연산할 수 없습니다."
        )
        
    # 5. 수익률 및 공분산 연산
    df_returns = df_prices.pct_change().dropna()
    if df_returns.empty:
        raise HTTPException(status_code=400, detail="수익률 시계열 연산에 실패했습니다.")
        
    mean_returns = df_returns.mean()
    cov_matrix = df_returns.cov()
    
    # 연율화 (252 거래일 기준)
    annualised_returns = mean_returns * 252
    annualised_cov = cov_matrix * 252
    
    # 정렬된 티커 리스트
    aligned_tickers = list(df_prices.columns)
    M = len(aligned_tickers)
    
    # 사용자 현재 포트폴리오 가중치 산출
    current_risky_amounts = [
        next(h.amount for h in risky_holdings if format_ticker(h.code) == sym) 
        for sym in aligned_tickers
    ]
    total_risky_amount = sum(current_risky_amounts)
    current_weights = np.array([amt / total_risky_amount for amt in current_risky_amounts])
    
    # 6. 몬테카를로 시뮬레이션 가중치 난수 행렬 생성
    # Pydantic Field(ge=100, le=20000)으로 입력 범위가 보장되므로 clamp 유지하되 최소값만 조정
    N = max(500, min(req.simulations, 20000))
    weights_sim = np.random.dirichlet(np.ones(M), size=N)
    
    # MPT 포트폴리오 계산
    rf = req.risk_free_rate / 100.0
    mean_ret_arr = annualised_returns.loc[aligned_tickers].values
    cov_arr = annualised_cov.loc[aligned_tickers, aligned_tickers].values
    
    sim_returns = np.dot(weights_sim, mean_ret_arr)
    # Memory optimization: O(N*M) instead of np.diag
    sim_vols = np.sqrt(np.sum(np.dot(weights_sim, cov_arr) * weights_sim, axis=1))
    sim_sharpes = np.where(sim_vols > 0, (sim_returns - rf) / sim_vols, 0.0)
    
    # 현재 포트폴리오 메트릭
    current_return = np.dot(current_weights, mean_ret_arr)
    current_vol = np.sqrt(np.dot(np.dot(current_weights, cov_arr), current_weights))
    current_sharpe = (current_return - rf) / current_vol if current_vol > 0 else 0.0
    
    # 7. 최적 포트폴리오 탐색
    # Max Sharpe
    max_sharpe_idx = np.argmax(sim_sharpes)
    max_sharpe_weights = weights_sim[max_sharpe_idx]
    
    # Min Variance
    min_var_idx = np.argmin(sim_vols)
    min_var_weights = weights_sim[min_var_idx]
    
    # 8. 효율적 전선(Efficient Frontier) 라인 경계선 산출 (Numeric Binning)
    min_frontier_return = sim_returns[min_var_idx]
    max_frontier_return = np.max(sim_returns)
    
    frontier_returns = np.linspace(min_frontier_return, max_frontier_return, 25)
    frontier_points = []
    
    # 기대수익률 구간별 최소 변동성 포트폴리오 바인딩
    bin_width = (max_frontier_return - min_frontier_return) / 48
    for target_ret in frontier_returns:
        mask = (sim_returns >= target_ret - bin_width) & (sim_returns <= target_ret + bin_width)
        if np.any(mask):
            bin_vols = sim_vols[mask]
            bin_rets = sim_returns[mask]
            bin_sharpes = sim_sharpes[mask]
            bin_weights = weights_sim[mask]
            
            min_idx = np.argmin(bin_vols)
            frontier_points.append({
                "return": float(bin_rets[min_idx] * 100),
                "volatility": float(bin_vols[min_idx] * 100),
                "sharpe": float(bin_sharpes[min_idx]),
                "weights": {ticker_to_code[aligned_tickers[j]]: float(bin_weights[min_idx][j]) for j in range(M)}
            })
            
    # 정렬하여 매끄러운 커브 구성 보장
    frontier_points.sort(key=lambda x: x["return"])
    
    # 9. 산점도용 난수 포트폴리오 다운샘플링 (800개)
    scatter_points = []
    step = max(1, N // 800)
    for idx in range(0, N, step):
        scatter_points.append({
            "return": float(sim_returns[idx] * 100),
            "volatility": float(sim_vols[idx] * 100),
            "sharpe": float(sim_sharpes[idx])
        })
        
    return {
        "status": "success",
        "tickers": {
            ticker_to_code[sym]: {
                "name": ticker_to_name[sym],
                "symbol": sym,
                "annualised_return": float(annualised_returns[sym] * 100),
                "volatility": float(np.sqrt(annualised_cov.loc[sym, sym]) * 100)
            }
            for sym in aligned_tickers
        },
        "max_sharpe": {
            "return": float(sim_returns[max_sharpe_idx] * 100),
            "volatility": float(sim_vols[max_sharpe_idx] * 100),
            "sharpe": float(sim_sharpes[max_sharpe_idx]),
            "weights": {ticker_to_code[aligned_tickers[j]]: float(max_sharpe_weights[j]) for j in range(M)}
        },
        "min_var": {
            "return": float(min_frontier_return * 100),
            "volatility": float(sim_vols[min_var_idx] * 100),
            "sharpe": float(sim_sharpes[min_var_idx]),
            "weights": {ticker_to_code[aligned_tickers[j]]: float(min_var_weights[j]) for j in range(M)}
        },
        "current": {
            "return": float(current_return * 100),
            "volatility": float(current_vol * 100),
            "sharpe": float(current_sharpe),
            "weights": {ticker_to_code[aligned_tickers[j]]: float(current_weights[j]) for j in range(M)}
        },
        "frontier": frontier_points,
        "scatter": scatter_points
    }
