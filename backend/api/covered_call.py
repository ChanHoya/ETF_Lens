from fastapi import APIRouter
from pydantic import BaseModel
import pandas as pd
from typing import List
from core.covered_call_analyzer import CoveredCallAnalyzer

router = APIRouter(prefix="/covered-calls", tags=["covered-calls"])


class CoveredCallRequest(BaseModel):
    fund_symbols: List[str]  # e.g., ['JEPI', 'JEPQ', 'SPYI']
    benchmark_symbol: str  # e.g., '^SP500TR'
    period: str = "1mo"  # '1mo', '3mo', '1y'


@router.post("/analyze")
async def analyze_covered_calls(request: CoveredCallRequest):
    """
    Analyzes multiple covered call ETFs against a benchmark.
    Returns Total Return metrics and Up/Down capture ratios.
    """
    analyzer = CoveredCallAnalyzer()

    # 1. Fetch benchmark data
    bench_df = await analyzer.fetch_historical_tr(
        request.benchmark_symbol, period=request.period
    )
    if bench_df.empty:
        return {
            "error": f"Could not fetch benchmark data for {request.benchmark_symbol}"
        }

    bench_adj_close = bench_df["Adj Close"]

    results = []
    # 2. Fetch and analyze each fund
    for symbol in request.fund_symbols:
        fund_df = await analyzer.fetch_historical_tr(symbol, period=request.period)
        if fund_df.empty:
            results.append({"symbol": symbol, "error": "Failed to fetch data"})
            continue

        fund_adj_close = fund_df["Adj Close"]

        # Calculate Capture Ratios
        captures = analyzer.calculate_capture_ratios(fund_adj_close, bench_adj_close)

        # Calculate TR difference
        tr_diff = analyzer.calculate_tr_difference(fund_adj_close, bench_adj_close)

        # Aggregate stats
        results.append(
            {
                "ticker": symbol,
                "upside_capture": captures["upside_capture"],
                "downside_capture": captures["downside_capture"],
                "tr_period": tr_diff["fund_tr"],
                "benchmark_tr_period": tr_diff["bench_tr"],
                "diff_benchmark_period": tr_diff["tr_difference"],
            }
        )

    return {
        "status": "success",
        "benchmark_used": request.benchmark_symbol,
        "results": results,
    }


@router.post("/chart")
async def get_covered_call_chart(request: CoveredCallRequest):
    """
    Returns time-series chart data (Total Return base 100)
    for the requested period (1mo, 3mo, 1y).
    """
    analyzer = CoveredCallAnalyzer()
    bench_df = await analyzer.fetch_historical_tr(
        request.benchmark_symbol, period=request.period
    )

    if bench_df.empty:
        return {"error": "Benchmark data missing"}

    bench_series = bench_df["Adj Close"]

    fund_series_list = {}
    for sym in request.fund_symbols:
        df = await analyzer.fetch_historical_tr(sym, period=request.period)
        if not df.empty:
            fund_series_list[sym] = df["Adj Close"]

    # Combine into single DataFrame
    df_all = pd.DataFrame({"Benchmark": bench_series})
    for sym, series in fund_series_list.items():
        df_all[sym] = series

    df_all = df_all.dropna()
    if len(df_all) == 0:
        return {"error": "No overlapping data"}

    # Rebase to 100
    df_all = (df_all / df_all.iloc[0]) * 100

    # Format for UI
    chart_data = []
    for dt, row in df_all.iterrows():
        entry = {"date": dt.strftime("%m/%d")}
        entry["Benchmark"] = round(row["Benchmark"] - 100, 2)
        for sym in request.fund_symbols:
            if sym in row:
                entry[sym] = round(row[sym] - 100, 2)
        chart_data.append(entry)

    return {"chart_data": chart_data}
