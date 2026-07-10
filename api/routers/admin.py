"""
AegisOne API — Admin Router
============================
Real-time and pre-aggregated statistics for the dashboard.
Uses DashboardStatistic for fast today-view; falls back to live queries.
"""
import json
from datetime import date, datetime, timezone
from fastapi import APIRouter, Depends, BackgroundTasks
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, func, update

from api.database.db import get_db
from api.database.models import (
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

# SQLite-compatible "today" filter using the database's date() function
_TODAY = func.date("now")


# ── Shared scope helper ───────────────────────────────────────────────────────

def _org_scope(query, model, user):
    """Restrict a query to the user's org unless they're super_admin."""
    if user.role != Role.SUPER_ADMIN.value:
        org_id = getattr(user, "organization_id", None) or "org_default"
        query = query.where(getattr(model, "organization_id") == org_id)
    return query


# ── Daily stats aggregation ───────────────────────────────────────────────────

async def _compute_and_store_daily_stats(db: AsyncSession, org_id: str, target_date: date):
    """
    Compute real aggregates from the event tables for `target_date`
    and upsert them into dashboard_statistics.
    Called as a background task from /admin/stats/refresh.
    """
    date_str = target_date.isoformat()

    def today_filter(col):
        return func.date(col) == date_str

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
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(require_role(Role.DEPARTMENT_ADMIN)),
):
    """
    Real-time admin statistics.
    Today's view reads from dashboard_statistics (fast pre-aggregate).
    All-time totals are computed live from the event tables.
    """
    org_id   = getattr(current_user, "organization_id", None) or "org_default"
    is_super = current_user.role == Role.SUPER_ADMIN.value

    # ── 1. Today's stats — from pre-aggregated table if available ─────────────
    today_row = await db.scalar(
        select(DashboardStatistic)
        .where(DashboardStatistic.organization_id == org_id)
        .where(DashboardStatistic.date == date.today())
    )

    if today_row:
        scans_today   = today_row.total_scans
        threats_today = today_row.threats_blocked + today_row.threats_warned
    else:
        # Live fallback — first request of the day before background task runs
        scans_today = await db.scalar(
            _org_scope(
                select(func.count(WebsiteScan.id))
                .where(func.date(WebsiteScan.created_at) == _TODAY),
                WebsiteScan, current_user,
            )
        ) or 0

        ev_today = await db.scalar(
            _org_scope(
                select(func.count(SecurityEvent.id))
                .where(func.date(SecurityEvent.timestamp) == _TODAY),
                SecurityEvent, current_user,
            )
        ) or 0

        scans_today   = scans_today + ev_today
        threats_today = await db.scalar(
            _org_scope(
                select(func.count(WebsiteScan.id))
                .where(WebsiteScan.decision.in_(["warn", "block"]))
                .where(func.date(WebsiteScan.created_at) == _TODAY),
                WebsiteScan, current_user,
            )
        ) or 0

    # ── 2. All-time totals ────────────────────────────────────────────────────
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

    # ── 3. Top threat types ───────────────────────────────────────────────────
    ev_type_q = _org_scope(
        select(SecurityEvent.event_type, func.count(SecurityEvent.id).label("cnt"))
        .where(SecurityEvent.severity.in_(["medium", "high"]))
        .group_by(SecurityEvent.event_type)
        .order_by(func.count(SecurityEvent.id).desc())
        .limit(8),
        SecurityEvent, current_user,
    )
    ev_rows = (await db.execute(ev_type_q)).all()

    scan_type_q = (
        select(WebsiteScan.threat_type, func.count(WebsiteScan.id).label("cnt"))
        .where(WebsiteScan.decision.in_(["warn", "block"]))
        .where(WebsiteScan.threat_type.isnot(None))
        .group_by(WebsiteScan.threat_type)
        .order_by(func.count(WebsiteScan.id).desc())
        .limit(8)
    )
    if not is_super:
        scan_type_q = scan_type_q.where(WebsiteScan.organization_id == org_id)
    scan_rows = (await db.execute(scan_type_q)).all()

    top_threat_types: dict[str, int] = {}
    for event_type, cnt in ev_rows:
        if event_type:
            top_threat_types[event_type] = top_threat_types.get(event_type, 0) + cnt
    for threat_type, cnt in scan_rows:
        if threat_type:
            top_threat_types[threat_type] = top_threat_types.get(threat_type, 0) + cnt

    top_threat_types = dict(
        sorted(top_threat_types.items(), key=lambda x: x[1], reverse=True)[:10]
    ) or {"no_threats_recorded": 0}

    # ── 4. Events by severity ─────────────────────────────────────────────────
    sev_q = _org_scope(
        select(SecurityEvent.severity, func.count(SecurityEvent.id).label("cnt"))
        .group_by(SecurityEvent.severity),
        SecurityEvent, current_user,
    )
    sev_rows = (await db.execute(sev_q)).all()
    events_by_severity: dict[str, int] = {row[0]: row[1] for row in sev_rows if row[0]}

    # ── 5. Supplementary counters ─────────────────────────────────────────────
    cred_total = await db.scalar(
        _org_scope(select(func.count(CredentialEvent.id)), CredentialEvent, current_user)
    ) or 0

    dl_total = await db.scalar(
        _org_scope(select(func.count(DownloadEvent.id)), DownloadEvent, current_user)
    ) or 0

    # ── 6. Model status ───────────────────────────────────────────────────────
    statuses     = get_model_status()
    model_status = {k: v["loaded"] for k, v in statuses.items()}

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
    )


# ── /stats/refresh ────────────────────────────────────────────────────────────

@router.post("/stats/refresh")
async def refresh_daily_stats(
    bg_tasks: BackgroundTasks,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(require_role(Role.DEPARTMENT_ADMIN)),
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
    current_user: User = Depends(require_role(Role.DEPARTMENT_ADMIN)),
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
    current_user: User = Depends(require_role(Role.DEPARTMENT_ADMIN)),
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
    current_user: User = Depends(require_role(Role.DEPARTMENT_ADMIN)),
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
    current_user: User = Depends(require_role(Role.DEPARTMENT_ADMIN)),
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
    current_user: User = Depends(require_role(Role.DEPARTMENT_ADMIN)),
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
