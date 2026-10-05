# 환헤지/환노출 비교의 미래 환율 시나리오가 ETF 가격이 늦게 갱신돼도 최신 환율에서 출발하는지 검증하는 테스트
import asyncio
from datetime import date, timedelta

from sqlalchemy.ext.asyncio import AsyncSession, create_async_engine
from sqlalchemy.orm import sessionmaker

import core.price_freshness as pf
from core.currency_analyzer import analyze_fx_impact
from core.price_freshness import ensure_fresh_prices
from db.database import Base
from db.models import ETFDailyPrice, ETFMaster, MarketMacroLog


async def _run(fetch=lambda code, start: []):
    pf._attempt.clear()
    pf.fetch_closes, orig = fetch, pf.fetch_closes   # 네트워크 대신 가짜 원천
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
    pf.fetch_closes = orig
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


def test_stale_pair_prices_are_backfilled_before_analysis():
    today = date.today()
    days = [(today - timedelta(days=i)).isoformat() for i in range(119, -1, -1)]
    fake = lambda code, start: [(d, (200.0 if code == "U1" else 150.0) + k) for k, d in enumerate(days)]  # noqa: E731
    out, _ = asyncio.run(_run(fake))
    assert out["statistics"]["end_date"] == today.isoformat()     # 06월에서 멈춘 가격이 최신까지 채워짐


async def _fresh_case(fetch):
    engine = create_async_engine("sqlite+aiosqlite:///:memory:", echo=False)
    async with engine.begin() as conn:
        await conn.run_sync(Base.metadata.create_all)
    session = sessionmaker(engine, class_=AsyncSession, expire_on_commit=False)
    today = date(2026, 10, 6)
    async with session() as db:
        db.add_all([ETFMaster(code="A"), ETFMaster(code="B")])
        db.add_all([ETFDailyPrice(code="A", date="2026-06-05", close=10.0, nav=9.9),     # 오래됨
                    ETFDailyPrice(code="B", date="2026-10-02", close=20.0)])              # 최신(연휴 포함 4일 이내)
        await db.commit()
        done = await ensure_fresh_prices(db, ["A", "B"], today=today, fetch=fetch)
        again = await ensure_fresh_prices(db, ["A", "B"], today=today, max_age_days=0, fetch=fetch)
        rows = {(r.code, r.date): r for r in (await db.execute(ETFDailyPrice.__table__.select())).all()}
    await engine.dispose()
    return done, again, rows


def test_ensure_fresh_prices_updates_only_stale_and_keeps_other_columns():
    pf._attempt.clear()
    calls = []

    def fetch(code, start):
        calls.append(code)
        return [("2026-06-05", 11.0), ("2026-10-02", 12.0)]
    done, again, rows = asyncio.run(_fresh_case(fetch))
    assert done == ["A"] and calls[0] == "A"
    assert rows[("A", "2026-06-05")].close == 11.0 and rows[("A", "2026-06-05")].nav == 9.9   # 종가만 갱신
    assert rows[("A", "2026-10-02")].close == 12.0
    # 1시간 안에는 같은 종목을 다시 받지 않는다(B는 max_age 0이라 처음 시도)
    assert again == ["B"] and calls == ["A", "B"]


def test_ensure_fresh_prices_survives_source_failure():
    pf._attempt.clear()

    def boom(code, start):
        raise RuntimeError("down")
    done, _, rows = asyncio.run(_fresh_case(boom))
    assert done == [] and rows[("A", "2026-06-05")].close == 10.0
