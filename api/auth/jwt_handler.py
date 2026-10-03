"""
AegisOne API — JWT Token Handler

Access and refresh tokens are cryptographically distinct by their `token_type` claim and
each decoder only accepts its own kind, so a 30-day refresh token can never be replayed as
a bearer credential. `iss_ts` records when a token was minted so every session issued
before a password change can be rejected.
"""
import time
from datetime import datetime, timedelta, timezone
from jose import jwt, JWTError
from api.config import JWT_SECRET_KEY, JWT_ALGORITHM, JWT_EXPIRY_MINUTES

REFRESH_TOKEN_MINUTES = 60 * 24 * 30


def create_access_token(data: dict) -> str:
    return create_token(data, JWT_EXPIRY_MINUTES, "access")


def create_refresh_token(data: dict) -> str:
    return create_token(data, REFRESH_TOKEN_MINUTES, "refresh")


def create_token(data: dict, expiry_minutes: int, token_type: str) -> str:
    to_encode = data.copy()
    expire = datetime.now(timezone.utc) + timedelta(minutes=expiry_minutes)
    to_encode["exp"] = expire
    to_encode["token_type"] = token_type
    to_encode["iss_ts"] = time.time()
    return jwt.encode(to_encode, JWT_SECRET_KEY, algorithm=JWT_ALGORITHM)


def _decode(token: str) -> dict | None:
    try:
        return jwt.decode(token, JWT_SECRET_KEY, algorithms=[JWT_ALGORITHM])
    except JWTError:
        return None


def decode_access_token(token: str) -> dict | None:
    payload = _decode(token)
    if not payload or payload.get("token_type") != "access":
        return None
    return payload


def decode_refresh_token(token: str) -> dict | None:
    payload = _decode(token)
    if not payload or payload.get("token_type") != "refresh":
        return None
    return payload
