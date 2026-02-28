import asyncio
from core.covered_call_analyzer import CoveredCallAnalyzer
async def main():
    analyzer = CoveredCallAnalyzer()
    df = await analyzer.fetch_historical_tr("289480.KS", "1y")
    print(df.tail())
    print("Return:", (df['Adj Close'].iloc[-1]/df['Adj Close'].iloc[0]-1)*100)
asyncio.run(main())
