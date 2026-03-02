import asyncio
import json
from apscheduler.schedulers.asyncio import AsyncIOScheduler
from agents.harvester.harvester import ETFHarvester
from datetime import datetime
from sqlalchemy import select
from db.database import AsyncSessionLocal
from db.models import ETFMaster, ETFDailyPrice, ETFHoldings, BenchmarkPrice

scheduler = AsyncIOScheduler()


async def sync_etf_batch():
    print(f"[{datetime.now()}] Starting massive ETF DB sync batch...")
    harvester = ETFHarvester()
    await harvester.initialize()
    if harvester.etf_list is None or harvester.etf_list.empty:
        print("Failed to load ETF list.")
        return

    # To avoid rate limits, we process concurrently with a semaphore
    sem = asyncio.Semaphore(10)

    async def process_code(code: str, name: str, issuer: str):
        async with sem:
            try:
                # Fetch fresh data skipping cache
                data = await harvester.fetch_naver_etf_data(
                    code, skip_holdings=False, skip_chart=False
                )

                async with AsyncSessionLocal() as db:
                    # 1. Upsert Master
                    result = await db.execute(
                        select(ETFMaster).where(ETFMaster.code == code)
                    )
                    master = result.scalars().first()
                    if not master:
                        master = ETFMaster(code=code)
                        db.add(master)

                    master.name = name
                    master.issuer = issuer
                    master.nav = data.get("market_data", {}).get("nav")
                    master.price = data.get("market_data", {}).get("price")
                    b_info = data.get("basic_info", {})
                    master.basic_info_json = json.dumps(b_info, ensure_ascii=False)

                    if "펀드보수" in b_info:
                        import re

                        fee_nums = re.findall(r"[\d\.]+", str(b_info["펀드보수"]))
                        if fee_nums:
                            master.tot_fee = float(fee_nums[0])
                    master.aum = b_info.get("순자산총액")

                    # 2. Upsert Daily Prices
                    # We can clear old prices and insert new ones to simplify for SQLite
                    await db.execute(
                        ETFHoldings.__table__.delete().where(ETFHoldings.code == code)
                    )
                    await db.execute(
                        ETFDailyPrice.__table__.delete().where(
                            ETFDailyPrice.code == code
                        )
                    )

                    prices = data.get("historical_data", {}).get("prices", [])
                    dates = data.get("historical_data", {}).get("dates", [])
                    price_objs = [
                        ETFDailyPrice(code=code, date=d, close=p)
                        for d, p in zip(dates, prices)
                    ]
                    db.add_all(price_objs)

                    # 3. Upsert Holdings
                    holdings_data = data.get("holdings", [])
                    holding_objs = [
                        ETFHoldings(code=code, ticker=h["ticker"], weight=h["weight"])
                        for h in holdings_data
                    ]
                    db.add_all(holding_objs)

                    await db.commit()
            except Exception as e:
                print(f"Error processing DB sync for {code}: {e}")

    codes_to_sync = harvester.etf_list[["Symbol", "Name"]].to_dict("records")
    # In prod we sync all
    tasks = [process_code(c["Symbol"], c["Name"], "Unknown") for c in codes_to_sync]
    await asyncio.gather(*tasks)

    # Sync benchmarks
    try:
        from api.router import cached_fdr_reader, fetch_yahoo_finance
        from datetime import timedelta
        import pandas as pd

        start_str = (datetime.now() - timedelta(days=3650)).strftime("%Y-%m-%d")

        async with AsyncSessionLocal() as db:
            await db.execute(BenchmarkPrice.__table__.delete())

            benchmarks = {
                "KS11": await cached_fdr_reader("KS11", start_str),
                "KQ11": await cached_fdr_reader("KQ11", start_str),
                "^GSPC": await fetch_yahoo_finance("^GSPC", 10),
                "^IXIC": await fetch_yahoo_finance("^IXIC", 10),
            }

            for symbol, df in benchmarks.items():
                if not df.empty:
                    price_objs = []
                    for dt_ts, row in df.iterrows():
                        dt_str = str(dt_ts.date())
                        price_objs.append(
                            BenchmarkPrice(
                                symbol=symbol, date=dt_str, close=row["Close"]
                            )
                        )
                    db.add_all(price_objs)

            await db.commit()
    except Exception as e:
        print(f"Error syncing benchmarks: {e}")

    await harvester.close()
    print(f"[{datetime.now()}] ETF DB sync completed.")


def setup_scheduler():
    # Run at 18:00 every day for big ETF DB sync
    scheduler.add_job(sync_etf_batch, "cron", hour=18, minute=0, id="daily_db_sync")

    # Run at 08:00 every day for morning briefing email and macro data updates
    from scheduler.daily_fetch import run_morning_briefing

    scheduler.add_job(
        run_morning_briefing, "cron", hour=8, minute=0, id="morning_briefing_email"
    )

    # For dev testing, uncomment to run immediately
    # scheduler.add_job(sync_etf_batch, next_run_time=datetime.now())
    # scheduler.add_job(run_morning_briefing, next_run_time=datetime.now())

    scheduler.start()
    print("DB and Email Scheduler started.")
