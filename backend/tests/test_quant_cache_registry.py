"""Unit tests for QuantCacheRegistry (Sprint 10: S10-3)"""

import time
import pytest
from core.quant_cache_registry import QuantCacheRegistry, quant_cache, force_malloc_trim


def test_registry_singleton():
    """Verify QuantCacheRegistry acts as a singleton"""
    r1 = QuantCacheRegistry()
    r2 = QuantCacheRegistry()
    assert r1 is r2
    assert quant_cache is r1


def test_make_key_canonical():
    """Verify make_key produces identical SHA-256 for identical content regardless of key ordering"""
    p1 = {"b": 2, "a": 1}
    p2 = {"a": 1, "b": 2}

    k1 = QuantCacheRegistry.make_key("test", p1)
    k2 = QuantCacheRegistry.make_key("test", p2)
    assert k1 == k2
    assert len(k1) == 64  # SHA-256 hex length


def test_set_get_and_ttl_expiration():
    """Verify basic set/get and expiration behavior"""
    registry = QuantCacheRegistry()
    ns = "test_ttl"
    registry.clear(ns)

    # 1. Set with 1 second TTL
    registry.set(ns, "key1", {"value": 100}, ttl=1)
    val = registry.get(ns, "key1")
    assert val == {"value": 100}

    # 2. Wait 1.1s for expiration
    time.sleep(1.1)
    val_expired = registry.get(ns, "key1")
    assert val_expired is None


def test_lru_eviction():
    """Verify LRU evicts oldest unused keys when max capacity is reached"""
    registry = QuantCacheRegistry()
    ns = "test_lru"
    registry.clear(ns)

    # Temporarily set max entries to 3 for this test
    original_max = registry._max_entries_per_ns
    registry._max_entries_per_ns = 3
    try:
        registry.set(ns, "k1", 1)
        registry.set(ns, "k2", 2)
        registry.set(ns, "k3", 3)

        # Access k1 to make k2 the least recently used
        assert registry.get(ns, "k1") == 1

        # Adding k4 should evict k2 (not k1)
        registry.set(ns, "k4", 4)

        assert registry.get(ns, "k1") == 1  # Still present
        assert registry.get(ns, "k2") is None  # Evicted!
        assert registry.get(ns, "k3") == 3
        assert registry.get(ns, "k4") == 4
    finally:
        registry._max_entries_per_ns = original_max
        registry.clear(ns)


def test_purge_expired_and_clear():
    """Verify purge_expired and memory trim calls"""
    registry = QuantCacheRegistry()
    ns = "test_purge"
    registry.clear(ns)

    registry.set(ns, "k_short", "expire_soon", ttl=1)
    registry.set(ns, "k_long", "stay_long", ttl=100)

    time.sleep(1.1)
    purged = registry.purge_expired(ns)
    assert purged == 1
    assert registry.get(ns, "k_short") is None
    assert registry.get(ns, "k_long") == "stay_long"

    cleared = registry.clear(ns)
    assert cleared == 1
    assert registry.get(ns, "k_long") is None

    # Test force_malloc_trim without error
    force_malloc_trim()
