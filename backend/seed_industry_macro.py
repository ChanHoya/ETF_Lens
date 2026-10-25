# 반도체 및 주요 산업 펀더멘털 시계열 데이터를 DB(industry_macro_series)에 초기 적재 및 동기화하는 스크립트
import asyncio
from datetime import datetime
from sqlalchemy import select
from db.database import AsyncSessionLocal
from db.models import IndustryMacroSeries
from core.macro_historical_data import HISTORICAL_MACRO_SERIES


async def seed_industry_macro_series():
    """HISTORICAL_MACRO_SERIES의 데이터를 DB industry_macro_series에 시드 적재."""
    async with AsyncSessionLocal() as db:
        stmt = select(IndustryMacroSeries.date).where(IndustryMacroSeries.industry == "semiconductor")
        result = await db.execute(stmt)
        existing_dates = set(result.scalars().all())

        new_count = 0
        updated_count = 0

        for row in HISTORICAL_MACRO_SERIES:
            d = row["date"]
            if d in existing_dates:
                # 필요 시 업데이트
                update_stmt = select(IndustryMacroSeries).where(
                    IndustryMacroSeries.industry == "semiconductor",
                    IndustryMacroSeries.date == d,
                )
                res = await db.execute(update_stmt)
                obj = res.scalar_one_or_none()
                if obj:
                    obj.export_amt = row.get("export_amt")
                    obj.unit_price = row.get("unit_price")
                    obj.volume = row.get("volume")
                    obj.cap_util = row.get("cap_util")
                    obj.inventory = row.get("inventory")
                    obj.is_confirmed = True
                    obj.updated_at = datetime.utcnow()
                    updated_count += 1
            else:
                new_obj = IndustryMacroSeries(
                    industry="semiconductor",
                    date=d,
                    export_amt=row.get("export_amt"),
                    unit_price=row.get("unit_price"),
                    volume=row.get("volume"),
                    cap_util=row.get("cap_util"),
                    inventory=row.get("inventory"),
                    is_confirmed=True,
                )
                db.add(new_obj)
                new_count += 1

        await db.commit()
        print(f"Seeding completed: {new_count} new records, {updated_count} updated records.")


if __name__ == "__main__":
    asyncio.run(seed_industry_macro_series())
