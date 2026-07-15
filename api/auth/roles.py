"""
AegisOne API — Role-Based Access Control
"""
from enum import Enum
from fastapi import Depends, HTTPException, status
from api.dependencies import get_current_user


class Role(str, Enum):
    EMPLOYEE = "employee"
    OFFICE_ADMIN = "office_admin"
    SUPER_ADMIN = "super_admin"
    GLOBAL_ADMIN = "global_admin"
<<<<<<< HEAD

# Role hierarchy: higher index = more permissions
ROLE_HIERARCHY = {
    Role.EMPLOYEE:        0,
    Role.DEPARTMENT_ADMIN: 1,
    Role.SUPER_ADMIN:     2,
    Role.GLOBAL_ADMIN:    3,
=======


# Role hierarchy: higher index = more permissions
ROLE_HIERARCHY = {
    Role.EMPLOYEE: 0,
    Role.OFFICE_ADMIN: 1,
    Role.SUPER_ADMIN: 2,
    Role.GLOBAL_ADMIN: 3,
>>>>>>> ff262510555dc5ea98c2935a24986f2270118617
}


def require_role(minimum_role: Role):
    """
    FastAPI dependency factory.
    Returns a dependency that validates the Bearer token AND checks
    that the authenticated user holds at least minimum_role.

    Usage:
        current_user: User = Depends(require_role(Role.SUPER_ADMIN))
    """
    async def checker(current_user=Depends(get_current_user)):
        user_role_str = current_user.role  # stored as string in DB
        # Normalize: convert string to Role enum for hierarchy lookup
        try:
            user_role = Role(user_role_str)
        except ValueError:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail=f"Unknown role: {user_role_str}",
            )

        user_level     = ROLE_HIERARCHY.get(user_role, -1)
        required_level = ROLE_HIERARCHY.get(minimum_role, 99)

        if user_level < required_level:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail=f"Requires '{minimum_role.value}' role or higher",
            )
        return current_user

    return checker
