import logging
import asyncio
import re
import json
import requests
import yfinance as yf
from datetime import datetime, timedelta
from fastapi import APIRouter
import pandas as pd

logger = logging.getLogger(__name__)

router = APIRouter(tags=["exit_signal"])

# Cache variables to prevent hitting rate limits
_cache = {"data": None, "timestamp": None}
CACHE_TTL = 3600 * 12  # 12 hours


def get_mock_data():
    return {
        "indicators": {
            "dollar": [
                {"month": "03월", "val": 104.2, "krw": 1350},
                {"month": "04월", "val": 103.8, "krw": 1345},
                {"month": "05월", "val": 105.1, "krw": 1370},
                {"month": "06월", "val": 104.5, "krw": 1362},
                {"month": "07월", "val": 102.3, "krw": 1330},
                {"month": "08월", "val": 101.8, "krw": 1325},
                {"month": "09월", "val": 100.9, "krw": 1310},
                {"month": "10월", "val": 99.5, "krw": 1290},
                {"month": "11월", "val": 98.2, "krw": 1285},
                {"month": "12월", "val": 97.4, "krw": 1270},
                {"month": "01월", "val": 96.8, "krw": 1265},
                {"month": "02월", "val": 97.77, "krw": 1280},
            ],
            "per": [
                {"month": "03월", "val": 9.8},
                {"month": "04월", "val": 9.5},
                {"month": "05월", "val": 9.1},
                {"month": "06월", "val": 9.9},
                {"month": "07월", "val": 10.4},
                {"month": "08월", "val": 10.9},
                {"month": "09월", "val": 11.2},
                {"month": "10월", "val": 11.5},
                {"month": "11월", "val": 11.8},
                {"month": "12월", "val": 12.1},
                {"month": "01월", "val": 12.6},
                {"month": "02월", "val": 12.4},
            ],
            "cli": [
                {"month": "03월", "val": 99.1},
                {"month": "04월", "val": 99.5},
                {"month": "05월", "val": 99.8},
                {"month": "06월", "val": 99.9},
                {"month": "07월", "val": 100.1},
                {"month": "08월", "val": 100.3},
                {"month": "09월", "val": 100.5},
                {"month": "10월", "val": 100.7},
                {"month": "11월", "val": 100.9},
                {"month": "12월", "val": 101.1},
                {"month": "01월", "val": 100.8},
                {"month": "02월", "val": 100.4},
            ],
        },
        "current_status": {
            "dollar": 97.77,
            "krw": 1280,
            "per": 12.4,
            "cli": 100.4,
            "cli_down_months": 2,
        },
    }


async def fetch_yf_data():
    try:
        end_date = datetime.now()
        start_date = end_date - timedelta(days=400)

        dx_df = await asyncio.to_thread(
            yf.download,
            "DX-Y.NYB",
            start=start_date.strftime("%Y-%m-%d"),
            end=end_date.strftime("%Y-%m-%d"),
            progress=False,
        )
        krw_df = await asyncio.to_thread(
            yf.download,
            "KRW=X",
            start=start_date.strftime("%Y-%m-%d"),
            end=end_date.strftime("%Y-%m-%d"),
            progress=False,
        )

        # In newer yfinance, dx_df.columns might be MultiIndex
        if isinstance(dx_df.columns, pd.MultiIndex):
            dx_close = dx_df["Close"].iloc[:, 0]
            krw_close = krw_df["Close"].iloc[:, 0]
        else:
            dx_close = dx_df["Close"]
            krw_close = krw_df["Close"]

        dx_monthly = dx_close.resample("ME").last()
        krw_monthly = krw_close.resample("ME").last()

        # Extract last 12 months
        dx_last12 = dx_monthly.tail(12)
        krw_last12 = krw_monthly.tail(12)

        dollar_data = []
        # dx_last12 is a Series with DatetimeIndex
        for dt, val in dx_last12.items():
            if isinstance(dt, tuple):
                dt = dt[0]  # Handle multi-index case if any

            if isinstance(dt, str):
                dt = pd.to_datetime(dt)

            month_str = f"{dt.month:02d}월"
            # Get matching KRW value, fallback to 1300 if missing
            krw_val = 1300
            try:
                # dt might not match exactly, find closest or just match month/year
                matching_krw = krw_last12[
                    (krw_last12.index.year == dt.year)
                    & (krw_last12.index.month == dt.month)
                ]
                if not matching_krw.empty:
                    krw_val = int(matching_krw.iloc[-1])
            except Exception:
                pass

            # Extract simple float from potentially pd.Series values
            val_flt = float(val.iloc[0]) if isinstance(val, pd.Series) else float(val)

            dollar_data.append(
                {
                    "month": month_str,
                    "val": round(val_flt, 2) if pd.notna(val_flt) else 100.0,
                    "krw": krw_val,
                }
            )

        final_dx = (
            float(dx_last12.iloc[-1].iloc[0])
            if isinstance(dx_last12.iloc[-1], pd.Series)
            else float(dx_last12.iloc[-1])
        )
        final_krw = (
            int(krw_last12.iloc[-1].iloc[0])
            if isinstance(krw_last12.iloc[-1], pd.Series)
            else int(krw_last12.iloc[-1])
        )
        return dollar_data, final_dx, final_krw
    except Exception as e:
        logger.error(f"Failed to fetch YF data: {e}")
        return None, None, None


async def fetch_fred_cli():
    try:
        url = "https://fred.stlouisfed.org/series/KORLORSGPNOSTSAM"
        headers = {"User-Agent": "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7)"}
        res = await asyncio.to_thread(requests.get, url, headers=headers)
        if res.status_code == 200:
            match = re.search(
                r'data:\s*(\{.*?"observations"\s*:.*?\})\s*,', res.text, re.DOTALL
            )
            if match:
                data = json.loads(match.group(1))
                obs = data.get("observations", [])

                if obs:
                    # Parse dates
                    df = pd.DataFrame(obs)
                    df["date"] = pd.to_datetime(df["date"])
                    df["value"] = pd.to_numeric(df["value"], errors="coerce")
                    df = df.dropna().sort_values("date").tail(13)

                    # Convert to our format
                    cli_data = []
                    last12 = df.tail(12)
                    for _, row in last12.iterrows():
                        cli_data.append(
                            {
                                "month": f"{row['date'].month:02d}월",
                                "val": round(float(row["value"]), 2),
                            }
                        )

                    # Calculate down months
                    down_months = 0
                    vals = df["value"].tolist()
                    for i in range(len(vals) - 1, 0, -1):
                        if vals[i] < vals[i - 1]:
                            down_months += 1
                        else:
                            break

                    return cli_data, float(vals[-1]), down_months
        return None, None, None
    except Exception as e:
        logger.error(f"Failed to fetch FRED CLI: {e}")
        return None, None, None


@router.get("")
async def get_exit_signal_data():
    global _cache
    now = datetime.now().timestamp()

    if (
        _cache["data"]
        and _cache["timestamp"]
        and (now - _cache["timestamp"] < CACHE_TTL)
    ):
        return _cache["data"]

    mock = get_mock_data()

    # Try fetching real data
    try:
        dollar_data, current_dollar, current_krw = await fetch_yf_data()
        cli_data, current_cli, cli_down_months = await fetch_fred_cli()

        # Merge fetched data with mock fallback
        if dollar_data and current_dollar:
            mock["indicators"]["dollar"] = dollar_data
            mock["current_status"]["dollar"] = current_dollar
            mock["current_status"]["krw"] = current_krw

        if cli_data and current_cli:
            mock["indicators"]["cli"] = cli_data
            mock["current_status"]["cli"] = current_cli
            mock["current_status"]["cli_down_months"] = cli_down_months

        # P/E requires a more robust setup, so we fallback to mock/static for now
        # unless we can easily extract from PyKrx

        _cache["data"] = mock
        _cache["timestamp"] = now

    except Exception as e:
        logger.error(f"Error compiling exit signal data: {e}")

    return mock
