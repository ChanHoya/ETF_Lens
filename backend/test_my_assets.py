import asyncio
from db.database import AsyncSessionLocal
from fastapi import Request
from api.my_assets import get_my_portfolio

class DummyRequest:
    pass

async def test():
    async with AsyncSessionLocal() as db:
        res = await get_my_portfolio(request=DummyRequest(), db=db)
        if isinstance(res, dict) and "kis_raw" in res:
            print("Total accounts loaded:", len(res["kis_raw"]["accounts"]))
            for acc in res["kis_raw"]["accounts"]:
                print(acc["account_no"])
        else:
            print("Error:", res)

asyncio.run(test())
