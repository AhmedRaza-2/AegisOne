"""
AegisOne API — JWT Token Handler
"""
from datetime import datetime, timedelta, timezone
from jose import jwt, JWTError
from api.config import JWT_SECRET_KEY, JWT_ALGORITHM, JWT_EXPIRY_MINUTES


def create_access_token(data: dict) -> str:
    to_encode = data.copy()
    expire = datetime.now(timezone.utc) + timedelta(minutes=JWT_EXPIRY_MINUTES)
    to_encode["exp"] = expire
    return jwt.encode(to_encode, JWT_SECRET_KEY, algorithm=JWT_ALGORITHM)


def decode_access_token(token: str) -> dict | None:
    try:
        payload = jwt.decode(token, JWT_SECRET_KEY, algorithms=[JWT_ALGORITHM])
        return payload
    except JWTError:
        return None
