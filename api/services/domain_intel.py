"""
AegisOne — Domain intelligence (real registration age via RDAP)
================================================================
Looks up when a domain was actually registered using RDAP (the structured successor to WHOIS).
Registry servers are discovered from the IANA bootstrap file, so no API key or paid service is
needed. Results are cached (a registration date never changes) and every failure degrades to
"unknown" instead of a made-up value.
"""
import asyncio
import logging
import time
from datetime import datetime, timezone
from typing import Optional, Dict, Any
from urllib.parse import urlparse

import httpx

logger = logging.getLogger("aegisone.domain_intel")

_BOOTSTRAP_URL = "https://data.iana.org/rdap/dns.json"
_TIMEOUT_S = 4.0
_OK_TTL_S = 7 * 24 * 3600      # a registration date does not change
_FAIL_TTL_S = 30 * 60          # retry failures after 30 minutes
_MAX_CACHE = 5000

_cache: Dict[str, tuple] = {}  # domain -> (expires_at, result)
_tld_servers: Dict[str, str] = {}
_bootstrap_loaded_at = 0.0
_bootstrap_lock = asyncio.Lock()

try:
    import tldextract
    _extract = tldextract.TLDExtract(suffix_list_urls=(), cache_dir=None)  # bundled snapshot, no network
except Exception:  # pragma: no cover
    _extract = None


def registrable_domain(host_or_url: str) -> Optional[str]:
    """example.co.uk for https://login.example.co.uk/x . None for IPs / unparsable input."""
    if not host_or_url:
        return None
    host = host_or_url
    if "://" in host:
        host = urlparse(host).hostname or ""
    host = host.strip().strip(".").lower()
    if not host or host.replace(".", "").isdigit() or ":" in host:
        return None
    if _extract is not None:
        parts = _extract(host)
        if parts.domain and parts.suffix:
            return f"{parts.domain}.{parts.suffix}"
        return None
    bits = host.split(".")
    return ".".join(bits[-2:]) if len(bits) >= 2 else None


async def _load_bootstrap(client: httpx.AsyncClient) -> None:
    global _bootstrap_loaded_at
    async with _bootstrap_lock:
        if _tld_servers and time.time() - _bootstrap_loaded_at < 24 * 3600:
            return
        resp = await client.get(_BOOTSTRAP_URL)
        resp.raise_for_status()
        for tlds, servers in resp.json().get("services", []):
            if servers:
                for tld in tlds:
                    _tld_servers[tld.lower()] = servers[0].rstrip("/")
        _bootstrap_loaded_at = time.time()


def _parse_registration(data: Dict[str, Any]) -> Optional[datetime]:
    for ev in data.get("events", []) or []:
        if str(ev.get("eventAction", "")).lower() == "registration" and ev.get("eventDate"):
            raw = str(ev["eventDate"]).replace("Z", "+00:00")
            try:
                dt = datetime.fromisoformat(raw)
            except ValueError:
                continue
            return dt if dt.tzinfo else dt.replace(tzinfo=timezone.utc)
    return None


def humanize_age(days: Optional[int]) -> str:
    if days is None:
        return "Unknown"
    if days < 1:
        return "Today"
    if days < 60:
        return f"{days} day{'s' if days != 1 else ''}"
    if days < 730:
        return f"{days // 30} months"
    return f"{days / 365.25:.1f} years"


async def lookup_domain_age(host_or_url: str, *, use_cache: bool = True) -> Dict[str, Any]:
    """
    Returns {domain, registered_on (ISO date|None), age_days (int|None), age_label, source, status}.
    status: "ok" | "unknown" (lookup failed / TLD has no RDAP) | "invalid" (IP or no domain).
    Never raises.
    """
    domain = registrable_domain(host_or_url)
    if not domain:
        return {"domain": None, "registered_on": None, "age_days": None, "age_label": "Unknown",
                "source": None, "status": "invalid"}

    now = time.time()
    hit = _cache.get(domain)
    if use_cache and hit and hit[0] > now:
        return hit[1]

    result: Dict[str, Any] = {"domain": domain, "registered_on": None, "age_days": None,
                              "age_label": "Unknown", "source": "rdap", "status": "unknown"}
    ttl = _FAIL_TTL_S
    try:
        async with httpx.AsyncClient(timeout=_TIMEOUT_S, follow_redirects=True,
                                     headers={"Accept": "application/rdap+json"}) as client:
            tld = domain.rsplit(".", 1)[-1]
            if tld not in _tld_servers:
                await _load_bootstrap(client)
            server = _tld_servers.get(tld)
            if server:
                resp = await client.get(f"{server}/domain/{domain}")
                if resp.status_code == 200:
                    reg = _parse_registration(resp.json())
                    if reg:
                        days = max(0, (datetime.now(timezone.utc) - reg).days)
                        result.update(registered_on=reg.date().isoformat(), age_days=days,
                                      age_label=humanize_age(days), status="ok")
                        ttl = _OK_TTL_S
                elif resp.status_code == 404:
                    result["status"] = "unknown"
    except Exception as exc:  # network down, timeout, bad JSON ...
        logger.debug("RDAP lookup failed for %s: %s", domain, exc)

    if len(_cache) >= _MAX_CACHE:
        for k in sorted(_cache, key=lambda k: _cache[k][0])[: _MAX_CACHE // 10]:
            _cache.pop(k, None)
    _cache[domain] = (now + ttl, result)
    return result


def cached_domain_age(host_or_url: str) -> Optional[Dict[str, Any]]:
    """Non-blocking peek (used by the explainer on the hot path); None when not looked up yet."""
    domain = registrable_domain(host_or_url)
    hit = _cache.get(domain) if domain else None
    return hit[1] if hit and hit[0] > time.time() else None


async def lookup_many(hosts: list, budget_s: float = 8.0) -> Dict[str, Dict[str, Any]]:
    """Look up several domains concurrently within an overall time budget."""
    unique = list({registrable_domain(h) for h in hosts if registrable_domain(h)})
    out: Dict[str, Dict[str, Any]] = {}
    if not unique:
        return out
    sem = asyncio.Semaphore(8)

    async def one(d: str):
        async with sem:
            out[d] = await lookup_domain_age(d)

    tasks = [asyncio.create_task(one(d)) for d in unique]
    _done, pending = await asyncio.wait(tasks, timeout=budget_s)
    for t in pending:
        t.cancel()
    return out
