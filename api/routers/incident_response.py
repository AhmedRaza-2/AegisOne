"""
AegisOne API — Incident Response (admin)
========================================
Everything an admin needs AFTER an incident exists: the complete back-trace (what was detected and
why, who reported it, who else was exposed), CSV export, a printable end-to-end report, a server-side
redirect-chain trace, and one-click playbook actions (block / allow a domain, notify affected users).

Separate from incidents.py (list / verify) so those endpoints stay small; all routes share the
/admin/incidents prefix and the same organization scoping.
"""
import logging
import uuid
from datetime import datetime, timedelta
from typing import Any, Dict, Optional

from fastapi import APIRouter, Depends, HTTPException, Query, Response, status
from fastapi.responses import HTMLResponse
from pydantic import BaseModel, Field
from sqlalchemy import or_
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.future import select

from api.auth.roles import Role, require_role
from api.database.db import get_db
from api.database.models import AuditLog, Incident, IncidentReport, Notification, Organization, Policy, User
from api.services.incident_report import build_backtrace, incidents_csv, render_report_html
from api.services.redirect_tracer import trace_redirects

logger = logging.getLogger("aegisone.incident_response")

router = APIRouter(prefix="/admin/incidents", tags=["Incident Response"])


async def _incident_or_404(db: AsyncSession, user: User, incident_id: str) -> Incident:
    query = select(Incident).where(
        or_(Incident.incident_id == incident_id, Incident.id == (int(incident_id) if incident_id.isdigit() else -1))
    )
    if user.role != "global_admin":
        query = query.where(Incident.organization_id == (user.organization_id or "org_default"))
    inc = (await db.execute(query)).scalar_one_or_none()
    if not inc:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Incident not found.")
    return inc


def _audit(db: AsyncSession, org_id: str, user: User, action: str, target: str) -> None:
    db.add(AuditLog(organization_id=org_id, actor_email=user.email, action=action, module="incident_response",
                    target=target[:500], result="success", ip_address="127.0.0.1"))


# NOTE: /export must be registered before the generic /{incident_id} route in incidents.py; main.py
# includes this router first for exactly that reason.
@router.get("/export")
async def export_incidents_csv(
    status_filter: Optional[str] = Query(None, alias="status"),
    severity: Optional[str] = None,
    days: int = Query(90, ge=1, le=3650),
    current_user: User = Depends(require_role(Role.ADMIN)),
    db: AsyncSession = Depends(get_db),
):
    """Download the organization's incidents as CSV (one row per incident)."""
    org_id = current_user.organization_id or "org_default"
    q = select(Incident).where(Incident.organization_id == org_id,
                               Incident.created_at >= datetime.utcnow() - timedelta(days=days))
    if status_filter:
        q = q.where(Incident.status == status_filter.lower())
    if severity:
        q = q.where(Incident.severity == severity.lower())
    incidents = (await db.execute(q.order_by(Incident.created_at.desc()).limit(5000))).scalars().all()
    body = await incidents_csv(db, incidents)
    db.add(AuditLog(organization_id=org_id, actor_email=current_user.email, action="INCIDENTS_EXPORTED",
                    module="incident_response", target=f"{len(incidents)} incidents (CSV, last {days} days)",
                    result="success", ip_address="127.0.0.1"))
    await db.commit()
    stamp = datetime.utcnow().strftime("%Y%m%d-%H%M")
    return Response(content="﻿" + body, media_type="text/csv; charset=utf-8",
                    headers={"Content-Disposition": f'attachment; filename="aegisone-incidents-{stamp}.csv"'})


@router.get("/{incident_id}/backtrace", response_model=Dict[str, Any])
async def incident_backtrace(
    incident_id: str,
    current_user: User = Depends(require_role(Role.ADMIN)),
    db: AsyncSession = Depends(get_db),
):
    """Complete back-trace: what was detected and why, who reported it, who else was exposed, what was done."""
    inc = await _incident_or_404(db, current_user, incident_id)
    return await build_backtrace(db, inc)


@router.get("/{incident_id}/report", response_class=HTMLResponse)
async def incident_report_html(
    incident_id: str,
    current_user: User = Depends(require_role(Role.ADMIN)),
    db: AsyncSession = Depends(get_db),
):
    """Printable end-to-end incident report (open it, then Print / Save as PDF)."""
    inc = await _incident_or_404(db, current_user, incident_id)
    bt = await build_backtrace(db, inc)
    org_id = inc.organization_id or "org_default"
    org = (await db.execute(select(Organization).where(Organization.id == org_id))).scalars().first()
    _audit(db, org_id, current_user, "INCIDENT_REPORT_GENERATED", f"Incident {bt['incident']['id']}")
    await db.commit()
    return HTMLResponse(render_report_html(bt, org.name if org else org_id, current_user.full_name or current_user.email))


@router.post("/{incident_id}/trace-redirects", response_model=Dict[str, Any])
async def trace_incident_redirects(
    incident_id: str,
    current_user: User = Depends(require_role(Role.ADMIN)),
    db: AsyncSession = Depends(get_db),
):
    """Follow the incident's link hop by hop from the server (SSRF-guarded) and store the chain with the incident."""
    inc = await _incident_or_404(db, current_user, incident_id)
    raw = inc.detection_event_ref if (inc.detection_event_ref or "").startswith("http") else None
    if not raw:
        row = (await db.execute(
            select(IncidentReport.target_ref)
            .where(IncidentReport.incident_id == inc.id, IncidentReport.target_ref.like("http%")).limit(1)
        )).first()
        raw = row[0] if row else None
    if not raw:
        raise HTTPException(status_code=400, detail="This incident has no web address to trace.")
    result = await trace_redirects(raw)
    ev = dict(inc.evidence) if isinstance(inc.evidence, dict) else {}
    ev["redirect_trace"] = result
    inc.evidence = ev
    _audit(db, inc.organization_id or "org_default", current_user, "REDIRECTS_TRACED",
           f"Incident {inc.incident_id}: {result['hops']} hop(s)")
    await db.commit()
    return result


class IncidentActionRequest(BaseModel):
    action: str = Field(..., description="block_domain | allow_domain | notify_affected")
    domain: Optional[str] = Field(None, max_length=255)
    message: Optional[str] = Field(None, max_length=1000)


@router.post("/{incident_id}/actions", response_model=Dict[str, Any])
async def incident_action(
    incident_id: str,
    payload: IncidentActionRequest,
    current_user: User = Depends(require_role(Role.ADMIN)),
    db: AsyncSession = Depends(get_db),
):
    """One-click response steps from the incident playbook."""
    inc = await _incident_or_404(db, current_user, incident_id)
    org_id = inc.organization_id or "org_default"
    action = payload.action.lower()

    if action in ("block_domain", "allow_domain"):
        bt = await build_backtrace(db, inc, include_domain_age=False)
        domain = (payload.domain or bt["detection"]["domain"] or "").strip().lower()
        if not domain or "." not in domain or len(domain) > 255:
            raise HTTPException(status_code=400, detail="No valid domain to apply this action to.")
        ptype = "blocklist" if action == "block_domain" else "allowlist"
        opposite = "allowlist" if ptype == "blocklist" else "blocklist"
        # a domain cannot be both allowed and blocked: drop the opposite rule for this org
        for row in (await db.execute(select(Policy).where(
                Policy.organization_id == org_id, Policy.policy_type == opposite, Policy.value == domain))).scalars().all():
            await db.delete(row)
        exists = (await db.execute(select(Policy).where(
            Policy.organization_id == org_id, Policy.policy_type == ptype, Policy.value == domain))).scalars().first()
        if not exists:
            db.add(Policy(organization_id=org_id, policy_type=ptype, value=domain,
                          action="block" if ptype == "blocklist" else "allow", enabled=True, priority=10,
                          created_by=f"{current_user.email} (incident {inc.incident_id})"))
        _audit(db, org_id, current_user, "DOMAIN_BLOCKED" if ptype == "blocklist" else "DOMAIN_ALLOWED",
               f"Incident {inc.incident_id}: {domain} added to organization {ptype}")
        await db.commit()
        return {"status": "success", "action": action, "domain": domain, "already_present": bool(exists)}

    if action == "notify_affected":
        bt = await build_backtrace(db, inc, include_domain_age=False)
        ids = {p["id"] for p in bt["exposure"]["people"] if p.get("id")}
        ids |= {r["person"]["id"] for r in bt["reporters"] if r.get("person")}
        ids.discard(current_user.id)
        message = (payload.message or "").strip() or (
            f"Security notice: {bt['detection']['domain'] or 'a link'} was identified as unsafe (incident {inc.incident_id}). "
            "Please do not open it or enter any information. If you already did, contact your security team now.")
        count = 0
        if ids:
            for u in (await db.execute(select(User).where(User.id.in_(ids), User.organization_id == org_id))).scalars().all():
                db.add(Notification(organization_id=org_id, user_id=u.id, kind="security_notice", severity="high",
                                    title="Security notice", body=message))
                count += 1
        _audit(db, org_id, current_user, "AFFECTED_USERS_NOTIFIED", f"Incident {inc.incident_id}: {count} user(s) notified")
        await db.commit()
        return {"status": "success", "action": action, "notified": count}

    raise HTTPException(status_code=400, detail="Unknown action.")
