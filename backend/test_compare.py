import asyncio
import sys

sys.path.append(".")
from pydantic import BaseModel
from api.router import get_chart_data, CompareRequest


async def main():
    from db.database import AsyncSessionLocal
    import contextlib

    @contextlib.asynccontextmanager
    async def get_test_db():
        async with AsyncSessionLocal() as session:
            yield session

    async with get_test_db() as db:
        req = CompareRequest(etf_codes=["069500", "229200"])
        try:
            res = await get_chart_data(req, db)
            import json

            try:
                json.dumps(res)
                print("JSON serialization OK")
            except Exception as e:
                print("JSON serialization failed:", e)
        except Exception as e:
            import traceback

            traceback.print_exc()


if __name__ == "__main__":
    asyncio.run(main())
