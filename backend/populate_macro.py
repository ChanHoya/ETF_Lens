import asyncio
import pandas as pd
from datetime import datetime, timedelta
from db.database import AsyncSessionLocal
from db.models import MarketMacroLog
from api.exit_signal import (
    _fetch_fred_series,
    _fetch_yahoo_v8,
    get_pe_detail,
    _kst_now,
    fetch_market_sentiment
)
from sqlalchemy import select, delete

async def populate_market_macro():
    async with AsyncSessionLocal() as db:
        print("Clearing old macro data...")
        await db.execute(delete(MarketMacroLog))
        await db.commit()

        print("Fetching data...")
        dx_dict, krw_dict, t10y2y_dict, hy_dict = await asyncio.gather(
            _fetch_fred_series("DTWEXBGS", days=3700),
            _fetch_yahoo_v8("KRW=X", days=3700),
            _fetch_fred_series("T10Y2Y", days=3700),
            _fetch_fred_series("BAMLH0A0HYM2", days=3700),
        )
        
        # PE and CLI are harder because CLI is returned by get_cli_detail or fetch_fred_cli
        # For now, let's just insert dx, krw, t10y2y, hy.
        # Collect all dates
        all_dates = sorted(set(dx_dict) | set(krw_dict) | set(t10y2y_dict) | set(hy_dict))
        
        records = []
        last_dx, last_krw, last_t, last_hy = None, None, None, None
        
        for d in all_dates:
            last_dx = dx_dict.get(d, last_dx)
            last_krw = krw_dict.get(d, last_krw)
            last_t = t10y2y_dict.get(d, last_t)
            last_hy = hy_dict.get(d, last_hy)
            
            records.append(MarketMacroLog(
                date=d,
                dollar_index=last_dx,
                krw=last_krw,
                t10y2y=last_t,
                hy_spread=last_hy
            ))
            
        print(f"Inserting {len(records)} records...")
        db.add_all(records)
        await db.commit()
        print("Done!")

if __name__ == "__main__":
    asyncio.run(populate_market_macro())
