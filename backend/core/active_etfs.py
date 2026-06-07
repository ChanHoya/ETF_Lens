import logging
from sqlalchemy import select
from db.database import AsyncSessionLocal
from api.my_assets import get_my_portfolio

logger = logging.getLogger(__name__)

async def get_active_etf_codes() -> set[str]:
    """
    Get the set of active/monitored/portfolio ETF codes.
    Only these codes will be synced in the daily batch and yfinance cron jobs.
    """
    core_codes = {
        # Sector Flow Grid KOSPI/KOSDAQ
        "139260", "227540", "139220", "139270", "139240", "139290", "139250", "139230", "139280",
        "300640", "261070", "452440",
        # Space Sector
        "0167Z0", "0180V0", "0183J0", "0181L0",
        # Bio Sector
        "462900", "463050", "244580", "143860", "364970",
        # Semiconductor Sector
        "396500", "469150", "471990", "0195R0", "0195S0", "0193W0", "0193T0", "381180", "497570",
        # 10대 테마 Representative ETFs
        "466920", "449450", "434730", "487240", "305720", "455850", "228810", "228790", "300950"
    }

    # Fetch user's current KIS holdings dynamically
    try:
        async with AsyncSessionLocal() as db:
            portfolio = await get_my_portfolio(request=None, db=db)
            holdings = portfolio.get("kis_raw", {}).get("holdings", [])
            for h in holdings:
                code = h.get("code")
                if code and len(code) == 6 and code.isdigit():
                    core_codes.add(code)
    except Exception as e:
        logger.warning(f"[get_active_etf_codes] KIS portfolio fetch failed, using default core list: {e}")

    return core_codes
