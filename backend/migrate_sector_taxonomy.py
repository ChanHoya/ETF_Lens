# sector 한 필드에 섞여 있던 자산군/산업 값을 sector + classification 두 축으로 가르는 마이그레이션
from sqlalchemy import text

# 섹터/분류 정보를 들고 있는 두 테이블
TABLES = ("manual_assets", "holding_sector_overrides")

# 구 sector 값 → (새 섹터, 새 분류). None 은 '미지정'으로 비운다는 뜻.
# WHERE 키로는 sector 만 쓰므로, 결과 sector 값이 다시 이 dict 의 키가 아니어야 재실행이 안전하다.
LEGACY_SECTOR_MAP = {
    "ETF/주식": ("국내ETF", None),
    "예적금": ("현금성", None),
    "예적금/현금성": ("현금성", None),
    "해외비상장": ("해외주식", None),
    "비상장주식": ("국내주식", None),
    "반도체": (None, "반도체"),
    "빅테크/성장": (None, "테크"),
    "AI전력/인프라": (None, "AI인프라"),
    "통신": (None, "통신"),
    "금융/지주": (None, "금융지주"),
    "우주항공": (None, "우주"),
    "바이오/헬스": (None, "바이오"),
    "배당/커버드콜": (None, None),
    "기타": (None, None),
}


async def add_classification_columns(conn, is_sqlite: bool) -> None:
    """classification 컬럼을 두 테이블에 추가한다. 이미 있으면 넘어간다."""
    for table in TABLES:
        if is_sqlite:
            try:
                await conn.execute(text(f"ALTER TABLE {table} ADD COLUMN classification VARCHAR"))
            except Exception:
                pass  # 이미 존재
        else:
            await conn.execute(
                text(f"ALTER TABLE {table} ADD COLUMN IF NOT EXISTS classification VARCHAR")
            )


async def normalize_legacy_sectors(conn) -> None:
    """구 sector 값을 새 섹터/분류로 갈라 담는다. 이미 정규화된 행은 WHERE 에 걸리지 않는다."""
    for legacy, (new_sector, new_class) in LEGACY_SECTOR_MAP.items():
        for table in TABLES:
            await conn.execute(
                text(
                    f"UPDATE {table} SET sector = :new_sector, "
                    f"classification = COALESCE(classification, :new_class) "
                    f"WHERE sector = :legacy"
                ),
                {"new_sector": new_sector, "new_class": new_class, "legacy": legacy},
            )


async def migrate(conn, is_sqlite: bool) -> None:
    await add_classification_columns(conn, is_sqlite)
    await normalize_legacy_sectors(conn)
