import asyncio
import json
from db.database import engine
from sqlalchemy.orm import sessionmaker
from sqlalchemy.ext.asyncio import AsyncSession
from db.models import ETFMaster, ETFEvaluation

AsyncSessionLocal = sessionmaker(engine, class_=AsyncSession, expire_on_commit=False)


async def seed():
    async with AsyncSessionLocal() as db:
        dummy_etfs = [
            {
                "code": "069500",
                "name": "KODEX 200",
                "issuer": "삼성자산운용",
                "aum": "70,000억",
                "fee": 0.15,
                "basic": {"순자산총액": 7000000000000, "펀드보수": "0.15%"},
            },
            {
                "code": "379800",
                "name": "KODEX 미국S&P500TR",
                "issuer": "삼성자산운용",
                "aum": "15,000억",
                "fee": 0.05,
                "basic": {"순자산총액": 1500000000000, "펀드보수": "0.05%"},
            },
            {
                "code": "411060",
                "name": "TIGER 미국배당+7%프리미엄다우존스",
                "issuer": "미래에셋",
                "aum": "8,000억",
                "fee": 0.39,
                "basic": {"순자산총액": 800000000000, "펀드보수": "0.39%"},
            },
            {
                "code": "133690",
                "name": "TIGER 미국나스닥100",
                "issuer": "미래에셋",
                "aum": "30,000억",
                "fee": 0.07,
                "basic": {"순자산총액": 3000000000000, "펀드보수": "0.07%"},
            },
            {
                "code": "252670",
                "name": "KODEX 200선물인버스2X",
                "issuer": "삼성자산운용",
                "aum": "12,000억",
                "fee": 0.64,
                "basic": {"순자산총액": 1200000000000, "펀드보수": "0.64%"},
            },
        ]

        for e in dummy_etfs:
            master = ETFMaster(
                code=e["code"],
                name=e["name"],
                issuer=e["issuer"],
                nav=10000,
                price=10000,
                base_fee=e["fee"],
                tot_fee=e["fee"],
                aum=e["aum"],
                basic_info_json=json.dumps(e["basic"]),
            )
            db.add(master)

        await db.commit()
        print("Inserted Dummy ETFs")


if __name__ == "__main__":
    asyncio.run(seed())
