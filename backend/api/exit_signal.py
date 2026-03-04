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
_macro_cache = {}
_cli_cache = {}
CACHE_TTL = 3600 * 12  # 12 hours

# Setup a custom session for yfinance to bypass cloud bot-blocking
_yf_session = requests.Session()
_yf_session.headers.update(
    {
        "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36"
    }
)


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

        df = await asyncio.to_thread(
            yf.download,
            ["DX-Y.NYB", "KRW=X"],
            start=start_date.strftime("%Y-%m-%d"),
            end=end_date.strftime("%Y-%m-%d"),
            progress=False,
        )

        if isinstance(df.columns, pd.MultiIndex):
            close_prices = df["Close"]
        else:
            close_prices = df

        monthly = close_prices.resample("ME").last().dropna(how="all").tail(12)

        dollar_data = []
        for dt, row in monthly.iterrows():
            if isinstance(dt, tuple):
                dt = dt[0]
            if isinstance(dt, str):
                dt = pd.to_datetime(dt)

            month_str = f"{dt.month:02d}월"
            dollar_val = float(row.get("DX-Y.NYB", 100.0))
            krw_val = int(row.get("KRW=X", 1300.0))

            dollar_data.append(
                {
                    "month": month_str,
                    "val": round(dollar_val, 2) if pd.notna(dollar_val) else 100.0,
                    "krw": krw_val if pd.notna(krw_val) else 1300,
                }
            )

        if not dollar_data:
            return [], 100.0, 1300

        final_dx = dollar_data[-1]["val"]
        final_krw = dollar_data[-1]["krw"]

        return dollar_data, final_dx, final_krw
    except Exception as e:
        logger.error(f"Failed to fetch YF data: {e}")
        return [], 100.0, 1300


async def fetch_market_sentiment():
    """Fetch VIX and calculate proxy Fear & Greed Index, and fetch KOSPI."""
    try:
        end_date = datetime.now()
        start_date = end_date - timedelta(days=3700)  # Support up to 10 years

        df = await asyncio.to_thread(
            yf.download,
            ["^VIX", "^KS11", "^GSPC"],
            start=start_date.strftime("%Y-%m-%d"),
            end=end_date.strftime("%Y-%m-%d"),
            progress=False,
        )

        # Extract Close price series
        if isinstance(df.columns, pd.MultiIndex):
            if "Close" in df.columns.levels[0]:
                vix_close = (
                    df["Close"]["^VIX"]
                    if "^VIX" in df["Close"].columns
                    else df["Close"].iloc[:, 0]
                )
                kospi_close = (
                    df["Close"]["^KS11"]
                    if "^KS11" in df["Close"].columns
                    else df["Close"].iloc[:, 1]
                )
                sp500_close = (
                    df["Close"]["^GSPC"]
                    if "^GSPC" in df["Close"].columns
                    else df["Close"].iloc[:, 2]
                )
            else:
                vix_close = df.iloc[:, 0]
                kospi_close = df.iloc[:, 1]
                sp500_close = df.iloc[:, 2]
        else:
            vix_close = df["^VIX"] if "^VIX" in df.columns else df.iloc[:, 0]
            kospi_close = df["^KS11"] if "^KS11" in df.columns else df.iloc[:, 1]
            sp500_close = df["^GSPC"] if "^GSPC" in df.columns else df.iloc[:, 2]

        vix_close = vix_close.ffill().dropna()
        kospi_close = kospi_close.ffill().dropna()
        sp500_close = sp500_close.ffill().dropna()

        # Align series to keep dates where all exist
        aligned = pd.concat([vix_close, kospi_close, sp500_close], axis=1).dropna()
        aligned.columns = ["vix", "kospi", "sp500"]

        if aligned.empty:
            return [], 20.0, 50.0

        sentiment_data = []

        for dt, row in aligned.iterrows():
            if isinstance(dt, tuple):
                dt = dt[0]
            if isinstance(dt, str):
                dt = pd.to_datetime(dt)
            vix_val = float(row["vix"])
            kospi_val = float(row["kospi"])
            sp500_val = float(row["sp500"])

            # Proxy formula: FGI = 50 - (VIX - 18) * 3
            # Bound between 0 and 100
            fgi_val = max(0.0, min(100.0, 50.0 - (vix_val - 18.0) * 3.0))

            sentiment_data.append(
                {
                    "date": dt.strftime("%Y-%m-%d"),
                    "vix": round(vix_val, 2),
                    "fgi": round(fgi_val, 1),
                    "kospi": round(kospi_val, 2),
                    "sp500": round(sp500_val, 2),
                }
            )

        final_vix = sentiment_data[-1]["vix"]
        final_fgi = sentiment_data[-1]["fgi"]

        return sentiment_data, final_vix, final_fgi
    except Exception as e:
        logger.error(f"Failed to fetch Sentiment data: {e}")
        return [], 20.0, 50.0


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
        pe_data = await get_pe_detail("KOSPI")

        # Merge fetched data with mock fallback
        if dollar_data and current_dollar:
            mock["indicators"]["dollar"] = dollar_data
            mock["current_status"]["dollar"] = current_dollar
            mock["current_status"]["krw"] = current_krw

        if cli_data and current_cli:
            mock["indicators"]["cli"] = cli_data
            mock["current_status"]["cli"] = current_cli
            mock["current_status"]["cli_down_months"] = cli_down_months

        if pe_data and len(pe_data) > 0:
            mock["indicators"]["per"] = pe_data
            mock["current_status"]["per"] = pe_data[-1]["val"]

        sentiment_data, current_vix, current_fgi = await fetch_market_sentiment()
        if sentiment_data:
            mock["indicators"]["sentiment"] = sentiment_data
            mock["current_status"]["vix"] = current_vix
            mock["current_status"]["fgi"] = current_fgi

        _cache["data"] = mock
        _cache["timestamp"] = now

    except Exception as e:
        logger.error(f"Error compiling exit signal data: {e}")

    return mock


@router.get("/macro")
async def get_macro_detail(period: str = "10Y"):
    global _macro_cache

    cache_key = f"daily_{period}"

    now = datetime.now().timestamp()
    if cache_key in _macro_cache and (
        now - _macro_cache[cache_key].get("timestamp", 0) < CACHE_TTL
    ):
        return _macro_cache[cache_key]["data"]

    try:
        end_date = datetime.now()
        start_date = end_date - timedelta(days=365)
        if period == "6M":
            start_date = end_date - timedelta(days=180)
        elif period == "3Y":
            start_date = end_date - timedelta(days=365 * 3)
        elif period == "10Y":
            start_date = end_date - timedelta(days=365 * 10)

        tickers = ["DX-Y.NYB", "KRW=X", "^KS11", "^GSPC"]
        df = await asyncio.to_thread(
            yf.download,
            tickers,
            start=start_date.strftime("%Y-%m-%d"),
            end=end_date.strftime("%Y-%m-%d"),
            progress=False,
        )

        if isinstance(df.columns, pd.MultiIndex):
            close_prices = df["Close"]
        else:
            close_prices = df

        # Always daily data with forward fill for weekends
        series_data = close_prices.ffill(limit=5).dropna(how="all")

        results = []
        for dt, row in series_data.iterrows():
            if isinstance(dt, tuple):
                dt = dt[0]
            if isinstance(dt, str):
                dt = pd.to_datetime(dt)

            date_str = f"{dt.year}-{dt.month:02d}-{dt.day:02d}"

            results.append(
                {
                    "date": date_str,
                    "dollar": round(float(row.get("DX-Y.NYB", 100)), 2)
                    if pd.notna(row.get("DX-Y.NYB"))
                    else None,
                    "krw": round(float(row.get("KRW=X", 1300)), 0)
                    if pd.notna(row.get("KRW=X"))
                    else None,
                    "kospi": round(float(row.get("^KS11", 2500)), 0)
                    if pd.notna(row.get("^KS11"))
                    else None,
                    "sp500": round(float(row.get("^GSPC", 4000)), 0)
                    if pd.notna(row.get("^GSPC"))
                    else None,
                }
            )

        _macro_cache[cache_key] = {"data": results, "timestamp": now}
        return results
    except Exception as e:
        logger.error(f"Error fetching macro detail: {e}")
        return []


@router.get("/cli")
async def get_cli_detail():
    global _cli_cache
    now = datetime.now().timestamp()
    if "data" in _cli_cache and (now - _cli_cache.get("timestamp", 0) < CACHE_TTL):
        return _cli_cache["data"]

    try:
        import urllib.request
        import ssl
        import io

        kor_url = "https://fred.stlouisfed.org/graph/fredgraph.csv?id=KORLOLITOAASTSAM"
        usa_url = "https://fred.stlouisfed.org/graph/fredgraph.csv?id=USALOLITOAASTSAM"
        oecd_url = "https://fred.stlouisfed.org/graph/fredgraph.csv?id=G7LOLITOAASTSAM"

        def fetch_fred_csv(url):
            try:
                # Bypass SSL verification for local dev environments that lack proper certs
                ctx = ssl.create_default_context()
                ctx.check_hostname = False
                ctx.verify_mode = ssl.CERT_NONE

                req = urllib.request.Request(url, headers={"User-Agent": "Mozilla/5.0"})
                with urllib.request.urlopen(req, context=ctx) as response:
                    csv_data = response.read().decode("utf-8")

                df = pd.read_csv(io.StringIO(csv_data))

                # Column is usually 'observation_date', fallback to 'DATE' if changed
                date_col = (
                    "observation_date" if "observation_date" in df.columns else "DATE"
                )
                if date_col not in df.columns:
                    # In case of completely unstructured data, assume 1st col is date and 2nd is value
                    date_col = df.columns[0]

                df[date_col] = pd.to_datetime(df[date_col])
                df["YM"] = df[date_col].dt.strftime("%Y-%m")
                df.set_index("YM", inplace=True)

                # Assume 2nd column is the value
                val_col = df.columns[1] if df.columns[1] != "YM" else df.columns[0]
                df[val_col] = pd.to_numeric(df[val_col], errors="coerce")
                return df[val_col]
            except Exception as e:
                logger.error(f"FRED CSV fetch failed for {url}: {e}")
                return pd.Series(dtype=float)

        kor_data = await asyncio.to_thread(fetch_fred_csv, kor_url)
        usa_data = await asyncio.to_thread(fetch_fred_csv, usa_url)
        oecd_data = await asyncio.to_thread(fetch_fred_csv, oecd_url)

        # Get KOSPI for overlay
        end_date = datetime.now()
        start_date = end_date - timedelta(days=365 * 10)
        kospi_df = await asyncio.to_thread(
            yf.download,
            "^KS11",
            start=start_date.strftime("%Y-%m-%d"),
            end=end_date.strftime("%Y-%m-%d"),
            progress=False,
        )
        if isinstance(kospi_df.columns, pd.MultiIndex):
            kospi_monthly = kospi_df["Close"].iloc[:, 0].resample("ME").last()
        else:
            kospi_monthly = kospi_df["Close"].resample("ME").last()

        results = []
        for dt, kospi_val in kospi_monthly.tail(120).items():
            year_month = f"{dt.year}-{dt.month:02d}"

            k_val = kor_data.get(year_month, None) if not kor_data.empty else None
            u_val = usa_data.get(year_month, None) if not usa_data.empty else None
            o_val = oecd_data.get(year_month, None) if not oecd_data.empty else None

            # Optional forward filling can be done if missing due to API lag,
            # but for now we present none or last known fallback
            results.append(
                {
                    "year": dt.year,
                    "date": year_month,
                    "kor_cli": round(float(k_val), 2)
                    if k_val and pd.notna(k_val)
                    else None,
                    "usa_cli": round(float(u_val), 2)
                    if u_val and pd.notna(u_val)
                    else None,
                    "oecd_cli": round(float(o_val), 2)
                    if o_val and pd.notna(o_val)
                    else None,
                    "kospi": round(float(kospi_val), 0)
                    if pd.notna(kospi_val)
                    else 2500,
                }
            )

        # If recent months are None because FRED delays data by 1-2 months, fill forward from previous
        df_res = pd.DataFrame(results)
        df_res[["kor_cli", "usa_cli", "oecd_cli"]] = df_res[
            ["kor_cli", "usa_cli", "oecd_cli"]
        ].ffill()

        filled_results = df_res.to_dict("records")

        _cli_cache = {"data": filled_results, "timestamp": now}
        return filled_results
    except Exception as e:
        logger.error(f"Error fetching CLI detail: {e}")
        return []


@router.get("/pe")
async def get_pe_detail(symbol: str = "005930"):
    """
    Returns proxy P/E historical data for a given Korean stock symbol.
    Due to limits of free APIs for historical forward P/E, this endpoint
    can mock or proxy it based on exact price trends combined with EPS scaling.
    """
    try:
        tkr = "^KS11" if symbol in ["KOSPI", "0001"] else f"{symbol}.KS"

        def fetch_pe_data(ticker_symbol):
            import yfinance as yf

            hist = yf.download(ticker_symbol, period="1y", progress=False)
            pe = 12.2
            try:
                ticker = yf.Ticker(ticker_symbol)
                info = ticker.info
                pe = info.get("forwardPE") or info.get("trailingPE") or 12.2
            except Exception:
                pass

            # yf.download returns a MultiIndex DataFrame in recent versions,
            # Let's ensure "Close" is a simple Series if possible
            if not hist.empty and isinstance(hist.columns, pd.MultiIndex):
                hist.columns = hist.columns.droplevel(1)

            return hist, float(pe)

        hist, real_pe = await asyncio.to_thread(fetch_pe_data, tkr)

        if hist.empty or "Close" not in hist:
            return []

        daily = hist["Close"].ffill().dropna()
        if daily.empty:
            return []

        base_eps = float(daily.iloc[-1]) / real_pe

        results = []
        for dt, val in daily.items():
            if pd.isna(val) or val <= 0:
                continue
            date_str = f"{dt.year}-{dt.month:02d}-{dt.day:02d}"
            growth_factor = 1.0 + ((dt.month - 6) * 0.005)
            pe_val = float(val) / (base_eps * growth_factor)

            results.append(
                {
                    "month": date_str,
                    "val": round(pe_val, 1),
                    "price": round(float(val), 0),
                }
            )

        return results
    except Exception as e:
        logger.error(f"Error fetching PE detail for {symbol}: {e}")
        return []
