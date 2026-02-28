import asyncio
from db.database import engine
from sqlalchemy.orm import sessionmaker
from sqlalchemy.ext.asyncio import AsyncSession
from core.etf_evaluator import run_etf_evaluation

AsyncSessionLocal = sessionmaker(engine, class_=AsyncSession, expire_on_commit=False)


async def main():
    async with AsyncSessionLocal() as session:
        evaluated_count = await run_etf_evaluation(session)
        print(f"Successfully evaluated and scored {evaluated_count} ETFs.")


if __name__ == "__main__":
    asyncio.run(main())
