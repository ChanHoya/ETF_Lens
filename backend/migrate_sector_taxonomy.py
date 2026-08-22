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


async def is_override_sector_nullable(conn, is_sqlite: bool) -> bool:
    """holding_sector_overrides.sector 가 NULL 을 허용하는지 확인한다.

    섹터 없이 분류만 지정하면 sector 가 NULL 인 행이 생긴다.
    초기 모델이 nullable=False 였고 create_all 은 기존 컬럼 제약을 바꾸지 않으므로
    먼저 배포된 DB 에는 NOT NULL 이 남아 있다. 그대로 두면 분류 지정이 실패한다.
    """
    if is_sqlite:
        rows = (
            await conn.execute(text("PRAGMA table_info(holding_sector_overrides)"))
        ).fetchall()
        for r in rows:
            if r[1] == "sector":
                return not bool(r[3])  # r[3] = notnull 플래그
        return True  # 컬럼이 없으면 판단 불가 — 막지 않는다
    row = (
        await conn.execute(
            text(
                "SELECT is_nullable FROM information_schema.columns "
                "WHERE table_name = 'holding_sector_overrides' AND column_name = 'sector'"
            )
        )
    ).first()
    return row is None or row[0] == "YES"


async def verify(conn, is_sqlite: bool) -> dict:
    """마이그레이션이 실제로 적용됐는지 확인한다."""
    return {
        "classification_columns": {
            t: await has_classification_column(conn, t, is_sqlite) for t in TABLES
        },
        "override_sector_nullable": await is_override_sector_nullable(conn, is_sqlite),
    }


def is_healthy(status: dict) -> bool:
    """verify() 결과가 전부 통과인지."""
    return all(status["classification_columns"].values()) and status["override_sector_nullable"]


async def add_classification_columns(conn, is_sqlite: bool) -> None:
    """classification 컬럼을 두 테이블에 추가한다.

    이미 있으면 건너뛴다. 존재 여부를 먼저 확인하고 나서 ALTER 하므로,
    실패한 DDL 이 트랜잭션을 오염시켜 앞서 성공한 ALTER 까지 되돌리는 일이 없다.
    """
    for table in TABLES:
        if await has_classification_column(conn, table, is_sqlite):
            continue
        await conn.execute(text(f"ALTER TABLE {table} ADD COLUMN classification VARCHAR"))


async def drop_override_sector_not_null(conn, is_sqlite: bool) -> None:
    """holding_sector_overrides.sector 의 NOT NULL 제약을 푼다. 이미 풀려 있으면 아무것도 안 한다."""
    if await is_override_sector_nullable(conn, is_sqlite):
        return

    if not is_sqlite:
        await conn.execute(
            text("ALTER TABLE holding_sector_overrides ALTER COLUMN sector DROP NOT NULL")
        )
        return

    # SQLite 는 컬럼 제약만 떼어낼 수 없어 테이블을 다시 만든다. 오버라이드 테이블이라 행이 적다.
    await conn.execute(
        text(
            "CREATE TABLE holding_sector_overrides_new ("
            "id INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT, "
            "holding_key VARCHAR NOT NULL, "
            "sector VARCHAR, "
            "classification VARCHAR, "
            "updated_at DATETIME)"
        )
    )
    await conn.execute(
        text(
            "INSERT INTO holding_sector_overrides_new "
            "(id, holding_key, sector, classification, updated_at) "
            "SELECT id, holding_key, sector, classification, updated_at "
            "FROM holding_sector_overrides"
        )
    )
    await conn.execute(text("DROP TABLE holding_sector_overrides"))
    await conn.execute(
        text("ALTER TABLE holding_sector_overrides_new RENAME TO holding_sector_overrides")
    )
    await conn.execute(
        text(
            "CREATE UNIQUE INDEX ix_holding_sector_overrides_holding_key "
            "ON holding_sector_overrides (holding_key)"
        )
    )
    await conn.execute(
        text("CREATE INDEX ix_holding_sector_overrides_id ON holding_sector_overrides (id)")
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
    await drop_override_sector_not_null(conn, is_sqlite)
    return await verify(conn, is_sqlite)


DATA_STEPS = (
    ("normalize_legacy_sectors", normalize_legacy_sectors),
    ("normalize_broker_names", normalize_broker_names),
)


async def migrate_data(engine) -> list:
    """데이터 정규화(DML). 실패해도 앱은 뜬다. 실패한 단계 목록을 돌려준다.

    단계마다 트랜잭션을 따로 연다. 한 트랜잭션에 묶으면 앞 단계가 죽는 순간
    트랜잭션이 오염돼 뒤 단계도 같이 죽는다. 실제로 섹터 정규화가 NOT NULL 제약에
    걸리면서 금융사 이름 정리까지 통째로 건너뛰었다.
    """
    errors = []
    for name, step in DATA_STEPS:
        try:
            async with engine.begin() as conn:
                await step(conn)
        except Exception as e:
            errors.append(f"{name}: {type(e).__name__}: {e}")
    return errors
