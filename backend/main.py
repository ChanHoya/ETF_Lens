from fastapi import FastAPI

from core.scheduler import setup_scheduler
from contextlib import asynccontextmanager
from api.router import router as api_router
from api.my_assets import router as my_assets_router
from api.covered_call import router as cc_router
from api.exit_signal import router as exit_signal_router
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

    setup_scheduler()
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


@app.get("/health")
@app.head("/health")
def health_check():
    return {"status": "ok", "message": "ETF Analysis Platform API is running"}
