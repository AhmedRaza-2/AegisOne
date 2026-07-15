import asyncio
import uuid
from datetime import datetime, timezone, timedelta
from dotenv import load_dotenv

load_dotenv()

from api.database.db import async_session, init_db
from api.database.models import User
from api.auth.password import hash_password

async def seed():
    await init_db()
    async with async_session() as db:
        print("Seeding admins...")
        
        # Super Admin
        sa = User(
            organization_id="org_default",
            email="superadmin@aegisone.com",
            password_hash=hash_password("SuperAdmin123!"),
            full_name="System Superadmin",
            role="super_admin",
            department="IT",
            account_status="approved",
            is_active=True
        )
        db.add(sa)
        
        # Admin
        a = User(
            organization_id="org_default",
            email="admin@aegisone.com",
            password_hash=hash_password("Admin123!"),
            full_name="System Admin",
            role="admin",
            department="IT",
            account_status="approved",
            is_active=True
        )
        db.add(a)

        # Standard User
        u = User(
            organization_id="org_default",
            email="user@aegisone.com",
            password_hash=hash_password("User123!"),
            full_name="Standard User",
            role="user",
            department="HR",
            account_status="approved",
            is_active=True
        )
        db.add(u)
        
        await db.commit()
        print("Done! Admins created.")

if __name__ == "__main__":
    asyncio.run(seed())
