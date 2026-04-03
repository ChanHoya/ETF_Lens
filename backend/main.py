import asyncio
from fastapi import FastAPI

from core.scheduler import setup_scheduler
from contextlib import asynccontextmanager
from api.router import router as api_router
from api.my_assets import router as my_assets_router
from api.covered_call import router as cc_router
from api.exit_signal import router as exit_signal_router
from api.chat import router as chat_router
from api.macro_compass import router as compass_router
from api.health_monitor import router as health_router
from api.portfolio_market import router as market_router
from api.backtest import router as backtest_router
from fastapi.middleware.cors import CORSMiddleware


from db.database import engine
from db.models import Base


@asynccontextmanager
async def lifespan(app: FastAPI):
    from sqlalchemy import text
    from db.database import DATABASE_URL

    _is_sqlite = DATABASE_URL.startswith("sqlite")

    # ── 1. 테이블 생성 (별도 트랜잭션) ─────────────────────────────────────
    async with engine.begin() as conn:
        await conn.run_sync(Base.metadata.create_all)

    # ── 2. shares 컬럼 추가 (별도 트랜잭션 — PostgreSQL 호환) ───────────────
    try:
        async with engine.begin() as conn:
            if _is_sqlite:
                # SQLite: IF NOT EXISTS 미지원 → 예외 무시
                try:
                    await conn.execute(text("ALTER TABLE etf_holdings ADD COLUMN shares INTEGER"))
                    print("Successfully added 'shares' column to etf_holdings (SQLite)")
                except Exception:
                    pass  # 이미 존재
            else:
                # PostgreSQL: ADD COLUMN IF NOT EXISTS (9.6+)
                await conn.execute(text("ALTER TABLE etf_holdings ADD COLUMN IF NOT EXISTS shares INTEGER"))
    except Exception as _e:
        print(f"[Startup] shares column migration skipped: {_e}")

    # ── 3. ETF 성과 컬럼 마이그레이션 (SQLite 전용 스크립트) ─────────────────
    if _is_sqlite:
        try:
            from migrate_add_perf_columns import migrate as _migrate_perf
            _migrate_perf()
        except Exception as _e:
            print(f"[Startup] ETF perf column migration skipped: {_e}")
    else:
        # PostgreSQL: 성과 컬럼은 models.py / create_all 로 이미 생성됨
        print("[Startup] PostgreSQL: perf columns managed by create_all, skipping SQLite migration script.")

    # ── 4. 버전 기록 ────────────────────────────────────────────────────────
    try:
        from core.scheduler import update_app_version
        await update_app_version("[startup]")
    except Exception as _e:
        print(f"[Startup] version update skipped: {_e}")

    setup_scheduler()

    # 앱 시작 시 ETF 마스터 목록 즉시 백그라운드 동기화
    from core.scheduler import sync_etf_master_list
    asyncio.create_task(sync_etf_master_list())

    yield
    # Shutdown



app = FastAPI(
    title="ETF Analysis Platform API",
    description="API for collecting, analyzing, and orchestrating ETF data.",
    version="1.0.0",
    lifespan=lifespan,
)

# CORS 설정
app.add_middleware(
    CORSMiddleware,
    allow_origins=[
        "*"
    ],  # 실제 서비스에서는 ["http://localhost:3000"] 등 프론트 주소로 제한
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


app.include_router(api_router, prefix="/api/v1")
app.include_router(my_assets_router, prefix="/api/v1/my")
app.include_router(cc_router, prefix="/api/v1")
app.include_router(exit_signal_router, prefix="/api/v1/exit-signal")
app.include_router(chat_router, prefix="/api/v1/chat")
app.include_router(compass_router, prefix="/api/v1")
app.include_router(health_router, prefix="/api/v1/health")
app.include_router(market_router, prefix="/api/v1")
app.include_router(backtest_router, prefix="/api/v1/my/backtest")


@app.get("/health")
@app.head("/health")
def health_check():
    return {"status": "ok", "message": "ETF Analysis Platform API is running"}
