import asyncio
import json
import logging
from sqlalchemy.ext.asyncio import AsyncSession
from backend.db.database import get_db, engine
from backend.api.router import compare_etfs
from pydantic import BaseModel
from typing import List, Optional

logging.basicConfig(level=logging.INFO)

class CompareRequest(BaseModel):
    etf_codes: List[str]
    skip_holdings: bool = True
    skip_chart: bool = False

async def main():
    async with AsyncSession(engine) as session:
        req = CompareRequest(etf_codes=["RKLB"])
        response = await compare_etfs(req, session)
        
        # Check visual_data line_chart
        line_chart = response.get("visual_data", {}).get("line_chart", [])
        print(f"Total days: {len(line_chart)}")
        if line_chart:
            print("First 3 records:")
            for item in line_chart[:3]:
                print(item)
            print("\nLast 3 records:")
            for item in line_chart[-3:]:
                print(item)

if __name__ == "__main__":
    asyncio.run(main())
