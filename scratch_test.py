import asyncio
from sqlalchemy.ext.asyncio import create_async_engine, AsyncSession
from sqlalchemy.orm import sessionmaker
from sqlalchemy import text

async def main():
    engine = create_async_engine("postgresql+asyncpg://postgres:postgres@localhost:5432/aegisone")
    async_session = sessionmaker(engine, class_=AsyncSession, expire_on_commit=False)
    
    async with async_session() as session:
        result = await session.execute(text("SELECT id, email, organization_id, department_id FROM users WHERE email LIKE '%e2etest%';"))
        users = result.fetchall()
        print("--- USERS ---")
        for u in users:
            print(dict(u._mapping))
            
        result = await session.execute(text("SELECT id, name, organization_id FROM departments WHERE name = 'Information Technology' OR code = 'ENG';"))
        depts = result.fetchall()
        print("--- DEPARTMENTS ---")
        for d in depts:
            print(dict(d._mapping))

asyncio.run(main())
