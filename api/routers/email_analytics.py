"""
AegisOne API — Email Analytics Router
=====================================
Exposes time-filtered, RBAC-scoped email security analytics endpoints.
"""

from fastapi import APIRouter, Depends, Query, HTTPException
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import func
from sqlalchemy.future import select
from typing import Dict, Any, Optional
import traceback

from api.database.db import get_db
from api.database.models import User
from api.dependencies import get_current_user
from api.services.email_analytics_service import get_email_analytics

router = APIRouter(prefix="/analytics", tags=["Email Analytics"])


@router.get("/email")
async def fetch_email_analytics(
    period: str = Query("24h", regex="^(24h|7d|30d|90d|all)$"),
    scope: str = Query("auto", regex="^(auto|employee|supervisor|admin)$"),
    email: Optional[str] = Query(None),
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db)
) -> Dict[str, Any]:
    """
    Returns RBAC-enforced email analytics with privacy controls and time filtering.
    
    Scopes:
    - employee: User's own email scan history + subject/sender details
    - supervisor: Department team threat totals (privacy-scrubbed)
    - admin: Organization-wide threat metrics & trends (privacy-scrubbed)
    """
    try:
        target_user = current_user
        if email:
            u_res = await db.execute(select(User).where(func.lower(User.email) == email.lower().strip()))
            found = u_res.scalar_one_or_none()
            if found:
                target_user = found

        data = await get_email_analytics(db, target_user, period=period, scope=scope)
        return {"status": "success", "data": data}
    except Exception as e:
        traceback.print_exc()
        raise HTTPException(status_code=500, detail=f"Failed to fetch email analytics: {str(e)}")

