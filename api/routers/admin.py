"""
AegisOne API — Admin Router
============================
Real-time and pre-aggregated statistics for the dashboard.
Uses DashboardStatistic for fast today-view; falls back to live queries.
"""
import json
from datetime import date, datetime, timezone
from fastapi import APIRouter, Depends, BackgroundTasks, Query, HTTPException
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, func, update, cast, Date

from api.database.db import get_db
from api.database.models import (
    Department,
    User,
    Device,
    WebsiteScan,
    SecurityEvent,
    DownloadEvent,
    CredentialEvent,
    ManualScan,
    ThreatReport,
    DashboardStatistic,
    AuditLog,
    Policy,
)
from api.database.schemas import AdminStatsResponse
from api.auth.roles import require_role, Role
from api.services.model_orchestrator import get_model_status

router = APIRouter(prefix="/admin", tags=["Admin"])


# ── Shared scope helper ───────────────────────────────────────────────────────

def _org_scope(query, model, user):
    """Restrict a query to the user's org unless they're super_admin."""
    if user.role != Role.SUPER_ADMIN.value:
        org_id = getattr(user, "organization_id", None) or "org_default"
        query = query.where(getattr(model, "organization_id") == org_id)

        # RBAC: Manager can only access their own department
        if user.role == Role.MANAGER.value:
            dept_id = getattr(user, "department_id", None)
            dept_str = getattr(user, "department", None)
            
            # If the model has department directly (like User)
            if hasattr(model, "department_id") or hasattr(model, "department"):
                condition = None
                if hasattr(model, "department") and dept_str:
                    condition = getattr(model, "department") == dept_str
                elif hasattr(model, "department_id") and dept_id is not None:
                    condition = getattr(model, "department_id") == dept_id
                    
                if condition is not None:
                    query = query.where(condition)
                    # Filter out higher privileged roles for managers
                    if hasattr(model, "role"):
                        query = query.where(getattr(model, "role").in_([Role.EMPLOYEE.value, Role.MANAGER.value]))
                else:
                    query = query.where(False)
            
            # If the model has user_id but no department, we must join the User table to filter!
            elif hasattr(model, "user_id"):
                from api.database.models import User
                from sqlalchemy import select as sa_select
                from sqlalchemy import cast, String
                
                user_condition = None
                if dept_str:
                    user_condition = User.department == dept_str
                elif dept_id is not None:
                    user_condition = User.department_id == dept_id
                
                if user_condition is not None:
                    query = query.where(cast(getattr(model, "user_id"), String).in_(
                        sa_select(cast(User.id, String)).where(user_condition)
                    ))
                else:
                    query = query.where(False)
            
            # If a table has neither department nor user_id, a manager cannot access it at all
            else:
                query = query.where(False)

    return query


# ── Daily stats aggregation ───────────────────────────────────────────────────

async def _compute_and_store_daily_stats(db: AsyncSession, org_id: str, target_date: date):
    """
    Compute real aggregates from the event tables for `target_date`
    and upsert them into dashboard_statistics.
    Called as a background task from /admin/stats/refresh.
    """
    def today_filter(col):
        return cast(col, Date) == target_date

    # Scan counts
    total_scans = await db.scalar(
        select(func.count(WebsiteScan.id))
        .where(WebsiteScan.organization_id == org_id)
        .where(today_filter(WebsiteScan.created_at))
    ) or 0

    threats_blocked = await db.scalar(
        select(func.count(WebsiteScan.id))
        .where(WebsiteScan.organization_id == org_id)
        .where(WebsiteScan.decision == "block")
        .where(today_filter(WebsiteScan.created_at))
    ) or 0

    threats_warned = await db.scalar(
        select(func.count(WebsiteScan.id))
        .where(WebsiteScan.organization_id == org_id)
        .where(WebsiteScan.decision == "warn")
        .where(today_filter(WebsiteScan.created_at))
    ) or 0

    safe_scans = total_scans - threats_blocked - threats_warned

    # Module-specific
    cred_attempts = await db.scalar(
        select(func.count(CredentialEvent.id))
        .where(CredentialEvent.organization_id == org_id)
        .where(today_filter(CredentialEvent.created_at))
    ) or 0

    dl_blocked = await db.scalar(
        select(func.count(DownloadEvent.id))
        .where(DownloadEvent.organization_id == org_id)
        .where(DownloadEvent.decision == "block")
        .where(today_filter(DownloadEvent.created_at))
    ) or 0

    dl_scanned = await db.scalar(
        select(func.count(DownloadEvent.id))
        .where(DownloadEvent.organization_id == org_id)
        .where(today_filter(DownloadEvent.created_at))
    ) or 0

    manual_count = await db.scalar(
        select(func.count(ManualScan.id))
        .where(ManualScan.organization_id == org_id)
        .where(today_filter(ManualScan.created_at))
    ) or 0

    reports_today = await db.scalar(
        select(func.count(ThreatReport.id))
        .where(ThreatReport.organization_id == org_id)
        .where(today_filter(ThreatReport.created_at))
    ) or 0

    # Top threat type for the day
    top_row = (await db.execute(
        select(SecurityEvent.event_type, func.count(SecurityEvent.id).label("cnt"))
        .where(SecurityEvent.organization_id == org_id)
        .where(today_filter(SecurityEvent.timestamp))
        .where(SecurityEvent.severity.in_(["medium", "high"]))
        .group_by(SecurityEvent.event_type)
        .order_by(func.count(SecurityEvent.id).desc())
        .limit(1)
    )).first()
    top_threat = top_row[0] if top_row else None

    # Upsert
    existing = await db.scalar(
        select(DashboardStatistic)
        .where(DashboardStatistic.organization_id == org_id)
        .where(DashboardStatistic.date == target_date)
    )
    if existing:
        existing.total_scans         = total_scans
        existing.threats_blocked     = threats_blocked
        existing.threats_warned      = threats_warned
        existing.safe_scans          = max(safe_scans, 0)
        existing.credential_attempts = cred_attempts
        existing.downloads_blocked   = dl_blocked
        existing.downloads_scanned   = dl_scanned
        existing.manual_scans        = manual_count
        existing.threat_reports      = reports_today
        existing.top_threat_type     = top_threat
    else:
        db.add(DashboardStatistic(
            organization_id    = org_id,
            date               = target_date,
            total_scans        = total_scans,
            threats_blocked    = threats_blocked,
            threats_warned     = threats_warned,
            safe_scans         = max(safe_scans, 0),
            credential_attempts= cred_attempts,
            downloads_blocked  = dl_blocked,
            downloads_scanned  = dl_scanned,
            manual_scans       = manual_count,
            threat_reports     = reports_today,
            top_threat_type    = top_threat,
        ))

    await db.commit()


# ── /stats ────────────────────────────────────────────────────────────────────

@router.get("/stats", response_model=AdminStatsResponse)
async def get_stats(
    time_range: str = Query("24h"),
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(require_role(Role.MANAGER)),
):
    """
    Real-time admin statistics.
    Today's view reads from dashboard_statistics (fast pre-aggregate).
    All-time totals are computed live from the event tables.
    """
    org_id   = getattr(current_user, "organization_id", None) or "org_default"
    is_super = current_user.role == Role.SUPER_ADMIN.value
    is_manager = current_user.role == Role.MANAGER.value

    from datetime import datetime, timedelta, date
    now = datetime.utcnow()
    
    if time_range == "24h":
        start_time = now - timedelta(hours=24)
    elif time_range == "7d":
        start_time = now - timedelta(days=7)
    elif time_range == "30d":
        start_time = now - timedelta(days=30)
    else:
        start_time = None

    # ── 1. Scans in the selected window ─────────────
    scans_q = select(func.count(WebsiteScan.id))
    if start_time:
        scans_q = scans_q.where(WebsiteScan.created_at >= start_time)
    scans_today = await db.scalar(_org_scope(scans_q, WebsiteScan, current_user)) or 0

    ev_q = select(func.count(SecurityEvent.id))
    if start_time:
        ev_q = ev_q.where(SecurityEvent.timestamp >= start_time)
    ev_today = await db.scalar(_org_scope(ev_q, SecurityEvent, current_user)) or 0

    scans_today   = scans_today + ev_today

    threats_q = select(func.count(WebsiteScan.id)).where(WebsiteScan.decision.in_(["warn", "block"]))
    if start_time:
        threats_q = threats_q.where(WebsiteScan.created_at >= start_time)
    threats_today = await db.scalar(_org_scope(threats_q, WebsiteScan, current_user)) or 0

    # ── 2. Totals ────────────────────────────────────────────────────
    total_users = await db.scalar(
        _org_scope(select(func.count(User.id)), User, current_user)
    ) or 0

    total_scans = await db.scalar(
        _org_scope(select(func.count(WebsiteScan.id)), WebsiteScan, current_user)
    ) or 0

    threats_detected = await db.scalar(
        _org_scope(
            select(func.count(WebsiteScan.id))
            .where(WebsiteScan.decision.in_(["warn", "block"])),
            WebsiteScan, current_user,
        )
    ) or 0

    active_devices = await db.scalar(
        _org_scope(
            select(func.count(Device.id)).where(Device.status == "active"),
            Device, current_user,
        )
    ) or 0

    threat_reports_pending = await db.scalar(
        _org_scope(
            select(func.count(ThreatReport.id))
            .where(ThreatReport.status == "submitted"),
            ThreatReport, current_user,
        )
    ) or 0

    # ── 3. Simplified Threat distribution categories ──────────────────────────
    from sqlalchemy import case
    threat_dist_q = select(
        func.sum(case(((WebsiteScan.decision == "safe") | (WebsiteScan.decision == "allow"), 1), else_=0)).label("safe"),
        func.sum(case(((WebsiteScan.decision.in_(["warn", "block"])) & (WebsiteScan.threat_type == "phishing"), 1), else_=0)).label("phishing"),
        func.sum(case(((WebsiteScan.decision.in_(["warn", "block"])) & (WebsiteScan.threat_type.in_(["malware", "defacement", "malicious"])), 1), else_=0)).label("malware")
    )
    if start_time:
        threat_dist_q = threat_dist_q.where(WebsiteScan.created_at >= start_time)
        
    threat_row = (await db.execute(_org_scope(threat_dist_q, WebsiteScan, current_user))).first()
    top_threat_types = {
        "Safe Scans": 0,
        "Phishing": 0,
        "Malware": 0
    }
    if threat_row:
        top_threat_types["Safe Scans"] = getattr(threat_row, "safe", 0) or 0
        top_threat_types["Phishing"] = getattr(threat_row, "phishing", 0) or 0
        top_threat_types["Malware"] = getattr(threat_row, "malware", 0) or 0

    # ── 4. Severity Distribution ──────────────────────────────────────────────
    sev_q = _org_scope(
        select(SecurityEvent.severity, func.count(SecurityEvent.id).label("cnt"))
        .group_by(SecurityEvent.severity),
        SecurityEvent, current_user,
    )
    if start_time:
        sev_q = sev_q.where(SecurityEvent.timestamp >= start_time)
    sev_rows = (await db.execute(sev_q)).all()
    events_by_severity: dict[str, int] = {row[0]: row[1] for row in sev_rows if row[0]}

    # ── 5. Supplementary counters ─────────────────────────────────────────────
    cred_q = select(func.count(CredentialEvent.id))
    if start_time:
        cred_q = cred_q.where(CredentialEvent.created_at >= start_time)
    cred_total = await db.scalar(_org_scope(cred_q, CredentialEvent, current_user)) or 0

    dl_q = select(func.count(DownloadEvent.id))
    if start_time:
        dl_q = dl_q.where(DownloadEvent.created_at >= start_time)
    dl_total = await db.scalar(_org_scope(dl_q, DownloadEvent, current_user)) or 0

    # ── 6. Model status ───────────────────────────────────────────────────────
    statuses     = get_model_status()
    model_status = {k: v["loaded"] for k, v in statuses.items()}

    # ── 7. Daily Trend (Dynamic based on time_range) ──────────────────────────
    daily_trend = []
    if time_range == "24h":
        start_time = datetime.utcnow() - timedelta(hours=24)
        trend_q = select(
            WebsiteScan.created_at,
            WebsiteScan.decision
        ).where(WebsiteScan.created_at >= start_time)
        trend_q = _org_scope(trend_q, WebsiteScan, current_user)
        scans_list = (await db.execute(trend_q)).all()

        # Pre-populate 24 hourly buckets
        hourly_buckets = {}
        for i in range(23, -1, -1):
            t = datetime.utcnow() - timedelta(hours=i)
            key = t.replace(minute=0, second=0, microsecond=0)
            hourly_buckets[key] = {"scans": 0, "threats": 0}

        for scan in scans_list:
            dt = scan.created_at.replace(minute=0, second=0, microsecond=0)
            if dt in hourly_buckets:
                hourly_buckets[dt]["scans"] += 1
                if scan.decision in ["warn", "block"]:
                    hourly_buckets[dt]["threats"] += 1

        for dt, bucket in sorted(hourly_buckets.items()):
            daily_trend.append({
                "date": dt.strftime("%I %p"),
                "scans": bucket["scans"],
                "safe": max(0, bucket["scans"] - bucket["threats"]),
                "threats": bucket["threats"],
                "phishing": bucket["threats"],
                "malware": 0
            })
    else:
        days_count = 7 if time_range == "7d" else 30
        start_date = date.today() - timedelta(days=days_count)
        from sqlalchemy import case

        trend_q = select(
            cast(WebsiteScan.created_at, Date).label("day"),
            func.count(WebsiteScan.id).label("scans"),
            func.sum(case((WebsiteScan.decision.in_(["warn", "block"]), 1), else_=0)).label("threats")
        ).where(cast(WebsiteScan.created_at, Date) >= start_date).group_by(cast(WebsiteScan.created_at, Date))
        
        trend_q = _org_scope(trend_q, WebsiteScan, current_user)
        trend_rows = (await db.execute(trend_q)).all()
        trend_map = {row.day: (row.scans, int(row.threats or 0)) for row in trend_rows}

        for i in range(days_count - 1, -1, -1):
            target_d = date.today() - timedelta(days=i)
            scans_count, threats_count = trend_map.get(target_d, (0, 0))
            
            daily_trend.append({
                "date": target_d.strftime("%b %d") if time_range == "30d" else target_d.strftime("%a"),
                "scans": scans_count,
                "safe": max(0, scans_count - threats_count),
                "threats": threats_count,
                "phishing": threats_count,
                "malware": 0
            })

    return AdminStatsResponse(
        total_users=total_users,
        total_scans=total_scans,
        scans_today=scans_today,
        threats_detected=threats_detected,
        threats_today=threats_today,
        model_status=model_status,
        top_threat_types=top_threat_types,
        active_devices=active_devices,
        threat_reports_pending=threat_reports_pending,
        events_by_severity=events_by_severity,
        credential_events_total=cred_total,
        download_events_total=dl_total,
        hover_scans_total=0,  # queried separately via /admin/events
        daily_trend=daily_trend,
    )


# ── /stats/refresh ────────────────────────────────────────────────────────────

@router.post("/stats/refresh")
async def refresh_daily_stats(
    bg_tasks: BackgroundTasks,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(require_role(Role.MANAGER)),
):
    """
    Trigger re-computation of today's pre-aggregated DashboardStatistic row.
    Safe to call anytime — runs as a background task.
    """
    org_id = getattr(current_user, "organization_id", None) or "org_default"
    bg_tasks.add_task(_compute_and_store_daily_stats, db, org_id, date.today())
    return {"status": "refresh queued", "date": date.today().isoformat(), "org_id": org_id}


# ── /events ───────────────────────────────────────────────────────────────────

@router.get("/events")
async def get_events(
    page:       int       = 1,
    page_size:  int       = 50,
    severity:   str | None = None,
    event_type: str | None = None,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(require_role(Role.MANAGER)),
):
    """Paginated security event timeline for the dashboard."""
    q = _org_scope(
        select(SecurityEvent).order_by(SecurityEvent.timestamp.desc()),
        SecurityEvent, current_user,
    )
    if severity:
        q = q.where(SecurityEvent.severity == severity)
    if event_type:
        q = q.where(SecurityEvent.event_type == event_type)

    rows = (await db.execute(q.offset((page - 1) * page_size).limit(page_size))).scalars().all()

    return {
        "page": page,
        "page_size": page_size,
        "events": [
            {
                "event_id":   r.event_id,
                "event_type": r.event_type,
                "severity":   r.severity,
                "module":     r.module,
                "decision":   r.decision,
                "risk_score": r.risk_score,
                "url":        r.url,
                "domain":     r.domain,
                "threat_type": r.threat_type,
                "timestamp":  str(r.timestamp),
                "device_id":  r.device_id,
            }
            for r in rows
        ],
    }


# ── /scans ────────────────────────────────────────────────────────────────────

@router.get("/scans")
async def get_scans(
    page:      int       = 1,
    page_size: int       = 50,
    verdict:   str | None = None,   # safe | warning | danger
    scan_type: str | None = None,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(require_role(Role.MANAGER)),
):
    """Paginated website scan history."""
    q = _org_scope(
        select(WebsiteScan).order_by(WebsiteScan.created_at.desc()),
        WebsiteScan, current_user,
    )
    if verdict:
        q = q.where(WebsiteScan.verdict == verdict)
    if scan_type:
        q = q.where(WebsiteScan.scan_type == scan_type)

    rows = (await db.execute(q.offset((page - 1) * page_size).limit(page_size))).scalars().all()

    return {
        "page": page,
        "page_size": page_size,
        "scans": [
            {
                "scan_id":    r.scan_id,
                "scan_type":  r.scan_type,
                "url":        r.url,
                "domain":     r.domain,
                "risk_score": r.risk_score,
                "confidence": r.confidence,
                "verdict":    r.verdict,
                "decision":   r.decision,
                "threat_type": r.threat_type,
                "top_factors": r.top_factors,
                "duration_ms": r.scan_duration_ms,
                "created_at":  str(r.created_at),
            }
            for r in rows
        ],
    }


# ── /devices ──────────────────────────────────────────────────────────────────

@router.get("/devices")
async def get_devices(
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(require_role(Role.MANAGER)),
):
    """Registered device roster with last-seen timestamps."""
    q = _org_scope(
        select(Device).order_by(Device.last_seen.desc()).limit(500),
        Device, current_user,
    )
    rows = (await db.execute(q)).scalars().all()
    return {
        "devices": [
            {
                "device_id":         r.device_id,
                "browser":           r.browser,
                "browser_version":   r.browser_version,
                "os":                r.os,
                "extension_version": r.extension_version,
                "status":            r.status,
                "last_seen":         str(r.last_seen),
                "organization_id":   r.organization_id,
            }
            for r in rows
        ]
    }


# ── /reports ──────────────────────────────────────────────────────────────────

@router.get("/reports")
async def get_threat_reports(
    status_filter: str | None = None,
    page:          int        = 1,
    page_size:     int        = 50,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(require_role(Role.MANAGER)),
):
    """Paginated threat report queue (Module 15)."""
    q = _org_scope(
        select(ThreatReport).order_by(ThreatReport.created_at.desc()),
        ThreatReport, current_user,
    )
    if status_filter:
        q = q.where(ThreatReport.status == status_filter)

    rows = (await db.execute(q.offset((page - 1) * page_size).limit(page_size))).scalars().all()

    return {
        "page": page,
        "page_size": page_size,
        "reports": [
            {
                "report_id":       r.report_id,
                "website":         r.website,
                "domain":          r.domain,
                "reason":          r.reason,
                "status":          r.status,
                "analyst":         r.analyst,
                "resolution_note": r.resolution_note,
                "created_at":      str(r.created_at),
            }
            for r in rows
        ],
    }


# ── /policies ─────────────────────────────────────────────────────────────────

@router.get("/policies")
async def get_policies(
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(require_role(Role.MANAGER)),
):
    """Return the active policy list for the org (Module 16)."""
    org_id = getattr(current_user, "organization_id", None) or "org_default"
    rows = (await db.execute(
        select(Policy)
        .where(Policy.organization_id == org_id, Policy.enabled == True)  # noqa: E712
        .order_by(Policy.priority.asc())
    )).scalars().all()

    return {
        "policies": [
            {
                "id":           r.id,
                "policy_type":  r.policy_type,
                "value":        r.value,
                "action":       r.action,
                "scope":        r.scope,
                "scope_value":  r.scope_value,
                "priority":     r.priority,
                "created_at":   str(r.created_at),
            }
            for r in rows
        ]
    }


# ── /audit ────────────────────────────────────────────────────────────────────

@router.get("/audit")
async def get_audit_logs(
    page:      int = 1,
    page_size: int = 100,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(require_role(Role.SUPER_ADMIN)),
):
    """Immutable audit log. Super admin only (Module 19)."""
    org_id = getattr(current_user, "organization_id", None) or "org_default"

    rows = (await db.execute(
        select(AuditLog)
        .where(AuditLog.organization_id == org_id)
        .order_by(AuditLog.timestamp.desc())
        .offset((page - 1) * page_size)
        .limit(page_size)
    )).scalars().all()

    return {
        "page": page,
        "page_size": page_size,
        "logs": [
            {
                "actor":     r.actor_email,
                "action":    r.action,
                "module":    r.module,
                "target":    r.target,
                "result":    r.result,
                "timestamp": str(r.timestamp),
            }
            for r in rows
        ],
    }


# ── User Approvals ────────────────────────────────────────────────────────────

from pydantic import BaseModel
from fastapi import HTTPException

class StatusUpdateRequest(BaseModel):
    status: str
    reason: str = None

@router.get("/users/pending")
async def get_pending_users(
    db: AsyncSession = Depends(get_db),
    user: User = Depends(require_role(Role.MANAGER))
):
    """Fetch all users awaiting approval."""
    # If the user is just an admin (not super_admin), restrict to their org
    query = select(User).where(User.account_status == "pending")
    query = _org_scope(query, User, user)
    
    result = await db.execute(query.order_by(User.created_at.desc()))
    users = result.scalars().all()
    
    return {
        "pending": [
            {
                "id": u.id,
                "email": u.email,
                "full_name": u.full_name,
                "department": u.department,
                "created_at": str(u.created_at)
            }
            for u in users
        ]
    }


@router.patch("/users/{user_id}/status")
async def update_user_status(
    user_id: int,
    req: StatusUpdateRequest,
    db: AsyncSession = Depends(get_db),
    admin: User = Depends(require_role(Role.MANAGER))
):
    """Approve, reject, or disable a user account."""
    if req.status not in ["approved", "rejected", "disabled", "pending"]:
        raise HTTPException(status_code=400, detail="Invalid status")
        
    result = await db.execute(select(User).where(User.id == user_id))
    user = result.scalar_one_or_none()
    
    if not user:
        raise HTTPException(status_code=404, detail="User not found")
        
    # Check permissions
    if admin.role not in ["super_admin", "global_admin"] and user.organization_id != admin.organization_id:
        raise HTTPException(status_code=403, detail="Cannot modify users outside your organization")
        
    # Prevent standard admins from modifying super admins
    if user.role in ["super_admin", "global_admin"] and admin.role not in ["super_admin", "global_admin"]:
        raise HTTPException(status_code=403, detail="Cannot modify super_admin accounts")

    user.account_status = req.status
    user.status_reason = req.reason
    user.approved_by = admin.id
    
    await db.commit()
    
    return {"message": f"User account {req.status}", "user_id": user_id, "status": req.status}


# ── Phase 2: User & Department CRUD ──────────────────────────────────────────

from api.auth.password import hash_password

class DepartmentCreate(BaseModel):
    name: str
    manager_id: int | None = None

class UserCreate(BaseModel):
    email: str
    full_name: str
    password: str
    role: str
    department_id: int | None = None

@router.get("/departments")
async def get_departments(
    db: AsyncSession = Depends(get_db),
    manager: User = Depends(require_role(Role.MANAGER))
):
    """List departments. Admin sees all, Manager sees all (View only)."""
    q = select(Department).where(Department.organization_id == manager.organization_id)
    rows = (await db.execute(q)).scalars().all()
    return {"departments": [{"id": r.id, "name": r.name, "manager_id": r.manager_id} for r in rows]}

@router.post("/departments")
async def create_department(
    req: DepartmentCreate,
    db: AsyncSession = Depends(get_db),
    admin: User = Depends(require_role(Role.ADMIN))
):
    """Create a department (Admin only)."""
    new_dept = Department(
        organization_id=admin.organization_id,
        name=req.name,
        manager_id=req.manager_id
    )
    db.add(new_dept)
    await db.commit()
    return {"status": "success", "department_id": new_dept.id}

@router.get("/users")
async def get_users(
    time_range: str = Query("24h"),
    db: AsyncSession = Depends(get_db),
    manager: User = Depends(require_role(Role.MANAGER))
):
    """List employees. Managers only see their own department."""
    org_id = getattr(manager, "organization_id", None) or "org_default"
    q = select(User).where(User.organization_id == org_id)
    if manager.role == Role.MANAGER.value:
        dept_id = manager.department_id
        dept_str = manager.department
        
        condition = None
        if dept_str:
            condition = User.department == dept_str
        elif dept_id is not None:
            condition = User.department_id == dept_id
            
        if condition is not None:
            q = q.where(condition)
        else:
            q = q.where(False)
            
        q = q.where(User.role.in_([Role.EMPLOYEE.value, Role.MANAGER.value]))
    
    rows = (await db.execute(q)).scalars().all()
    
    # Fetch real stats for these users
    user_ids = [r.id for r in rows]
    scan_stats = {}
    creds_map = {}
    if user_ids:
        from sqlalchemy import func, case
        from api.database.models import WebsiteScan, SecurityEvent
        from datetime import datetime, timezone, timedelta
        
        now = datetime.utcnow()
        if time_range == "24h":
            start_time = now - timedelta(hours=24)
        elif time_range == "7d":
            start_time = now - timedelta(days=7)
        elif time_range == "30d":
            start_time = now - timedelta(days=30)
        else:
            start_time = None
            
        today_start = start_time if start_time else (now - timedelta(days=30))
        
        stats_q = select(
            WebsiteScan.user_id,
            func.count(WebsiteScan.id).label('total_scans'),
            func.sum(case((WebsiteScan.decision.in_(["warn", "block"]), 1), else_=0)).label('threats'),
            func.sum(case((WebsiteScan.risk_score >= 75, 1), else_=0)).label('critical_count'),
            func.sum(case(((WebsiteScan.created_at >= today_start) & (WebsiteScan.decision == "warn"), 1), else_=0)).label('today_warns')
        ).where(WebsiteScan.user_id.in_(user_ids))
        
        if start_time:
            stats_q = stats_q.where(WebsiteScan.created_at >= start_time)
            
        stats_q = stats_q.group_by(WebsiteScan.user_id)
        
        stats_rows = (await db.execute(stats_q)).all()
        for s in stats_rows:
            scan_stats[s.user_id] = {
                "total_scans": s.total_scans,
                "threats": s.threats or 0,
                "critical_count": s.critical_count or 0,
                "today_warns": s.today_warns or 0
            }
            
        creds_q = select(
            SecurityEvent.user_id,
            func.count(SecurityEvent.id).label('today_creds')
        ).where(
            SecurityEvent.timestamp >= today_start,
            SecurityEvent.event_type == "credential_intercept",
            SecurityEvent.user_id.in_([str(uid) for uid in user_ids])
        ).group_by(SecurityEvent.user_id)
        
        creds_rows = (await db.execute(creds_q)).all()
        creds_map = {int(row.user_id): row.today_creds for row in creds_rows if row.user_id and row.user_id.isdigit()}

    users_response = []
    for r in rows:
        stats = scan_stats.get(r.id, {"total_scans": 0, "threats": 0, "critical_count": 0, "today_warns": 0})
        total_scans = stats["total_scans"]
        threats = stats["threats"]
        critical_count = stats["critical_count"]
        today_warns = stats["today_warns"]
        today_creds = creds_map.get(r.id, 0)
        
        # Match employee dashboard health score logic
        health_score = 100
        if critical_count > 0: health_score -= min(30, critical_count * 2)
        if today_warns > 0: health_score -= min(15, today_warns * 1)
        if today_creds > 0: health_score -= 10
        if health_score < 0: health_score = 0
        
        # Risk score is the inverse of health score for UI mapping (100 - risk_score = health_score)
        risk_score = 100 - health_score
        
        users_response.append({
            "id": r.id, 
            "email": r.email, 
            "full_name": r.full_name, 
            "role": r.role, 
            "department_id": r.department_id, 
            "department": r.department, 
            "account_status": r.account_status,
            "total_scans": total_scans,
            "threats": threats,
            "risk_score": risk_score
        })
        
    return {"users": users_response}

@router.post("/users")
async def create_user(
    req: UserCreate,
    db: AsyncSession = Depends(get_db),
    admin: User = Depends(require_role(Role.MANAGER))
):
    """Create a user. Managers can only create in their own department."""
    target_dept = req.department_id
    
    if admin.role == Role.MANAGER.value:
        target_dept = admin.department_id
        if req.role in [Role.ADMIN.value, Role.SUPER_ADMIN.value]:
            raise HTTPException(status_code=403, detail="Managers cannot create admin accounts.")
            
    new_user = User(
        organization_id=admin.organization_id,
        email=req.email,
        full_name=req.full_name,
        password_hash=hash_password(req.password),
        role=req.role,
        department_id=target_dept,
        account_status="active"
    )
    db.add(new_user)
    await db.commit()
    return {"status": "success", "user_id": new_user.id}

@router.put("/users/{user_id}/password")
async def reset_user_password(
    user_id: int,
    new_password: str,
    db: AsyncSession = Depends(get_db),
    admin: User = Depends(require_role(Role.MANAGER))
):
    """Force reset user password. Managers can only reset their own department."""
    q = select(User).where(User.id == user_id, User.organization_id == admin.organization_id)
    if admin.role == Role.MANAGER.value:
        q = q.where(User.department_id == admin.department_id)
        
    user = (await db.execute(q)).scalar_one_or_none()
    if not user:
        raise HTTPException(status_code=404, detail="User not found or access denied")
        
    user.password_hash = hash_password(new_password)
    await db.commit()
    return {"status": "success"}

@router.delete("/users/{user_id}")
async def delete_user(
    user_id: int,
    db: AsyncSession = Depends(get_db),
    admin: User = Depends(require_role(Role.MANAGER))
):
    """Delete a user. Managers can only delete in their own department."""
    q = select(User).where(User.id == user_id, User.organization_id == admin.organization_id)
    if admin.role == Role.MANAGER.value:
        q = q.where(User.department_id == admin.department_id)
        
    user = (await db.execute(q)).scalar_one_or_none()
    if not user:
        raise HTTPException(status_code=404, detail="User not found or access denied")
        
    if user.id == admin.id:
        raise HTTPException(status_code=400, detail="You cannot delete your own account")
        
    await db.delete(user)
    await db.commit()
    return {"status": "success"}

@router.put("/users/{user_id}/promote")
async def promote_user(
    user_id: int,
    db: AsyncSession = Depends(get_db),
    admin: User = Depends(require_role(Role.MANAGER))
):
    """Promote an employee to manager. Managers can only promote in their own department."""
    q = select(User).where(User.id == user_id, User.organization_id == admin.organization_id)
    if admin.role == Role.MANAGER.value:
        q = q.where(User.department_id == admin.department_id)
        
    user = (await db.execute(q)).scalar_one_or_none()
    if not user:
        raise HTTPException(status_code=404, detail="User not found or access denied")
        
    user.role = Role.MANAGER.value
    await db.commit()
    return {"status": "success"}

@router.put("/users/{user_id}/status")
async def update_user_status(
    user_id: int,
    status: str = Query(...),
    db: AsyncSession = Depends(get_db),
    admin: User = Depends(require_role(Role.MANAGER))
):
    """Enable/disable a user account. Managers can only modify their own department."""
    if status not in ["active", "suspended", "disabled"]:
        raise HTTPException(status_code=400, detail="Invalid status")
        
    q = select(User).where(User.id == user_id, User.organization_id == admin.organization_id)
    if admin.role == Role.MANAGER.value:
        q = q.where(User.department_id == admin.department_id)
        
    user = (await db.execute(q)).scalar_one_or_none()
    if not user:
        raise HTTPException(status_code=404, detail="User not found or access denied")
        
    if user.id == admin.id:
        raise HTTPException(status_code=400, detail="You cannot disable your own account")
        
    user.account_status = status
    await db.commit()
    return {"status": "success", "account_status": status}

@router.put("/users/{user_id}/role")
async def update_user_role(
    user_id: int,
    role: str = Query(...),
    db: AsyncSession = Depends(get_db),
    admin: User = Depends(require_role(Role.MANAGER))
):
    """Update user role. Managers can only modify their own department."""
    if role not in ["employee", "manager"]:
        raise HTTPException(status_code=400, detail="Invalid role")
        
    q = select(User).where(User.id == user_id, User.organization_id == admin.organization_id)
    if admin.role == Role.MANAGER.value:
        q = q.where(User.department_id == admin.department_id)
        
    user = (await db.execute(q)).scalar_one_or_none()
    if not user:
        raise HTTPException(status_code=404, detail="User not found or access denied")
        
    if user.id == admin.id:
        raise HTTPException(status_code=400, detail="You cannot modify your own role")
        
    user.role = role
    await db.commit()
    return {"status": "success", "role": role}
