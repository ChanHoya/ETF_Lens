# 환헤지/환노출 비교의 미래 환율 시나리오가 ETF 가격이 늦게 갱신돼도 최신 환율에서 출발하는지 검증하는 테스트
import asyncio
from datetime import date, timedelta

from sqlalchemy.ext.asyncio import AsyncSession, create_async_engine
from sqlalchemy.orm import sessionmaker

from core.currency_analyzer import analyze_fx_impact
from db.database import Base
from db.models import ETFDailyPrice, ETFMaster, MarketMacroLog


async def _run():
    engine = create_async_engine("sqlite+aiosqlite:///:memory:", echo=False)
    async with engine.begin() as conn:
        await conn.run_sync(Base.metadata.create_all)
    session = sessionmaker(engine, class_=AsyncSession, expire_on_commit=False)
    today = date.today()
    async with session() as db:
        db.add_all([ETFMaster(code="H1", name="테스트 나스닥(H)", tot_fee=0.1),
                    ETFMaster(code="U1", name="테스트 나스닥", tot_fee=0.1)])
        # ETF 가격은 120일 전에 끊김(갱신 지연), 환율은 오늘까지 있음
        for i in range(300, 120, -1):
            d = (today - timedelta(days=i)).isoformat()
            db.add_all([ETFDailyPrice(code="H1", date=d, close=100 + (300 - i) * 0.1),
                        ETFDailyPrice(code="U1", date=d, close=100 + (300 - i) * 0.12)])
        for i in range(300, -1, -1):
            d = (today - timedelta(days=i)).isoformat()
            db.add(MarketMacroLog(date=d, krw=1500.0 if i > 120 else 1350.0))
        await db.commit()
        out = await analyze_fx_impact(db, "H1", "U1")
    await engine.dispose()
    return out, today


def test_scenarios_start_from_latest_fx_not_stale_price_date():
    out, today = asyncio.run(_run())
    st = out["statistics"]
    assert st["end_date"] < st["fx_now_date"] == today.isoformat()   # 가격 기준일과 환율 기준일을 따로 알려 준다
    assert st["fx_now"] == 1350.0 and st["breakeven_fx_change"] == -st["estimated_annual_hedge_cost"]
    fx = {s["fx_change_pct"]: s["expected_fx"] for s in out["scenarios"]}
    assert fx == {-15: 1147.5, -5: 1282.5, 0: 1350.0, 5: 1417.5, 15: 1552.5}
    # 노출 − 헤지 = 환율 변화 + 헤지 비용 → 손익분기에서 0
    adv = {s["fx_change_pct"]: s["advantage_unhedged"] for s in out["scenarios"]}
    assert adv[0] == st["estimated_annual_hedge_cost"] and adv[-15] < 0 < adv[5]
