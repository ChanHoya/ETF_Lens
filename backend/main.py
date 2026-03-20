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
from fastapi.middleware.cors import CORSMiddleware


from db.database import engine
from db.models import Base


@asynccontextmanager
async def lifespan(app: FastAPI):
    # Startup DB schemas
    async with engine.begin() as conn:
        await conn.run_sync(Base.metadata.create_all)

        # Add shares column safely if it doesn't exist
        try:
            from sqlalchemy import text

            await conn.execute(
                text("ALTER TABLE etf_holdings ADD COLUMN shares INTEGER")
            )
            print("Successfully added 'shares' column to etf_holdings")
        except Exception:
            # Column likely already exists
            pass

    # ETF 성과 컬럼 마이그레이션 (return_1m/3m/6m/1y, volatility, sharpe, perf_updated_at)
    try:
        from migrate_add_perf_columns import migrate as _migrate_perf
        _migrate_perf()
    except Exception as _e:
        print(f"[Startup] ETF perf column migration skipped: {_e}")

    # 서버 시작 시 버전 자동 기록 (배포/재시작 즉시 반영)
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


@app.get("/health")
@app.head("/health")
def health_check():
    return {"status": "ok", "message": "ETF Analysis Platform API is running"}
