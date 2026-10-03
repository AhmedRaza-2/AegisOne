"""
AegisOne API — Auth Router
"""
from fastapi import APIRouter, Depends, HTTPException, status, Query, Request, Header
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, delete, func

from api.database.db import get_db
from api.database.models import User, Department, Organization, PasswordResetChallenge
from api.database.schemas import LoginRequest, RefreshRequest, RegisterRequest, TokenResponse, UserInfo
from api.auth.password import hash_password, verify_password, validate_password_strength
from api.dependencies import ACTIVE_STATUSES
from api.auth.jwt_handler import create_access_token, create_refresh_token, decode_refresh_token
from api.auth.roles import require_role, Role
from api.dependencies import get_current_user
from api.services.email_service import send_unified_email, get_dynamic_dashboard_url
from api.rate_limiter import limiter
import os
import hmac
import hashlib
import secrets
import logging
import smtplib
from datetime import datetime, timedelta, timezone
from email.mime.text import MIMEText
from email.mime.multipart import MIMEMultipart
from pydantic import BaseModel, Field, field_validator
from typing import Optional

logger = logging.getLogger("aegisone.auth")

OTP_TTL_MINUTES = 10
OTP_MAX_ATTEMPTS = 5
OTP_RESEND_SECONDS = 60

class ForgotPasswordRequest(BaseModel):
    # Not EmailStr — acts on an existing account, same reasoning as LoginRequest.
    email: str = Field(..., min_length=1, max_length=320)

class VerifyResetRequest(BaseModel):
    email: str = Field(..., min_length=1, max_length=320)
    otp: str = Field(..., max_length=16)

router = APIRouter(prefix="/auth", tags=["Auth"])


@router.get("/check-role")
@limiter.limit("10/minute")
async def check_role(request: Request, email: str = Query(..., max_length=320)):
    """Kept only so older clients don't break. It used to reveal whether an email is
    registered and its exact role to anyone; it now answers identically for every address.
    The real role is returned by /auth/login after a successful sign-in."""
    return {"exists": True, "role": "employee"}


@router.post("/login", response_model=TokenResponse)
@limiter.limit("10/minute")
async def login(request: Request, req: LoginRequest, db: AsyncSession = Depends(get_db)):
    result = await db.execute(select(User).where(User.email == req.email))
    user = result.scalar_one_or_none()
    
    if not user or not verify_password(req.password, user.password_hash):
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Incorrect email or password",
        )
        
    if not user.is_active:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Account is deactivated",
        )
        
    if user.account_status == "pending":
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Your account is awaiting administrator approval.",
        )

    if user.account_status not in ACTIVE_STATUSES:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Your account has been disabled. Please contact your administrator.",
        )

    user.last_login = datetime.utcnow()
    await db.commit()
        
    access_token = create_access_token(data={"sub": user.email, "role": user.role})
    refresh_token = create_refresh_token(data={"sub": user.email, "role": user.role})
    
    return TokenResponse(
        access_token=access_token,
        refresh_token=refresh_token,
        id=user.id,
        role=user.role,
        full_name=user.full_name,
        department=user.department or "IT",
        organization_id=user.organization_id
    )


@router.post("/refresh", response_model=TokenResponse)
async def refresh_tokens(req: RefreshRequest, db: AsyncSession = Depends(get_db)):
    payload = decode_refresh_token(req.refresh_token)
    if payload is None:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid or expired refresh token",
        )

    email = payload.get("sub")
    result = await db.execute(select(User).where(User.email == email))
    user = result.scalar_one_or_none()
    if user and user.password_changed_at is not None:
        # A refresh token minted before the last password change is dead.
        if float(payload.get("iss_ts", 0)) < user.password_changed_at.replace(tzinfo=timezone.utc).timestamp():
            user = None
    if not user or not user.is_active or user.account_status not in ACTIVE_STATUSES:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="User not found, deactivated, or not approved",
        )

    return TokenResponse(
        access_token=create_access_token(data={"sub": user.email, "role": user.role}),
        refresh_token=create_refresh_token(data={"sub": user.email, "role": user.role}),
        id=user.id,
        role=user.role,
        full_name=user.full_name,
        department=user.department or "IT",
        organization_id=user.organization_id
    )


@router.post("/register", response_model=UserInfo, status_code=status.HTTP_201_CREATED)
@limiter.limit("5/minute")
async def register(
    request: Request,
    req: RegisterRequest,
    db: AsyncSession = Depends(get_db)
):
    """Register a new user account."""
    result = await db.execute(select(User).where(User.email == req.email))
    if result.scalar_one_or_none():
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Email already registered",
        )
        
    # A self-registration can only join an organization that actually exists; the account
    # stays "pending" until that organization's admin approves it. The role is always
    # employee — whatever role the form sent is ignored.
    org_id = (req.organization_id or "org_default").strip()
    if (await db.execute(select(Organization.id).where(Organization.id == org_id))).first() is None:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="That organization was not found.")
    
    new_user = User(
        organization_id=org_id,
        email=req.email,
        password_hash=hash_password(req.password),
        full_name=req.full_name,
        role=Role.EMPLOYEE.value,
        department=req.department,
        account_status="pending"
    )
    
    db.add(new_user)
    await db.commit()
    await db.refresh(new_user)
    
    return new_user


@router.get("/me", response_model=UserInfo)
async def get_me(current_user: User = Depends(get_current_user)):
    # get_current_user returns an unsaved anonymous placeholder (id=None) for
    # unauthenticated extension scans; that must not be serialized as a real user.
    if current_user.id is None:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Not authenticated",
        )
    return current_user

def send_password_reset_email(email: str, new_password: str, request: Optional[Request] = None):
    portal_url = get_dynamic_dashboard_url(request)
    subject = "AegisOne — Temporary Password Reset"
    
    text = f"""Hello,

Your AegisOne account password has been successfully reset.

New Temporary Password: {new_password}

Please login to your security portal at: {portal_url}/login

Best regards,
AegisOne Security Team
"""

    html = f"""<!DOCTYPE html>
<html>
  <head><meta charset="utf-8"></head>
  <body style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; padding: 20px; background-color: #f8fafc; color: #0f172a;">
    <div style="max-width: 550px; margin: 0 auto; background: white; border: 1px solid #e2e8f0; border-radius: 12px; padding: 30px;">
      <h3 style="color: #0A5ED6; margin-top: 0;">AegisOne Security</h3>
      <p>Your password has been successfully reset.</p>
      <div style="background:#f8fafc; border: 1px solid #e2e8f0; padding: 14px; border-radius: 8px; margin: 16px 0;">
        <div style="font-size: 11px; font-weight: 700; color: #64748b; text-transform: uppercase; margin-bottom: 4px;">New Temporary Password</div>
        <div style="font-family: Consolas, Monaco, monospace; font-size: 15px; font-weight: bold; color: #1d4ed8; word-break: break-all; -webkit-user-select: all; user-select: all; background: #eff6ff; padding: 8px 12px; border-radius: 6px; border: 1px solid #bfdbfe;">{new_password}</div>
      </div>
      <p>Log in at <a href="{portal_url}/login" style="color: #0A5ED6; font-weight: 600;">{portal_url}/login</a></p>
    </div>
  </body>
</html>"""

    send_unified_email(to_email=email, subject=subject, html_content=html, text_content=text)


def send_admin_credentials_email(email: str, full_name: str, org_name: str = "Enterprise", request: Optional[Request] = None):
    """Welcome email for a new organization administrator. It deliberately does NOT contain
    a password: the admin signs in with the password they chose when registering, and can
    use "Forgot password" if they forget it."""
    portal_url = get_dynamic_dashboard_url(request)
    subject = f"Welcome to AegisOne - {org_name}"

    text = f"""Hello {full_name},

Your AegisOne administrator account for {org_name} is ready.

Sign in here: {portal_url}/login
Account email: {email}

Use the password you chose when you registered. If you have forgotten it, choose
"Forgot password" on the sign-in page.

Best regards,
AegisOne Unified Threat Management
"""

    html = f"""<!DOCTYPE html>
<html>
  <head><meta charset="utf-8"></head>
  <body style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; padding: 20px; background-color: #f8fafc; color: #0f172a;">
    <div style="max-width: 550px; margin: 0 auto; background: white; border: 1px solid #e2e8f0; border-radius: 12px; padding: 30px;">
      <h2 style="color: #0a5ed6; margin-top: 0;">Welcome, {full_name}</h2>
      <p>Your AegisOne administrator account for <strong>{org_name}</strong> is ready.</p>
      <p><strong>Sign in:</strong> <a href="{portal_url}/login" style="color: #0A5ED6;">{portal_url}/login</a><br/>
         <strong>Account email:</strong> {email}</p>
      <p>Use the password you chose when you registered. If you have forgotten it, choose <em>Forgot password</em> on the sign-in page.</p>
      <hr style="border: none; border-top: 1px solid #e2e8f0; margin: 25px 0;" />
      <p style="font-size: 12px; color: #64748b;">AegisOne Unified Threat Management</p>
    </div>
  </body>
</html>"""

    send_unified_email(to_email=email, subject=subject, html_content=html, text_content=text)


class AdminCredentialsNotifyRequest(BaseModel):
    email: str = Field(..., min_length=3, max_length=320)
    full_name: str = Field(..., min_length=1, max_length=255)
    password: str = Field(..., max_length=512)
    org_name: Optional[str] = Field("Enterprise", max_length=255)

    @field_validator("password")
    @classmethod
    def _password_policy(cls, v: str) -> str:
        return validate_password_strength(v)


def _setup_key_ok(provided: Optional[str]) -> bool:
    expected = os.environ.get("VITE_SETUP_KEY", "aegis-setup-key-change-me")
    return bool(expected) and bool(provided) and hmac.compare_digest(provided, expected)


@router.post("/send-admin-credentials")
@limiter.limit("5/minute")
async def send_admin_credentials_notify(
    request: Request,
    req: AdminCredentialsNotifyRequest,
    x_setup_key: Optional[str] = Header(None, alias="X-Setup-Key"),
    db: AsyncSession = Depends(get_db),
):
    """First-administrator provisioning for a freshly deployed instance.

    This used to let ANY unauthenticated caller create an approved administrator with a
    password of their choosing. It is now allowed only (a) while the instance has no
    administrator at all, or (b) with the deployment's setup key. An address that already
    has an account is never modified, and no password is ever emailed."""
    email = req.email.strip().lower()
    existing = (await db.execute(select(User).where(func.lower(User.email) == email))).scalars().first()

    admin_count = (await db.execute(
        select(func.count(User.id)).where(User.role.in_(["admin", "super_admin", "global_admin"]))
    )).scalar() or 0

    if not _setup_key_ok(x_setup_key) and admin_count > 0:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Administrator provisioning is not available.")

    if existing is None:
        db.add(User(
            email=email,
            password_hash=hash_password(req.password),
            full_name=req.full_name.strip(),
            role="admin",
            department=None,
            account_status="approved",
            organization_id="org_default",
        ))
        await db.commit()
        logger.info("First administrator provisioned for %s", email)
        send_admin_credentials_email(email, req.full_name.strip(), req.org_name or "Enterprise", request=request)

    # Same answer whether or not the account already existed.
    return {"status": "ok", "message": "If this is a new administrator, a welcome email has been sent."}

def send_otp_email(email: str, otp: str, smtp_user: str = None, smtp_pass: str = None, smtp_host: str = "smtp.gmail.com", smtp_port: int = 587):
    subject = "AegisOne — Password Reset Verification Code"
    
    text = f"""Hello,

You requested a password reset for your AegisOne account.

Verification Code: {otp}

If you did not request this, please ignore this email.

Best regards,
AegisOne Security Team
"""

    html = f"""<!DOCTYPE html>
<html>
  <head><meta charset="utf-8"></head>
  <body style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; padding: 20px;">
    <div style="max-width: 500px; margin: 0 auto; background: white; border: 1px solid #e2e8f0; border-radius: 12px; padding: 24px;">
      <h3 style="color: #0A5ED6; margin-top: 0;">AegisOne Security</h3>
      <p>You requested a password reset. Please use the following 6-digit verification code to proceed:</p>
      <div style="background:#f1f5f9; padding: 12px; border-radius: 8px; text-align: center; margin: 16px 0;">
        <span style="font-family: Consolas, Monaco, monospace; font-size: 24px; font-weight: bold; letter-spacing: 4px; color: #0f172a; -webkit-user-select: all; user-select: all;">{otp}</span>
      </div>
      <p style="font-size: 13px; color: #64748b;">If you did not request this verification code, please ignore this message.</p>
    </div>
  </body>
</html>"""

    org_smtp = None
    if smtp_user and smtp_pass:
        org_smtp = {"smtp_user": smtp_user, "smtp_pass": smtp_pass, "smtp_host": smtp_host, "smtp_port": smtp_port}

    send_unified_email(to_email=email, subject=subject, html_content=html, text_content=text, org_smtp=org_smtp)

def _hash_code(code: str, salt: str) -> str:
    return hashlib.sha256(f"{salt}:{code}".encode()).hexdigest()


async def _consume_attempt(db: AsyncSession, email: str, code: str) -> PasswordResetChallenge:
    """Check a reset code. Every wrong guess counts; after OTP_MAX_ATTEMPTS the code is
    destroyed. Raises a deliberately uniform error for unknown/expired/wrong codes."""
    bad = HTTPException(status_code=400, detail="Invalid or expired verification code.")
    ch = (await db.execute(select(PasswordResetChallenge).where(PasswordResetChallenge.email == email))).scalar_one_or_none()
    if ch is None or datetime.utcnow() > ch.expires_at:
        if ch is not None:
            await db.delete(ch)
            await db.commit()
        raise bad
    if not hmac.compare_digest(ch.code_hash, _hash_code(code, ch.salt)):
        ch.attempts += 1
        if ch.attempts >= OTP_MAX_ATTEMPTS:
            await db.delete(ch)
        await db.commit()
        raise bad
    return ch


@router.post("/forgot-password")
@limiter.limit("5/minute")
async def forgot_password(request: Request, req: ForgotPasswordRequest, db: AsyncSession = Depends(get_db)):
    email = req.email.strip().lower()
    generic = {"status": "ok", "message": "If that account exists, a verification code has been sent."}

    user = (await db.execute(select(User).where(func.lower(User.email) == email))).scalar_one_or_none()
    if not user or not user.is_active:
        return generic

    # Don't mail a new code more than once a minute for the same account.
    prior = (await db.execute(select(PasswordResetChallenge).where(PasswordResetChallenge.email == user.email))).scalar_one_or_none()
    if prior and prior.created_at and (datetime.utcnow() - prior.created_at).total_seconds() < OTP_RESEND_SECONDS:
        return generic

    code = f"{secrets.randbelow(10**6):06d}"
    salt = secrets.token_hex(8)
    await db.execute(delete(PasswordResetChallenge).where(PasswordResetChallenge.email == user.email))
    db.add(PasswordResetChallenge(
        email=user.email, code_hash=_hash_code(code, salt), salt=salt, attempts=0,
        expires_at=datetime.utcnow() + timedelta(minutes=OTP_TTL_MINUTES),
        created_at=datetime.utcnow(),
    ))
    await db.commit()

    # The code is never written to the logs in normal operation. For a local demo without
    # SMTP, opt in explicitly with AEGIS_DEV_PRINT_OTP=1.
    if os.getenv("AEGIS_DEV_PRINT_OTP") == "1":
        logger.warning("DEV ONLY - reset code for %s: %s", user.email, code)
    else:
        logger.info("Password reset code issued for %s", user.email)

    # Retrieve user's organization SMTP settings, or fall back to any org SMTP / environment vars
    user_org_id = getattr(user, "organization_id", None) or "org_default"
    org = (await db.execute(select(Organization).where(Organization.id == user_org_id))).scalar_one_or_none()
    if not (org and org.smtp_user and org.smtp_pass):
        fallback_org = (await db.execute(
            select(Organization).where(Organization.smtp_user != None, Organization.smtp_user != "")
        )).scalars().first()
        if fallback_org:
            org = fallback_org

    smtp_user = (org.smtp_user if org and org.smtp_user else os.getenv("SMTP_USER")) or ""
    smtp_pass = (org.smtp_pass if org and org.smtp_pass else os.getenv("SMTP_PASS")) or ""
    smtp_host = (org.smtp_host if org and org.smtp_host else os.getenv("SMTP_HOST")) or "smtp.gmail.com"
    smtp_port = (org.smtp_port if org and org.smtp_port else int(os.getenv("SMTP_PORT", "587")))

    send_otp_email(user.email, code, smtp_user, smtp_pass, smtp_host, smtp_port)
    return generic


class ResetWithNewPasswordRequest(BaseModel):
    email: str = Field(..., min_length=1, max_length=320)
    otp: str = Field(..., max_length=16)
    new_password: str = Field(..., max_length=512)

    @field_validator("new_password")
    @classmethod
    def _password_policy(cls, v: str) -> str:
        return validate_password_strength(v)


@router.post("/verify-reset-otp")
@limiter.limit("10/minute")
async def verify_reset_otp(request: Request, req: VerifyResetRequest, db: AsyncSession = Depends(get_db)):
    await _consume_attempt(db, req.email.strip().lower(), req.otp.strip())
    return {"status": "ok", "message": "Code verified. Please set your new password."}


@router.post("/reset-password")
@limiter.limit("10/minute")
async def reset_password(request: Request, req: ResetWithNewPasswordRequest, db: AsyncSession = Depends(get_db)):
    email = req.email.strip().lower()
    ch = await _consume_attempt(db, email, req.otp.strip())

    user = (await db.execute(select(User).where(func.lower(User.email) == email))).scalar_one_or_none()
    if not user:
        raise HTTPException(status_code=400, detail="Invalid or expired verification code.")

    user.password_hash = hash_password(req.new_password)
    user.password_changed_at = datetime.utcnow()   # signs out every existing session
    await db.delete(ch)                              # one-time use
    await db.commit()
    logger.info("Password reset completed for %s", user.email)
    return {"status": "ok", "message": "Password updated successfully! You can now log in with your new password."}


class ChangePasswordRequest(BaseModel):
    current_password: str = Field(..., min_length=1, max_length=512)
    new_password: str = Field(..., max_length=512)

    @field_validator("new_password")
    @classmethod
    def _password_policy(cls, v: str) -> str:
        return validate_password_strength(v)

class UpdateProfileRequest(BaseModel):
    full_name: Optional[str] = Field(None, min_length=1, max_length=255)

@router.post("/change-password")
async def change_password(
    req: ChangePasswordRequest,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db)
):
    if not verify_password(req.current_password, current_user.password_hash):
        raise HTTPException(status_code=400, detail="Incorrect current password")
    current_user.password_hash = hash_password(req.new_password)
    current_user.password_changed_at = datetime.utcnow()   # every other session is signed out
    await db.commit()
    # Hand back fresh tokens so THIS session carries on without a forced re-login.
    claims = {"sub": current_user.email, "role": current_user.role}
    return {
        "status": "ok",
        "message": "Password changed successfully",
        "access_token": create_access_token(data=claims),
        "refresh_token": create_refresh_token(data=claims),
    }

@router.put("/profile")
async def update_profile(
    req: UpdateProfileRequest,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db)
):
    if req.full_name:
        current_user.full_name = req.full_name
    await db.commit()
    return {"status": "ok", "full_name": current_user.full_name}

