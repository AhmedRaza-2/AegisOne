import asyncio
import sys
from sqlalchemy.ext.asyncio import create_async_engine, AsyncSession
from sqlalchemy.orm import sessionmaker
from sqlalchemy import select

from api.database.models import User
from api.routers.admin import get_stats, get_users

DATABASE_URL = "postgresql+asyncpg://aegis_user:admin123@localhost:5432/aegisone"

async def test_manager_endpoints():
    engine = create_async_engine(DATABASE_URL)
    async_session = sessionmaker(engine, class_=AsyncSession, expire_on_commit=False)
    
    print("Testing Manager Endpoints with strict scoping...")
    
    async with async_session() as session:
        # Fetch manager (ID 7)
        manager = (await session.execute(select(User).where(User.id == 7))).scalar_one_or_none()
        if not manager:
            print("Manager with ID 7 not found in DB!")
            return
            
        print(f"Logged in as Manager: {manager.full_name} ({manager.email})")
        print(f"Manager Department ID: {manager.department_id}, Department Name: {manager.department}")
        
        # Test get_users
        try:
            print("\nCalling get_users...")
            users_res = await get_users(db=session, manager=manager)
            print(f"Success! Users found: {len(users_res.get('users', []))}")
            for u in users_res.get('users', []):
                print(f"  - User: {u['full_name']} | Dept ID: {u['department_id']} | Dept Name: {u['department']} | Role: {u['role']}")
        except Exception as e:
            print(f"ERROR calling get_users: {e}")
            import traceback
            traceback.print_exc()
            
        # Test get_stats
        try:
            print("\nCalling get_stats...")
            stats_res = await get_stats(db=session, current_user=manager)
            print("Success! Stats:")
            print(f"  - total_users: {stats_res.total_users}")
            print(f"  - total_scans: {stats_res.total_scans}")
            print(f"  - scans_today: {stats_res.scans_today}")
            print(f"  - threats_detected: {stats_res.threats_detected}")
            print(f"  - threats_today: {stats_res.threats_today}")
            print(f"  - active_devices: {stats_res.active_devices}")
            print(f"  - top_threat_types: {stats_res.top_threat_types}")
            print(f"  - daily_trend (7 Days):")
            for day in stats_res.daily_trend:
                print(f"    * {day['date']}: Scans: {day['scans']} | Safe: {day['safe']} | Threats: {day['threats']}")
        except Exception as e:
            print(f"ERROR calling get_stats: {e}")
            import traceback
            traceback.print_exc()

if __name__ == "__main__":
    asyncio.run(test_manager_endpoints())
