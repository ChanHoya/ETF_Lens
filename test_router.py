import asyncio
from backend.api.router import get_holdings
from pydantic import BaseModel

class CompareRequest(BaseModel):
    etf_codes: list[str]
    skip_holdings: bool = False

async def run():
    req = CompareRequest(etf_codes=["069500", "453850"])
    # Need to simulate running in FastAPI router.
    # get_holdings expects CompareRequest from backend.api.router imports
    import backend.api.router as router
    req_router = router.CompareRequest(etf_codes=["069500", "453850"])
    res = await router.get_holdings(req_router)
    print("SUCCESS")
    print(res)

asyncio.run(run())
