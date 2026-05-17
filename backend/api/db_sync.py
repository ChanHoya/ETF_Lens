import logging
from fastapi import APIRouter, BackgroundTasks, HTTPException
from sqlalchemy import select, func
from db.database import AsyncSessionLocal as LocalSession
from core.db_replicator import (
    replicate_sqlite_to_postgres,
    _replication_lock,
    get_remote_db_url
)
from db.models import (
    AppVersion, UserPrincipal, SharedPortfolio, BenchmarkPrice,
    ETFMaster, ETFEvaluation, ETFDailyPrice, ETFHoldings
)
from sqlalchemy.ext.asyncio import create_async_engine, AsyncSession, async_sessionmaker

logger = logging.getLogger(__name__)
router = APIRouter()

@router.get("/status")
async def get_sync_status():
    """
    Check the connection status and lock state of SQLite and remote Render PostgreSQL databases.
    """
    remote_url = get_remote_db_url()
    
    status = {
        "local_sqlite": "connected",
        "remote_postgresql": "configured" if remote_url else "not_configured",
        "sync_active": _replication_lock.locked(),
    }
    
    if remote_url:
        try:
            # Quick check to verify postgres connection
            remote_engine = create_async_engine(
                remote_url,
                echo=False,
                connect_args={"timeout": 5} # Fast timeout for ping
            )
            async with remote_engine.connect() as conn:
                await conn.execute(select(1))
            status["remote_postgresql"] = "connected"
            await remote_engine.dispose()
        except Exception as e:
            status["remote_postgresql"] = f"connection_failed: {str(e)[:100]}"
            
    return status


@router.post("/trigger")
async def trigger_sync(background_tasks: BackgroundTasks):
    """
    Triggers database replication from SQLite to PostgreSQL in the background.
    """
    remote_url = get_remote_db_url()
    if not remote_url:
        raise HTTPException(
            status_code=400,
            detail="Remote database URL (RENDER_DATABASE_URL) is not configured in the environment."
        )
        
    if _replication_lock.locked():
        return {
            "status": "skipped",
            "message": "A database synchronization job is already in progress."
        }
        
    # Queue the task non-blockingly
    background_tasks.add_task(replicate_sqlite_to_postgres)
    
    return {
        "status": "initiated",
        "message": "Database synchronization from SQLite to remote PostgreSQL has been started in the background."
    }


@router.get("/verify")
async def verify_database_integrity():
    """
    Compares the row counts of all primary tables between the local SQLite database 
    and the remote Render Managed PostgreSQL database to ensure absolute parity.
    """
    remote_url = get_remote_db_url()
    if not remote_url:
        raise HTTPException(
            status_code=400,
            detail="Remote database URL (RENDER_DATABASE_URL) is not configured in the environment."
        )
        
    tables_to_verify = [
        (AppVersion, "app_version"),
        (UserPrincipal, "user_principal"),
        (SharedPortfolio, "shared_portfolios"),
        (BenchmarkPrice, "benchmark_prices"),
        (ETFMaster, "etf_master"),
        (ETFEvaluation, "etf_evaluation"),
        (ETFDailyPrice, "etf_daily_prices"),
        (ETFHoldings, "etf_holdings"),
    ]
    
    comparison = {}
    total_parity = True
    
    try:
        # Connect to remote PostgreSQL
        remote_engine = create_async_engine(
            remote_url,
            echo=False,
            connect_args={"timeout": 15}
        )
        RemoteSession = async_sessionmaker(
            bind=remote_engine, class_=AsyncSession, expire_on_commit=False
        )
        
        async with LocalSession() as local_db, RemoteSession() as remote_db:
            for model_class, table_name in tables_to_verify:
                # Count local
                local_count_res = await local_db.execute(select(func.count()).select_from(model_class))
                local_count = local_count_res.scalar() or 0
                
                # Count remote
                remote_count = 0
                try:
                    remote_count_res = await remote_db.execute(select(func.count()).select_from(model_class))
                    remote_count = remote_count_res.scalar() or 0
                except Exception as table_err:
                    logger.warning(f"Failed to query remote table {table_name}: {table_err}")
                    remote_count = -1
                
                parity = local_count == remote_count
                if not parity:
                    total_parity = False
                    
                comparison[table_name] = {
                    "local_sqlite_rows": local_count,
                    "remote_postgresql_rows": remote_count if remote_count >= 0 else "table_not_found",
                    "parity": parity
                }
                
        await remote_engine.dispose()
        
    except Exception as e:
        raise HTTPException(
            status_code=500,
            detail=f"Database parity check failed: {str(e)}"
        )
        
    return {
        "status": "ok" if total_parity else "mismatch",
        "all_tables_in_sync": total_parity,
        "comparison": comparison
    }
