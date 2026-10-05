"""
공통 하이브리드 시계열 엔진 (Hybrid Time-Series Engine)
- 과거 데이터: DB(ETFDailyPrice / BenchmarkPrice)에서 영구 보관 및 초고속 서빙
- 증분 수집 (Gap-fill): DB의 마지막 날짜(last_db_date)와 어제(yesterday) 사이에 결측이 있는 경우만 외부 API(FDR/yfinance)로 증분 수집 후 DB 커밋
- 실시간 병합 (Live Merge): 오늘 당일 시세는 DB에 쓰지 않고 실시간 시세(Naver/Yahoo)를 끝에 1개 포인트 병합하여 반환
"""

import asyncio
import logging
from datetime import datetime, timedelta, timezone as _tz
from typing import Dict, List, Optional, Any, Tuple
import pandas as pd
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, and_

from db.models import ETFDailyPrice, BenchmarkPrice, ETFMaster

logger = logging.getLogger(__name__)

# 한국 표준시 (KST = UTC+9)
_KST = _tz(timedelta(hours=9))


def _kst_now() -> datetime:
    return datetime.now(_KST)


def _kst_today() -> str:
    return _kst_now().strftime("%Y-%m-%d")


def _clean_ticker(ticker: str) -> str:
    """티커 공백 제거 및 대문자화"""
    return ticker.strip()


def _is_korean_asset(ticker: str) -> bool:
    """
    한국 주식/ETF 판별:
    - 6자리 숫자/문자 (예: '005930', '396500', '0195R0')
    - .KS 또는 .KQ 로 끝나는 경우
    """
    clean = _clean_ticker(ticker)
    if clean.endswith(".KS") or clean.endswith(".KQ"):
        return True
    if len(clean) == 6 and (clean.isalnum() or clean.isdigit()):
        return True
    return False


def _normalize_korean_code(ticker: str) -> str:
    """005930.KS -> 005930"""
    clean = _clean_ticker(ticker)
    if clean.endswith(".KS") or clean.endswith(".KQ"):
        return clean[:-3]
    return clean


async def fetch_live_price(ticker: str) -> Optional[float]:
    """
    한국 종목(Naver) 또는 미국/글로벌 지수(Yahoo)의 당일 실시간 현재가 조회
    """
    clean = _clean_ticker(ticker)
    if _is_korean_asset(clean):
        code = _normalize_korean_code(clean)
        try:
            # Naver 모바일 증권 API 활용
            import httpx
            url = f"https://m.stock.naver.com/api/stock/{code}/basic"
            async with httpx.AsyncClient(timeout=4.0) as client:
                res = await client.get(url, headers={"User-Agent": "Mozilla/5.0"})
                if res.status_code == 200:
                    data = res.json()
                    now_price_str = data.get("nowPrice") or data.get("closePrice")
                    if now_price_str:
                        return float(str(now_price_str).replace(",", ""))
        except Exception as e:
            logger.debug(f"[hybrid_series] Naver live price failed for {code}: {e}")

    # 미국 주식 / ETF / 글로벌 지수 (Yahoo Finance fast_info)
    try:
        import yfinance as yf
        ticker_obj = yf.Ticker(clean)
        # fast_info 우선
        fast_info = getattr(ticker_obj, "fast_info", None)
        if fast_info:
            price = getattr(fast_info, "last_price", None)
            if price and float(price) > 0:
                return float(price)

        # 1일 히스토리 fallback
        hist = await asyncio.to_thread(lambda: ticker_obj.history(period="1d"))
        if not hist.empty and "Close" in hist.columns:
            return float(hist["Close"].iloc[-1])
    except Exception as e:
        logger.debug(f"[hybrid_series] Yahoo live price failed for {clean}: {e}")

    return None


async def get_hybrid_daily_prices(
    ticker: str,
    db: AsyncSession,
    days: int = 3650,
    include_live: bool = True,
    is_etf_hint: Optional[bool] = None,
) -> Dict[str, Any]:
    """
    단일 종목/지수의 과거 시계열을 DB 기반 증분 수집 및 실시간 병합하여 반환.
    
    반환 딕셔너리:
    {
        "ticker": ticker,
        "dates": ["YYYY-MM-DD", ...],
        "prices": [123.4, ...],
        "last_price": float,
        "source": "db_hit" | "db_gapfilled" | "fresh_seeded"
    }
    """
    clean = _clean_ticker(ticker)
    is_kr = _is_korean_asset(clean)
    k_code = _normalize_korean_code(clean) if is_kr else clean

    now_kst = _kst_now()
    today_str = now_kst.strftime("%Y-%m-%d")
    today_date = now_kst.date()

    # 1. DB에서 기존 시계열 조회
    # ETFMaster 등록 여부 확인
    is_master_etf = False
    if is_etf_hint is True:
        is_master_etf = True
    elif is_etf_hint is False:
        is_master_etf = False
    elif is_kr:
        master_res = await db.execute(select(ETFMaster.code).where(ETFMaster.code == k_code))
        is_master_etf = master_res.scalar_one_or_none() is not None

    dates: List[str] = []
    prices: List[float] = []
    table_type = "etf" if is_master_etf else "benchmark"

    if is_master_etf:
        stmt = (
            select(ETFDailyPrice.date, ETFDailyPrice.close)
            .where(ETFDailyPrice.code == k_code)
            .order_by(ETFDailyPrice.date.asc())
        )
        rows = (await db.execute(stmt)).all()
        for r_date, r_close in rows:
            if r_close is not None:
                dates.append(r_date)
                prices.append(float(r_close))
    else:
        # BenchmarkPrice 테이블 조회 (해외주식, 글로벌지수, 국내 개별주식)
        # symbol 매칭: clean 또는 k_code
        lookup_symbol = k_code if is_kr else clean
        stmt = (
            select(BenchmarkPrice.date, BenchmarkPrice.close)
            .where(BenchmarkPrice.symbol == lookup_symbol)
            .order_by(BenchmarkPrice.date.asc())
        )
        rows = (await db.execute(stmt)).all()
        if not rows and is_kr and lookup_symbol != clean:
            # clean으로 재시도
            stmt = (
                select(BenchmarkPrice.date, BenchmarkPrice.close)
                .where(BenchmarkPrice.symbol == clean)
                .order_by(BenchmarkPrice.date.asc())
            )
            rows = (await db.execute(stmt)).all()
            lookup_symbol = clean

        for r_date, r_close in rows:
            if r_close is not None:
                dates.append(r_date)
                prices.append(float(r_close))

    source_status = "db_hit"

    # 2. Case A: DB에 데이터가 전혀 없음 (0건) -> 최초 1회 Full Seed
    if not dates:
        start_date = today_date - timedelta(days=days)
        start_str = start_date.strftime("%Y-%m-%d")
        end_str = today_str

        df = None
        if is_kr:
            try:
                import FinanceDataReader as fdr
                df = await asyncio.to_thread(fdr.DataReader, k_code, start_str, end_str)
            except Exception as e:
                logger.warning(f"[hybrid_series] FDR full seed failed for {k_code}: {e}")

        # FDR 실패 또는 해외/지수 종목인 경우 yfinance 사용
        if df is None or df.empty:
            try:
                import yfinance as yf
                yf_sym = clean if not is_kr else f"{k_code}.KS"
                raw_df = await asyncio.to_thread(
                    yf.download,
                    yf_sym,
                    start=start_str,
                    end=(now_kst + timedelta(days=1)).strftime("%Y-%m-%d"),
                    progress=False
                )
                if raw_df is not None and not raw_df.empty:
                    if isinstance(raw_df.columns, pd.MultiIndex):
                        if "Close" in raw_df.columns.get_level_values(0):
                            sub = raw_df["Close"]
                            s = sub.iloc[:, 0] if isinstance(sub, pd.DataFrame) else sub
                            df = pd.DataFrame({"Close": s})
                        elif "Close" in raw_df.columns.get_level_values(1):
                            s = raw_df.xs("Close", axis=1, level=1)
                            df = pd.DataFrame({"Close": s.iloc[:, 0] if isinstance(s, pd.DataFrame) else s})
                    else:
                        if "Close" in raw_df.columns:
                            df = pd.DataFrame({"Close": raw_df["Close"]})
                        elif "Adj Close" in raw_df.columns:
                            df = pd.DataFrame({"Close": raw_df["Adj Close"]})
            except Exception as e:
                logger.warning(f"[hybrid_series] yfinance full seed failed for {clean}: {e}")

        if df is not None and not df.empty and "Close" in df.columns:
            new_records = []
            dates.clear()
            prices.clear()
            for idx, row in df.iterrows():
                dt_str = str(idx.date())
                # 오늘 이전의 확정된 종가만 DB에 저장
                if dt_str < today_str:
                    val = float(row.get("Close") or 0.0)
                    if val > 0:
                        dates.append(dt_str)
                        prices.append(val)
                        if is_master_etf:
                            new_records.append(
                                ETFDailyPrice(code=k_code, date=dt_str, close=val, nav=val, disparity_rate=0.0)
                            )
                        else:
                            new_records.append(
                                BenchmarkPrice(symbol=k_code if is_kr else clean, date=dt_str, close=val)
                            )

            if new_records:
                try:
                    db.add_all(new_records)
                    await db.commit()
                    source_status = "fresh_seeded"
                    logger.info(f"[hybrid_series] {clean} DB에 {len(new_records)}건 초기 저장 완료")
                except Exception as e:
                    await db.rollback()
                    logger.error(f"[hybrid_series] {clean} DB 저장 롤백: {e}")

    # 3. Case B: DB에 데이터가 존재하지만 최근 데이터가 누락된 경우 -> Gap-fill 증분 수집
    elif dates:
        last_db_date_str = dates[-1]
        try:
            last_db_date = datetime.strptime(last_db_date_str, "%Y-%m-%d").date()
        except ValueError:
            last_db_date = today_date

        days_gap = (today_date - last_db_date).days
        # 마지막 저장일 이후 1일 초과 차이가 나고 평일이 포함된 경우 증분 조회
        if days_gap > 1:
            gap_start_str = (last_db_date + timedelta(days=1)).strftime("%Y-%m-%d")
            gap_end_str = today_str

            gap_df = None
            if is_kr:
                try:
                    import FinanceDataReader as fdr
                    gap_df = await asyncio.to_thread(fdr.DataReader, k_code, gap_start_str, gap_end_str)
                except Exception as e:
                    logger.debug(f"[hybrid_series] FDR gap-fill failed for {k_code}: {e}")

            if gap_df is None or gap_df.empty:
                try:
                    import yfinance as yf
                    yf_sym = clean if not is_kr else f"{k_code}.KS"
                    raw_gap = await asyncio.to_thread(
                        yf.download,
                        yf_sym,
                        start=gap_start_str,
                        end=(now_kst + timedelta(days=1)).strftime("%Y-%m-%d"),
                        progress=False
                    )
                    if raw_gap is not None and not raw_gap.empty:
                        if isinstance(raw_gap.columns, pd.MultiIndex):
                            if "Close" in raw_gap.columns.get_level_values(0):
                                sub = raw_gap["Close"]
                                s = sub.iloc[:, 0] if isinstance(sub, pd.DataFrame) else sub
                                gap_df = pd.DataFrame({"Close": s})
                            elif "Close" in raw_gap.columns.get_level_values(1):
                                s = raw_gap.xs("Close", axis=1, level=1)
                                gap_df = pd.DataFrame({"Close": s.iloc[:, 0] if isinstance(s, pd.DataFrame) else s})
                        else:
                            if "Close" in raw_gap.columns:
                                gap_df = pd.DataFrame({"Close": raw_gap["Close"]})
                except Exception as e:
                    logger.debug(f"[hybrid_series] yfinance gap-fill failed for {clean}: {e}")

            if gap_df is not None and not gap_df.empty and "Close" in gap_df.columns:
                gap_records = []
                for idx, row in gap_df.iterrows():
                    dt_str = str(idx.date())
                    # 오늘 이전의 과거일자만 DB에 증분 커밋
                    if dt_str > last_db_date_str and dt_str < today_str:
                        val = float(row.get("Close") or 0.0)
                        if val > 0 and dt_str not in dates:
                            dates.append(dt_str)
                            prices.append(val)
                            if is_master_etf:
                                gap_records.append(
                                    ETFDailyPrice(code=k_code, date=dt_str, close=val, nav=val, disparity_rate=0.0)
                                )
                            else:
                                gap_records.append(
                                    BenchmarkPrice(symbol=k_code if is_kr else clean, date=dt_str, close=val)
                                )

                if gap_records:
                    try:
                        db.add_all(gap_records)
                        await db.commit()
                        source_status = "db_gapfilled"
                        logger.info(f"[hybrid_series] {clean} Gap-fill 완료: +{len(gap_records)}영업일 DB 반영")
                    except Exception as e:
                        await db.rollback()
                        logger.error(f"[hybrid_series] {clean} Gap-fill DB 롤백: {e}")

    # 4. 당일 실시간 시세 병합 (Live Merge)
    if include_live and now_kst.date().weekday() < 5:
        live_price = await fetch_live_price(clean)
        if live_price and live_price > 0:
            if today_str not in dates:
                dates.append(today_str)
                prices.append(live_price)
            else:
                idx = dates.index(today_str)
                prices[idx] = live_price

    last_val = prices[-1] if prices else 0.0

    return {
        "ticker": clean,
        "dates": dates,
        "prices": prices,
        "last_price": last_val,
        "source": source_status,
        "count": len(dates),
    }


async def get_hybrid_daily_prices_batch(
    tickers: List[str],
    db: AsyncSession,
    days: int = 3650,
    include_live: bool = True,
) -> Dict[str, Dict[str, Any]]:
    """
    여러 티커의 하이브리드 시계열을 순차 조회하여 반환
    (SQLAlchemy 비동기 세션 충돌 방지를 위해 순차 실행)
    """
    results: Dict[str, Dict[str, Any]] = {}
    for t in tickers:
        try:
            res = await get_hybrid_daily_prices(
                ticker=t,
                db=db,
                days=days,
                include_live=include_live,
            )
            results[t] = res
        except Exception as e:
            logger.error(f"[hybrid_series_batch] Failed for {t}: {e}")
            results[t] = {"ticker": t, "dates": [], "prices": [], "last_price": 0.0, "source": "error"}
    return results
