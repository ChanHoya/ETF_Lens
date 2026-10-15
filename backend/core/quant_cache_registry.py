"""전역 퀀트 인메모리 캐시 레지스트리 (QuantCacheRegistry)

Sprint 10: S10-3
- 백엔드 라우터(backtest, efficient_frontier, rebalance, macro 등)에 분산된 인메모리 캐시를 단일 레지스트리로 통합
- 네임스페이스 기반 격리 + Canonical SHA-256 키 생성 헬퍼
- LRU 순서 유지 (OrderedDict) 및 TTL 기반 자동 만료
- Render 512MB RAM 제약(FP-038) 대응: gc.collect() 및 libc malloc_trim(0) 연동 메모리 자동 회수
"""

import ctypes
import gc
import hashlib
import json
import logging
import time
from collections import OrderedDict
from datetime import datetime, timedelta, timezone as _tz
from typing import Any, Dict, List, Optional, Tuple, Union

logger = logging.getLogger(__name__)

# 한국 표준시 (KST = UTC+9)
_KST = _tz(timedelta(hours=9))


def _kst_today() -> str:
    return datetime.now(_KST).strftime("%Y-%m-%d")


def force_malloc_trim():
    """glibc 메모리 단편화 해소를 위한 malloc_trim(0) 강제 회수 (Linux 환경)"""
    gc.collect()
    try:
        ctypes.CDLL("libc.so.6").malloc_trim(0)
    except Exception:
        pass


class QuantCacheRegistry:
    """네임스페이스, TTL 및 LRU 용량 제한을 지원하는 전역 퀀트 캐시 레지스트리 (싱글톤)"""

    _instance = None

    def __new__(cls, *args, **kwargs):
        if cls._instance is None:
            cls._instance = super(QuantCacheRegistry, cls).__new__(cls)
            cls._instance._stores: Dict[str, OrderedDict] = {}
            cls._instance._default_ttl = 3600  # 1 hour
            cls._instance._max_entries_per_ns = 300
        return cls._instance

    @staticmethod
    def make_key(namespace: str, payload: Any, include_today: bool = True) -> str:
        """페이로드를 정규화(canonical JSON)하여 SHA-256 캐시 키 생성"""
        today_prefix = f"{_kst_today()}:" if include_today else ""
        if isinstance(payload, str):
            raw_str = f"{namespace}:{today_prefix}{payload}"
        else:
            try:
                serialized = json.dumps(payload, sort_keys=True, default=str)
                raw_str = f"{namespace}:{today_prefix}{serialized}"
            except Exception:
                raw_str = f"{namespace}:{today_prefix}{str(payload)}"
        return hashlib.sha256(raw_str.encode("utf-8")).hexdigest()

    @classmethod
    def generate_key(cls, payload: Any, namespace: str = "default", include_today: bool = True) -> str:
        """make_key의 클래스/인스턴스 호출 alias"""
        return cls.make_key(namespace, payload, include_today=include_today)

    def _get_store(self, namespace: str) -> OrderedDict:
        if namespace not in self._stores:
            self._stores[namespace] = OrderedDict()
        return self._stores[namespace]

    def get(self, namespace: str, key: str) -> Optional[Any]:
        """캐시에서 데이터 조회 (만료되었거나 없으면 None 반환 및 LRU 갱신)"""
        store = self._get_store(namespace)
        if key not in store:
            return None

        entry = store[key]
        expire_at = entry.get("expire_at", 0)

        # 만료 검사
        if time.time() > expire_at:
            store.pop(key, None)
            return None

        # LRU: 최근 사용된 항목으로 맨 뒤로 이동
        store.move_to_end(key)
        return entry.get("data")

    def set(
        self,
        namespace: str,
        key: str,
        data: Any,
        ttl: Optional[int] = None,
    ) -> None:
        """캐시에 데이터 저장 (TTL 및 LRU 초과 시 가장 오래된 항목 제거)"""
        store = self._get_store(namespace)
        ttl_seconds = ttl if ttl is not None else self._default_ttl
        expire_at = time.time() + ttl_seconds

        # 기존 키가 있으면 갱신
        if key in store:
            store.pop(key, None)

        # 최대 엔트리 초과 시 가장 오래된 항목(FIFO/LRU) 방출
        while len(store) >= self._max_entries_per_ns:
            oldest_key, _ = store.popitem(last=False)
            logger.debug(f"[QuantCacheRegistry] Evicted LRU key '{oldest_key[:8]}' from ns '{namespace}'")

        store[key] = {
            "data": data,
            "expire_at": expire_at,
            "created_at": time.time(),
        }

    def clear(self, namespace: Optional[str] = None, trim_memory: bool = True) -> int:
        """특정 네임스페이스 또는 전체 캐시 정리 및 메모리 회수"""
        cleared_count = 0
        if namespace:
            store = self._stores.get(namespace)
            if store:
                cleared_count = len(store)
                store.clear()
        else:
            for store in self._stores.values():
                cleared_count += len(store)
                store.clear()
            self._stores.clear()

        if trim_memory:
            force_malloc_trim()

        return cleared_count

    def purge_expired(self, namespace: Optional[str] = None) -> int:
        """만료된 캐시 항목 정리"""
        now = time.time()
        purged = 0
        targets = [self._stores.get(namespace)] if namespace else list(self._stores.values())

        for store in targets:
            if not store:
                continue
            expired_keys = [k for k, v in store.items() if now > v.get("expire_at", 0)]
            for k in expired_keys:
                store.pop(k, None)
                purged += 1

        if purged > 0:
            force_malloc_trim()

        return purged

    def get_stats(self) -> Dict[str, Any]:
        """캐시 현황 통계 반환"""
        stats = {}
        total_items = 0
        for ns, store in self._stores.items():
            count = len(store)
            total_items += count
            stats[ns] = {"items": count}
        stats["total_items"] = total_items
        return stats


# 전역 싱글톤 인스턴스
quant_cache = QuantCacheRegistry()
