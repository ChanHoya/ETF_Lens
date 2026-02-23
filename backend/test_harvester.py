import asyncio
from agents.harvester.harvester import ETFHarvester

async def main():
    h = ETFHarvester()
    await h.initialize()
    data = await h.fetch_naver_etf_data("453850")
    print(data["basic_info"])
    await h.close()

asyncio.run(main())
