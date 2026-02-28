import yfinance as yf
import pandas as pd
from typing import Dict, Tuple


class CoveredCallAnalyzer:
    def __init__(self):
        # Default fallback symbols or mapping
        # Default fallback symbols or mapping
        self.benchmark_map = {
            "S&P500": "^SP500TR",  # Yahoo Finance S&P 500 Total Return TR
            "Nasdaq100": "QQQ",  # Best accessible proxy for Nasdaq 100 TR
            "KOSPI200": "^KS200",  # KOSPI 200 Index
            "Dow Jones U.S. Dividend 100": "SCHD",  # Proxy for US Dividend 100 TR
        }

    async def fetch_historical_tr(
        self, symbol: str, period: str = "3y"
    ) -> Tuple[pd.DataFrame, bool]:
        """
        Fetches historical data using yfinance, focusing on 'Adj Close'.
        If purely missing (e.g. new Korean ETF), fallbacks to KIS API which returns PR.
        Returns: (DataFrame, is_pr boolean flag)
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

            # Remove timezone so dates align perfectly across different countries
            if df.index.tz is not None:
                df.index = df.index.tz_localize(None)

            if not df.empty:
                return df[["Close", "Adj Close"]].copy(), False

            # --- KIS Fallback for completely empty sets (likely missing YF coverage) ---
            from .kis_client import fetch_kis_domestic_daily_price

            kis_data = await fetch_kis_domestic_daily_price(mapped_symbol, period)

            if kis_data and len(kis_data) > 0:
                # KIS data returns sorted by date descending (latest first). We must reverse it.
                # Format: [{'stck_bsop_date': '20250828', 'stck_clpr': '10000', ...}]
                records = []
                for row in reversed(kis_data):
                    dt_str = row.get("stck_bsop_date")
                    if dt_str:
                        dt = pd.to_datetime(dt_str, format="%Y%m%d")
                        price = float(row.get("stck_clpr", 0))
                        records.append({"Date": dt, "Close": price, "Adj Close": price})

                if records:
                    kdf = pd.DataFrame(records).set_index("Date")
                    return kdf, True  # True means it's PR data

            return pd.DataFrame(), False
        except Exception as e:
            print(f"Error fetching data for {symbol}: {e}")
            return pd.DataFrame(), False

    def calculate_capture_ratios(
        self, fund_prices: pd.Series, bench_prices: pd.Series
    ) -> Dict[str, float]:
        """
        Calculates Upside and Downside Capture Ratios using Monthly or Daily Returns.
        Assuming daily returns for precision here.
        """
        # Align dates and remove missing due to timezone/holiday differences
        df = (
            pd.concat(
                [fund_prices.rename("Fund"), bench_prices.rename("Bench")], axis=1
            )
            .ffill()
            .bfill()
        )
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
        Calculates TR across the entire provided timeseries, and the difference.
        """
        df = (
            pd.concat(
                [fund_prices.rename("Fund"), bench_prices.rename("Bench")], axis=1
            )
            .ffill()
            .bfill()
        )
        if len(df) < 2:
            return {"fund_tr": 0.0, "bench_tr": 0.0, "tr_difference": 0.0}

        fund_ret = (df["Fund"].iloc[-1] / df["Fund"].iloc[0] - 1) * 100
        bench_ret = (df["Bench"].iloc[-1] / df["Bench"].iloc[0] - 1) * 100
        diff = fund_ret - bench_ret

        return {
            "fund_tr": round(fund_ret, 2),
            "bench_tr": round(bench_ret, 2),
            "tr_difference": round(diff, 2),
        }
