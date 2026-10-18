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
    """부동산 수집 파이프라인 및 서울/국토부 2대 인증키 연동 상태 진단"""
    is_sample = real_estate_collector.is_sample_or_missing
    try:
        from core.molit_collector import molit_collector
    except ImportError:
        from backend.core.molit_collector import molit_collector

    molit_info = molit_collector.get_api_status()

    return {
        "status": "ready",
        "api_mode": "FALLBACK_CACHE" if is_sample else "LIVE_API",
        "has_custom_key": not is_sample,
        "key_prefix": "sample" if is_sample else (real_estate_collector.api_key[:4] + "****" if len(real_estate_collector.api_key) >= 4 else "****"),
        "seoul_status": {
            "api_name": "SEOUL_OPEN_DATA",
            "provider": "서울시 열린데이터광장",
            "is_live": not is_sample,
            "status": "LIVE_ACTIVE" if not is_sample else "FALLBACK_CACHE_ACTIVE"
        },
        "molit_status": molit_info,
        "notice": "공공 API 키가 미설정된 경우, 2024~2026 검증된 국토부·서울시 정규화 캐시로 무중단 안전 서비스됩니다."
    }


@router.get("/districts")
async def get_district_heatmap(
    region: Optional[str] = Query(None, description="광역 지역 필터 (seoul, gyeonggi, incheon, ALL)"),
    zone: Optional[str] = Query(None, description="상세 권역 필터 (gangnam_plus, core_center, south_west, north_east, north_west, gyeonggi_south, gyeonggi_east, gyeonggi_north, incheon)"),
    sort_by: Optional[str] = Query("jeonse_desc", description="정렬 (jeonse_desc, jeonse_asc, price_desc, volume_desc)"),
    db: AsyncSession = Depends(get_db)
):
    """서울 25개 자치구 및 수도권(경기/인천) 실거래가/전세가율 히트맵 및 갭투자 위험 단지 레이더"""
    try:
        data = await real_estate_collector.get_district_stats(db, region=region)
        districts = data["districts"]


        # 권역 필터링
        if zone and zone != "ALL":
            districts = [d for d in districts if d.get("zone") == zone]

        # 정렬
        if sort_by == "jeonse_desc":
            districts = sorted(districts, key=lambda x: x["jeonse_ratio"], reverse=True)
        elif sort_by == "jeonse_asc":
            districts = sorted(districts, key=lambda x: x["jeonse_ratio"])
        elif sort_by == "price_desc":
            districts = sorted(districts, key=lambda x: x["avg_sale_price"], reverse=True)
        elif sort_by == "volume_desc":
            districts = sorted(districts, key=lambda x: x["trade_count"], reverse=True)

        return {
            "meta": data["meta"],
            "districts": districts,
            "risk_complexes": data["risk_complexes"]
        }
    except Exception as e:
        logger.error(f"Error fetching district heatmap data: {e}")
        raise HTTPException(status_code=500, detail=str(e))


from pydantic import BaseModel
from core.real_estate_complex_service import real_estate_complex_service


class EvaluateApartmentRequest(BaseModel):
    complex_name: str
    area_sqm: float = 84.8
    purchase_price_won: float # 억 단위 (예: 15.0)
    loan_balance_won: float = 0.0 # 대출 잔액 (억)
    jeonse_deposit_won: float = 0.0 # 전세 보증금 (억)
    annual_income_won: float = 1.0 # 연소득 (억)
    mortgage_rate_pct: float = 4.2 # 대출 금리 (%)


@router.get("/complexes")
async def get_major_complexes():
    """국토교통부 표준 시계열이 지원되는 주요 랜드마크 대단지 목록 조회"""
    try:
        return real_estate_complex_service.get_complex_list()
    except Exception as e:
        logger.error(f"Error fetching major complexes: {e}")
        raise HTTPException(status_code=500, detail=str(e))


@router.get("/complex-history")
async def get_complex_history(
    complex_name: str = Query(..., description="조회할 아파트 단지명 (예: 잠실엘스, 마포래미안푸르지오)")
):
    """지정 아파트 단지의 최근 2개년(2024.11~2026.10) 월별 실거래가·전세가·거래량 시계열 조회"""
    try:
        return real_estate_complex_service.get_complex_history(complex_name)
    except Exception as e:
        logger.error(f"Error fetching complex history for {complex_name}: {e}")
        raise HTTPException(status_code=500, detail=str(e))


@router.post("/evaluate-apartment")
async def evaluate_apartment(req: EvaluateApartmentRequest):
    """사용자 등록 아파트 자산 가치 평가 및 LTV / 스트레스 DSR 건전성 정밀 진단"""
    try:
        result = real_estate_complex_service.evaluate_user_apartment(
            complex_name=req.complex_name,
            area_sqm=req.area_sqm,
            purchase_price_won=req.purchase_price_won,
            loan_balance_won=req.loan_balance_won,
            jeonse_deposit_won=req.jeonse_deposit_won,
            annual_income_won=req.annual_income_won,
            mortgage_rate_pct=req.mortgage_rate_pct
        )
        return result
    except Exception as e:
        logger.error(f"Error evaluating user apartment: {e}")
        raise HTTPException(status_code=500, detail=str(e))

