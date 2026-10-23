"""
AegisOne — enterprise integrations: API keys, signed webhooks, SIEM events
==========================================================================
* API keys  `aegis_<random>`; only a SHA-256 hash is stored, the key is shown once. Scoped
            (incidents:read, events:read, intel:read, scan) and optionally expiring.
* Webhooks  every event is a JSON POST signed with HMAC-SHA256 over "<timestamp>.<body>" in the
            `X-Aegis-Signature: t=<ts>,v1=<hex>` header (reject if the timestamp is old, to stop replay).
            Targets must be public https/http hosts (no internal addresses: SSRF-guarded at creation
            AND at delivery). Failed deliveries are retried; a webhook failing 20 times in a row is
            disabled and the admin is told in the dashboard.
"""
import asyncio
import hashlib
import hmac
import json
import logging
import secrets
import time
import uuid
from datetime import datetime
from typing import Any, Dict, List, Optional, Tuple

from sqlalchemy import select

from api.database.db import get_background_db
from api.database.models import ApiKey, Webhook, WebhookDelivery

logger = logging.getLogger("aegisone.integrations")

SCOPES = {"incidents:read", "events:read", "intel:read", "scan"}
EVENT_TYPES = ["critical_scan", "new_incident", "incident_escalated", "incident_verified", "simulation_click", "test"]
MAX_FAILURES = 20
RETRY_DELAYS = (0, 2, 8)
SIGNATURE_TOLERANCE_SECONDS = 300


# ── API keys ────────────────────────────────────────────────────────────────────────

def hash_key(key: str) -> str:
    return hashlib.sha256(key.encode()).hexdigest()


def new_api_key() -> Tuple[str, str, str]:
    """(plaintext, prefix, hash)"""
    plain = "aegis_" + secrets.token_urlsafe(32)
    return plain, plain[:12], hash_key(plain)


async def lookup_key(db, presented: str) -> Optional[ApiKey]:
    if not presented or not presented.startswith("aegis_"):
        return None
    row = (await db.execute(select(ApiKey).where(ApiKey.key_hash == hash_key(presented)))).scalar_one_or_none()
    if not row or row.revoked_at is not None:
        return None
    if row.expires_at is not None and row.expires_at < datetime.utcnow():
        return None
    return row


# ── webhooks ────────────────────────────────────────────────────────────────────────

def sign(secret: str, timestamp: int, body: bytes) -> str:
    mac = hmac.new(secret.encode(), f"{timestamp}.".encode() + body, hashlib.sha256).hexdigest()
    return f"t={timestamp},v1={mac}"


def verify_signature(secret: str, header: str, body: bytes, now: Optional[float] = None) -> bool:
    """For documentation/tests: how a receiver verifies a delivery."""
    try:
        parts = dict(p.split("=", 1) for p in header.split(","))
        ts = int(parts["t"])
    except Exception:
        return False
    if abs((now or time.time()) - ts) > SIGNATURE_TOLERANCE_SECONDS:
        return False
    return hmac.compare_digest(sign(secret, ts, body).split("v1=")[1], parts.get("v1", ""))


async def assert_public_target(url: str) -> None:
    """Webhook URLs must resolve to public addresses (same guard as the redirect tracer)."""
    from api.services.redirect_tracer import _assert_safe, UnsafeTarget
    try:
        await _assert_safe(url)
    except UnsafeTarget as e:
        raise ValueError(f"Webhook URL not allowed: {e}")


async def _post_once(url: str, secret: str, event: str, body: bytes) -> Tuple[bool, Optional[int], Optional[str]]:
    import httpx
    ts = int(time.time())
    headers = {"Content-Type": "application/json", "User-Agent": "AegisOne-Webhook/1", "X-Aegis-Event": event,
               "X-Aegis-Signature": sign(secret, ts, body)}
    try:
        await assert_public_target(url)          # re-checked on every delivery (DNS can change)
        async with httpx.AsyncClient(timeout=8, follow_redirects=False) as client:
            r = await client.post(url, content=body, headers=headers)
        return (200 <= r.status_code < 300), r.status_code, None if r.status_code < 300 else f"HTTP {r.status_code}"
    except Exception as e:
        return False, None, f"{type(e).__name__}: {e}"[:300]


async def _deliver(webhook_id: str, org_id: str, event: str, body: bytes, retry: bool = True) -> Dict[str, Any]:
    db = await get_background_db()
    try:
        wh = (await db.execute(select(Webhook).where(Webhook.webhook_id == webhook_id))).scalar_one_or_none()
        if not wh or not wh.enabled:
            return {"ok": False, "error": "disabled"}
        ok, code, err, attempts = False, None, None, 0
        for delay in (RETRY_DELAYS if retry else (0,)):
            if delay:
                await asyncio.sleep(delay)
            attempts += 1
            ok, code, err = await _post_once(wh.url, wh.secret, event, body)
            if ok:
                break
        db.add(WebhookDelivery(webhook_id=webhook_id, organization_id=org_id, event=event, ok=ok, status_code=code,
                               attempts=attempts, error=err))
        wh.last_delivery_at = datetime.utcnow()
        wh.last_status = "ok" if ok else (err or "failed")[:80]
        wh.consecutive_failures = 0 if ok else (wh.consecutive_failures or 0) + 1
        if wh.consecutive_failures >= MAX_FAILURES:
            wh.enabled = False
            logger.warning("Webhook %s disabled after %d consecutive failures", webhook_id, MAX_FAILURES)
        await db.commit()
        return {"ok": ok, "status_code": code, "error": err, "attempts": attempts}
    finally:
        await db.close()


async def dispatch_event(org_id: str, event: str, data: Dict[str, Any]) -> int:
    """Fan an event out to the organization's subscribed webhooks (fire and forget). Returns how many were queued."""
    db = await get_background_db()
    try:
        hooks = (await db.execute(select(Webhook).where(Webhook.organization_id == org_id, Webhook.enabled == True))).scalars().all()  # noqa: E712
        targets = [h.webhook_id for h in hooks if "*" in (h.events or []) or event in (h.events or [])]
    finally:
        await db.close()
    if not targets:
        return 0
    body = json.dumps({"id": f"evt_{uuid.uuid4().hex[:16]}", "event": event, "created": datetime.utcnow().isoformat() + "Z",
                       "organization_id": org_id, "data": data}, default=str).encode()
    for wid in targets:
        asyncio.create_task(_deliver(wid, org_id, event, body))
    return len(targets)


async def send_test(webhook_id: str, org_id: str) -> Dict[str, Any]:
    body = json.dumps({"id": f"evt_{uuid.uuid4().hex[:16]}", "event": "test", "created": datetime.utcnow().isoformat() + "Z",
                       "organization_id": org_id, "data": {"message": "AegisOne webhook test"}}).encode()
    return await _deliver(webhook_id, org_id, "test", body, retry=False)


# ── SIEM formats ────────────────────────────────────────────────────────────────────

def _cef_escape(v: Any) -> str:
    return str(v if v is not None else "").replace("\\", "\\\\").replace("|", "\\|").replace("=", "\\=").replace("\n", " ").replace("\r", " ")


def to_cef(scan: Any) -> str:
    """ArcSight Common Event Format line for a website scan (usable by Splunk/QRadar/Sentinel connectors)."""
    sev = 10 if (scan.risk_score or 0) >= 85 else 7 if (scan.risk_score or 0) >= 60 else 4 if (scan.risk_score or 0) >= 30 else 1
    ext = f"dhost={_cef_escape(scan.domain)} request={_cef_escape(scan.url)} act={_cef_escape(scan.decision)} " \
          f"cs1Label=threatType cs1={_cef_escape(scan.threat_type)} cn1Label=riskScore cn1={scan.risk_score or 0} " \
          f"rt={int(scan.created_at.timestamp() * 1000) if scan.created_at else 0} suid={_cef_escape(scan.user_id)}"
    return f"CEF:0|AegisOne|Shield|1.0|scan.{_cef_escape(scan.decision)}|{_cef_escape(scan.threat_type or 'web threat')}|{sev}|{ext}"
