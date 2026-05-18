import logging
import numpy as np
import pandas as pd
from datetime import datetime, timezone, timedelta

logger = logging.getLogger(__name__)

def calculate_realized_volatility(prices: pd.Series, window: int = 20) -> pd.Series:
    """KOSPI 종가 시계열을 바탕으로 연율화된 역사적/실현 변동성(Historical Volatility)을 연산합니다.
    VKOSPI의 초정밀 Proxy 지표로 활용됩니다.
    
    Formula:
        returns = ln(P_t / P_{t-1})
        realized_vol = std(returns, window) * sqrt(252) * 100
    """
    if len(prices) < window + 1:
        # 데이터가 부족하면 빈 시리즈 반환
        return pd.Series(index=prices.index, dtype=float).fillna(0.0)
        
    try:
        # 로그 수익률 계산
        log_returns = np.log(prices / prices.shift(1))
        # rolling 표준편차 연산 및 연율화
        rolling_std = log_returns.rolling(window=window).std()
        realized_vol = rolling_std * np.sqrt(252) * 100.0
        
        # NaN 값 처리 (최초 window일 제외) 및 하한선 제한 (0이 되는 것 방지)
        realized_vol = realized_vol.fillna(method='bfill').clip(lower=0.1)
        return realized_vol
    except Exception as e:
        logger.error(f"Error calculating realized volatility: {e}")
        return pd.Series(index=prices.index, dtype=float).fillna(15.0)

def calculate_rsi(prices: pd.Series, window: int = 14) -> pd.Series:
    """주가 시계열의 RSI(Relative Strength Index)를 계산합니다.
    시장의 과매수/과매도 심리를 평가하기 위한 모멘텀 지표로 쓰입니다.
    """
    if len(prices) < window + 1:
        return pd.Series(index=prices.index, dtype=float).fillna(50.0)
        
    try:
        delta = prices.diff()
        gain = (delta.clip(lower=0)).rolling(window=window).mean()
        loss = (-delta.clip(upper=0)).rolling(window=window).mean()
        
        # 분모 0 방지
        rs = gain / loss.replace(0, 0.00001)
        rsi = 100 - (100 / (1 + rs))
        return rsi.fillna(50.0)
    except Exception as e:
        logger.error(f"Error calculating RSI: {e}")
        return pd.Series(index=prices.index, dtype=float).fillna(50.0)

def calculate_hybrid_fgi(vix: float, kospi_rv: float, sp500_rsi: float) -> float:
    """다차원 하이브리드 Fear & Greed Index (FGI) 산출:
    1) VIX 기반 공포 점수 (40%): VIX가 낮을수록 탐욕, 높을수록 공포
       - VIX 12이하: 100, VIX 35이상: 0 으로 선형 맵핑
    2) KOSPI 실현 변동성 점수 (30%): 국내 변동성 기반
       - KOSPI RV 10이하: 100, KOSPI RV 35이상: 0 으로 선형 맵핑
    3) S&P 500 RSI 점수 (30%): 모멘텀 기반
       - RSI 그대로 사용 (RSI 70이상은 Greed, 30이하는 Fear 상황을 완벽 대변)
       
    각 점수(0~100)를 가중합산하여 최종 하이브리드 FGI를 산출합니다.
    """
    # 1. VIX Score (12 ~ 35 범위)
    vix = max(12.0, min(35.0, vix))
    vix_score = 100.0 - ((vix - 12.0) / (35.0 - 12.0)) * 100.0
    
    # 2. KOSPI Realized Volatility Score (10 ~ 35 범위)
    kospi_rv = max(10.0, min(35.0, kospi_rv))
    kospi_rv_score = 100.0 - ((kospi_rv - 10.0) / (35.0 - 10.0)) * 100.0
    
    # 3. S&P 500 RSI Score (RSI는 이미 0~100 범위)
    rsi_score = max(0.0, min(100.0, sp500_rsi))
    
    # 가중 합산 (4:3:3)
    final_fgi = (vix_score * 0.40) + (kospi_rv_score * 0.30) + (rsi_score * 0.30)
    return round(float(final_fgi), 1)
