"""
AegisOne API — Result Cache
LRU cache with TTL to avoid re-scanning the same content within a time frame.
"""
import asyncio
from typing import Callable, Awaitable
from cachetools import TTLCache
from api.config import URL_CACHE_MAXSIZE, URL_CACHE_TTL_SECONDS

_url_cache = TTLCache(maxsize=URL_CACHE_MAXSIZE, ttl=URL_CACHE_TTL_SECONDS)
_text_cache = TTLCache(maxsize=URL_CACHE_MAXSIZE, ttl=URL_CACHE_TTL_SECONDS)

def get_cached_url_result(url: str) -> dict | None:
    return _url_cache.get(url)

def set_cached_url_result(url: str, result: dict):
    _url_cache[url] = result

async def get_or_create_url_result(url: str, loader: Callable[[], Awaitable[dict]]) -> dict:
    cached = get_cached_url_result(url)
    if cached:
        return cached
    result = await loader()
    set_cached_url_result(url, result)
    return result

def get_cached_text_result(text: str) -> list | dict | None:
    # Hash the text since text can be large
    key = hash(text)
    return _text_cache.get(key)

def set_cached_text_result(text: str, result: list | dict):
    key = hash(text)
    _text_cache[key] = result

async def get_or_create_text_result(text: str, loader: Callable[[], Awaitable[list | dict]]) -> list | dict:
    cached = get_cached_text_result(text)
    if cached:
        return cached
    result = await loader()
    set_cached_text_result(text, result)
    return result

def cache_stats() -> dict:
    return {
        "url_cache_size": len(_url_cache),
        "text_cache_size": len(_text_cache),
        "maxsize": _url_cache.maxsize,
        "ttl": _url_cache.ttl,
    }
