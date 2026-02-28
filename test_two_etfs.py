import asyncio
from backend.core.covered_call_analyzer import CoveredCallAnalyzer

async def main():
    analyzer = CoveredCallAnalyzer()
    
    symbols = ["475720", "0104N0"]
    for sym in symbols:
        print(f"Testing {sym}")
        df, is_pr = await analyzer.fetch_historical_tr(sym, "1y")
        print(f"Length: {len(df)}, is_pr: {is_pr}")
        if not df.empty:
            print(df.head(2))
            print(df.tail(2))
            
if __name__ == "__main__":
    asyncio.run(main())
