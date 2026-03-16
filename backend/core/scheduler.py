import asyncio
import json
from apscheduler.schedulers.asyncio import AsyncIOScheduler
from agents.harvester.harvester import ETFHarvester
from datetime import datetime
from sqlalchemy import select
from db.database import AsyncSessionLocal
from db.models import ETFMaster, ETFDailyPrice, ETFHoldings, BenchmarkPrice

scheduler = AsyncIOScheduler()


async def sync_etf_master_list():
    """
    KRX에서 ETF 전체 코드+이름+운용사 목록을 가져와 ETFMaster에 upsert합니다.
    pykrx (1순위) → fdr.StockListing (2순위) 방식으로 시도합니다.
    매일 07:00에 실행 (경량 작업, 보통 1분 이내 완료).
    """
    print(f"[{datetime.now()}] [ETF Master Sync] Starting KRX ETF list sync...")
    rows: list[dict] = []

    # --- 1순위: pykrx (KRX 공식) ---
    try:
        from pykrx import stock as krx_stock  # type: ignore
        date_str = datetime.now().strftime("%Y%m%d")
        tickers = await asyncio.to_thread(krx_stock.get_etf_ticker_list, date_str)
        if not tickers:
            # 주말/공휴일엔 빈 목록 → 직전 금요일로 재시도
            from datetime import timedelta
            for delta in range(1, 5):
                prev = (datetime.now() - timedelta(days=delta)).strftime("%Y%m%d")
                tickers = await asyncio.to_thread(krx_stock.get_etf_ticker_list, prev)
                if tickers:
                    date_str = prev
                    break

        for ticker in tickers:
            try:
                name = await asyncio.to_thread(krx_stock.get_etf_ticker_name, ticker)
                rows.append({"code": ticker.zfill(6), "name": name, "issuer": ""})
            except Exception:
                pass

        print(f"[ETF Master Sync] pykrx: {len(rows)} ETFs loaded (date={date_str})")
    except Exception as e:
        print(f"[ETF Master Sync] pykrx failed: {e}")

    # --- 2순위: finance_datareader ---
    if not rows:
        try:
            import finance_datareader as fdr  # type: ignore
            df = await asyncio.to_thread(fdr.StockListing, "ETF/KR")
            for _, row in df.iterrows():
                code = str(row.get("Symbol", row.get("Code", ""))).strip().zfill(6)
                name = str(row.get("Name", "")).strip()
                if code and name and len(code) == 6:
                    rows.append({"code": code, "name": name, "issuer": ""})
            print(f"[ETF Master Sync] fdr fallback: {len(rows)} ETFs loaded")
        except Exception as e:
            print(f"[ETF Master Sync] fdr also failed: {e}")

    if not rows:
        print("[ETF Master Sync] No ETF data retrieved. Skipping DB update.")
        return

    # --- DB Upsert ---
    async with AsyncSessionLocal() as db:
        upserted = 0
        for item in rows:
            try:
                result = await db.execute(
                    select(ETFMaster).where(ETFMaster.code == item["code"])
                )
                master = result.scalars().first()
                if not master:
                    master = ETFMaster(code=item["code"])
                    db.add(master)
                master.name = item["name"]
                if item.get("issuer"):
                    master.issuer = item["issuer"]
                upserted += 1
            except Exception as e:
                print(f"[ETF Master Sync] upsert error {item['code']}: {e}")
        await db.commit()

    print(f"[{datetime.now()}] [ETF Master Sync] Done. {upserted} ETFs upserted.")


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
                        ETFHoldings(
                            code=code,
                            ticker=h["ticker"],
                            weight=h["weight"],
                            shares=h.get("shares"),
                        )
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
    # 07:00 - 경량 ETF 마스터 목록 upsert (코드+이름, pykrx → fdr fallback)
    scheduler.add_job(
        sync_etf_master_list, "cron", hour=7, minute=0, id="daily_etf_master_sync"
    )

    # 18:00 - 무거운 ETF 전체 sync (가격/보유종목 포함)
    scheduler.add_job(sync_etf_batch, "cron", hour=18, minute=0, id="daily_db_sync")

    # 08:00 - Morning briefing email + macro data update
    from scheduler.daily_fetch import run_morning_briefing

    scheduler.add_job(
        run_morning_briefing, "cron", hour=8, minute=0, id="morning_briefing_email"
    )

    scheduler.start()
    print("DB and Email Scheduler started.")

