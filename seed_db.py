import asyncio
import os
import sys

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))

from api.database.db import get_background_db, engine, Base
from api.database.models import Organization, Department, User, ScanLog, Incident, AuditLog
from api.auth.password import hash_password
from sqlalchemy import text
import uuid

async def seed_data():
    print("Recreating database tables...")
    async with engine.begin() as conn:
        # Import models to ensure they are registered
        from api.database.models import Organization, Department, User, ScanLog, Incident, AuditLog  # noqa: F401
        
        if "sqlite" not in engine.url.drivername:
            # Drop known and legacy tables with CASCADE to handle dependent constraints
            await conn.execute(text("DROP TABLE IF EXISTS audit_logs, incidents, scans, users, departments, organizations, broadcasts CASCADE;"))
            
        await conn.run_sync(Base.metadata.drop_all)
        await conn.run_sync(Base.metadata.create_all)

    async with await get_background_db() as session:
        print("Seeding Organizations...")
        org1 = Organization(name="AegisOne Corp", domain="aegisone.com", plan="enterprise", is_active=True)
        org2 = Organization(name="U Bank Limited", domain="ubank.com.pk", plan="enterprise", is_active=True)
        session.add_all([org1, org2])
        await session.commit()
        await session.refresh(org1)
        await session.refresh(org2)

        print("Seeding Departments...")
        dept1 = Department(organization_id=org1.id, name="Security Operations")
        dept2 = Department(organization_id=org2.id, name="IT Services")
        dept3 = Department(organization_id=org2.id, name="HR")
        session.add_all([dept1, dept2, dept3])
        await session.commit()
        await session.refresh(dept1)
        await session.refresh(dept2)
        await session.refresh(dept3)

        print("Seeding Users...")
        # Hash password as 'smart123'
        hashed_pw = hash_password("smart123")
        
        user1 = User(
            email="head@aegisone.com",
            password_hash=hashed_pw,
            full_name="Platform Head",
            role="global_admin",
            organization_id=org1.id,
            department_id=dept1.id,
        )
        user2 = User(
            email="admin@ubank.com.pk",
            password_hash=hashed_pw,
            full_name="Super Admin",
            role="super_admin",
            organization_id=org2.id,
            department_id=dept2.id,
        )
        user3 = User(
            email="ahmed.raza@ubank.com.pk",
            password_hash=hashed_pw,
            full_name="Supervisor Ahmed",
            role="office_admin",
            organization_id=org2.id,
            department_id=dept2.id,
        )
        user4 = User(
            email="ali.mazhar@ubank.com.pk",
            password_hash=hashed_pw,
            full_name="Employee Ali",
            role="employee",
            organization_id=org2.id,
            department_id=dept2.id,
        )
        
        session.add_all([user1, user2, user3, user4])
        await session.commit()
        await session.refresh(user1)
        await session.refresh(user2)
        await session.refresh(user3)
        await session.refresh(user4)

        print("Seeding Scan Logs...")
        scan1 = ScanLog(
            scan_id=str(uuid.uuid4()),
            user_id=user4.id,
            scan_type="email",
            input_summary="Urgent: Reset your bank password",
            overall_risk_score=85,
            verdict="malicious",
            is_threat=True,
            models_used={"nlp": "v2", "heuristics": "v1.5"},
            processing_time_ms=450.2
        )
        scan2 = ScanLog(
            scan_id=str(uuid.uuid4()),
            user_id=user4.id,
            scan_type="url",
            input_summary="https://safe-company-portal.com",
            overall_risk_score=10,
            verdict="safe",
            is_threat=False,
            models_used={"url_scanner": "v3"},
            processing_time_ms=120.0
        )
        session.add_all([scan1, scan2])
        await session.commit()
        await session.refresh(scan1)
        await session.refresh(scan2)

        print("Seeding Incidents...")
        inc1 = Incident(
            scan_id=scan1.id,
            reported_by_id=user4.id,
            severity="high",
            status="open",
            notes="Phishing attempt detected in employee inbox."
        )
        session.add(inc1)
        await session.commit()
        
        print("Seeding Audit Logs...")
        audit1 = AuditLog(
            user_id=user1.id,
            action="user.created",
            target_type="User",
            target_id=str(user2.id),
            details={"message": "Global admin provisioned a super admin for U Bank"}
        )
        session.add(audit1)
        await session.commit()

        print("Database Seeded Successfully!")

if __name__ == "__main__":
    asyncio.run(seed_data())
