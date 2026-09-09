"""
AegisOne — Scope Resolver Service
Standardized Scope & Timezone Resolver for Analytics APIs
"""

from datetime import datetime, timedelta
from typing import Dict, Any, Tuple, Optional
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession
from api.database.models import User, Organization, Department

class AnalyticsScope:
    def __init__(
        self,
        org_id: str,
        user_id: Optional[int],
        role: str,
        department_id: Optional[int],
        timezone: str,
        start_time: Optional[datetime],
        end_time: datetime,
        time_range: str
    ):
        self.org_id = org_id
        self.user_id = user_id
        self.role = role
        self.department_id = department_id
        self.timezone = timezone
        self.start_time = start_time
        self.end_time = end_time
        self.time_range = time_range

async def resolve_analytics_scope(
    db: AsyncSession,
    current_user: User,
    time_range: str = "24h",
    requested_dept_id: Optional[str | int] = None,
) -> AnalyticsScope:
    """
    Resolves authoritative org_id, department filters, timezone, and time range.
    Enforces RBAC boundaries so managers can only access their assigned department data.
    """
    org_id = getattr(current_user, "organization_id", None) or "org_default"
    user_id = getattr(current_user, "id", None)
    role = getattr(current_user, "role", "employee")
    
    # Fetch Org timezone
    org_res = await db.execute(select(Organization.timezone).where(Organization.id == org_id))
    tz = org_res.scalar_one_or_none() or "UTC"
    
    # Department Filter Resolution
    dept_id = None
    if role in ("super_admin", "org_admin", "admin"):
        if requested_dept_id and str(requested_dept_id).lower() != "all":
            try:
                dept_id = int(requested_dept_id)
            except ValueError:
                dept_id = None
    elif role == "manager":
        # Manager is strictly bound to their department
        dept_id = current_user.department_id
    else:
        # Employee scope
        dept_id = current_user.department_id

    # Time Range Boundaries (UTC)
    now = datetime.utcnow()
    if time_range == "24h":
        start_time = now - timedelta(hours=24)
    elif time_range == "7d":
        start_time = now - timedelta(days=7)
    elif time_range == "30d":
        start_time = now - timedelta(days=30)
    elif time_range == "90d":
        start_time = now - timedelta(days=90)
    else:
        start_time = None  # All time

    return AnalyticsScope(
        org_id=org_id,
        user_id=user_id,
        role=role,
        department_id=dept_id,
        timezone=tz,
        start_time=start_time,
        end_time=now,
        time_range=time_range
    )
