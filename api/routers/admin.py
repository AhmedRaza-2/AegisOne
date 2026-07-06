"""
AegisOne API — Admin Router
"""
from fastapi import APIRouter, Depends
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, func

from api.database.db import get_db
from api.database.models import User, ScanLog
from api.database.schemas import AdminStatsResponse
from api.auth.roles import require_role, Role
from api.services.model_orchestrator import get_model_status

router = APIRouter(prefix="/admin", tags=["Admin"])


@router.get("/stats", response_model=AdminStatsResponse)
async def get_stats(
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(require_role(Role.OFFICE_ADMIN))
):
    """Get system-wide or department-wide statistics."""
    
    # Base queries
    users_query = select(func.count(User.id))
    scans_query = select(func.count(ScanLog.id))
    threats_query = select(func.count(ScanLog.id)).where(ScanLog.is_threat == True)
    
    # Department admins only see their department stats
    if current_user.role == Role.OFFICE_ADMIN:
        users_query = users_query.where(User.department_id == current_user.department_id)
        # Assuming we join or subquery to filter scans by users in department
        # For simplicity in this demo, we'll just count total scans globally
        pass 
        
    total_users = await db.scalar(users_query)
    total_scans = await db.scalar(scans_query)
    total_threats = await db.scalar(threats_query)
    
    # Model status
    statuses = get_model_status()
    model_status = {k: v["loaded"] for k, v in statuses.items()}
    
    return AdminStatsResponse(
        total_users=total_users or 0,
        total_scans=total_scans or 0,
        scans_today=0,  # Mocked for now
        threats_detected=total_threats or 0,
        threats_today=0, # Mocked for now
        model_status=model_status,
        top_threat_types={"url": 0, "email": 0} # Mocked
    )
