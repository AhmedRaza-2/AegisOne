import asyncio
from dotenv import load_dotenv

load_dotenv()
from api.database.db import async_session
from sqlalchemy import select
from api.database.models import User
from api.auth.password import verify_password

async def test_login():
    async with async_session() as db:
        result = await db.execute(select(User).where(User.email == 'admin@aegisone.com'))
        user = result.scalar_one_or_none()
        if user:
            print("Found user:", user.email)
            print("Password match:", verify_password("Admin123!", user.password_hash))
            print("Is active:", user.is_active)
            print("Account status:", user.account_status)
        else:
            print("User not found")

if __name__ == "__main__":
    asyncio.run(test_login())
