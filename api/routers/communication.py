from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.future import select
from sqlalchemy import or_, and_
from typing import List, Optional
from pydantic import BaseModel

from api.database.db import get_db
from api.database.models import User, Department, Message
from api.database.schemas import MessageCreate, MessageOut
from api.dependencies import get_current_user

router = APIRouter(prefix="/communication", tags=["Communication"])

# ─────────────────────────────────────────────────────────────────────────────
# ROLE HELPERS
# ─────────────────────────────────────────────────────────────────────────────
ADMIN_ROLES   = {"admin"}
MANAGER_ROLES = {"department_admin", "office_admin", "manager"}
EMPLOYEE_ROLE = {"employee"}

def is_admin(user: User)   -> bool: return user.role in ADMIN_ROLES
def is_manager(user: User) -> bool: return user.role in MANAGER_ROLES
def is_employee(user: User)-> bool: return user.role in EMPLOYEE_ROLE


# ─────────────────────────────────────────────────────────────────────────────
# 1. CONTACTS — who can you message?
# ─────────────────────────────────────────────────────────────────────────────
@router.get("/contacts")
async def get_contacts(
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db)
):
    """
    Returns the list of users that the current user is allowed to message.
    - Employee  → only their department manager(s)
    - Manager   → their department employees + all admins
    - Admin     → all managers in the org
    """
    contacts = []

    if is_employee(current_user):
        # Find the manager of the employee's department
        if current_user.department_id:
            result = await db.execute(
                select(User).where(
                    User.department_id == current_user.department_id,
                    User.role.in_(MANAGER_ROLES)
                )
            )
            contacts = result.scalars().all()

    elif is_manager(current_user):
        # 1. Get employees in manager's department (check both department name and department_id)
        emp_query = select(User).where(
            User.role.in_(EMPLOYEE_ROLE),
            User.id != current_user.id
        )
        if current_user.department_id:
            emp_query = emp_query.where(
                or_(
                    User.department_id == current_user.department_id,
                    User.department == current_user.department
                )
            )
        elif current_user.department:
            emp_query = emp_query.where(User.department == current_user.department)

        emp_result = await db.execute(emp_query)
        contacts = list(emp_result.scalars().all())

        # 2. Get all organization admins
        admin_result = await db.execute(
            select(User).where(
                User.role.in_(ADMIN_ROLES),
                User.id != current_user.id
            )
        )
        contacts += list(admin_result.scalars().all())

    elif is_admin(current_user):
        # All managers in the organization
        result = await db.execute(
            select(User).where(
                or_(
                    User.role.in_(MANAGER_ROLES),
                    User.role == "manager",
                    User.role == "department_admin"
                ),
                User.id != current_user.id
            )
        )
        contacts = result.scalars().all()

    # Deduplicate contacts by user ID
    seen_ids = set()
    unique_contacts = []
    for u in contacts:
        if u.id != current_user.id and u.id not in seen_ids:
            seen_ids.add(u.id)
            unique_contacts.append({
                "id": u.id,
                "full_name": u.full_name,
                "email": u.email,
                "role": u.role,
                "department": u.department,
                "department_id": u.department_id,
            })

    return unique_contacts


# ─────────────────────────────────────────────────────────────────────────────
# 2. CONVERSATION THREAD — messages between two users
# ─────────────────────────────────────────────────────────────────────────────
@router.get("/conversation/{other_user_id}", response_model=List[MessageOut])
async def get_conversation(
    other_user_id: int,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db)
):
    """
    Get all direct messages exchanged between current user and another user.
    Auto-marks messages FROM the other user as read.
    """
    result = await db.execute(
        select(Message)
        .where(
            Message.msg_type == "direct",
            or_(
                and_(Message.sender_id == current_user.id, Message.receiver_id == other_user_id),
                and_(Message.sender_id == other_user_id, Message.receiver_id == current_user.id)
            )
        )
        .order_by(Message.created_at.asc())
    )
    messages = result.scalars().all()

    # Mark unread received messages as read
    updated = False
    for msg in messages:
        if msg.sender_id == other_user_id and not msg.is_read:
            msg.is_read = True
            updated = True
    if updated:
        await db.commit()

    return messages


# ─────────────────────────────────────────────────────────────────────────────
# 3. SEND MESSAGE — with role-based validation
# ─────────────────────────────────────────────────────────────────────────────
@router.post("/send", response_model=MessageOut)
async def send_message(
    msg: MessageCreate,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db)
):
    """
    Send a message. Enforces role-based communication rules:
    - Employee can only message their manager (direct)
    - Manager can message their employees or admins (direct), or broadcast to dept
    - Admin can message managers (direct), or broadcast to whole org
    - Employee → Admin direct: BLOCKED
    - Admin → Employee direct: BLOCKED
    """
    if msg.msg_type == "direct":
        if not msg.receiver_id:
            raise HTTPException(status_code=400, detail="receiver_id required for direct message")

        result = await db.execute(select(User).where(User.id == msg.receiver_id))
        receiver = result.scalars().first()
        if not receiver:
            raise HTTPException(status_code=404, detail="Receiver not found")

        # Block Employee ↔ Admin
        if is_employee(current_user) and is_admin(receiver):
            raise HTTPException(status_code=403, detail="Employees cannot message admins directly")
        if is_admin(current_user) and is_employee(receiver):
            raise HTTPException(status_code=403, detail="Admins cannot message employees directly")

        # Block self-messaging
        if receiver.id == current_user.id:
            raise HTTPException(status_code=400, detail="Cannot message yourself")

    elif msg.msg_type == "broadcast":
        # Manager → Department broadcast
        if not is_manager(current_user) and not is_admin(current_user):
            raise HTTPException(status_code=403, detail="Only managers and admins can broadcast")
        if not msg.department_id:
            raise HTTPException(status_code=400, detail="department_id required for broadcast")
        result = await db.execute(select(Department).where(Department.id == msg.department_id))
        if not result.scalars().first():
            raise HTTPException(status_code=404, detail="Department not found")

    elif msg.msg_type == "org_broadcast":
        # Admin → Whole organization
        if not is_admin(current_user):
            raise HTTPException(status_code=403, detail="Only admins can send org-wide broadcasts")

    else:
        raise HTTPException(status_code=400, detail="Invalid msg_type. Must be: direct, broadcast, org_broadcast")

    new_msg = Message(
        sender_id=current_user.id,
        receiver_id=msg.receiver_id,
        department_id=msg.department_id,
        msg_type=msg.msg_type,
        title=msg.title,
        content=msg.content,
        priority=msg.priority
    )
    db.add(new_msg)
    await db.commit()
    await db.refresh(new_msg)
    return new_msg


# ─────────────────────────────────────────────────────────────────────────────
# 4. INBOX — received messages (for notification bell)
# ─────────────────────────────────────────────────────────────────────────────
@router.get("/inbox", response_model=List[MessageOut])
async def get_inbox(
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db)
):
    """
    Get all messages received by the current user:
    - Direct messages addressed to them
    - Department broadcasts (if they belong to that dept)
    - Org-wide broadcasts (everyone sees these)
    """
    result = await db.execute(
        select(Message)
        .where(
            or_(
                Message.receiver_id == current_user.id,
                and_(Message.msg_type == "broadcast", Message.department_id == current_user.department_id),
                Message.msg_type == "org_broadcast"
            )
        )
        .order_by(Message.created_at.desc())
    )
    return result.scalars().all()


# ─────────────────────────────────────────────────────────────────────────────
# 5. ANNOUNCEMENTS — broadcasts visible to the user
# ─────────────────────────────────────────────────────────────────────────────
@router.get("/announcements", response_model=List[MessageOut])
async def get_announcements(
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db)
):
    """
    Returns all broadcast and org_broadcast messages visible to the current user.
    """
    result = await db.execute(
        select(Message)
        .where(
            or_(
                and_(Message.msg_type == "broadcast", Message.department_id == current_user.department_id),
                Message.msg_type == "org_broadcast"
            )
        )
        .order_by(Message.created_at.desc())
    )
    return result.scalars().all()


# ─────────────────────────────────────────────────────────────────────────────
# 6. MY SENT HISTORY
# ─────────────────────────────────────────────────────────────────────────────
@router.get("/sent", response_model=List[MessageOut])
async def get_sent(
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db)
):
    result = await db.execute(
        select(Message)
        .where(Message.sender_id == current_user.id)
        .order_by(Message.created_at.desc())
    )
    return result.scalars().all()


# ─────────────────────────────────────────────────────────────────────────────
# 7. MANAGER HISTORY (legacy compat)
# ─────────────────────────────────────────────────────────────────────────────
@router.get("/manager/history", response_model=List[MessageOut])
async def get_manager_history(
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db)
):
    result = await db.execute(
        select(Message)
        .where(Message.sender_id == current_user.id)
        .order_by(Message.created_at.desc())
    )
    return result.scalars().all()
