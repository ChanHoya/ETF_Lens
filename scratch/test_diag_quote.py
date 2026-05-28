import requests
import json
import urllib3
from datetime import datetime

urllib3.disable_warnings(urllib3.exceptions.InsecureRequestWarning)

def test_ticker(ticker):
    url = f"https://query1.finance.yahoo.com/v8/finance/chart/{ticker}?interval=1d&range=5d"
    headers = {"User-Agent": "Mozilla/5.0"}
    r = requests.get(url, headers=headers, verify=False)
    data = r.json()
    result = data.get("chart", {}).get("result", [])
    if not result:
        print(f"No result for {ticker}")
        return
    
    meta = result[0].get("meta", {})
    print(f"\n--- {ticker} ---")
    print("regularMarketPrice:", meta.get("regularMarketPrice"))
    print("chartPreviousClose:", meta.get("chartPreviousClose"))
    print("previousClose:", meta.get("previousClose"))
    
    timestamp = result[0].get("timestamp", [])
    indicators = result[0].get("indicators", {}).get("quote", [{}])[0]
    closes = indicators.get("close", [])
    
    for t, c in zip(timestamp, closes):
        dt = datetime.fromtimestamp(t)
        print(f"  Date: {dt.strftime('%Y-%m-%d %H:%M:%S')}, Close: {c}")

if __name__ == "__main__":
    test_ticker("RKLB")
    test_ticker("ASTS")
