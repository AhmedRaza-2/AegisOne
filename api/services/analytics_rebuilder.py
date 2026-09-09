"""
AegisOne — Analytics Rebuilder Service
Rebuilds derived dashboard_statistics explicitly from raw authoritative PostgreSQL event tables.
"""

from datetime import date, datetime, timedelta
from sqlalchemy import select, func, delete, cast, Date
from sqlalchemy.ext.asyncio import AsyncSession
from api.database.models import (
    WebsiteScan, CredentialEvent, DownloadEvent, ManualScan, ThreatReport,
    SecurityEvent, DashboardStatistic
)

async def rebuild_dashboard_statistics(
    db: AsyncSession,
    org_id: str = "org_default",
    start_date: date | None = None,
    end_date: date | None = None
) -> int:
    """
    Re-computes daily metrics from raw event tables and upserts into dashboard_statistics.
    Returns the number of daily statistics records built/updated.
    """
    if not end_date:
        end_date = datetime.utcnow().date()
    if not start_date:
        start_date = end_date - timedelta(days=30)

    rebuilt_count = 0
    curr_date = start_date

    while curr_date <= end_date:
        target_d = curr_date

        def today_filter(col):
            return cast(col, Date) == target_d

        # 1. Scans & Decisions
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

        safe_scans = max(total_scans - threats_blocked - threats_warned, 0)

        # 2. Module Counts
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

        # 3. Top threat type
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

        # 4. Upsert row
        existing = await db.scalar(
            select(DashboardStatistic)
            .where(DashboardStatistic.organization_id == org_id)
            .where(DashboardStatistic.date == target_d)
        )
        
        if existing:
            existing.total_scans         = total_scans
            existing.threats_blocked     = threats_blocked
            existing.threats_warned      = threats_warned
            existing.safe_scans          = safe_scans
            existing.credential_attempts = cred_attempts
            existing.downloads_blocked   = dl_blocked
            existing.downloads_scanned   = dl_scanned
            existing.manual_scans        = manual_count
            existing.threat_reports      = reports_today
            existing.top_threat_type     = top_threat
            existing.computed_at         = datetime.utcnow()
        else:
            db.add(DashboardStatistic(
                organization_id    = org_id,
                date               = target_d,
                total_scans        = total_scans,
                threats_blocked    = threats_blocked,
                threats_warned     = threats_warned,
                safe_scans         = safe_scans,
                credential_attempts= cred_attempts,
                downloads_blocked  = dl_blocked,
                downloads_scanned  = dl_scanned,
                manual_scans       = manual_count,
                threat_reports     = reports_today,
                top_threat_type    = top_threat,
                computed_at         = datetime.utcnow()
            ))

        rebuilt_count += 1
        curr_date += timedelta(days=1)

    await db.commit()
    return rebuilt_count
