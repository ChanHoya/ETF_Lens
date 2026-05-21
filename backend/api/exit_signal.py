import logging
import asyncio
import requests
import yfinance as yf
from datetime import datetime, timedelta, timezone as _tz
from fastapi import APIRouter
import pandas as pd
from core.quant_sentiment import calculate_realized_volatility, calculate_rsi, calculate_hybrid_fgi

logger = logging.getLogger(__name__)

router = APIRouter(tags=["exit_signal"])

# Cache variables to prevent hitting rate limits
_cache = {"data": None, "timestamp": None}
_macro_cache = {}
_cli_cache = {}
_pe_real_cache = {}  # Cache fundamental PE values to prevent YF rate limits

# ── KST 날짜 헬퍼 ──────────────────────────────────────────────────────────
# Render 서버가 UTC 기준 구동되므로 한국 시각(KST=UTC+9)을
# 명시해야 KOSPI/KODEX 등 한국 오늘 데이터가 누락되지 않음.
_KST = _tz(timedelta(hours=9))


def _kst_now() -> datetime:
    """KST 기준 현재 시각 (tz-aware)"""
    return datetime.now(_KST)


def _kst_cutoff(days: int) -> datetime:
    """KST 기준 N일 전 (tz-naive, cutoff 비교용)"""
    return (_kst_now() - timedelta(days=days)).replace(tzinfo=None)


def _kst_end_str() -> str:
    """yfinance end 파라미터용 KST+2일 (exclusive + 시차 보정)"""
    return (_kst_now() + timedelta(days=2)).strftime("%Y-%m-%d")


def _kst_start_str(days: int) -> str:
    """KST 기준 N일 전 날짜"""
    return (_kst_now() - timedelta(days=days)).strftime("%Y-%m-%d")
# ──────────────────────────────────────────────────────────


def _get_cache_ttl() -> int:
    """미국 장 상태에 따른 스마트 캐시 TTL 반환.
    - KST 06:00~22:30: 미장 마감 후 오전 시간대 → 4시간 캐시
    - KST 22:30~06:00: 미장 진행 중 또는 프리마켓 → 1시간 캐시
    미국 EST 기준 시장: 09:30~16:00 = KST 23:30~06:00(다음날)
    """
    from datetime import timezone, timedelta
    kst_hour = datetime.now(timezone(timedelta(hours=9))).hour
    if 6 <= kst_hour < 22:
        return 3600 * 4  # 미장 마감 후 → 4시간
    return 3600  # 미장 진행 중 → 1시간


CACHE_TTL = None  # 하위 호환성 유지 (사용 안 함, _get_cache_ttl() 사용)


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


async def _fetch_fred_series(fred_id: str, days: int = 400) -> dict[str, float]:
    """FRED CSV API로 데이터 가져오기 → {YYYY-MM-DD: float}"""
    try:
        end_str = _kst_now().strftime("%Y-%m-%d")  # KST 기준 오늘
        url = f"https://fred.stlouisfed.org/graph/fredgraph.csv?id={fred_id}&vintage_date={end_str}"
        resp = await asyncio.to_thread(
            lambda: __import__("requests").get(url, timeout=15)
        )
        if resp.status_code != 200:
            logger.warning(f"FRED {fred_id} status={resp.status_code}")
            return {}
        cutoff = _kst_cutoff(days)  # KST 기준 cutoff
        result = {}
        for line in resp.text.strip().split("\n")[1:]:  # skip header
            parts = line.split(",")
            if len(parts) < 2:
                continue
            date_str, val_str = parts[0].strip(), parts[1].strip()
            if val_str == "." or not val_str:
                continue
            try:
                dt = pd.to_datetime(date_str)
                if dt < pd.Timestamp(cutoff):
                    continue
                result[date_str] = float(val_str)
            except (ValueError, Exception):
                continue
        return result
    except Exception as e:
        logger.warning(f"FRED {fred_id} failed: {e}")
        return {}


async def _fetch_yahoo_v8(symbol: str, days: int = 400) -> dict[str, float]:
    """Yahoo Finance v8 chart API → {YYYY-MM-DD: float}"""
    try:
        rng = "1y" if days <= 400 else ("3y" if days <= 1200 else "10y")
        url = f"https://query1.finance.yahoo.com/v8/finance/chart/{symbol}?interval=1d&range={rng}"
        headers = {"User-Agent": "Mozilla/5.0"}
        resp = await asyncio.to_thread(
            lambda: __import__("requests").get(url, headers=headers, timeout=15)
        )
        if resp.status_code != 200:
            logger.warning(f"Yahoo v8 {symbol} status={resp.status_code}")
            return {}
        data = resp.json()
        result_block = data.get("chart", {}).get("result", [])
        if not result_block:
            return {}
        rb = result_block[0]
        timestamps = rb.get("timestamp", [])
        closes = rb.get("indicators", {}).get("quote", [{}])[0].get("close", [])
        # KST 기준 cutoff 계산 (tz-aware)
        cutoff_kst = _kst_now() - timedelta(days=days)
        result = {}
        for ts, close in zip(timestamps, closes):
            if close is None or not isinstance(close, (int, float)):
                continue
            # UTC timestamp → KST 날짜 변환 (한국 자산 당일 나타날 수 있도록)
            dt_utc = datetime.fromtimestamp(ts, tz=_tz.utc)
            dt_kst = dt_utc.astimezone(_KST)
            if dt_kst < cutoff_kst:
                continue
            result[dt_kst.strftime("%Y-%m-%d")] = float(close)
        return result
    except Exception as e:
        logger.warning(f"Yahoo v8 {symbol} failed: {e}")
        return {}


async def fetch_yf_data():
    """달러 인덱스(FRED) + 환율(Yahoo v8)를 월별 집계해 반환."""
    try:
        # FRED DTWEXBGS = Trade Weighted US Dollar Index: Broad
        dx_dict, krw_dict = await asyncio.gather(
            _fetch_fred_series("DTWEXBGS", days=400),
            _fetch_yahoo_v8("KRW=X", days=400),
        )

        if not dx_dict:
            logger.warning("FRED DTWEXBGS empty, using fallback 100.0")
            return [], 100.0, 1300

        # 월별 마지막값 집계
        def _monthly_last(d: dict[str, float]) -> dict[str, float]:
            monthly: dict[str, float] = {}
            for date_str, val in sorted(d.items()):
                ym = date_str[:7]  # YYYY-MM
                monthly[ym] = val  # 마지막 값으로 덮어씌움
            return monthly

        dx_mo  = _monthly_last(dx_dict)
        krw_mo = _monthly_last(krw_dict)

        # 최근 12개월
        all_yms = sorted(set(dx_mo) | set(krw_mo))[-12:]
        dollar_data = []
        for ym in all_yms:
            month_str = f"{int(ym[5:7]):02d}월"
            dx_val = dx_mo.get(ym)
            krw_val = krw_mo.get(ym)
            if dx_val is None:
                continue
            dollar_data.append({
                "month": month_str,
                "val": round(dx_val, 2),
                "krw": int(round(krw_val)) if krw_val else 1300,
            })

        if not dollar_data:
            return [], 100.0, 1300

        final_dx = dollar_data[-1]["val"]
        final_krw = dollar_data[-1]["krw"]
        logger.info(f"fetch_yf_data OK: DX={final_dx}, KRW={final_krw}, count={len(dollar_data)}")
        return dollar_data, final_dx, final_krw

    except Exception as e:
        logger.error(f"fetch_yf_data failed: {e}")
        return [], 100.0, 1300


async def fetch_market_sentiment():
    """Fetch VIX and calculate proxy Fear & Greed Index, and fetch KOSPI/S&P500.
    yfinance 대신 Yahoo Finance v8 chart API 사용 (Render에서 yfinance rate limit 회피).
    """
    try:
        def _yv8(symbol: str) -> pd.Series:
            """Yahoo Finance v8 chart API → pd.Series (EST 날짜 인덱스, Close 값)."""
            try:
                sym_enc = symbol.replace("^", "%5E")
                url = f"https://query1.finance.yahoo.com/v8/finance/chart/{sym_enc}?interval=1d&range=3y"
                r = requests.get(url, headers={"User-Agent": "Mozilla/5.0"}, timeout=15)
                if r.status_code != 200:
                    logger.warning(f"Yahoo v8 {symbol} status={r.status_code}")
                    return pd.Series(dtype=float)
                rb = r.json().get("chart", {}).get("result", [])
                if not rb:
                    return pd.Series(dtype=float)
                ts = rb[0].get("timestamp", [])
                cls = rb[0].get("indicators", {}).get("quote", [{}])[0].get("close", [])
                # EST(UTC-5) 기준으로 날짜 변환 (미국 장 날짜 정확히 반영)
                from datetime import timezone, timedelta as _td
                est = timezone(_td(hours=-5))
                rows = {}
                for t, c in zip(ts, cls):
                    if c is None:
                        continue
                    dt_est = datetime.fromtimestamp(t, tz=timezone.utc).astimezone(est)
                    rows[pd.Timestamp(dt_est.date())] = float(c)
                s = pd.Series(rows)
                s.index = pd.DatetimeIndex(s.index)
                return s.sort_index()
            except Exception as e:
                logger.warning(f"Yahoo v8 {symbol} failed: {e}")
                return pd.Series(dtype=float)

        v_s, k_s, g_s = await asyncio.gather(
            asyncio.to_thread(_yv8, "^VIX"),
            asyncio.to_thread(_yv8, "^KS11"),
            asyncio.to_thread(_yv8, "^GSPC"),
        )
        v_s.name = "vix"
        k_s.name = "kospi"
        g_s.name = "sp500"

        # 퀀트 계산: KOSPI 20일 실현 변동성 및 S&P 500 14일 RSI 산출
        kospi_rv_s = calculate_realized_volatility(k_s, window=20)
        kospi_rv_s.name = "vkospi_proxy"
        sp500_rsi_s = calculate_rsi(g_s, window=14)
        sp500_rsi_s.name = "sp500_rsi"

        # VIX 기준으로 인덱스 설정 (미국 영업일 기준)
        # KOSPI 및 변동성 지수들은 미국 장에 없는 날(한국 공휴일 등)은 전일 값으로 채움
        aligned = pd.concat([v_s, k_s, g_s, kospi_rv_s, sp500_rsi_s], axis=1)
        aligned["vix"] = aligned["vix"].ffill()
        aligned["sp500"] = aligned["sp500"].ffill()
        aligned["kospi"] = aligned["kospi"].ffill()
        aligned["vkospi_proxy"] = aligned["vkospi_proxy"].ffill().fillna(15.0)
        aligned["sp500_rsi"] = aligned["sp500_rsi"].ffill().fillna(50.0)

        # VIX가 있는 날(미국 영업일)만 유지
        aligned = aligned[aligned["vix"].notna()].copy()

        if aligned.empty:
            return [], 20.0, 15.0, 50.0

        sentiment_data = []

        for dt, row in aligned.iterrows():
            if isinstance(dt, tuple):
                dt = dt[0]
            if isinstance(dt, str):
                dt = pd.to_datetime(dt)
            vix_val = float(row["vix"])
            kospi_val = float(row["kospi"]) if pd.notna(row.get("kospi")) else 0.0
            sp500_val = float(row["sp500"]) if pd.notna(row.get("sp500")) else 0.0
            kospi_rv_val = float(row["vkospi_proxy"])
            sp500_rsi_val = float(row["sp500_rsi"])

            # 하이브리드 다차원 FGI 산출식 적용
            fgi_val = calculate_hybrid_fgi(vix_val, kospi_rv_val, sp500_rsi_val)

            sentiment_data.append(
                {
                    "date": dt.strftime("%Y-%m-%d"),
                    "vix": round(vix_val, 2),
                    "vkospi_proxy": round(kospi_rv_val, 2),
                    "fgi": round(fgi_val, 1),
                    "kospi": round(kospi_val, 2),
                    "sp500": round(sp500_val, 2),
                }
            )

        final_vix = sentiment_data[-1]["vix"]
        final_vkospi_proxy = sentiment_data[-1]["vkospi_proxy"]
        final_fgi = sentiment_data[-1]["fgi"]

        return sentiment_data, final_vix, final_vkospi_proxy, final_fgi
    except Exception as e:
        logger.error(f"Failed to fetch Sentiment data: {e}")
        return [], 20.0, 15.0, 50.0


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


@router.get("/history")
async def get_market_sentiment_history(period: str = "1Y"):
    """DB에 적재된 마켓 센티먼트(VIX, VKOSPI Proxy, FGI 등) 시계열 로그 반환"""
    try:
        from db.database import AsyncSessionLocal
        from db.models import MarketSentimentLog
        from sqlalchemy import select
        
        limit_days = 250
        if period == "6M": limit_days = 125
        elif period == "1Y": limit_days = 250
        elif period == "3Y": limit_days = 750
        elif period == "10Y": limit_days = 2500
        
        async with AsyncSessionLocal() as db:
            result = await db.execute(
                select(MarketSentimentLog)
                .order_by(MarketSentimentLog.date.desc())
                .limit(limit_days)
            )
            records = result.scalars().all()
            
        # UI 차트 포맷에 맞춤 (오래된 순)
        records.reverse()
        return [
            {
                "date": r.date,
                "vix": r.vix,
                "vkospi_proxy": r.vkospi_proxy,
                "fgi": r.fgi,
                "kospi": r.kospi,
                "sp500": r.sp500
            }
            for r in records
        ]
    except Exception as e:
        logger.error(f"Failed to fetch market sentiment history: {e}")
        return []


async def seed_market_sentiment_db_if_empty():
    """DB에 마켓 센티먼트 히스토리가 없는 경우 야후 파이낸스 3년 데이터를 기반으로 자동 시딩을 진행합니다."""
    try:
        from db.database import AsyncSessionLocal
        from db.models import MarketSentimentLog
        from sqlalchemy import select, func
        
        async with AsyncSessionLocal() as db:
            count_res = await db.execute(select(func.count(MarketSentimentLog.id)))
            count = count_res.scalar()
            if count and count > 0:
                return
                
            logger.info("[DB Seeding] MarketSentimentLog is empty. Starting 3-year history seeding...")
            sentiment_data, _, _, _ = await fetch_market_sentiment()
            if not sentiment_data:
                logger.warning("[DB Seeding] No sentiment data retrieved from Yahoo, skipping seed.")
                return
                
            db_entries = []
            for item in sentiment_data:
                db_entries.append(
                    MarketSentimentLog(
                        date=item["date"],
                        vix=item["vix"],
                        vkospi_proxy=item["vkospi_proxy"],
                        fgi=item["fgi"],
                        kospi=item["kospi"],
                        sp500=item["sp500"]
                    )
                )
            db.add_all(db_entries)
            await db.commit()
            logger.info(f"[DB Seeding] Successfully seeded {len(db_entries)} market sentiment records.")
    except Exception as e:
        logger.error(f"[DB Seeding] Seeding failed: {e}")


async def seed_us_macro_db_if_empty():
    try:
        from db.database import AsyncSessionLocal
        from db.models import USMacroIndicatorLog
        from sqlalchemy import select, func
        
        async with AsyncSessionLocal() as db:
            count_res = await db.execute(select(func.count(USMacroIndicatorLog.id)))
            count = count_res.scalar()
            if count and count > 0:
                return
                
            logger.info("[DB Seeding] USMacroIndicatorLog is empty. Starting FRED US macro seeding...")
            await sync_us_macro_indicators_job()
    except Exception as e:
        logger.error(f"[DB Seeding] US Macro seeding check failed: {e}")


@router.get("")
async def get_exit_signal_data():
    global _cache
    now = datetime.now().timestamp()

    # 1회성 DB 자동 시딩 실행
    await seed_market_sentiment_db_if_empty()
    await seed_us_macro_db_if_empty()

    if (
        _cache["data"]
        and _cache["timestamp"]
        and (now - _cache["timestamp"] < _get_cache_ttl())
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

        sentiment_data, current_vix, current_vkospi, current_fgi = await fetch_market_sentiment()
        if sentiment_data:
            mock["indicators"]["sentiment"] = sentiment_data
            mock["current_status"]["vix"] = current_vix
            mock["current_status"]["vkospi_proxy"] = current_vkospi
            mock["current_status"]["fgi"] = current_fgi

        # ── 신규 2개 지표 수집 (T10Y2Y, BAMLH0A0HYM2) ──────────────────────────
        t10y2y_dict = await _fetch_fred_series("T10Y2Y", days=400)
        hy_dict = await _fetch_fred_series("BAMLH0A0HYM2", days=400)

        # 월별 마지막값 집계용 로컬 helper
        def _monthly_last_local(d: dict[str, float]) -> dict[str, float]:
            monthly: dict[str, float] = {}
            for date_str, val in sorted(d.items()):
                ym = date_str[:7]
                monthly[ym] = val
            return monthly

        # 최근 12개월 월별 추이 집계
        t10y2y_mo = _monthly_last_local(t10y2y_dict) if t10y2y_dict else {}
        hy_mo = _monthly_last_local(hy_dict) if hy_dict else {}

        all_yms_t10y2y = sorted(t10y2y_mo.keys())[-12:]
        t10y2y_data = [{"month": f"{int(ym[5:7]):02d}월", "val": round(t10y2y_mo[ym], 2)} for ym in all_yms_t10y2y]

        all_yms_hy = sorted(hy_mo.keys())[-12:]
        hy_data = [{"month": f"{int(ym[5:7]):02d}월", "val": round(hy_mo[ym], 2)} for ym in all_yms_hy]

        mock["indicators"]["t10y2y"] = t10y2y_data
        mock["indicators"]["hy_spread"] = hy_data

        # 현재값 및 과거 180일 역전 여부 산출
        current_t10y2y = 1.0
        t10y2y_was_inverted = False
        if t10y2y_dict:
            sorted_dates = sorted(t10y2y_dict.keys())
            current_t10y2y = t10y2y_dict[sorted_dates[-1]]
            # 최근 180일 역전 감지 (0.0 미만이 아니라 -0.1 기준 검사)
            for d in sorted_dates:
                cutoff_180 = datetime.now() - timedelta(days=180)
                if pd.to_datetime(d) >= pd.Timestamp(cutoff_180.date()):
                    if t10y2y_dict[d] < -0.1:
                        t10y2y_was_inverted = True
                        break

        current_hy = 3.0
        if hy_dict:
            sorted_dates_hy = sorted(hy_dict.keys())
            current_hy = hy_dict[sorted_dates_hy[-1]]

        mock["current_status"]["t10y2y"] = round(current_t10y2y, 2)
        mock["current_status"]["hy_spread"] = round(current_hy, 2)
        # ───────────────────────────────────────────────────────────────────────

        # DB에 오늘의 sentiment 기록 저장 (중복 방지)
        try:
            from db.database import AsyncSessionLocal
            from db.models import MarketSentimentLog
            from sqlalchemy import select
            
            today_str = datetime.now(_KST).strftime("%Y-%m-%d")
            async with AsyncSessionLocal() as db:
                exist_res = await db.execute(
                    select(MarketSentimentLog).where(MarketSentimentLog.date == today_str)
                )
                exist_rec = exist_res.scalars().first()
                if not exist_rec:
                    log_entry = MarketSentimentLog(
                        date=today_str,
                        vix=current_vix,
                        vkospi_proxy=current_vkospi,
                        fgi=current_fgi,
                        kospi=sentiment_data[-1]["kospi"] if sentiment_data else None,
                        sp500=sentiment_data[-1]["sp500"] if sentiment_data else None
                    )
                    db.add(log_entry)
                    await db.commit()
                    logger.info(f"[DB] Persisted market sentiment for {today_str}")
        except Exception as db_err:
            logger.error(f"Failed to persist market sentiment log to DB: {db_err}")

        _cache["data"] = mock
        _cache["timestamp"] = now

    except Exception as e:
        logger.error(f"Error compiling exit signal data: {e}")

    # ── 종합 위험도 산출 ──────────────────────────────────────────────────────
    cs = mock.get("current_status", {})
    vix = cs.get("vix") or 0
    vkospi = cs.get("vkospi_proxy") or 15.0
    fgi = cs.get("fgi") or 50
    cli = cs.get("cli") or 100
    per = cs.get("per") or 12
    t10y2y = cs.get("t10y2y") or 1.0
    hy_spread = cs.get("hy_spread") or 3.0

    def _vix_score(v):
        if v < 20: return 0
        if v < 25: return 1
        if v < 30: return 2
        return 3

    def _vkospi_score(vk):
        if vk < 15: return 0
        if vk < 20: return 1
        if vk < 25: return 2
        return 3

    def _fgi_score(f):
        if f >= 50: return 0
        if f >= 30: return 1
        if f >= 25: return 2
        return 3

    def _cli_score(c):
        if c >= 100.5: return 0
        if c >= 100.0: return 1
        if c >= 99.5: return 2
        return 3

    def _per_score(p):
        if p < 11: return 0
        if p < 13: return 1
        if p < 15: return 2
        return 3

    def _t10y2y_score(t, was_inv):
        if t >= 0.0:
            if was_inv:
                return 3  # Steepening Reversal
            return 0
        if t >= -0.4:
            return 1
        return 2

    def _hy_score(h):
        if h < 3.5: return 0
        if h < 5.0: return 1
        if h < 6.5: return 2
        return 3

    t10y2y_was_inverted = False
    if 't10y2y_dict' in locals() and t10y2y_dict:
        sorted_dates = sorted(t10y2y_dict.keys())
        for d in sorted_dates:
            cutoff_180 = datetime.now() - timedelta(days=180)
            if pd.to_datetime(d) >= pd.Timestamp(cutoff_180.date()):
                if t10y2y_dict[d] < -0.1:
                    t10y2y_was_inverted = True
                    break

    score_vix = _vix_score(vix)
    score_vkospi = _vkospi_score(vkospi)
    score_fgi = _fgi_score(fgi)
    score_cli = _cli_score(cli)
    score_per = _per_score(per)
    score_t10y2y = _t10y2y_score(t10y2y, t10y2y_was_inverted)
    score_hy = _hy_score(hy_spread)

    # 7대 지표 총합 최대 21점
    total_score = score_vix + score_vkospi + score_fgi + score_cli + score_per + score_t10y2y + score_hy
    
    # 0~4: 안전, 5~8: 주의, 9~14: 경계, 15~21: 위험
    if total_score <= 4:
        risk_level = "safe"
        risk_label = "안전"
        risk_color = "green"
    elif total_score <= 8:
        risk_level = "caution"
        risk_label = "주의"
        risk_color = "yellow"
    elif total_score <= 14:
        risk_level = "warning"
        risk_label = "경계"
        risk_color = "orange"
    else:
        risk_level = "danger"
        risk_label = "위험"
        risk_color = "red"

    mock["risk"] = {
        "level": risk_level,
        "label": risk_label,
        "color": risk_color,
        "score": total_score,
        "max_score": 21,
        "breakdown": {
            "vix": {"value": round(vix, 1), "score": score_vix, "label": "VIX 공포지수"},
            "vkospi_proxy": {"value": round(vkospi, 1), "score": score_vkospi, "label": "VKOSPI 변동성"},
            "fgi": {"value": round(fgi, 1), "score": score_fgi, "label": "공포-탐욕 지수"},
            "cli": {"value": round(cli, 2), "score": score_cli, "label": "경기선행지수(CLI)"},
            "per": {"value": round(per, 1), "score": score_per, "label": "KOSPI PER"},
            "t10y2y": {"value": round(t10y2y, 2), "score": score_t10y2y, "label": "미 장단기 금리차"},
            "hy_spread": {"value": round(hy_spread, 2), "score": score_hy, "label": "미 하이일드 스프레드"},
        },
    }
    # ─────────────────────────────────────────────────────────────────────────

    return mock


@router.get("/macro/debug-dx")
async def debug_dx():
    """Render에서 FRED DTWEXBGS 직접 테스트 (디버그 전용). v2=FRED."""
    import traceback
    try:
        fred_dict = await _fetch_fred_series("DTWEXBGS", days=30)
        krw_dict  = await _fetch_yahoo_v8("KRW=X", days=30)
        return {
            "version": "FRED+YahooV8",
            "fred_count": len(fred_dict),
            "fred_last": list(fred_dict.items())[-3:] if fred_dict else [],
            "krw_count": len(krw_dict),
            "krw_last": list(krw_dict.items())[-3:] if krw_dict else [],
        }
    except Exception as e:
        return {"error": str(e), "traceback": traceback.format_exc()}


@router.get("/macro")

async def get_macro_detail(period: str = "1Y"):
    global _macro_cache

    cache_key = f"daily_{period}"
    now = datetime.now().timestamp()
    if cache_key in _macro_cache and (
        now - _macro_cache[cache_key].get("timestamp", 0) < _get_cache_ttl()
    ):
        return _macro_cache[cache_key]["data"]

    try:
        # Map period to days lookback
        period_days = {"6m": 185, "1y": 370, "3y": 1100, "10y": 3700}
        days = period_days.get(period.lower(), 370)

        # FRED(달러인덱스) + Yahoo v8(KRW, KOSPI, S&P500) 병렬 수집
        dx_dict, krw_dict, k_dict, g_dict = await asyncio.gather(
            _fetch_fred_series("DTWEXBGS", days=days),
            _fetch_yahoo_v8("KRW=X", days=days),
            _fetch_yahoo_v8("%5EKS11", days=days),   # ^KS11 URL 인코딩
            _fetch_yahoo_v8("%5EGSPC", days=days),   # ^GSPC URL 인코딩
        )

        # 모든 날짜 합집합
        all_dates = sorted(set(dx_dict) | set(krw_dict) | set(k_dict) | set(g_dict))
        if not all_dates:
            logger.warning("macro_detail: no data from any source")
            return []

        # ffill 구현 (이전 유효값 유지)
        def _ffill_dict(d: dict, dates: list[str]) -> dict[str, float]:
            last = None
            result: dict[str, float] = {}
            for dt in dates:
                if dt in d:
                    last = d[dt]
                if last is not None:
                    result[dt] = last
            return result

        dx_ff  = _ffill_dict(dx_dict,  all_dates)
        krw_ff = _ffill_dict(krw_dict, all_dates)
        k_ff   = _ffill_dict(k_dict,   all_dates)
        g_ff   = _ffill_dict(g_dict,   all_dates)

        results = []
        for date_str in all_dates:
            results.append({
                "date":   date_str,
                "dollar": round(dx_ff[date_str],  2) if date_str in dx_ff  else None,
                "krw":    round(krw_ff[date_str], 0) if date_str in krw_ff else None,
                "kospi":  round(k_ff[date_str],   0) if date_str in k_ff   else None,
                "sp500":  round(g_ff[date_str],   0) if date_str in g_ff   else None,
            })

        # dollar 있는 항목만 카운트 (로그)
        n_dollar = sum(1 for r in results if r["dollar"] is not None)
        logger.info(f"macro_detail OK: {len(results)} rows, dollar={n_dollar}, period={period}")
        _macro_cache[cache_key] = {"data": results, "timestamp": now}
        return results
    except Exception as e:
        logger.error(f"Error fetching macro detail: {e}", exc_info=True)
        return []


@router.get("/macro/reset-cache")
async def reset_macro_cache():
    """macro 캐시 강제 초기화"""
    global _macro_cache
    _macro_cache = {}
    logger.info("Macro cache reset by request")
    return {"status": "ok", "message": "Macro cache cleared."}


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
    if "data" in _cli_cache and (now - _cli_cache.get("timestamp", 0) < _get_cache_ttl()):
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
    Data source priority:
    1. yfinance Ticker.info forwardPE / trailingPE
    2. pykrx 기반 EPS 추정 (PBR × EPS)
    3. Naver Finance 크롤링
    4. 종목별 합리적 기본값 (하드코딩 12.2 개선)
    """
    try:
        is_kospi_index = symbol in ["KOSPI", "0001"]
        tkr = "^KS11" if is_kospi_index else f"{symbol}.KS"

        # 종목별 합리적 기본 PER (yfinance 실패 시 fallback)
        FALLBACK_PER = {
            "KOSPI":  11.5,
            "0001":   11.5,
            "005930": 13.5,   # 삼성전자
            "000660": 22.0,   # SK하이닉스
            "005380": 6.5,    # 현대차
            "000270": 7.0,    # 기아
            "035420": 35.0,   # 네이버
            "035720": 45.0,   # 카카오
            "068270": 40.0,   # 셀트리온
            "005490": 8.0,    # POSCO
            "373220": 30.0,   # LG에너지솔루션
            "051910": 15.0,   # LG화학
        }
        fallback_pe = FALLBACK_PER.get(symbol, 14.0)

        def fetch_pe_data(ticker_symbol: str) -> tuple:
            """Return (hist_df, pe_float). Try yfinance → pykrx → fallback."""
            import yfinance as yf
            import time

            global _pe_real_cache
            now = time.time()

            # 히스토리 조회 (start/end 방식이 더 안정적)
            # end는 exclusive이고 KST/EST 시차로 오늘 데이터가 누락될 수 있으므로 +2일로 설정
            ticker = yf.Ticker(ticker_symbol)
            hist = pd.DataFrame()
            try:
                from datetime import timedelta
                end_dt = datetime.now() + timedelta(days=2)   # +2일: KST/EST 시차 + exclusive 보정
                start_dt = datetime.now() - timedelta(days=400)  # 1년치 + 여유
                hist = ticker.history(
                    start=start_dt.strftime("%Y-%m-%d"),
                    end=end_dt.strftime("%Y-%m-%d"),
                    auto_adjust=True
                )
            except Exception as e:
                logger.warning(f"yfinance history failed for {ticker_symbol}: {e}")

            pe = None

            # ── 1차: 캐시 확인 ──
            if ticker_symbol in _pe_real_cache and (
                now - _pe_real_cache[ticker_symbol].get("time", 0) < 86400
            ):
                pe = _pe_real_cache[ticker_symbol]["pe"]
                logger.info(f"PE cache hit for {ticker_symbol}: {pe}")

            # ── 2차: yfinance.info ──
            if pe is None:
                try:
                    info = ticker.info
                    found_pe = info.get("forwardPE") or info.get("trailingPE")
                    if found_pe and 1.0 < float(found_pe) < 200.0:
                        pe = float(found_pe)
                        _pe_real_cache[ticker_symbol] = {"pe": pe, "time": now}
                        logger.info(f"yfinance.info PE for {ticker_symbol}: {pe}")
                except Exception as e:
                    logger.warning(f"yfinance.info failed for {ticker_symbol}: {e}")

            # ── 3차: pykrx PBR 기반 추정 (한국 종목만) ──
            if pe is None and not is_kospi_index:
                try:
                    from pykrx import stock as pykrx_stock
                    krx_code = ticker_symbol.replace(".KS", "")
                    today_str = datetime.now().strftime("%Y%m%d")
                    fut = pykrx_stock.get_market_fundamental(today_str, today_str, krx_code)
                    if not fut.empty and "PER" in fut.columns:
                        per_val = fut["PER"].iloc[-1]
                        if pd.notna(per_val) and 1.0 < float(per_val) < 200.0:
                            pe = float(per_val)
                            _pe_real_cache[ticker_symbol] = {"pe": pe, "time": now}
                            logger.info(f"pykrx PER for {ticker_symbol}: {pe}")
                except Exception as e:
                    logger.warning(f"pykrx PER failed for {ticker_symbol}: {e}")

            # ── 4차: KOSPI 지수 pykrx ──
            if pe is None and is_kospi_index:
                try:
                    from pykrx import stock as pykrx_stock
                    today_str = datetime.now().strftime("%Y%m%d")
                    fut = pykrx_stock.get_index_fundamental(today_str, today_str, "1028")
                    if not fut.empty and "PER" in fut.columns:
                        per_val = fut["PER"].iloc[-1]
                        if pd.notna(per_val) and 1.0 < float(per_val) < 200.0:
                            pe = float(per_val)
                            _pe_real_cache[ticker_symbol] = {"pe": pe, "time": now}
                            logger.info(f"pykrx KOSPI PER: {pe}")
                except Exception as e:
                    logger.warning(f"pykrx KOSPI PER failed: {e}")

            # ── 5차: 종목별 합리적 fallback (더 이상 12.2 고정 없음) ──
            if pe is None:
                pe = fallback_pe
                logger.warning(f"Using fallback PE for {ticker_symbol}: {pe}")

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
            # growth_factor: EPS가 연간 균등 성장한다고 가정 (±1% 범위 내)
            days_from_start = (dt - daily.index[0]).days
            total_days = max(1, (daily.index[-1] - daily.index[0]).days)
            growth_factor = 1.0 + (days_from_start / total_days) * 0.04  # 연 4% EPS 성장 가정
            pe_val = float(val) / (base_eps * growth_factor)

            results.append(
                {
                    "month": date_str,
                    "val": round(pe_val, 1),
                    "price": round(float(val), 0),
                }
            )

        logger.info(f"PE detail for {symbol}: {len(results)} pts, pe={real_pe:.1f}, last={results[-1]['val'] if results else 'N/A'}")
        return results
    except Exception as e:
        logger.error(f"Error fetching PE detail for {symbol}: {e}")
        return []



@router.get("/debug/vix-dates")
async def debug_vix_dates():
    """Render 서버에서 Yahoo v8 chart API가 반환하는 ^VIX 최신 날짜 진단용."""

    def _fetch_v8():
        try:
            url = "https://query1.finance.yahoo.com/v8/finance/chart/%5EVIX?interval=1d&range=2wk"
            r = requests.get(url, headers={"User-Agent": "Mozilla/5.0"}, timeout=15)
            rb = r.json().get("chart", {}).get("result", [])
            if not rb:
                return {"error": "No chart data"}
            ts = rb[0].get("timestamp", [])
            cls = rb[0].get("indicators", {}).get("quote", [{}])[0].get("close", [])
            from datetime import timezone, timedelta as _td
            est = timezone(_td(hours=-5))
            rows = {}
            for t, c in zip(ts, cls):
                if c is None:
                    continue
                dt_est = datetime.fromtimestamp(t, tz=timezone.utc).astimezone(est)
                rows[str(dt_est.date())] = round(float(c), 2)
            sorted_dates = sorted(rows.keys())
            return {
                "source": "yahoo_v8_api",
                "dates": sorted_dates[-7:],
                "values": [rows[d] for d in sorted_dates[-7:]],
                "last_date": sorted_dates[-1] if sorted_dates else None,
            }
        except Exception as e:
            return {"error": str(e)}

    result = await asyncio.to_thread(_fetch_v8)
    result["server_utc"] = datetime.utcnow().strftime("%Y-%m-%d %H:%M:%S")
    return result


async def sync_us_macro_indicators_job() -> bool:
    """FRED에서 미국 CPI, PPI, PCE 인덱스를 수집하고 YoY(%)를 계산하여 DB에 저장합니다."""
    try:
        from db.database import AsyncSessionLocal
        from db.models import USMacroIndicatorLog
        from sqlalchemy import select
        
        logger.info("[Macro Sync] Fetching 11 years of monthly CPI, PPI, PCE data from FRED...")
        # 11년치 (약 4100일) 데이터 수집해 10년치 YoY 계산에 필요한 t-12 시점 확보
        cpi_raw = await _fetch_fred_series("CPIAUCSL", days=4100)
        ppi_raw = await _fetch_fred_series("PPIACO", days=4100)
        pce_raw = await _fetch_fred_series("PCEPILFE", days=4100)
        
        def _get_monthly_map(raw_data: dict[str, float]) -> dict[str, float]:
            res = {}
            for k, v in raw_data.items():
                ym = k[:7]
                res[ym] = v
            return res
            
        cpi_map = _get_monthly_map(cpi_raw)
        ppi_map = _get_monthly_map(ppi_raw)
        pce_map = _get_monthly_map(pce_raw)
        
        all_yms = sorted(list(set(cpi_map.keys()) | set(ppi_map.keys()) | set(pce_map.keys())))
        
        def _get_prev_month(ym: str) -> str:
            y = int(ym[:4])
            m = int(ym[5:7])
            prev_y = y - 1
            return f"{prev_y}-{m:02d}"
            
        db_records = {}
        for ym in all_yms:
            prev_ym = _get_prev_month(ym)
            
            cpi_yoy = None
            if ym in cpi_map and prev_ym in cpi_map:
                cpi_yoy = round(((cpi_map[ym] - cpi_map[prev_ym]) / cpi_map[prev_ym]) * 100, 2)
                
            ppi_yoy = None
            if ym in ppi_map and prev_ym in ppi_map:
                ppi_yoy = round(((ppi_map[ym] - ppi_map[prev_ym]) / ppi_map[prev_ym]) * 100, 2)
                
            pce_yoy = None
            if ym in pce_map and prev_ym in pce_map:
                pce_yoy = round(((pce_map[ym] - pce_map[prev_ym]) / pce_map[prev_ym]) * 100, 2)
                
            if cpi_yoy is not None or ppi_yoy is not None or pce_yoy is not None:
                db_records[ym] = {
                    "cpi_yoy": cpi_yoy,
                    "ppi_yoy": ppi_yoy,
                    "pce_yoy": pce_yoy
                }
                
        if not db_records:
            logger.warning("[Macro Sync] Calculated YoY records list is empty.")
            return False
            
        cutoff_year = datetime.now().year - 10
        async with AsyncSessionLocal() as db:
            stmt = select(USMacroIndicatorLog)
            exist_res = await db.execute(stmt)
            exist_recs = {r.date: r for r in exist_res.scalars().all()}
            
            new_objs = []
            for ym, vals in sorted(db_records.items()):
                if int(ym[:4]) < cutoff_year:
                    continue
                if ym in exist_recs:
                    rec = exist_recs[ym]
                    rec.cpi_yoy = vals["cpi_yoy"]
                    rec.ppi_yoy = vals["ppi_yoy"]
                    rec.pce_yoy = vals["pce_yoy"]
                else:
                    new_objs.append(
                        USMacroIndicatorLog(
                            date=ym,
                            cpi_yoy=vals["cpi_yoy"],
                            ppi_yoy=vals["ppi_yoy"],
                            pce_yoy=vals["pce_yoy"]
                        )
                    )
            if new_objs:
                db.add_all(new_objs)
            await db.commit()
            logger.info(f"[Macro Sync] Synced US Macro Indicators: {len(new_objs)} added, {len(exist_recs)} updated.")
            
            # DB 복제 비동기 백그라운드 호출
            try:
                from core.db_replicator import trigger_replication_background
                trigger_replication_background()
            except Exception as rep_err:
                logger.error(f"[Macro Sync] Failed to trigger replication: {rep_err}")
                
        return True
    except Exception as e:
        logger.error(f"[Macro Sync] Error during macro sync: {e}", exc_info=True)
        return False


@router.get("/macro/us")
async def get_us_macro_indicators():
    """DB에 캐싱된 10년 치 월별 미국 경기지표(CPI, PPI, PCE YoY) 시계열 데이터 반환"""
    try:
        from db.database import AsyncSessionLocal
        from db.models import USMacroIndicatorLog
        from sqlalchemy import select
        
        async with AsyncSessionLocal() as db:
            result = await db.execute(
                select(USMacroIndicatorLog)
                .order_by(USMacroIndicatorLog.date.asc())
            )
            records = result.scalars().all()
            
        return [
            {
                "date": r.date,
                "cpi_yoy": r.cpi_yoy,
                "ppi_yoy": r.ppi_yoy,
                "pce_yoy": r.pce_yoy
            }
            for r in records
        ]
    except Exception as e:
        logger.error(f"Failed to retrieve US macro indicators: {e}")
        return []


@router.get("/macro/us/sync")
async def force_sync_us_macro_indicators():
    """FRED 공공 API로부터 US 매크로 지표 동기화를 즉시 강제 트리거합니다."""
    success = await sync_us_macro_indicators_job()
    if success:
        return {"status": "success", "message": "Successfully synchronized US Macro Indicators from FRED to DB."}
    else:
        return {"status": "error", "message": "Failed to synchronize US Macro Indicators."}
