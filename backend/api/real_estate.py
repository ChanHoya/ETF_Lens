# backend/api/real_estate.py
"""
부동산 인텔리전스 API 라우터
- 서울 아파트 실거래량 및 매물 적체량 시계열 조회
- 4대 거시 지표 서머리 조회
- 서울시 열린데이터광장 및 내부 캐시 동기화 엔드포인트
"""

import logging
from typing import List, Dict, Any, Optional
from fastapi import APIRouter, Depends, Query, HTTPException
from sqlalchemy.ext.asyncio import AsyncSession

from db.database import get_db
from core.real_estate_collector import real_estate_collector

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/real-estate", tags=["real-estate"])


@router.get("/market-trends")
async def get_market_trends(
    period: str = Query("ALL", pattern="^(1Y|2Y|ALL)$", description="조회 기간 (1Y, 2Y, ALL)"),
    db: AsyncSession = Depends(get_db)
):
    """서울 아파트 매물 적체량(선) vs 월간 실거래량(막대) 시계열 조회"""
    try:
        data = await real_estate_collector.get_market_trends(db, period=period)
        return {
            "period": period,
            "count": len(data),
            "is_fallback": real_estate_collector.is_sample_or_missing,
            "data_source": "FALLBACK_CACHE" if real_estate_collector.is_sample_or_missing else "SEOUL_OPEN_DATA_LIVE",
            "data": data
        }
    except Exception as e:
        logger.error(f"Error fetching real estate market trends: {e}")
        raise HTTPException(status_code=500, detail=str(e))


@router.get("/summary")
async def get_real_estate_summary(
    db: AsyncSession = Depends(get_db)
):
    """부동산 4대 거시 지표 퀵 서머리 카드용 최신 데이터"""
    try:
        summary = await real_estate_collector.get_summary_metrics(db)
        return summary
    except Exception as e:
        logger.error(f"Error fetching real estate summary: {e}")
        raise HTTPException(status_code=500, detail=str(e))


@router.post("/sync")
async def sync_real_estate_data(
    force: bool = Query(False, description="강제 재동기화 여부"),
    db: AsyncSession = Depends(get_db)
):
    """실시간 서울시 오픈데이터 및 실거래 통계 수동 동기화"""
    try:
        result = await real_estate_collector.sync_database(db, force=force)
        return result
    except Exception as e:
        logger.error(f"Error syncing real estate data: {e}")
        raise HTTPException(status_code=500, detail=str(e))


@router.get("/status")
async def get_real_estate_status():
    """부동산 수집 파이프라인 및 인증키 연동 상태 진단"""
    is_sample = real_estate_collector.is_sample_or_missing
    return {
        "status": "ready",
        "api_mode": "FALLBACK_CACHE" if is_sample else "LIVE_API",
        "has_custom_key": not is_sample,
        "key_prefix": "sample" if is_sample else (real_estate_collector.api_key[:4] + "****" if len(real_estate_collector.api_key) >= 4 else "****"),
        "notice": "SEOUL_OPEN_DATA_KEY가 sample이거나 미설정된 경우, 2024~2026 검증된 실제 기반 캐시로 안전하게 서비스됩니다."
    }
