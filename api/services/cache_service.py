"""
AegisOne API — Result Cache
TTL caches plus in-flight request coalescing to avoid duplicate work when many
simultaneous requests hit the same URL or text payload.
"""
import asyncio
import copy
from cachetools import TTLCache
from api.config import URL_CACHE_MAXSIZE, URL_CACHE_TTL_SECONDS


_url_cache = TTLCache(maxsize=URL_CACHE_MAXSIZE, ttl=URL_CACHE_TTL_SECONDS)
_text_cache = TTLCache(maxsize=URL_CACHE_MAXSIZE, ttl=URL_CACHE_TTL_SECONDS)
_url_inflight: dict[str, asyncio.Future] = {}
_text_inflight: dict[str, asyncio.Future] = {}
_inflight_lock = asyncio.Lock()


def normalize_cache_key(value: str) -> str:
    """Normalize cache keys so semantically identical inputs collapse together."""
    return " ".join(value.strip().split())


def normalize_url_key(url: str) -> str:
    """Normalize URLs before caching while preserving path/query semantics."""
    from urllib.parse import urlsplit, urlunsplit

    cleaned = url.strip()
    if not cleaned:
        return cleaned

    try:
        parts = urlsplit(cleaned)
        scheme = parts.scheme.lower()
        netloc = parts.netloc.lower()
        path = parts.path or "/"
        return urlunsplit((scheme, netloc, path, parts.query, ""))
    except Exception:
        return normalize_cache_key(cleaned)


async def _get_or_compute(
    cache: TTLCache,
    inflight: dict[str, asyncio.Future],
    key: str,
    loader,
):
    cached = cache.get(key)
    if cached is not None:
        return copy.deepcopy(cached)

    async with _inflight_lock:
        cached = cache.get(key)
        if cached is not None:
            return copy.deepcopy(cached)

        future = inflight.get(key)
        if future is None:
            loop = asyncio.get_running_loop()
            future = loop.create_future()
            inflight[key] = future
            leader = True
        else:
            leader = False

    if not leader:
        return copy.deepcopy(await future)

    try:
        result = await loader()
        cache[key] = copy.deepcopy(result)
        future.set_result(result)
        return copy.deepcopy(result)
    except Exception as exc:
        if not future.done():
            future.set_exception(exc)
        raise
    finally:
        async with _inflight_lock:
            inflight.pop(key, None)


async def get_or_create_url_result(url: str, loader):
    """Return a cached URL result or compute it once for all waiters."""
    return await _get_or_compute(_url_cache, _url_inflight, normalize_url_key(url), loader)


async def get_or_create_text_result(text: str, loader):
    """Return a cached text result or compute it once for all waiters."""
    return await _get_or_compute(_text_cache, _text_inflight, normalize_cache_key(text), loader)


def get_cached_url_result(url: str) -> dict | None:
    return _url_cache.get(normalize_url_key(url))


def set_cached_url_result(url: str, result: dict):
    _url_cache[normalize_url_key(url)] = copy.deepcopy(result)


def get_cached_text_result(text: str) -> list | None:
    return _text_cache.get(normalize_cache_key(text))


def set_cached_text_result(text: str, result: list):
    _text_cache[normalize_cache_key(text)] = copy.deepcopy(result)


def cache_stats() -> dict:
    return {
        "url_size": len(_url_cache),
        "text_size": len(_text_cache),
        "maxsize": _url_cache.maxsize,
        "ttl": _url_cache.ttl,
    }
