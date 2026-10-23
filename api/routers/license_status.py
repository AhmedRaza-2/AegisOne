"""License / seat status for the dashboard banner and the admin's account page."""
from fastapi import APIRouter, Depends
from sqlalchemy.ext.asyncio import AsyncSession

from api.database.db import get_db
from api.database.models import User
from api.dependencies import get_current_user
from api.services import license as _license

router = APIRouter(prefix="/license", tags=["License"])

_ADMIN = {"admin", "super_admin", "global_admin"}


@router.get("/status")
async def license_status(user: User = Depends(get_current_user), db: AsyncSession = Depends(get_db)):
    """Everyone sees whether the deployment is licensed (to show a banner); admins also see seats."""
    info = _license.current()
    out = {k: info[k] for k in ("status", "valid", "plan", "expires_at", "enforce", "reason")}
    out["org_id"] = info["org_id"]
    if user.role in _ADMIN:
        out["seats"] = await _license.seat_status(db, user.organization_id)
        out["checked_at"] = info["checked_at"]
        out["registry_configured"] = info["registry_configured"]
    return out
