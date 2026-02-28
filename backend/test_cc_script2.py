import asyncio
from core.covered_call_analyzer import CoveredCallAnalyzer
async def main():
    analyzer = CoveredCallAnalyzer()
    df = await analyzer.fetch_historical_tr("069500.KS", "1y")
    print(df.tail())
asyncio.run(main())
