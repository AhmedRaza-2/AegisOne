"""
AegisOne API — Manager Incident Triage Router
================================================
Department-scoped tier between employee reporting (`reports.py`) and admin
verification (`incidents.py`). A manager sees only incidents that have at least
one linked report from their own department, and can resolve them at the
department level or escalate them to the org admin queue. Escalating/resolving
here never touches `admin_decision` or the training-candidate pipeline — that
remains exclusively the admin's `POST /admin/incidents/{id}/verify` call.
"""
import json
import uuid
import logging
from typing import List, Optional, Dict, Any
from datetime import datetime

from fastapi import APIRouter, Depends, HTTPException, status, Query
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.future import select
from sqlalchemy import func, or_

from api.database.db import get_db
from api.database.models import User, Incident, IncidentReport, AuditLog, WebsiteScan
from api.database.schemas import IncidentResponse, ManagerTriageRequest
from api.auth.roles import Role, require_role
from api.services.incident_view import redact_incident, redact_incident_report
from api.services.xai_engine import build_grounded_findings
from pydantic import BaseModel, Field

logger = logging.getLogger("aegisone.manager_incidents")

router = APIRouter(prefix="/manager/incidents", tags=["Manager Incident Triage"])


class EmployeeEscalationRequest(BaseModel):
    employee_id: int
    priority: str = Field("High", max_length=20)
    notes: str = Field(..., min_length=1, max_length=5000)


@router.post("/escalate-employee", response_model=Dict[str, Any], status_code=status.HTTP_201_CREATED)
async def escalate_employee(
    payload: EmployeeEscalationRequest,
    current_user: User = Depends(require_role(Role.MANAGER)),
    db: AsyncSession = Depends(get_db),
):
    """Manager escalates a high-risk employee in their department to the admin queue.
    Creates a real, already-escalated incident carrying the employee's recent flagged
    scans (with the reasons they were flagged) as evidence."""
    if current_user.department_id is None:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="No department assigned to this account.")
    org_id = current_user.organization_id or "org_default"
    emp = (await db.execute(select(User).where(User.id == payload.employee_id))).scalar_one_or_none()
    if (not emp or (emp.organization_id or "org_default") != org_id
            or emp.department_id != current_user.department_id):
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Employee not found in your department.")

    scans = (await db.execute(
        select(WebsiteScan)
        .where(WebsiteScan.user_id == emp.id, WebsiteScan.decision.in_(["warn", "block"]))
        .order_by(WebsiteScan.created_at.desc()).limit(5)
    )).scalars().all()

    flagged = []
    for sc in scans:
        rich = None
        if sc.xai_explanation:
            try:
                rich = json.loads(sc.xai_explanation)
            except Exception:
                rich = None
        g = build_grounded_findings(
            {"risk_score": sc.risk_score, "domain": sc.domain, "url": sc.url, "scan_type": sc.scan_type}, rich)
        flagged.append({
            "scan_id": sc.scan_id, "kind": g["kind"], "target": sc.url, "risk_score": round(sc.risk_score or 0),
            "decision": sc.decision, "when": sc.created_at.isoformat() if sc.created_at else None,
            "findings": g["findings"][:3],
        })

    top_risk = max([f["risk_score"] for f in flagged], default=0)
    priority = payload.priority.capitalize() if payload.priority.capitalize() in ("High", "Critical") else "High"
    stamp = datetime.utcnow().strftime("%Y-%m-%d %H:%M UTC")
    note = f"[{stamp}] {current_user.full_name or current_user.email}: {payload.notes}"
    evidence = {
        "scan_kind": "employee_escalation",
        "source_model": "Manager escalation of repeated flagged activity",
        "employee": {"id": emp.id, "name": emp.full_name},
        "priority": priority,
        "risk_score": top_risk,
        "findings": [f"{emp.full_name or 'This employee'} had {len(flagged)} recent flagged event(s)"] +
                    [f"{x['target'][:80]} ({x['risk_score']}% risk): {x['findings'][0]}" for x in flagged if x["findings"]][:4],
        "flagged_events": flagged,
        "captured_at": datetime.utcnow().isoformat() + "Z",
    }
    inc = Incident(
        incident_id=f"INC-{uuid.uuid4().hex[:8].upper()}",
        organization_id=org_id,
        reported_by_id=current_user.id,
        severity="critical" if priority == "Critical" else "high",
        status="escalated",
        report_type="manager_escalation",
        detection_event_ref=f"Employee: {emp.full_name or emp.email}",
        risk_score=top_risk or None,
        notes=payload.notes,
        manager_notes=note,
        escalated_by_id=current_user.id,
        escalated_at=datetime.utcnow(),
        evidence=evidence,
    )
    db.add(inc)
    await db.flush()
    db.add(IncidentReport(
        report_id=f"REP-{uuid.uuid4().hex[:8].upper()}", incident_id=inc.id, user_id=emp.id,
        organization_id=org_id, department_id=emp.department_id, report_type="manager_escalation",
        target_type="user", target_ref=f"Employee: {emp.full_name or emp.email}", risk_score=top_risk or None,
        user_notes=payload.notes, status="submitted", evidence=evidence,
    ))
    db.add(AuditLog(
        organization_id=org_id, actor_email=current_user.email, action="EMPLOYEE_ESCALATED",
        module="manager_triage", target=f"Employee {emp.email} -> Incident {inc.incident_id}",
        result="success", ip_address="127.0.0.1",
    ))
    await db.commit()
    return {"status": "success", "incident_id": inc.incident_id, "priority": priority}


@router.get("/high-risk-employees", response_model=Dict[str, Any])
async def high_risk_employees(
    current_user: User = Depends(require_role(Role.MANAGER)),
    db: AsyncSession = Depends(get_db),
):
    """Employees in the manager's department with flagged activity, each with the concrete
    events (what, where, why) that put them on the list — the source of the risk."""
    if current_user.department_id is None:
        return {"employees": []}
    org_id = current_user.organization_id or "org_default"
    rows = (await db.execute(
        select(WebsiteScan)
        .join(User, User.id == WebsiteScan.user_id)
        .where(User.department_id == current_user.department_id, User.organization_id == org_id,
               WebsiteScan.decision.in_(["warn", "block"]))
        .order_by(WebsiteScan.created_at.desc()).limit(300)
    )).scalars().all()

    by_user: Dict[int, list] = {}
    for sc in rows:
        by_user.setdefault(sc.user_id, []).append(sc)

    users = {}
    if by_user:
        ures = await db.execute(select(User).where(User.id.in_(list(by_user.keys()))))
        users = {u.id: u for u in ures.scalars().all()}

    out = []
    for uid, scans in by_user.items():
        u = users.get(uid)
        if not u:
            continue
        events = []
        for sc in scans[:3]:
            rich = None
            if sc.xai_explanation:
                try:
                    rich = json.loads(sc.xai_explanation)
                except Exception:
                    rich = None
            g = build_grounded_findings(
                {"risk_score": sc.risk_score, "domain": sc.domain, "url": sc.url, "scan_type": sc.scan_type}, rich)
            events.append({
                "kind": g["kind"], "target": (sc.url or "")[:120], "risk_score": round(sc.risk_score or 0),
                "decision": sc.decision, "finding": g["findings"][0],
                "when": sc.created_at.isoformat() if sc.created_at else None,
            })
        blocks = sum(1 for sc in scans if sc.decision == "block")
        out.append({
            "id": u.id, "name": u.full_name or u.email, "flagged_count": len(scans), "blocked_count": blocks,
            "top_risk": max(e["risk_score"] for e in events), "events": events,
        })
    out.sort(key=lambda e: (e["blocked_count"], e["top_risk"], e["flagged_count"]), reverse=True)
    return {"employees": out[:10]}


async def _load_department_incident(incident_id: str, current_user: User, db: AsyncSession) -> Incident:
    """Look up an incident and verify it has at least one report from the manager's department."""
    if current_user.department_id is None:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="No department assigned to this account.")

    org_id = current_user.organization_id or "org_default"
    query = select(Incident).where(
        or_(Incident.incident_id == incident_id, Incident.id == (int(incident_id) if incident_id.isdigit() else -1)),
        Incident.organization_id == org_id,
    )
    result = await db.execute(query)
    inc = result.scalar_one_or_none()
    if not inc:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Incident not found.")

    dept_check = await db.execute(
        select(func.count(IncidentReport.id)).where(
            IncidentReport.incident_id == inc.id,
            IncidentReport.department_id == current_user.department_id,
        )
    )
    if not (dept_check.scalar_one_or_none() or 0):
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Incident not found.")

    return inc


@router.get("", response_model=List[IncidentResponse])
async def list_department_incidents(
    status_filter: Optional[str] = Query(None, alias="status"),
    severity: Optional[str] = None,
    report_type: Optional[str] = None,
    limit: int = 50,
    offset: int = 0,
    current_user: User = Depends(require_role(Role.MANAGER)),
    db: AsyncSession = Depends(get_db),
):
    """List incidents that have at least one report from the manager's own department."""
    if current_user.department_id is None:
        return []

    org_id = current_user.organization_id or "org_default"
    # Subquery rather than JOIN + DISTINCT: Postgres cannot DISTINCT over the JSON evidence column.
    dept_incident_ids = select(IncidentReport.incident_id).where(
        IncidentReport.department_id == current_user.department_id
    )
    query = select(Incident).where(
        Incident.organization_id == org_id,
        Incident.id.in_(dept_incident_ids),
    )

    if status_filter:
        query = query.where(Incident.status == status_filter.lower())
    if severity:
        query = query.where(Incident.severity == severity.lower())
    if report_type:
        query = query.where(Incident.report_type == report_type.lower())

    query = query.order_by(Incident.created_at.desc()).offset(offset).limit(limit)
    result = await db.execute(query)
    incidents = result.scalars().all()

    response_items = []
    for inc in incidents:
        # Scoped to this manager's own department — matches what the detail view actually
        # shows them. The org-wide count (across other departments) is not this manager's to see.
        r_count_res = await db.execute(
            select(func.count(IncidentReport.id)).where(
                IncidentReport.incident_id == inc.id,
                IncidentReport.department_id == current_user.department_id,
            )
        )
        rep_count = r_count_res.scalar_one_or_none() or 1

        response_items.append(redact_incident(IncidentResponse(
            id=inc.id,
            incident_id=inc.incident_id or f"INC-{inc.id}",
            organization_id=inc.organization_id,
            reported_by_id=inc.reported_by_id,
            severity=inc.severity,
            status=inc.status,
            report_type=inc.report_type,
            detection_event_ref=inc.detection_event_ref,
            model_version=inc.model_version,
            predicted_class=inc.predicted_class,
            risk_score=inc.risk_score,
            admin_decision=inc.admin_decision,
            admin_notes=inc.admin_notes,
            verified_by_id=inc.verified_by_id,
            verified_at=inc.verified_at,
            created_at=inc.created_at,
            resolved_at=inc.resolved_at,
            reports_count=rep_count,
            escalated_by_id=inc.escalated_by_id,
            escalated_at=inc.escalated_at,
            manager_notes=inc.manager_notes,
            evidence=inc.evidence,
        )))

    return response_items


@router.get("/{incident_id}", response_model=Dict[str, Any])
async def get_department_incident_detail(
    incident_id: str,
    current_user: User = Depends(require_role(Role.MANAGER)),
    db: AsyncSession = Depends(get_db),
):
    """Detail view, scoped to the manager's department, with redacted evidence."""
    inc = await _load_department_incident(incident_id, current_user, db)

    reports_res = await db.execute(
        select(IncidentReport)
        .where(IncidentReport.incident_id == inc.id, IncidentReport.department_id == current_user.department_id)
        .order_by(IncidentReport.created_at.desc())
    )
    reports = reports_res.scalars().all()

    incident_response = redact_incident(IncidentResponse(
        id=inc.id,
        incident_id=inc.incident_id or f"INC-{inc.id}",
        organization_id=inc.organization_id,
        reported_by_id=inc.reported_by_id,
        severity=inc.severity,
        status=inc.status,
        report_type=inc.report_type,
        detection_event_ref=inc.detection_event_ref,
        model_version=inc.model_version,
        predicted_class=inc.predicted_class,
        risk_score=inc.risk_score,
        admin_decision=inc.admin_decision,
        admin_notes=inc.admin_notes,
        verified_by_id=inc.verified_by_id,
        verified_at=inc.verified_at,
        created_at=inc.created_at,
        resolved_at=inc.resolved_at,
        reports_count=len(reports) or 1,
        escalated_by_id=inc.escalated_by_id,
        escalated_at=inc.escalated_at,
        manager_notes=inc.manager_notes,
            evidence=inc.evidence,
    ))

    return {
        "incident": incident_response,
        "reports": [redact_incident_report(r) for r in reports],
    }


@router.post("/{incident_id}/triage", response_model=Dict[str, Any])
async def triage_incident(
    incident_id: str,
    payload: ManagerTriageRequest,
    current_user: User = Depends(require_role(Role.MANAGER)),
    db: AsyncSession = Depends(get_db),
):
    """Department-level action on an incident: resolve, escalate to admin, or comment.
    Does not set admin_decision and never creates a TrainingCandidate — that stays
    exclusively an admin action via POST /admin/incidents/{id}/verify."""
    inc = await _load_department_incident(incident_id, current_user, db)

    def _append_note(text: str | None):
        # A single overwritable field meant different managers' comments destroyed each
        # other's; append as a timestamped log entry instead.
        if not text:
            return
        stamp = datetime.utcnow().strftime("%Y-%m-%d %H:%M UTC")
        entry = f"[{stamp}] {current_user.full_name or current_user.email}: {text}"
        inc.manager_notes = f"{inc.manager_notes}\n{entry}" if inc.manager_notes else entry

    action = (payload.action or "").lower()
    if action == "resolve":
        inc.status = "resolved"
        _append_note(payload.notes)
        inc.resolved_at = datetime.utcnow()
        inc.resolved_by_id = current_user.id
    elif action == "escalate":
        inc.status = "escalated"
        _append_note(payload.notes)
        inc.escalated_by_id = current_user.id
        inc.escalated_at = datetime.utcnow()
    elif action == "comment":
        _append_note(payload.notes)
    else:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="action must be resolve, escalate, or comment.")

    audit_entry = AuditLog(
        organization_id=inc.organization_id or "org_default",
        actor_email=current_user.email,
        action=f"INCIDENT_{action.upper()}",
        module="manager_triage",
        target=f"Incident {inc.incident_id or inc.id}",
        result="success",
        ip_address="127.0.0.1",
    )
    db.add(audit_entry)

    await db.commit()

    return {
        "status": "success",
        "incident_id": inc.incident_id or f"INC-{inc.id}",
        "new_status": inc.status,
    }
