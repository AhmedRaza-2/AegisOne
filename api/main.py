"""
AegisOne Unified Phishing Detection API
Entry point for the FastAPI application.
<<<<<<< HEAD
# Forced reload trigger
=======

Production-grade configuration:
- SlowAPI rate limiting (60 req/s default)
- GZip response compression
- ORjson serialization (~10x faster than stdlib json)
- Structured logging
- Multi-worker support via uvicorn
>>>>>>> ff262510555dc5ea98c2935a24986f2270118617
"""
import os
import sys
import platform
import logging
import asyncio
from concurrent.futures import ThreadPoolExecutor
import contextlib
from fastapi import FastAPI, Request, Response
from fastapi.middleware.cors import CORSMiddleware
from fastapi.middleware.gzip import GZipMiddleware
from fastapi.responses import ORJSONResponse
from slowapi import Limiter, _rate_limit_exceeded_handler
from slowapi.util import get_remote_address
from slowapi.errors import RateLimitExceeded
import uvicorn

# Add the parent directory to sys.path to allow running `python main.py` directly
sys.path.append(os.path.abspath(os.path.join(os.path.dirname(__file__), '..')))

from api.config import (
    API_HOST, API_PORT, API_WORKERS, MAX_CONCURRENCY,
    RATE_LIMIT, GZIP_MIN_SIZE, LOG_LEVEL,
)
from api.database.db import init_db
from api.services.model_orchestrator import load_all_models

from api.routers import auth, scan, admin, health, compatibility, setup, public, xai
from fastapi.exceptions import RequestValidationError
from fastapi.responses import JSONResponse
from fastapi import Request

# ═══════════════════════════════════════════════════════════════
# LOGGING
# ═══════════════════════════════════════════════════════════════

logging.basicConfig(
    level=getattr(logging, LOG_LEVEL.upper(), logging.INFO),
    format="%(asctime)s │ %(levelname)-7s │ %(name)s │ %(message)s",
    datefmt="%Y-%m-%d %H:%M:%S",
)
logger = logging.getLogger("aegisone")

# ═══════════════════════════════════════════════════════════════
# RATE LIMITER
# ═══════════════════════════════════════════════════════════════

limiter = Limiter(key_func=get_remote_address, default_limits=[RATE_LIMIT])

# ═══════════════════════════════════════════════════════════════
# APP LIFECYCLE
# ═══════════════════════════════════════════════════════════════


@contextlib.asynccontextmanager
async def lifespan(app: FastAPI):
    # Startup
    logger.info("Initializing AegisOne API...")

    # Expand the default thread pool for asyncio.to_thread()
    # Default is ~5 threads — far too few for 60+ concurrent inference requests
    thread_pool = ThreadPoolExecutor(
        max_workers=32,
        thread_name_prefix="aegis-inference"
    )
    asyncio.get_running_loop().set_default_executor(thread_pool)
    logger.info(f"Thread pool configured: 32 workers")

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
    
    # Pre-warm the cache for load tests and start background queue workers
    await scan.on_startup()
    
    logger.info("AegisOne API ready — accepting requests")
    yield
    # Shutdown
    logger.info("Shutting down AegisOne API...")
    thread_pool.shutdown(wait=False)


app = FastAPI(
    title="AegisOne Unified API",
    description="Unified phishing detection gateway across Email, Text, URL, Image, and Document models.",
    version="3.0.0",
    lifespan=lifespan,
    default_response_class=ORJSONResponse,  # ~10x faster JSON serialization
)

# ═══════════════════════════════════════════════════════════════
# MIDDLEWARE STACK (order matters — outermost runs first)
# ═══════════════════════════════════════════════════════════════

# 1. Rate Limiter
app.state.limiter = limiter
app.add_exception_handler(RateLimitExceeded, _rate_limit_exceeded_handler)

# 2. GZip Compression
app.add_middleware(GZipMiddleware, minimum_size=GZIP_MIN_SIZE)

# 3. CORS
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],  # Restrict in production
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

<<<<<<< HEAD
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
=======

# 4. Request ID + timing middleware
@app.middleware("http")
async def add_request_metadata(request: Request, call_next):
    """Inject X-Request-ID and X-Process-Time headers for traceability."""
    import uuid
    import time

    request_id = request.headers.get("X-Request-ID", str(uuid.uuid4())[:12])
    start = time.perf_counter()

    response: Response = await call_next(request)

    process_time = round((time.perf_counter() - start) * 1000, 2)
    response.headers["X-Request-ID"] = request_id
    response.headers["X-Process-Time-Ms"] = str(process_time)

    return response


# ═══════════════════════════════════════════════════════════════
# ROUTERS
# ═══════════════════════════════════════════════════════════════

>>>>>>> ff262510555dc5ea98c2935a24986f2270118617
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

# ═══════════════════════════════════════════════════════════════
# SERVER ENTRYPOINT
# ═══════════════════════════════════════════════════════════════

def start():
    """
    Start the server with uvicorn.

    Architecture note:
    On Windows, uvicorn workers>1 uses multiprocessing.spawn which re-imports
    the entire module (including torch, transformers, ~2GB) in each child process.
    This is extremely slow and crashes. Instead, we run a single process with:
    - A 32-thread pool for asyncio.to_thread() (handles concurrent inference)
    - Semaphore-guarded model access (prevents OOM)
    - All async I/O (DB, OCR, etc.) via the event loop

    This single-process async architecture easily handles 60+ req/s.
    """
    is_dev = os.environ.get("AEGIS_DEV", "0") == "1"
    is_windows = platform.system() == "Windows"

    # On Windows: always 1 worker (multiprocessing + torch is broken)
    # On Linux: can use multiple workers safely (fork, not spawn)
    workers = 1 if is_windows else API_WORKERS

    if is_windows and API_WORKERS > 1:
        logger.info(
            f"Windows detected — using 1 process + 32-thread pool "
            f"(multiprocessing with torch is unsupported on Windows)"
        )

    uvicorn.run(
        "api.main:app",
        host=API_HOST,
        port=API_PORT,
        workers=workers,
        reload=is_dev,
        limit_concurrency=MAX_CONCURRENCY,
        access_log=is_dev,
        log_level=LOG_LEVEL.lower(),
    )


if __name__ == "__main__":
    start()
