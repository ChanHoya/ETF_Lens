# 브라질 시계열 테이블 생성 후 sync 실행·검증하는 스크래치 스크립트
import asyncio
import os
import sys

sys.path.insert(0, os.path.abspath(os.path.join(os.path.dirname(__file__), "..")))

from db.database import engine, AsyncSessionLocal
from db.models import Base, BrazilSeries
from core.brazil_fetcher import sync_brazil_series
from sqlalchemy import select, func


async def main():
    async with engine.begin() as conn:
        await conn.run_sync(Base.metadata.create_all)
    result = await sync_brazil_series()
    print("\n=== upsert counts ===")
    print(result)
    print("\n=== rows per series ===")
    async with AsyncSessionLocal() as db:
        for key in ["selic_target", "ipca_12m", "ipca_mom", "usd_brl", "brl_krw", "y5",
                    "focus_selic_eoy", "focus_ipca_eoy", "focus_usdbrl_eoy"]:
            cnt = (await db.execute(
                select(func.count()).where(BrazilSeries.series_key == key)
            )).scalar()
            last = (await db.execute(
                select(BrazilSeries.date, BrazilSeries.value)
                .where(BrazilSeries.series_key == key)
                .order_by(BrazilSeries.date.desc()).limit(1)
            )).first()
            print(f"  {key:18s} rows={cnt:5d}  last={last}")


if __name__ == "__main__":
    asyncio.run(main())
