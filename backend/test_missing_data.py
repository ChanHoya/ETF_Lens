import asyncio
import pandas as pd
from api.covered_call import CoveredCallAnalyzer

async def main():
    analyzer = CoveredCallAnalyzer()
    tickers = ["475720.KS", "498400.KS", "289480.KS", "290080.KS"] # RISE 200위클리커버드콜, KODEX 200타겟위클리커버드콜, TIGER 200커버드콜, RISE 200고배당커버드콜ATM
    for ticker in tickers:
        df = await analyzer.fetch_historical_tr(ticker, "6mo")
        print(f"--- {ticker} ---")
        if df.empty:
            print("EMPTY!")
        else:
            print(f"Rows: {len(df)}")
            print(df.head(2))

if __name__ == "__main__":
    asyncio.run(main())
