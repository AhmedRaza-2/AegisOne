"""
AegisOne API — Password Hashing and Policy (direct bcrypt)

bcrypt only looks at the first 72 BYTES of its input. Silently cutting longer passwords
off meant two different long passwords hashed (and verified) identically, so overlong
passwords are now rejected outright instead of truncated.
"""
import bcrypt

MIN_PASSWORD_LENGTH = 8
MAX_PASSWORD_BYTES = 72


def validate_password_strength(password: str) -> str:
    """The single password policy used by registration, reset, change and admin-created
    accounts. Returns the password unchanged or raises ValueError with a user-facing reason."""
    if not isinstance(password, str) or len(password) < MIN_PASSWORD_LENGTH:
        raise ValueError(f"Password must be at least {MIN_PASSWORD_LENGTH} characters long.")
    if len(password.encode("utf-8")) > MAX_PASSWORD_BYTES:
        raise ValueError(f"Password is too long (maximum {MAX_PASSWORD_BYTES} bytes, about {MAX_PASSWORD_BYTES} characters).")
    if not password.strip():
        raise ValueError("Password cannot be only spaces.")
    if not any(c.isalpha() for c in password) or not any(c.isdigit() for c in password):
        raise ValueError("Password must contain at least one letter and one number.")
    return password


def hash_password(password: str) -> str:
    pw_bytes = password.encode("utf-8")
    if len(pw_bytes) > MAX_PASSWORD_BYTES:
        raise ValueError(f"Password exceeds {MAX_PASSWORD_BYTES} bytes.")
    return bcrypt.hashpw(pw_bytes, bcrypt.gensalt()).decode("utf-8")


def verify_password(plain_password: str, hashed_password: str) -> bool:
    try:
        pw_bytes = plain_password.encode("utf-8")
        if len(pw_bytes) > MAX_PASSWORD_BYTES:
            return False
        return bcrypt.checkpw(pw_bytes, hashed_password.encode("utf-8"))
    except Exception:
        return False
