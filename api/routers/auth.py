"""
AegisOne API — Auth Router
"""
from fastapi import APIRouter, Depends, HTTPException, status, Query
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select

from api.database.db import get_db
from api.database.models import User, Department
from api.database.schemas import LoginRequest, RefreshRequest, RegisterRequest, TokenResponse, UserInfo
from api.auth.password import hash_password, verify_password
from api.auth.jwt_handler import create_access_token, create_refresh_token, decode_refresh_token
from api.auth.roles import require_role, Role
from api.dependencies import get_current_user
import os
import smtplib
import random
import string
from email.mime.text import MIMEText
from email.mime.multipart import MIMEMultipart
from pydantic import BaseModel
from typing import Optional
import time

class ForgotPasswordRequest(BaseModel):
    email: str

class VerifyResetRequest(BaseModel):
    email: str
    otp: str

# In-memory store for OTPs: { email: { "otp": "123456", "expires_at": timestamp } }
otp_store = {}

router = APIRouter(prefix="/auth", tags=["Auth"])


@router.get("/check-role")
async def check_role(email: str = Query(...), db: AsyncSession = Depends(get_db)):
    """Auto-detect assigned user role based on email."""
    result = await db.execute(select(User).where(User.email == email))
    user = result.scalar_one_or_none()
    if not user:
        return {"exists": False, "role": "employee"}
    return {"exists": True, "role": user.role}


@router.post("/login", response_model=TokenResponse)
async def login(req: LoginRequest, db: AsyncSession = Depends(get_db)):
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
            detail="Account is awaiting admin approval",
        )
    elif user.account_status in ("rejected", "disabled", "suspended"):
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Your account has been disabled. Please contact your administrator.",
        )
        
    access_token = create_access_token(data={"sub": user.email, "role": user.role})
    refresh_token = create_refresh_token(data={"sub": user.email, "role": user.role})
    
    return TokenResponse(
        access_token=access_token,
        refresh_token=refresh_token,
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
    if not user or not user.is_active or user.account_status != "approved":
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="User not found, deactivated, or not approved",
        )

    return TokenResponse(
        access_token=create_access_token(data={"sub": user.email, "role": user.role}),
        refresh_token=create_refresh_token(data={"sub": user.email, "role": user.role}),
        role=user.role,
        full_name=user.full_name,
        department=user.department or "IT",
        organization_id=user.organization_id
    )


@router.post("/register", response_model=UserInfo, status_code=status.HTTP_201_CREATED)
async def register(
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
        
    # Determine organization_id. Default to org_default if none provided.
    org_id = req.organization_id if req.organization_id else "org_default"
    
    new_user = User(
        organization_id=org_id,
        email=req.email,
        password_hash=hash_password(req.password),
        full_name=req.full_name,
        role=req.role.value,
        department=req.department,
        account_status="pending"
    )
    
    db.add(new_user)
    await db.commit()
    await db.refresh(new_user)
    
    return new_user


@router.get("/me", response_model=UserInfo)
async def get_me(current_user: User = Depends(get_current_user)):
    return current_user

def send_password_reset_email(email: str, new_password: str):
    smtp_user = os.getenv("SMTP_USER")
    smtp_pass = os.getenv("SMTP_PASS")
    if not smtp_user or not smtp_pass:
        print("SMTP credentials missing.")
        return
    try:
        msg = MIMEMultipart("alternative")
        msg["Subject"] = "AegisOne - Temporary Password Reset"
        msg["From"] = smtp_user
        msg["To"] = email
        html = f"""
        <html>
          <body style="font-family: sans-serif; padding: 20px;">
            <h3>AegisOne Security</h3>
            <p>Your password has been successfully reset.</p>
            <p><strong>New Temporary Password:</strong> <span style="background:#f1f5f9; padding: 4px 8px; border-radius: 4px; font-family: monospace;">{new_password}</span></p>
            <p>Please login at <a href="http://localhost:3002/login">http://localhost:3002/login</a></p>
          </body>
        </html>
        """
        msg.attach(MIMEText(html, "html"))
        server = smtplib.SMTP_SSL("smtp.gmail.com", 465)
        server.login(smtp_user, smtp_pass)
        server.sendmail(smtp_user, email, msg.as_string())
        server.quit()
        print(f"Reset email sent to {email}")
    except Exception as e:
        print(f"Failed to send reset email: {e}")

def send_admin_credentials_email(email: str, full_name: str, password: str, org_name: str = "Enterprise"):
    smtp_user = os.getenv("SMTP_USER")
    smtp_pass = os.getenv("SMTP_PASS")
    if not smtp_user or not smtp_pass:
        print("SMTP credentials missing.")
        return
    try:
        msg = MIMEMultipart("alternative")
        msg["Subject"] = f"AegisOne Admin Credentials - {org_name}"
        msg["From"] = f"AegisOne Security <{smtp_user}>"
        msg["To"] = email
        html = f"""
        <html>
          <body style="font-family: sans-serif; padding: 20px; background-color: #f8fafc; color: #0f172a;">
            <div style="max-width: 550px; margin: 0 auto; background: white; border: 1px solid #e2e8f0; border-radius: 12px; padding: 30px;">
              <h2 style="color: #0a5ed6; margin-top: 0;">Welcome Administrator</h2>
              <p>Hello <strong>{full_name}</strong>,</p>
              <p>Your organization account (<strong>{org_name}</strong>) has been registered. Below are your Administrator account credentials for the AegisOne Security Dashboard:</p>
              <div style="background: #f1f5f9; padding: 15px; border-radius: 8px; font-family: monospace; margin: 20px 0;">
                <p style="margin: 5px 0;"><strong>Login URL:</strong> <a href="http://localhost:3002/login">http://localhost:3002/login</a></p>
                <p style="margin: 5px 0;"><strong>Admin Email:</strong> {email}</p>
                <p style="margin: 5px 0;"><strong>Password:</strong> {password}</p>
                <p style="margin: 5px 0;"><strong>Role:</strong> Administrator</p>
              </div>
              <p>Log in to access your security portal and manage your organization's endpoints.</p>
              <hr style="border: none; border-top: 1px solid #e2e8f0; margin: 25px 0;" />
              <p style="font-size: 12px; color: #64748b;">AegisOne Unified Threat Management</p>
            </div>
          </body>
        </html>
        """
        msg.attach(MIMEText(html, "html"))
        server = smtplib.SMTP_SSL("smtp.gmail.com", 465)
        server.login(smtp_user, smtp_pass)
        server.sendmail(smtp_user, email, msg.as_string())
        server.quit()
        print(f"Successfully sent admin credentials email to {email}")
    except Exception as e:
        print(f"Failed to send admin credentials email to {email}: {e}")

class AdminCredentialsNotifyRequest(BaseModel):
    email: str
    full_name: str
    password: str
    org_name: Optional[str] = "Enterprise"

@router.post("/send-admin-credentials")
async def send_admin_credentials_notify(req: AdminCredentialsNotifyRequest, db: AsyncSession = Depends(get_db)):
    """API endpoint to dispatch welcome/credentials email to organization admin upon registration or setup."""
    # Ensure admin user exists in local DB or create/update them
    stmt = select(User).where(User.email == req.email)
    existing = (await db.execute(stmt)).scalars().first()
    if not existing:
        db_user = User(
            email=req.email,
            password_hash=hash_password(req.password),
            full_name=req.full_name,
            role="admin",
            department=None,
            account_status="approved",
            organization_id="org_default"
        )
        db.add(db_user)
        await db.commit()
    
    send_admin_credentials_email(req.email, req.full_name, req.password, req.org_name or "Enterprise")
    return {"status": "ok", "message": f"Admin credentials email dispatched to {req.email}"}

def send_otp_email(email: str, otp: str):
    smtp_user = os.getenv("SMTP_USER")
    smtp_pass = os.getenv("SMTP_PASS")
    if not smtp_user or not smtp_pass:
        return
    try:
        msg = MIMEMultipart("alternative")
        msg["Subject"] = "AegisOne - Password Reset Verification Code"
        msg["From"] = smtp_user
        msg["To"] = email
        html = f"""
        <html>
          <body style="font-family: sans-serif; padding: 20px;">
            <h3>AegisOne Security</h3>
            <p>You requested a password reset. Please use the following 6-digit verification code to proceed.</p>
            <p><strong>Verification Code:</strong> <span style="background:#f1f5f9; padding: 4px 8px; border-radius: 4px; font-family: monospace; font-size: 18px;">{otp}</span></p>
            <p>If you did not request this, please ignore this email.</p>
          </body>
        </html>
        """
        msg.attach(MIMEText(html, "html"))
        server = smtplib.SMTP_SSL("smtp.gmail.com", 465)
        server.login(smtp_user, smtp_pass)
        server.sendmail(smtp_user, email, msg.as_string())
        server.quit()
    except Exception as e:
        print(f"Failed to send OTP email: {e}")

@router.post("/forgot-password")
async def forgot_password(req: ForgotPasswordRequest, db: AsyncSession = Depends(get_db)):
    result = await db.execute(select(User).where(User.email == req.email))
    user = result.scalar_one_or_none()
    
    if not user:
        return {"status": "ok"}
        
    otp = ''.join(random.choices(string.digits, k=6))
    otp_store[user.email] = {
        "otp": otp,
        "expires_at": time.time() + 600 # 10 mins expiry
    }
    
    print(f"\n==========================================")
    print(f"[SECURITY OTP CODE] Email: {user.email} -> OTP Code: {otp}")
    print(f"==========================================\n")
    
    send_otp_email(user.email, otp)
    return {"status": "ok", "message": "OTP sent"}

class ResetWithNewPasswordRequest(BaseModel):
    email: str
    otp: str
    new_password: str

@router.post("/verify-reset-otp")
async def verify_reset_otp(req: VerifyResetRequest, db: AsyncSession = Depends(get_db)):
    record = otp_store.get(req.email)
    if not record or record["otp"] != req.otp or time.time() > record["expires_at"]:
        raise HTTPException(status_code=400, detail="Invalid or expired 6-digit verification code.")
        
    result = await db.execute(select(User).where(User.email == req.email))
    user = result.scalar_one_or_none()
    if not user:
        raise HTTPException(status_code=404, detail="User not found.")
        
    return {"status": "ok", "message": "Code verified. Please set your new password."}

@router.post("/reset-password")
async def reset_password(req: ResetWithNewPasswordRequest, db: AsyncSession = Depends(get_db)):
    record = otp_store.get(req.email)
    if not record or record["otp"] != req.otp or time.time() > record["expires_at"]:
        raise HTTPException(status_code=400, detail="Invalid or expired session. Please request a new code.")

    result = await db.execute(select(User).where(User.email == req.email))
    user = result.scalar_one_or_none()
    if not user:
        raise HTTPException(status_code=404, detail="User not found.")

    user.password_hash = hash_password(req.new_password)
    await db.commit()

    if req.email in otp_store:
        del otp_store[req.email]

    return {"status": "ok", "message": "Password updated successfully! You can now log in with your new password."}


class ChangePasswordRequest(BaseModel):
    current_password: str
    new_password: str

class UpdateProfileRequest(BaseModel):
    full_name: Optional[str] = None

@router.post("/change-password")
async def change_password(
    req: ChangePasswordRequest,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db)
):
    if not verify_password(req.current_password, current_user.password_hash):
        raise HTTPException(status_code=400, detail="Incorrect current password")
    if len(req.new_password) < 6:
        raise HTTPException(status_code=400, detail="Password must be at least 6 characters")
    current_user.password_hash = hash_password(req.new_password)
    await db.commit()
    return {"status": "ok", "message": "Password changed successfully"}

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

