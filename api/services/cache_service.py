"""
AegisOne API — URL Result Cache
Thread-safe LRU cache with TTL and hit/miss monitoring.
"""
import threading
import logging
from cachetools import TTLCache
from api.config import URL_CACHE_MAXSIZE, URL_CACHE_TTL_SECONDS

logger = logging.getLogger("aegisone.cache")

_url_cache = TTLCache(maxsize=URL_CACHE_MAXSIZE, ttl=URL_CACHE_TTL_SECONDS)
_text_cache = TTLCache(maxsize=URL_CACHE_MAXSIZE, ttl=URL_CACHE_TTL_SECONDS)
_lock = threading.Lock()

# Monitoring counters
_hits = 0
_misses = 0

def get_cached_url_result(url: str) -> dict | None:
    global _hits, _misses
    with _lock:
        result = _url_cache.get(url)
        if result is not None:
            _hits += 1
            return result
        _misses += 1
        return None


def set_cached_url_result(url: str, result: dict):
    with _lock:
        _url_cache[url] = result

def get_cached_text_result(text: str) -> list | None:
    global _hits, _misses
    with _lock:
        result = _text_cache.get(text)
        if result is not None:
            _hits += 1
            return result
        _misses += 1
        return None

def set_cached_text_result(text: str, result: list):
    with _lock:
        _text_cache[text] = result

def cache_stats() -> dict:
    with _lock:
        total = _hits + _misses
        return {
            "size": len(_url_cache),
            "maxsize": _url_cache.maxsize,
            "ttl": _url_cache.ttl,
            "hits": _hits,
            "misses": _misses,
            "hit_rate": round(_hits / total, 4) if total > 0 else 0.0,
        }
