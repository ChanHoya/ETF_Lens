"""ETF 배당(분배금) 수집 및 집계 코어 모듈 (S6-4)
- yfinance 및 네이버페이 증권 모바일 API를 통한 분배금 시계열 수집
- 배당 주기(월배당/분기/반기/연) 자동 판별 및 TTM 배당수익률 산출
- DB 영속화 (ETFDividendHistory, ETFDividendSummary)
"""

import asyncio
from datetime import datetime, timedelta
import logging
from typing import Any, Dict, List, Optional, Tuple

import requests
import yfinance as yf
from sqlalchemy import select, and_
from sqlalchemy.ext.asyncio import AsyncSession

from db.models import ETFDividendHistory, ETFDividendSummary, ETFMaster

logger = logging.getLogger(__name__)

# 네이버 모바일 API User-Agent
HEADERS = {
    "User-Agent": (
        "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) "
        "AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36"
    )
}


def normalize_symbol(code: str) -> Tuple[str, str]:
    """종목코드 -> (yfinance 심볼, 통화) 변환"""
    clean = code.strip().upper()
    if clean.isdigit():
        # 한국 6자리 코드
        return f"{clean}.KS", "KRW"
    # 미국 및 기타 해외 티커
    return clean, "USD"


def fetch_naver_dividend_info(code: str) -> Dict[str, Any]:
    """네이버 모바일 증권 API에서 TTM 분배율 및 현재가/NAV 조회"""
    if not code.isdigit():
        return {}
    url = f"https://m.stock.naver.com/api/stock/{code}/integration"
    try:
        resp = requests.get(url, headers=HEADERS, timeout=3.5)
        if resp.status_code == 200:
            data = resp.json()
            key_ind = data.get("etfKeyIndicator", {}) or {}
            total_infos = data.get("totalInfos", []) or []
            
            nav_val = None
            price_val = None
            for item in total_infos:
                k = item.get("key")
                v = item.get("value")
                if k == "NAV" and v:
                    nav_val = float(str(v).replace(",", ""))
                elif k == "현재가" and v:
                    price_val = float(str(v).replace(",", ""))

            ttm_str = key_ind.get("dividendYieldTtm")
            ttm_yield = float(ttm_str) if ttm_str is not None else None

            return {
                "dividend_yield_ttm": ttm_yield,
                "nav": nav_val,
                "price": price_val,
            }
    except Exception as e:
        logger.warning(f"[DividendScraper] Naver info fetch failed for {code}: {e}")
    return {}


def fetch_raw_dividends_yfinance(code: str) -> Tuple[List[Dict[str, Any]], Dict[str, Any]]:
    """yfinance를 통한 분배금 지급 시계열 및 기본 info 수집 (동기 호출)"""
    symbol, currency = normalize_symbol(code)
    history_list: List[Dict[str, Any]] = []
    meta_info: Dict[str, Any] = {"currency": currency}

    try:
        ticker = yf.Ticker(symbol)
        divs = ticker.dividends

        # 만약 .KS로 조회 실패하고 한국 코드인 경우 .KQ로 재시도
        if (divs is None or divs.empty) and symbol.endswith(".KS"):
            fallback_symbol = symbol.replace(".KS", ".KQ")
            fallback_ticker = yf.Ticker(fallback_symbol)
            fallback_divs = fallback_ticker.dividends
            if fallback_divs is not None and not fallback_divs.empty:
                divs = fallback_divs
                ticker = fallback_ticker

        if divs is not None and not divs.empty:
            # 날짜순 오름차순 정렬
            divs = divs.sort_index()
            for ts, amt in divs.items():
                if amt is not None and amt > 0:
                    ex_date = ts.strftime("%Y-%m-%d")
                    history_list.append({
                        "code": code,
                        "ex_date": ex_date,
                        "dividend_amount": round(float(amt), 4),
                        "currency": currency,
                    })

        # yfinance info에서 현재가 등 보조 정보 획득
        try:
            fast_info = getattr(ticker, "fast_info", None)
            if fast_info:
                meta_info["last_price"] = getattr(fast_info, "last_price", None)
        except Exception:
            pass

    except Exception as e:
        logger.error(f"[DividendScraper] yfinance fetch error for {code} ({symbol}): {e}")

    return history_list, meta_info


def calculate_dividend_summary(
    code: str,
    name: Optional[str],
    history_list: List[Dict[str, Any]],
    naver_info: Dict[str, Any],
    yf_meta: Dict[str, Any],
) -> Dict[str, Any]:
    """분배금 히스토리 기반 주기(Frequency), 연간 배당액, TTM 수익률, 지급월 분석"""
    currency = yf_meta.get("currency", "KRW")
    if not history_list:
        return {
            "code": code,
            "name": name,
            "dividend_frequency": "NONE",
            "dividend_yield_ttm": 0.0,
            "last_dividend_amount": 0.0,
            "last_ex_date": None,
            "annual_dividend_amount": 0.0,
            "dividend_count_1y": 0,
            "dividend_months": "",
            "currency": currency,
        }

    # 최근 순으로 정렬
    sorted_hist = sorted(history_list, key=lambda x: x["ex_date"], reverse=True)
    latest = sorted_hist[0]
    last_dividend_amount = latest["dividend_amount"]
    last_ex_date = latest["ex_date"]

    # 최근 1년(365일 기준) 지급 내역 필터링
    latest_dt = datetime.strptime(last_ex_date, "%Y-%m-%d")
    one_year_ago = latest_dt - timedelta(days=365)

    recent_1y = [
        item for item in sorted_hist
        if datetime.strptime(item["ex_date"], "%Y-%m-%d") >= one_year_ago
    ]

    dividend_count_1y = len(recent_1y)
    annual_dividend_amount = round(sum(item["dividend_amount"] for item in recent_1y), 2)

    # 지급 월(1~12) 집계
    months_set = set()
    for item in recent_1y:
        m = datetime.strptime(item["ex_date"], "%Y-%m-%d").month
        months_set.add(m)
    sorted_months = sorted(list(months_set))
    dividend_months_str = ",".join(str(m) for m in sorted_months)

    # 배당 주기 자동 판별
    if dividend_count_1y >= 10:
        dividend_frequency = "MONTHLY"       # 월배당 (10~12회 이상)
    elif 3 <= dividend_count_1y <= 5:
        dividend_frequency = "QUARTERLY"     # 분기배당 (3~4회)
    elif dividend_count_1y == 2:
        dividend_frequency = "SEMI_ANNUAL"   # 반기배당
    elif dividend_count_1y == 1:
        dividend_frequency = "ANNUAL"        # 연배당
    elif dividend_count_1y == 0:
        dividend_frequency = "NONE"
    else:
        dividend_frequency = "IRREGULAR"     # 비정기/격월 등

    # TTM 배당수익률 산출
    # 1. 네이버 TTM 분배율 우선 사용
    ttm_yield = naver_info.get("dividend_yield_ttm")
    if ttm_yield is None or ttm_yield <= 0:
        # 2. 현재가 기반 자체 연산: (연간 배당금 / 현재가) * 100
        cur_price = naver_info.get("price") or naver_info.get("nav") or yf_meta.get("last_price")
        if cur_price and cur_price > 0:
            ttm_yield = round((annual_dividend_amount / cur_price) * 100, 2)
        else:
            ttm_yield = 0.0

    return {
        "code": code,
        "name": name,
        "dividend_frequency": dividend_frequency,
        "dividend_yield_ttm": round(float(ttm_yield or 0.0), 2),
        "last_dividend_amount": round(float(last_dividend_amount), 2),
        "last_ex_date": last_ex_date,
        "annual_dividend_amount": round(float(annual_dividend_amount), 2),
        "dividend_count_1y": dividend_count_1y,
        "dividend_months": dividend_months_str,
        "currency": currency,
    }


async def scrape_and_save_etf_dividend(
    db: AsyncSession,
    code: str,
    name: Optional[str] = None
) -> Dict[str, Any]:
    """단일 ETF 분배금 수집, DB 저장 및 결과 반환"""
    clean_code = code.strip().upper()

    # ETFMaster에서 이름 조회 (인자가 없으면)
    if not name:
        master_res = await db.execute(select(ETFMaster.name).where(ETFMaster.code == clean_code))
        name = master_res.scalar_one_or_none()

    # 1. yfinance 분배금 수집 (I/O 바운드, 쓰레드풀 실행)
    loop = asyncio.get_running_loop()
    raw_hist, yf_meta = await loop.run_in_executor(None, fetch_raw_dividends_yfinance, clean_code)

    # 2. 네이버 모바일 API 지표 조회
    naver_info = await loop.run_in_executor(None, fetch_naver_dividend_info, clean_code)

    # 3. 요약 지표 산출
    summary_dict = calculate_dividend_summary(clean_code, name, raw_hist, naver_info, yf_meta)

    # 4. DB 영속화: 개별 내역 upsert
    for item in raw_hist:
        existing = await db.execute(
            select(ETFDividendHistory).where(
                and_(
                    ETFDividendHistory.code == item["code"],
                    ETFDividendHistory.ex_date == item["ex_date"],
                )
            )
        )
        rec = existing.scalar_one_or_none()
        if rec:
            rec.dividend_amount = item["dividend_amount"]
            rec.currency = item["currency"]
        else:
            new_rec = ETFDividendHistory(
                code=item["code"],
                ex_date=item["ex_date"],
                dividend_amount=item["dividend_amount"],
                currency=item["currency"],
            )
            db.add(new_rec)

    # 5. DB 영속화: 요약 summary upsert
    sum_res = await db.execute(select(ETFDividendSummary).where(ETFDividendSummary.code == clean_code))
    sum_rec = sum_res.scalar_one_or_none()
    if sum_rec:
        sum_rec.name = summary_dict["name"] or sum_rec.name
        sum_rec.dividend_frequency = summary_dict["dividend_frequency"]
        sum_rec.dividend_yield_ttm = summary_dict["dividend_yield_ttm"]
        sum_rec.last_dividend_amount = summary_dict["last_dividend_amount"]
        sum_rec.last_ex_date = summary_dict["last_ex_date"]
        sum_rec.annual_dividend_amount = summary_dict["annual_dividend_amount"]
        sum_rec.dividend_count_1y = summary_dict["dividend_count_1y"]
        sum_rec.dividend_months = summary_dict["dividend_months"]
        sum_rec.currency = summary_dict["currency"]
        sum_rec.updated_at = datetime.utcnow()
    else:
        new_summary = ETFDividendSummary(
            code=summary_dict["code"],
            name=summary_dict["name"],
            dividend_frequency=summary_dict["dividend_frequency"],
            dividend_yield_ttm=summary_dict["dividend_yield_ttm"],
            last_dividend_amount=summary_dict["last_dividend_amount"],
            last_ex_date=summary_dict["last_ex_date"],
            annual_dividend_amount=summary_dict["annual_dividend_amount"],
            dividend_count_1y=summary_dict["dividend_count_1y"],
            dividend_months=summary_dict["dividend_months"],
            currency=summary_dict["currency"],
        )
        db.add(new_summary)

    await db.commit()

    return {
        "summary": summary_dict,
        "history_count": len(raw_hist),
        "history": raw_hist[-24:] if raw_hist else [],  # 최근 최대 24건
    }


async def get_etf_dividend_detail(
    db: AsyncSession,
    code: str,
    auto_sync: bool = True
) -> Dict[str, Any]:
    """DB에서 ETF 분배금 상세 및 이력 조회 (없을 경우 auto_sync 옵션으로 즉시 수집)"""
    clean_code = code.strip().upper()

    sum_res = await db.execute(select(ETFDividendSummary).where(ETFDividendSummary.code == clean_code))
    summary_rec = sum_res.scalar_one_or_none()

    # DB에 없거나 캐시가 오래된 경우 즉시 수집
    if not summary_rec and auto_sync:
        return await scrape_and_save_etf_dividend(db, clean_code)

    if not summary_rec:
        return {"summary": None, "history": []}

    hist_res = await db.execute(
        select(ETFDividendHistory)
        .where(ETFDividendHistory.code == clean_code)
        .order_by(ETFDividendHistory.ex_date.desc())
    )
    histories = hist_res.scalars().all()

    summary_dict = {
        "code": summary_rec.code,
        "name": summary_rec.name,
        "dividend_frequency": summary_rec.dividend_frequency,
        "dividend_yield_ttm": summary_rec.dividend_yield_ttm,
        "last_dividend_amount": summary_rec.last_dividend_amount,
        "last_ex_date": summary_rec.last_ex_date,
        "annual_dividend_amount": summary_rec.annual_dividend_amount,
        "dividend_count_1y": summary_rec.dividend_count_1y,
        "dividend_months": summary_rec.dividend_months,
        "currency": summary_rec.currency,
        "updated_at": summary_rec.updated_at.isoformat() if summary_rec.updated_at else None,
    }

    history_list = [
        {
            "ex_date": h.ex_date,
            "dividend_amount": h.dividend_amount,
            "payment_date": h.payment_date,
            "currency": h.currency,
        }
        for h in histories
    ]

    return {
        "summary": summary_dict,
        "history_count": len(history_list),
        "history": history_list,
    }


def compute_portfolio_monthly_cashflow(
    portfolio_holdings: List[Dict[str, Any]],
    dividend_summaries: Dict[str, Dict[str, Any]],
) -> Dict[str, Any]:
    """보유 포트폴리오 기반 1~12월 월별 예상 배당금(Cashflow) 계산 (S6-5 사전 지원)"""
    monthly_krw = [0.0] * 12
    monthly_usd = [0.0] * 12
    holding_details = []
    total_annual_krw = 0.0
    total_annual_usd = 0.0

    for item in portfolio_holdings:
        code = str(item.get("code") or item.get("ticker", "")).strip().upper()
        shares = float(item.get("shares") or item.get("qty", 0))
        if not code or shares <= 0:
            continue

        sum_data = dividend_summaries.get(code)
        if not sum_data:
            continue

        currency = sum_data.get("currency", "KRW")
        last_amt = float(sum_data.get("last_dividend_amount") or 0.0)
        annual_amt = float(sum_data.get("annual_dividend_amount") or 0.0)
        freq = sum_data.get("dividend_frequency", "UNKNOWN")
        months_str = sum_data.get("dividend_months", "") or ""

        # 월 목록 파싱
        active_months = []
        if months_str:
            for m in months_str.split(","):
                try:
                    active_months.append(int(m.strip()))
                except ValueError:
                    pass

        # 배당월이 없으면 주기 기반 추정
        if not active_months:
            if freq == "MONTHLY":
                active_months = list(range(1, 13))
            elif freq == "QUARTERLY":
                active_months = [1, 4, 7, 10]
            elif freq == "SEMI_ANNUAL":
                active_months = [6, 12]
            elif freq == "ANNUAL":
                active_months = [12]

        per_payout_amount = last_amt if last_amt > 0 else (annual_amt / len(active_months) if active_months else 0)
        expected_payout = round(per_payout_amount * shares, 2)
        annual_payout = round(per_payout_amount * shares * len(active_months), 2)

        for m in active_months:
            if 1 <= m <= 12:
                if currency == "USD":
                    monthly_usd[m - 1] += expected_payout
                else:
                    monthly_krw[m - 1] += expected_payout

        if currency == "USD":
            total_annual_usd += annual_payout
        else:
            total_annual_krw += annual_payout

        holding_details.append({
            "code": code,
            "name": sum_data.get("name") or code,
            "shares": shares,
            "currency": currency,
            "frequency": freq,
            "per_payout_amount": per_payout_amount,
            "active_months": active_months,
            "annual_expected_total": annual_payout,
            "yield_ttm": sum_data.get("dividend_yield_ttm", 0.0),
        })

    return {
        "monthly_cashflow_krw": [round(v, 0) for v in monthly_krw],
        "monthly_cashflow_usd": [round(v, 2) for v in monthly_usd],
        "total_annual_krw": round(total_annual_krw, 0),
        "total_annual_usd": round(total_annual_usd, 2),
        "holdings": holding_details,
    }
