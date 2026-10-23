"""
AegisOne API — In-app notifications (alert bell)
================================================
Each user sees only their own notifications (alerts raised by api/services/alerts.py).
"""
from typing import Any, Dict, List

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy import func, update
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.future import select

from api.database.db import get_db
from api.database.models import Notification, User
from api.dependencies import get_current_user

router = APIRouter(prefix="/notifications", tags=["Notifications"])


def _row(n: Notification) -> Dict[str, Any]:
    return {"id": n.id, "kind": n.kind, "severity": n.severity, "title": n.title, "body": n.body,
            "link": n.link, "is_read": bool(n.is_read), "created_at": n.created_at.isoformat() if n.created_at else None}


@router.get("", response_model=Dict[str, Any])
async def list_notifications(limit: int = 30, unread_only: bool = False,
                             current_user: User = Depends(get_current_user), db: AsyncSession = Depends(get_db)):
    q = select(Notification).where(Notification.user_id == current_user.id)
    if unread_only:
        q = q.where(Notification.is_read == False)  # noqa: E712
    rows = (await db.execute(q.order_by(Notification.created_at.desc()).limit(max(1, min(limit, 100))))).scalars().all()
    unread = (await db.execute(select(func.count(Notification.id)).where(
        Notification.user_id == current_user.id, Notification.is_read == False))).scalar() or 0  # noqa: E712
    return {"unread": unread, "notifications": [_row(n) for n in rows]}


@router.post("/{notification_id}/read", response_model=Dict[str, Any])
async def mark_read(notification_id: int, current_user: User = Depends(get_current_user), db: AsyncSession = Depends(get_db)):
    n = (await db.execute(select(Notification).where(
        Notification.id == notification_id, Notification.user_id == current_user.id))).scalars().first()
    if not n:
        raise HTTPException(status_code=404, detail="Notification not found.")
    n.is_read = True
    await db.commit()
    return {"status": "success"}


@router.post("/read-all", response_model=Dict[str, Any])
async def mark_all_read(current_user: User = Depends(get_current_user), db: AsyncSession = Depends(get_db)):
    await db.execute(update(Notification).where(Notification.user_id == current_user.id, Notification.is_read == False)  # noqa: E712
                     .values(is_read=True))
    await db.commit()
    return {"status": "success"}
