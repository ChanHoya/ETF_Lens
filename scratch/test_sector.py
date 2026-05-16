import asyncio
import pandas as pd
import yfinance as yf
from datetime import datetime, timedelta, timezone as _tz
import time

async def test_fetch():
    kr_tickers = {
        "K-반도체": "091160.KS",
        "KOSPI 200": "069500.KS",
    }
    
    _kst = _tz(timedelta(hours=9))
    _kst_now = datetime.now(_kst)
    
    end_date = (_kst_now + timedelta(days=1)).date()
    start_date = _kst_now.date() - timedelta(days=365)
    start_str = start_date.strftime("%Y-%m-%d")
    end_str = end_date.strftime("%Y-%m-%d")

    def _fetch_one(t_code: str) -> pd.Series:
        series = pd.Series(dtype=float)
        try:
            print(f"Downloading {t_code}...")
            df = yf.download(t_code, start=start_str, end=end_str, progress=False)
            if not df.empty:
                if isinstance(df.columns, pd.MultiIndex):
                    lvl0 = df.columns.get_level_values(0).unique().tolist()
                    if "Close" in lvl0:
                        sub = df["Close"]
                        series = sub.iloc[:, 0] if isinstance(sub, pd.DataFrame) else sub
                    else:
                        series = df.iloc[:, 0]
                else:
                    series = df["Close"] if "Close" in df.columns else df.iloc[:, 0]
                series = series.dropna()
        except Exception as e:
            print(f"Error: {e}")
        return series

    results = {}
    for t_name, t_code in kr_tickers.items():
        results[t_name] = await asyncio.to_thread(_fetch_one, t_code)
    
    for name, s in results.items():
        print(f"{name}: {len(s)} pts")

if __name__ == "__main__":
    asyncio.run(test_fetch())
