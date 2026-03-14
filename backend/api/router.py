from fastapi import APIRouter, Depends
from pydantic import BaseModel
from typing import List
from agents.harvester.harvester import ETFHarvester
from agents.quant.quant import ETFQuant
import logging
import json
import asyncio
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select
from db.database import get_db
from db.models import SimulationHistory, ETFEvaluation, ETFMaster
import FinanceDataReader as fdr
from datetime import datetime, timedelta

# Set up logging
logger = logging.getLogger(__name__)

router = APIRouter(prefix="/analyze", tags=["analyze"])

# Global cache for ETF list to prevent fetching on every keystroke/reload
_etf_master_list = []


@router.get("/etfs")
async def get_etf_list():
    global _etf_master_list
    if not _etf_master_list:
        try:
            df = fdr.StockListing("ETF/KR").sort_values(by="Name")
            _etf_master_list = (
                df[["Symbol", "Name"]]
                .rename(columns={"Symbol": "code", "Name": "name"})
                .to_dict(orient="records")
            )
        except Exception as e:
            logger.error(f"Error fetching ETF list: {e}")
            return []
    return _etf_master_list


@router.get("/db-version")
async def get_db_version(db: AsyncSession = Depends(get_db)):
    from db.models import ETFMaster
    from sqlalchemy import func
    from datetime import timedelta

    try:
        result = await db.execute(select(func.max(ETFMaster.last_updated)))
        max_time = result.scalar()

        if max_time:
            # max_time is naive UTC. Add 9 hours for KST.
            kst_time = max_time + timedelta(hours=9)
            version_str = kst_time.strftime("VER %y%m%d%H%M")
            return {"version": version_str}
    except Exception as e:
        logger.error(f"Error fetching DB version: {e}")

    return {"version": "VER --"}


@router.get("/health")
async def check_health(db: AsyncSession = Depends(get_db)):
    import yfinance as yf
    from sqlalchemy import text
    from agents.harvester.harvester import ETFHarvester

    status = {
        "db": "pending",
        "yfinance": "pending",
        "naver": "pending",
    }
    failed_services = []

    # DB Check
    try:
        await db.execute(text("SELECT 1"))
        status["db"] = "ok"
    except Exception as e:
        status["db"] = "error"
        failed_services.append("DB")
        logger.error(f"Health check DB error: {e}")

    # yfinance Check (start/end 방식 - 안정적)
    try:
        from datetime import datetime, timedelta
        end = datetime.now()
        start = (end - timedelta(days=3)).strftime("%Y-%m-%d")
        t = yf.Ticker("SPY")
        res = await asyncio.to_thread(
            lambda: t.history(start=start, end=end.strftime("%Y-%m-%d"), auto_adjust=True)
        )
        if not res.empty:
            status["yfinance"] = "ok"
        else:
            status["yfinance"] = "error"
            failed_services.append("Yahoo Finance")
    except Exception as e:
        status["yfinance"] = "error"
        failed_services.append("Yahoo Finance")
        logger.error(f"Health check YF error: {e}")

    # Naver Scraping Check
    try:
        harvester = ETFHarvester()
        # "069500" KODEX 200 is a reliable domestic ETF to test table scraping
        holdings = await harvester.fetch_etf_holdings("069500")
        if len(holdings) > 0:
            status["naver"] = "ok"
        else:
            status["naver"] = "error"
            failed_services.append("Naver Scraping")
    except Exception as e:
        status["naver"] = "error"
        failed_services.append("Naver Scraping")
        logger.error(f"Health check Naver error: {e}")

    all_ok = all(
        v == "ok"
        for k, v in status.items()
        if k != "overall" and k != "failed_services"
    )
    status["failed_services"] = failed_services
    status["overall"] = "ok" if all_ok else "error"
    return status



@router.get("/evaluate", tags=["evaluate"])
async def get_evaluated_etfs(db: AsyncSession = Depends(get_db)):
    """
    Returns the list of ETFs with their evaluation scores from the DB.
    """
    try:
        query = select(ETFEvaluation, ETFMaster).join(
            ETFMaster, ETFEvaluation.code == ETFMaster.code
        )
        result = await db.execute(query)

        response = []
        for eval_obj, master_obj in result.all():
            response.append(
                {
                    "code": master_obj.code,
                    "name": master_obj.name,
                    "issuer": master_obj.issuer,
                    "aum": master_obj.aum,
                    "scores": {
                        "liquidity": eval_obj.liquidity_score,
                        "cost": eval_obj.cost_score,
                        "tracking": eval_obj.tracking_score,
                        "performance": eval_obj.performance_score,
                        "fundamental": eval_obj.fundamental_score,
                        "total": eval_obj.total_score,
                        "rating": eval_obj.rating,
                    },
                }
            )

        # Sort by total score descending
        response.sort(key=lambda x: x["scores"]["total"] or 0, reverse=True)
        return response
    except Exception as e:
        logger.error(f"Error fetching evaluated ETFs: {e}")
        return {"status": "error", "message": str(e)}


class CompareRequest(BaseModel):
    etf_codes: List[str]
    skip_holdings: bool = False
    skip_chart: bool = False


import time

_bench_cache = {}
CACHE_TTL = 600  # 10 minutes – enough to avoid hammering the API while keeping data fresh


def get_bench_cached(key):
    if key in _bench_cache:
        val, ts = _bench_cache[key]
        if time.time() - ts < CACHE_TTL:
            return val
    return None


def set_bench_cached(key, val):
    _bench_cache[key] = (val, time.time())


@router.get("/flush-cache")
async def flush_cache():
    """캐시 전체 초기화 - Render 서버 데이터 강제 갱신용"""
    count = len(_bench_cache)
    _bench_cache.clear()
    return {"cleared": count, "message": f"{count}개 캐시 항목 삭제 완료. 다음 요청 시 fresh 데이터를 가져옵니다."}


async def fetch_yahoo_finance(ticker: str, period_years: int = 10):
    cache_key = f"yahoo_{ticker}_{period_years}"
    cached = get_bench_cached(cache_key)
    if cached is not None:
        return cached

    import yfinance as yf
    import requests
    import pandas as pd
    from datetime import datetime, timedelta

    _yf_session = requests.Session()
    _yf_session.headers.update(
        {
            "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36"
        }
    )

    def _fetch():
        try:
            end_date = datetime.now()
            start_date = end_date - timedelta(days=period_years * 365 + 10)
            df = yf.download(
                ticker,
                start=start_date.strftime("%Y-%m-%d"),
                end=end_date.strftime("%Y-%m-%d"),
                progress=False,
            )
            if df.empty:
                return pd.DataFrame()

            if isinstance(df.columns, pd.MultiIndex):
                if "Close" in df.columns.levels[0]:
                    close_prices = (
                        df["Close"][ticker]
                        if ticker in df["Close"].columns
                        else df["Close"].iloc[:, 0]
                    )
                else:
                    close_prices = df.iloc[:, 0]
            else:
                close_prices = df["Close"] if "Close" in df.columns else df.iloc[:, 0]

            df_out = pd.DataFrame({"Close": close_prices})
            df_out = df_out.dropna()

            if df_out.index.tz is not None:
                df_out.index = df_out.index.tz_localize(None)

            set_bench_cached(cache_key, df_out)
            return df_out
        except Exception as e:
            logger.error(f"Failed to fetch {ticker} from yfinance: {e}")
            return pd.DataFrame()

    return await asyncio.to_thread(_fetch)


async def fetch_etf_hybrid(
    code: str,
    skip_holdings: bool,
    skip_chart: bool,
    db: AsyncSession,
    harvester: ETFHarvester,
):
    from db.models import ETFMaster, ETFDailyPrice, ETFHoldings
    from sqlalchemy import select

    res = await db.execute(select(ETFMaster).where(ETFMaster.code == code))
    master = res.scalars().first()

    if master:
        # Load from DB
        import json

        b_info = json.loads(master.basic_info_json) if master.basic_info_json else {}

        # Fetch holdings
        holdings = []
        if not skip_holdings:
            h_res = await db.execute(
                select(ETFHoldings).where(ETFHoldings.code == code)
            )
            for h in h_res.scalars().all():
                holdings.append({"ticker": h.ticker, "weight": h.weight})

        # Fetch prices
        dates = []
        prices = []
        if not skip_chart:
            p_res = await db.execute(
                select(ETFDailyPrice)
                .where(ETFDailyPrice.code == code)
                .order_by(ETFDailyPrice.id)
            )
            for p in p_res.scalars().all():
                dates.append(p.date)
                prices.append(p.close)

        # We can implement a fast real-time NAV/Price fetch here later.
        # For now, rely on yesterday's price from DB or trigger an asynchronous KIS update.
        live_price = master.price

        return {
            "etf_code": code,
            "etf_name": master.name,
            "market_data": {
                "price": live_price,
                "nav": master.nav,
            },
            "basic_info": b_info,
            "historical_data": {"dates": dates, "prices": prices},
            "holdings": holdings,
        }
    else:
        # Fallback to pure live fetching (e.g. for un-cached or non-KRX ETFs)
        return await harvester.fetch_naver_etf_data(code, skip_holdings, skip_chart)


async def fetch_benchmark_hybrid(symbol: str, db: AsyncSession, fallback_coro):
    from db.models import BenchmarkPrice
    from sqlalchemy import select
    import pandas as pd

    res = await db.execute(
        select(BenchmarkPrice)
        .where(BenchmarkPrice.symbol == symbol)
        .order_by(BenchmarkPrice.id)
    )
    rows = res.scalars().all()
    if rows:
        dates = [r.date for r in rows]
        closes = [r.close for r in rows]
        df = pd.DataFrame({"Close": closes}, index=pd.to_datetime(dates))
        return df
    # Fallback
    return await fallback_coro


@router.post("/compare")
async def compare_etfs(request: CompareRequest, db: AsyncSession = Depends(get_db)):
    """
    Orchestrates the comparison between multiple ETFs.
    """
    if len(request.etf_codes) < 2:
        return {"error": "Provide at least two ETF codes for comparison."}

    # 1. Fetch data for each ETF on-demand (Agent 1)
    harvester = ETFHarvester()
    await harvester.initialize()

    start_str = (datetime.now() - timedelta(days=3650)).strftime("%Y-%m-%d")

    # Run the fetch for all ETFs and benchmarks sequentially to prevent SQLAlchemy concurrent session errors
    results = []
    for code in request.etf_codes:
        res = await fetch_etf_hybrid(
            code, request.skip_holdings, request.skip_chart, db, harvester
        )
        results.append(res)

    if not request.skip_chart:
        results.append(
            await fetch_benchmark_hybrid("^KS11", db, fetch_yahoo_finance("^KS11", 10))
        )
        results.append(
            await fetch_benchmark_hybrid("^KQ11", db, fetch_yahoo_finance("^KQ11", 10))
        )
        results.append(
            await fetch_benchmark_hybrid("^GSPC", db, fetch_yahoo_finance("^GSPC", 10))
        )
        results.append(
            await fetch_benchmark_hybrid("^IXIC", db, fetch_yahoo_finance("^IXIC", 10))
        )

    if not request.skip_chart:
        etf_data_list = results[:-4]
        kospi_df = results[-4]
        kosdaq_df = results[-3]
        sp500_df = results[-2]
        nasdaq_df = results[-1]
    else:
        etf_data_list = results
        import pandas as pd

        kospi_df = pd.DataFrame()
        kosdaq_df = pd.DataFrame()
        sp500_df = pd.DataFrame()
        nasdaq_df = pd.DataFrame()

    await harvester.close()

    # 2. Analyze data (Agent 2)
    quant = ETFQuant()

    import pandas as pd

    for data in etf_data_list:
        historical_data = data.get("historical_data", {})
        prices = historical_data.get("prices", [])
        if prices and len(prices) > 2:
            prices_series = pd.Series(prices)
            metrics = quant.calculate_performance_metrics(prices_series)
            data["quant_metrics"] = metrics
        else:
            data["quant_metrics"] = {}

    # Calculate actual overlap if exactly 2 ETFs, else 0 for simplify
    overlap_pct = 0.0
    if len(etf_data_list) == 2:
        holdings_1 = etf_data_list[0].get("holdings", [])
        holdings_2 = etf_data_list[1].get("holdings", [])
        if holdings_1 and holdings_2:
            overlap_pct = quant.calculate_overlap(holdings_1, holdings_2)

    # Generate time series data for line chart (Raw Prices for Frontend Normalization)
    chart_data_map = {}
    for data in etf_data_list:
        hist = data.get("historical_data", {})
        dates = hist.get("dates", [])
        prices = hist.get("prices", [])

        if not dates or not prices:
            continue

        for dt, pr in zip(dates, prices):
            if dt not in chart_data_map:
                chart_data_map[dt] = {"date": dt}
            chart_data_map[dt][data["etf_name"]] = pr

    if not kospi_df.empty:
        for dt_ts, row in kospi_df.iterrows():
            dt_str = str(dt_ts.date())
            if dt_str in chart_data_map:
                chart_data_map[dt_str]["KOSPI"] = row["Close"]

    if not kosdaq_df.empty:
        for dt_ts, row in kosdaq_df.iterrows():
            dt_str = str(dt_ts.date())
            if dt_str in chart_data_map:
                chart_data_map[dt_str]["KOSDAQ"] = row["Close"]

    if not sp500_df.empty:
        for dt_ts, row in sp500_df.iterrows():
            dt_str = str(dt_ts.date())
            if dt_str in chart_data_map:
                chart_data_map[dt_str]["SP500"] = row["Close"]

    if not nasdaq_df.empty:
        for dt_ts, row in nasdaq_df.iterrows():
            dt_str = str(dt_ts.date())
            if dt_str in chart_data_map:
                chart_data_map[dt_str]["NASDAQ"] = row["Close"]

    sorted_dates = sorted(list(chart_data_map.keys()))
    # Downsample points for UI performance (~1000 points to retain high detail for zoom)
    step = max(1, len(sorted_dates) // 1000)
    sampled_dates = sorted_dates[::step]
    line_chart_data = [chart_data_map[dt] for dt in sampled_dates]

    # Calculate Radar Chart Scores dynamically
    import re
    import numpy as np

    radar_chart = [
        {"subject": "수수료(저렴함)", "fullMark": 10},
        {"subject": "수익률", "fullMark": 10},
        {"subject": "유동성", "fullMark": 10},
        {"subject": "안정성", "fullMark": 10},
    ]

    for data in etf_data_list:
        etf_n = data["etf_name"]
        b_info = data.get("basic_info", {})
        q_metrics = data.get("quant_metrics", {})

        # 1. Fees (Lower is better, scale 1-10)
        fee_str = b_info.get("펀드보수", "연 0.5%")
        fee_nums = re.findall(r"[\d\.]+", fee_str)
        fee_val = float(fee_nums[0]) if fee_nums else 0.5
        fee_score = max(1, 10 - (fee_val * 10))

        # 2. Performance (1Y return or total_return)
        perf_str = b_info.get("1Y 수익률", "0%")
        perf_nums = re.findall(r"-?[\d\.]+", perf_str)
        perf_val = (
            float(perf_nums[0]) if perf_nums else q_metrics.get("total_return_pct", 0)
        )
        perf_score = min(10, max(1, 5 + (perf_val / 20)))

        # 3. Liquidity (volume)
        vol_str = b_info.get("20일평균 거래량/대금", "1000000주")
        vol_num = (
            float(vol_str.split("주")[0].replace(",", ""))
            if "주" in vol_str
            else 1000000
        )
        liq_score = min(10, max(1, np.log10(max(1, vol_num)) - 2))

        # 4. Stability (MDD. Lower is better)
        mdd = abs(q_metrics.get("mdd_pct", 20))
        stab_score = max(1, 10 - (mdd / 5))

        radar_chart[0][etf_n] = int(fee_score)
        radar_chart[1][etf_n] = int(perf_score)
        radar_chart[2][etf_n] = int(liq_score)
        radar_chart[3][etf_n] = int(stab_score)

    # 3. Format response for UI (Agent 4)
    response_payload = {
        "intent": "comparison",
        "display_type": ["ranking_table", "overlap_chart"],
        "data_payload": {
            "header": [
                "종목명",
                "현재가",
                "NAV",
                "괴리율",
                "1M 수익률",
                "3M 수익률",
                "6M 수익률",
                "1Y 수익률",
                "분배율(TTM)",
                "총보수",
                "10년 총수익률",
                "연변동성",
                "MDD",
                "샤프지수",
            ],
            "rows": [
                [
                    f"{data['etf_name']} ({data['etf_code']})",
                    f"{data['market_data']['price']:,.0f}원"
                    if data["market_data"]["price"]
                    else "N/A",
                    f"{data['market_data']['nav']:,.0f}원"
                    if data["market_data"]["nav"]
                    else "N/A",
                    f"{(float(data['market_data']['price']) - float(data['market_data']['nav'])) / float(data['market_data']['nav']) * 100:+.2f}%"
                    if data.get("market_data", {}).get("price")
                    and data.get("market_data", {}).get("nav")
                    else "N/A",
                    data.get("basic_info", {}).get("1M 수익률", "N/A"),
                    data.get("basic_info", {}).get("3M 수익률", "N/A"),
                    data.get("basic_info", {}).get("6M 수익률", "N/A"),
                    data.get("basic_info", {}).get("1Y 수익률", "N/A"),
                    data.get("basic_info", {}).get("최근 분배율(TTM)", "N/A"),
                    data.get("basic_info", {}).get("펀드보수", "N/A"),
                    f"{data['quant_metrics'].get('total_return_pct', 'N/A')}%"
                    if isinstance(
                        data["quant_metrics"].get("total_return_pct"), (int, float)
                    )
                    else "N/A",
                    f"{data['quant_metrics'].get('annualized_volatility_pct', 'N/A')}%"
                    if isinstance(
                        data["quant_metrics"].get("annualized_volatility_pct"),
                        (int, float),
                    )
                    else "N/A",
                    f"{data['quant_metrics'].get('mdd_pct', 'N/A')}%"
                    if isinstance(data["quant_metrics"].get("mdd_pct"), (int, float))
                    else "N/A",
                    f"{data['quant_metrics'].get('sharpe_ratio', 'N/A')}"
                    if isinstance(
                        data["quant_metrics"].get("sharpe_ratio"), (int, float)
                    )
                    else "N/A",
                ]
                for data in etf_data_list
            ],
            "insight_comment": f"두 ETF의 포트폴리오 주요 종목 중복도는 {overlap_pct}% 입니다.",
        },
        "visual_data": {
            "radar_chart": radar_chart,
            "line_chart": line_chart_data,
            "etf_keys": [d["etf_name"] for d in etf_data_list],
        },
        "next_action_suggestions": ["구성 종목 자세히 보기", "유사한 테마 ETF 더 찾기"],
        "raw_data": etf_data_list,
    }

    # Save simulation history to database
    try:
        new_history = SimulationHistory(
            codes=",".join(request.etf_codes),
            result_payload=json.dumps(response_payload, ensure_ascii=False),
        )
        db.add(new_history)
        await db.commit()
    except Exception as e:
        logger.error(f"Failed to save simulation history to DB: {e}")

    return response_payload


@router.get("/history")
async def get_recent_history(limit: int = 10, db: AsyncSession = Depends(get_db)):
    """
    Returns the most recent simulation history records from the database.
    """
    try:
        stmt = (
            select(SimulationHistory)
            .order_by(SimulationHistory.created_at.desc())
            .limit(limit)
        )
        result = await db.execute(stmt)
        histories = result.scalars().all()

        return [
            {
                "id": h.id,
                "created_at": h.created_at.isoformat(),
                "codes": h.codes.split(",") if h.codes else [],
                "result_payload": json.loads(h.result_payload)
                if h.result_payload
                else {},
            }
            for h in histories
        ]
    except Exception as e:
        logger.error(f"Error fetching history: {e}")
        return []


@router.post("/compare/chart")
async def get_chart_data(request: CompareRequest, db: AsyncSession = Depends(get_db)):
    """
    Fetches the computationally heavy 10-year line chart data for ETFs and benchmarks.
    Reads from local SQLite DB first for near-instant response.
    """
    if len(request.etf_codes) < 2:
        return {"error": "Provide at least two ETF codes for comparison."}

    from datetime import datetime, timedelta
    import asyncio

    harvester = ETFHarvester()
    await harvester.initialize()

    start_str = (datetime.now() - timedelta(days=3650)).strftime("%Y-%m-%d")

    # Fetch sequentially to prevent SQLAlchemy concurrent session errors
    results = []
    for code in request.etf_codes:
        results.append(
            await fetch_etf_hybrid(
                code, skip_holdings=True, skip_chart=False, db=db, harvester=harvester
            )
        )

    results.append(
        await fetch_benchmark_hybrid("^KS11", db, fetch_yahoo_finance("^KS11", 10))
    )
    results.append(
        await fetch_benchmark_hybrid("^KQ11", db, fetch_yahoo_finance("^KQ11", 10))
    )
    results.append(
        await fetch_benchmark_hybrid("^GSPC", db, fetch_yahoo_finance("^GSPC", 10))
    )
    results.append(
        await fetch_benchmark_hybrid("^IXIC", db, fetch_yahoo_finance("^IXIC", 10))
    )

    etf_data_list = results[:-4]
    kospi_df = results[-4]
    kosdaq_df = results[-3]
    sp500_df = results[-2]
    nasdaq_df = results[-1]

    await harvester.close()

    chart_data_map = {}
    for data in etf_data_list:
        hist = data.get("historical_data", {})
        dates = hist.get("dates", [])
        prices = hist.get("prices", [])

        if not dates or not prices:
            continue

        for dt, pr in zip(dates, prices):
            if dt not in chart_data_map:
                chart_data_map[dt] = {"date": dt}
            chart_data_map[dt][data["etf_name"]] = pr

    if not kospi_df.empty:
        for dt_ts, row in kospi_df.iterrows():
            dt_str = str(dt_ts.date())
            if dt_str in chart_data_map:
                chart_data_map[dt_str]["KOSPI"] = row["Close"]

    if not kosdaq_df.empty:
        for dt_ts, row in kosdaq_df.iterrows():
            dt_str = str(dt_ts.date())
            if dt_str in chart_data_map:
                chart_data_map[dt_str]["KOSDAQ"] = row["Close"]

    if not sp500_df.empty:
        for dt_ts, row in sp500_df.iterrows():
            dt_str = str(dt_ts.date())
            if dt_str in chart_data_map:
                chart_data_map[dt_str]["SP500"] = row["Close"]

    if not nasdaq_df.empty:
        for dt_ts, row in nasdaq_df.iterrows():
            dt_str = str(dt_ts.date())
            if dt_str in chart_data_map:
                chart_data_map[dt_str]["NASDAQ"] = row["Close"]

    sorted_dates = sorted(list(chart_data_map.keys()))
    step = max(1, len(sorted_dates) // 1000)
    sampled_dates = sorted_dates[::step]
    line_chart_data = [chart_data_map[dt] for dt in sampled_dates]

    return {
        "line_chart_data": line_chart_data,
        "etf_keys": [d["etf_name"] for d in etf_data_list],
    }


@router.post("/compare/holdings")
async def get_holdings(request: CompareRequest, db: AsyncSession = Depends(get_db)):
    """
    Fetches only the holdings data for the given ETF codes and computes their overlap.
    Reads from local SQLite DB first for near-instant response.
    """
    if len(request.etf_codes) < 2:
        return {"error": "Provide at least two ETF codes for comparison."}

    import traceback
    from sqlalchemy import select
    from db.models import ETFHoldings

    try:
        harvester = ETFHarvester()
        quant = ETFQuant()

        holdings_dict = {}
        holdings_list = []

        # We can fetch holdings sequentially or concurrently; DB reads are fast enough for sequential here
        for code in request.etf_codes:
            h_res = await db.execute(
                select(ETFHoldings).where(ETFHoldings.code == code)
            )
            db_holdings = [
                {
                    "ticker": h.ticker,
                    "weight": h.weight,
                    **({"shares": h.shares} if h.shares is not None else {}),
                }
                for h in h_res.scalars().all()
            ]

            if db_holdings:
                holdings_dict[code] = db_holdings
                holdings_list.append(db_holdings)
            else:
                # Fallback to live scrape
                live_holdings = await harvester.fetch_etf_holdings(code)
                holdings_dict[code] = live_holdings
                holdings_list.append(live_holdings)

        overlap_pct = 0.0
        if len(holdings_list) == 2:
            overlap_pct = quant.calculate_overlap(holdings_list[0], holdings_list[1])

        return {"holdings_dict": holdings_dict, "overlap_pct": overlap_pct}
    except Exception as e:
        return {"error": str(e), "traceback": traceback.format_exc()}


@router.get("/semi-chart")
async def get_semi_chart_data():
    """
    Returns split/dividend-adjusted close prices for 5 semiconductor assets.
    Each ticker is fetched sequentially with auto_adjust=True so stock-split
    distortions (e.g. Samsung 50:1 split in 2018) are correctly handled.
    """
    import yfinance as yf
    import pandas as pd
    import asyncio
    from datetime import datetime, timedelta

    tickers = {
        "SOX": "^SOX",
        "삼성전자": "005930.KS",
        "SK하이닉스": "000660.KS",
        "KODEX 반도체": "091160.KS",
        "TIGER 미필반나": "381180.KS",
    }

    # 5-minute dedicated cache (v6: common base-date normalization fixed on frontend)
    semi_cache_key = "semi_chart_v6"
    if semi_cache_key in _bench_cache:
        cached_val, cached_ts = _bench_cache[semi_cache_key]
        if time.time() - cached_ts < 300:
            return cached_val

    end_date = datetime.now()
    start_date = end_date - timedelta(days=10 * 365 + 30)
    start_str = start_date.strftime("%Y-%m-%d")
    end_str = end_date.strftime("%Y-%m-%d")

    def _fetch_one(t_code: str) -> pd.Series:
        """
        Download a SINGLE ticker with auto_adjust=True.
        auto_adjust=True keeps only [Open,High,Low,Close,Volume] with Close=split-adjusted.
        For a SINGLE ticker, yfinance ≥ 0.2 returns a flat DataFrame (no MultiIndex).
        Returns a clean tz-naive pd.Series of Close prices.
        """
        try:
            df = yf.download(
                t_code,
                start=start_str,
                end=end_str,
                progress=False,
                # auto_adjust=False (default): "Close" is split-adjusted only.
                # Do NOT use auto_adjust=True for Korean stocks – yfinance returns
                # the Total Return price (dividends reinvested) which inflates prices
                # far above actual market prices and distorts the chart.
            )
            if df.empty:
                logger.warning(f"semi-chart: empty download for {t_code}")
                return pd.Series(dtype=float)

            # Extract the split-adjusted Close price.
            # Column structure depends on yfinance version:
            #  - old (< 0.2): flat columns [Open, High, Low, Close, Adj Close, Volume]
            #  - new (≥ 0.2): MultiIndex [(metric, ticker)] even for single-ticker download
            if isinstance(df.columns, pd.MultiIndex):
                lvl0 = df.columns.get_level_values(0).unique().tolist()
                lvl1 = df.columns.get_level_values(1).unique().tolist()
                if "Close" in lvl0:
                    # (metric, ticker) format — default group_by='column'
                    sub = df["Close"]
                    series = sub.iloc[:, 0] if isinstance(sub, pd.DataFrame) else sub
                elif t_code in lvl0:
                    # (ticker, metric) format — group_by='ticker'
                    series = df[t_code]["Close"] if "Close" in df[t_code].columns else df[t_code].iloc[:, 0]
                elif "Close" in lvl1:
                    series = df.xs("Close", axis=1, level=1)
                    series = series.iloc[:, 0] if isinstance(series, pd.DataFrame) else series
                else:
                    series = df.iloc[:, 0]
            else:
                # Flat columns
                if "Close" in df.columns:
                    series = df["Close"]
                elif "Adj Close" in df.columns:
                    series = df["Adj Close"]
                else:
                    series = df.iloc[:, 0]


            series = series.dropna()
            if series.empty:
                return pd.Series(dtype=float)

            if series.index.tz is not None:
                series.index = series.index.tz_convert(None)

            logger.info(
                f"semi-chart {t_code}: {len(series)} pts, "
                f"{series.index[0].date()} – {series.index[-1].date()}, "
                f"first={series.iloc[0]:.2f}, last={series.iloc[-1]:.2f}"
            )
            return series
        except Exception as e:
            logger.error(f"semi-chart: {t_code} failed: {e}", exc_info=True)
            return pd.Series(dtype=float)

    # Sequential: yfinance sessions share state and are NOT concurrency-safe
    results: dict[str, pd.Series] = {}
    for t_name, t_code in tickers.items():
        results[t_name] = await asyncio.to_thread(_fetch_one, t_code)

    # Build date-keyed map; each ticker contributes only its own trading days
    chart_data_map: dict = {}
    for t_name, series in results.items():
        if series.empty:
            logger.warning(f"semi-chart: skipping {t_name} (no data)")
            continue
        for dt_ts, val in series.items():
            dt_str = str(dt_ts.date())
            if dt_str not in chart_data_map:
                chart_data_map[dt_str] = {"date": dt_str}
            chart_data_map[dt_str][t_name] = float(val)

    sorted_dates = sorted(chart_data_map.keys())
    if not sorted_dates:
        return {"line_chart_data": [], "keys": list(tickers.keys())}

    # Downsample to ≤1000 pts; always keep the very last date
    step = max(1, len(sorted_dates) // 1000)
    sampled_dates = sorted_dates[::step]
    if sorted_dates[-1] != sampled_dates[-1]:
        sampled_dates = list(sampled_dates) + [sorted_dates[-1]]

    line_chart_data = [chart_data_map[dt] for dt in sampled_dates]
    result = {"line_chart_data": line_chart_data, "keys": list(tickers.keys())}
    _bench_cache[semi_cache_key] = (result, time.time())
    return result

