import asyncio
import os
import sys

# Ensure project root is in sys.path
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))

from api.database.db import AsyncSessionLocal
from sqlalchemy import text

async def cleanup():
    async with AsyncSessionLocal() as session:
        print("Cleaning up database table values...")
        await session.execute(text("""
            TRUNCATE TABLE 
                website_scans, 
                threat_reports, 
                audit_logs, 
                security_events, 
                download_events, 
                credential_events, 
                devices, 
                messages, 
                departments, 
                users 
            CASCADE;
        """))
        await session.commit()
        print("All database table records cleaned up successfully! (Schema preserved)")

if __name__ == "__main__":
    asyncio.run(cleanup())
