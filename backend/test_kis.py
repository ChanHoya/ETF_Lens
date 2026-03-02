import asyncio
import os
import sys

# Add backend directory to sys.path to resolve 'db' module
sys.path.append(os.path.dirname(os.path.abspath(__file__)))

from db.database import AsyncSessionLocal, engine
from db.models import Base
from api.kis_integration import fetch_and_store_eps_data


async def run_test():
    # Initialize DB (if not exists)
    async with engine.begin() as conn:
        await conn.run_sync(Base.metadata.create_all)

    async with AsyncSessionLocal() as db:
        print("Fetching and storing EPS data for Samsung, Hynix, Hyundai...")
        await fetch_and_store_eps_data(db, ["005930", "000660", "005380"])
        print("Success.")


if __name__ == "__main__":
    asyncio.run(run_test())
