import asyncio
from core.covered_call_analyzer import CoveredCallAnalyzer
import pandas as pd

async def main():
    analyzer = CoveredCallAnalyzer()
    bench = await analyzer.fetch_historical_tr("SCHD", "1y")
    fund = await analyzer.fetch_historical_tr("458730.KS", "1y")
    
    captures = analyzer.calculate_capture_ratios(fund["Adj Close"], bench["Adj Close"])
    print("Captures:", captures)
    tr = analyzer.calculate_tr_difference(fund["Adj Close"], bench["Adj Close"])
    print("TR:", tr)

asyncio.run(main())
