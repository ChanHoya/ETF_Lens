"""Unit tests for async HTTP connection pool and concurrency semaphore (Sprint 10: S10-2)"""

import asyncio
import pytest
import httpx
from core.unified_quant_engine import UnifiedQuantEngine, quant_engine


@pytest.mark.asyncio
async def test_shared_http_client_singleton():
    """Verify get_http_client creates and reuses a shared AsyncClient pool"""
    engine = UnifiedQuantEngine()
    client1 = await engine.get_http_client()
    client2 = await engine.get_http_client()
    assert client1 is client2
    assert not client1.is_closed

    # Clean close
    await engine.close()
    assert engine._http_client is None

    # Re-open after close
    client3 = await engine.get_http_client()
    assert client3 is not None
    assert not client3.is_closed
    await engine.close()


@pytest.mark.asyncio
async def test_fetch_live_prices_batch_concurrency():
    """Verify batch live price fetching respects concurrency and handles missing assets gracefully"""
    engine = UnifiedQuantEngine()

    tickers = ["069500", "379800", "005930"]  # KODEX 200, KODEX 미국S&P500TR, 삼성전자
    results = await engine.fetch_live_prices_batch(tickers)

    assert isinstance(results, dict)
    assert len(results) == len(tickers)
    for t in tickers:
        assert t in results
        # Either float price or None if offline/market closed
        if results[t] is not None:
            assert isinstance(results[t], (int, float))
            assert results[t] > 0

    await engine.close()


@pytest.mark.asyncio
async def test_semaphore_concurrency_limiting(monkeypatch):
    """Verify semaphore limits concurrent requests to 8"""
    engine = UnifiedQuantEngine()
    active_concurrent = 0
    max_seen = 0

    async def mock_naver_get(*args, **kwargs):
        nonlocal active_concurrent, max_seen
        active_concurrent += 1
        max_seen = max(max_seen, active_concurrent)
        await asyncio.sleep(0.05)
        active_concurrent -= 1
        # Mock response
        class MockResp:
            status_code = 200
            def json(self):
                return {"nowPrice": "50,000"}
        return MockResp()

    client = await engine.get_http_client()
    monkeypatch.setattr(client, "get", mock_naver_get)

    # Launch 20 concurrent requests
    tickers = [f"00000{i}" for i in range(20)]
    await engine.fetch_live_prices_batch(tickers)

    assert max_seen <= 8, f"Max concurrent ({max_seen}) exceeded semaphore limit (8)"
    await engine.close()
