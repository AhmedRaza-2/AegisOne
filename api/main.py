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

from api.routers import auth, scan, admin, health, compatibility, setup, public, xai, communication
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
    
    import shutil
    try:
        shutil.copy(r"d:\Coding Projects\AegisOne\frontend\logo.png", r"d:\Coding Projects\AegisOne\frontend\landing\public\logo.png")
        shutil.copy(r"d:\Coding Projects\AegisOne\frontend\logo.png", r"d:\Coding Projects\AegisOne\frontend\dashboard\public\logo.png")
        logger.info("Logo copied to landing and dashboard public folders successfully!")
    except Exception as e:
        logger.warning(f"Could not copy logo: {e}")

    from api.database.db import async_session, engine
    from api.database.models import Organization, Department, WebsiteScan, Device, AuditLog, Message, ThreatReport
    from sqlalchemy.future import select
    from sqlalchemy import delete, update, text

    # Ensure missing columns (e.g. SMTP fields on organizations) are auto-migrated dynamically
    async with engine.begin() as conn:
        dialect_name = engine.dialect.name
        for col_def in [
            ("smtp_host", "VARCHAR(255) DEFAULT 'smtp.gmail.com'"),
            ("smtp_port", "INTEGER DEFAULT 587"),
            ("smtp_user", "VARCHAR(255)"),
            ("smtp_pass", "VARCHAR(255)")
        ]:
            col_name, col_type = col_def
            if dialect_name == "postgresql":
                await conn.execute(text(f"""
                    DO $$
                    BEGIN
                        IF NOT EXISTS (
                            SELECT 1 FROM information_schema.columns 
                            WHERE table_name='organizations' AND column_name='{col_name}'
                        ) THEN
                            ALTER TABLE organizations ADD COLUMN {col_name} {col_type};
                        END IF;
                    END $$;
                """))
            else:
                try:
                    await conn.execute(text(f"ALTER TABLE organizations ADD COLUMN {col_name} {col_type};"))
                except Exception:
                    pass

    async with async_session() as db:
        # ── Ensure org_default exists (PostgreSQL enforces FKs — orgs row must exist before departments)
        org_exists = (await db.execute(select(Organization).where(Organization.id == "org_default"))).scalars().first()
        if not org_exists:
            db.add(Organization(id="org_default", name="AegisOne", domain=None, plan="standard", timezone="UTC"))
            await db.flush()

        # ── Clean up stale mock telemetry from previous runs (safe on empty tables too)
        await db.execute(update(Department).values(manager_id=None))
        await db.execute(delete(WebsiteScan))
        await db.execute(delete(Device))
        await db.execute(delete(AuditLog))
        await db.execute(delete(Message))
        await db.execute(delete(ThreatReport))
        await db.commit()
        logger.info("Database startup: org_default ensured, SMTP columns verified, stale telemetry cleared.")

    load_all_models()
    
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
cors_allowed_origins = os.environ.get("AEGIS_ALLOWED_ORIGINS", "").split(",")
cors_allowed_origins = [o.strip() for o in cors_allowed_origins if o.strip()]
if not cors_allowed_origins:
    cors_allowed_origins = [
        "http://localhost:3000",
        "http://localhost:3002",
        "http://127.0.0.1:3000",
        "http://127.0.0.1:3002",
    ]

app.add_middleware(
    CORSMiddleware,
    allow_origins=cors_allowed_origins,
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


# 4. Request ID + timing middleware + security headers
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
    response.headers["X-Frame-Options"] = "DENY"
    response.headers["X-Content-Type-Options"] = "nosniff"
    response.headers["Referrer-Policy"] = "strict-origin-when-cross-origin"
    response.headers["Strict-Transport-Security"] = "max-age=31536000; includeSubDomains"

    return response


# ═══════════════════════════════════════════════════════════════
# ROUTERS
# ═══════════════════════════════════════════════════════════════
app.include_router(health.router)
app.include_router(auth.router)
app.include_router(scan.router)
app.include_router(admin.router)
app.include_router(compatibility.router)
app.include_router(setup.router)
app.include_router(public.router)
app.include_router(xai.router)
app.include_router(communication.router)


@app.get("/")       
async def root():
    return {
        "message": "Welcome to AegisOne Unified API",
        "docs": "/docs",
        "health": "/health"
    }

from fastapi import Depends
from api.database.models import User
from api.auth.roles import require_role, Role

@app.get("/debug/roles")
async def debug_roles(current_user: User = Depends(require_role(Role.SUPER_ADMIN))):
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
