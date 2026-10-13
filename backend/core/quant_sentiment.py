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

def calculate_hybrid_fgi(
    vix: float,
    kospi_rv: float,
    sp500_rsi: float = 50.0,
    kospi_rsi: float | None = None
) -> float:
    """다차원 하이브리드 Fear & Greed Index (FGI) 산출:
    1) KOSPI RSI가 주어질 경우:
       - 국내 시장 직접 반영: KOSPI RSI (40%) + KOSPI 실현 변동성 (35%) = 총 75%
       - 글로벌 지표 보조: VIX (15%) + S&P 500 RSI (10%) = 총 25%
       - 코스피 급락 시 FGI가 60점대(탐욕)로 역주행하는 미국 편향 왜곡 원천 차단
    2) KOSPI RSI 미제공 시(하위 호환):
       - VIX (40%) + KOSPI RV (30%) + S&P 500 RSI (30%)
    """
    # 1. VIX Score (12 ~ 35 범위: 낮을수록 탐욕, 높을수록 공포)
    vix = max(12.0, min(35.0, vix))
    vix_score = 100.0 - ((vix - 12.0) / (35.0 - 12.0)) * 100.0

    # 2. KOSPI Realized Volatility Score (10 ~ 35 범위: 낮을수록 탐욕, 높을수록 공포)
    kospi_rv = max(10.0, min(35.0, kospi_rv))
    kospi_rv_score = 100.0 - ((kospi_rv - 10.0) / (35.0 - 10.0)) * 100.0

    # 3. S&P 500 RSI Score (0 ~ 100)
    sp_rsi_score = max(0.0, min(100.0, sp500_rsi))

    if kospi_rsi is not None:
        # 4. KOSPI RSI Score (0 ~ 100: 낮을수록 극단적 공포/과매도)
        kr_rsi_score = max(0.0, min(100.0, kospi_rsi))
        final_fgi = (
            (kr_rsi_score * 0.40) +
            (kospi_rv_score * 0.35) +
            (vix_score * 0.15) +
            (sp_rsi_score * 0.10)
        )
    else:
        # 기존 가중합산 (4:3:3)
        final_fgi = (vix_score * 0.40) + (kospi_rv_score * 0.30) + (sp_rsi_score * 0.30)

    return round(float(final_fgi), 1)
