"""
AegisOne API — Email Analytics Aggregation Service
==================================================
Canonical server-side aggregation for Email Security Analytics.
Supports time filtering (7d, 30d, 90d, all), role-based scoping (Employee, Supervisor, Admin),
and privacy-preserving server-side filtering.
"""

from typing import Dict, Any, List, Optional
from datetime import datetime, timedelta, timezone
from sqlalchemy.future import select
from sqlalchemy import func, cast, Date, and_, or_
from sqlalchemy.ext.asyncio import AsyncSession
import json

from api.database.models import WebsiteScan, User, Department, Organization


def parse_period(period_str: str) -> tuple[Optional[datetime], datetime]:
    """Resolves timeframe start/end dates from period string (7d, 30d, 90d, all)."""
    now = datetime.now(timezone.utc)
    if period_str == "7d":
        return now - timedelta(days=7), now
    elif period_str == "30d":
        return now - timedelta(days=30), now
    elif period_str == "90d":
        return now - timedelta(days=90), now
    return None, now


async def get_email_analytics(
    db: AsyncSession,
    current_user: User,
    period: str = "30d",
    scope: str = "auto"
) -> Dict[str, Any]:
    """
    Core Email Analytics Aggregator with Server-Side Privacy Controls.
    
    Scopes:
    - employee: Returns employee's own scan history with subject/sender details.
    - supervisor: Returns department totals & team member threat counts (privacy-scrubbed subjects).
    - admin: Returns organization totals & department risk breakdown (privacy-scrubbed).
    """
    start_date, end_date = parse_period(period)
    role = current_user.role if current_user.role else "employee"
    
    # Auto-resolve scope from role if not explicitly requested
    if scope == "auto":
        if role in ["admin", "superadmin", "secops"]:
            effective_scope = "admin"
        elif role in ["supervisor", "manager"]:
            effective_scope = "supervisor"
        else:
            effective_scope = "employee"
    else:
        effective_scope = scope

    # Base query for email scans
    q = select(WebsiteScan).where(
        or_(
            WebsiteScan.scan_type == "email",
            WebsiteScan.threat_type.ilike("%phishing_email%"),
            WebsiteScan.url.ilike("Email:%")
        )
    )

    if start_date:
        q = q.where(WebsiteScan.created_at >= start_date)

    # Apply Scope Filters
    if effective_scope == "employee":
        q = q.where(WebsiteScan.user_id == current_user.id)
    elif effective_scope == "supervisor":
        if current_user.department_id:
            q = q.where(
                or_(
                    WebsiteScan.department_id == current_user.department_id,
                    WebsiteScan.organization_id == current_user.organization_id
                )
            )
        else:
            q = q.where(WebsiteScan.organization_id == current_user.organization_id)
    else: # admin
        if current_user.organization_id:
            q = q.where(WebsiteScan.organization_id == current_user.organization_id)

    res = await db.execute(q.order_by(WebsiteScan.created_at.desc()))
    scans = res.scalars().all()

    # Calculate Aggregate Summary Metrics
    total_scanned = len(scans)
    safe_count = 0
    suspicious_count = 0
    phishing_count = 0
    total_risk_score = 0

    scan_logs = []

    for s in scans:
        score = s.risk_score or 0
        total_risk_score += score
        
        verdict = (s.verdict or "").lower()
        if score >= 75 or verdict in ["phishing", "danger", "block"]:
            phishing_count += 1
            verdict_clean = "phishing"
        elif score >= 35 or verdict in ["suspicious", "warning", "warn"]:
            suspicious_count += 1
            verdict_clean = "suspicious"
        else:
            safe_count += 1
            verdict_clean = "safe"

        # Build Privacy-Safe Scan Log Object
        if effective_scope == "employee":
            # Employees get full details for their OWN scans
            scan_logs.append({
                "id": s.scan_id or str(s.id),
                "url": s.url,
                "domain": s.domain,
                "risk_score": score,
                "verdict": verdict_clean,
                "decision": s.decision or "allow",
                "top_factors": json.loads(s.top_factors) if s.top_factors and s.top_factors.startswith("[") else [],
                "created_at": s.created_at.isoformat() if s.created_at else None
            })
        else:
            # Supervisors and Admins get privacy-scrubbed metadata ONLY
            scan_logs.append({
                "id": s.scan_id or str(s.id),
                "user_id": s.user_id,
                "risk_score": score,
                "verdict": verdict_clean,
                "decision": s.decision or "allow",
                "created_at": s.created_at.isoformat() if s.created_at else None
            })

    threat_count = phishing_count + suspicious_count
    threat_rate = round(threat_count / total_scanned, 4) if total_scanned > 0 else 0.0
    avg_risk_score = round(total_risk_score / total_scanned, 1) if total_scanned > 0 else 0.0

    return {
        "period": {
            "name": period,
            "start": start_date.isoformat() if start_date else None,
            "end": end_date.isoformat()
        },
        "scope": effective_scope,
        "summary": {
            "total_scanned": total_scanned,
            "safe": safe_count,
            "suspicious": suspicious_count,
            "phishing": phishing_count,
            "threat_count": threat_count,
            "threat_rate": threat_rate,
            "average_risk_score": avg_risk_score
        },
        "risk_distribution": [
            {"category": "Safe", "count": safe_count, "color": "#10b981"},
            {"category": "Suspicious", "count": suspicious_count, "color": "#f59e0b"},
            {"category": "Phishing", "count": phishing_count, "color": "#ef4444"}
        ],
        "scans": scan_logs[:100]  # Limit recent logs
    }
