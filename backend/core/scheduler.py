from apscheduler.schedulers.asyncio import AsyncIOScheduler
from agents.harvester.harvester import ETFHarvester
from datetime import datetime

scheduler = AsyncIOScheduler()


async def hourly_batch_update():
    print(f"[{datetime.now()}] Starting hourly batch update...")
    # This would aggregate data for multiple ETFs.
    # We will instantiate the Harvester and fetch items.
    harvester = ETFHarvester()
    await harvester.initialize()
    # Dummy list of ETFs to fetch
    etf_list = ["453850", "462330", "360750"]
    for code in etf_list:
        try:
            await harvester.fetch_naver_etf_data(code)
        except Exception as e:
            print(f"Error fetching {code}: {e}")

    await harvester.close()
    print(f"[{datetime.now()}] Hourly batch update completed.")


async def daily_closing_update():
    print(f"[{datetime.now()}] Starting daily 18:00 closing update...")
    # This task is intended to run at 18:00 every day
    # to capture and finalize the day's closing data.
    harvester = ETFHarvester()
    await harvester.initialize()
    # E.g. fetch entire market
    await harvester.close()
    print(f"[{datetime.now()}] Daily closing update completed.")


def setup_scheduler():
    # 1시간 주기로 실행
    scheduler.add_job(hourly_batch_update, "interval", hours=1, id="hourly_batch")
    # 매일 18시에 실행
    scheduler.add_job(
        daily_closing_update, "cron", hour=18, minute=0, id="daily_closing"
    )

    scheduler.start()
    print("Scheduler started.")
