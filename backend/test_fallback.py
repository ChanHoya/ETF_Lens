import asyncio
from agents.harvester.harvester import ETFHarvester

async def main():
    h = ETFHarvester()
    await h.initialize()
    data = await h.fetch_etf_holdings("360750")
    print(data)

asyncio.run(main())
