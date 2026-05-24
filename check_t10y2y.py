import asyncio
from datetime import datetime, timedelta
import pandas as pd
import requests

def _fetch_fred_series(series_id, days=400):
    url = f"https://api.stlouisfed.org/fred/series/observations?series_id={series_id}&api_key=e6ee6d2745cfc9b139db080e7dd2f97c&file_type=json"
    res = requests.get(url)
    data = res.json()
    obs = data.get('observations', [])
    cutoff = datetime.now() - timedelta(days=days)
    cutoff_str = cutoff.strftime('%Y-%m-%d')
    result = {}
    for ob in obs:
        if ob['date'] >= cutoff_str and ob['value'] != '.':
            result[ob['date']] = float(ob['value'])
    return result

data = _fetch_fred_series("T10Y2Y", 400)
sorted_dates = sorted(data.keys())
was_inverted = False
for d in sorted_dates:
    cutoff_180 = datetime.now() - timedelta(days=180)
    if pd.to_datetime(d) >= pd.Timestamp(cutoff_180.date()):
        if data[d] < -0.1:
            was_inverted = True
            break
print(f"Current Value: {data[sorted_dates[-1]] if data else None}")
print(f"Was Inverted in last 180 days: {was_inverted}")
print("Min in last 180 days:", min([data[d] for d in sorted_dates if pd.to_datetime(d) >= pd.Timestamp(cutoff_180.date())]) if data else None)
