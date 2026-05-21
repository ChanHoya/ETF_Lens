import os
import asyncio
import logging
from sqlalchemy import select, delete
from sqlalchemy.ext.asyncio import create_async_engine, AsyncSession, async_sessionmaker
from db.database import AsyncSessionLocal as LocalSession
from db.models import (
    Base, AppVersion, UserPrincipal, SharedPortfolio, BenchmarkPrice,
    ETFMaster, ETFEvaluation, ETFDailyPrice, ETFHoldings,
    IndicatorHistory, StockEPSHistory, SimulationHistory,
    MarketSentimentLog, USMacroIndicatorLog
)

logger = logging.getLogger(__name__)

# Lock to ensure only one replication runs at any given time
_replication_lock = asyncio.Lock()

def get_remote_db_url() -> str:
    """Retrieves and normalizes the remote Render PostgreSQL database URL."""
    # Priority 1: RENDER_DATABASE_URL env var
    # Priority 2: DATABASE_URL (only if it is a postgresql URL, meaning we are running in prod)
    url = os.getenv("RENDER_DATABASE_URL", "")
    if not url:
        db_url = os.getenv("DATABASE_URL", "")
        if db_url.startswith("postgres://") or db_url.startswith("postgresql://"):
            url = db_url

    if not url:
        return ""

    # Normalize to asyncpg dialect for SQLAlchemy async connection
    if url.startswith("postgres://"):
        url = url.replace("postgres://", "postgresql+asyncpg://", 1)
    elif url.startswith("postgresql://") and "+asyncpg" not in url:
        url = url.replace("postgresql://", "postgresql+asyncpg://", 1)
    
    return url


async def replicate_sqlite_to_postgres():
    """
    Asynchronously replicates the local SQLite database to the remote Render PostgreSQL database.
    This job runs in the background and is non-blocking to the main application's API endpoints.
    """
    remote_url = get_remote_db_url()
    if not remote_url:
        logger.info("[Replication] RENDER_DATABASE_URL not configured. Skipping SQLite-to-PostgreSQL replication.")
        return

    # Check if we are already replicating
    if _replication_lock.locked():
        logger.warning("[Replication] Another replication task is already running. Skipping this trigger.")
        return

    async with _replication_lock:
        start_time = asyncio.get_event_loop().time()
        logger.info("[Replication] Starting database replication from SQLite to remote PostgreSQL...")

        try:
            # Initialize remote PostgreSQL engine and session
            remote_engine = create_async_engine(
                remote_url,
                echo=False,
                pool_pre_ping=True,
                pool_recycle=1800,
                connect_args={"timeout": 60}
            )
            RemoteSession = async_sessionmaker(
                bind=remote_engine, class_=AsyncSession, expire_on_commit=False
            )

            # Ensure remote tables exist
            async with remote_engine.begin() as conn:
                await conn.run_sync(Base.metadata.create_all)
            
            # List of tables to sync in order of dependency
            # (Independent tables first, then dependent ones)
            tables_to_sync = [
                (AppVersion, "app_version"),
                (UserPrincipal, "user_principal"),
                (SharedPortfolio, "shared_portfolios"),
                (BenchmarkPrice, "benchmark_prices"),
                (IndicatorHistory, "indicator_history"),
                (StockEPSHistory, "stock_eps_history"),
                (SimulationHistory, "simulation_history"),
                (MarketSentimentLog, "market_sentiment_log"),
                (USMacroIndicatorLog, "us_macro_indicator_log"),
                (ETFMaster, "etf_master"),
                (ETFEvaluation, "etf_evaluation"),
                (ETFDailyPrice, "etf_daily_prices"),
                (ETFHoldings, "etf_holdings"),
            ]

            # Replicate each table
            async with LocalSession() as local_db, RemoteSession() as remote_db:
                for model_class, table_name in tables_to_sync:
                    table_start = asyncio.get_event_loop().time()
                    
                    # 1. Fetch all records from local SQLite
                    local_result = await local_db.execute(select(model_class))
                    local_records = local_result.scalars().all()
                    
                    if not local_records:
                        logger.info(f"[Replication] Table '{table_name}' is empty locally. Skipping.")
                        continue
                    
                    logger.info(f"[Replication] Syncing {len(local_records)} records for table '{table_name}'...")

                    # 2. Clear remote table
                    # We clear the remote table and bulk insert to ensure perfect replication 
                    # and avoid primary key constraint conflicts.
                    await remote_db.execute(delete(model_class))
                    
                    # 3. Create fresh detached copies of local records to insert into remote DB
                    # (Detaching prevents SQLAlchemy state sharing issues between sessions)
                    remote_objs = []
                    for rec in local_records:
                        # Extract non-instance attributes to build a fresh instance
                        attrs = {c.key: getattr(rec, c.key) for c in model_class.__table__.columns}
                        remote_objs.append(model_class(**attrs))
                    
                    # 4. Bulk insert into remote database
                    remote_db.add_all(remote_objs)
                    await remote_db.commit()
                    
                    table_duration = asyncio.get_event_loop().time() - table_start
                    logger.info(f"[Replication] Table '{table_name}' successfully synced in {table_duration:.2f} seconds.")

            await remote_engine.dispose()
            duration = asyncio.get_event_loop().time() - start_time
            logger.info(f"[Replication] DB Replication successfully completed in {duration:.2f} seconds!")

        except Exception as e:
            logger.error(f"[Replication] Critical database replication error: {e}", exc_info=True)


def trigger_replication_background():
    """Safe wrapper to fire the replication task asynchronously without blocking."""
    asyncio.create_task(replicate_sqlite_to_postgres())
