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
from db.models import SimulationHistory
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


class CompareRequest(BaseModel):
    etf_codes: List[str]
    skip_holdings: bool = False


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
    kospi_task = asyncio.to_thread(fdr.DataReader, "KS11", start_str)
    kosdaq_task = asyncio.to_thread(fdr.DataReader, "KQ11", start_str)

    # Run the fetch for all ETFs concurrently to greatly improve response time along with benchmarks
    tasks = [
        harvester.fetch_naver_etf_data(code, request.skip_holdings)
        for code in request.etf_codes
    ]
    results = await asyncio.gather(*tasks, kospi_task, kosdaq_task)

    etf_data_list = results[:-2]
    kospi_df = results[-2]
    kosdaq_df = results[-1]

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


@router.post("/compare/holdings")
async def get_holdings(request: CompareRequest):
    """
    Fetches only the holdings data for the given ETF codes and computes their overlap.
    """
    if len(request.etf_codes) < 2:
        return {"error": "Provide at least two ETF codes for comparison."}

    import traceback

    try:
        harvester = ETFHarvester()
        quant = ETFQuant()

        tasks = [harvester.fetch_etf_holdings(code) for code in request.etf_codes]
        holdings_list = await asyncio.gather(*tasks)

        overlap_pct = 0.0
        if len(holdings_list) == 2:
            overlap_pct = quant.calculate_overlap(holdings_list[0], holdings_list[1])

        holdings_dict = {}
        for code, h_data in zip(request.etf_codes, holdings_list):
            holdings_dict[code] = h_data

        return {"holdings_dict": holdings_dict, "overlap_pct": overlap_pct}
    except Exception as e:
        return {"error": str(e), "traceback": traceback.format_exc()}
