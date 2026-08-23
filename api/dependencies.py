"""
AegisOne API — Shared Dependencies
FastAPI dependency injection for auth, database, etc.
"""
from fastapi import Depends, HTTPException, status, Request
from fastapi.security import HTTPBearer, HTTPAuthorizationCredentials
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, func

from api.auth.jwt_handler import decode_access_token
from api.database.db import get_db
from api.database.models import User

security = HTTPBearer(auto_error=False)


async def get_current_user(
    request: Request,
    credentials: HTTPAuthorizationCredentials = Depends(security),
    db: AsyncSession = Depends(get_db),
) -> User:
    """Extract and validate the current user from JWT token or fallback to X-User-Email."""
    # 1. Try JWT Token authentication
    if credentials is not None:
        payload = decode_access_token(credentials.credentials)
        if payload is not None:
            email = payload.get("sub")
            if email:
                result = await db.execute(select(User).where(func.lower(User.email) == email.lower().strip()))
                user = result.scalar_one_or_none()
                if user and user.is_active and user.account_status not in ("suspended", "disabled", "rejected"):
                    return user

    # 2. Fallback: Authenticate via X-User-Email header for extension background client scans
    email = request.headers.get("X-User-Email") or request.headers.get("x-user-email")
    if email:
        result = await db.execute(select(User).where(func.lower(User.email) == email.lower().strip()))
        user = result.scalar_one_or_none()
        if user and user.is_active and user.account_status not in ("suspended", "disabled", "rejected"):
            return user

    raise HTTPException(
        status_code=status.HTTP_401_UNAUTHORIZED,
        detail="Authentication required — provide valid Bearer token or active X-User-Email",
    )


async def get_optional_user(
    request: Request,
    credentials: HTTPAuthorizationCredentials = Depends(security),
    db: AsyncSession = Depends(get_db),
) -> User | None:
    """Same as get_current_user but returns None if no token provided.
    Used for endpoints that work with or without auth."""
    if credentials is None and request.headers.get("X-User-Email") is None:
        return None
    try:
        return await get_current_user(request, credentials, db)
    except HTTPException:
        return None
