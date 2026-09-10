"""
AegisOne API — Email Analytics Aggregation Service
====================================================
Privacy-preserving email analytics built on EmailSecurityEvent.

Scope contract:
  employee   → Own events only. Subject/sender previews included (only owner sees them).
  supervisor → Department aggregate counts. No individual scan records.
  admin      → Organization aggregate + department breakdown. No individual scan records.

No email body, thread_url, recipient, or full HTML is ever returned.
"""

from typing import Dict, Any, List, Optional
from datetime import datetime, timedelta
from sqlalchemy.future import select
from sqlalchemy import func, cast, String, and_, or_, Integer, case
from sqlalchemy.ext.asyncio import AsyncSession

from api.database.models import EmailSecurityEvent, User, Department, Organization


def parse_period(period_str: str) -> tuple[Optional[datetime], datetime]:
    """Resolves timeframe start/end dates from period string."""
    now = datetime.utcnow()
    if period_str == "24h":
        return now - timedelta(hours=24), now
    elif period_str == "7d":
        return now - timedelta(days=7), now
    elif period_str == "30d":
        return now - timedelta(days=30), now
    elif period_str == "90d":
        return now - timedelta(days=90), now
    return None, now  # "all" — no date restriction


def _verdict_bucket(score: int, verdict: str) -> str:
    """Normalize verdict to safe/suspicious/phishing."""
    v = (verdict or "").lower()
    if score >= 75 or v in ("phishing", "danger", "block"):
        return "phishing"
    if score >= 35 or v in ("suspicious", "warning", "warn"):
        return "suspicious"
    return "safe"


def _severity_label(score: int) -> str:
    if score >= 90:
        return "critical"
    if score >= 75:
        return "high"
    if score >= 50:
        return "medium"
    return "low"


async def get_email_analytics(
    db: AsyncSession,
    current_user: User,
    period: str = "30d",
    scope: str = "auto"
) -> Dict[str, Any]:
    """
    Core Email Analytics Aggregator with Server-Side Privacy Controls.

    Scopes:
    - employee: Returns employee's own email security events (with subject/sender preview).
    - supervisor: Returns department aggregate totals only (no individual scan records).
    - admin: Returns organization aggregate + department breakdown (no individual scan records).
    """
    start_date, end_date = parse_period(period)
    role = getattr(current_user, "role", "employee") or "employee"

    # Auto-resolve scope from role
    if scope == "auto":
        if role in ("admin", "superadmin", "super_admin", "global_admin", "secops"):
            effective_scope = "admin"
        elif role in ("supervisor", "manager", "department_admin", "office_admin"):
            effective_scope = "supervisor"
        else:
            effective_scope = "employee"
    else:
        effective_scope = scope

    org_id = getattr(current_user, "organization_id", None) or "org_default"
    user_id = getattr(current_user, "id", None)
    dept_id = getattr(current_user, "department_id", None)

    # ── Build base filter ─────────────────────────────────────────────────────
    base_conds = [EmailSecurityEvent.organization_id == org_id]
    if start_date:
        base_conds.append(EmailSecurityEvent.scanned_at >= start_date)

    # ══ EMPLOYEE SCOPE ════════════════════════════════════════════════════════
    if effective_scope == "employee":
        if user_id is not None:
            base_conds.append(
                or_(
                    EmailSecurityEvent.user_id == user_id,
                    EmailSecurityEvent.user_id == str(user_id),
                )
            )

        q = (
            select(EmailSecurityEvent)
            .where(and_(*base_conds))
            .order_by(EmailSecurityEvent.scanned_at.desc())
        )
        res = await db.execute(q)
        events = res.scalars().all()

        total = len(events)
        safe_count = suspicious_count = phishing_count = 0
        total_risk = 0
        scan_logs = []

        for e in events:
            score = e.risk_score or 0
            total_risk += score
            bucket = _verdict_bucket(score, e.verdict or "")
            if bucket == "phishing":
                phishing_count += 1
            elif bucket == "suspicious":
                suspicious_count += 1
            else:
                safe_count += 1

            scanned_at_str = (
                e.scanned_at.isoformat()
                if e.scanned_at and hasattr(e.scanned_at, "isoformat")
                else str(e.scanned_at or "")
            )

            scan_logs.append({
                "id": e.scan_id,
                "scanned_at": scanned_at_str,
                "risk_score": score,
                "severity": e.severity or _severity_label(score),
                "verdict": bucket,
                "decision": e.decision or "allow",
                "threat_type": e.threat_type or "safe_email",
                "factor_codes": e.factor_codes or [],
                "model_version": e.model_version,
                # Employee-only fields — only included in employee scope
                "subject": e.subject_preview or "",
                "sender": e.sender_preview or "",
            })

        threat_count = phishing_count + suspicious_count
        return {
            "period": {"name": period, "start": start_date.isoformat() if start_date else None, "end": end_date.isoformat()},
            "scope": effective_scope,
            "summary": {
                "total_scanned": total,
                "safe": safe_count,
                "suspicious": suspicious_count,
                "phishing": phishing_count,
                "threat_count": threat_count,
                "threat_rate": round(threat_count / total, 4) if total > 0 else 0.0,
                "average_risk_score": round(total_risk / total, 1) if total > 0 else 0.0,
            },
            "risk_distribution": [
                {"category": "Safe",       "count": safe_count,       "color": "#10b981"},
                {"category": "Suspicious", "count": suspicious_count, "color": "#f59e0b"},
                {"category": "Phishing",   "count": phishing_count,   "color": "#ef4444"},
            ],
            "scans": scan_logs,
        }

    # ══ SUPERVISOR SCOPE ══════════════════════════════════════════════════════
    elif effective_scope == "supervisor":
        dept_conds = list(base_conds)
        if dept_id is not None:
            dept_conds.append(
                or_(
                    EmailSecurityEvent.department_id == dept_id,
                    cast(EmailSecurityEvent.department_id, String) == str(dept_id),
                )
            )

        # Aggregated counts only — use case() for conditional sums (SQLAlchemy compatible)
        count_q = select(
            func.count(EmailSecurityEvent.id).label("total"),
            func.sum(case((EmailSecurityEvent.verdict == "phishing",  1), else_=0)).label("phishing"),
            func.sum(case((EmailSecurityEvent.verdict == "suspicious", 1), else_=0)).label("suspicious"),
            func.avg(EmailSecurityEvent.risk_score).label("avg_risk"),
        ).where(and_(*dept_conds))

        r = (await db.execute(count_q)).one()
        total   = r.total or 0
        phishing_count  = int(r.phishing  or 0)
        suspicious_count = int(r.suspicious or 0)
        safe_count = total - phishing_count - suspicious_count
        threat_count = phishing_count + suspicious_count

        return {
            "period": {"name": period, "start": start_date.isoformat() if start_date else None, "end": end_date.isoformat()},
            "scope": effective_scope,
            "summary": {
                "total_scanned": total,
                "safe": safe_count,
                "suspicious": suspicious_count,
                "phishing": phishing_count,
                "threat_count": threat_count,
                "threat_rate": round(threat_count / total, 4) if total > 0 else 0.0,
                "average_risk_score": round(float(r.avg_risk or 0), 1),
            },
            "risk_distribution": [
                {"category": "Safe",       "count": safe_count,       "color": "#10b981"},
                {"category": "Suspicious", "count": suspicious_count, "color": "#f59e0b"},
                {"category": "Phishing",   "count": phishing_count,   "color": "#ef4444"},
            ],
            # No individual scan records returned to supervisor
            "scans": [],
        }

    # ══ ADMIN SCOPE ═══════════════════════════════════════════════════════════
    else:
        # Org-wide aggregate — use case() for conditional sums
        count_q = select(
            func.count(EmailSecurityEvent.id).label("total"),
            func.sum(case((EmailSecurityEvent.verdict == "phishing",  1), else_=0)).label("phishing"),
            func.sum(case((EmailSecurityEvent.verdict == "suspicious", 1), else_=0)).label("suspicious"),
            func.avg(EmailSecurityEvent.risk_score).label("avg_risk"),
        ).where(and_(*base_conds))

        r = (await db.execute(count_q)).one()
        total   = r.total or 0
        phishing_count  = int(r.phishing  or 0)
        suspicious_count = int(r.suspicious or 0)
        safe_count = total - phishing_count - suspicious_count
        threat_count = phishing_count + suspicious_count

        # Department breakdown (aggregate per department, no individual records)
        dept_q = (
            select(
                EmailSecurityEvent.department_id,
                func.count(EmailSecurityEvent.id).label("total"),
                func.sum(case((EmailSecurityEvent.verdict == "phishing",  1), else_=0)).label("phishing"),
                func.sum(case((EmailSecurityEvent.verdict == "suspicious", 1), else_=0)).label("suspicious"),
                func.avg(EmailSecurityEvent.risk_score).label("avg_risk"),
            )
            .where(and_(*base_conds))
            .group_by(EmailSecurityEvent.department_id)
        )
        dept_rows = (await db.execute(dept_q)).all()

        # Fetch department names for display
        dept_ids = [row.department_id for row in dept_rows if row.department_id]
        dept_names: Dict[int, str] = {}
        if dept_ids:
            name_q = select(Department.id, Department.name).where(Department.id.in_(dept_ids))
            for row in (await db.execute(name_q)).all():
                dept_names[row.id] = row.name

        department_breakdown = []
        for row in dept_rows:
            d_total = row.total or 0
            d_phishing = int(row.phishing or 0)
            d_suspicious = int(row.suspicious or 0)
            d_threat = d_phishing + d_suspicious
            department_breakdown.append({
                "department_id": row.department_id,
                "department_name": dept_names.get(row.department_id, "Unknown"),
                "total_scanned": d_total,
                "phishing": d_phishing,
                "suspicious": d_suspicious,
                "threat_rate": round(d_threat / d_total, 4) if d_total > 0 else 0.0,
                "average_risk_score": round(float(row.avg_risk or 0), 1),
            })

        return {
            "period": {"name": period, "start": start_date.isoformat() if start_date else None, "end": end_date.isoformat()},
            "scope": effective_scope,
            "summary": {
                "total_scanned": total,
                "safe": safe_count,
                "suspicious": suspicious_count,
                "phishing": phishing_count,
                "threat_count": threat_count,
                "threat_rate": round(threat_count / total, 4) if total > 0 else 0.0,
                "average_risk_score": round(float(r.avg_risk or 0), 1),
            },
            "risk_distribution": [
                {"category": "Safe",       "count": safe_count,       "color": "#10b981"},
                {"category": "Suspicious", "count": suspicious_count, "color": "#f59e0b"},
                {"category": "Phishing",   "count": phishing_count,   "color": "#ef4444"},
            ],
            "department_breakdown": department_breakdown,
            # No individual scan records returned to admin
            "scans": [],
        }
