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
    일별 시리즈(Selic·PTAX)는 최대 10년 윈도우 제한이 있어 dataInicial+dataFinal 범위 조회한다.
    일시적 네트워크 실패에 대비해 dataInicial 실패 시 ultimos/1000 으로 폴백한다."""
    url = _SGS_BASE.format(code=code)
    now = datetime.now(_KST)
    start = (now - timedelta(days=365 * 9)).strftime("%d/%m/%Y")
    end = now.strftime("%d/%m/%Y")
    rows = None
    for attempt in range(2):
        try:
            r = await client.get(
                url, params={"formato": "json", "dataInicial": start, "dataFinal": end}, timeout=30
            )
            r.raise_for_status()
            rows = r.json()
            break
        except Exception:
            if attempt == 0:
                await asyncio.sleep(1.5)
                continue
    if rows is None:
        r = await client.get(url + "/ultimos/1000", params={"formato": "json"}, timeout=30)
        r.raise_for_status()
        rows = r.json()
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

        # 3) 5년물 국채금리 (오늘 값 1점)
        y5 = await _fetch_5y_yield(client)
        if y5 is not None:
            async with AsyncSessionLocal() as db:
                result["y5"] = await _upsert(db, "y5", [{"date": today_iso, "value": y5}])
                await db.commit()
        else:
            result["y5"] = -1

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

    print(f"[brazil_fetcher] sync done: {result}")
    return result


if __name__ == "__main__":
    print(asyncio.run(sync_brazil_series()))
