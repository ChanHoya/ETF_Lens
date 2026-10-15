import asyncio
import pytest
from datetime import datetime, timezone, timedelta
from unittest.mock import patch, AsyncMock

from api.exit_signal import (
    seed_us_macro_db_if_empty,
    get_us_macro_indicators,
    get_macro_detail,
    sync_us_macro_indicators_job,
)
from core.overview_cache import OverviewCache
from db.database import AsyncSessionLocal, engine, Base
from db.models import USMacroIndicatorLog, MarketMacroLog, MarketSentimentLog, ExitSignalCache
from sqlalchemy import select, delete


@pytest.mark.asyncio
async def test_us_macro_stale_detection_and_get():
    """미국 매크로 지표 최신 발표치 반영 및 Stale 감지 테스트"""
    async with AsyncSessionLocal() as db:
        # 테스트용 USMacroIndicatorLog 준비
        await db.execute(delete(USMacroIndicatorLog))
        # 2026-08 데이터만 존재하고 2026-09(최신 CPI)가 누락된 상황 모의
        db.add(USMacroIndicatorLog(date="2026-08", cpi_yoy=3.42, ppi_yoy=9.8, pce_yoy=3.0))
        await db.commit()

    with patch("api.exit_signal.sync_us_macro_indicators_job", new_callable=AsyncMock) as mock_sync:
        mock_sync.return_value = True
        
        # 10일 이후 시점 가정 -> 2026-09 결측 감지되어 백그라운드 sync 트리거 확인
        await seed_us_macro_db_if_empty(force=True)
        assert mock_sync.called

    # 엔드포인트 호출 시 결과 반환 확인
    data = await get_us_macro_indicators()
    assert len(data) >= 1
    assert data[0]["date"] == "2026-08"
    assert data[0]["cpi_yoy"] == 3.42


@pytest.mark.asyncio
async def test_macro_detail_db_fast_path():
    """get_macro_detail()이 DB에 데이터가 충분할 때 외부 API 호출 없이 즉시 반환하는지 검증"""
    today_str = datetime.now().strftime("%Y-%m-%d")
    prev_str = (datetime.now() - timedelta(days=10)).strftime("%Y-%m-%d")

    async with AsyncSessionLocal() as db:
        await db.execute(delete(MarketMacroLog))
        await db.execute(delete(MarketSentimentLog))
        for i in range(50):
            d = (datetime.now() - timedelta(days=i)).strftime("%Y-%m-%d")
            db.add(MarketMacroLog(date=d, dollar_index=103.5 + i * 0.01, krw=1350.0))
            db.add(MarketSentimentLog(date=d, kospi=2600.0, sp500=5500.0))
        await db.commit()

    with patch("api.exit_signal._fetch_fred_series", new_callable=AsyncMock) as mock_fred, \
         patch("api.exit_signal._fetch_yahoo_v8", new_callable=AsyncMock) as mock_yf:
        
        # global cache clear
        import api.exit_signal as es
        es._macro_cache = {}

        results = await get_macro_detail(period="6M")
        # DB에서 바로 로드했으므로 외부 fred나 yf 호출이 없어야 함
        assert not mock_fred.called
        assert not mock_yf.called
        assert len(results) >= 40
        assert results[-1]["dollar"] is not None
        assert results[-1]["krw"] is not None


@pytest.mark.asyncio
async def test_overview_cache_db_snapshot_persistence():
    """OverviewCache가 DB 스냅샷을 저장하고 콜드 스타트 시 복원하는지 검증"""
    cache_name = "rates"  # rates는 DB persistence 대상

    async with AsyncSessionLocal() as db:
        await db.execute(delete(ExitSignalCache).where(ExitSignalCache.target_ym == f"OVERVIEW_{cache_name}"))
        await db.commit()

    build_calls = 0
    async def fake_build():
        nonlocal build_calls
        build_calls += 1
        return {"test_key": "test_val", "weekly": [{"date": "2026-10-10", "val": 3.5}]}

    # 1. 최초 빌드 및 DB 저장
    c = OverviewCache(cache_name, ttl=600, build=fake_build)
    data = await c.get()
    assert data["test_key"] == "test_val"
    assert build_calls == 1

    # 2. 새로운 인스턴스 (서버 재기동 모의) - DB에서 즉시 복원되어 build_calls가 증가하지 않아야 함
    c2 = OverviewCache(cache_name, ttl=600, build=fake_build)
    db_restored = await c2.get()
    assert db_restored["test_key"] == "test_val"
    assert db_restored.get("from_db") is True
