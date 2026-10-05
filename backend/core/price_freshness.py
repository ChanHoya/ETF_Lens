# 야간 배치 대상 밖 ETF의 일별 가격이 오래됐으면 요청한 종목만 즉석으로 1년치를 받아 채우는 helper
"""
2026-06-06(ee513704) 야간 가격 배치가 메모리 절감을 위해 '활성 ETF'만 수집하도록 바뀌면서,
그 밖의 ETF(예: 환헤지/환노출 페어) 가격이 06-05에서 멈췄다. 화면이 그런 종목을 쓸 때 이 helper로 보충한다.
- 원천: FinanceDataReader(KRX 영숫자 코드 0085N0 등도 지원).
- 기존 행은 종가만 갱신(nav·괴리율 등 다른 컬럼 보존), 없는 날짜만 추가한다.
- 원천 실패 시 같은 종목은 1시간 동안 다시 시도하지 않는다(화면 응답 지연 방지).
"""
import asyncio
import logging
import time
from datetime import date, timedelta

from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession

from db.models import ETFDailyPrice

logger = logging.getLogger(__name__)

MAX_AGE_DAYS = 4      # 주말·연휴를 넘겨도 오래됐다고 보지 않는 여유(일)
LOOKBACK_DAYS = 380   # 1년 수익률 계산에 필요한 기간 + 여유
RETRY_SEC = 3600
_attempt: dict[str, float] = {}


def fetch_closes(code: str, start: str) -> list[tuple[str, float]]:
    """FinanceDataReader 일별 종가 [(YYYY-MM-DD, close)]."""
    import FinanceDataReader as fdr
    df = fdr.DataReader(code, start)
    if df is None or df.empty or "Close" not in df:
        return []
    return [(str(i.date()), float(v)) for i, v in df["Close"].dropna().items() if float(v) > 0]


async def ensure_fresh_prices(db: AsyncSession, codes: list[str], today: date | None = None,
                              max_age_days: int = MAX_AGE_DAYS, fetch=None) -> list[str]:
    """codes 중 마지막 가격이 max_age_days보다 오래된 종목만 다시 받아 저장한다. 반환: 갱신한 종목."""
    today = today or date.today()
    fetch = fetch or fetch_closes
    rows = (await db.execute(select(ETFDailyPrice.code, func.max(ETFDailyPrice.date))
                             .where(ETFDailyPrice.code.in_(codes)).group_by(ETFDailyPrice.code))).all()
    last = {c: d for c, d in rows}
    stale = [c for c in codes if not last.get(c) or (today - date.fromisoformat(last[c])).days > max_age_days]
    start = (today - timedelta(days=LOOKBACK_DAYS)).isoformat()
    refreshed = []
    for code in stale:
        if time.time() - _attempt.get(code, 0) < RETRY_SEC:
            continue
        _attempt[code] = time.time()
        try:
            closes = await asyncio.to_thread(fetch, code, start)
        except Exception as e:
            logger.warning(f"[price_freshness] {code} 가격 수집 실패: {type(e).__name__}: {e}")
            continue
        if not closes:
            continue
        existing = {r.date: r for r in (await db.execute(
            select(ETFDailyPrice).where(ETFDailyPrice.code == code, ETFDailyPrice.date >= closes[0][0]))).scalars()}
        for d, v in closes:
            if d in existing:
                existing[d].close = v
            else:
                db.add(ETFDailyPrice(code=code, date=d, close=v))
        refreshed.append(code)
        logger.info(f"[price_freshness] {code} {last.get(code)} → {closes[-1][0]} ({len(closes)}일)")
    if refreshed:
        await db.commit()
    return refreshed
