import asyncio
from api.database.db import engine, Base
# Important to import all models so metadata knows them
from api.database.models import User, Department, Organization, Device, ScanLog, SecurityEvent, Incident, AuditLog, Policy, ThreatReport, ManualScan, DashboardStatistic, DownloadEvent, CredentialEvent, WebsiteScan

async def reset():
    async with engine.begin() as conn:
        print("Dropping tables...")
        await conn.run_sync(Base.metadata.drop_all)
        print("Creating tables...")
        await conn.run_sync(Base.metadata.create_all)
        print("Database totally wiped and recreated.")

asyncio.run(reset())
