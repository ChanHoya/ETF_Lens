import yfinance as yf
import pandas as pd
import numpy as np
from typing import Dict, Any


class CoveredCallAnalyzer:
    def __init__(self):
        # Default fallback symbols or mapping
        # Default fallback symbols or mapping
        self.benchmark_map = {
            "S&P500": "^SP500TR",  # Yahoo Finance S&P 500 Total Return TR
            "Nasdaq100": "QQQ",  # Best accessible proxy for Nasdaq 100 TR
            "KOSPI200": "069500.KS",  # KODEX 200 (Adj Close includes dividends -> KOSPI 200 TR proxy)
            "Dow Jones U.S. Dividend 100": "SCHD",  # Proxy for US Dividend 100 TR
        }

    async def fetch_historical_tr(
        self, symbol: str, period: str = "3y"
    ) -> pd.DataFrame:
        """
        Fetches historical data using yfinance, focusing on 'Adj Close'
        which automatically adjusts for dividends and stock splits,
        giving us a Total Return (TR) time series.
        """
        try:
            # Map symbol if it's a known benchmark
            mapped_symbol = self.benchmark_map.get(symbol, symbol)

            # If it's a 6-digit Korean ticker without .KS, append it
            if mapped_symbol.isdigit() and len(mapped_symbol) == 6:
                mapped_symbol += ".KS"

            # Using loop.run_in_executor or direct yfinance call
            ticker = yf.Ticker(mapped_symbol)
            df = ticker.history(period=period, auto_adjust=False)
            if df.empty:
                # auto_adjust=False provides both 'Close' and 'Adj Close'
                # fallback to just history if missing
                df = ticker.history(period=period, auto_adjust=True)
                if "Close" in df.columns:
                    df["Adj Close"] = df["Close"]

            if "Adj Close" not in df.columns and "Close" in df.columns:
                df["Adj Close"] = df["Close"]

            return df[["Close", "Adj Close"]].copy()
        except Exception as e:
            print(f"Error fetching data for {symbol}: {e}")
            return pd.DataFrame()

    def calculate_capture_ratios(
        self, fund_prices: pd.Series, bench_prices: pd.Series
    ) -> Dict[str, float]:
        """
        Calculates Upside and Downside Capture Ratios using Monthly or Daily Returns.
        Assuming daily returns for precision here.
        """
        # Align dates
        df = pd.concat(
            [fund_prices.rename("Fund"), bench_prices.rename("Bench")], axis=1
        ).dropna()
        if df.empty or len(df) < 2:
            return {"upside_capture": 0.0, "downside_capture": 0.0}

        returns = df.pct_change().dropna()

        # Upside Capture
        up_market = returns[returns["Bench"] > 0]
        if not up_market.empty and up_market["Bench"].sum() != 0:
            upside_capture = (
                up_market["Fund"].mean() / up_market["Bench"].mean()
            ) * 100
        else:
            upside_capture = 0.0

        # Downside Capture
        down_market = returns[returns["Bench"] <= 0]
        if not down_market.empty and down_market["Bench"].sum() != 0:
            downside_capture = (
                down_market["Fund"].mean() / down_market["Bench"].mean()
            ) * 100
        else:
            downside_capture = 0.0

        return {
            "upside_capture": round(upside_capture, 2),
            "downside_capture": round(downside_capture, 2),
        }

    def calculate_tr_difference(
        self, fund_prices: pd.Series, bench_prices: pd.Series
    ) -> dict:
        """
        Calculates 1-year TR for both, and the difference.
        """
        df = pd.concat(
            [fund_prices.rename("Fund"), bench_prices.rename("Bench")], axis=1
        ).dropna()
        if len(df) < 5:
            return {"fund_tr": 0.0, "bench_tr": 0.0, "diff": 0.0}

        # 1-year return approx 252 trading days
        lb = min(252, len(df) - 1)

        fund_ret = (df["Fund"].iloc[-1] / df["Fund"].iloc[-lb] - 1) * 100
        bench_ret = (df["Bench"].iloc[-1] / df["Bench"].iloc[-lb] - 1) * 100
        diff = fund_ret - bench_ret

        return {
            "fund_tr_1y": round(fund_ret, 2),
            "bench_tr_1y": round(bench_ret, 2),
            "tr_difference_1y": round(diff, 2),
        }
