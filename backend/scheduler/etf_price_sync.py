"""
ETF 시세 경량 배치 수집 스크립트
- yfinance로 KRX 전체 ETF 최근 1년 종가 수집
- ETFDailyPrice 테이블에 upsert
- 실행: 매일 18:30 (scheduler.py에서 호출)
"""
from __future__ import annotations

import asyncio
import logging
from datetime import datetime, timedelta

logger = logging.getLogger(__name__)

BATCH_SIZE = 30          # yfinance 동시 티커 수 (50→30: 메모리 절감)
SEMAPHORE_LIMIT = 2      # 동시 배치 실행 수 (3→2: 동시 pandas DataFrame 감소)
RETRY_LIMIT = 2          # 실패 시 재시도


async def sync_etf_prices_yfinance() -> int:
    """
    pykrx로 ETF 목록 수집 → yfinance로 최근 1년 종가 배치 다운로드 → DB 저장.
    메모리 절감: 배치마다 즉시 DB 저장 후 데이터 해제 (전체 누적 방식 제거).
    반환값: 성공적으로 저장된 ETF 종목 수
    """
    from db.database import AsyncSessionLocal
    from db.models import ETFMaster, ETFDailyPrice
    from sqlalchemy import select, delete

    # 1. KRX ETF 목록 수집 (pykrx → 네이버API → DB fallback)
    tickers_krx: list[str] = []

    # 1순위: pykrx
    try:
        from pykrx import stock as krx_stock
        today = datetime.now().strftime("%Y%m%d")
        tickers_krx = await asyncio.to_thread(krx_stock.get_etf_ticker_list, today)
        if not tickers_krx:
            for delta in range(1, 5):
                prev = (datetime.now() - timedelta(days=delta)).strftime("%Y%m%d")
                tickers_krx = await asyncio.to_thread(krx_stock.get_etf_ticker_list, prev)
                if tickers_krx:
                    break
        if tickers_krx:
            logger.info(f"[ETF Price Sync] pykrx ETF 목록: {len(tickers_krx)}개")
    except Exception as e:
        logger.warning(f"[ETF Price Sync] pykrx 목록 조회 실패: {e}")

    # 2순위: 네이버 증권 ETF 목록 API (~1075개, pykrx보다 안정적)
    if not tickers_krx:
        try:
            import requests as _req
            resp = await asyncio.to_thread(
                lambda: _req.get(
                    "https://finance.naver.com/api/sise/etfItemList.nhn",
                    headers={"User-Agent": "Mozilla/5.0 (compatible; ETFLens/1.0)"},
                    timeout=15,
                )
            )
            items = resp.json().get("result", {}).get("etfItemList", [])
            tickers_krx = [
                str(item.get("itemcode", "")).zfill(6)
                for item in items if item.get("itemcode")
            ]
            if tickers_krx:
                logger.info(f"[ETF Price Sync] 네이버 API fallback: {len(tickers_krx)}개")
        except Exception as e:
            logger.warning(f"[ETF Price Sync] 네이버 API 조회 실패: {e}")

    # 3순위: DB에서 코드 목록 사용
    if not tickers_krx:
        async with AsyncSessionLocal() as db:
            rows = (await db.execute(select(ETFMaster.code))).scalars().all()
            tickers_krx = list(rows)
        logger.info(f"[ETF Price Sync] DB fallback: {len(tickers_krx)}개 코드")

    # 4순위/필터: 모니터링/포트폴리오 대상 active ETF들만 동기화 하도록 필터링 (OOM 방지)
    from core.active_etfs import get_active_etf_codes
    active_codes = await get_active_etf_codes()
    if tickers_krx:
        tickers_krx = [t for t in tickers_krx if t in active_codes]
    else:
        tickers_krx = list(active_codes)

    if not tickers_krx:
        logger.error("[ETF Price Sync] ETF 목록을 가져올 수 없습니다. 중단.")
        return 0


    # 2. yfinance 배치 다운로드 + 즉시 DB 저장 (메모리 스트리밍 방식)
    import yfinance as yf

    yf_tickers = [f"{t.zfill(6)}.KS" for t in tickers_krx]
    batches = [yf_tickers[i:i + BATCH_SIZE] for i in range(0, len(yf_tickers), BATCH_SIZE)]
    sem = asyncio.Semaphore(SEMAPHORE_LIMIT)

    # 날짜 범위: 최근 1년
    end_date = datetime.now().strftime("%Y-%m-%d")
    start_date = (datetime.now() - timedelta(days=380)).strftime("%Y-%m-%d")

    saved_codes = 0

    async def fetch_and_save_batch(batch: list[str]) -> None:
        """배치 다운로드 → 즉시 DB 저장 → 메모리 해제 (누적 없음)"""
        nonlocal saved_codes
        async with sem:
            for attempt in range(RETRY_LIMIT + 1):
                try:
                    raw = await asyncio.to_thread(
                        yf.download,
                        batch,
                        start=start_date,
                        end=end_date,
                        progress=False,
                        auto_adjust=True,
                    )
                    if raw is None or raw.empty:
                        return

                    import pandas as pd

                    # 배치 내 코드별 price 딕셔너리 수집
                    batch_by_code: dict[str, list[dict]] = {}

                    if isinstance(raw.columns, pd.MultiIndex):
                        lvl0 = raw.columns.get_level_values(0).unique().tolist()
                        price_fields = {"Close", "Open", "High", "Low", "Volume"}
                        if any(v in price_fields for v in lvl0):
                            if "Close" in lvl0:
                                close_df = raw["Close"]
                                for col in close_df.columns:
                                    code = str(col).replace(".KS", "").zfill(6)
                                    series = close_df[col].dropna()
                                    batch_by_code[code] = [
                                        {"date": str(dt.date()), "close": float(price)}
                                        for dt, price in series.items() if float(price) > 0
                                    ]
                        else:
                            for ticker in batch:
                                if ticker not in lvl0:
                                    continue
                                try:
                                    series = raw[ticker]["Close"].dropna()
                                except Exception:
                                    continue
                                code = ticker.replace(".KS", "").zfill(6)
                                batch_by_code[code] = [
                                    {"date": str(dt.date()), "close": float(price)}
                                    for dt, price in series.items() if float(price) > 0
                                ]
                    elif "Close" in raw.columns:
                        code = batch[0].replace(".KS", "").zfill(6)
                        batch_by_code[code] = [
                            {"date": str(dt.date()), "close": float(price)}
                            for dt, price in raw["Close"].dropna().items() if float(price) > 0
                        ]

                    # pandas 메모리 즉시 해제
                    del raw

                    # DB 저장 (배치 단위로 바로 flush)
                    if batch_by_code:
                        async with AsyncSessionLocal() as db:
                            for code, price_rows in batch_by_code.items():
                                if not price_rows:
                                    continue
                                try:
                                    await db.execute(
                                        delete(ETFDailyPrice)
                                        .where(ETFDailyPrice.code == code)
                                        .where(ETFDailyPrice.date >= start_date)
                                    )
                                    db.add_all([
                                        ETFDailyPrice(code=code, date=r["date"], close=r["close"])
                                        for r in price_rows
                                    ])
                                    saved_codes += 1
                                except Exception as e:
                                    logger.warning(f"[ETF Price Sync] {code} DB 저장 오류: {e}")
                            await db.commit()

                    return
                except Exception as e:
                    if attempt < RETRY_LIMIT:
                        await asyncio.sleep(2 ** attempt)
                    else:
                        logger.warning(f"[ETF Price Sync] 배치 실패 (재시도 {attempt}): {e}")

    logger.info(f"[ETF Price Sync] {len(batches)}개 배치 다운로드+저장 시작 (스트리밍 방식)...")
    await asyncio.gather(*[fetch_and_save_batch(b) for b in batches])

    logger.info(f"[ETF Price Sync] 완료: {saved_codes}개 종목 저장")
    return saved_codes


async def sync_user_holdings_prices_job() -> dict:
    """
    매일 야간(23:15 KST 등) 사용자 보유 종목, 수동 등록 자산, AUM 상위 주요 ETF 및 4대 벤치마크 지수의 
    최근 일봉 종가를 DB에 증분 수집 및 영속화하여, 포트폴리오 백테스트 및 최적화 조회 시 0ms 응답을 보장.
    """
    from db.database import AsyncSessionLocal
    from db.models import ETFMaster, ManualAsset
    from core.hybrid_series import get_hybrid_daily_prices
    from sqlalchemy import select, text
    import yfinance as yf
    import pandas as pd

    logger.info("[Holdings Price Sync] 야간 보유 종목 및 벤치마크 지수 증분 동기화 시작...")
    stats = {"benchmarks": 0, "holdings": 0, "errors": 0}

    # 1. 4대 벤치마크 지수 동기화 (^KS11, ^KQ11, ^GSPC, ^IXIC)
    benchmarks = {
        "^KS11": ["KS11", "^KS11"],
        "^KQ11": ["KQ11", "^KQ11"],
        "^GSPC": ["^GSPC"],
        "^IXIC": ["^IXIC"],
    }
    
    start_date = (datetime.now() - timedelta(days=30)).strftime("%Y-%m-%d")
    end_date = datetime.now().strftime("%Y-%m-%d")

    async with AsyncSessionLocal() as db:
        # UNIQUE 인덱스 생성 보장 (없을 경우 ON CONFLICT 오류 방지)
        try:
            await db.execute(text("CREATE UNIQUE INDEX IF NOT EXISTS uq_benchmark_symbol_date ON benchmark_prices (symbol, date)"))
            await db.commit()
        except Exception:
            pass

        for yf_sym, db_syms in benchmarks.items():
            try:
                df = await asyncio.to_thread(
                    yf.download,
                    yf_sym,
                    start=start_date,
                    end=end_date,
                    progress=False,
                    auto_adjust=True,
                )
                if df is not None and not df.empty:
                    close_col = None
                    if isinstance(df.columns, pd.MultiIndex):
                        if "Close" in df.columns.get_level_values(0):
                            close_col = df["Close"].iloc[:, 0].dropna()
                    elif "Close" in df.columns:
                        close_col = df["Close"].dropna()
                    elif "Adj Close" in df.columns:
                        close_col = df["Adj Close"].dropna()

                    if close_col is not None and not close_col.empty:
                        for dt, price in close_col.items():
                            d_str = dt.strftime("%Y-%m-%d") if hasattr(dt, "strftime") else str(dt)[:10]
                            p_float = float(price)
                            for sym in db_syms:
                                await db.execute(
                                    text(
                                        "INSERT INTO benchmark_prices (symbol, date, close) "
                                        "VALUES (:symbol, :date, :close) "
                                        "ON CONFLICT(symbol, date) DO UPDATE SET close=excluded.close"
                                    ),
                                    {"symbol": sym, "date": d_str, "close": p_float}
                                )
                        stats["benchmarks"] += 1
                        await db.commit()
            except Exception as e:
                logger.warning(f"[Holdings Price Sync] 벤치마크 {yf_sym} 동기화 실패: {e}")
                stats["errors"] += 1

    # 2. 사용자 보유 종목 및 수동 자산 티커 수집
    target_tickers = set()
    async with AsyncSessionLocal() as db:
        try:
            res_manual = await db.execute(select(ManualAsset.ticker).where(ManualAsset.ticker.isnot(None)))
            for row in res_manual.fetchall():
                t = str(row[0]).strip()
                if t:
                    target_tickers.add(t)
        except Exception as e:
            logger.warning(f"[Holdings Price Sync] ManualAsset 조회 에러: {e}")

        try:
            res_master = await db.execute(
                select(ETFMaster.code)
                .where(ETFMaster.aum.isnot(None))
                .order_by(ETFMaster.aum.desc())
                .limit(30)
            )
            for row in res_master.fetchall():
                c = str(row[0]).strip()
                if c:
                    target_tickers.add(c)
        except Exception as e:
            logger.warning(f"[Holdings Price Sync] ETFMaster 조회 에러: {e}")

    default_majors = ["069500", "360750", "133690", "379800", "379810", "488770", "396500", "102110", "459580", "448290"]
    for m in default_majors:
        target_tickers.add(m)

    # 3. get_hybrid_daily_prices 를 통해 최근 데이터 gap-fill 및 캐싱
    for ticker in list(target_tickers):
        try:
            async with AsyncSessionLocal() as db:
                await get_hybrid_daily_prices(ticker, db, days=365, include_live=False)
                stats["holdings"] += 1
        except Exception as e:
            logger.warning(f"[Holdings Price Sync] 티커 {ticker} 증분 동기화 실패: {e}")
            stats["errors"] += 1

    logger.info(f"[Holdings Price Sync] 완료: 벤치마크 {stats['benchmarks']}개, 종목 {stats['holdings']}개")
    return stats


