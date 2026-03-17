"""
ETF 성과 지표 계산 모듈
- ETFDailyPrice 테이블의 종가 데이터로 수익률/변동성/샤프지수 계산
- ETFMaster 테이블의 return_*/volatility/sharpe 컬럼에 저장
"""
from __future__ import annotations

import logging
from datetime import datetime

from sqlalchemy import select, update
from sqlalchemy.ext.asyncio import AsyncSession

logger = logging.getLogger(__name__)


async def calc_returns_from_db(code: str, db: AsyncSession) -> dict:
    """
    ETFDailyPrice 데이터로 1M/3M/6M/1Y 수익률, 연환산 변동성, 샤프지수 계산.
    데이터 부족 시 해당 항목은 None 반환.
    """
    from db.models import ETFDailyPrice

    rows = (await db.execute(
        select(ETFDailyPrice.date, ETFDailyPrice.close)
        .where(ETFDailyPrice.code == code)
        .order_by(ETFDailyPrice.date.desc())
        .limit(265)   # 약 1년치 + 여유
    )).all()

    if len(rows) < 5:
        return {}

    # 오래된 순으로 정렬
    closes = [r.close for r in reversed(rows)]

    def ret(n_days: int) -> float | None:
        if len(closes) < n_days + 1:
            return None
        base = closes[-(n_days + 1)]
        if not base or base == 0:
            return None
        return round((closes[-1] / base - 1) * 100, 2)

    # 연환산 변동성
    try:
        import numpy as np
        arr = [c for c in closes if c and c > 0]
        if len(arr) >= 10:
            daily_rets = [(arr[i] - arr[i - 1]) / arr[i - 1] for i in range(1, len(arr))]
            vol = float(np.std(daily_rets) * (252 ** 0.5) * 100)
            vol = round(vol, 2)
        else:
            vol = None
    except Exception:
        vol = None

    r3m = ret(63)
    sharpe = round(r3m / vol, 3) if (r3m is not None and vol and vol > 0) else None

    return {
        "return_1m": ret(21),
        "return_3m": r3m,
        "return_6m": ret(126),
        "return_1y": ret(252),
        "volatility": vol,
        "sharpe": sharpe,
        "perf_updated_at": datetime.utcnow(),
    }


async def update_all_etf_performance(db: AsyncSession) -> int:
    """
    전체 ETFMaster 종목의 성과 지표를 재계산해 DB에 저장.
    스케줄러(매일 19:00)에서 호출.
    """
    from db.models import ETFMaster

    codes = (await db.execute(select(ETFMaster.code))).scalars().all()
    updated = 0
    skipped = 0

    for code in codes:
        try:
            perf = await calc_returns_from_db(code, db)
            if perf:
                await db.execute(
                    update(ETFMaster)
                    .where(ETFMaster.code == code)
                    .values(**perf)
                )
                updated += 1
            else:
                skipped += 1
        except Exception as e:
            logger.warning(f"[ETF Perf] {code} 계산 오류: {e}")

    await db.commit()
    logger.info(f"[ETF Perf] 업데이트 완료: {updated}건, 데이터 없음: {skipped}건")
    return updated


async def update_all_etf_performance_job():
    """스케줄러용 래퍼 — DB 세션 자동 관리"""
    from db.database import AsyncSessionLocal
    async with AsyncSessionLocal() as db:
        count = await update_all_etf_performance(db)
    logger.info(f"[ETF Perf Job] {count}개 종목 성과 업데이트 완료")
