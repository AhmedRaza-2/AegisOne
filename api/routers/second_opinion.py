"""
AegisOne API — open-source URL second opinion (admin only).

  GET /admin/models/second-opinion          mode, model, licence, live agreement counters, same-data comparison
  PUT /admin/models/second-opinion {mode}   off | shadow | upgrade   (kept across restarts; audit-logged)
"""
from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel
from sqlalchemy.ext.asyncio import AsyncSession

from api.auth.roles import Role, require_role
from api.database.db import get_db
from api.database.models import AppSecret, AuditLog, User
from api.services import second_opinion as so

router = APIRouter(prefix="/admin/models/second-opinion", tags=["Model second opinion"])


class ModeIn(BaseModel):
    mode: str


@router.get("")
async def get_status(user: User = Depends(require_role(Role.ADMIN))):
    return so.status()


@router.put("")
async def put_mode(body: ModeIn, user: User = Depends(require_role(Role.ADMIN)), db: AsyncSession = Depends(get_db)):
    if body.mode not in so.MODES:
        raise HTTPException(400, f"mode must be one of {', '.join(so.MODES)}")
    old = so.get_mode()
    so.set_mode(body.mode)
    row = await db.get(AppSecret, so.STATE_KEY)
    if row:
        row.value = body.mode
    else:
        db.add(AppSecret(key=so.STATE_KEY, value=body.mode))
    db.add(AuditLog(organization_id=user.organization_id, actor_email=user.email, action="model.second_opinion_mode",
                    module="models", target=f"url second opinion: {old} -> {body.mode}"))
    await db.commit()
    if body.mode != "off":
        so.warm()
    return so.status()
