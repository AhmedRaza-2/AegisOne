import asyncio
import random
from datetime import datetime, timedelta
from sqlalchemy.future import select
from api.database.db import async_session
from api.database.models import User, WebsiteScan, Device

async def seed_scans():
    async with async_session() as db:
        # Fetch IT employees
        result = await db.execute(select(User).where(User.department == "IT"))
        users = result.scalars().all()
        
        if not users:
            print("No IT users found.")
            return

        print(f"Seeding scans for {len(users)} IT employees...")
        
        verdicts = ["safe", "safe", "safe", "safe", "warning", "danger"]
        decisions = {"safe": "allow", "warning": "warn", "danger": "block"}

        for u in users:
            # Create a device for them so 'Protected Devices' goes up
            device = Device(
                device_id=f"dev_{u.id}_{random.randint(1000, 9999)}",
                organization_id=u.organization_id,
                user_id=u.id,
                browser="Chrome",
                status="active",
                last_seen=datetime.utcnow()
            )
            db.add(device)
            
            # Generate 15-30 scans per user
            num_scans = random.randint(15, 30)
            for i in range(num_scans):
                verdict = random.choice(verdicts)
                
                # Make some scans today, some in the past week
                days_ago = random.randint(0, 7)
                scan_date = datetime.utcnow() - timedelta(days=days_ago)
                
                scan = WebsiteScan(
                    scan_id=f"scan_{u.id}_{i}_{random.randint(10000, 99999)}",
                    organization_id=u.organization_id,
                    user_id=u.id,
                    url=f"https://example{random.randint(1, 100)}.com",
                    verdict=verdict,
                    decision=decisions[verdict],
                    created_at=scan_date
                )
                db.add(scan)
                
        await db.commit()
        print("Database seeded with real dynamic scans and devices!")

if __name__ == "__main__":
    asyncio.run(seed_scans())
