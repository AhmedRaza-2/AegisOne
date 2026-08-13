import asyncio
from datetime import datetime, timedelta, date
from sqlalchemy.ext.asyncio import create_async_engine, AsyncSession
from sqlalchemy.orm import sessionmaker
from sqlalchemy import select, func, cast, Date

from api.database.models import User, WebsiteScan

DATABASE_URL = "postgresql+asyncpg://aegis_user:admin123@localhost:5432/aegisone"

async def main():
    engine = create_async_engine(DATABASE_URL)
    async_session = sessionmaker(engine, class_=AsyncSession, expire_on_commit=False)
    
    print("Checking Last 24 Hours Data from DB")
    print("===================================")
    
    async with async_session() as session:
        # Time bounds
        today_date = date.today()
        twenty_four_hours_ago = datetime.utcnow() - timedelta(hours=24)
        
        # 1. Fetch employee (ID 13)
        emp = (await session.execute(select(User).where(User.id == 13))).scalar_one_or_none()
        if not emp:
            print("Employee ID 13 not found in DB!")
            return
            
        print(f"Employee: {emp.full_name} ({emp.email}) | Dept: {emp.department}")
        
        # Employee scans in last 24 hours
        emp_scans_24h = await session.scalar(
            select(func.count(WebsiteScan.id))
            .where(WebsiteScan.user_id == emp.id)
            .where(WebsiteScan.created_at >= twenty_four_hours_ago)
        )
        # Employee scans today (calendar date)
        emp_scans_today = await session.scalar(
            select(func.count(WebsiteScan.id))
            .where(WebsiteScan.user_id == emp.id)
            .where(cast(WebsiteScan.created_at, Date) == today_date)
        )
        
        # Employee threats in last 24 hours
        emp_threats_24h = await session.scalar(
            select(func.count(WebsiteScan.id))
            .where(WebsiteScan.user_id == emp.id)
            .where(WebsiteScan.created_at >= twenty_four_hours_ago)
            .where(WebsiteScan.decision.in_(["warn", "block"]))
        )
        
        # Employee threats today
        emp_threats_today = await session.scalar(
            select(func.count(WebsiteScan.id))
            .where(WebsiteScan.user_id == emp.id)
            .where(cast(WebsiteScan.created_at, Date) == today_date)
            .where(WebsiteScan.decision.in_(["warn", "block"]))
        )
        
        print("\n--- Employee Personal Stats (ID 13) ---")
        print(f"  - Scans in Last 24 Hours: {emp_scans_24h}")
        print(f"  - Scans Today (Calendar Date): {emp_scans_today}")
        print(f"  - Threats in Last 24 Hours: {emp_threats_24h}")
        print(f"  - Threats Today (Calendar Date): {emp_threats_today}")
        
        # 2. Fetch IT department users
        it_users_stmt = select(User.id).where(User.department == "IT")
        it_user_ids = (await session.execute(it_users_stmt)).scalars().all()
        print(f"\nIT Department User IDs: {it_user_ids}")
        
        # Department scans in last 24 hours
        dept_scans_24h = await session.scalar(
            select(func.count(WebsiteScan.id))
            .where(WebsiteScan.user_id.in_(it_user_ids))
            .where(WebsiteScan.created_at >= twenty_four_hours_ago)
        )
        # Department scans today
        dept_scans_today = await session.scalar(
            select(func.count(WebsiteScan.id))
            .where(WebsiteScan.user_id.in_(it_user_ids))
            .where(cast(WebsiteScan.created_at, Date) == today_date)
        )
        
        # Department threats in last 24 hours
        dept_threats_24h = await session.scalar(
            select(func.count(WebsiteScan.id))
            .where(WebsiteScan.user_id.in_(it_user_ids))
            .where(WebsiteScan.created_at >= twenty_four_hours_ago)
            .where(WebsiteScan.decision.in_(["warn", "block"]))
        )
        
        # Department threats today
        dept_threats_today = await session.scalar(
            select(func.count(WebsiteScan.id))
            .where(WebsiteScan.user_id.in_(it_user_ids))
            .where(cast(WebsiteScan.created_at, Date) == today_date)
            .where(WebsiteScan.decision.in_(["warn", "block"]))
        )
        
        print("\n--- IT Department Stats (For Manager) ---")
        print(f"  - Total Scans in Last 24 Hours: {dept_scans_24h}")
        print(f"  - Total Scans Today (Calendar Date): {dept_scans_today}")
        print(f"  - Total Threats in Last 24 Hours: {dept_threats_24h}")
        print(f"  - Total Threats Today (Calendar Date): {dept_threats_today}")

if __name__ == "__main__":
    asyncio.run(main())
