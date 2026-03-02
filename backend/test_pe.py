import asyncio
from api.exit_signal import get_pe_detail

async def main():
    res = await get_pe_detail("005930")
    print(res[-1])

asyncio.run(main())
