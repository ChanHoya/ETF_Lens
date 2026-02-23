import asyncio
from backend.agents.harvester.harvester import ETFHarvester

async def run():
    h = ETFHarvester()
    res = await h.fetch_etf_holdings("453850")
    print(res)

asyncio.run(run())
