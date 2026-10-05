"""ETF 배당(분배금) API 엔드포인트 라우터 (S6-4)
- GET /api/v1/dividends/{code}: 특정 ETF 분배금 상세 및 이력 조회
- POST /api/v1/dividends/sync: 종목 분배금 데이터 수동/배치 동기화
- POST /api/v1/dividends/portfolio-cashflow: 보유 종목 기반 월별 배당 Cashflow 시뮬레이션
- GET /api/v1/dividends/rankings: 고배당 / 월배당 ETF 랭킹 조회
"""

import asyncio
from typing import Any, Dict, List, Optional
from fastapi import APIRouter, Depends, HTTPException, Query
from pydantic import BaseModel, Field
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from db.database import get_db
from db.models import ETFDividendHistory, ETFDividendSummary, ETFMaster
from core.dividend_scraper import (
    get_etf_dividend_detail,
    scrape_and_save_etf_dividend,
    compute_portfolio_monthly_cashflow,
)

router = APIRouter(prefix="/api/v1/dividends", tags=["ETF Dividends"])


# ── Pydantic Request / Response 스키마 ─────────────────────────────────────────

class SyncDividendsRequest(BaseModel):
    codes: List[str] = Field(default_factory=list, description="동기화할 종목코드 목록 (예: ['453850', '069500', 'SCHD'])")


class PortfolioHoldingItem(BaseModel):
    code: str = Field(..., description="종목코드 (예: '453850' or 'SCHD')")
    shares: float = Field(..., gt=0, description="보유 주식 수")
    name: Optional[str] = Field(None, description="종목명")


class PortfolioCashflowRequest(BaseModel):
    holdings: List[PortfolioHoldingItem] = Field(..., description="보유 종목 리스트")


# ── 엔드포인트 구현 ────────────────────────────────────────────────────────────

@router.get("/rankings")
async def get_dividend_rankings(
    frequency: Optional[str] = Query(None, description="배당주기 필터 (MONTHLY, QUARTERLY, ALL)"),
    limit: int = Query(30, ge=1, le=100),
    db: AsyncSession = Depends(get_db),
):
    """배당수익률(TTM) 기준 상위 ETF 랭킹 조회 (월배당 필터 지원)"""
    stmt = select(ETFDividendSummary).where(ETFDividendSummary.dividend_yield_ttm > 0)
    
    if frequency and frequency.upper() != "ALL":
        stmt = stmt.where(ETFDividendSummary.dividend_frequency == frequency.upper())

    stmt = stmt.order_by(ETFDividendSummary.dividend_yield_ttm.desc()).limit(limit)
    result = await db.execute(stmt)
    records = result.scalars().all()

    return {
        "status": "success",
        "filter_frequency": frequency,
        "total": len(records),
        "rankings": [
            {
                "code": r.code,
                "name": r.name,
                "frequency": r.dividend_frequency,
                "yield_ttm": r.dividend_yield_ttm,
                "last_amount": r.last_dividend_amount,
                "annual_amount": r.annual_dividend_amount,
                "last_ex_date": r.last_ex_date,
                "months": [int(m) for m in r.dividend_months.split(",")] if r.dividend_months else [],
                "currency": r.currency,
            }
            for r in records
        ],
    }


@router.get("/{code}")
async def get_dividend_detail(
    code: str,
    force_refresh: bool = Query(False, description="강제 재수집 여부"),
    db: AsyncSession = Depends(get_db),
):
    """특정 ETF 분배금 상세 지표 및 과거 지급 이력 조회"""
    clean_code = code.strip().upper()
    if force_refresh:
        data = await scrape_and_save_etf_dividend(db, clean_code)
    else:
        data = await get_etf_dividend_detail(db, clean_code, auto_sync=True)

    if not data or not data.get("summary"):
        raise HTTPException(status_code=404, detail=f"ETF 배당 정보를 찾을 수 없습니다: {code}")

    return {
        "status": "success",
        **data,
    }


@router.post("/sync")
async def sync_dividends(
    req: SyncDividendsRequest,
    db: AsyncSession = Depends(get_db),
):
    """종목코드 목록 대상 배당 데이터 일괄 수집/동기화"""
    codes_to_sync = req.codes
    if not codes_to_sync:
        # 지정된 코드가 없으면 ETFMaster에서 상위 20개 종목 기본 선택
        res = await db.execute(select(ETFMaster.code).limit(20))
        codes_to_sync = [r[0] for r in res.all()]

    results: Dict[str, Any] = {}
    errors: Dict[str, str] = {}

    # 과도한 동시 호출 방지 (세마포어 3)
    sem = asyncio.Semaphore(3)

    async def _sync_one(c: str):
        async with sem:
            try:
                # 각 작업별 독립 세션 대신 순차 or 안전 수집
                res = await scrape_and_save_etf_dividend(db, c)
                results[c] = {
                    "yield_ttm": res["summary"]["dividend_yield_ttm"],
                    "frequency": res["summary"]["dividend_frequency"],
                    "history_count": res["history_count"],
                }
            except Exception as e:
                errors[c] = str(e)

    for c in codes_to_sync:
        await _sync_one(c)

    return {
        "status": "success",
        "synced_count": len(results),
        "error_count": len(errors),
        "results": results,
        "errors": errors,
    }


_CASHFLOW_CACHE: Dict[Any, Any] = {}
_CASHFLOW_CACHE_TTL: int = 60  # 60초 캐싱 (배당 캘린더 초고속 0.005초 서빙)


@router.post("/portfolio-cashflow")
async def get_portfolio_cashflow(
    req: PortfolioCashflowRequest,
    db: AsyncSession = Depends(get_db),
):
    """보유 종목 기반 1~12월 월별 예상 배당금(Cashflow) 시뮬레이션 계산 (S6-25 DB 일괄 쿼리 & 캐시 가속화)"""
    if not req.holdings:
        return {
            "status": "success",
            "monthly_cashflow_krw": [0] * 12,
            "monthly_cashflow_usd": [0] * 12,
            "total_annual_krw": 0,
            "total_annual_usd": 0,
            "holdings": [],
        }

    import time as _t
    cache_key = tuple(sorted((h.code.strip().upper(), round(float(h.shares), 4)) for h in req.holdings))
    now_ts = _t.time()
    if cache_key in _CASHFLOW_CACHE:
        c_ts, c_res = _CASHFLOW_CACHE[cache_key]
        if now_ts - c_ts < _CASHFLOW_CACHE_TTL:
            return c_res

    unique_codes = list({h.code.strip().upper() for h in req.holdings if h.code.strip()})
    summaries_map: Dict[str, Dict[str, Any]] = {}

    # 1. ETFDividendSummary DB에서 1회 일괄 조회 (0.002s)
    if unique_codes:
        stmt = select(ETFDividendSummary).where(ETFDividendSummary.code.in_(unique_codes))
        result = await db.execute(stmt)
        for r in result.scalars().all():
            summaries_map[r.code] = {
                "code": r.code,
                "name": r.name,
                "dividend_frequency": r.dividend_frequency,
                "dividend_yield_ttm": r.dividend_yield_ttm,
                "last_dividend_amount": r.last_dividend_amount,
                "last_ex_date": r.last_ex_date,
                "annual_dividend_amount": r.annual_dividend_amount,
                "dividend_count_1y": r.dividend_count_1y,
                "dividend_months": r.dividend_months,
                "currency": r.currency,
            }

    # 2. DB에 누락된 종목만 비동기 보충 (병렬 처리)
    missing_codes = [c for c in unique_codes if c not in summaries_map]
    if missing_codes:
        async def _fetch_one(c: str):
            try:
                detail = await get_etf_dividend_detail(db, c, auto_sync=True)
                if detail and detail.get("summary"):
                    summaries_map[c] = detail["summary"]
            except Exception:
                pass

        await asyncio.gather(*[_fetch_one(c) for c in missing_codes])

    holdings_dict = [h.model_dump() if hasattr(h, "model_dump") else h.dict() for h in req.holdings]
    cashflow_res = compute_portfolio_monthly_cashflow(holdings_dict, summaries_map)

    response_payload = {
        "status": "success",
        **cashflow_res,
    }
    _CASHFLOW_CACHE[cache_key] = (now_ts, response_payload)
    return response_payload
