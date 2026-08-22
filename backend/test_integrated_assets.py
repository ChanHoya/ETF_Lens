import asyncio
import pytest
import httpx
from sqlalchemy.ext.asyncio import create_async_engine, AsyncSession
from sqlalchemy.orm import sessionmaker
from db.database import Base, get_db
from db.models import ManualAsset, ManualAccountCash, KisAccountMapping
from api.integrated_assets import (
    ManualAssetCreate,
    ManualCashCreate,
    create_manual_asset,
    list_manual_assets,
    upsert_manual_cash,
    list_manual_cash,
    get_integrated_assets,
    get_live_usd_krw_rate,
)
from unittest.mock import AsyncMock, patch

async def run_tests():
    # In-memory SQLite for testing
    engine = create_async_engine("sqlite+aiosqlite:///:memory:", echo=False)
    async_session = sessionmaker(engine, class_=AsyncSession, expire_on_commit=False)

    async with engine.begin() as conn:
        await conn.run_sync(Base.metadata.create_all)

    async with async_session() as db:
        print("1. Testing FX rate fetch...")
        rate = await get_live_usd_krw_rate()
        print(f"USD/KRW rate: {rate}")
        assert rate > 1000.0

        print("2. Testing ManualAsset Creation...")
        ma = await create_manual_asset(
            ManualAssetCreate(
                category="일반주식계좌",
                account_name="미래에셋 일반",
                broker="미래에셋",
                asset_name="KT",
                ticker="030200",
                currency="KRW",
                purchase_price=35000,
                current_price=41000,
                quantity=100,
                sector="통신",
            ),
            db=db,
        )
        print(f"Created ManualAsset: id={ma.id}, name={ma.asset_name}, cur_price={ma.current_price}")
        assert ma.id is not None
        assert ma.asset_name == "KT"

        print("3. Testing ManualAccountCash Upsert...")
        cash = await upsert_manual_cash(
            ManualCashCreate(
                category="기타저축계좌",
                account_name="케이뱅크 플러스박스",
                broker="케이뱅크",
                cash_krw=10000000,
                cash_usd=0,
            ),
            db=db,
        )
        print(f"Created ManualCash: id={cash.id}, cash_krw={cash.cash_krw}")
        assert cash.cash_krw == 10000000

        print("4. Testing Integrated Assets endpoint mock...")
        mock_req = AsyncMock()
        with patch("api.my_assets.get_my_portfolio", new_callable=AsyncMock) as mock_portfolio:
            mock_portfolio.return_value = {
                "status": "success",
                "kis_raw": {
                    "summary": {
                        "total_eval_amount": 20000000,
                        "total_profit_loss": 2000000,
                        "cash_balance": 1000000,
                        "total_asset": 21000000,
                    },
                    "holdings": [
                        {
                            "code": "069500",
                            "name": "KODEX 200",
                            "qty": 500,
                            "avg_price": 36000,
                            "current_price": 40000,
                            "eval_amount": 20000000,
                            "profit_loss": 2000000,
                            "return_rate": 11.11,
                            "account_no": "81060777-01",
                        }
                    ],
                    "accounts": [
                        {
                            "account_no": "81060777-01",
                            "account_name": "한투 ISA",
                            "total_asset": 21000000,
                            "cash_balance": 1000000,
                        }
                    ]
                }
            }

            res = await get_integrated_assets(request=mock_req, db=db)
            print("Integrated Assets result summary:", res["summary"])
            print("Account boards count:", len(res["account_boards"]))
            for board in res["account_boards"]:
                print(f" - {board['category_name']}: total_asset={board['total_asset']}, holdings_count={board['holdings_count']}")

            assert res["status"] == "success"
            assert res["summary"]["total_net_worth"] > 0
            assert len(res["account_boards"]) == 5
            print("✅ All backend integrated asset tests passed successfully!")

if __name__ == "__main__":
    asyncio.run(run_tests())
