import asyncio
from sqlalchemy import select, func
from api.database.db import async_session
from api.database.models import User
from api.auth.roles import Role

async def check():
    async with async_session() as session:
        # 1. Fetch muhid
        stmt = select(User).where(User.email == "muhidbaloach01@gmail.com")
        res = await session.execute(stmt)
        user = res.scalars().first()
        print(f"User role: {user.role}, org_id: {user.organization_id}")
        
        # 2. Replicate _org_scope
        query = select(func.count(User.id))
        if user.role != Role.SUPER_ADMIN.value:
            org_id = user.organization_id or "org_default"
            query = query.where(User.organization_id == org_id)
        
        print("Query:", query)
        total_users = await session.scalar(query)
        print("Total users:", total_users)

asyncio.run(check())
