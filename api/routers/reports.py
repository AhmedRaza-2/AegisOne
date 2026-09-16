"""
AegisOne API — Employee Reporting Router (Phase 1)
=================================================
Allows employees to report incorrect detections, false positives, false negatives,
phishing, or benign findings. Correlates employee feedback into Incident records
scoped strictly by organization.
"""
import uuid
import logging
from typing import List, Optional
from datetime import datetime

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.future import select
from sqlalchemy import func

from api.database.db import get_db
from api.database.models import User, Incident, IncidentReport, AuditLog
from api.database.schemas import EmployeeReportCreate, IncidentReportResponse
from api.dependencies import get_current_user

logger = logging.getLogger("aegisone.reports")

router = APIRouter(prefix="/reports", tags=["Employee Reporting"])


@router.post("", response_model=IncidentReportResponse, status_code=status.HTTP_201_CREATED)
async def submit_report(
    payload: EmployeeReportCreate,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """
    Employee submits feedback for a detection or security event.
    Automatically correlates with an Incident within the user's organization.
    """
    if not current_user.id:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Authentication required to submit security reports."
        )

    org_id = current_user.organization_id or "org_default"
    report_id = f"REP-{uuid.uuid4().hex[:8].upper()}"
    target_ref = payload.target_ref or payload.scan_id or payload.event_id or "Unknown Target"

    # Correlation check: look for an existing OPEN or INVESTIGATING incident in the same org with matching reference
    existing_incident = None
    if target_ref and target_ref != "Unknown Target":
        query = (
            select(Incident)
            .where(
                Incident.organization_id == org_id,
                Incident.status.in_(["open", "investigating"]),
                Incident.detection_event_ref == target_ref
            )
            .order_by(Incident.created_at.desc())
        )
        result = await db.execute(query)
        existing_incident = result.scalar_one_or_none()

    if not existing_incident:
        incident_id = f"INC-{uuid.uuid4().hex[:8].upper()}"
        severity = "high" if (payload.risk_score and payload.risk_score >= 75) else ("medium" if (payload.risk_score and payload.risk_score >= 40) else "low")
        
        incident = Incident(
            incident_id=incident_id,
            organization_id=org_id,
            reported_by_id=current_user.id,
            severity=severity,
            status="open",
            report_type=payload.report_type,
            detection_event_ref=target_ref,
            model_version=payload.model_version,
            predicted_class=payload.predicted_class,
            risk_score=payload.risk_score,
            notes=payload.user_notes,
        )
        db.add(incident)
        await db.flush()  # get incident.id
        existing_incident = incident

    # Create IncidentReport
    report = IncidentReport(
        report_id=report_id,
        incident_id=existing_incident.id,
        user_id=current_user.id,
        organization_id=org_id,
        report_type=payload.report_type,
        target_type=payload.target_type,
        target_ref=target_ref,
        scan_id=payload.scan_id,
        event_id=payload.event_id,
        model_version=payload.model_version,
        predicted_class=payload.predicted_class,
        risk_score=payload.risk_score,
        user_notes=payload.user_notes,
        status="submitted"
    )
    db.add(report)

    # Audit log
    audit_entry = AuditLog(
        organization_id=org_id,
        actor_email=current_user.email,
        action="REPORT_SUBMITTED",
        module="reporting",
        target=f"Report {report_id} -> Incident {existing_incident.incident_id or existing_incident.id}",
        result="success",
        ip_address="127.0.0.1"
    )
    db.add(audit_entry)

    await db.commit()
    await db.refresh(report)

    logger.info(f"Report {report_id} submitted by {current_user.email} (Org: {org_id})")
    return report


@router.get("/my-reports", response_model=List[IncidentReportResponse])
async def get_my_reports(
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """
    Allows employee to view the status of their own submitted reports.
    Strictly isolated to current_user.id.
    """
    if not current_user.id:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Authentication required."
        )

    query = (
        select(IncidentReport)
        .where(
            IncidentReport.user_id == current_user.id,
            IncidentReport.organization_id == (current_user.organization_id or "org_default")
        )
        .order_by(IncidentReport.created_at.desc())
    )
    result = await db.execute(query)
    return result.scalars().all()
