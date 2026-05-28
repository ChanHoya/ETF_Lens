import asyncio
import requests
import json
import urllib3

urllib3.disable_warnings(urllib3.exceptions.InsecureRequestWarning)

async def _fetch_stock_quote(ticker: str) -> dict:
    def _sync_fetch():
        try:
            url = f"https://query1.finance.yahoo.com/v8/finance/chart/{ticker}?interval=1d&range=5d"
            headers = {"User-Agent": "Mozilla/5.0"}
            r = requests.get(url, headers=headers, timeout=5, verify=False)
            if r.status_code != 200:
                print(f"Error fetching {ticker}: status code {r.status_code}")
                return {"price": None, "change_pct": None}
            
            data = r.json()
            result = data.get("chart", {}).get("result", [])
            if not result:
                return {"price": None, "change_pct": None}
            
            meta = result[0].get("meta", {})
            price = meta.get("regularMarketPrice")
            prev_close = meta.get("chartPreviousClose")
            
            # If regularMarketPrice or chartPreviousClose is missing, fall back to timestamp and close values
            if price is None or prev_close is None:
                indicators = result[0].get("indicators", {}).get("quote", [{}])[0]
                closes = [c for c in indicators.get("close", []) if c is not None]
                if len(closes) >= 2:
                    price = closes[-1]
                    prev_close = closes[-2]
                elif len(closes) == 1:
                    price = closes[0]
            
            if price is not None and prev_close is not None and prev_close != 0:
                change_pct = ((price - prev_close) / prev_close) * 100
                return {"price": round(price, 2), "change_pct": round(change_pct, 2)}
            elif price is not None:
                return {"price": round(price, 2), "change_pct": 0.0}
            
            return {"price": None, "change_pct": None}
        except Exception as e:
            print(f"Failed to fetch {ticker}: {e}")
            return {"price": None, "change_pct": None}

    return await asyncio.to_thread(_sync_fetch)


async def main():
    tickers = ["RKLB", "ASTS", "SATS", "PL", "LUNR", "MDALF", "MDA.TO"]
    tasks = [_fetch_stock_quote(t) for t in tickers]
    results = await asyncio.gather(*tasks)
    for t, res in zip(tickers, results):
        print(f"{t}: {res}")

if __name__ == "__main__":
    asyncio.run(main())
