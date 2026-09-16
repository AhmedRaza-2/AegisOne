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
from datetime import datetime

from fastapi import APIRouter, Depends, HTTPException, status, Query
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.future import select
from sqlalchemy import func, or_, and_

from api.database.db import get_db
from api.database.models import User, Incident, IncidentReport, TrainingCandidate, AuditLog
from api.database.schemas import (
    IncidentResponse,
    IncidentVerifyRequest,
    IncidentReportResponse,
    TrainingCandidateSummary
)
from api.auth.roles import Role, require_role

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
    current_user: User = Depends(require_role(Role.OFFICE_ADMIN)),
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
            "reports_count": rep_count
        }
        response_items.append(IncidentResponse(**item_dict))

    return response_items


@router.get("/{incident_id}", response_model=Dict[str, Any])
async def get_incident_detail(
    incident_id: str,
    current_user: User = Depends(require_role(Role.OFFICE_ADMIN)),
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

    return {
        "incident": IncidentResponse(
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
            reports_count=len(reports) or 1
        ),
        "reports": [
            IncidentReportResponse.model_validate(r) for r in reports
        ]
    }


@router.post("/{incident_id}/verify", response_model=Dict[str, Any])
async def verify_incident(
    incident_id: str,
    payload: IncidentVerifyRequest,
    current_user: User = Depends(require_role(Role.OFFICE_ADMIN)),
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
    report_status = "verified" if decision_upper in ("FALSE_POSITIVE", "FALSE_NEGATIVE", "CONFIRMED_PHISHING", "BENIGN") else "rejected"
    linked_reports_res = await db.execute(select(IncidentReport).where(IncidentReport.incident_id == inc.id))
    for rep in linked_reports_res.scalars().all():
        rep.status = report_status

    candidate_created = False
    candidate_id = None

    # Convert to Training Candidate if decision is a valid ground truth sample
    if payload.create_training_candidate and decision_upper in ("FALSE_POSITIVE", "FALSE_NEGATIVE", "CONFIRMED_PHISHING", "BENIGN"):
        # Determine model type (url, email, text, image)
        raw_ref = inc.detection_event_ref or "sample"
        model_type = "url"
        if "email" in raw_ref.lower() or inc.report_type == "email":
            model_type = "email"
        elif "image" in raw_ref.lower():
            model_type = "image"
        elif "text" in raw_ref.lower():
            model_type = "text"

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
