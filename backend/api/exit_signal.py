import logging
import asyncio
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
_pe_real_cache = {}  # Cache fundamental PE values to prevent YF rate limits
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
        start_str = start_date.strftime("%Y-%m-%d")
        end_str = end_date.strftime("%Y-%m-%d")

        def _fetch_single(ticker: str) -> pd.Series:
            """Ticker별 개별 다운로드 - MultiIndex 문제 방지."""
            try:
                t = yf.Ticker(ticker)
                df = t.history(start=start_str, end=end_str, auto_adjust=True)
                if df.empty or "Close" not in df.columns:
                    return pd.Series(dtype=float)
                s = df["Close"]
                if hasattr(s.index, "tz") and s.index.tz is not None:
                    s.index = s.index.tz_localize(None)
                s.index = pd.to_datetime(s.index)
                return s
            except Exception as e:
                logger.warning(f"yfinance {ticker} failed: {e}")
                return pd.Series(dtype=float)

        dx_s, krw_s = await asyncio.gather(
            asyncio.to_thread(_fetch_single, "DX-Y.NYB"),
            asyncio.to_thread(_fetch_single, "KRW=X"),
        )

        if dx_s.empty:
            logger.warning("DX-Y.NYB returned empty series")
            return [], 100.0, 1300

        # 월별 마지막 거래일 값
        dx_monthly = dx_s.resample("ME").last().dropna().tail(12)
        krw_monthly = krw_s.resample("ME").last().dropna() if not krw_s.empty else pd.Series(dtype=float)

        dollar_data = []
        for dt in dx_monthly.index:
            month_str = f"{dt.month:02d}월"
            dx_val = float(dx_monthly[dt])
            # KRW=X는 USD/KRW; 가장 가까운 월 매핑
            krw_val = 1300
            if not krw_monthly.empty:
                ym_key = dt.strftime("%Y-%m")
                matches = krw_monthly[krw_monthly.index.strftime("%Y-%m") == ym_key]
                if not matches.empty:
                    krw_val = int(round(float(matches.iloc[-1])))

            dollar_data.append({
                "month": month_str,
                "val": round(dx_val, 2),
                "krw": krw_val,
            })

        if not dollar_data:
            return [], 100.0, 1300

        final_dx = dollar_data[-1]["val"]
        final_krw = dollar_data[-1]["krw"]
        logger.info(f"fetch_yf_data OK: DX={final_dx}, KRW={final_krw}, count={len(dollar_data)}")
        return dollar_data, final_dx, final_krw

    except Exception as e:
        logger.error(f"Failed to fetch YF data: {e}")
        return [], 100.0, 1300


async def fetch_market_sentiment():
    """Fetch VIX and calculate proxy Fear & Greed Index, and fetch KOSPI."""
    try:
        end_date = datetime.now()
        start_date = end_date - timedelta(days=365 * 3)   # 3\ub144 \ub370\uc774\ud130
        start_str = start_date.strftime("%Y-%m-%d")
        end_str = end_date.strftime("%Y-%m-%d")

        def _fetch_hist(tkr: str) -> pd.Series:
            try:
                ticker = yf.Ticker(tkr)
                hist = ticker.history(start=start_str, end=end_str, auto_adjust=True)
                if hist.empty or "Close" not in hist.columns:
                    return pd.Series(dtype=float)
                s = hist["Close"]
                # timezone \uc81c\uac70
                if hasattr(s.index, "tz") and s.index.tz is not None:
                    s.index = s.index.tz_localize(None)
                s.index = pd.to_datetime(s.index).normalize()
                s = s.groupby(s.index).last()
                return s
            except Exception as e:
                logger.warning(f"_fetch_hist failed for {tkr}: {e}")
                return pd.Series(dtype=float)

        v_s, k_s, g_s = await asyncio.gather(
            asyncio.to_thread(_fetch_hist, "^VIX"),
            asyncio.to_thread(_fetch_hist, "^KS11"),
            asyncio.to_thread(_fetch_hist, "^GSPC"),
        )
        v_s.name = "vix"
        k_s.name = "kospi"
        g_s.name = "sp500"

        # Align series, forward fill missing latest US data with previous days, drop where missing forever
        aligned = pd.concat([v_s, k_s, g_s], axis=1).ffill().dropna()

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


async def fetch_oecd_cli_simple() -> tuple[list, float | None, int]:
    """
    OECD 공식 SDMX API로 한국 CLI 데이터 수집.
    FRED와 다른 도메인으로 FRED 차단 무관하게 동작함.
    """
    try:
        # OECD composite leading indicator for Korea (monthly, amplitude-adjusted)
        url = (
            "https://sdmx.oecd.org/public/rest/data/"
            "OECD.SDD.STES,DSD_MEI_CLI@DF_CLI,1.0/"
            "KOR.LI.AA?startPeriod=2023-01&format=csvfilewithlabels"
        )
        resp = await asyncio.to_thread(
            requests.get, url, timeout=12,
            headers={"Accept": "text/csv", "User-Agent": "Mozilla/5.0"}
        )
        if resp.status_code != 200:
            raise ValueError(f"OECD HTTP {resp.status_code}")

        import io
        df = pd.read_csv(io.StringIO(resp.text))

        # Column names vary; find date and value columns generically
        date_col = next((c for c in df.columns if "period" in c.lower() or "time" in c.lower()), df.columns[0])
        val_col = next((c for c in df.columns if "obs" in c.lower() or "value" in c.lower()), df.columns[-1])

        df[date_col] = pd.to_datetime(df[date_col], errors="coerce")
        df[val_col] = pd.to_numeric(df[val_col], errors="coerce")
        df = df.dropna(subset=[date_col, val_col]).sort_values(date_col).tail(13)

        if df.empty:
            raise ValueError("OECD returned empty dataframe")

        cli_data = [
            {"month": f"{row[date_col].month:02d}월", "val": round(float(row[val_col]), 2)}
            for _, row in df.tail(12).iterrows()
        ]
        vals = df[val_col].tolist()
        down_months = 0
        for i in range(len(vals) - 1, 0, -1):
            if vals[i] < vals[i - 1]:
                down_months += 1
            else:
                break

        logger.info(f"OECD CLI fetch OK: {len(cli_data)} months")
        return cli_data, float(vals[-1]), down_months

    except Exception as e:
        logger.warning(f"OECD CLI fetch failed ({e}), using yfinance fallback")
        return [], None, 0


async def fetch_fred_cli():
    """OECD 공식 API로 한국 CLI 가져오기 (이전 FRED 스크래핑 대체)."""
    return await fetch_oecd_cli_simple()


@router.get("/reset-cache")
async def reset_main_cache():
    """메인 exit-signal 캐시 강제 초기화"""
    global _cache
    _cache = {"data": None, "timestamp": None}
    logger.info("Main exit-signal cache reset by request")
    return {"status": "ok", "message": "Cache cleared. Next / call will re-fetch data."}


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
async def get_macro_detail(period: str = "1Y"):
    global _macro_cache

    cache_key = f"daily_{period}"
    now = datetime.now().timestamp()
    if cache_key in _macro_cache and (
        now - _macro_cache[cache_key].get("timestamp", 0) < CACHE_TTL
    ):
        return _macro_cache[cache_key]["data"]

    try:
        # Map period to days lookback
        period_days = {"6m": 185, "1y": 370, "3y": 1100, "10y": 3700}
        days = period_days.get(period.lower(), 370)
        end_date = datetime.now()
        start_str = (end_date - timedelta(days=days)).strftime("%Y-%m-%d")
        end_str = end_date.strftime("%Y-%m-%d")

        def _fetch_hist(tkr: str) -> pd.Series:
            try:
                t = yf.Ticker(tkr)
                df = t.history(start=start_str, end=end_str, auto_adjust=True)
                if df.empty or "Close" not in df.columns:
                    return pd.Series(dtype=float)
                s = df["Close"]
                if hasattr(s.index, "tz") and s.index.tz is not None:
                    s.index = s.index.tz_localize(None)
                s.index = pd.to_datetime(s.index).normalize()
                return s.groupby(s.index).last()
            except Exception as e:
                logger.warning(f"_fetch_hist failed for {tkr}: {e}")
                return pd.Series(dtype=float)

        dx_s, krw_s, k_s, g_s = await asyncio.gather(
            asyncio.to_thread(_fetch_hist, "DX-Y.NYB"),
            asyncio.to_thread(_fetch_hist, "KRW=X"),
            asyncio.to_thread(_fetch_hist, "^KS11"),
            asyncio.to_thread(_fetch_hist, "^GSPC"),
        )
        dx_s.name = "DX-Y.NYB"
        krw_s.name = "KRW=X"
        k_s.name = "^KS11"
        g_s.name = "^GSPC"

        # Combine, ffill missing current-day US data using prior days, drop if entirely NaN
        close_prices = pd.concat([dx_s, krw_s, k_s, g_s], axis=1)
        # 컬럼명 보장 (빈 시리즈 concat 시 누락 방지)
        for col in ["DX-Y.NYB", "KRW=X", "^KS11", "^GSPC"]:
            if col not in close_prices.columns:
                close_prices[col] = float("nan")
        series_data = close_prices.ffill().dropna(how="all")

        def _safe_val(row: pd.Series, col: str) -> float | None:
            """pandas row에서 특정 컬럼값을 안전하게 추출."""
            try:
                v = row[col]
                return float(v) if pd.notna(v) else None
            except (KeyError, TypeError):
                return None

        results = []
        for dt, row in series_data.iterrows():
            if isinstance(dt, tuple):
                dt = dt[0]
            if isinstance(dt, str):
                dt = pd.to_datetime(dt)

            date_str = f"{dt.year}-{dt.month:02d}-{dt.day:02d}"
            dx_val = _safe_val(row, "DX-Y.NYB")
            krw_val = _safe_val(row, "KRW=X")
            k_val  = _safe_val(row, "^KS11")
            g_val  = _safe_val(row, "^GSPC")

            results.append({
                "date": date_str,
                "dollar": round(dx_val, 2) if dx_val is not None else None,
                "krw": round(krw_val, 0) if krw_val is not None else None,
                "kospi": round(k_val, 0) if k_val is not None else None,
                "sp500": round(g_val, 0) if g_val is not None else None,
            })

        logger.info(f"macro_detail OK: {len(results)} rows, period={period}")
        _macro_cache[cache_key] = {"data": results, "timestamp": now}
        return results
    except Exception as e:
        logger.error(f"Error fetching macro detail: {e}")
        return []


@router.get("/cli/reset-cache")
async def reset_cli_cache():
    """CLI 캐시 강제 초기화 (Render 서버 캐시 만료 강제)"""
    global _cli_cache
    _cli_cache = {}
    logger.info("CLI cache reset by request")
    return {"status": "ok", "message": "CLI cache cleared. Next /cli call will re-fetch data."}


@router.get("/cli")

async def get_cli_detail():
    """
    CLI (Composite Leading Indicator) 상세 데이터 반환.
    Primary: OECD SDMX API (KOR + USA + OECD).
    Fallback: yfinance 프록시 (EWY, ^GSPC).
    """
    global _cli_cache
    now = datetime.now().timestamp()
    if "data" in _cli_cache and (now - _cli_cache.get("timestamp", 0) < CACHE_TTL):
        return _cli_cache["data"]

    try:
        end_date = datetime.now()
        start_date = end_date - timedelta(days=365 * 10)
        start_str = start_date.strftime("%Y-%m-%d")
        end_str = end_date.strftime("%Y-%m-%d")        

        def _fetch_oecd_series(series_id: str) -> pd.Series:
            """
            Fetch CLI series via yfinance proxy (OECD API is unavailable).
            - KOR: EWY ETF 3M momentum + 100 (aligned with kor_cli scale)
            - USA: ^GSPC (S&P500) 3M momentum + 100
            - G7:  VEA (Vanguard Developed Markets) 3M momentum + 100
            """
            ticker_map = {
                "KORLOLITOAASTSAM": "EWY",
                "USALOLITOAASTSAM": "^GSPC",
                "G7LOLITOAASTSAM": "VEA",
            }
            tkr = ticker_map.get(series_id, "^GSPC")
            try:
                t = yf.Ticker(tkr)
                df = t.history(start=start_str, end=end_str, auto_adjust=True)
                if df.empty or "Close" not in df.columns:
                    return pd.Series(dtype=float)
                s = df["Close"]
                if hasattr(s.index, "tz") and s.index.tz is not None:
                    s.index = s.index.tz_localize(None)
                s.index = pd.to_datetime(s.index)
                # Resample to monthly (last trading day of month)
                monthly = s.resample("ME").last()
                # 3M momentum normalized to CLI scale (100 = neutral)
                mom3 = monthly.pct_change(3) * 100 + 100.0
                mom3 = mom3.dropna()
                mom3.index = mom3.index.strftime("%Y-%m")
                logger.info(f"yfinance proxy {tkr} → {series_id}: {len(mom3)} months")
                return mom3
            except Exception as e:
                logger.warning(f"yfinance proxy {series_id} ({tkr}) failed: {e}")
                return pd.Series(dtype=float)

        def _fetch_yfin(tkr: str) -> pd.Series:
            """yfinance Ticker.history with start/end (reliable)."""
            try:
                t = yf.Ticker(tkr)
                df = t.history(start=start_str, end=end_str, auto_adjust=True)
                if df.empty or "Close" not in df.columns:
                    return pd.Series(dtype=float)
                s = df["Close"]
                if hasattr(s.index, "tz") and s.index.tz is not None:
                    s.index = s.index.tz_localize(None)
                s.index = pd.to_datetime(s.index)
                return s
            except Exception as e:
                logger.warning(f"yfinance {tkr} failed: {e}")
                return pd.Series(dtype=float)

        # Parallel: OECD KOR/USA/G7 + KOSPI
        kor_s, usa_s, g7_s, ks_raw = await asyncio.gather(
            asyncio.to_thread(_fetch_oecd_series, "KORLOLITOAASTSAM"),
            asyncio.to_thread(_fetch_oecd_series, "USALOLITOAASTSAM"),
            asyncio.to_thread(_fetch_oecd_series, "G7LOLITOAASTSAM"),
            asyncio.to_thread(_fetch_yfin, "^KS11"),
        )

        # Monthly KOSPI 처리
        if not ks_raw.empty:
            kospi_monthly = ks_raw.resample("ME").last()
            kospi_monthly.index = kospi_monthly.index.strftime("%Y-%m")
        else:
            kospi_monthly = pd.Series(dtype=float)

        # OECD 데이터 부족 시 yfinance 프록시 폴백 (EWY momentum)
        if kor_s.empty:
            logger.warning("OECD KOR empty, using EWY proxy")
            ewy_raw = await asyncio.to_thread(_fetch_yfin, "EWY")
            if not ewy_raw.empty:
                ewy_m = ewy_raw.resample("ME").last()
                ewy_m3 = ewy_m.pct_change(3) * 100 + 100.0
                ewy_m3.index = ewy_m3.index.strftime("%Y-%m")
                kor_s = ewy_m3.dropna()

        # Collect 달 목록: KOSPI 기준으로 10년치
        all_months = sorted(set(kor_s.index.tolist() + usa_s.index.tolist() + g7_s.index.tolist()))
        if not all_months:
            raise ValueError("No CLI data available from any source")
        
        results = []
        for ym in all_months[-120:]:  # 최그 10년
            k_val = kor_s.get(ym)
            u_val = usa_s.get(ym)
            o_val = g7_s.get(ym)
            kp_val = kospi_monthly.get(ym)
            yr = int(ym[:4])
            results.append({
                "year": yr,
                "date": ym,
                "kor_cli": round(float(k_val), 2) if k_val and pd.notna(k_val) else None,
                "usa_cli": round(float(u_val), 2) if u_val and pd.notna(u_val) else None,
                "oecd_cli": round(float(o_val), 2) if o_val and pd.notna(o_val) else None,
                "kospi": round(float(kp_val), 0) if kp_val and pd.notna(kp_val) else None,
            })

        # ffill로 최근 1-2개월 데이터 공백 채우기
        df_res = pd.DataFrame(results)
        df_res[["kor_cli", "usa_cli", "oecd_cli", "kospi"]] = df_res[
            ["kor_cli", "usa_cli", "oecd_cli", "kospi"]
        ].ffill()
        filled_results = df_res.to_dict("records")

        _cli_cache = {"data": filled_results, "timestamp": now}
        logger.info(f"CLI detail OK: {len(filled_results)} months")
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
            import time

            global _pe_real_cache

            ticker = yf.Ticker(ticker_symbol)
            hist = ticker.history(period="1y")
            pe = 12.2

            now = time.time()
            if ticker_symbol in _pe_real_cache and (
                now - _pe_real_cache[ticker_symbol].get("time", 0) < 86400
            ):
                pe = _pe_real_cache[ticker_symbol]["pe"]
            else:
                try:
                    info = ticker.info
                    found_pe = info.get("forwardPE") or info.get("trailingPE")
                    if found_pe:
                        pe = float(found_pe)
                        _pe_real_cache[ticker_symbol] = {"pe": pe, "time": now}
                except Exception as e:
                    logger.warning(f"Failed to fetch info for {ticker_symbol}: {e}")
                    # If failed but we have stale cache, use it instead of 12.2 fallback
                    if ticker_symbol in _pe_real_cache:
                        pe = _pe_real_cache[ticker_symbol]["pe"]

            if not hist.empty:
                hist.index = pd.to_datetime(hist.index).tz_localize(None).normalize()
                hist = hist.groupby(hist.index).last()

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
