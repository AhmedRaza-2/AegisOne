import asyncio
import uuid
from datetime import datetime, timezone, timedelta
from dotenv import load_dotenv

load_dotenv()

from api.database.db import async_session
from api.database.models import DownloadEvent, WebsiteScan, SecurityEvent

async def seed():
    async with async_session() as db:
        now = datetime.now(timezone.utc)
        
        print("Seeding dummy file download data...")
        # 1. Blocked Download
        db.add(DownloadEvent(
            download_id=f"dl-{int(now.timestamp())}-1",
            organization_id="org_default",
            filename="invoice_urgent_update.exe",
            sha256="e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855",
            risk_score=95,
            decision="block",
            threat_type="Malware / Trojan",
            created_at=now - timedelta(hours=1)
        ))
        
        # 2. Warned Download (Proceeded at risk)
        db.add(DownloadEvent(
            download_id=f"dl-{int(now.timestamp())}-2",
            organization_id="org_default",
            filename="financial_report_2026.docm",
            sha256="xyz0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855",
            risk_score=65,
            decision="warn",
            threat_type="Suspicious Macros",
            created_at=now - timedelta(hours=3)
        ))
        
        # 3. Safe Download
        db.add(DownloadEvent(
            download_id=f"dl-{int(now.timestamp())}-3",
            organization_id="org_default",
            filename="company_logo.png",
            sha256="abc0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855",
            risk_score=5,
            decision="allow",
            threat_type="Safe",
            created_at=now - timedelta(hours=5)
        ))

        # Also add some WebsiteScans so the main dashboard isn't completely empty
        print("Seeding dummy website scans...")
        db.add(WebsiteScan(
            scan_id=f"aegis-{int(now.timestamp())}-4",
            organization_id="org_default",
            scan_type="url",
            url="http://login-update-secure.com",
            domain="login-update-secure.com",
            risk_score=88,
            threat_type="Phishing",
            decision="block",
            created_at=now - timedelta(minutes=15)
        ))

        db.add(WebsiteScan(
            scan_id=f"aegis-{int(now.timestamp())}-5",
            organization_id="org_default",
            scan_type="url",
            url="https://google.com",
            domain="google.com",
            risk_score=2,
            threat_type="Safe",
            decision="allow",
            created_at=now - timedelta(minutes=45)
        ))
        
        await db.commit()
        print("Done! Refresh your dashboard.")

if __name__ == "__main__":
    asyncio.run(seed())
