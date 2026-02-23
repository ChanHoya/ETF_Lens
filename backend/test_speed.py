import asyncio
import time
from agents.harvester.harvester import ETFHarvester

async def main():
    h = ETFHarvester()
    await h.initialize()
    
    t0 = time.time()
    await h.fetch_etf_holdings("453850")
    t1 = time.time()
    print("Holdings took:", t1 - t0)
    
    import FinanceDataReader as fdr
    from datetime import datetime, timedelta
    start_str = (datetime.now() - timedelta(days=3650)).strftime("%Y-%m-%d")
    t2 = time.time()
    await asyncio.to_thread(fdr.DataReader, "453850", start_str)
    t3 = time.time()
    print("FDR took:", t3 - t2)

asyncio.run(main())
