import asyncio
import sys
from sqlalchemy.ext.asyncio import create_async_engine, AsyncSession
from sqlalchemy.orm import sessionmaker
from sqlalchemy import select

from api.database.models import User, Department, Organization

DATABASE_URL = "postgresql+asyncpg://aegis_user:admin123@localhost:5432/aegisone"

async def main():
    engine = create_async_engine(DATABASE_URL)
    async_session = sessionmaker(engine, class_=AsyncSession, expire_on_commit=False)
    
    print("Database Diagnostic Tool")
    print("========================")
    
    async with async_session() as session:
        # Get all Organizations
        orgs = (await session.execute(select(Organization))).scalars().all()
        print(f"\n--- Organizations ({len(orgs)}) ---")
        for org in orgs:
            print(f"  - ID: {org.id!r} | Name: {org.name!r} | Domain: {org.domain!r}")
            
        # Get all Departments
        depts = (await session.execute(select(Department))).scalars().all()
        print(f"\n--- Departments ({len(depts)}) ---")
        for dept in depts:
            print(f"  - ID: {dept.id!r} | Org ID: {dept.organization_id!r} | Name: {dept.name!r} | Manager ID: {dept.manager_id!r}")
            
        # Get all Users
        users = (await session.execute(select(User))).scalars().all()
        print(f"\n--- Users ({len(users)}) ---")
        for u in users:
            print(f"  - ID: {u.id!r}")
            print(f"    Name: {u.full_name!r} | Email: {u.email!r}")
            print(f"    Role: {u.role!r} | Status: {u.account_status!r}")
            print(f"    Org ID: {u.organization_id!r} | Dept ID: {u.department_id!r} | Dept Name (Legacy): {u.department!r}")
            print("-" * 50)

if __name__ == "__main__":
    try:
        asyncio.run(main())
    except Exception as e:
        print(f"Error executing diagnostic script: {e}", file=sys.stderr)
