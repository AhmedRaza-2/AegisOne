"""
AegisOne — Server-side redirect-chain tracer
============================================
Follows a link hop by hop WITHOUT downloading page bodies, so an incident report can show where a
shortened or tracked link really ends up. Because the server is fetching an attacker-controlled
address, every hop is checked first (SSRF guard):

  * only http/https, only ports 80/443/8080/8443
  * the hostname must resolve ONLY to public addresses - loopback, private, link-local (cloud
    metadata 169.254.169.254), multicast and reserved ranges are refused, for every hop
  * at most MAX_HOPS hops and a total time budget
  * HEAD first (no body); GET with the body discarded only when HEAD is refused
  * no cookies, no credentials sent, fixed User-Agent

It is only run when an admin asks for it (POST /admin/incidents/{id}/trace-redirects).
"""
import asyncio
import ipaddress
import logging
import socket
import time
from typing import Any, Dict, List
from urllib.parse import urljoin, urlparse

import httpx

logger = logging.getLogger("aegisone.redirect_tracer")

MAX_HOPS = 8
TOTAL_BUDGET_S = 12.0
HOP_TIMEOUT_S = 4.0
ALLOWED_PORTS = {80, 443, 8080, 8443}
SHORTENERS = {"bit.ly", "t.co", "tinyurl.com", "goo.gl", "ow.ly", "is.gd", "buff.ly", "rebrand.ly", "cutt.ly", "shorturl.at", "tiny.cc", "rb.gy", "lnkd.in"}
_HEADERS = {"User-Agent": "AegisOne-LinkTracer/1.0 (+security analysis)", "Accept": "*/*"}


class UnsafeTarget(Exception):
    pass


def _public_ip(ip: str) -> bool:
    try:
        a = ipaddress.ip_address(ip)
    except ValueError:
        return False
    return not (a.is_private or a.is_loopback or a.is_link_local or a.is_multicast
                or a.is_reserved or a.is_unspecified)


async def _assert_safe(url: str) -> None:
    p = urlparse(url)
    if p.scheme not in ("http", "https"):
        raise UnsafeTarget("only http/https links are followed")
    host = p.hostname
    if not host:
        raise UnsafeTarget("link has no host")
    port = p.port or (443 if p.scheme == "https" else 80)
    if port not in ALLOWED_PORTS:
        raise UnsafeTarget(f"port {port} is not allowed")
    try:
        infos = await asyncio.get_running_loop().getaddrinfo(host, port, type=socket.SOCK_STREAM)
    except socket.gaierror:
        raise UnsafeTarget("host does not resolve")
    addrs = {i[4][0] for i in infos}
    if not addrs or not all(_public_ip(a) for a in addrs):
        raise UnsafeTarget("host resolves to a private or reserved address")


async def trace_redirects(url: str) -> Dict[str, Any]:
    """Return {chain: [{url, status, location, note}], final_url, hops, flags: [...], error?}. Never raises."""
    chain: List[Dict[str, Any]] = []
    flags: List[str] = []
    deadline = time.monotonic() + TOTAL_BUDGET_S
    current = (url or "").strip()
    error = None
    try:
        async with httpx.AsyncClient(follow_redirects=False, timeout=HOP_TIMEOUT_S, headers=_HEADERS, verify=True) as client:
            for _ in range(MAX_HOPS + 1):
                if time.monotonic() > deadline:
                    error = "time budget exceeded"
                    break
                try:
                    await _assert_safe(current)
                except UnsafeTarget as e:
                    chain.append({"url": current, "status": None, "location": None, "note": f"not followed: {e}"})
                    break
                try:
                    resp = await client.head(current)
                    if resp.status_code in (405, 403, 400, 501):
                        async with client.stream("GET", current) as r2:   # body is never read
                            resp = r2
                            status, loc = r2.status_code, r2.headers.get("location")
                    else:
                        status, loc = resp.status_code, resp.headers.get("location")
                except httpx.HTTPError as e:
                    chain.append({"url": current, "status": None, "location": None, "note": f"unreachable ({type(e).__name__})"})
                    break
                nxt = urljoin(current, loc) if loc and 300 <= status < 400 else None
                chain.append({"url": current, "status": status, "location": nxt, "note": ""})
                if not nxt:
                    break
                current = nxt
            else:
                error = f"stopped after {MAX_HOPS} hops"
    except Exception as e:  # pragma: no cover - defensive
        logger.warning("redirect trace failed: %s", e)
        error = "trace failed"

    hosts = [urlparse(h["url"]).hostname or "" for h in chain]
    if any(h in SHORTENERS for h in hosts[:-1] or hosts):
        flags.append("passes through a link shortener")
    if len(set(hosts)) >= 3:
        flags.append(f"hops across {len(set(hosts))} different sites")
    if any(urlparse(h["url"]).scheme == "http" for h in chain[1:]):
        flags.append("a later hop uses unencrypted HTTP")
    if len(chain) >= 2 and hosts[0] != hosts[-1]:
        flags.append("final site differs from the original link")
    if len(chain) > 4:
        flags.append("unusually long redirect chain")
    return {
        "start_url": url,
        "chain": chain,
        "final_url": chain[-1]["url"] if chain else url,
        "hops": max(0, len(chain) - 1),
        "flags": flags,
        "error": error,
        "traced_at": time.strftime("%Y-%m-%dT%H:%M:%SZ", time.gmtime()),
    }
