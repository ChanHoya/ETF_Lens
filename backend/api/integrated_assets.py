import asyncio
import json
import logging
import ssl
import urllib.request
from datetime import datetime
from typing import Any, Dict, List, Optional

import httpx
from fastapi import APIRouter, Depends, HTTPException, Request
from pydantic import BaseModel
from sqlalchemy import delete, select
from sqlalchemy.ext.asyncio import AsyncSession

from db.database import get_db
from db.models import KisAccountMapping, ManualAccountCash, ManualAsset

logger = logging.getLogger(__name__)

router = APIRouter()

# 5대 표준 카테고리 정의 (구글 시트 3. 포트폴리오0822 기준)
STANDARD_CATEGORIES = [
    {"key": "ISA", "name": "ISA", "country": "국내", "currency": "KRW"},
    {"key": "PENSION", "name": "연금저축펀드", "country": "국내", "currency": "KRW"},
    {"key": "IRP", "name": "퇴직연금IRP", "country": "국내", "currency": "KRW"},
    {"key": "OTHER_INVEST", "name": "기타투자계좌", "country": "복합", "currency": "KRW"},
    {"key": "STOCK", "name": "일반주식계좌", "country": "국내", "currency": "KRW"},
]

CATEGORY_NAME_MAP = {
    "ISA": "ISA",
    "PENSION": "연금저축펀드",
    "IRP": "퇴직연금IRP",
    "SAVINGS": "기타투자계좌",
    "OTHER_INVEST": "기타투자계좌",
    "STOCK": "일반주식계좌",
    "연금저축펀드": "연금저축펀드",
    "퇴직연금IRP": "퇴직연금IRP",
    "기타저축계좌": "기타투자계좌",
    "기타투자계좌": "기타투자계좌",
    "일반주식계좌": "일반주식계좌",
}

# 기본 KIS 계좌 매핑 정의 (사용자 계좌별 기본 분류)
DEFAULT_KIS_ACCOUNT_MAPPING: Dict[str, Dict[str, str]] = {
    "64490078-01": {"alias": "한투 ISA", "category": "ISA", "country": "국내"},
    "81060777-22": {"alias": "한투 퇴직연금IRP", "category": "퇴직연금IRP", "country": "국내"},
    "64896732-01": {"alias": "한투 기타투자계좌", "category": "기타투자계좌", "country": "국내"},
    "81060777-01": {"alias": "한투 일반주식계좌", "category": "일반주식계좌", "country": "국내"},
}


# ── Schemas ──────────────────────────────────────────────────────────────────
class ManualAssetCreate(BaseModel):
    category: str
    account_name: Optional[str] = None
    broker: str
    asset_name: str
    ticker: Optional[str] = None
    currency: str = "KRW"
    purchase_price: float = 0.0
    current_price: float = 0.0
    quantity: float = 1.0
    sector: Optional[str] = None
    country: str = "국내"
    memo: Optional[str] = None


class ManualAssetUpdate(BaseModel):
    category: Optional[str] = None
    account_name: Optional[str] = None
    broker: Optional[str] = None
    asset_name: Optional[str] = None
    ticker: Optional[str] = None
    currency: Optional[str] = None
    purchase_price: Optional[float] = None
    current_price: Optional[float] = None
    quantity: Optional[float] = None
    sector: Optional[str] = None
    country: Optional[str] = None
    memo: Optional[str] = None


class BatchManualAssetCreate(BaseModel):
    assets: List[ManualAssetCreate]


class BatchManualAssetDelete(BaseModel):
    ids: List[int]


class ManualCashCreate(BaseModel):
    category: str
    account_name: str
    broker: str
    cash_krw: float = 0.0
    cash_usd: float = 0.0
    memo: Optional[str] = None


class KisMappingItem(BaseModel):
    account_no: str
    alias: Optional[str] = None
    category: str
    country: str = "국내"


class KisMappingBatch(BaseModel):
    mappings: List[KisMappingItem]


# ── Helper: Live FX Rate ─────────────────────────────────────────────────────
_FX_CACHE = {"rate": 1385.0, "time": 0.0}
_FX_TTL = 300  # 5 minutes


async def get_live_usd_krw_rate() -> float:
    import time
    now = time.time()
    if _FX_CACHE["time"] > 0 and (now - _FX_CACHE["time"]) < _FX_TTL:
        return _FX_CACHE["rate"]

    try:
        async with httpx.AsyncClient(timeout=5.0) as client:
            url = "https://m.stock.naver.com/front-api/marketIndex/productDetail"
            res = await client.get(
                url,
                params={"category": "exchange", "reutersCode": "FX_USDKRW"},
                headers={"User-Agent": "Mozilla/5.0"},
            )
            if res.status_code == 200:
                cp = (res.json().get("result") or {}).get("closePrice")
                if cp:
                    rate = float(str(cp).replace(",", ""))
                    _FX_CACHE["rate"] = rate
                    _FX_CACHE["time"] = now
                    return rate
    except Exception as e:
        logger.warning(f"Failed to fetch live USD/KRW from Naver: {e}")

    try:
        # Fallback to Yahoo
        import yfinance as yf
        ticker = yf.Ticker("USDKRW=X")
        hist = await asyncio.to_thread(lambda: ticker.history(period="1d"))
        if not hist.empty:
            rate = float(hist["Close"].iloc[-1])
            _FX_CACHE["rate"] = rate
            _FX_CACHE["time"] = now
            return rate
    except Exception as e:
        logger.warning(f"Failed to fetch USD/KRW from Yahoo: {e}")

    return _FX_CACHE["rate"]


# ── Helper: Fetch Live Stock Price & Info ────────────────────────────────────
async def fetch_realtime_stock_info(ticker: str) -> Optional[Dict[str, Any]]:
    clean = ticker.strip().upper()
    if not clean:
        return None

    # Tier 1: Try Naver Domestic Endpoints (supports 6-digit numeric & new alphanumeric ETF codes like 0180V0)
    async with httpx.AsyncClient(timeout=4.0, verify=False) as client:
        # 1-1. Naver Mobile Stock API
        try:
            url = f"https://m.stock.naver.com/api/stock/{clean}/basic"
            res = await client.get(url, headers={"User-Agent": "Mozilla/5.0"})
            if res.status_code == 200:
                data = res.json()
                name = data.get("stockName")
                cp_str = str(data.get("closePrice", "0")).replace(",", "")
                if name and cp_str and float(cp_str) > 0:
                    return {
                        "ticker": clean,
                        "name": name,
                        "price": float(cp_str),
                        "currency": "KRW",
                        "country": "국내",
                        "market": data.get("stockItemTotalInfo", {}).get("marketName") or "국내",
                    }
        except Exception as e:
            logger.debug(f"Naver mobile API fetch error for {clean}: {e}")

        # 1-2. Naver Polling Realtime API
        try:
            url = f"https://polling.finance.naver.com/api/realtime/domestic/stock/{clean}"
            res = await client.get(
                url,
                headers={
                    "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36",
                    "Referer": "https://finance.naver.com/",
                },
            )
            if res.status_code == 200:
                data = res.json()
                datas = data.get("datas", [])
                if datas:
                    d0 = datas[0]
                    name = d0.get("stockName") or d0.get("itemname")
                    cp_str = str(d0.get("closePrice") or d0.get("nowValue") or d0.get("nv") or "0").replace(",", "")
                    if name and cp_str and float(cp_str) > 0:
                        return {
                            "ticker": clean,
                            "name": name,
                            "price": float(cp_str),
                            "currency": "KRW",
                            "country": "국내",
                            "market": "국내",
                        }
        except Exception as e:
            logger.debug(f"Naver polling API fetch error for {clean}: {e}")

        # 1-3. Naver Finance Web Scrape Fallback
        try:
            url = f"https://finance.naver.com/item/main.naver?code={clean}"
            res = await client.get(
                url,
                headers={
                    "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36",
                    "Referer": "https://finance.naver.com/",
                },
            )
            if res.status_code == 200:
                import re
                html = res.text
                name_m = re.search(r"wrap_company[\s\S]*?<h2>[\s\S]*?<a[^>]*>([^<]+)</a>", html)
                price_m = re.search(r"no_today[\s\S]*?blind\">([\d,]+)</span>", html)
                if name_m and price_m:
                    name = name_m.group(1).strip()
                    price = float(price_m.group(1).replace(",", ""))
                    if price > 0:
                        return {
                            "ticker": clean,
                            "name": name,
                            "price": price,
                            "currency": "KRW",
                            "country": "국내",
                            "market": "국내",
                        }
        except Exception as e:
            logger.debug(f"Naver web scrape error for {clean}: {e}")

        # Tier 2: Overseas / Global Stock Endpoints (US / Global)
        overseas_urls = [
            f"https://api.stock.naver.com/stock/{clean}/basic",
            f"https://m.stock.naver.com/api/stock/{clean}.O/basic",
            f"https://m.stock.naver.com/api/stock/{clean}.K/basic",
            f"https://m.stock.naver.com/api/stock/{clean}.N/basic",
        ]
        for url in overseas_urls:
            try:
                res = await client.get(url, headers={"User-Agent": "Mozilla/5.0"})
                if res.status_code == 200:
                    data = res.json()
                    name = data.get("stockName")
                    cp_str = str(data.get("closePrice", "0")).replace(",", "")
                    if name and cp_str and float(cp_str) > 0:
                        curr_raw = data.get("currencyType")
                        curr = curr_raw if isinstance(curr_raw, str) else (curr_raw.get("code", "USD") if isinstance(curr_raw, dict) else "USD")
                        return {
                            "ticker": clean,
                            "name": name,
                            "price": float(cp_str),
                            "currency": curr or "USD",
                            "country": "해외" if (curr or "USD") == "USD" else "국내",
                            "market": data.get("stockExchangeName", "해외"),
                        }
            except Exception:
                continue

    # Tier 3: Yahoo Finance Fallback (both Domestic & Global)
    try:
        import yfinance as yf

        symbols_to_try = [clean]
        if len(clean) == 6 or clean.isalnum():
            symbols_to_try.extend([f"{clean}.KS", f"{clean}.KQ"])

        for sym in symbols_to_try:
            try:
                tk = yf.Ticker(sym)
                fast = getattr(tk, "fast_info", None)
                p = getattr(fast, "last_price", None)
                if p is None or p <= 0:
                    hist = await asyncio.to_thread(lambda: tk.history(period="1d"))
                    if not hist.empty:
                        p = float(hist["Close"].iloc[-1])
                if p and p > 0:
                    curr = getattr(fast, "currency", "USD") or "USD"
                    return {
                        "ticker": clean,
                        "name": clean,
                        "price": float(p),
                        "currency": curr,
                        "country": "국내" if curr == "KRW" else "해외",
                        "market": "KRX" if curr == "KRW" else "US",
                    }
            except Exception:
                continue
    except Exception as e:
        logger.debug(f"Yahoo fetch error for {clean}: {e}")

    return None


async def fetch_stock_live_price(ticker: str, currency: str = "KRW") -> Optional[float]:
    info = await fetch_realtime_stock_info(ticker)
    return info.get("price") if info else None


# ── Helper: Guess KIS Account Category ───────────────────────────────────────
def guess_kis_category(acc_no: str, acc_name: Optional[str] = None) -> str:
    clean_no = acc_no.strip()
    if clean_no in DEFAULT_KIS_ACCOUNT_MAPPING:
        return DEFAULT_KIS_ACCOUNT_MAPPING[clean_no]["category"]
    name_str = f"{acc_name or ''} {acc_no}".upper()
    if "ISA" in name_str:
        return "ISA"
    if "연금" in name_str or "PENSION" in name_str:
        return "연금저축펀드"
    if "IRP" in name_str or "퇴직" in name_str:
        return "퇴직연금IRP"
    if "저축" in name_str or "투자" in name_str or "CMA" in name_str or "발행어음" in name_str:
        return "기타투자계좌"
    return "일반주식계좌"


# ── Stock Price Lookup Endpoint ──────────────────────────────────────────────
@router.get("/stock-price")
async def get_stock_price(ticker: str):
    """
    종목코드(6자리 국내) 또는 티커(해외) 실시간 시세 및 종목명 조회 API
    """
    info = await fetch_realtime_stock_info(ticker)
    if not info or info.get("price") is None:
        raise HTTPException(
            status_code=404,
            detail=f"'{ticker}' 종목의 실시간 시세를 찾을 수 없습니다."
        )
    return {"status": "success", "data": info}


# ── Main Integrated Asset Endpoint ───────────────────────────────────────────
@router.get("/integrated-assets")
async def get_integrated_assets(
    request: Request,
    db: AsyncSession = Depends(get_db),
):
    """
    구글 시트(3. 포트폴리오0822) 구조 기반 종합 자산 조회:
    1. KIS API 실시간 잔고(계좌별 종목 + 예수금)
    2. 타 금융사(미래에셋, 삼성증권, 케이뱅크 등) 수동 입력 자산
    3. 수동 관리 계좌 예수금 (KRW, USD)
    4. Account Board 요약 및 계좌별 상세 보유 종목 병합 반환
    """
    from api.my_assets import get_my_portfolio

    # 1. 환율 조회
    usd_rate = await get_live_usd_krw_rate()

    # 2. KIS 포트폴리오 데이터 조회
    kis_holdings = []
    kis_accounts = []
    kis_raw_summary = {}

    try:
        kis_res = await get_my_portfolio(request, db)
        if kis_res and "kis_raw" in kis_res:
            kis_raw = kis_res["kis_raw"]
            kis_holdings = kis_raw.get("holdings", [])
            kis_accounts = kis_raw.get("accounts", [])
            kis_raw_summary = kis_raw.get("summary", {})
    except Exception as e:
        logger.warning(f"KIS Portfolio integration fetch error: {e}")

    # 3. KIS 계좌별 매핑 정보 로드
    stmt_map = select(KisAccountMapping)
    res_map = await db.execute(stmt_map)
    mapping_list = res_map.scalars().all()
    kis_map_dict = {m.account_no: m for m in mapping_list}

    # KIS 계좌 정보와 매핑 결합
    enriched_kis_accounts = []
    for acc in kis_accounts:
        acc_no = acc["account_no"]
        mapping = kis_map_dict.get(acc_no)
        def_map = DEFAULT_KIS_ACCOUNT_MAPPING.get(acc_no, {})
        category = (
            mapping.category
            if mapping and mapping.category
            else def_map.get("category", guess_kis_category(acc_no, acc.get("account_name")))
        )
        alias = (
            mapping.alias
            if mapping and mapping.alias
            else def_map.get("alias", acc.get("account_name", "한투 연동계좌"))
        )
        country = (
            mapping.country
            if mapping and mapping.country
            else def_map.get("country", "국내")
        )

        enriched_kis_accounts.append({
            "account_no": acc_no,
            "account_name": acc.get("account_name", "연동계좌"),
            "alias": alias,
            "category": category,
            "country": country,
            "total_asset": acc.get("total_asset", 0.0),
            "cash_balance": acc.get("cash_balance", 0.0),
        })

    # 계좌번호별 카테고리 매핑 룩업
    acc_category_lookup = {
        acc["account_no"]: acc["category"] for acc in enriched_kis_accounts
    }

    # 4. 수동 자산 & 수동 예수금 로드
    stmt_assets = select(ManualAsset).order_by(ManualAsset.id.asc())
    res_assets = await db.execute(stmt_assets)
    manual_assets_list = res_assets.scalars().all()

    stmt_cash = select(ManualAccountCash).order_by(ManualAccountCash.id.asc())
    res_cash = await db.execute(stmt_cash)
    manual_cash_list = res_cash.scalars().all()

    # 5. 카테고리별 데이터 컨테이너 초기화
    category_data = {
        cat["name"]: {
            "category_key": cat["key"],
            "category_name": cat["name"],
            "country": cat["country"],
            "currency": cat["currency"],
            "holdings": [],
            "purchase_amount": 0.0,
            "eval_amount": 0.0,
            "profit_loss": 0.0,
            "cash_krw": 0.0,
            "cash_usd": 0.0,
            "total_cash_converted": 0.0,
            "total_asset": 0.0,
        }
        for cat in STANDARD_CATEGORIES
    }

    # 6. KIS 예수금 카테고리별 분배
    for acc in enriched_kis_accounts:
        cat_name = CATEGORY_NAME_MAP.get(acc["category"], "일반주식계좌")
        if cat_name not in category_data:
            cat_name = "일반주식계좌"
        category_data[cat_name]["cash_krw"] += float(acc.get("cash_balance", 0.0))

    # 7. 수동 예수금 카테고리별 분배
    manual_cash_response = []
    for mc in manual_cash_list:
        cat_name = CATEGORY_NAME_MAP.get(mc.category, "기타저축계좌")
        if cat_name not in category_data:
            cat_name = "기타저축계좌"
        category_data[cat_name]["cash_krw"] += float(mc.cash_krw or 0.0)
        category_data[cat_name]["cash_usd"] += float(mc.cash_usd or 0.0)

        manual_cash_response.append({
            "id": mc.id,
            "category": cat_name,
            "account_name": mc.account_name,
            "broker": mc.broker,
            "cash_krw": mc.cash_krw,
            "cash_usd": mc.cash_usd,
            "memo": mc.memo,
        })

    # 8. KIS 보유 종목 변환 및 카테고리별 할당
    for h in kis_holdings:
        acc_no = h.get("account_no", "")
        raw_cat = acc_category_lookup.get(acc_no, "일반주식계좌")
        cat_name = CATEGORY_NAME_MAP.get(raw_cat, "일반주식계좌")
        if cat_name not in category_data:
            cat_name = "일반주식계좌"

        qty = float(h.get("qty", 0))
        avg_p = float(h.get("avg_price", 0))
        cur_p = float(h.get("current_price", 0))
        eval_amt = float(h.get("eval_amount", cur_p * qty))
        pchs_amt = avg_p * qty
        pfls_amt = float(h.get("profit_loss", eval_amt - pchs_amt))
        ret_rt = float(h.get("return_rate", (pfls_amt / pchs_amt * 100) if pchs_amt > 0 else 0.0))

        code = h.get("code", "")
        name = h.get("name", "")

        holding_obj = {
            "id": f"kis_{code}_{acc_no}",
            "name": name,
            "code": code,
            "ticker": code,
            "sector": "ETF/주식",
            "broker": "한국투자",
            "source": "KIS",
            "account_no": acc_no,
            "account_name": next((a["alias"] for a in enriched_kis_accounts if a["account_no"] == acc_no), "한투 연동"),
            "category": cat_name,
            "currency": "KRW",
            "country": "해외" if (code.isalpha() or "미국" in name or "글로벌" in name) else "국내",
            "purchase_price": avg_p,
            "current_price": cur_p,
            "quantity": qty,
            "purchase_amount": pchs_amt,
            "eval_amount": eval_amt,
            "profit_loss": pfls_amt,
            "return_rate": ret_rt,
            "memo": None,
        }

        category_data[cat_name]["holdings"].append(holding_obj)
        category_data[cat_name]["purchase_amount"] += pchs_amt
        category_data[cat_name]["eval_amount"] += eval_amt
        category_data[cat_name]["profit_loss"] += pfls_amt

    # 9. 수동 자산 변환 및 카테고리별 할당
    for ma in manual_assets_list:
        cat_name = CATEGORY_NAME_MAP.get(ma.category, "일반주식계좌")
        if cat_name not in category_data:
            cat_name = "일반주식계좌"

        currency = (ma.currency or "KRW").upper()
        rate_multiplier = usd_rate if currency == "USD" else 1.0

        qty = float(ma.quantity or 0)
        avg_p = float(ma.purchase_price or 0)
        cur_p = float(ma.current_price or avg_p)

        # 원화 환산 기준 금액 계산
        pchs_amt_krw = avg_p * qty * rate_multiplier
        eval_amt_krw = cur_p * qty * rate_multiplier
        pfls_amt_krw = eval_amt_krw - pchs_amt_krw
        ret_rt = (pfls_amt_krw / pchs_amt_krw * 100) if pchs_amt_krw > 0 else 0.0

        holding_obj = {
            "id": f"manual_{ma.id}",
            "manual_id": ma.id,
            "name": ma.asset_name,
            "code": ma.ticker or "",
            "ticker": ma.ticker or "",
            "sector": ma.sector or "기타",
            "broker": ma.broker,
            "source": "MANUAL",
            "account_no": ma.account_name or ma.broker,
            "account_name": ma.account_name or ma.broker,
            "category": cat_name,
            "currency": currency,
            "country": ma.country or ("해외" if currency == "USD" else "국내"),
            "purchase_price": avg_p,
            "current_price": cur_p,
            "quantity": qty,
            "purchase_amount": pchs_amt_krw,
            "eval_amount": eval_amt_krw,
            "profit_loss": pfls_amt_krw,
            "return_rate": ret_rt,
            "memo": ma.memo,
        }

        category_data[cat_name]["holdings"].append(holding_obj)
        category_data[cat_name]["purchase_amount"] += pchs_amt_krw
        category_data[cat_name]["eval_amount"] += eval_amt_krw
        category_data[cat_name]["profit_loss"] += pfls_amt_krw

    # 10. 카테고리별 예수금 합산 및 총자산 산출
    grand_total_purchase = 0.0
    grand_total_eval = 0.0
    grand_total_profit_loss = 0.0
    grand_total_cash_krw = 0.0
    grand_total_cash_usd = 0.0
    grand_total_net_worth = 0.0

    for cat_name, c_dict in category_data.items():
        cash_krw = c_dict["cash_krw"]
        cash_usd = c_dict["cash_usd"]
        total_cash_conv = cash_krw + (cash_usd * usd_rate)
        c_dict["total_cash_converted"] = total_cash_conv

        total_asst = c_dict["eval_amount"] + total_cash_conv
        c_dict["total_asset"] = total_asst

        pchs = c_dict["purchase_amount"]
        pfls = c_dict["profit_loss"]
        c_dict["return_rate"] = (pfls / pchs * 100) if pchs > 0 else 0.0

        grand_total_purchase += pchs
        grand_total_eval += c_dict["eval_amount"]
        grand_total_profit_loss += pfls
        grand_total_cash_krw += cash_krw
        grand_total_cash_usd += cash_usd
        grand_total_net_worth += total_asst

    # 11. 비중(Weight %) 계산
    account_boards = []
    for cat in STANDARD_CATEGORIES:
        c_name = cat["name"]
        c_dict = category_data[c_name]
        weight = (c_dict["total_asset"] / grand_total_net_worth * 100) if grand_total_net_worth > 0 else 0.0
        c_dict["weight"] = round(weight, 2)

        # 개별 종목의 전체 자산 대비 비중 계산
        for h in c_dict["holdings"]:
            h_weight = (h["eval_amount"] / grand_total_net_worth * 100) if grand_total_net_worth > 0 else 0.0
            h["weight"] = round(h_weight, 2)

        account_boards.append({
            "category_key": c_dict["category_key"],
            "category_name": c_name,
            "country": c_dict["country"],
            "currency": c_dict["currency"],
            "purchase_amount": round(c_dict["purchase_amount"]),
            "eval_amount": round(c_dict["eval_amount"]),
            "profit_loss": round(c_dict["profit_loss"]),
            "return_rate": round(c_dict["return_rate"], 2),
            "weight": c_dict["weight"],
            "cash_krw": round(c_dict["cash_krw"]),
            "cash_usd": round(c_dict["cash_usd"], 2),
            "total_cash_converted": round(c_dict["total_cash_converted"]),
            "total_asset": round(c_dict["total_asset"]),
            "holdings_count": len(c_dict["holdings"]),
        })

    grand_total_return = (
        (grand_total_profit_loss / grand_total_purchase * 100)
        if grand_total_purchase > 0
        else 0.0
    )

    grand_summary = {
        "total_purchase_amount": round(grand_total_purchase),
        "total_eval_amount": round(grand_total_eval),
        "total_profit_loss": round(grand_total_profit_loss),
        "total_return_rate": round(grand_total_return, 2),
        "total_cash_krw": round(grand_total_cash_krw),
        "total_cash_usd": round(grand_total_cash_usd, 2),
        "total_cash_converted": round(grand_total_cash_krw + (grand_total_cash_usd * usd_rate)),
        "total_net_worth": round(grand_total_net_worth),
        "usd_krw_rate": round(usd_rate, 2),
        "last_updated": datetime.utcnow().isoformat(),
    }

    grouped_holdings_response = {
        cat["name"]: category_data[cat["name"]]["holdings"]
        for cat in STANDARD_CATEGORIES
    }

    return {
        "status": "success",
        "summary": grand_summary,
        "account_boards": account_boards,
        "grouped_holdings": grouped_holdings_response,
        "kis_accounts": enriched_kis_accounts,
        "manual_cash_list": manual_cash_response,
    }


# ── Manual Asset CRUD ────────────────────────────────────────────────────────
@router.get("/manual-assets")
async def list_manual_assets(db: AsyncSession = Depends(get_db)):
    stmt = select(ManualAsset).order_by(ManualAsset.id.desc())
    res = await db.execute(stmt)
    return res.scalars().all()


@router.post("/manual-assets")
async def create_manual_asset(
    payload: ManualAssetCreate, db: AsyncSession = Depends(get_db)
):
    cur_p = payload.current_price
    asset_name = payload.asset_name
    currency = payload.currency
    country = payload.country

    if payload.ticker:
        info = await fetch_realtime_stock_info(payload.ticker)
        if info:
            if cur_p <= 0.0 and info.get("price"):
                cur_p = info["price"]
            if (not asset_name or asset_name.strip() == payload.ticker.strip()) and info.get("name"):
                asset_name = info["name"]
            if not currency or currency == "KRW":
                currency = info.get("currency", currency)
            if not country or country == "국내":
                country = info.get("country", country)

    asset = ManualAsset(
        category=CATEGORY_NAME_MAP.get(payload.category, "기타투자계좌"),
        account_name=payload.account_name,
        broker=payload.broker,
        asset_name=asset_name,
        ticker=payload.ticker.strip().upper() if payload.ticker else None,
        currency=currency,
        purchase_price=payload.purchase_price,
        current_price=cur_p if cur_p > 0 else payload.purchase_price,
        quantity=payload.quantity if payload.quantity > 0 else 1.0,
        sector=payload.sector,
        country=country,
        memo=payload.memo,
    )
    db.add(asset)
    await db.commit()
    await db.refresh(asset)
    return asset


@router.post("/manual-assets/batch")
async def create_manual_assets_batch(
    payload: BatchManualAssetCreate, db: AsyncSession = Depends(get_db)
):
    """여러 수동 자산을 한 번에 일괄 추가"""
    created_list = []
    for item in payload.assets:
        cur_p = item.current_price
        asset_name = item.asset_name
        currency = item.currency
        country = item.country

        if item.ticker:
            info = await fetch_realtime_stock_info(item.ticker)
            if info:
                if cur_p <= 0.0 and info.get("price"):
                    cur_p = info["price"]
                if (not asset_name or asset_name.strip() == item.ticker.strip()) and info.get("name"):
                    asset_name = info["name"]
                if not currency or currency == "KRW":
                    currency = info.get("currency", currency)
                if not country or country == "국내":
                    country = info.get("country", country)

        asset = ManualAsset(
            category=CATEGORY_NAME_MAP.get(item.category, "기타투자계좌"),
            account_name=item.account_name or item.broker,
            broker=item.broker,
            asset_name=asset_name or (item.ticker or "미지정 종목"),
            ticker=item.ticker.strip().upper() if item.ticker else None,
            currency=currency,
            purchase_price=item.purchase_price,
            current_price=cur_p if cur_p > 0 else item.purchase_price,
            quantity=item.quantity if item.quantity > 0 else 1.0,
            sector=item.sector or "기타",
            country=country,
            memo=item.memo,
        )
        db.add(asset)
        created_list.append(asset)

    await db.commit()
    for a in created_list:
        await db.refresh(a)
    return {"status": "success", "count": len(created_list), "data": created_list}


@router.put("/manual-assets/{asset_id}")
async def update_manual_asset(
    asset_id: int,
    payload: ManualAssetUpdate,
    db: AsyncSession = Depends(get_db),
):
    stmt = select(ManualAsset).where(ManualAsset.id == asset_id)
    res = await db.execute(stmt)
    asset = res.scalars().first()
    if not asset:
        raise HTTPException(status_code=404, detail="Manual asset not found")

    update_data = (
        payload.model_dump(exclude_unset=True)
        if hasattr(payload, "model_dump")
        else payload.dict(exclude_unset=True)
    )

    # 카테고리 변경 (A 계좌분류 -> B 계좌분류 이동)
    if "category" in update_data and update_data["category"]:
        update_data["category"] = CATEGORY_NAME_MAP.get(
            update_data["category"], update_data["category"]
        )

    # 종목코드가 입력되어 있고 현재가가 비어있거나 0인 경우 실시간 시세 조회
    ticker = update_data.get("ticker", asset.ticker)
    cur_p = update_data.get("current_price")
    if ticker and (cur_p is None or cur_p <= 0):
        live_info = await fetch_realtime_stock_info(ticker)
        if live_info and live_info.get("price"):
            update_data["current_price"] = live_info["price"]

    for field, val in update_data.items():
        if val is not None:
            setattr(asset, field, val)

    asset.updated_at = datetime.utcnow()
    await db.commit()
    await db.refresh(asset)
    return asset


@router.post("/manual-assets/batch-delete")
async def batch_delete_manual_assets(
    payload: BatchManualAssetDelete, db: AsyncSession = Depends(get_db)
):
    """여러 수동 자산을 한 번에 삭제"""
    if not payload.ids:
        return {"status": "success", "deleted_count": 0}
    stmt = delete(ManualAsset).where(ManualAsset.id.in_(payload.ids))
    res = await db.execute(stmt)
    await db.commit()
    return {"status": "success", "deleted_count": res.rowcount}


@router.delete("/manual-assets/{asset_id}")
async def delete_manual_asset(
    asset_id: int, db: AsyncSession = Depends(get_db)
):
    stmt = select(ManualAsset).where(ManualAsset.id == asset_id)
    res = await db.execute(stmt)
    asset = res.scalars().first()
    if not asset:
        raise HTTPException(status_code=404, detail="Manual asset not found")

    await db.delete(asset)
    await db.commit()
    return {"status": "success", "deleted_id": asset_id}


# ── Manual Cash CRUD ─────────────────────────────────────────────────────────
@router.get("/manual-cash")
async def list_manual_cash(db: AsyncSession = Depends(get_db)):
    stmt = select(ManualAccountCash).order_by(ManualAccountCash.id.desc())
    res = await db.execute(stmt)
    return res.scalars().all()


@router.post("/manual-cash")
async def upsert_manual_cash(
    payload: ManualCashCreate, db: AsyncSession = Depends(get_db)
):
    stmt = select(ManualAccountCash).where(
        ManualAccountCash.category == payload.category,
        ManualAccountCash.account_name == payload.account_name,
        ManualAccountCash.broker == payload.broker,
    )
    res = await db.execute(stmt)
    existing = res.scalars().first()

    if existing:
        existing.cash_krw = payload.cash_krw
        existing.cash_usd = payload.cash_usd
        existing.memo = payload.memo
        existing.updated_at = datetime.utcnow()
        await db.commit()
        await db.refresh(existing)
        return existing
    else:
        new_cash = ManualAccountCash(
            category=payload.category,
            account_name=payload.account_name,
            broker=payload.broker,
            cash_krw=payload.cash_krw,
            cash_usd=payload.cash_usd,
            memo=payload.memo,
        )
        db.add(new_cash)
        await db.commit()
        await db.refresh(new_cash)
        return new_cash


@router.delete("/manual-cash/{cash_id}")
async def delete_manual_cash(
    cash_id: int, db: AsyncSession = Depends(get_db)
):
    stmt = select(ManualAccountCash).where(ManualAccountCash.id == cash_id)
    res = await db.execute(stmt)
    cash = res.scalars().first()
    if not cash:
        raise HTTPException(status_code=404, detail="Manual cash record not found")

    await db.delete(cash)
    await db.commit()
    return {"status": "success", "deleted_id": cash_id}


# ── KIS Account Mapping ──────────────────────────────────────────────────────
@router.get("/kis-mappings")
async def get_kis_mappings(db: AsyncSession = Depends(get_db)):
    stmt = select(KisAccountMapping).order_by(KisAccountMapping.id.asc())
    res = await db.execute(stmt)
    return res.scalars().all()


@router.post("/kis-mappings")
async def update_kis_mappings(
    payload: KisMappingBatch, db: AsyncSession = Depends(get_db)
):
    for item in payload.mappings:
        stmt = select(KisAccountMapping).where(KisAccountMapping.account_no == item.account_no)
        res = await db.execute(stmt)
        mapping = res.scalars().first()

        if mapping:
            mapping.alias = item.alias
            mapping.category = item.category
            mapping.country = item.country
            mapping.updated_at = datetime.utcnow()
        else:
            new_map = KisAccountMapping(
                account_no=item.account_no,
                alias=item.alias,
                category=item.category,
                country=item.country,
            )
            db.add(new_map)

    await db.commit()
    return {"status": "success", "count": len(payload.mappings)}


# ── Refresh Stock Prices for Manual Assets ───────────────────────────────────
@router.post("/manual-assets/refresh-prices")
async def refresh_manual_prices(db: AsyncSession = Depends(get_db)):
    """티커가 등록된 수동 자산의 현재가를 실시간 시세로 일괄 갱신"""
    stmt = select(ManualAsset).where(ManualAsset.ticker.isnot(None), ManualAsset.ticker != "")
    res = await db.execute(stmt)
    assets = res.scalars().all()

    updated_count = 0
    for a in assets:
        live_p = await fetch_stock_live_price(a.ticker, a.currency)
        if live_p and live_p > 0:
            a.current_price = live_p
            a.updated_at = datetime.utcnow()
            updated_count += 1

    if updated_count > 0:
        await db.commit()

    return {"status": "success", "updated_count": updated_count}
