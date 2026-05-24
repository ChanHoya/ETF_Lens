import asyncio
import sys
import os

# Add backend directory (parent of scratch) to path
backend_dir = os.path.abspath(os.path.join(os.path.dirname(__file__), ".."))
sys.path.append(backend_dir)

from db.database import AsyncSessionLocal
from api.router import get_space_chart_data

async def main():
    async with AsyncSessionLocal() as db:
        res = await get_space_chart_data(etf="KODEX 미국우주항공", db=db)
        print("Keys returned from API:", res.get("keys"))
        chart_data = res.get("line_chart_data", [])
        print("Number of data points:", len(chart_data))
        if chart_data:
            print("First data point:", chart_data[0])
            print("Last data point:", chart_data[-1])

if __name__ == "__main__":
    asyncio.run(main())
