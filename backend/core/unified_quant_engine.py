"""통합 퀀트 데이터 엔진 (Unified Quant Engine)

Sprint 10:
- S10-1: 시계열 정규화, 4대 심층 리스크(Vol/Sharpe/Sortino/Calmar) 및 VaR(95%, 99%) 연산 일원화
- S10-2: Non-blocking 비동기 HTTP 커넥션 풀(httpx) 및 동시성 제어 세마포어(asyncio.Semaphore) 탑재
"""

import asyncio
import logging
import time
from datetime import datetime, timedelta, timezone as _tz
from typing import Dict, List, Optional, Any, Tuple, Union
import numpy as np
import pandas as pd
import httpx
from sqlalchemy.ext.asyncio import AsyncSession

from core.hybrid_series import get_hybrid_daily_prices_batch, _clean_ticker, _is_korean_asset, _normalize_korean_code
from db.database import AsyncSessionLocal

logger = logging.getLogger(__name__)


def calculate_mdd(cum_returns: pd.Series) -> float:
    """누적 수익률 시계열(1.0 기준)에서 최대 낙폭(MDD, %) 계산"""
    if cum_returns.empty:
        return 0.0
    roll_max = cum_returns.cummax()
    drawdown = cum_returns / roll_max - 1.0
    return float(drawdown.min() * 100.0)


class UnifiedQuantEngine:
    """통합 퀀트 데이터 및 통계 연산 싱글톤 엔진 (비동기 HTTP 풀 및 세마포어 탑재)"""

    _instance = None
    _http_client: Optional[httpx.AsyncClient] = None
    _semaphore: Optional[asyncio.Semaphore] = None

    def __new__(cls, *args, **kwargs):
        if cls._instance is None:
            cls._instance = super(UnifiedQuantEngine, cls).__new__(cls)
            cls._instance._semaphore = asyncio.Semaphore(8)
        return cls._instance

    async def get_http_client(self) -> httpx.AsyncClient:
        """재사용 가능한 글로벌 비동기 HTTP 클라이언트 커넥션 풀 반환"""
        if self._http_client is None or self._http_client.is_closed:
            limits = httpx.Limits(max_keepalive_connections=20, max_connections=40, keepalive_expiry=30.0)
            timeout = httpx.Timeout(connect=3.0, read=5.0, write=5.0, pool=5.0)
            self._http_client = httpx.AsyncClient(
                limits=limits,
                timeout=timeout,
                headers={"User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36"},
            )
        return self._http_client

    async def close(self):
        """HTTP 클라이언트 세션 안전 종료"""
        if self._http_client and not self._http_client.is_closed:
            await self._http_client.aclose()
            self._http_client = None

    @staticmethod
    def normalize_series_index(series: pd.Series) -> pd.Series:
        """시계열의 DatetimeIndex를 tz-naive, 자정 기준 normalize, 중복 제거 및 정렬 수행"""
        if series.empty:
            return series

        s = series.dropna()
        if isinstance(s, pd.DataFrame):
            s = s.iloc[:, 0]

        # Datetime 변환 및 normalize
        s.index = pd.to_datetime(s.index).normalize()

        # tz-aware인 경우 tz-naive로 통일
        if hasattr(s.index, "tz") and s.index.tz is not None:
            s.index = s.index.tz_localize(None)

        # 인덱스 중복 제거 (마지막 값 유지) 및 오름차순 정렬
        s = s[~s.index.duplicated(keep="last")].sort_index()
        return s

    async def fetch_live_price(self, ticker: str) -> Optional[float]:
        """세마포어와 재사용 HTTP 커넥션 풀을 통한 단일 종목 실시간 현재가 비동기 조회"""
        clean = _clean_ticker(ticker)
        sem = self._semaphore or asyncio.Semaphore(8)

        async with sem:
            if _is_korean_asset(clean):
                code = _normalize_korean_code(clean)
                try:
                    client = await self.get_http_client()
                    url = f"https://m.stock.naver.com/api/stock/{code}/basic"
                    res = await client.get(url)
                    if res.status_code == 200:
                        data = res.json()
                        now_price_str = data.get("nowPrice") or data.get("closePrice")
                        if now_price_str:
                            return float(str(now_price_str).replace(",", ""))
                except Exception as e:
                    logger.debug(f"[UnifiedQuantEngine] Naver live price error for {code}: {e}")

            # 미국/글로벌 자산 (Yahoo Finance fast_info)
            try:
                import yfinance as yf
                ticker_obj = yf.Ticker(clean)
                fast_info = getattr(ticker_obj, "fast_info", None)
                if fast_info:
                    price = getattr(fast_info, "last_price", None)
                    if price and float(price) > 0:
                        return float(price)

                # fallback: 1일 히스토리
                hist = await asyncio.to_thread(lambda: ticker_obj.history(period="1d"))
                if not hist.empty and "Close" in hist.columns:
                    return float(hist["Close"].iloc[-1])
            except Exception as e:
                logger.debug(f"[UnifiedQuantEngine] Yahoo live price error for {clean}: {e}")

        return None

    async def fetch_live_prices_batch(self, tickers: List[str]) -> Dict[str, Optional[float]]:
        """복수 종목 실시간 시세를 세마포어 제어 하에 병렬 비동기 조회"""
        tasks = [self.fetch_live_price(t) for t in tickers]
        results = await asyncio.gather(*tasks, return_exceptions=True)
        out = {}
        for t, r in zip(tickers, results):
            out[t] = r if isinstance(r, (int, float)) else None
        return out

    async def get_normalized_close_matrix(
        self,
        tickers: List[str],
        db: Optional[AsyncSession] = None,
        days: int = 3650,
        include_live: bool = True,
    ) -> pd.DataFrame:
        """복수 종목/지수의 과거 일봉 종가를 DB 하이브리드 엔진을 통해 조회하고
        클린 매트릭스(DataFrame)로 반환.
        
        - 모든 인덱스는 tz-naive 일자
        - 중복 인덱스 제거 보장
        - 전방 결측치 ffill() 보정
        """
        if not tickers:
            return pd.DataFrame()

        clean_tickers = [t.strip() for t in tickers if t and t.strip()]
        t0 = time.time()
        close_dict: Dict[str, pd.Series] = {}

        # 1. DB 하이브리드 시계열 엔진 일괄 조회
        try:
            if db is not None:
                batch_data = await get_hybrid_daily_prices_batch(clean_tickers, db, days=days, include_live=include_live)
            else:
                async with AsyncSessionLocal() as session:
                    batch_data = await get_hybrid_daily_prices_batch(clean_tickers, session, days=days, include_live=include_live)

            for ticker, item in batch_data.items():
                dates = item.get("dates", [])
                prices = item.get("prices", [])
                if dates and prices and len(dates) == len(prices):
                    idx = pd.to_datetime(dates).normalize()
                    s = pd.Series(prices, index=idx, name=ticker, dtype=float)
                    s = self.normalize_series_index(s)
                    if not s.empty:
                        close_dict[ticker] = s
        except Exception as e:
            logger.warning(f"[UnifiedQuantEngine] Batch fetch error: {e}")

        # 2. 누락된 티커 fallback 처리 (yfinance)
        missing_tickers = [t for t in clean_tickers if t not in close_dict]
        if missing_tickers:
            logger.info(f"[UnifiedQuantEngine] Downloading fallback for missing tickers: {missing_tickers}")
            try:
                import yfinance as yf
                raw_df = await asyncio.to_thread(
                    yf.download,
                    missing_tickers,
                    period="10y",
                    interval="1d",
                    group_by="ticker",
                    auto_adjust=True,
                    progress=False,
                )
                if raw_df is not None and not raw_df.empty:
                    if len(missing_tickers) == 1:
                        t = missing_tickers[0]
                        if "Close" in raw_df.columns:
                            s = self.normalize_series_index(raw_df["Close"].dropna())
                            if not s.empty:
                                close_dict[t] = s
                    else:
                        for t in missing_tickers:
                            if t in raw_df and "Close" in raw_df[t]:
                                s = self.normalize_series_index(raw_df[t]["Close"].dropna())
                                if not s.empty:
                                    close_dict[t] = s
            except Exception as yf_err:
                logger.error(f"[UnifiedQuantEngine] Fallback download failed: {yf_err}")

        if not close_dict:
            return pd.DataFrame()

        # 3. 통합 DataFrame 구축 및 ffill 결측치 보정
        df = pd.DataFrame(close_dict)
        df = df.loc[~df.index.duplicated(keep="last")].sort_index()
        df = df.ffill().dropna(how="all")

        elapsed = time.time() - t0
        logger.debug(f"[UnifiedQuantEngine] Matrix loaded {len(df.columns)} assets, {len(df)} days in {elapsed:.3f}s")
        return df

    def calculate_risk_metrics(
        self,
        period_rets: pd.Series,
        cum_ret: pd.Series,
        rf_annual: float = 3.0,
        trading_days: int = 252,
    ) -> Dict[str, float]:
        """4대 심층 리스크 메트릭 (연간화 변동성, 샤프 지수, 소르티노 지수, 칼마 지수) 및 VaR 계산.
        
        기존 api/backtest.py와 100% 호환되는 반환 필드 및 연산 정밀도 유지.
        """
        if period_rets.empty or cum_ret.empty:
            return {
                "return": 0.0,
                "mdd": 0.0,
                "volatility": 0.0,
                "sharpe": 0.0,
                "sortino": 0.0,
                "calmar": 0.0,
                "annualized_return": 0.0,
                "var_95": 0.0,
                "var_99": 0.0,
            }

        final_ret = float((cum_ret.iloc[-1] - 1.0) * 100.0)
        mdd = float(calculate_mdd(cum_ret))

        # 영업일 수 기반 연간화 기간 산출
        n_days = max(1, len(period_rets))
        years = max(n_days / float(trading_days), 0.08)  # 최소 약 1개월

        # 연간화 수익률 (CAGR)
        if (1.0 + final_ret / 100.0) > 0:
            ann_return = float(((1.0 + final_ret / 100.0) ** (1.0 / years) - 1.0) * 100.0)
        else:
            ann_return = float(final_ret / years)

        # 1. 연간화 변동성 (Annualized Volatility)
        clean_rets = period_rets.dropna()
        daily_std = float(clean_rets.std()) if len(clean_rets) > 1 else 0.0
        ann_vol = float(daily_std * np.sqrt(float(trading_days)) * 100.0)

        # 2. 샤프 지수 (Sharpe Ratio, 무위험 수익률 rf_annual 차감)
        excess_ret = ann_return - rf_annual
        if ann_vol > 0.001:
            sharpe = float(excess_ret / ann_vol)
        else:
            sharpe = 0.0

        # 3. 소르티노 지수 (Sortino Ratio, 하방 변동성 적용)
        downside_rets = clean_rets[clean_rets < 0]
        if len(downside_rets) > 1 and downside_rets.std() > 0:
            downside_vol = float(downside_rets.std() * np.sqrt(float(trading_days)) * 100.0)
            sortino = float(excess_ret / downside_vol) if downside_vol > 0.001 else 0.0
        else:
            sortino = float(sharpe * 1.5) if sharpe > 0 else 0.0

        # 4. 칼마 지수 (Calmar Ratio, 연수익률 / |MDD|)
        abs_mdd = abs(mdd)
        if abs_mdd > 0.001:
            calmar = float(ann_return / abs_mdd)
        else:
            calmar = 0.0

        # 5. Value at Risk (역사적 VaR 95%, 99% - 음수 백분율을 양수 손실률로 표현)
        if len(clean_rets) >= 10:
            var_95 = float(-np.percentile(clean_rets, 5) * 100.0)
            var_99 = float(-np.percentile(clean_rets, 1) * 100.0)
        else:
            var_95 = 0.0
            var_99 = 0.0

        return {
            "return": round(final_ret, 2),
            "mdd": round(mdd, 2),
            "volatility": round(ann_vol, 2),
            "sharpe": round(sharpe, 2),
            "sortino": round(sortino, 2),
            "calmar": round(calmar, 2),
            "annualized_return": round(ann_return, 2),
            "var_95": round(max(0.0, var_95), 2),
            "var_99": round(max(0.0, var_99), 2),
        }

    def calculate_correlation_matrix(self, prices_df: pd.DataFrame) -> pd.DataFrame:
        """종가 매트릭스로부터 일별 수익률 기반 피어슨 상관계수 행렬 산출"""
        if prices_df.empty or len(prices_df.columns) == 0:
            return pd.DataFrame()
        daily_returns = prices_df.pct_change().dropna()
        if daily_returns.empty:
            return pd.DataFrame(1.0, index=prices_df.columns, columns=prices_df.columns)
        corr = daily_returns.corr(method="pearson").round(4)
        return corr

    def calculate_portfolio_returns(
        self,
        weights: Dict[str, float],
        prices_df: pd.DataFrame,
    ) -> Tuple[pd.Series, pd.Series]:
        """자산별 목표 비중과 종가 매트릭스로부터 포트폴리오의 일별 일간 수익률 및 누적 가치 시계열 산출.
        
        Returns:
            (daily_returns, cumulative_returns)
        """
        if prices_df.empty or not weights:
            return pd.Series(dtype=float), pd.Series(dtype=float)

        # 사용 가능한 자산만 비중 정규화
        valid_assets = [t for t in weights.keys() if t in prices_df.columns]
        if not valid_assets:
            return pd.Series(dtype=float), pd.Series(dtype=float)

        raw_weights = {t: float(weights[t]) for t in valid_assets if float(weights[t]) > 0}
        total_w = sum(raw_weights.values())
        if total_w <= 0:
            return pd.Series(dtype=float), pd.Series(dtype=float)

        normalized_w = {t: w / total_w for t, w in raw_weights.items()}

        # 일별 자산별 수익률
        returns_df = prices_df[valid_assets].pct_change().dropna()
        if returns_df.empty:
            return pd.Series(dtype=float), pd.Series(dtype=float)

        # 가중 수익률 합산
        w_series = pd.Series(normalized_w)
        port_daily = (returns_df * w_series).sum(axis=1)

        # 누적 수익률 시계열 (기준점 1.0 시작)
        cum_ret = (1.0 + port_daily).cumprod()

        return port_daily, cum_ret


# 전역 싱글톤 인스턴스
quant_engine = UnifiedQuantEngine()
