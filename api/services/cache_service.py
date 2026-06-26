"""
AegisOne API — URL Result Cache
LRU cache with TTL to avoid re-scanning the same URL within 5 minutes.
"""
from cachetools import TTLCache
from api.config import URL_CACHE_MAXSIZE, URL_CACHE_TTL_SECONDS


_url_cache = TTLCache(maxsize=URL_CACHE_MAXSIZE, ttl=URL_CACHE_TTL_SECONDS)


def get_cached_url_result(url: str) -> dict | None:
    return _url_cache.get(url)


def set_cached_url_result(url: str, result: dict):
    _url_cache[url] = result


def cache_stats() -> dict:
    return {
        "size": len(_url_cache),
        "maxsize": _url_cache.maxsize,
        "ttl": _url_cache.ttl,
    }
