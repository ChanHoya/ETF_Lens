import requests
import re
import json
import pandas as pd

url = "https://fred.stlouisfed.org/series/KORLORSGPNOSTSAM"
headers = {
    "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36",
    "Accept": "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
}

res = requests.get(url, headers=headers)
print("Status code:", res.status_code)

match = re.search(r'data:\s*(\{.*?"observations"\s*:.*?\})\s*,', res.text, re.DOTALL)
if match:
    data = json.loads(match.group(1))
    df = pd.DataFrame(data.get("observations", []))
    print(df.head())
else:
    print("Match not found, saving html preview")
    print(res.text[:1000])

from pykrx import stock

df_pe = stock.get_market_fundamental("20240101", "20240131", "005930")
if df_pe is not None and not df_pe.empty:
    print("pykrx works:")
    print(df_pe.head())
