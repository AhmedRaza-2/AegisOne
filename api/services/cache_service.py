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

# Monitoring counters (per-cache)
_url_hits = 0
_url_misses = 0
_text_hits = 0
_text_misses = 0

def get_cached_url_result(url: str) -> dict | None:
    global _url_hits, _url_misses
    with _lock:
        result = _url_cache.get(url)
        if result is not None:
            _url_hits += 1
            return result
        _url_misses += 1
        return None


def set_cached_url_result(url: str, result: dict):
    with _lock:
        _url_cache[url] = result

def get_cached_text_result(text: str) -> list | None:
    global _text_hits, _text_misses
    with _lock:
        result = _text_cache.get(text)
        if result is not None:
            _text_hits += 1
            return result
        _text_misses += 1
        return None

def set_cached_text_result(text: str, result: list):
    with _lock:
        _text_cache[text] = result

def cache_stats() -> dict:
    with _lock:
        url_total = _url_hits + _url_misses
        text_total = _text_hits + _text_misses
        total = url_total + text_total
        return {
            "url_cache": {
                "size": len(_url_cache),
                "maxsize": _url_cache.maxsize,
                "ttl": _url_cache.ttl,
                "hits": _url_hits,
                "misses": _url_misses,
                "hit_rate": round(_url_hits / url_total, 4) if url_total > 0 else 0.0,
            },
            "text_cache": {
                "size": len(_text_cache),
                "maxsize": _text_cache.maxsize,
                "ttl": _text_cache.ttl,
                "hits": _text_hits,
                "misses": _text_misses,
                "hit_rate": round(_text_hits / text_total, 4) if text_total > 0 else 0.0,
            },
            "total_hits": _url_hits + _text_hits,
            "total_misses": _url_misses + _text_misses,
            "overall_hit_rate": round((_url_hits + _text_hits) / total, 4) if total > 0 else 0.0,
        }

