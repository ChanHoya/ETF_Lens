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
from api.peer_analysis import router as peer_router
from api.rebalance_proposal import router as rebalance_proposal_router
from api.db_sync import router as db_sync_router
from api.order_router import router as order_router
from api.notification_settings import router as notification_settings_router
from api.efficient_frontier import router as efficient_frontier_router
from api.next_leader import router as next_leader_router
from api.sector_insight import router as sector_insight_router
from api.brazil_bond import router as brazil_bond_router
from api.integrated_assets import router as integrated_assets_router
from fastapi.middleware.cors import CORSMiddleware


from db.database import engine
from db.models import Base


@asynccontextmanager
async def lifespan(app: FastAPI):
    from sqlalchemy import text
    from db.database import DATABASE_URL

    _is_sqlite = DATABASE_URL.startswith("sqlite")

    async def init_db_and_startup():
        # ── 1. 테이블 생성 (별도 트랜잭션) ─────────────────────────────────────
        max_retries = 3
        for attempt in range(max_retries):
            try:
                async with engine.begin() as conn:
                    await conn.run_sync(Base.metadata.create_all)
                break
            except Exception as e:
                if attempt < max_retries - 1:
                    print(f"[Startup] DB Connection timeout or error, retrying in 5 seconds... (Attempt {attempt+1}/{max_retries})\nError: {e}")
                    await asyncio.sleep(5)
                else:
                    print(f"[Startup] Failed to create tables: {e}")

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

        # ── 2.5. etf_daily_prices nav/disparity_rate 컬럼 추가 (PostgreSQL/SQLite 호환) ──
        try:
            async with engine.begin() as conn:
                if _is_sqlite:
                    try:
                        await conn.execute(text("ALTER TABLE etf_daily_prices ADD COLUMN nav FLOAT"))
                        print("Successfully added 'nav' column to etf_daily_prices (SQLite)")
                    except Exception:
                        pass
                    try:
                        await conn.execute(text("ALTER TABLE etf_daily_prices ADD COLUMN disparity_rate FLOAT"))
                        print("Successfully added 'disparity_rate' column to etf_daily_prices (SQLite)")
                    except Exception:
                        pass
                else:
                    await conn.execute(text("ALTER TABLE etf_daily_prices ADD COLUMN IF NOT EXISTS nav DOUBLE PRECISION"))
                    await conn.execute(text("ALTER TABLE etf_daily_prices ADD COLUMN IF NOT EXISTS disparity_rate DOUBLE PRECISION"))
                    print("Successfully executed PostgreSQL ALTER TABLE check/migrations for etf_daily_prices columns.")
        except Exception as _e:
            print(f"[Startup] etf_daily_prices columns migration skipped: {_e}")

        # ── 2.7. notification_settings.alert_brazil 컬럼 추가 (브라질 알림 토글) ──────
        try:
            async with engine.begin() as conn:
                if _is_sqlite:
                    try:
                        await conn.execute(text("ALTER TABLE notification_settings ADD COLUMN alert_brazil INTEGER DEFAULT 1"))
                    except Exception:
                        pass  # 이미 존재
                else:
                    await conn.execute(text("ALTER TABLE notification_settings ADD COLUMN IF NOT EXISTS alert_brazil INTEGER DEFAULT 1"))
        except Exception as _e:
            print(f"[Startup] alert_brazil column migration skipped: {_e}")

        # ── 2.8. 섹터/분류 분리 마이그레이션 ────────────────────────────────────
        # 스키마(DDL)와 데이터(DML)를 나눠서 돌린다. classification 컬럼이 없으면
        # ManualAsset 을 읽는 모든 엔드포인트가 500 이 되므로, 스키마는 검증될 때까지 재시도한다.
        # 이 태스크는 백그라운드라 한 번 놓치면 재배포 전까지 다시 안 돌기 때문이다.
        from migrate_sector_taxonomy import is_healthy, migrate_data, migrate_schema

        schema_ok = False
        for attempt in range(5):
            try:
                async with engine.begin() as conn:
                    status = await migrate_schema(conn, _is_sqlite)
                if is_healthy(status):
                    schema_ok = True
                    print(f"[Startup] taxonomy schema ready: {status}")
                    break
                print(f"[Startup] taxonomy schema incomplete: {status}")
            except Exception as _e:
                print(f"[Startup] taxonomy schema attempt {attempt + 1}/5 failed: {_e}")
            await asyncio.sleep(min(30, 3 * (attempt + 1)))

        if not schema_ok:
            print(
                "[Startup] !! taxonomy schema migration FAILED — "
                "수동자산 조회와 분류 지정이 실패한다. "
                "POST /api/v1/my/schema-repair 로 재시도할 것."
            )

        # 데이터 정규화는 실패해도 앱 동작에는 지장이 없다.
        _data_errors = await migrate_data(engine)
        if _data_errors:
            print(f"[Startup] taxonomy data normalization errors: {_data_errors}")

        # ── 3. ETF 성과 및 랭킹 비용 컬럼 마이그레이션 (SQLite 전용 스크립트) ───────
        if _is_sqlite:
            try:
                from migrate_add_perf_columns import migrate as _migrate_perf
                _migrate_perf()
            except Exception as _e:
                print(f"[Startup] ETF perf column migration skipped: {_e}")
            try:
                from migrate_add_ranking_columns import migrate as _migrate_ranking
                _migrate_ranking()
            except Exception as _e:
                print(f"[Startup] ETF ranking column migration skipped: {_e}")
        else:
            # PostgreSQL: 기존 테이블이 있을 경우 ALTER TABLE DDL을 직접 수행하여 누락 컬럼 보완
            try:
                async with engine.begin() as conn:
                    # 성과 지표 컬럼 추가 (migrate_add_perf_columns 대응)
                    await conn.execute(text("ALTER TABLE etf_master ADD COLUMN IF NOT EXISTS return_1m DOUBLE PRECISION DEFAULT 0.0"))
                    await conn.execute(text("ALTER TABLE etf_master ADD COLUMN IF NOT EXISTS return_3m DOUBLE PRECISION DEFAULT 0.0"))
                    await conn.execute(text("ALTER TABLE etf_master ADD COLUMN IF NOT EXISTS return_6m DOUBLE PRECISION DEFAULT 0.0"))
                    await conn.execute(text("ALTER TABLE etf_master ADD COLUMN IF NOT EXISTS return_1y DOUBLE PRECISION DEFAULT 0.0"))
                    await conn.execute(text("ALTER TABLE etf_master ADD COLUMN IF NOT EXISTS volatility DOUBLE PRECISION DEFAULT 0.0"))
                    await conn.execute(text("ALTER TABLE etf_master ADD COLUMN IF NOT EXISTS sharpe DOUBLE PRECISION DEFAULT 0.0"))
                    await conn.execute(text("ALTER TABLE etf_master ADD COLUMN IF NOT EXISTS perf_updated_at TIMESTAMP WITHOUT TIME ZONE"))
                    
                    # 랭킹/실질 비용 컬럼 추가 (migrate_add_ranking_columns 대응)
                    await conn.execute(text("ALTER TABLE etf_master ADD COLUMN IF NOT EXISTS other_fee DOUBLE PRECISION DEFAULT 0.0"))
                    await conn.execute(text("ALTER TABLE etf_master ADD COLUMN IF NOT EXISTS transaction_fee DOUBLE PRECISION DEFAULT 0.0"))
                    await conn.execute(text("ALTER TABLE etf_master ADD COLUMN IF NOT EXISTS tracking_error DOUBLE PRECISION DEFAULT 0.0"))
                    await conn.execute(text("ALTER TABLE etf_master ADD COLUMN IF NOT EXISTS disparity_rate DOUBLE PRECISION DEFAULT 0.0"))
                    print("[Startup] Successfully executed PostgreSQL ALTER TABLE check/migrations for etf_master columns.")
            except Exception as _e:
                print(f"[Startup] PostgreSQL etf_master column migration failed: {_e}")

        # ── 4. 버전 기록 ────────────────────────────────────────────────────────
        try:
            from core.scheduler import update_app_version
            await update_app_version("[startup]")
        except Exception as _e:
            print(f"[Startup] version update skipped: {_e}")

        # ── 5. 미국 매크로 및 시장 심리 지표 시딩 ───────────────────────────────
        try:
            from api.exit_signal import seed_us_macro_db_if_empty, seed_market_sentiment_db_if_empty
            await seed_market_sentiment_db_if_empty()
            await seed_us_macro_db_if_empty()
        except Exception as _e:
            print(f"[Startup] Seeding skipped: {_e}")

        # ── 5.5. 브라질 국채 매크로 시계열 시딩 (신규 배포 시 빈 테이블 즉시 채움) ──
        try:
            from core.brazil_fetcher import seed_brazil_series_if_empty
            asyncio.create_task(seed_brazil_series_if_empty())
        except Exception as _e:
            print(f"[Startup] Brazil seeding skipped: {_e}")

        setup_scheduler()

    # DB 연결 대기로 인한 Render 60초 포트바인딩 타임아웃 방지를 위해 백그라운드로 실행
    asyncio.create_task(init_db_and_startup())

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
        "https://etf-lens.vercel.app",
        "http://localhost:3000",
        "http://localhost:3001",
        "http://localhost:3002",
        "http://localhost:3003",
        "http://localhost:8000",
        "http://localhost:8080",
    ],
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
app.include_router(peer_router, prefix="/api/v1/my")
app.include_router(rebalance_proposal_router, prefix="/api/v1/analyze")
app.include_router(db_sync_router, prefix="/api/v1/sync")
app.include_router(order_router, prefix="/api/v1/order")
app.include_router(notification_settings_router)
app.include_router(efficient_frontier_router, prefix="/api/v1/analyze")
app.include_router(next_leader_router, prefix="/api/v1/analyze")
app.include_router(sector_insight_router, prefix="/api/v1/sector-insight")
app.include_router(brazil_bond_router, prefix="/api/v1/brazil-bond")
app.include_router(integrated_assets_router, prefix="/api/v1/my")


@app.get("/health")
@app.head("/health")
def health_check():
    return {"status": "ok", "message": "ETF Analysis Platform API is running"}


@app.get("/api/v1/debug/peer-fetch")
async def debug_peer_fetch():
    """Render 서버에서 각 데이터 소스별 종가 조회 상태 진단."""
    import asyncio
    import time
    from datetime import datetime
    from api.peer_analysis import _fetch_via_pykrx, _fetch_via_yf_v8, _calc_return_pct

    TEST_CODES = {
        "396500": "TIGER 반도체TOP10",
        "381180": "TIGER 미국필라델피아반도체나스닥",
        "441640": "KODEX 미국배당커버드콜액티브",
    }

    results = {}
    for code, name in TEST_CODES.items():
        entry: dict = {"name": name, "sources": {}}

        # pykrx
        t0 = time.time()
        try:
            loop = asyncio.get_event_loop()
            closes = await loop.run_in_executor(None, _fetch_via_pykrx, code)
            entry["sources"]["pykrx"] = {
                "ok": len(closes) >= 22,
                "rows": len(closes),
                "last": closes[-1] if closes else None,
                "1m": _calc_return_pct(closes, 21),
                "latency_ms": round((time.time() - t0) * 1000),
            }
        except Exception as e:
            entry["sources"]["pykrx"] = {"ok": False, "error": str(e)}

        # Yahoo v8
        t0 = time.time()
        try:
            closes = await loop.run_in_executor(None, _fetch_via_yf_v8, code)
            entry["sources"]["yf_v8"] = {
                "ok": len(closes) >= 22,
                "rows": len(closes),
                "last": closes[-1] if closes else None,
                "1m": _calc_return_pct(closes, 21),
                "latency_ms": round((time.time() - t0) * 1000),
            }
        except Exception as e:
            entry["sources"]["yf_v8"] = {"ok": False, "error": str(e)}

        results[code] = entry

    return {"checked_at": datetime.now().isoformat(), "results": results}

