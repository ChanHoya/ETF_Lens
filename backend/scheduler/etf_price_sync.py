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

BATCH_SIZE = 50          # yfinance 동시 티커 수
SEMAPHORE_LIMIT = 3      # 동시 배치 실행 수
RETRY_LIMIT = 2          # 실패 시 재시도


async def sync_etf_prices_yfinance() -> int:
    """
    pykrx로 ETF 목록 수집 → yfinance로 최근 1년 종가 배치 다운로드 → DB 저장.
    반환값: 성공적으로 저장된 ETF 종목 수
    """
    from db.database import AsyncSessionLocal
    from db.models import ETFMaster, ETFDailyPrice
    from sqlalchemy import select, delete

    # 1. KRX ETF 목록 수집
    tickers_krx: list[str] = []
    try:
        from pykrx import stock as krx_stock
        today = datetime.now().strftime("%Y%m%d")
        tickers_krx = await asyncio.to_thread(krx_stock.get_etf_ticker_list, today)
        if not tickers_krx:
            # 주말/공휴일 → 직전 영업일
            for delta in range(1, 5):
                prev = (datetime.now() - timedelta(days=delta)).strftime("%Y%m%d")
                tickers_krx = await asyncio.to_thread(krx_stock.get_etf_ticker_list, prev)
                if tickers_krx:
                    break
        logger.info(f"[ETF Price Sync] pykrx ETF 목록: {len(tickers_krx)}개")
    except Exception as e:
        logger.warning(f"[ETF Price Sync] pykrx 목록 조회 실패: {e}")

    if not tickers_krx:
        # fallback: DB에서 코드 목록 사용
        async with AsyncSessionLocal() as db:
            rows = (await db.execute(select(ETFMaster.code))).scalars().all()
            tickers_krx = list(rows)
        logger.info(f"[ETF Price Sync] DB fallback: {len(tickers_krx)}개 코드")

    if not tickers_krx:
        logger.error("[ETF Price Sync] ETF 목록을 가져올 수 없습니다. 중단.")
        return 0

    # 2. yfinance 배치 다운로드
    import yfinance as yf

    yf_tickers = [f"{t.zfill(6)}.KS" for t in tickers_krx]
    batches = [yf_tickers[i:i + BATCH_SIZE] for i in range(0, len(yf_tickers), BATCH_SIZE)]
    sem = asyncio.Semaphore(SEMAPHORE_LIMIT)

    # 날짜 범위: 최근 1년
    end_date = datetime.now().strftime("%Y-%m-%d")
    start_date = (datetime.now() - timedelta(days=380)).strftime("%Y-%m-%d")

    all_price_rows: list[dict] = []  # {"code": str, "date": str, "close": float}

    async def fetch_batch(batch: list[str]) -> None:
        async with sem:
            for attempt in range(RETRY_LIMIT + 1):
                try:
                    raw = await asyncio.to_thread(
                        yf.download,
                        " ".join(batch),
                        start=start_date,
                        end=end_date,
                        progress=False,
                        auto_adjust=True,
                        group_by="ticker",
                    )
                    if raw.empty:
                        return

                    # MultiIndex 처리
                    import pandas as pd
                    if isinstance(raw.columns, pd.MultiIndex):
                        for ticker in batch:
                            if ticker not in raw.columns.get_level_values(0):
                                continue
                            series = raw[ticker]["Close"].dropna()
                            code = ticker.replace(".KS", "").zfill(6)
                            for dt, price in series.items():
                                if price > 0:
                                    all_price_rows.append({
                                        "code": code,
                                        "date": str(dt.date()),
                                        "close": float(price),
                                    })
                    else:
                        # 단일 티커
                        if "Close" in raw.columns:
                            code = batch[0].replace(".KS", "").zfill(6)
                            for dt, price in raw["Close"].dropna().items():
                                if price > 0:
                                    all_price_rows.append({
                                        "code": code,
                                        "date": str(dt.date()),
                                        "close": float(price),
                                    })
                    return
                except Exception as e:
                    if attempt < RETRY_LIMIT:
                        await asyncio.sleep(2 ** attempt)
                    else:
                        logger.warning(f"[ETF Price Sync] 배치 실패 (재시도 {attempt}): {e}")

    logger.info(f"[ETF Price Sync] {len(batches)}개 배치 다운로드 시작...")
    await asyncio.gather(*[fetch_batch(b) for b in batches])
    logger.info(f"[ETF Price Sync] 수집 완료: {len(all_price_rows):,}개 가격 레코드")

    if not all_price_rows:
        logger.error("[ETF Price Sync] 수집된 데이터 없음. DB 저장 생략.")
        return 0

    # 3. DB 저장 (코드별 upsert: 기존 삭제 후 재삽입)
    from collections import defaultdict
    by_code: dict[str, list[dict]] = defaultdict(list)
    for row in all_price_rows:
        by_code[row["code"]].append(row)

    saved_codes = 0
    async with AsyncSessionLocal() as db:
        for code, rows in by_code.items():
            try:
                # 기존 1년치 가격 삭제 후 재삽입 (중복 방지)
                await db.execute(
                    delete(ETFDailyPrice)
                    .where(ETFDailyPrice.code == code)
                    .where(ETFDailyPrice.date >= start_date)
                )
                db.add_all([
                    ETFDailyPrice(code=r["code"], date=r["date"], close=r["close"])
                    for r in rows
                ])
                saved_codes += 1
            except Exception as e:
                logger.warning(f"[ETF Price Sync] {code} DB 저장 오류: {e}")
        await db.commit()

    logger.info(f"[ETF Price Sync] DB 저장 완료: {saved_codes}개 종목")
    return saved_codes
