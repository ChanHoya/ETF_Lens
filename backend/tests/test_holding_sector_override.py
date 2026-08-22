# 보유 종목 섹터/분류 오버라이드 PATCH 엔드포인트와 통합자산 조회 반영을 검증하는 테스트
import asyncio
from unittest.mock import AsyncMock, patch

import pytest
from fastapi import HTTPException
from sqlalchemy.ext.asyncio import AsyncSession, create_async_engine
from sqlalchemy.orm import sessionmaker

from api.integrated_assets import (
    SectorUpdatePayload,
    get_integrated_assets,
    guess_holding_sector,
    update_holding_sector,
)
from db.database import Base
from db.models import HoldingSectorOverride, ManualAsset
from migrate_sector_taxonomy import LEGACY_SECTOR_MAP, normalize_legacy_sectors


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


def test_manual_asset_taxonomy_update(db_session):
    """수동 자산은 ManualAsset 의 sector/classification 컬럼이 직접 갱신된다."""
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
            sector="국내주식",
            classification="통신",
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
        assert asset.classification == "통신", "섹터만 보냈으면 분류는 그대로여야 한다"

        await update_holding_sector(
            f"manual_{asset.id}", SectorUpdatePayload(classification="반도체"), db=db
        )
        await db.refresh(asset)
        assert (asset.sector, asset.classification) == ("해외ETF", "반도체")

    loop.run_until_complete(_run())


def test_empty_string_clears_the_field(db_session):
    """빈 문자열을 보내면 '미지정'으로 지운다."""
    loop, db = db_session

    async def _run():
        key = "kis_069500_81060777-01"
        await update_holding_sector(
            key, SectorUpdatePayload(sector="국내ETF", classification="지수형"), db=db
        )

        res = await update_holding_sector(key, SectorUpdatePayload(classification=""), db=db)
        assert res["classification"] == ""
        assert res["sector"] == "국내ETF", "분류만 지웠으면 섹터는 남아야 한다"

    loop.run_until_complete(_run())


def test_guess_holding_sector():
    """ETF 브랜드 토큰과 국내/해외 조합으로 섹터 기본값을 추론한다."""
    assert guess_holding_sector("KODEX 200", "069500", "국내") == "국내ETF"
    assert guess_holding_sector("TIGER 미국나스닥100", "133690", "해외") == "해외ETF"
    assert guess_holding_sector("삼성전자", "005930", "국내") == "국내주식"
    assert guess_holding_sector("APPLE INC", "AAPL", "해외") == "해외주식"


# 스펙으로 못박은 신규 분류 체계. 마이그레이션 결과가 이 밖으로 새면 드롭다운에 없는 값이 남는다.
NEW_SECTORS = {"국내ETF", "해외ETF", "국내주식", "해외주식", "펀드", "채권", "현금성"}
NEW_CLASSIFICATIONS = {
    "지수형", "반도체", "AI인프라", "2차전지", "테크",
    "조선", "우주", "금융지주", "통신", "바이오",
}


def test_legacy_sector_map_is_idempotent():
    """마이그레이션은 sector 값만 WHERE 키로 쓴다. 따라서 sector 출력이 다시 키면 두 번 변환된다."""
    for legacy, (new_sector, _) in LEGACY_SECTOR_MAP.items():
        assert new_sector not in LEGACY_SECTOR_MAP, f"{legacy} → {new_sector} 가 다시 매핑된다"


def test_legacy_sector_map_targets_are_valid():
    """매핑 결과는 신규 섹터/분류 목록 안에 있거나 미지정(None)이어야 한다."""
    for legacy, (new_sector, new_class) in LEGACY_SECTOR_MAP.items():
        assert new_sector is None or new_sector in NEW_SECTORS, f"{legacy} → 섹터 {new_sector}"
        assert new_class is None or new_class in NEW_CLASSIFICATIONS, f"{legacy} → 분류 {new_class}"


def test_kis_sector_override_insert_then_update(db_session):
    """KIS 종목은 오버라이드 행이 새로 생기고, 재호출 시 중복 없이 갱신된다."""
    loop, db = db_session

    async def _run():
        key = "kis_069500_81060777-01"

        await update_holding_sector(key, SectorUpdatePayload(sector="국내ETF"), db=db)
        rows = (await db.execute(HoldingSectorOverride.__table__.select())).fetchall()
        assert len(rows) == 1
        assert rows[0].sector == "국내ETF"

        await update_holding_sector(key, SectorUpdatePayload(sector="채권"), db=db)
        rows = (await db.execute(HoldingSectorOverride.__table__.select())).fetchall()
        assert len(rows) == 1, "같은 종목 재변경 시 행이 늘어나면 안 된다"
        assert rows[0].sector == "채권"

    loop.run_until_complete(_run())


def test_invalid_inputs_are_rejected(db_session):
    """빈 페이로드, 잘못된 ID, 없는 자산, 알 수 없는 prefix 는 4xx 로 거절된다."""
    loop, db = db_session

    async def _run():
        with pytest.raises(HTTPException) as e1:
            await update_holding_sector("kis_069500_01", SectorUpdatePayload(), db=db)
        assert e1.value.status_code == 400

        with pytest.raises(HTTPException) as e2:
            await update_holding_sector("manual_abc", SectorUpdatePayload(sector="채권"), db=db)
        assert e2.value.status_code == 400

        with pytest.raises(HTTPException) as e3:
            await update_holding_sector("manual_9999", SectorUpdatePayload(sector="채권"), db=db)
        assert e3.value.status_code == 404

        with pytest.raises(HTTPException) as e4:
            await update_holding_sector("etc_069500", SectorUpdatePayload(sector="채권"), db=db)
        assert e4.value.status_code == 400

    loop.run_until_complete(_run())


def test_override_is_reflected_in_integrated_assets(db_session):
    """오버라이드한 섹터/분류가 통합자산 응답에 그대로 나오고, 없으면 추론값이 쓰인다."""
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
            assert holding["sector"] == "국내ETF", "오버라이드 전에는 추론 기본값"
            assert holding["classification"] == "", "분류 기본값은 미지정(빈 값)"

            await update_holding_sector(
                key, SectorUpdatePayload(sector="채권", classification="지수형"), db=db
            )

            after = await get_integrated_assets(request=AsyncMock(), db=db)
            updated = _find_holding(after, key)
            assert updated["sector"] == "채권"
            assert updated["classification"] == "지수형"

    loop.run_until_complete(_run())


def _find_holding(response: dict, holding_id: str):
    for holdings in response["grouped_holdings"].values():
        for h in holdings:
            if h["id"] == holding_id:
                return h
    return None


def test_legacy_normalization_splits_and_is_repeatable(db_session):
    """구 sector 값이 두 축으로 갈리고, 두 번 돌려도 결과가 바뀌지 않는다."""
    loop, db = db_session

    async def _run():
        db.add_all([
            ManualAsset(category="일반주식계좌", broker="미래에셋", asset_name="KT",
                        purchase_price=1, current_price=1, quantity=1, sector="통신"),
            ManualAsset(category="기타투자계좌", broker="케이뱅크", asset_name="플러스박스",
                        purchase_price=0, current_price=1, quantity=1, sector="예적금/현금성"),
            ManualAsset(category="기타투자계좌", broker="기타", asset_name="SpaceX",
                        purchase_price=1, current_price=1, quantity=1, sector="해외비상장"),
        ])
        db.add(HoldingSectorOverride(holding_key="kis_005930_01", sector="반도체"))
        await db.commit()

        await normalize_legacy_sectors(db)
        await db.commit()

        rows = (await db.execute(ManualAsset.__table__.select())).fetchall()
        by_name = {r.asset_name: (r.sector, r.classification) for r in rows}
        assert by_name["KT"] == (None, "통신"), "산업 값은 분류로 넘어가고 섹터는 비워진다"
        assert by_name["플러스박스"] == ("현금성", None)
        assert by_name["SpaceX"] == ("해외주식", None)

        ovr = (await db.execute(HoldingSectorOverride.__table__.select())).fetchall()
        assert (ovr[0].sector, ovr[0].classification) == (None, "반도체")

        # 두 번째 실행에도 값이 그대로여야 한다
        await normalize_legacy_sectors(db)
        await db.commit()
        rows2 = (await db.execute(ManualAsset.__table__.select())).fetchall()
        assert {r.asset_name: (r.sector, r.classification) for r in rows2} == by_name

    loop.run_until_complete(_run())
