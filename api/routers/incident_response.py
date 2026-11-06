"""
AegisOne API — Incident Response (admin)
========================================
Everything an admin needs AFTER an incident exists: the complete back-trace (what was detected and
why, who reported it, who else was exposed), CSV export, a printable end-to-end report, a server-side
redirect-chain trace, one-click playbook actions, step-by-step response tracking and response metrics.

Actions (POST /{id}/actions): block_domain, allow_domain, notify_affected, revoke_sessions,
reset_credentials, assign_training, warn_organization. Each is audit-logged, recorded on the incident's
response record and ticks the matching playbook step (see api/services/playbooks.py, incident_ops.py).

Separate from incidents.py (list / verify) so those endpoints stay small; all routes share the
/admin/incidents prefix and the same organization scoping.
"""
import logging
from datetime import datetime, timedelta
from typing import Any, Dict, List, Literal, Optional

from fastapi import APIRouter, BackgroundTasks, Depends, HTTPException, Query, Response, status
from fastapi.responses import HTMLResponse
from pydantic import BaseModel, Field
from sqlalchemy import or_
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.future import select

from api.auth.roles import Role, require_role
from api.database.db import get_db
from api.database.models import AuditLog, Incident, IncidentReport, Notification, Organization, Policy, User
from api.services import incident_ops
from api.services.incident_report import build_backtrace, incidents_csv, render_report_html
from api.services.playbooks import ACTIONS, get_playbook, mark_step, step_exists, step_for_action
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


# NOTE: /export and /metrics must be registered before the generic /{incident_id} route in incidents.py;
# main.py includes this router first for exactly that reason.
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


@router.get("/metrics", response_model=Dict[str, Any])
async def incident_metrics(
    days: int = Query(30, ge=1, le=365),
    current_user: User = Depends(require_role(Role.ADMIN)),
    db: AsyncSession = Depends(get_db),
):
    """Response performance: time to acknowledge / contain / resolve, SLA compliance, open incidents by severity."""
    org = None if current_user.role == "global_admin" else (current_user.organization_id or "org_default")
    return await incident_ops.metrics(db, org, days)


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
    action: str = Field(..., description=" | ".join(ACTIONS))
    domain: Optional[str] = Field(None, max_length=255)
    message: Optional[str] = Field(None, max_length=1000)
    user_ids: Optional[List[int]] = Field(None, max_length=500, description="explicit people for revoke / reset / training")
    scope: Literal["credentials", "exposed"] = Field("credentials", description="who revoke/reset applies to by default")
    module: Optional[str] = Field(None, max_length=64, description="training module key for assign_training")


async def _org_users(db: AsyncSession, org_id: str, ids) -> List[User]:
    ids = {int(i) for i in ids if i is not None}
    if not ids:
        return []
    return list((await db.execute(select(User).where(User.id.in_(ids), User.organization_id == org_id))).scalars().all())


@router.post("/{incident_id}/actions", response_model=Dict[str, Any])
async def incident_action(
    incident_id: str,
    payload: IncidentActionRequest,
    bg: BackgroundTasks,
    current_user: User = Depends(require_role(Role.ADMIN)),
    db: AsyncSession = Depends(get_db),
):
    """One-click response steps from the incident playbook."""
    inc = await _incident_or_404(db, current_user, incident_id)
    org_id = inc.organization_id or "org_default"
    action = payload.action.lower()
    if action not in ACTIONS:
        raise HTTPException(status_code=400, detail="Unknown action.")
    bt = await build_backtrace(db, inc, include_domain_age=False)
    itype = bt["incident"]["type"]
    step_id = step_for_action(itype, action)
    who = current_user.email

    if action in ("block_domain", "allow_domain"):
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
        incident_ops.record_action(inc, action, who, 1, domain, step_id, itype, contain=(action == "block_domain"))
        await db.commit()
        return {"status": "success", "action": action, "domain": domain, "already_present": bool(exists)}

    exposed = {p["id"] for p in bt["exposure"]["people"] if p.get("id")} | {r["person"]["id"] for r in bt["reporters"] if r.get("person")}
    credential = {p["id"] for p in bt["exposure"]["credential_people"] if p.get("id")}

    if action == "notify_affected":
        message = (payload.message or "").strip() or (
            f"Security notice: {bt['detection']['domain'] or 'a link'} was identified as unsafe (incident {inc.incident_id}). "
            "Please do not open it or enter any information. If you already did, contact your security team now.")
        targets = [u for u in await _org_users(db, org_id, exposed) if u.id != current_user.id]
        for u in targets:
            db.add(Notification(organization_id=org_id, user_id=u.id, kind="security_notice", severity="high",
                                title="Security notice", body=message))
        _audit(db, org_id, current_user, "AFFECTED_USERS_NOTIFIED", f"Incident {inc.incident_id}: {len(targets)} user(s) notified")
        incident_ops.record_action(inc, action, who, len(targets), "", step_id, itype, contain=True)
        await db.commit()
        return {"status": "success", "action": action, "notified": len(targets)}

    if action == "warn_organization":
        message = (payload.message or "").strip() or (
            f"Security warning: a {(bt['playbook'].get('title') or 'phishing attempt').lower()} is circulating"
            f"{' (' + bt['detection']['domain'] + ')' if bt['detection']['domain'] else ''}. Do not click links, scan codes, pay or share "
            "codes on any request about it. Report anything similar with the AegisOne report button.")
        users = (await db.execute(select(User).where(User.organization_id == org_id, User.is_active == True))).scalars().all()  # noqa: E712
        targets = [u for u in users if u.id != current_user.id]
        for u in targets:
            db.add(Notification(organization_id=org_id, user_id=u.id, kind="security_notice", severity="high",
                                title="Security warning for everyone", body=message))
        _audit(db, org_id, current_user, "ORGANIZATION_WARNED", f"Incident {inc.incident_id}: {len(targets)} user(s) warned")
        incident_ops.record_action(inc, action, who, len(targets), "", step_id, itype, contain=True)
        await db.commit()
        return {"status": "success", "action": action, "notified": len(targets)}

    if action in ("revoke_sessions", "reset_credentials"):
        ids = set(payload.user_ids or []) or (credential if payload.scope == "credentials" else exposed | credential)
        targets = [u for u in await _org_users(db, org_id, ids) if u.id != current_user.id]
        if not targets:
            raise HTTPException(status_code=400, detail=(
                "Nobody entered credentials on this address without being blocked. Choose the people explicitly, "
                "or use scope 'exposed' to include everyone who opened it."))
        now = datetime.utcnow()
        for u in targets:
            u.password_changed_at = now   # every token issued before now is rejected: signed out everywhere
            db.add(Notification(organization_id=org_id, user_id=u.id, kind="security_notice", severity="high",
                                title="You were signed out for your safety",
                                body=(f"Because of incident {inc.incident_id}, your AegisOne sessions were ended. "
                                      + ("Check your e-mail for a code to set a new password." if action == "reset_credentials"
                                         else "Sign in again; if you entered your password on a suspicious page, change it now."))))
        await db.commit()
        sent = 0
        if action == "reset_credentials":
            from api.routers.auth import issue_password_reset
            reason = (f"Your security team asked you to set a new password because of incident {inc.incident_id} "
                      "(a suspicious page may have received your password).")
            for u in targets:
                try:
                    if await issue_password_reset(db, u, bg, reason=reason):
                        sent += 1
                except Exception as e:  # one failed mail must not stop the rest
                    logger.warning("reset code for %s failed: %s", u.email, e)
        _audit(db, org_id, current_user, "SESSIONS_REVOKED" if action == "revoke_sessions" else "PASSWORD_RESETS_ISSUED",
               f"Incident {inc.incident_id}: {len(targets)} user(s) signed out" + (f", {sent} reset code(s) sent" if action == "reset_credentials" else ""))
        incident_ops.record_action(inc, action, who, len(targets), ", ".join(u.email for u in targets)[:300], step_id, itype, contain=True)
        await db.commit()
        return {"status": "success", "action": action, "signed_out": len(targets), "reset_codes_sent": sent,
                "people": [u.email for u in targets]}

    if action == "assign_training":
        from api.routers.awareness import _assign_module
        from api.services import awareness_content
        module = payload.module or bt["playbook"].get("training_module") or "links_and_domains"
        if not awareness_content.get_module(module):
            raise HTTPException(status_code=400, detail="Unknown training module.")
        ids = set(payload.user_ids or []) or exposed | credential
        targets = [u for u in await _org_users(db, org_id, ids) if u.id != current_user.id]
        n = 0
        for u in targets:
            if await _assign_module(db, org_id, u.id, module, f"incident:{inc.incident_id}"):
                n += 1
        _audit(db, org_id, current_user, "TRAINING_ASSIGNED", f"Incident {inc.incident_id}: '{module}' assigned to {n} user(s)")
        incident_ops.record_action(inc, action, who, n, module, step_id, itype)
        await db.commit()
        return {"status": "success", "action": action, "module": module, "assigned": n, "already_assigned": len(targets) - n}

    raise HTTPException(status_code=400, detail="Unknown action.")


class StepUpdate(BaseModel):
    done: bool = True
    note: Optional[str] = Field(None, max_length=500)


@router.post("/{incident_id}/playbook/steps/{step_id}", response_model=Dict[str, Any])
async def update_playbook_step(
    incident_id: str,
    step_id: str,
    body: StepUpdate,
    current_user: User = Depends(require_role(Role.ADMIN)),
    db: AsyncSession = Depends(get_db),
):
    """Tick (or untick) a response step; who and when are recorded and shown on the incident and in the report."""
    inc = await _incident_or_404(db, current_user, incident_id)
    bt = await build_backtrace(db, inc, include_domain_age=False)
    itype = bt["incident"]["type"]
    st = step_exists(itype, step_id)
    if not st:
        raise HTTPException(status_code=404, detail="No such step in this incident's playbook.")
    r = incident_ops.acknowledge(incident_ops.response_of(inc))
    r = mark_step(r, itype, step_id, done=body.done, by=current_user.email, note=body.note)
    incident_ops.save_response(inc, r)
    _audit(db, inc.organization_id or "org_default", current_user, "RESPONSE_STEP_DONE" if body.done else "RESPONSE_STEP_REOPENED",
           f"Incident {inc.incident_id}: step {step_id} - {st['text'][:200]}")
    await db.commit()
    return {"playbook": get_playbook(itype, r.get("steps")), "sla": incident_ops.sla_status(inc, r), **incident_ops.timings(inc, r)}
