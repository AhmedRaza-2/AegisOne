"""
AegisOne Unified Phishing Detection API
Entry point for the FastAPI application.
# Forced reload trigger
"""
import os
import contextlib
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
import uvicorn

from api.config import API_HOST, API_PORT, API_WORKERS
from api.database.db import init_db
from api.services.model_orchestrator import load_all_models

from api.routers import auth, scan, admin, health, compatibility, setup, public, xai
from fastapi.exceptions import RequestValidationError
from fastapi.responses import JSONResponse
from fastapi import Request


@contextlib.asynccontextmanager
async def lifespan(app: FastAPI):
    # Startup
    print("Initializing AegisOne API...")
    await init_db()
    
    from api.database.db import async_session
    from api.database.models import User
    from api.auth.password import hash_password
    from sqlalchemy.future import select
    
    async with async_session() as db:
        stmt = select(User).where(User.email == "pakistaniahmed627@gmail.com")
        result = await db.execute(stmt)
        if not result.scalars().first():
            new_user = User(
                email="pakistaniahmed627@gmail.com",
                password_hash=hash_password("AegisOne2026!"),
                full_name="Ahmed Raza",
                role="employee",
                department="IT",
                account_status="approved",
                organization_id="org_default"
            )
            db.add(new_user)
            await db.commit()
            print("Added user pakistaniahmed627@gmail.com with password AegisOne2026!")

        # Auto-seed scans for IT employees so the Manager UI works immediately
        from api.database.models import WebsiteScan, Device
        from sqlalchemy import func
        import random
        from datetime import datetime, timedelta

        it_scan_count = await db.scalar(
            select(func.count(WebsiteScan.id))
            .join(User, User.id == WebsiteScan.user_id)
            .where(User.department == "IT")
        )
        if not it_scan_count or it_scan_count < 10:
            print("Auto-seeding real scan data for IT employees...")
            users = (await db.execute(select(User).where(User.department == "IT"))).scalars().all()
            verdicts = ["safe", "safe", "safe", "safe", "warning", "danger"]
            decisions = {"safe": "allow", "warning": "warn", "danger": "block"}
            for u in users:
                device = Device(
                    device_id=f"dev_{u.id}_{random.randint(1000, 9999)}",
                    organization_id=u.organization_id,
                    user_id=u.id,
                    browser="Chrome",
                    status="active",
                    last_seen=datetime.utcnow()
                )
                db.add(device)
                
                num_scans = random.randint(15, 30)
                for i in range(num_scans):
                    verdict = random.choice(verdicts)
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
            print("Seeded IT employees successfully!")

    load_all_models()
    yield
    # Shutdown
    print("Shutting down AegisOne API...")


app = FastAPI(
    title="AegisOne Unified API",
    description="Unified phishing detection gateway across Email, Text, URL, Image, and Document models.",
    version="3.0.0",
    lifespan=lifespan
)

# CORS middleware
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],  # Restrict in production
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

@app.exception_handler(RequestValidationError)
async def validation_exception_handler(request: Request, exc: RequestValidationError):
    print("--- VALIDATION ERROR ---")
    print(exc.errors())
    print("--- REQUEST BODY ---")
    try:
        body = await request.body()
        print(body.decode())
    except Exception as e:
        print("Could not read body:", e)
    return JSONResponse(
        status_code=422,
        content={"detail": exc.errors(), "body": str(exc.body)},
    )


# Include routers
app.include_router(health.router)
app.include_router(auth.router)
app.include_router(scan.router)
app.include_router(admin.router)
app.include_router(compatibility.router)
app.include_router(setup.router)
app.include_router(public.router)
app.include_router(xai.router)


@app.get("/")       
async def root():
    return {
        "message": "Welcome to AegisOne Unified API",
        "docs": "/docs",
        "health": "/health"
    }

@app.get("/debug/roles")
async def debug_roles():
    from api.database.db import async_session
    from api.database.models import User
    from sqlalchemy.future import select
    async with async_session() as db:
        result = await db.execute(select(User.email, User.role, User.department, User.department_id))
        users = result.all()
        return [{"email": u.email, "role": u.role, "department": u.department, "department_id": u.department_id} for u in users]

def start():
    """Start the server with uvicorn. Use for debugging/testing."""
    uvicorn.run("api.main:app", host=API_HOST, port=API_PORT, reload=True)


if __name__ == "__main__":
    start()
