import asyncio
from backend.db.database import AsyncSessionLocal
from backend.api.router import get_space_holdings
import os
import json

async def main():
    async with AsyncSessionLocal() as session:
        # Mock FastAPI Depends
        result = await get_space_holdings(db=session)
        print("Keys:", result["keys"])
        print("\nFirst row of table_data:")
        print(json.dumps(result["table_data"][0], indent=2, ensure_ascii=False))
        print("\nAll constituents with price and change_pct:")
        for r in result["table_data"]:
            print(f"- {r['constituent']}: Price={r.get('price')}, Change={r.get('change_pct')}%")

if __name__ == "__main__":
    asyncio.run(main())
