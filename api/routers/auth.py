"""
AegisOne API — Auth Router
"""
from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select

from api.database.db import get_db
from api.database.models import User, Department
from api.database.schemas import LoginRequest, RegisterRequest, TokenResponse, UserInfo
from api.auth.password import hash_password, verify_password
from api.auth.jwt_handler import create_access_token
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
        
    access_token = create_access_token(data={"sub": user.email, "role": user.role})
    
    return TokenResponse(
        access_token=access_token,
        role=user.role,
        full_name=user.full_name
    )


@router.post("/register", response_model=UserInfo)
async def register(
    req: RegisterRequest, 
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(require_role(Role.SUPER_ADMIN))
):
    """Register new employee. Only SUPER_ADMIN or higher can do this."""
    result = await db.execute(select(User).where(User.email == req.email))
    if result.scalar_one_or_none():
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Email already registered",
        )
        
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
        
    new_user = User(
        email=req.email,
        password_hash=hash_password(req.password),
        full_name=req.full_name,
        role=req.role.value,
        organization_id=current_user.organization_id,
        department_id=dept.id
    )
    
    db.add(new_user)
    await db.commit()
    await db.refresh(new_user)
    
    return new_user


@router.get("/me", response_model=UserInfo)
async def get_me(current_user: User = Depends(get_current_user)):
    return current_user
