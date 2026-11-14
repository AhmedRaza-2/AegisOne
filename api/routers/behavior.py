"""
AegisOne API — behavioural anomaly detection (scope 7.3). Admin only; one organisation at a time.

  GET /admin/behavior/anomalies?history_days=30   people whose last 24 hours differ most from their own history
"""
from fastapi import APIRouter, Depends, Query
from sqlalchemy.ext.asyncio import AsyncSession

from api.auth.roles import Role, require_role
from api.database.db import get_db
from api.database.models import User
from api.services.behavior_anomaly import org_anomalies

router = APIRouter(prefix="/admin/behavior", tags=["Behavioural anomalies"])


@router.get("/anomalies")
async def anomalies(history_days: int = Query(30, ge=7, le=90),
                    user: User = Depends(require_role(Role.ADMIN)), db: AsyncSession = Depends(get_db)):
    return await org_anomalies(db, user.organization_id or "org_default", history_days)
