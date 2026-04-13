import asyncio
from db.database import AsyncSessionLocal
from api.my_assets import get_my_portfolio
from fastapi import Request
import logging

logging.basicConfig(level=logging.WARNING)

async def test():
    req = Request({"type": "http"})
    async with AsyncSessionLocal() as db:
        try:
            res = await get_my_portfolio(req, db)
            print("DONE:", res["kis_raw"]["summary"])
        except Exception as e:
            print("ERROR", e)

asyncio.run(test())
