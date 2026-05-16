import asyncio
import pandas as pd
import requests
from datetime import datetime, timedelta, timezone as _tz
import time

async def test_fetch():
    kr_tickers = {
        "K-반도체": "091160.KS",
        "KOSPI 200": "069500.KS",
        "US-Semi": "SMH"
    }
    
    _kst = _tz(timedelta(hours=9))
    _kst_now = datetime.now(_kst)
    
    end_date = (_kst_now + timedelta(days=1)).date()
    start_date = _kst_now.date() - timedelta(days=365)
    start_str = start_date.strftime("%Y-%m-%d")
    end_str = end_date.strftime("%Y-%m-%d")

    def _fetch_one_robust(t_name: str, t_code: str) -> pd.Series:
        series = pd.Series(dtype=float)
        try:
            print(f"Fetching {t_code} via v8...")
            url = f"https://query1.finance.yahoo.com/v8/finance/chart/{t_code}?interval=1d&range=1y"
            resp = requests.get(url, headers={"User-Agent": "Mozilla/5.0"}, timeout=10)
            if resp.status_code == 200:
                rb = resp.json().get("chart", {}).get("result", [])
                if rb:
                    res = rb[0]
                    timestamps = res.get("timestamp", [])
                    closes = res.get("indicators", {}).get("quote", [{}])[0].get("close", [])
                    if timestamps and closes:
                        valid_data = [(datetime.fromtimestamp(ts), c) for ts, c in zip(timestamps, closes) if c is not None]
                        if valid_data:
                            idx, vals = zip(*valid_data)
                            series = pd.Series(vals, index=idx)
            else:
                print(f"V8 failed with status {resp.status_code}")
        except Exception as e:
            print(f"Error: {e}")
        return series

    results = {}
    for t_name, t_code in kr_tickers.items():
        results[t_name] = await asyncio.to_thread(_fetch_one_robust, t_name, t_code)
    
    for name, s in results.items():
        print(f"{name}: {len(s)} pts")
        if not s.empty:
            print(f"Last price: {s.iloc[-1]}")

if __name__ == "__main__":
    asyncio.run(test_fetch())
