# 시장동향 서버 캐시(OverviewCache) 동작 테스트 — 캐시 없음·만료·동시 요청 공유·실패 유지
import asyncio
import time

from core.overview_cache import OverviewCache


def _cache(results, delay=0.05, ttl=60):
    calls = []

    async def build():
        calls.append(time.time())
        await asyncio.sleep(delay)
        r = results.pop(0)
        if isinstance(r, Exception):
            raise r
        return r
    return OverviewCache("t", ttl, build), calls


def test_first_call_waits_and_concurrent_calls_share_one_build():
    async def run():
        c, calls = _cache([{"v": 1}])
        a, b = await asyncio.gather(c.get(), c.get())
        return a, b, len(calls)
    a, b, n = asyncio.run(run())
    assert a == b == {"v": 1} and n == 1


def test_expired_returns_previous_immediately_then_refreshes_in_background():
    async def run():
        c, calls = _cache([{"v": 1}, {"v": 2}], delay=0.2)
        await c.get()
        c.ts -= 120  # 만료
        t0 = time.perf_counter()
        stale = await c.get()
        quick = time.perf_counter() - t0
        await c._task
        return stale, quick, await c.get(), len(calls)
    stale, quick, fresh, n = asyncio.run(run())
    assert stale == {"v": 1, "refreshing": True} and quick < 0.05
    assert fresh == {"v": 2} and n == 2


def test_failed_refresh_keeps_previous_and_marks_stale_on_force():
    async def run():
        c, _ = _cache([{"v": 1}, RuntimeError("down"), None])
        await c.get()
        forced = await c.get(force=True)      # 수집 예외 → 이전 값 + stale
        forced2 = await c.get(force=True)     # 빌드가 None(원천 실패) → 이전 값 + stale
        return forced, forced2
    forced, forced2 = asyncio.run(run())
    assert forced == {"v": 1, "stale": True} and forced2 == {"v": 1, "stale": True}


def test_no_data_at_all_returns_none():
    c, _ = _cache([None])
    assert asyncio.run(c.get()) is None
