# 브라질 국채 매크로 시계열(Selic·IPCA·환율·5년물 금리·Focus)을 BCB/스크레이핑으로 수집·저장하는 모듈
"""
데이터 소스
- BCB SGS (무인증 JSON):  Selic 목표(432), IPCA 12M 누적(13522), IPCA m/m(433), USD/BRL PTAX(1)
- BCB Olinda Focus OData: 연말 Selic/IPCA/USD-BRL 시장 컨센서스(중앙값)
- investing.com 스크레이핑: 브라질 5년물 국채금리(신호 엔진 핵심축). 실패 시 graceful degradation.
- BRL/KRW: 직접 소스가 없어 USD/KRW(FinanceDataReader) ÷ USD/BRL 로 크로스 계산.

날짜는 모두 'YYYY-MM-DD' 문자열로 정규화하여 BrazilSeries 에 upsert.
SGS 응답은 dd/mm/yyyy 형식이며 Selic 목표(432)는 차기 Copom 회의일까지 미래 날짜가 선반영되므로 오늘 이후는 절단한다.
"""

import asyncio
import re
from datetime import datetime, date, timedelta, timezone

import httpx

from sqlalchemy import select
from db.database import AsyncSessionLocal
from db.models import BrazilSeries

_KST = timezone(timedelta(hours=9))

_SGS_BASE = "https://api.bcb.gov.br/dados/serie/bcdata.sgs.{code}/dados"
_UA = "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0.0.0 Safari/537.36"

# SGS 시리즈 코드 → 저장 key
_SGS_SERIES = {
    "selic_target": 432,   # 기준금리(Selic 목표) % a.a.
    "ipca_12m": 13522,     # IPCA 12개월 누적 %
    "ipca_mom": 433,       # IPCA 월간 %
    "usd_brl": 1,          # USD/BRL PTAX 매도
}

# Focus(시장 전망) 지표 → 저장 key. 연말(EOY) 컨센서스 중앙값을 사용.
_FOCUS_INDICATORS = {
    "focus_selic_eoy": "Selic",
    "focus_ipca_eoy": "IPCA",
    "focus_usdbrl_eoy": "Câmbio",
}


def _norm_sgs_date(dmy: str) -> str:
    """'dd/mm/yyyy' → 'YYYY-MM-DD'. 파싱 실패 시 원문 반환."""
    try:
        d, m, y = dmy.split("/")
        return f"{y}-{int(m):02d}-{int(d):02d}"
    except Exception:
        return dmy


async def _fetch_sgs(client: httpx.AsyncClient, code: int) -> list[dict]:
    """SGS 시리즈. [{'date':'YYYY-MM-DD','value':float}, ...] (날짜 오름차순).
    일별 시리즈(Selic·PTAX)는 dataInicial+dataFinal 범위 조회만 안정적이다
    (ultimos/N 은 Selic 목표의 미래날짜 선반영 때문에 N이 조금만 커도 400).
    일시 네트워크 실패에 대비해 9년 윈도우로 3회 재시도 후, 마지막엔 4년 윈도우로 폴백한다."""
    url = _SGS_BASE.format(code=code)
    now = datetime.now(_KST)
    end = now.strftime("%d/%m/%Y")

    async def _range(days: int):
        start = (now - timedelta(days=days)).strftime("%d/%m/%Y")
        r = await client.get(
            url, params={"formato": "json", "dataInicial": start, "dataFinal": end}, timeout=30
        )
        r.raise_for_status()
        return r.json()

    rows = None
    for attempt in range(3):
        try:
            rows = await _range(365 * 9)
            break
        except Exception:
            await asyncio.sleep(1.5)
    if rows is None:
        rows = await _range(365 * 4)  # 짧은 윈도우 폴백 (윈도우/부하 이슈 회피)
    out = []
    today = datetime.now(_KST).date()
    for row in rows:
        try:
            iso = _norm_sgs_date(row["data"])
            # Selic 목표(432)는 미래 회의일까지 선반영 → 오늘 이후 절단
            if date.fromisoformat(iso) > today:
                continue
            out.append({"date": iso, "value": float(row["valor"])})
        except Exception:
            continue
    return out


async def _fetch_focus(client: httpx.AsyncClient, indicator: str) -> list[dict]:
    """Olinda Focus '연말(EndOfYear)' 시장 기대치. 최근 주간 컨센서스 중앙값을 날짜별로 반환.
    ExpectativasMercadoAnuais 엔드포인트에서 DataReferencia(연도) = 올해 데이터만 사용."""
    year = str(datetime.now(_KST).year)
    url = (
        "https://olinda.bcb.gov.br/olinda/servico/Expectativas/versao/v1/odata/"
        "ExpectativasMercadoAnuais"
    )
    # olinda OData 파서는 공백을 '+'로 인코딩하면 400을 내므로 '%20'으로 직접 인코딩한다.
    # baseCalculo 를 OData 필터에 함께 넣으면 타입 충돌(400)이 발생하므로 파이썬에서 거른다.
    from urllib.parse import quote
    flt = quote(f"Indicador eq '{indicator}' and DataReferencia eq '{year}'")
    sel = quote("Data,Mediana,baseCalculo")
    full = f"{url}?$top=800&$filter={flt}&$orderby={quote('Data desc')}&$format=json&$select={sel}"
    r = await client.get(full, timeout=30)
    r.raise_for_status()
    vals = r.json().get("value", [])
    # baseCalculo==0(최근 30일 응답 전체) 우선, 같은 발표일(Data)별 중앙값 하나만
    seen: dict[str, float] = {}
    for row in vals:
        if row.get("baseCalculo") not in (0, "0"):
            continue
        d = row.get("Data")
        med = row.get("Mediana")
        if d and med is not None and d not in seen:
            seen[d] = float(med)
    return [{"date": d, "value": v} for d, v in sorted(seen.items())]


# 원/헤알·달러/헤알 실시간 시세 60초 캐시 (다중 호출·다수 사용자 대비 과호출 방지)
_brl_krw_live_cache: dict = {"ts": 0.0, "value": None}
_usd_brl_live_cache: dict = {"ts": 0.0, "value": None}
_BRL_KRW_LIVE_TTL = 60  # 초


async def _yahoo_quote(client: httpx.AsyncClient, symbol: str) -> float | None:
    """Yahoo Finance chart API 로 심볼의 현재 시세(regularMarketPrice) 반환. 실패 시 None.
    query1 이 429/오류를 내면 query2 호스트로 폴백한다."""
    last_err = None
    for host in ("query1", "query2"):
        url = f"https://{host}.finance.yahoo.com/v8/finance/chart/{symbol}"
        try:
            r = await client.get(
                url, params={"interval": "1m", "range": "1d"},
                headers={"User-Agent": _UA}, timeout=15,
            )
            r.raise_for_status()
            meta = r.json()["chart"]["result"][0]["meta"]
            p = meta.get("regularMarketPrice")
            return float(p) if p else None
        except Exception as e:
            last_err = e
            continue
    if last_err:
        raise last_err
    return None


async def _fetch_naver_fx(client: httpx.AsyncClient, reuters_code: str) -> float | None:
    """Naver front-api 로 환율 실시간 시세(하나은행 고시환율). reuters_code 예: FX_BRLKRW, FX_USDKRW. 실패 시 None."""
    url = "https://m.stock.naver.com/front-api/marketIndex/productDetail"
    r = await client.get(
        url, params={"category": "exchange", "reutersCode": reuters_code},
        headers={"User-Agent": _UA}, timeout=15,
    )
    r.raise_for_status()
    cp = (r.json().get("result") or {}).get("closePrice")
    return float(str(cp).replace(",", "")) if cp else None


async def fetch_brl_krw_live() -> float | None:
    """원/헤알(BRL/KRW) 조회 시점 실시간 시세. 60초 캐시. 실패 시 None(→ 호출부에서 DB값 유지).
    1순위 Naver 하나은행 고시환율, 2순위 Yahoo BRLKRW=X, 3순위 Yahoo USDKRW=X ÷ USDBRL=X 크로스."""
    import time
    now = time.time()
    if _brl_krw_live_cache["value"] is not None and now - _brl_krw_live_cache["ts"] < _BRL_KRW_LIVE_TTL:
        return _brl_krw_live_cache["value"]
    try:
        async with httpx.AsyncClient(follow_redirects=True) as client:
            val = None
            for fetch in (
                lambda: _fetch_naver_fx(client, "FX_BRLKRW"),
                lambda: _yahoo_quote(client, "BRLKRW=X"),
            ):
                try:
                    val = await fetch()
                    if val is not None:
                        break
                except Exception:
                    val = None
            if val is None:
                try:
                    usdkrw = await _yahoo_quote(client, "USDKRW=X")
                    usdbrl = await _yahoo_quote(client, "USDBRL=X")
                    if usdkrw and usdbrl and usdbrl > 0:
                        val = usdkrw / usdbrl
                except Exception:
                    val = None
            if val is not None:
                val = round(val, 2)
                _brl_krw_live_cache["ts"] = now
                _brl_krw_live_cache["value"] = val
            return val
    except Exception as e:
        print(f"[brazil_fetcher] BRL/KRW live fetch failed: {e}")
        return None


async def fetch_usd_brl_live() -> float | None:
    """달러/헤알(USD/BRL) 조회 시점 실시간 시세. 60초 캐시. 실패 시 None(→ 호출부에서 DB PTAX값 유지).
    1순위 Naver 크로스(USD/KRW ÷ BRL/KRW — 한국 소스라 IP 제한 없음), 2순위 Yahoo USDBRL=X.
    (Yahoo 는 Render 데이터센터 IP에서 429가 잦아 Naver 크로스를 우선한다.)"""
    import time
    now = time.time()
    if _usd_brl_live_cache["value"] is not None and now - _usd_brl_live_cache["ts"] < _BRL_KRW_LIVE_TTL:
        return _usd_brl_live_cache["value"]
    try:
        async with httpx.AsyncClient(follow_redirects=True) as client:
            val = None
            # 1순위: Naver USD/KRW ÷ BRL/KRW 크로스
            try:
                usdkrw = await _fetch_naver_fx(client, "FX_USDKRW")
                brlkrw = await _fetch_naver_fx(client, "FX_BRLKRW")
                if usdkrw and brlkrw and brlkrw > 0:
                    val = usdkrw / brlkrw
            except Exception:
                val = None
            # 2순위: Yahoo USDBRL=X
            if val is None:
                try:
                    val = await _yahoo_quote(client, "USDBRL=X")
                except Exception:
                    val = None
            if val is not None:
                val = round(val, 4)
                _usd_brl_live_cache["ts"] = now
                _usd_brl_live_cache["value"] = val
            return val
    except Exception as e:
        print(f"[brazil_fetcher] USD/BRL live fetch failed: {e}")
        return None


async def _fetch_5y_yield_anbima(client: httpx.AsyncClient, ref_date: date) -> float | None:
    """ANBIMA ETTJ(공식 국채 수익률곡선)에서 해당 일자의 5년(1260영업일) 명목금리(%) 조회.
    CZ-down.asp 에 Dt_Ref(dd/mm/yyyy)로 POST → CSV 의 '1.260;IPCA;PREFIXADOS;인플레' 행 파싱.
    휴장일/미발표일은 행이 없어 None. (investing.com 403 봇차단의 대체 1순위 소스)"""
    try:
        r = await client.post(
            "https://www.anbima.com.br/informacoes/est-termo/CZ-down.asp",
            data={"Idioma": "PT", "Dt_Ref": ref_date.strftime("%d/%m/%Y"), "saida": "csv"},
            headers={"User-Agent": _UA, "Content-Type": "application/x-www-form-urlencoded"},
            timeout=20,
        )
        r.raise_for_status()
        text = r.content.decode("latin-1", "ignore")
        for line in text.splitlines():
            if line.startswith("1.260;") or line.startswith("1260;"):
                cols = line.split(";")
                if len(cols) >= 3 and cols[2].strip():
                    val = float(cols[2].strip().replace(".", "").replace(",", "."))
                    if 3.0 <= val <= 30.0:  # 금리 범위 sanity check
                        return val
        return None
    except Exception as e:
        print(f"[brazil_fetcher] ANBIMA 5Y {ref_date} failed: {e}")
        return None


async def _fetch_5y_anbima_recent(client: httpx.AsyncClient, days: int = 10) -> list[dict]:
    """ANBIMA ETTJ 로 최근 days 일(주말 제외)의 5년 금리 시계열 수집.
    [{'date': 'YYYY-MM-DD', 'value': float}] (날짜 오름차순). 실패한 날짜는 건너뜀."""
    out = []
    today = datetime.now(_KST).date()
    for i in range(days, -1, -1):
        d = today - timedelta(days=i)
        if d.weekday() >= 5:  # 토·일 제외
            continue
        val = await _fetch_5y_yield_anbima(client, d)
        if val is not None:
            out.append({"date": d.isoformat(), "value": val})
        await asyncio.sleep(0.2)  # 구형 ASP 서버 예의상 간격
    return out


async def backfill_y5_anbima(days: int = 365) -> dict:
    """ANBIMA ETTJ로 최근 days일 범위에서 '아직 없는 영업일'만 골라 5년물 실제 금리를 채운다(gap-fill).
    - 이미 있는 날짜는 건너뛴다(재실행 저렴·idempotent).
    - 실패한 날짜는 1회 재시도.
    - 20건마다 부분 커밋 → 중단(인터넷/서버 재시작)돼도 진행분이 보존되고 재실행 시 이어서 채운다.
    일일 동기화(최근 10일)와 별개로 초록 '실제/최근' 선을 과거로 연장할 때 사용."""
    today = datetime.now(_KST).date()
    # 1) 이미 보유한 y5 날짜
    async with AsyncSessionLocal() as db:
        existing = {
            r.date for r in
            (await db.execute(select(BrazilSeries).where(BrazilSeries.series_key == "y5"))).scalars()
        }
    # 2) 범위 내 영업일 중 미보유분만 대상(오래된 날짜부터)
    targets = []
    for i in range(days, -1, -1):
        d = today - timedelta(days=i)
        if d.weekday() >= 5:  # 주말 제외
            continue
        if d.isoformat() in existing:
            continue
        targets.append(d)
    print(f"[brazil_fetcher] y5 backfill: {len(targets)} missing business days (range {days}d)")
    if not targets:
        return {"y5_backfilled": 0, "targets": 0, "note": "no gaps"}

    fetched = 0
    batch: list[dict] = []
    try:
        async with httpx.AsyncClient(follow_redirects=True) as client:
            for d in targets:
                val = await _fetch_5y_yield_anbima(client, d)
                if val is None:  # 1회 재시도
                    await asyncio.sleep(0.5)
                    val = await _fetch_5y_yield_anbima(client, d)
                if val is not None:
                    batch.append({"date": d.isoformat(), "value": val})
                await asyncio.sleep(0.25)
                if len(batch) >= 20:  # 부분 커밋(중단 대비)
                    async with AsyncSessionLocal() as db:
                        fetched += await _upsert(db, "y5", batch)
                        await db.commit()
                    batch = []
        if batch:
            async with AsyncSessionLocal() as db:
                fetched += await _upsert(db, "y5", batch)
                await db.commit()
        print(f"[brazil_fetcher] y5 backfill done: upserted={fetched} of {len(targets)} targets")
        return {"y5_backfilled": fetched, "targets": len(targets)}
    except Exception as e:
        # 예외 발생 시에도 지금까지 batch 를 커밋 시도(진행분 보존)
        if batch:
            try:
                async with AsyncSessionLocal() as db:
                    fetched += await _upsert(db, "y5", batch)
                    await db.commit()
            except Exception:
                pass
        print(f"[brazil_fetcher] y5 backfill interrupted: {e} (saved {fetched})")
        return {"y5_backfilled": fetched, "targets": len(targets), "interrupted": True}


async def _fetch_5y_yield(client: httpx.AsyncClient) -> float | None:
    """investing.com 에서 브라질 5년물 국채금리(%) 스크레이핑. 실패 시 None."""
    try:
        r = await client.get(
            "https://www.investing.com/rates-bonds/brazil-5-year-bond-yield",
            headers={"User-Agent": _UA, "Accept-Language": "en-US,en;q=0.9"},
            timeout=30,
        )
        r.raise_for_status()
        m = re.search(r'last["\']?\s*[:>"]\s*["\']?([0-9]+\.[0-9]+)', r.text)
        if not m:
            m = re.search(r'>([0-9]{1,2}\.[0-9]{2,3})</div>', r.text)
        return float(m.group(1)) if m else None
    except Exception as e:
        print(f"[brazil_fetcher] 5Y yield scrape failed: {e}")
        return None


async def _fetch_5y_yield_history(client: httpx.AsyncClient) -> list[dict]:
    """investing.com 에서 브라질 5년물 국채금리(%) 일별 시계열 스크레이핑.
    반환: [{'date': 'YYYY-MM-DD', 'value': float}, ...]"""
    url = "https://www.investing.com/rates-bonds/brazil-5-year-bond-yield-historical-data"
    try:
        r = await client.get(
            url,
            headers={"User-Agent": _UA, "Accept-Language": "en-US,en;q=0.9", "Referer": "https://www.google.com/"},
            timeout=30,
        )
        r.raise_for_status()
        
        from bs4 import BeautifulSoup
        soup = BeautifulSoup(r.text, 'html.parser')
        tables = soup.find_all("table")
        if not tables:
            print("[brazil_fetcher] No tables found on historical page")
            return []
            
        table = tables[0]
        rows = table.find_all("tr")
        if len(rows) < 2:
            print("[brazil_fetcher] Historical table has no data rows")
            return []
            
        out = []
        months = {
            "jan": "01", "feb": "02", "mar": "03", "apr": "04", "may": "05", "jun": "06",
            "jul": "07", "aug": "08", "sep": "09", "oct": "10", "nov": "11", "dec": "12"
        }
        
        for row in rows[1:]:
            cells = [td.get_text(strip=True) for td in row.find_all("td")]
            if len(cells) < 2:
                continue
            
            # cells[0] is Date (e.g. "Jul 10, 2026"), cells[1] is Price (e.g. "14.283")
            date_raw = cells[0].replace(",", "").strip()
            parts = date_raw.split()
            if len(parts) != 3:
                continue
                
            m_str, d_str, y_str = parts[0].lower()[:3], parts[1], parts[2]
            if m_str not in months:
                continue
                
            try:
                day = int(d_str)
                year = int(y_str)
                iso_date = f"{year:04d}-{months[m_str]}-{day:02d}"
                val = float(cells[1])
                out.append({"date": iso_date, "value": val})
            except ValueError:
                continue
                
        return out
    except Exception as e:
        print(f"[brazil_fetcher] 5Y yield history scrape failed: {e}")
        return []


async def _fetch_fred_series(fred_id: str, days: int = 3650) -> list[dict]:
    """FRED CSV API로 데이터 가져오기 → [{'date': 'YYYY-MM-DD', 'value': float}]"""
    try:
        end_str = datetime.now(_KST).strftime("%Y-%m-%d")
        url = f"https://fred.stlouisfed.org/graph/fredgraph.csv?id={fred_id}&vintage_date={end_str}"
        headers = {
            "User-Agent": "python-requests/2.31.0"
        }
        async with httpx.AsyncClient() as client:
            resp = await client.get(url, headers=headers, timeout=20)
        if resp.status_code != 200:
            print(f"[brazil_fetcher] FRED {fred_id} status={resp.status_code}")
            return []
        
        cutoff = (datetime.now(_KST) - timedelta(days=days)).date()
        result = []
        for line in resp.text.strip().split("\n")[1:]:  # skip header
            parts = line.split(",")
            if len(parts) < 2:
                continue
            date_str, val_str = parts[0].strip(), parts[1].strip()
            if val_str == "." or not val_str:
                continue
            try:
                dt = date.fromisoformat(date_str)
                if dt < cutoff:
                    continue
                result.append({"date": date_str, "value": float(val_str)})
            except Exception:
                continue
        return result
    except Exception as e:
        print(f"[brazil_fetcher] FRED {fred_id} failed: {e}")
        return []


def _fetch_usd_krw_series_sync(days: int = 400) -> dict[str, float]:
    """FinanceDataReader 로 USD/KRW 일별 종가. {'YYYY-MM-DD': float}."""
    try:
        import FinanceDataReader as fdr
        start = (datetime.now(_KST) - timedelta(days=days)).strftime("%Y-%m-%d")
        df = fdr.DataReader("USD/KRW", start)
        col = "Close" if "Close" in df.columns else df.columns[0]
        return {d.strftime("%Y-%m-%d"): float(v) for d, v in df[col].dropna().items()}
    except Exception as e:
        print(f"[brazil_fetcher] USD/KRW fetch failed: {e}")
        return {}


async def _upsert(db, series_key: str, rows: list[dict]) -> int:
    """(series_key, date) 유니크 upsert. 저장/갱신 건수 반환."""
    if not rows:
        return 0
    existing = {
        r.date: r
        for r in (
            await db.execute(select(BrazilSeries).where(BrazilSeries.series_key == series_key))
        ).scalars()
    }
    n = 0
    for row in rows:
        d, v = row["date"], row["value"]
        if v is None:
            continue
        cur = existing.get(d)
        if cur:
            if cur.value != v:
                cur.value = v
                n += 1
        else:
            db.add(BrazilSeries(series_key=series_key, date=d, value=v))
            n += 1
    return n


async def sync_brazil_series() -> dict:
    """모든 브라질 시계열을 수집해 BrazilSeries 에 upsert. 스케줄러/수동 실행 진입점."""
    result: dict[str, int] = {}
    today_iso = datetime.now(_KST).strftime("%Y-%m-%d")

    async with httpx.AsyncClient(follow_redirects=True) as client:
        # 1) SGS 시리즈
        for key, code in _SGS_SERIES.items():
            try:
                rows = await _fetch_sgs(client, code)
                async with AsyncSessionLocal() as db:
                    result[key] = await _upsert(db, key, rows)
                    await db.commit()
            except Exception as e:
                print(f"[brazil_fetcher] SGS {key}({code}) failed: {e}")
                result[key] = -1

        # 2) Focus 컨센서스
        for key, indicator in _FOCUS_INDICATORS.items():
            try:
                rows = await _fetch_focus(client, indicator)
                async with AsyncSessionLocal() as db:
                    result[key] = await _upsert(db, key, rows)
                    await db.commit()
            except Exception as e:
                print(f"[brazil_fetcher] Focus {key}({indicator}) failed: {e}")
                result[key] = -1

        # 3) 5년물 국채금리 — 1순위 ANBIMA ETTJ(공식, 최근 10일 백필), 2순위 investing.com(403 봇차단 잦음)
        y5_rows = await _fetch_5y_anbima_recent(client, days=10)
        if not y5_rows:
            y5_rows = await _fetch_5y_yield_history(client)
        if not y5_rows:
            # 단일값 스크레이핑 폴백
            single_val = await _fetch_5y_yield(client)
            if single_val is not None:
                y5_rows = [{"date": today_iso, "value": single_val}]

        if y5_rows:
            async with AsyncSessionLocal() as db:
                result["y5"] = await _upsert(db, "y5", y5_rows)
                await db.commit()
        else:
            result["y5"] = -1

        # 3.5) FRED 브라질 국채금리 대리 지표 (INTGSTBRM193N)
        try:
            fred_rows = await _fetch_fred_series("INTGSTBRM193N")
            if fred_rows:
                async with AsyncSessionLocal() as db:
                    result["y5_fred"] = await _upsert(db, "y5_fred", fred_rows)
                    await db.commit()
            else:
                result["y5_fred"] = -1
        except Exception as e:
            print(f"[brazil_fetcher] FRED y5_fred sync failed: {e}")
            result["y5_fred"] = -1

    # 4) BRL/KRW 크로스 = USD/KRW ÷ USD/BRL (일별 교집합)
    try:
        usd_krw = await asyncio.to_thread(_fetch_usd_krw_series_sync)
        async with AsyncSessionLocal() as db:
            usd_brl_rows = (
                await db.execute(select(BrazilSeries).where(BrazilSeries.series_key == "usd_brl"))
            ).scalars().all()
            usd_brl = {r.date: r.value for r in usd_brl_rows}
            cross = []
            for d, krw in usd_krw.items():
                brl = usd_brl.get(d)
                if brl and brl > 0:
                    cross.append({"date": d, "value": round(krw / brl, 2)})
            result["brl_krw"] = await _upsert(db, "brl_krw", cross)
            await db.commit()
    except Exception as e:
        print(f"[brazil_fetcher] brl_krw cross failed: {e}")
        result["brl_krw"] = -1

    # y5 프록시 오염 정리: 과거 y5가 selic 복사본으로 백필된 행 제거.
    # (실제 5년물 시장금리는 기준금리와 소수점까지 정확히 같을 수 없음 → 정확 일치 = 백필 오염)
    # 정리 후 FRED 역사적 곡선(y5_fred)이 과거 구간을, 실제 최근 y5가 최근 구간을 담당하게 된다.
    try:
        async with AsyncSessionLocal() as db:
            selic_map = {
                r.date: r.value for r in
                (await db.execute(select(BrazilSeries).where(BrazilSeries.series_key == "selic_target"))).scalars()
            }
            y5_all = (await db.execute(select(BrazilSeries).where(BrazilSeries.series_key == "y5"))).scalars().all()
            removed = 0
            for r in y5_all:
                s = selic_map.get(r.date)
                if s is not None and abs(r.value - s) < 1e-6:
                    await db.delete(r)
                    removed += 1
            if removed:
                await db.commit()
            result["y5_proxy_removed"] = removed
            print(f"[brazil_fetcher] y5 proxy cleanup: removed {removed} selic-copy rows")
    except Exception as e:
        print(f"[brazil_fetcher] y5 proxy cleanup failed: {e}")

    print(f"[brazil_fetcher] sync done: {result}")
    return result


async def seed_brazil_series_if_empty():
    """신규 배포 등으로 brazil_series 가 비어 있으면 백그라운드로 즉시 동기화한다.
    (스케줄러 일 1회 잡을 기다리지 않고 첫 접속부터 데이터가 보이도록.)"""
    from sqlalchemy import func
    async with AsyncSessionLocal() as db:
        cnt = (await db.execute(select(func.count()).select_from(BrazilSeries))).scalar() or 0
    if cnt > 0:
        print(f"[brazil_fetcher] seed skip (rows={cnt})")
        return
    print("[brazil_fetcher] brazil_series empty → seeding now")
    try:
        await sync_brazil_series()
    except Exception as e:
        print(f"[brazil_fetcher] seed failed: {e}")


if __name__ == "__main__":
    print(asyncio.run(sync_brazil_series()))
