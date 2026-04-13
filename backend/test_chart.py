import asyncio
from db.database import AsyncSessionLocal
from api.router import get_chart_data
from pydantic import BaseModel

class CompareRequest(BaseModel):
    etf_codes: list[str]
    period: str = "3y"
    
async def test():
    async with AsyncSessionLocal() as db:
        req = CompareRequest(etf_codes=["476550", "329200"])
        res = await get_chart_data(req, db)
        data = res["line_chart_data"]
        # Print last 5 days
        for d in data[-5:]:
            print(d)

asyncio.run(test())
