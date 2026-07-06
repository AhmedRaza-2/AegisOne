"""
AegisOne API — Role-Based Access Control
"""
from enum import Enum
from functools import wraps
from fastapi import HTTPException, status


class Role(str, Enum):
    EMPLOYEE = "employee"
    OFFICE_ADMIN = "office_admin"
    SUPER_ADMIN = "super_admin"
    GLOBAL_ADMIN = "global_admin"


# Role hierarchy: higher index = more permissions
ROLE_HIERARCHY = {
    Role.EMPLOYEE: 0,
    Role.OFFICE_ADMIN: 1,
    Role.SUPER_ADMIN: 2,
    Role.GLOBAL_ADMIN: 3,
}


def require_role(minimum_role: Role):
    """Dependency generator that checks if user has sufficient role."""
    def checker(current_user):
        user_level = ROLE_HIERARCHY.get(current_user.role, -1)
        required_level = ROLE_HIERARCHY.get(minimum_role, 99)
        if user_level < required_level:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail=f"Requires {minimum_role.value} role or higher"
            )
        return current_user
    return checker
