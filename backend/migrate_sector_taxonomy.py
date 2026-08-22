# sector 한 필드에 섞여 있던 자산군/산업 값을 sector + classification 두 축으로 가르는 마이그레이션
#
# 주의. 이 마이그레이션은 Render 포트바인딩 타임아웃 때문에 백그라운드 태스크에서 돌아간다.
# 한 번 실패하면 재배포 전까지 다시 시도되지 않으므로, 각 단계는 개별 트랜잭션으로 나누고
# 끝나면 반드시 verify() 로 실제 컬럼 존재 여부를 확인해야 한다.
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

# 수동 입력 금융사 이름 정리. KIS 연동분과 같은 이름으로 묶어야 금융사별 집계가 갈라지지 않는다.
BROKER_ALIASES = {
    "한국투자(수동)": "한국투자",
    "한국투자증권": "한국투자",
}


async def has_classification_column(conn, table: str, is_sqlite: bool) -> bool:
    """해당 테이블에 classification 컬럼이 실제로 있는지 확인한다."""
    if is_sqlite:
        rows = (await conn.execute(text(f"PRAGMA table_info({table})"))).fetchall()
        return any(r[1] == "classification" for r in rows)
    row = (
        await conn.execute(
            text(
                "SELECT 1 FROM information_schema.columns "
                "WHERE table_name = :t AND column_name = 'classification'"
            ),
            {"t": table},
        )
    ).first()
    return row is not None


async def verify(conn, is_sqlite: bool) -> dict:
    """테이블별 classification 컬럼 존재 여부를 돌려준다."""
    return {t: await has_classification_column(conn, t, is_sqlite) for t in TABLES}


async def add_classification_columns(conn, is_sqlite: bool) -> None:
    """classification 컬럼을 두 테이블에 추가한다.

    이미 있으면 건너뛴다. 존재 여부를 먼저 확인하고 나서 ALTER 하므로,
    실패한 DDL 이 트랜잭션을 오염시켜 앞서 성공한 ALTER 까지 되돌리는 일이 없다.
    """
    for table in TABLES:
        if await has_classification_column(conn, table, is_sqlite):
            continue
        await conn.execute(text(f"ALTER TABLE {table} ADD COLUMN classification VARCHAR"))


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


async def normalize_broker_names(conn) -> None:
    """'한국투자(수동)' 처럼 갈라져 있던 금융사 이름을 대표 이름으로 합친다."""
    for alias, canonical in BROKER_ALIASES.items():
        await conn.execute(
            text("UPDATE manual_assets SET broker = :canonical WHERE broker = :alias"),
            {"canonical": canonical, "alias": alias},
        )


async def migrate_schema(conn, is_sqlite: bool) -> dict:
    """스키마(DDL)만 반영하고 결과를 검증해 돌려준다. 앱이 뜨려면 이게 반드시 성공해야 한다."""
    await add_classification_columns(conn, is_sqlite)
    return await verify(conn, is_sqlite)


async def migrate_data(conn) -> None:
    """데이터 정규화(DML). 실패해도 앱은 뜬다."""
    await normalize_legacy_sectors(conn)
    await normalize_broker_names(conn)
