import asyncio
from core.scheduler import sync_etf_batch
from db.database import engine
from db.models import Base

async def main():
    async with engine.begin() as conn:
        await conn.run_sync(Base.metadata.create_all)
    await sync_etf_batch()

if __name__ == "__main__":
    asyncio.run(main())
