import os
from sqlalchemy.ext.asyncio import create_async_engine, AsyncSession, async_sessionmaker
from sqlalchemy.orm import declarative_base

# 환경변수 DATABASE_URL 우선 사용 (Render PostgreSQL)
# 없으면 로컬 SQLite fallback
_raw_db_url = os.getenv("DATABASE_URL", "sqlite+aiosqlite:///./etf_data_v2.db")

# Render는 postgres:// 형식으로 제공 → asyncpg용으로 교체
if _raw_db_url.startswith("postgres://"):
    _raw_db_url = _raw_db_url.replace("postgres://", "postgresql+asyncpg://", 1)
elif _raw_db_url.startswith("postgresql://") and "+asyncpg" not in _raw_db_url:
    _raw_db_url = _raw_db_url.replace("postgresql://", "postgresql+asyncpg://", 1)

DATABASE_URL = _raw_db_url

# PostgreSQL은 connect_args 불필요 (SQLite는 check_same_thread 옵션 필요)
_is_sqlite = DATABASE_URL.startswith("sqlite")
_connect_args = {"check_same_thread": False} if _is_sqlite else {}

engine = create_async_engine(DATABASE_URL, echo=False, connect_args=_connect_args)
AsyncSessionLocal = async_sessionmaker(
    bind=engine, class_=AsyncSession, expire_on_commit=False
)

Base = declarative_base()


async def get_db():
    async with AsyncSessionLocal() as session:
        try:
            yield session
        except Exception:
            await session.rollback()
            raise
        finally:
            await session.close()
