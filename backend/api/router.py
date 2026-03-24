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
    from db.models import AppVersion, ETFMaster
    from sqlalchemy import func
    from datetime import timedelta

    # 1순위: 스케줄러 job 완료 시 기록된 AppVersion 테이블
    try:
        result = await db.execute(
            select(AppVersion).where(AppVersion.key == "app_version")
        )
        rec = result.scalars().first()
        if rec and rec.value:
            return {"version": rec.value}
    except Exception as e:
        logger.warning(f"AppVersion table read failed: {e}")

    # 2순위(fallback): ETFMaster.last_updated 기준 (기존 방식)
    try:
        result = await db.execute(select(func.max(ETFMaster.last_updated)))
        max_time = result.scalar()
        if max_time:
            kst_time = max_time + timedelta(hours=9)
            version_str = kst_time.strftime("VER %y%m%d%H%M")
            return {"version": version_str}
    except Exception as e:
        logger.error(f"Error fetching DB version: {e}")

    return {"version": "VER --"}



# ── Health Check 캐시 ──────────────────────────────────────────────────────────
_health_cache: dict = {}
_HEALTH_CACHE_TTL = 60  # 60초 캐시 (동시 다수 접속 시 중복 호출 방지)


async def _check_one(name: str, fn, timeout_sec: float = 5.0) -> dict:
    """단일 외부 API 체크. 응답시간(ms) + ok/error 반환. timeout 초과 시 error 처리."""
    import time as _t
    t0 = _t.monotonic()
    try:
        await asyncio.wait_for(asyncio.to_thread(fn), timeout=timeout_sec)
        return {"ok": True, "latency_ms": int((_t.monotonic() - t0) * 1000)}
    except asyncio.TimeoutError:
        return {"ok": False, "error": f"timeout ({timeout_sec}s)", "latency_ms": int((_t.monotonic() - t0) * 1000)}
    except Exception as e:
        return {"ok": False, "error": str(e)[:120], "latency_ms": int((_t.monotonic() - t0) * 1000)}


@router.get("/health")
async def check_health(db: AsyncSession = Depends(get_db)):
    """
    모든 연동기능 상태를 병렬로 체크하여 반환합니다.
    - 체크 항목: DB, Yahoo Finance(yfinance), Naver, Gemini, OECD CLI, FRED
    - 결과는 60초 캐시 (브라우저 로드 시 호출되므로 서버 부하 최소화)
    - 각 체크는 5초 timeout (느린 API가 전체를 블록하지 않도록)
    """
    global _health_cache
    import time as _t
    now = _t.time()
    if _health_cache.get("ts") and now - _health_cache["ts"] < _HEALTH_CACHE_TTL:
        return _health_cache["data"]

    from sqlalchemy import text
    from datetime import datetime, timedelta
    import requests
    import os

    failed_services = []

    # ── 개별 체크 함수들 ───────────────────────────────────────────────────────

    def _db_check():
        pass  # DB는 async로 따로 처리

    def _yfinance_check():
        import yfinance as yf
        end = datetime.now()
        start = (end - timedelta(days=3)).strftime("%Y-%m-%d")
        t = yf.Ticker("SPY")
        df = t.history(start=start, end=end.strftime("%Y-%m-%d"), auto_adjust=True)
        if df.empty:
            raise ValueError("Empty response from yfinance")

    def _naver_check():
        import requests
        url = "https://finance.naver.com/item/main.naver?code=069500"
        resp = requests.get(url, timeout=5, headers={"User-Agent": "Mozilla/5.0"})
        if resp.status_code != 200:
            raise ValueError(f"Naver HTTP {resp.status_code}")
        if "069500" not in resp.text:
            raise ValueError("Naver: unexpected response content")

    def _gemini_check():
        """신 SDK(google.genai) 사용 - chat.py와 동일 방식"""
        from google import genai as _genai
        api_key = os.getenv("GEMINI_API_KEY", "")
        if not api_key:
            raise ValueError("GEMINI_API_KEY not set")
        client = _genai.Client(api_key=api_key)
        # chat.py와 동일한 fallback 순서 시도
        _models = ["gemini-2.5-flash-lite", "gemini-2.5-flash", "gemini-2.0-flash-lite", "gemini-2.0-flash"]
        last_err = None
        for m in _models:
            try:
                resp = client.models.generate_content(model=m, contents="1+1=?")
                if not resp.text:
                    raise ValueError("Empty response")
                return  # 성공
            except Exception as e:
                if "429" in str(e) or "quota" in str(e).lower() or "404" in str(e):
                    last_err = e
                    continue
                raise e
        raise last_err or ValueError("All Gemini models failed")

    def _oecd_check():
        # 2024년 이후 OECD 신 API 엔드포인트 (sdmx.oecd.org)
        url = (
            "https://sdmx.oecd.org/public/rest/data/"
            "OECD.SDD.STES,DSD_STES@DF_CLI,4.0/"
            "KOR.M.LI.AA.A?startPeriod=2024-01&endPeriod=2024-06"
        )
        resp = requests.get(url, timeout=12, headers={"Accept": "application/json"})
        if resp.status_code != 200 or len(resp.text) < 50:
            raise ValueError(f"OECD HTTP {resp.status_code}")

    def _fred_check():
        url = "https://fred.stlouisfed.org/graph/fredgraph.csv?id=FEDFUNDS"
        resp = requests.get(url, timeout=5, headers={"User-Agent": "Mozilla/5.0"})
        if resp.status_code != 200:
            raise ValueError(f"FRED HTTP {resp.status_code}")

    def _pykrx_check():
        from pykrx import stock
        df = stock.get_market_ohlcv_by_date("20250101", "20250110", "069500")
        if df is None or df.empty:
            raise ValueError("pykrx returned empty data")

    # ── DB 체크 (async 직접) ───────────────────────────────────────────────────
    db_result = {"ok": True, "latency_ms": 0}
    try:
        import time as _t2
        t0 = _t2.monotonic()
        await db.execute(text("SELECT 1"))
        db_result = {"ok": True, "latency_ms": int((_t2.monotonic() - t0) * 1000)}
    except Exception as e:
        db_result = {"ok": False, "error": str(e)[:120], "latency_ms": 0}
        failed_services.append("DB")

    # ── 외부 API 병렬 체크 (각 5초 timeout) ────────────────────────────────────
    yf_res, naver_res, gemini_res, oecd_res, fred_res, pykrx_res = await asyncio.gather(
        _check_one("Yahoo Finance", _yfinance_check, timeout_sec=5),
        _check_one("Naver",         _naver_check,    timeout_sec=5),
        _check_one("Gemini",        _gemini_check,   timeout_sec=8),
        _check_one("OECD",          _oecd_check,     timeout_sec=10),
        _check_one("FRED",          _fred_check,     timeout_sec=5),
        _check_one("pykrx",         _pykrx_check,    timeout_sec=10),
    )

    checks = {
        "DB":            db_result,
        "Yahoo Finance": yf_res,
        "Naver":         naver_res,
        "Gemini":        gemini_res,
        "OECD CLI":      oecd_res,
        "FRED":          fred_res,
        "pykrx (KRX)":  pykrx_res,
    }

    # FRED는 한국 네트워크에서 자주 차단됨 → warning(비핵심)으로 분류
    # Gemini: API 키 미설정 또는 쿼터 초과 → 채팅 전용, 핵심 분석 기능에 영향 없음
    # OECD CLI: 실제 앱 데이터에 미사용 (헬스 체크 전용) → warning 분류
    WARNING_ONLY = {"FRED", "Gemini", "OECD CLI"}

    for svc, result in checks.items():
        if not result["ok"] and svc not in WARNING_ONLY:
            failed_services.append(svc)

    warning_services = [svc for svc in WARNING_ONLY if not checks[svc]["ok"]]
    overall = "ok" if not failed_services else "error"

    response = {
        "overall": overall,
        "checks": checks,
        "failed_services": failed_services,
        "warning_services": warning_services,  # 비핵심 오류 (FRED 등 - 헤더 표시 제외)
        "checked_at": datetime.now().strftime("%Y-%m-%dT%H:%M:%S"),
        "cache_ttl_sec": _HEALTH_CACHE_TTL,
    }
    _health_cache = {"ts": now, "data": response}
    return response



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


def smart_sample_dates(sorted_dates: list[str]) -> list[str]:
    """
    6M 이사: 일별 데이터 (step=1, 일간 최대 해상도 보여줌)
    6M~1Y: 2일 간격
    1Y~3Y: 4일 간격
    3Y+  : 8일 간격
    마지막 날짜는 항상 포함.
    """
    if not sorted_dates:
        return []
    from datetime import datetime as _dt, timedelta as _td
    now = _dt.now()
    threshold_6m  = (now - _td(days=183)).strftime("%Y-%m-%d")
    threshold_1y  = (now - _td(days=365)).strftime("%Y-%m-%d")
    threshold_3y  = (now - _td(days=1095)).strftime("%Y-%m-%d")

    sampled: list[str] = []
    for i, d in enumerate(sorted_dates):
        if d >= threshold_6m:
            sampled.append(d)          # 매일
        elif d >= threshold_1y:
            if i % 2 == 0: sampled.append(d)   # 2일
        elif d >= threshold_3y:
            if i % 4 == 0: sampled.append(d)   # 4일
        else:
            if i % 8 == 0: sampled.append(d)   # 8일

    # 마지막 날짜 보장
    if sorted_dates[-1] not in sampled:
        sampled.append(sorted_dates[-1])
    return sampled



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


async def fetch_korean_index_yahoo_v8(symbol: str, years: int = 10):
    """Yahoo Finance v8 Chart API로 KOSPI/KOSDAQ 지수 fetch.
    macro_compass.py에서 검증된 동일 패턴 사용. KST(UTC+9) 날짜 기준."""
    cache_key = f"yv8_idx_{symbol}_{years}"
    cached = get_bench_cached(cache_key)
    if cached is not None:
        return cached

    import pandas as pd
    import requests
    from datetime import timezone, timedelta as _td

    def _fetch():
        try:
            sym_enc = symbol.replace("^", "%5E")
            rng = "10y" if years >= 10 else ("5y" if years >= 5 else "2y")
            url = (
                f"https://query1.finance.yahoo.com/v8/finance/chart/{sym_enc}"
                f"?interval=1d&range={rng}"
            )
            r = requests.get(url, headers={"User-Agent": "Mozilla/5.0"}, timeout=15)
            if r.status_code != 200:
                logger.warning(f"[yv8] {symbol} status={r.status_code}")
                return pd.DataFrame()
            rb = r.json().get("chart", {}).get("result", [])
            if not rb:
                return pd.DataFrame()
            ts_list = rb[0].get("timestamp", [])
            cls_list = rb[0].get("indicators", {}).get("quote", [{}])[0].get("close", [])
            # 한국 지수: KST(UTC+9) 기준 날짜
            kst = timezone(_td(hours=9))
            rows: dict = {}
            for t, c in zip(ts_list, cls_list):
                if c is None:
                    continue
                dt_kst = __import__("datetime").datetime.fromtimestamp(t, tz=kst)
                rows[pd.Timestamp(dt_kst.date())] = float(c)
            if not rows:
                return pd.DataFrame()
            result = pd.DataFrame({"Close": pd.Series(rows)})
            result.index = pd.DatetimeIndex(result.index)
            result = result.sort_index()
            set_bench_cached(cache_key, result)
            logger.info(f"[yv8] {symbol} loaded {len(result)} rows, last={result.index[-1].date()}")
            return result
        except Exception as e:
            logger.error(f"[yv8] {symbol} failed: {e}")
            return pd.DataFrame()

    return await asyncio.to_thread(_fetch)


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


async def fetch_naver_stock_name(code: str) -> str | None:
    """
    Naver 모바일 API에서 ETF 정식 종목명(stockName)을 가져옵니다.
    pykrx/FDR 오매핑 없이 항상 정확한 이름을 반환합니다.
    실패 시 None 반환 → 호출측에서 DB name으로 fallback.
    """
    import urllib.request, json, ssl
    try:
        ctx = ssl._create_unverified_context()
        url = f"https://m.stock.naver.com/api/stock/{code}/integration"
        req = urllib.request.Request(url, headers={"User-Agent": "Mozilla/5.0"})
        res = await asyncio.to_thread(
            lambda: urllib.request.urlopen(req, timeout=5, context=ctx).read()
        )
        data = json.loads(res)
        name = data.get("stockName", "").strip()
        return name if name else None
    except Exception:
        return None


async def fetch_naver_live_price(code: str) -> float | None:
    """
    Naver 모바일 basic API에서 ETF 실시간 현재가를 가져옵니다.
    장중: 실시간 체결가 / 장마감: 당일 종가
    실패 시 None 반환.
    """
    import urllib.request, json, ssl
    try:
        ctx = ssl._create_unverified_context()
        url = f"https://m.stock.naver.com/api/stock/{code}/basic"
        req = urllib.request.Request(url, headers={"User-Agent": "Mozilla/5.0"})
        res = await asyncio.to_thread(
            lambda: urllib.request.urlopen(req, timeout=5, context=ctx).read()
        )
        data = json.loads(res)
        price_str = data.get("closePrice", "")
        if price_str:
            price = float(price_str.replace(",", ""))
            logger.info(f"[live_price] {code} = {price} (status={data.get('marketStatus')})")
            return price
        logger.warning(f"[live_price] {code} closePrice 없음: {list(data.keys())[:5]}")
        return None
    except Exception as e:
        logger.warning(f"[live_price] {code} 실패: {e}")
        return None


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

        # Fetch prices (날짜 중복 제거: 날짜별 MAX id 기준)
        dates = []
        prices = []
        if not skip_chart:
            from sqlalchemy import func
            # 날짜별 최신 row만 선택 (중복 데이터 방지)
            subq = (
                select(func.max(ETFDailyPrice.id).label("max_id"))
                .where(ETFDailyPrice.code == code)
                .group_by(ETFDailyPrice.date)
                .subquery()
            )
            p_res = await db.execute(
                select(ETFDailyPrice)
                .where(ETFDailyPrice.id.in_(select(subq.c.max_id)))
                .order_by(ETFDailyPrice.date)
            )
            for p in p_res.scalars().all():
                dates.append(p.date)
                prices.append(p.close)

        live_price = master.price

        # Naver API에서 정식 종목명 조회 (pykrx/FDR 오매핑 방지, 실패 시 DB name 사용)
        naver_name = await fetch_naver_stock_name(code)
        etf_name = naver_name or master.name

        # 당일 실시간 현재가를 Naver에서 가져와 historical_data에도 추가
        naver_live = await fetch_naver_live_price(code)
        if naver_live and naver_live > 0:
            live_price = naver_live  # DB 캐시 대신 Naver fresh price 사용
            from datetime import timezone, timedelta
            kst = timezone(timedelta(hours=9))
            today_kst = datetime.now(kst).strftime("%Y-%m-%d")
            # 오늘 날짜가 historical_data에 없으면 추가
            if today_kst not in dates:
                dates.append(today_kst)
                prices.append(naver_live)
                logger.info(f"[hybrid] {code} 당일({today_kst}) 실시간가 {naver_live} → historical_data 추가")
            else:
                # 이미 있으면 최신 가격으로 갱신
                idx = dates.index(today_kst)
                prices[idx] = naver_live

        return {
            "etf_code": code,
            "etf_name": etf_name,
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
        result = await harvester.fetch_naver_etf_data(code, skip_holdings, skip_chart)
        # DB에 해당 코드가 있으면 DB의 이름을 우선 사용 (FDR 잘못된 매핑 방지)
        try:
            db_res = await db.execute(select(ETFMaster).where(ETFMaster.code == code))
            db_master = db_res.scalars().first()
            if db_master and db_master.name:
                result["etf_name"] = db_master.name
        except Exception:
            pass
        return result


async def fetch_benchmark_hybrid(symbol: str, db: AsyncSession, fallback_coro):
    """
    벤치마크 데이터 fetch 전략:
    1순위: Yahoo Finance (10분 캐시) → 항상 최신 데이터
    2순위: DB → Yahoo Finance 실패 시 안전망
    3순위: FinanceDataReader → DB도 없을 때 최후 수단
    """
    import pandas as pd

    # 1. Yahoo Finance 우선 (10분 캐시로 빠름, 항상 최신)
    try:
        yf_df = await fallback_coro
        if yf_df is not None and not yf_df.empty:
            return yf_df
    except Exception as e:
        logger.warning(f"[bench] {symbol} Yahoo Finance failed: {e}, falling back to DB")

    # 2. Yahoo Finance 실패 시 DB fallback
    from db.models import BenchmarkPrice
    from sqlalchemy import select
    res = await db.execute(
        select(BenchmarkPrice)
        .where(BenchmarkPrice.symbol == symbol)
        .order_by(BenchmarkPrice.id)
    )
    rows = res.scalars().all()
    if rows:
        dates = [r.date for r in rows]
        closes = [r.close for r in rows]
        return pd.DataFrame({"Close": closes}, index=pd.to_datetime(dates))

    # 3. FinanceDataReader fallback (US 지수에만 적용)
    _fdr_symbol_map = {
        "^GSPC": "S&P500",
        "^IXIC": "NASDAQ",
        "^DJI": "DJI",
    }
    if symbol in _fdr_symbol_map:
        try:
            from datetime import timedelta
            start_str = (datetime.now() - timedelta(days=3650)).strftime("%Y-%m-%d")
            fdr_df = await asyncio.to_thread(fdr.DataReader, _fdr_symbol_map[symbol], start_str)
            if fdr_df is not None and not fdr_df.empty:
                close_col = "Close" if "Close" in fdr_df.columns else fdr_df.columns[0]
                df_out = pd.DataFrame({"Close": fdr_df[close_col]}).dropna()
                if not df_out.empty:
                    logger.info(f"[bench] {symbol} FinanceDataReader fallback 성공: {len(df_out)}행")
                    return df_out
        except Exception as e:
            logger.warning(f"[bench] {symbol} fdr fallback failed: {e}")

    return pd.DataFrame()


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
            await fetch_benchmark_hybrid("^KS11", db, fetch_korean_index_yahoo_v8("^KS11", 10))
        )
        results.append(
            await fetch_benchmark_hybrid("^KQ11", db, fetch_korean_index_yahoo_v8("^KQ11", 10))
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
            if dt_str not in chart_data_map:
                chart_data_map[dt_str] = {"date": dt_str}
            chart_data_map[dt_str]["KOSPI"] = row["Close"]

    if not kosdaq_df.empty:
        for dt_ts, row in kosdaq_df.iterrows():
            dt_str = str(dt_ts.date())
            if dt_str not in chart_data_map:
                chart_data_map[dt_str] = {"date": dt_str}
            chart_data_map[dt_str]["KOSDAQ"] = row["Close"]

    if not sp500_df.empty:
        for dt_ts, row in sp500_df.iterrows():
            dt_str = str(dt_ts.date())
            if dt_str not in chart_data_map:
                chart_data_map[dt_str] = {"date": dt_str}
            chart_data_map[dt_str]["SP500"] = row["Close"]

    if not nasdaq_df.empty:
        for dt_ts, row in nasdaq_df.iterrows():
            dt_str = str(dt_ts.date())
            if dt_str not in chart_data_map:
                chart_data_map[dt_str] = {"date": dt_str}
            chart_data_map[dt_str]["NASDAQ"] = row["Close"]

    # ── 당일 실시간 가격 반영 (장중/장마감 모두) ──
    from datetime import timezone, timedelta as td
    kst_tz = timezone(td(hours=9))
    today_str = datetime.now(kst_tz).strftime("%Y-%m-%d")

    # ETF 실시간 현재가 조회 (Naver basic API에서 fresh price)
    live_price_tasks = []
    for data in etf_data_list:
        code = data.get("etf_code", "")
        live_price_tasks.append(fetch_naver_live_price(code))

    live_prices = await asyncio.gather(*live_price_tasks, return_exceptions=True)

    for data, live_price in zip(etf_data_list, live_prices):
        etf_name = data.get("etf_name", "")
        # Naver 실시간가 → DB 캐시가 → fallback
        if isinstance(live_price, (int, float)) and live_price and live_price > 0:
            price = live_price
        else:
            price = data.get("market_data", {}).get("price")
        if price and etf_name:
            if today_str not in chart_data_map:
                chart_data_map[today_str] = {"date": today_str}
            chart_data_map[today_str][etf_name] = price
            logger.info(f"[compare] {etf_name} 당일 가격: {price}")

    # 벤치마크 지수 현재가 추가 (DataFrame 마지막 행이 오늘이 아닌 경우에도 최신값 사용)
    bench_pairs = [
        (kospi_df, "KOSPI"), (kosdaq_df, "KOSDAQ"),
        (sp500_df, "SP500"), (nasdaq_df, "NASDAQ"),
    ]
    for bench_df, bench_key in bench_pairs:
        if not bench_df.empty:
            last_close = bench_df["Close"].iloc[-1]
            if last_close and not pd.isna(last_close):
                if today_str not in chart_data_map:
                    chart_data_map[today_str] = {"date": today_str}
                # 오늘 데이터가 없거나 이미 있어도 최신값으로 갱신
                if bench_key not in chart_data_map[today_str]:
                    chart_data_map[today_str][bench_key] = float(last_close)

    logger.info(f"[compare] 당일({today_str}) 실시간 가격 포함 여부: {today_str in chart_data_map}")

    sorted_dates = sorted(list(chart_data_map.keys()))
    sampled_dates = smart_sample_dates(sorted_dates)
    # 당일 데이터는 항상 포함 (smart_sample에서 제외되지 않도록)
    if today_str in chart_data_map and today_str not in sampled_dates:
        sampled_dates.append(today_str)
        sampled_dates.sort()
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
        await fetch_benchmark_hybrid("^KS11", db, fetch_korean_index_yahoo_v8("^KS11", 10))
    )
    results.append(
        await fetch_benchmark_hybrid("^KQ11", db, fetch_korean_index_yahoo_v8("^KQ11", 10))
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
            if dt_str not in chart_data_map:
                chart_data_map[dt_str] = {"date": dt_str}
            chart_data_map[dt_str]["KOSPI"] = row["Close"]

    if not kosdaq_df.empty:
        for dt_ts, row in kosdaq_df.iterrows():
            dt_str = str(dt_ts.date())
            if dt_str not in chart_data_map:
                chart_data_map[dt_str] = {"date": dt_str}
            chart_data_map[dt_str]["KOSDAQ"] = row["Close"]

    if not sp500_df.empty:
        for dt_ts, row in sp500_df.iterrows():
            dt_str = str(dt_ts.date())
            if dt_str not in chart_data_map:
                chart_data_map[dt_str] = {"date": dt_str}
            chart_data_map[dt_str]["SP500"] = row["Close"]

    if not nasdaq_df.empty:
        for dt_ts, row in nasdaq_df.iterrows():
            dt_str = str(dt_ts.date())
            if dt_str not in chart_data_map:
                chart_data_map[dt_str] = {"date": dt_str}
            chart_data_map[dt_str]["NASDAQ"] = row["Close"]

    sorted_dates = sorted(list(chart_data_map.keys()))
    sampled_dates = smart_sample_dates(sorted_dates)
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

    # 스마트 캐시 TTL (v7: KST 날짜 기반)
    semi_cache_key = "semi_chart_v7"
    from datetime import timezone, timedelta as _td
    _kst = timezone(_td(hours=9))
    _kst_now = datetime.now(_kst)
    # 장중(KST 09:00~15:30) 1분, 장외 10분
    _kst_h, _kst_m = _kst_now.hour, _kst_now.minute
    _in_kr_market = (9, 0) <= (_kst_h, _kst_m) <= (15, 30)
    _in_us_market = (23, 30) <= (_kst_h, _kst_m) or (_kst_h, _kst_m) <= (6, 0)
    _semi_ttl = 60 if (_in_kr_market or _in_us_market) else 600
    if semi_cache_key in _bench_cache:
        cached_val, cached_ts = _bench_cache[semi_cache_key]
        if time.time() - cached_ts < _semi_ttl:
            return cached_val

    # KST 기준 오늘+1을 end로 설정 (yfinance end는 exclusive - 해당 날짜 미포함)
    # Render 서버가 UTC 기준이므로 KST 당일 데이터가 누락되지 않도록 내일 날짜 사용
    from datetime import timezone, timedelta as _td
    kst = timezone(_td(hours=9))
    now_kst = datetime.now(kst)
    end_date = (now_kst + _td(days=1)).date()
    start_date = now_kst.date() - _td(days=10 * 365 + 30)
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

    sampled_dates = smart_sample_dates(sorted_dates)

    line_chart_data = [chart_data_map[dt] for dt in sampled_dates]
    result = {"line_chart_data": line_chart_data, "keys": list(tickers.keys())}
    _bench_cache[semi_cache_key] = (result, time.time())
    return result

