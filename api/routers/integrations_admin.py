"""
AegisOne API — enterprise integrations
=======================================
Admin management (JWT, admin role):          /admin/integrations/*
Customer-facing machine API (X-API-Key):     /api/v1/*

  GET  /api/v1/incidents       incidents:read   incident list with status and verdict
  GET  /api/v1/events          events:read      blocked/warned scans, cursor-paged; ?format=cef for SIEMs
  GET  /api/v1/threat-feed     intel:read       the organization's block / allow lists
  POST /api/v1/scan/url        scan             scan one URL with the production pipeline
"""
import time
import logging
from collections import defaultdict, deque
from datetime import datetime, timedelta
from typing import List, Optional

from fastapi import APIRouter, Depends, Header, HTTPException, Query, Response
from pydantic import BaseModel, Field
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.future import select
from sqlalchemy import func

from api.database.db import get_db
from api.database.models import User, ApiKey, Webhook, WebhookDelivery, Incident, WebsiteScan, Policy, AuditLog
from api.auth.roles import Role, require_role
from api.services import integrations as integ

logger = logging.getLogger("aegisone.integrations")

admin_router = APIRouter(prefix="/admin/integrations", tags=["Integrations"])
api_router = APIRouter(prefix="/api/v1", tags=["Enterprise API"])


def _org(u: User) -> str:
    return u.organization_id or "org_default"


# ═════════════════════════════════════════════════════════════════════════════════════
# Admin: API keys
# ═════════════════════════════════════════════════════════════════════════════════════

class KeyCreate(BaseModel):
    name: str = Field(..., min_length=2, max_length=120)
    scopes: List[str] = ["incidents:read", "events:read"]
    expires_in_days: Optional[int] = Field(None, ge=1, le=3650)


@admin_router.get("/meta")
async def meta(_: User = Depends(require_role(Role.ADMIN))):
    return {"scopes": sorted(integ.SCOPES), "events": integ.EVENT_TYPES}


@admin_router.get("/keys")
async def list_keys(user: User = Depends(require_role(Role.ADMIN)), db: AsyncSession = Depends(get_db)):
    rows = (await db.execute(select(ApiKey).where(ApiKey.organization_id == _org(user)).order_by(ApiKey.created_at.desc()))).scalars().all()
    return [{"key_id": k.key_id, "name": k.name, "prefix": k.prefix + "…", "scopes": k.scopes, "created_at": k.created_at,
             "expires_at": k.expires_at, "last_used_at": k.last_used_at, "revoked": k.revoked_at is not None} for k in rows]


@admin_router.post("/keys", status_code=201)
async def create_key(body: KeyCreate, user: User = Depends(require_role(Role.ADMIN)), db: AsyncSession = Depends(get_db)):
    bad = set(body.scopes) - integ.SCOPES
    if bad or not body.scopes:
        raise HTTPException(status_code=400, detail=f"Unknown or empty scopes: {sorted(bad)}")
    plain, prefix, hashed = integ.new_api_key()
    import uuid
    row = ApiKey(key_id=f"key_{uuid.uuid4().hex[:12]}", organization_id=_org(user), name=body.name.strip(), key_hash=hashed, prefix=prefix,
                 scopes=sorted(set(body.scopes)), created_by=user.email,
                 expires_at=(datetime.utcnow() + timedelta(days=body.expires_in_days)) if body.expires_in_days else None)
    db.add(row)
    db.add(AuditLog(organization_id=_org(user), actor_email=user.email, action="API_KEY_CREATED", module="integrations",
                    target=f"{row.name} ({prefix}…) scopes={row.scopes}", result="success", ip_address="127.0.0.1"))
    await db.commit()
    return {"key_id": row.key_id, "name": row.name, "api_key": plain, "scopes": row.scopes,
            "note": "Copy this key now. It is shown only once and cannot be recovered."}


@admin_router.delete("/keys/{key_id}")
async def revoke_key(key_id: str, user: User = Depends(require_role(Role.ADMIN)), db: AsyncSession = Depends(get_db)):
    row = (await db.execute(select(ApiKey).where(ApiKey.key_id == key_id, ApiKey.organization_id == _org(user)))).scalar_one_or_none()
    if not row:
        raise HTTPException(status_code=404, detail="Key not found.")
    row.revoked_at = datetime.utcnow()
    db.add(AuditLog(organization_id=_org(user), actor_email=user.email, action="API_KEY_REVOKED", module="integrations",
                    target=f"{row.name} ({row.prefix}…)", result="success", ip_address="127.0.0.1"))
    await db.commit()
    return {"status": "revoked"}


# ═════════════════════════════════════════════════════════════════════════════════════
# Admin: webhooks
# ═════════════════════════════════════════════════════════════════════════════════════

class WebhookCreate(BaseModel):
    url: str = Field(..., max_length=1000)
    events: List[str] = ["*"]


def _wh_out(w: Webhook):
    return {"webhook_id": w.webhook_id, "url": w.url, "events": w.events, "enabled": bool(w.enabled), "created_at": w.created_at,
            "last_delivery_at": w.last_delivery_at, "last_status": w.last_status, "consecutive_failures": w.consecutive_failures or 0}


@admin_router.get("/webhooks")
async def list_webhooks(user: User = Depends(require_role(Role.ADMIN)), db: AsyncSession = Depends(get_db)):
    rows = (await db.execute(select(Webhook).where(Webhook.organization_id == _org(user)).order_by(Webhook.created_at.desc()))).scalars().all()
    return [_wh_out(w) for w in rows]


@admin_router.post("/webhooks", status_code=201)
async def create_webhook(body: WebhookCreate, user: User = Depends(require_role(Role.ADMIN)), db: AsyncSession = Depends(get_db)):
    bad = [e for e in body.events if e != "*" and e not in integ.EVENT_TYPES]
    if bad or not body.events:
        raise HTTPException(status_code=400, detail=f"Unknown events: {bad}")
    try:
        await integ.assert_public_target(body.url.strip())
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))
    import uuid, secrets
    w = Webhook(webhook_id=f"wh_{uuid.uuid4().hex[:12]}", organization_id=_org(user), url=body.url.strip(),
                secret="whsec_" + secrets.token_urlsafe(24), events=body.events, enabled=True, created_by=user.email)
    db.add(w)
    db.add(AuditLog(organization_id=_org(user), actor_email=user.email, action="WEBHOOK_CREATED", module="integrations",
                    target=w.url, result="success", ip_address="127.0.0.1"))
    await db.commit()
    return {**_wh_out(w), "secret": w.secret, "note": "Use the secret to verify the X-Aegis-Signature header. Shown only now."}


@admin_router.post("/webhooks/{webhook_id}/test")
async def test_webhook(webhook_id: str, user: User = Depends(require_role(Role.ADMIN)), db: AsyncSession = Depends(get_db)):
    w = (await db.execute(select(Webhook).where(Webhook.webhook_id == webhook_id, Webhook.organization_id == _org(user)))).scalar_one_or_none()
    if not w:
        raise HTTPException(status_code=404, detail="Webhook not found.")
    return await integ.send_test(webhook_id, _org(user))


@admin_router.post("/webhooks/{webhook_id}/enable")
async def enable_webhook(webhook_id: str, user: User = Depends(require_role(Role.ADMIN)), db: AsyncSession = Depends(get_db)):
    w = (await db.execute(select(Webhook).where(Webhook.webhook_id == webhook_id, Webhook.organization_id == _org(user)))).scalar_one_or_none()
    if not w:
        raise HTTPException(status_code=404, detail="Webhook not found.")
    w.enabled = True; w.consecutive_failures = 0
    await db.commit()
    return _wh_out(w)


@admin_router.delete("/webhooks/{webhook_id}")
async def delete_webhook(webhook_id: str, user: User = Depends(require_role(Role.ADMIN)), db: AsyncSession = Depends(get_db)):
    w = (await db.execute(select(Webhook).where(Webhook.webhook_id == webhook_id, Webhook.organization_id == _org(user)))).scalar_one_or_none()
    if not w:
        raise HTTPException(status_code=404, detail="Webhook not found.")
    await db.delete(w)
    await db.commit()
    return {"status": "deleted"}


@admin_router.get("/deliveries")
async def deliveries(limit: int = Query(30, le=200), user: User = Depends(require_role(Role.ADMIN)), db: AsyncSession = Depends(get_db)):
    rows = (await db.execute(select(WebhookDelivery).where(WebhookDelivery.organization_id == _org(user))
                             .order_by(WebhookDelivery.created_at.desc()).limit(limit))).scalars().all()
    return [{"webhook_id": d.webhook_id, "event": d.event, "ok": d.ok, "status_code": d.status_code, "attempts": d.attempts,
             "error": d.error, "created_at": d.created_at} for d in rows]


# ═════════════════════════════════════════════════════════════════════════════════════
# Machine API (X-API-Key)
# ═════════════════════════════════════════════════════════════════════════════════════

_hits = defaultdict(deque)
RATE_PER_MINUTE = 120


def api_key_auth(scope: str):
    async def dep(x_api_key: str = Header(""), db: AsyncSession = Depends(get_db)) -> ApiKey:
        key = await integ.lookup_key(db, x_api_key.strip())
        if not key:
            raise HTTPException(status_code=401, detail="Invalid, expired or revoked API key.", headers={"WWW-Authenticate": "ApiKey"})
        if scope not in (key.scopes or []):
            raise HTTPException(status_code=403, detail=f"This key does not have the '{scope}' scope.")
        now = time.time(); q = _hits[key.key_id]
        while q and now - q[0] > 60:
            q.popleft()
        if len(q) >= RATE_PER_MINUTE:
            raise HTTPException(status_code=429, detail="Rate limit: 120 requests per minute per key.")
        q.append(now)
        key.last_used_at = datetime.utcnow()
        await db.commit()
        return key
    return dep


@api_router.get("/incidents")
async def api_incidents(limit: int = Query(100, le=500), status: Optional[str] = None,
                        key: ApiKey = Depends(api_key_auth("incidents:read")), db: AsyncSession = Depends(get_db)):
    q = select(Incident).where(Incident.organization_id == key.organization_id).order_by(Incident.created_at.desc()).limit(limit)
    if status:
        q = q.where(Incident.status == status)
    rows = (await db.execute(q)).scalars().all()
    return {"incidents": [{"incident_id": i.incident_id or f"INC-{i.id}", "severity": i.severity, "status": i.status, "report_type": i.report_type,
                           "predicted_class": i.predicted_class, "risk_score": i.risk_score, "decision": i.admin_decision,
                           "created_at": i.created_at, "resolved_at": i.resolved_at} for i in rows]}


@api_router.get("/events")
async def api_events(response: Response, after_id: int = 0, limit: int = Query(200, le=1000), min_risk: int = 60, format: str = "json",
                     key: ApiKey = Depends(api_key_auth("events:read")), db: AsyncSession = Depends(get_db)):
    """Cursor-paged detections for a SIEM: poll with after_id=<last id you saw>."""
    rows = (await db.execute(select(WebsiteScan).where(
        WebsiteScan.organization_id == key.organization_id, WebsiteScan.id > after_id, WebsiteScan.risk_score >= min_risk)
        .order_by(WebsiteScan.id.asc()).limit(limit))).scalars().all()
    next_id = rows[-1].id if rows else after_id
    response.headers["X-Next-After-Id"] = str(next_id)
    if format == "cef":
        return Response("\n".join(integ.to_cef(r) for r in rows), media_type="text/plain", headers={"X-Next-After-Id": str(next_id)})
    return {"next_after_id": next_id, "events": [{
        "id": r.id, "time": r.created_at, "url": r.url, "domain": r.domain, "decision": r.decision, "risk_score": r.risk_score,
        "threat_type": r.threat_type, "verdict": r.verdict, "user_id": r.user_id} for r in rows]}


@api_router.get("/threat-feed")
async def api_threat_feed(key: ApiKey = Depends(api_key_auth("intel:read")), db: AsyncSession = Depends(get_db)):
    rows = (await db.execute(select(Policy).where(Policy.organization_id == key.organization_id, Policy.enabled == True,  # noqa: E712
                                                  Policy.policy_type.in_(["blocklist", "allowlist", "warninglist"])))).scalars().all()
    out = {"blocklist": [], "allowlist": [], "warninglist": []}
    for p in rows:
        out[p.policy_type].append(p.value)
    return out


class ScanIn(BaseModel):
    url: str = Field(..., max_length=2048)


@api_router.post("/scan/url")
async def api_scan(body: ScanIn, key: ApiKey = Depends(api_key_auth("scan"))):
    from api.services.model_orchestrator import predict_url
    r = await predict_url(body.url.strip())
    if "error" in r:
        raise HTTPException(status_code=503, detail=r["error"])
    score = int(round(float(r.get("phishing_probability", 0)) * 100))
    return {"url": body.url, "risk_score": score, "prediction": r.get("prediction"), "category": r.get("category"),
            "explanation": r.get("explanation"), "verdict": "danger" if score >= 70 else "warning" if score >= 40 else "safe"}
