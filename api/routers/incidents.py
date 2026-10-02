"""
AegisOne API — Admin Incident Management & Verification Router (Phases 1 & 2)
=============================================================================
Provides admin endpoints to list, inspect, and verify security incidents and employee reports.
Converts verified feedback into deduplicated organization-scoped training candidates.
"""
import uuid
import hashlib
import logging
from typing import List, Optional, Dict, Any
from datetime import datetime, timedelta

from fastapi import APIRouter, Depends, HTTPException, status, Query
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.future import select
from sqlalchemy import func, or_, and_

from api.database.db import get_db
from api.database.models import User, Incident, IncidentReport, TrainingCandidate, AuditLog, Department
from api.database.schemas import (
    IncidentResponse,
    IncidentVerifyRequest,
    IncidentReportResponse,
    TrainingCandidateSummary
)
from api.auth.roles import Role, require_role
from api.services.incident_view import redact_incident, redact_incident_report

logger = logging.getLogger("aegisone.incidents")

router = APIRouter(prefix="/admin/incidents", tags=["Admin Incidents & Verification"])


def _fingerprint_ref(raw_ref: str) -> str:
    """Generate deterministic SHA256 fingerprint for deduplication."""
    clean = (raw_ref or "").strip().lower()
    return hashlib.sha256(clean.encode("utf-8")).hexdigest()


@router.get("", response_model=List[IncidentResponse])
async def list_incidents(
    status_filter: Optional[str] = Query(None, alias="status"),
    severity: Optional[str] = None,
    report_type: Optional[str] = None,
    limit: int = 50,
    offset: int = 0,
    current_user: User = Depends(require_role(Role.ADMIN)),
    db: AsyncSession = Depends(get_db),
):
    """
    List security incidents for the admin's organization.
    Enforces strict multi-tenant organization isolation.
    """
    user_role = getattr(current_user, "role", "employee")
    org_id = current_user.organization_id or "org_default"

    query = select(Incident)
    
    # Non-global admins are strictly isolated to their own organization
    if user_role not in ("super_admin", "global_admin"):
        query = query.where(Incident.organization_id == org_id)
    elif current_user.organization_id:
        query = query.where(Incident.organization_id == org_id)

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
        # Count linked reports
        r_count_query = select(func.count(IncidentReport.id)).where(IncidentReport.incident_id == inc.id)
        r_res = await db.execute(r_count_query)
        rep_count = r_res.scalar_one_or_none() or 1

        item_dict = {
            "id": inc.id,
            "incident_id": inc.incident_id or f"INC-{inc.id}",
            "organization_id": inc.organization_id,
            "reported_by_id": inc.reported_by_id,
            "severity": inc.severity,
            "status": inc.status,
            "report_type": inc.report_type,
            "detection_event_ref": inc.detection_event_ref,
            "model_version": inc.model_version,
            "predicted_class": inc.predicted_class,
            "risk_score": inc.risk_score,
            "admin_decision": inc.admin_decision,
            "admin_notes": inc.admin_notes,
            "verified_by_id": inc.verified_by_id,
            "verified_at": inc.verified_at,
            "created_at": inc.created_at,
            "resolved_at": inc.resolved_at,
            "reports_count": rep_count,
            "escalated_by_id": inc.escalated_by_id,
            "escalated_at": inc.escalated_at,
            "manager_notes": inc.manager_notes,
        }
        response_items.append(IncidentResponse(**item_dict))

    return response_items


@router.get("/stats", response_model=Dict[str, Any])
async def incident_stats(
    current_user: User = Depends(require_role(Role.ADMIN)),
    db: AsyncSession = Depends(get_db),
):
    """Org-wide incident counts for the admin analytics dashboard."""
    org_id = current_user.organization_id or "org_default"
    base = select(Incident)
    if current_user.role not in ("super_admin", "global_admin"):
        base = base.where(Incident.organization_id == org_id)

    async def _count(*where):
        q = base.with_only_columns(func.count(Incident.id))
        for w in where:
            q = q.where(w)
        res = await db.execute(q)
        return res.scalar_one_or_none() or 0

    total = await _count()
    open_count = await _count(Incident.status == "open")
    investigating = await _count(Incident.status == "investigating")
    escalated = await _count(Incident.status == "escalated")
    resolved = await _count(Incident.status == "resolved")
    false_positive = await _count(Incident.status == "false_positive")
    confirmed = await _count(Incident.admin_decision.in_(["CONFIRMED_PHISHING", "FALSE_NEGATIVE"]))

    dept_query = (
        select(Department.name, func.count(func.distinct(Incident.id)))
        .select_from(Incident)
        .join(IncidentReport, IncidentReport.incident_id == Incident.id)
        .join(Department, Department.id == IncidentReport.department_id)
        .where(Incident.organization_id == org_id)
        .group_by(Department.name)
    )
    dept_res = await db.execute(dept_query)
    by_department = {name: count for name, count in dept_res.all()}

    # Last 14 days, one point per day, so the admin dashboard can chart incident volume over time
    trend_query = (
        select(func.date(Incident.created_at), func.count(Incident.id))
        .where(
            Incident.organization_id == org_id,
            Incident.created_at >= (datetime.utcnow() - timedelta(days=14)),
        )
        .group_by(func.date(Incident.created_at))
        .order_by(func.date(Incident.created_at))
    )
    trend_res = await db.execute(trend_query)
    daily_trend = [{"date": str(d), "count": c} for d, c in trend_res.all()]

    # Which department reported the most incidents, for a plain-language callout on the dashboard
    top_department = None
    if by_department:
        top_department = max(by_department.items(), key=lambda kv: kv[1])[0]

    return {
        "total": total,
        "open": open_count,
        "investigating": investigating,
        "escalated": escalated,
        "resolved": resolved,
        "false_positive": false_positive,
        "confirmed_threats": confirmed,
        "by_department": by_department,
        "daily_trend": daily_trend,
        "top_department": top_department,
    }


@router.get("/{incident_id}", response_model=Dict[str, Any])
async def get_incident_detail(
    incident_id: str,
    current_user: User = Depends(require_role(Role.ADMIN)),
    db: AsyncSession = Depends(get_db),
):
    """
    Get detailed breakdown of a specific incident and all linked employee reports.
    Strictly isolated by organization.
    """
    org_id = current_user.organization_id or "org_default"

    query = select(Incident).where(
        or_(Incident.incident_id == incident_id, Incident.id == (int(incident_id) if incident_id.isdigit() else -1))
    )
    if current_user.role not in ("super_admin", "global_admin"):
        query = query.where(Incident.organization_id == org_id)

    result = await db.execute(query)
    inc = result.scalar_one_or_none()
    if not inc:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Incident not found.")

    # Fetch linked reports
    reports_query = select(IncidentReport).where(IncidentReport.incident_id == inc.id).order_by(IncidentReport.created_at.desc())
    reports_res = await db.execute(reports_query)
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
    ))

    return {
        "incident": incident_response,
        "reports": [redact_incident_report(r) for r in reports]
    }


@router.post("/{incident_id}/verify", response_model=Dict[str, Any])
async def verify_incident(
    incident_id: str,
    payload: IncidentVerifyRequest,
    current_user: User = Depends(require_role(Role.ADMIN)),
    db: AsyncSession = Depends(get_db),
):
    """
    Admin verifies an employee report / incident.
    Optionally converts verified feedback into a deduplicated Training Candidate.
    """
    org_id = current_user.organization_id or "org_default"

    query = select(Incident).where(
        or_(Incident.incident_id == incident_id, Incident.id == (int(incident_id) if incident_id.isdigit() else -1))
    )
    if current_user.role not in ("super_admin", "global_admin"):
        query = query.where(Incident.organization_id == org_id)

    result = await db.execute(query)
    inc = result.scalar_one_or_none()
    if not inc:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Incident not found.")

    decision_upper = payload.decision.upper()
    valid_decisions = ["FALSE_POSITIVE", "FALSE_NEGATIVE", "CONFIRMED_PHISHING", "BENIGN", "INVALID", "NEEDS_INVESTIGATION"]
    if decision_upper not in valid_decisions:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=f"Invalid decision. Must be one of {valid_decisions}")

    inc.admin_decision = decision_upper
    inc.admin_notes = payload.admin_notes
    inc.verified_by_id = current_user.id
    inc.verified_at = datetime.utcnow()

    # Update incident status
    if decision_upper in ("FALSE_POSITIVE", "BENIGN"):
        inc.status = "false_positive" if decision_upper == "FALSE_POSITIVE" else "resolved"
    elif decision_upper in ("CONFIRMED_PHISHING", "FALSE_NEGATIVE"):
        inc.status = "resolved"
    elif decision_upper == "INVALID":
        inc.status = "resolved"
    else:
        inc.status = "investigating"

    inc.resolved_at = datetime.utcnow()
    inc.resolved_by_id = current_user.id

    # Update status on all linked reports
    # A report is "verified" only if the employee's claim matches the admin's ruling;
    # a report that contradicts it (e.g. "false positive" on a confirmed phish) is "rejected".
    says_threat = {"phishing", "false_negative"}
    says_safe = {"false_positive", "benign"}
    ruled_threat = decision_upper in ("CONFIRMED_PHISHING", "FALSE_NEGATIVE")
    ruled_safe = decision_upper in ("FALSE_POSITIVE", "BENIGN")
    linked_reports_res = await db.execute(select(IncidentReport).where(IncidentReport.incident_id == inc.id))
    for rep in linked_reports_res.scalars().all():
        if decision_upper == "NEEDS_INVESTIGATION":
            rep.status = "under_review"
        elif decision_upper == "INVALID":
            rep.status = "rejected"
        elif ruled_threat and rep.report_type in says_safe:
            rep.status = "rejected"
        elif ruled_safe and rep.report_type in says_threat:
            rep.status = "rejected"
        else:
            rep.status = "verified"

    candidate_created = False
    candidate_id = None

    # Convert to Training Candidate if decision is a valid ground truth sample
    if payload.create_training_candidate and decision_upper in ("FALSE_POSITIVE", "FALSE_NEGATIVE", "CONFIRMED_PHISHING", "BENIGN"):
        # Determine model type (url, email, text, image)
        raw_ref = inc.detection_event_ref or "sample"
        first_report_res = await db.execute(
            select(IncidentReport.target_type)
            .where(IncidentReport.incident_id == inc.id)
            .order_by(IncidentReport.created_at.asc())
            .limit(1)
        )
        target_type = (first_report_res.scalar_one_or_none() or "url").lower()
        model_type = {"url": "url", "email": "email", "text": "text", "image": "image"}.get(target_type, "url")

        # Determine ground truth label
        if decision_upper in ("FALSE_POSITIVE", "BENIGN"):
            label = "benign"
        else: # CONFIRMED_PHISHING, FALSE_NEGATIVE
            label = "phishing"

        fp = _fingerprint_ref(raw_ref)

        # Check deduplication index for this org
        existing_tc_res = await db.execute(
            select(TrainingCandidate).where(
                TrainingCandidate.organization_id == inc.organization_id,
                TrainingCandidate.content_fingerprint == fp
            )
        )
        existing_tc = existing_tc_res.scalar_one_or_none()

        if not existing_tc:
            cand_code = f"TC-{uuid.uuid4().hex[:8].upper()}"
            candidate = TrainingCandidate(
                candidate_id=cand_code,
                organization_id=inc.organization_id or "org_default",
                incident_id=inc.id,
                model_type=model_type,
                label=label,
                content_fingerprint=fp,
                sample_data={
                    "target_ref": raw_ref,
                    "model_version": inc.model_version,
                    "predicted_class": inc.predicted_class,
                    "risk_score": inc.risk_score,
                    "verified_label": label,
                    "admin_notes": payload.admin_notes
                },
                verified_by_id=current_user.id,
                status="pending"
            )
            db.add(candidate)
            candidate_created = True
            candidate_id = cand_code

    # Audit Log
    audit_entry = AuditLog(
        organization_id=inc.organization_id or "org_default",
        actor_email=current_user.email,
        action="INCIDENT_VERIFIED",
        module="admin_verification",
        target=f"Incident {inc.incident_id or inc.id} verified as {decision_upper}",
        result="success",
        ip_address="127.0.0.1"
    )
    db.add(audit_entry)

    await db.commit()

    return {
        "status": "success",
        "incident_id": inc.incident_id or f"INC-{inc.id}",
        "admin_decision": decision_upper,
        "training_candidate_created": candidate_created,
        "training_candidate_id": candidate_id
    }
