import asyncio
from backend.api.backtest import run_backtest, BacktestRequest, HoldingItem

req = BacktestRequest(holdings=[
    HoldingItem(code="069500", amount=1000000, name="KODEX 200", category="한국"),
    HoldingItem(code="379800", amount=500000, name="KODEX 미국S&P500", category="S&P 500")
])

async def main():
    res = await run_backtest(req)
    print("Keys in results['1Y']:", res["results"]["1Y"].keys() if "1Y" in res["results"] else "None")

asyncio.run(main())
