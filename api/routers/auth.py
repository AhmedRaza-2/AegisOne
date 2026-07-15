"""
AegisOne API — Auth Router
"""
from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select

from api.database.db import get_db
<<<<<<< HEAD
from api.database.models import User
from api.database.schemas import LoginRequest, RefreshRequest, RegisterRequest, TokenResponse, UserInfo
=======
from api.database.models import User, Department
from api.database.schemas import LoginRequest, RegisterRequest, TokenResponse, UserInfo
>>>>>>> ff262510555dc5ea98c2935a24986f2270118617
from api.auth.password import hash_password, verify_password
from api.auth.jwt_handler import create_access_token, create_refresh_token, decode_refresh_token
from api.auth.roles import require_role, Role
from api.dependencies import get_current_user

router = APIRouter(prefix="/auth", tags=["Auth"])


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
    elif user.account_status in ("rejected", "disabled"):
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Account access denied",
        )
        
    access_token = create_access_token(data={"sub": user.email, "role": user.role})
    refresh_token = create_refresh_token(data={"sub": user.email, "role": user.role})
    
    return TokenResponse(
        access_token=access_token,
        refresh_token=refresh_token,
        role=user.role,
        full_name=user.full_name,
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
    )


@router.post("/register", response_model=UserInfo, status_code=status.HTTP_201_CREATED)
async def register(
    req: RegisterRequest, 
    db: AsyncSession = Depends(get_db)
):
<<<<<<< HEAD
    """Register a new user account."""
=======
    """Register new employee. Only SUPER_ADMIN or higher can do this."""
>>>>>>> ff262510555dc5ea98c2935a24986f2270118617
    result = await db.execute(select(User).where(User.email == req.email))
    if result.scalar_one_or_none():
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Email already registered",
        )
        
<<<<<<< HEAD
    # Determine organization_id. Default to org_default if none provided.
    org_id = req.organization_id if req.organization_id else "org_default"
    
=======
    if not current_user.organization_id:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Admin user must belong to an organization to register users."
        )

    # Find or create department inside the admin's organization
    dept_stmt = select(Department).where(
        Department.organization_id == current_user.organization_id,
        Department.name == req.department
    )
    dept_res = await db.execute(dept_stmt)
    dept = dept_res.scalar_one_or_none()

    if not dept:
        dept = Department(
            organization_id=current_user.organization_id,
            name=req.department
        )
        db.add(dept)
        await db.commit()
        await db.refresh(dept)
        
>>>>>>> ff262510555dc5ea98c2935a24986f2270118617
    new_user = User(
        organization_id=org_id,
        email=req.email,
        password_hash=hash_password(req.password),
        full_name=req.full_name,
        role=req.role.value,
<<<<<<< HEAD
        department=req.department,
        account_status="pending"
=======
        organization_id=current_user.organization_id,
        department_id=dept.id
>>>>>>> ff262510555dc5ea98c2935a24986f2270118617
    )
    
    db.add(new_user)
    await db.commit()
    await db.refresh(new_user)
    
    return new_user


@router.get("/me", response_model=UserInfo)
async def get_me(current_user: User = Depends(get_current_user)):
    return current_user
