"""
AegisOne — Revision Service
Monotonic Organization Analytics Revision Tracker
"""

from datetime import datetime
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession
from api.database.models import OrganizationAnalyticsState

async def get_org_revision(db: AsyncSession, org_id: str | None = None) -> int:
    """
    Get current organization analytics revision number.
    Defaults to 1 if no record exists yet.
    """
    if not org_id:
        org_id = "org_default"
    
    res = await db.execute(
        select(OrganizationAnalyticsState.revision)
        .where(OrganizationAnalyticsState.organization_id == org_id)
    )
    rev = res.scalar_one_or_none()
    return rev if rev is not None else 1

async def increment_org_revision(db: AsyncSession, org_id: str | None = None) -> int:
    """
    Atomically increment organization analytics revision by 1.
    If org_id record does not exist, creates it with revision = 1.
    Must be called inside an active SQL transaction when a new event/scan is persisted.
    """
    if not org_id:
        org_id = "org_default"
    
    res = await db.execute(
        select(OrganizationAnalyticsState)
        .where(OrganizationAnalyticsState.organization_id == org_id)
        .with_for_update()
    )
    state = res.scalar_one_or_none()
    
    if state:
        state.revision += 1
        state.updated_at = datetime.utcnow()
        new_rev = state.revision
    else:
        new_state = OrganizationAnalyticsState(
            organization_id=org_id,
            revision=1,
            updated_at=datetime.utcnow()
        )
        db.add(new_state)
        new_rev = 1
        
    return new_rev
