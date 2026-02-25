import asyncio
from backend.api.router import get_chart_data
from backend.api.models import CompareRequest

async def main():
    req = CompareRequest(etf_codes=["069500", "305080"], skip_holdings=True, skip_chart=False)
    res = await get_chart_data(req)
    print("line_chart_data len:", len(res.get("line_chart_data", [])))
    print("etf_keys:", res.get("etf_keys", []))

asyncio.run(main())
