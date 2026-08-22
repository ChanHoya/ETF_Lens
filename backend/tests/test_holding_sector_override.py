# 보유 종목 섹터 오버라이드 PATCH 엔드포인트와 통합자산 조회 반영을 검증하는 테스트
import asyncio
from unittest.mock import AsyncMock, patch

import pytest
from fastapi import HTTPException
from sqlalchemy.ext.asyncio import AsyncSession, create_async_engine
from sqlalchemy.orm import sessionmaker

from api.integrated_assets import (
    SectorUpdatePayload,
    get_integrated_assets,
    update_holding_sector,
)
from db.database import Base
from db.models import HoldingSectorOverride, ManualAsset


KIS_PORTFOLIO_MOCK = {
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
        ],
    },
}


@pytest.fixture
def db_session():
    """테스트마다 격리된 인메모리 SQLite 세션을 제공한다."""
    engine = create_async_engine("sqlite+aiosqlite:///:memory:", echo=False)
    async_session = sessionmaker(engine, class_=AsyncSession, expire_on_commit=False)
    loop = asyncio.new_event_loop()

    async def _setup():
        async with engine.begin() as conn:
            await conn.run_sync(Base.metadata.create_all)
        return async_session()

    session = loop.run_until_complete(_setup())
    yield loop, session
    loop.run_until_complete(session.close())
    loop.run_until_complete(engine.dispose())
    loop.close()


def test_manual_asset_sector_update(db_session):
    """수동 자산은 ManualAsset.sector 자체가 갱신된다."""
    loop, db = db_session

    async def _run():
        asset = ManualAsset(
            category="일반주식계좌",
            broker="미래에셋",
            asset_name="KT",
            ticker="030200",
            purchase_price=35000,
            current_price=41000,
            quantity=100,
            sector="통신",
        )
        db.add(asset)
        await db.commit()

        res = await update_holding_sector(
            f"manual_{asset.id}", SectorUpdatePayload(sector="해외ETF"), db=db
        )
        assert res["status"] == "success"
        assert res["sector"] == "해외ETF"

        await db.refresh(asset)
        assert asset.sector == "해외ETF"

    loop.run_until_complete(_run())


def test_kis_sector_override_insert_then_update(db_session):
    """KIS 종목은 오버라이드 행이 새로 생기고, 재호출 시 중복 없이 갱신된다."""
    loop, db = db_session

    async def _run():
        key = "kis_069500_81060777-01"

        await update_holding_sector(key, SectorUpdatePayload(sector="반도체"), db=db)
        rows = (await db.execute(HoldingSectorOverride.__table__.select())).fetchall()
        assert len(rows) == 1
        assert rows[0].sector == "반도체"

        await update_holding_sector(key, SectorUpdatePayload(sector="채권/채권ETF"), db=db)
        rows = (await db.execute(HoldingSectorOverride.__table__.select())).fetchall()
        assert len(rows) == 1, "같은 종목 재변경 시 행이 늘어나면 안 된다"
        assert rows[0].sector == "채권/채권ETF"

    loop.run_until_complete(_run())


def test_invalid_inputs_are_rejected(db_session):
    """빈 섹터, 잘못된 ID, 알 수 없는 prefix 는 4xx 로 거절된다."""
    loop, db = db_session

    async def _run():
        with pytest.raises(HTTPException) as e1:
            await update_holding_sector("kis_069500_01", SectorUpdatePayload(sector="   "), db=db)
        assert e1.value.status_code == 400

        with pytest.raises(HTTPException) as e2:
            await update_holding_sector("manual_abc", SectorUpdatePayload(sector="통신"), db=db)
        assert e2.value.status_code == 400

        with pytest.raises(HTTPException) as e3:
            await update_holding_sector("manual_9999", SectorUpdatePayload(sector="통신"), db=db)
        assert e3.value.status_code == 404

        with pytest.raises(HTTPException) as e4:
            await update_holding_sector("etc_069500", SectorUpdatePayload(sector="통신"), db=db)
        assert e4.value.status_code == 400

    loop.run_until_complete(_run())


def test_override_is_reflected_in_integrated_assets(db_session):
    """오버라이드한 섹터가 통합자산 응답의 holding.sector 로 나온다."""
    loop, db = db_session

    async def _run():
        key = "kis_069500_81060777-01"

        with patch("api.my_assets.get_my_portfolio", new_callable=AsyncMock) as mock_pf, patch(
            "api.integrated_assets.get_live_usd_krw_rate", new_callable=AsyncMock
        ) as mock_fx:
            mock_pf.return_value = KIS_PORTFOLIO_MOCK
            mock_fx.return_value = 1400.0

            before = await get_integrated_assets(request=AsyncMock(), db=db)
            holding = _find_holding(before, key)
            assert holding is not None, "KIS 종목이 통합자산 응답에 없다"
            assert holding["sector"] == "ETF/주식", "오버라이드 전에는 기본값이어야 한다"

            await update_holding_sector(key, SectorUpdatePayload(sector="원자재/금"), db=db)

            after = await get_integrated_assets(request=AsyncMock(), db=db)
            assert _find_holding(after, key)["sector"] == "원자재/금"

    loop.run_until_complete(_run())


def _find_holding(response: dict, holding_id: str):
    for holdings in response["grouped_holdings"].values():
        for h in holdings:
            if h["id"] == holding_id:
                return h
    return None
