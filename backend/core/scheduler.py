import asyncio
import json
from apscheduler.schedulers.asyncio import AsyncIOScheduler
import pytz
from agents.harvester.harvester import ETFHarvester
from datetime import datetime
from sqlalchemy import select
from db.database import AsyncSessionLocal
from db.models import ETFMaster, ETFDailyPrice, ETFHoldings, BenchmarkPrice, AppVersion

# KST 기준으로 cron job 실행 (UTC 사용 시 hour=7이 KST 16시가 됨)
scheduler = AsyncIOScheduler(timezone=pytz.timezone('Asia/Seoul'))


async def update_app_version(job_label: str = "") -> None:
    """
    스케줄러 job 완료 시 AppVersion 테이블에 KST yymmddhhmm 버전을 저장.
    job_label: 어떤 job이 마지막으로 실행됐는지 표시 (예: '[master]', '[perf]')
    """
    from datetime import timezone, timedelta as _td
    _kst = timezone(_td(hours=9))
    kst_now = datetime.now(_kst)
    version_str = kst_now.strftime("VER %y%m%d%H%M")
    if job_label:
        version_str += f" {job_label}"
    try:
        async with AsyncSessionLocal() as db:
            result = await db.execute(select(AppVersion).where(AppVersion.key == "app_version"))
            rec = result.scalars().first()
            if rec:
                rec.value = version_str
                rec.updated_at = kst_now.replace(tzinfo=None)
            else:
                db.add(AppVersion(key="app_version", value=version_str))
            await db.commit()
        print(f"[AppVersion] 업데이트: {version_str}")
    except Exception as e:
        print(f"[AppVersion] 업데이트 실패: {e}")


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
    from scheduler.etf_price_sync import sync_etf_prices_yfinance
    from core.etf_performance import update_all_etf_performance_job

    # wrapper: 각 job 완료 후 버전 자동 업데이트
    async def _job_master():
        await sync_etf_master_list()
        await update_app_version("[master]")

    async def _job_batch():
        await sync_etf_batch()
        await update_app_version("[batch]")

    async def _job_price():
        await sync_etf_prices_yfinance()
        await update_app_version("[price]")

    async def _job_perf():
        await update_all_etf_performance_job()
        await update_app_version("[perf]")

    # 07:00 - 경량 ETF 마스터 목록 upsert
    scheduler.add_job(_job_master, "cron", hour=7, minute=0, id="daily_etf_master_sync")

    # 18:00 - 무거운 ETF 전체 sync (가격/보유종목 포함)
    scheduler.add_job(_job_batch, "cron", hour=18, minute=0, id="daily_db_sync")

    # 18:30 - yfinance 경량 시세 배치 수집 (1년치 종가 → ETFDailyPrice)
    scheduler.add_job(_job_price, "cron", hour=18, minute=30, id="daily_etf_price_yfinance")

    # 19:00 - ETF 수익률/변동성/샤프 계산 → ETFMaster 업데이트
    scheduler.add_job(_job_perf, "cron", hour=19, minute=0, id="daily_perf_calc")

    scheduler.start()
    print("DB and Email Scheduler started.")

