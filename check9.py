import asyncio
from sqlalchemy import select
from api.database.db import async_session
from api.database.models import User
from api.routers.admin import get_stats

async def check():
    async with async_session() as db:
        stmt = select(User).where(User.email == "muhidbaloach01@gmail.com")
        user = (await db.execute(stmt)).scalars().first()
        
        try:
            stats = await get_stats(db=db, current_user=user)
            print("STATS:", stats)
        except Exception as e:
            print("ERROR:", str(e))
            import traceback
            traceback.print_exc()

asyncio.run(check())
