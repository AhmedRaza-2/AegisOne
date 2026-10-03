"""
AegisOne API — Shared Dependencies
FastAPI dependency injection for auth, database, etc.

Identity comes from ONE place: a valid, unexpired ACCESS token in the Authorization
header. Nothing the client merely *claims* (an X-User-Email header, a `user_email` query
parameter, a form field) is ever treated as proof of who they are.

  get_current_user  strict    — 401 without a valid token; 403 if the account is not approved
  get_scan_user     lenient   — valid token -> that user, otherwise an anonymous placeholder
                                (extension scans keep working before sign-in)
  get_optional_user lenient   — valid token -> that user, otherwise None
"""
from datetime import timezone

from fastapi import Depends, HTTPException, status
from fastapi.security import HTTPBearer, HTTPAuthorizationCredentials
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, func

from api.auth.jwt_handler import decode_access_token
from api.database.db import get_db
from api.database.models import User

security = HTTPBearer(auto_error=False)

# Only these account states may use the API. "pending" (awaiting admin approval) and every
# other state (rejected, suspended, disabled, unknown) are refused.
ACTIVE_STATUSES = ("approved", "active")


async def _user_from_credentials(
    credentials: HTTPAuthorizationCredentials | None, db: AsyncSession
) -> tuple[User | None, str | None]:
    """Resolve a bearer token to (user, problem). `problem` explains a refusal."""
    if credentials is None:
        return None, "missing"
    payload = decode_access_token(credentials.credentials)
    if payload is None:
        return None, "invalid"
    email = payload.get("sub")
    if not email:
        return None, "invalid"

    user = (await db.execute(select(User).where(func.lower(User.email) == str(email).lower().strip()))).scalar_one_or_none()
    if user is None or not user.is_active:
        return None, "invalid"
    if user.account_status not in ACTIVE_STATUSES:
        return None, "not_approved"

    # Sessions minted before the last password change are no longer valid.
    changed = getattr(user, "password_changed_at", None)
    if changed is not None:
        changed_ts = changed.replace(tzinfo=timezone.utc).timestamp()
        if float(payload.get("iss_ts", 0)) < changed_ts:
            return None, "invalid"
    return user, None


async def get_current_user(
    credentials: HTTPAuthorizationCredentials = Depends(security),
    db: AsyncSession = Depends(get_db),
) -> User:
    user, problem = await _user_from_credentials(credentials, db)
    if user is not None:
        return user
    if problem == "not_approved":
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Your account is awaiting administrator approval.",
        )
    raise HTTPException(
        status_code=status.HTTP_401_UNAUTHORIZED,
        detail="Not authenticated",
        headers={"WWW-Authenticate": "Bearer"},
    )


def _anonymous_user() -> User:
    # Unsaved placeholder (id=None). Scans are processed but not attributed to anyone —
    # never to the first admin, never to an account the caller merely named.
    return User(
        id=None,
        organization_id="org_default",
        email="anonymous@aegisone.local",
        role="employee",
        is_active=True,
    )


async def get_scan_user(
    credentials: HTTPAuthorizationCredentials = Depends(security),
    db: AsyncSession = Depends(get_db),
) -> User:
    """For extension-facing scan routes that must also work before sign-in.

    No token at all -> anonymous. A token that is present but expired/invalid -> 401, so the client
    renews it; silently treating it as anonymous would make an expired session quietly stop being
    attributed to the user."""
    user, problem = await _user_from_credentials(credentials, db)
    if user is not None:
        return user
    if problem == "invalid":
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED, detail="Session expired",
            headers={"WWW-Authenticate": "Bearer"},
        )
    return _anonymous_user()


async def get_optional_user(
    credentials: HTTPAuthorizationCredentials = Depends(security),
    db: AsyncSession = Depends(get_db),
) -> User | None:
    user, _ = await _user_from_credentials(credentials, db)
    return user
