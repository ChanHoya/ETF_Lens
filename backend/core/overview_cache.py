# 시장동향 환율·금리 API의 서버 캐시 — 만료되면 이전 값을 즉시 주고 백그라운드 재수집, 동시 요청은 한 번의 수집을 공유
"""
- 원천 다운로드(FRED·ECOS·Yahoo)는 I/O라 전용 스레드 풀(16)로 동시에 받는다.
  asyncio 기본 풀은 CPU 수 + 4라 Render 소형 인스턴스에서 10~20개 시계열이 몇 개씩 줄 서서 1분 넘게 걸렸다.
- OverviewCache.get(): 캐시 없음·force → 수집을 기다림 / 만료 → 이전 값 즉시 반환 + 백그라운드 수집 / 신선 → 그대로.
"""
import asyncio
import logging
import time
from concurrent.futures import ThreadPoolExecutor
from typing import Awaitable, Callable

import requests

logger = logging.getLogger(__name__)

IO_POOL = ThreadPoolExecutor(max_workers=6, thread_name_prefix="overview-io")


async def run_io(fn, *args):
    return await asyncio.get_running_loop().run_in_executor(IO_POOL, fn, *args)


async def timed(fn, *args) -> tuple[dict, float]:
    """동기 수집 함수를 전용 풀에서 실행하고 (결과, 걸린 초)를 돌려준다."""
    t0 = time.perf_counter()
    out = await run_io(fn, *args)
    return out, round(time.perf_counter() - t0, 2)


def fred_csv(fred_id: str, start: str) -> dict[str, float]:
    """FRED fredgraph CSV(키 불필요) → {YYYY-MM-DD: float}. cosd로 start(YYYY-MM-DD) 이후만 받아 용량을 줄인다."""
    try:
        url = f"https://fred.stlouisfed.org/graph/fredgraph.csv?id={fred_id}&cosd={start}"
        resp = requests.get(url, headers={"User-Agent": "python-requests/2.31.0"}, timeout=30)
        if resp.status_code != 200:
            logger.warning(f"FRED {fred_id} status={resp.status_code}")
            return {}
        out = {}
        for line in resp.text.strip().split("\n")[1:]:
            d, _, v = line.partition(",")
            v = v.strip()
            if v and v != ".":
                try:
                    out[d.strip()] = float(v)
                except ValueError:
                    continue
        return out
    except Exception as e:
        logger.warning(f"FRED {fred_id} failed: {type(e).__name__}")
        return {}


import json


class OverviewCache:
    def __init__(self, name: str, ttl: float, build: Callable[[], Awaitable[dict | None]]):
        self.name, self.ttl, self._build = name, ttl, build
        self.data: dict | None = None
        self.ts = 0.0
        self.failed_at = 0.0
        self._task: asyncio.Task | None = None

    async def _load_from_db(self) -> dict | None:
        """서버 기동 직후나 메모리 누락 시 DB에서 이전 스냅샷을 5ms 내 초고속 로드"""
        if self.name not in {"rates", "stocks", "fx", "macro"}:
            return None
        try:
            from db.database import AsyncSessionLocal
            from db.models import ExitSignalCache
            from sqlalchemy import select
            async with AsyncSessionLocal() as db:
                db_key = f"OVERVIEW_{self.name}"
                stmt = select(ExitSignalCache).where(ExitSignalCache.target_ym == db_key)
                row = (await db.execute(stmt)).scalar()
                if row and row.data_json:
                    data = json.loads(row.data_json)
                    logger.info(f"[{self.name}] DB snapshot hit: loaded cached overview successfully.")
                    return data
        except Exception as e:
            logger.warning(f"[{self.name}] Failed to load overview snapshot from DB: {e}")
        return None

    async def _save_to_db(self, data: dict):
        """수집된 대시보드 데이터를 DB에 영구 저장하여 반복 크롤링 방지"""
        if self.name not in {"rates", "stocks", "fx", "macro"}:
            return
        try:
            from db.database import AsyncSessionLocal
            from db.models import ExitSignalCache
            from sqlalchemy import select
            async with AsyncSessionLocal() as db:
                db_key = f"OVERVIEW_{self.name}"
                stmt = select(ExitSignalCache).where(ExitSignalCache.target_ym == db_key)
                row = (await db.execute(stmt)).scalar()
                raw_json = json.dumps(data)
                if row:
                    row.data_json = raw_json
                else:
                    db.add(ExitSignalCache(target_ym=db_key, data_json=raw_json))
                await db.commit()
                logger.info(f"[{self.name}] Saved overview snapshot to DB successfully.")
        except Exception as e:
            logger.warning(f"[{self.name}] Failed to persist overview snapshot to DB: {e}")

    async def _run(self):
        try:
            data = await self._build()
            if data:
                self.data, self.ts = data, time.time()
                await self._save_to_db(data)
            else:
                self.failed_at = time.time()
        except Exception as e:
            self.failed_at = time.time()
            logger.warning(f"[{self.name}] 수집 실패: {type(e).__name__}: {e}")

    def _start(self) -> asyncio.Task:
        if self._task is None or self._task.done():
            self._task = asyncio.create_task(self._run())
        return self._task

    def warm(self):
        """서버 시작 직후 캐시를 미리 채운다(첫 방문자가 수집을 기다리지 않게)."""
        self._start()

    async def get(self, force: bool = False) -> dict | None:
        if force:
            await asyncio.shield(self._start())
            if self.data is None:
                return None
            return {**self.data, "stale": True} if self.failed_at > self.ts else self.data

        # 1. 메모리 캐시 확인 (신선한 경우 즉시 반환)
        if self.data is not None:
            if time.time() - self.ts >= self.ttl:
                self._start()  # 백그라운드 갱신
                return {**self.data, "refreshing": True}
            return self.data

        # 2. 메모리에 없으면 DB 스냅샷 우선 로드 (대기시간 5ms 내 초고속 서빙)
        db_data = await self._load_from_db()
        if db_data is not None:
            self.data = db_data
            self.ts = time.time()
            self._start()  # 백그라운드에서 최신 데이터 수집 트리거 (사용자 블로킹 없음)
            return {**self.data, "from_db": True, "refreshing": True}

        # 3. DB에도 없는 최초 1회만 수집 대기
        await asyncio.shield(self._start())
        if self.data is None:
            return None
        return {**self.data, "stale": True} if self.failed_at > self.ts else self.data
