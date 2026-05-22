import asyncio
import sys
import os

# Add parent directory to path so we can import backend modules properly
sys.path.append(os.path.dirname(os.path.abspath(__file__)))

from db.database import AsyncSessionLocal
from core.stress_tester import run_stress_test


async def test():
    # KODEX 200 (069500) and TIGER 미국S&P500 (453850) portfolio weightings
    portfolio = [
        {"code": "069500", "weight": 0.4},
        {"code": "453850", "weight": 0.6}
    ]
    async with AsyncSessionLocal() as db:
        try:
            res = await run_stress_test(db, portfolio)
            import pprint
            pprint.pprint(res)
        except Exception as e:
            print("ERROR", e)


if __name__ == "__main__":
    asyncio.run(test())
