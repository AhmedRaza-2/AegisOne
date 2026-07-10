"""
AegisOne Unified Phishing Detection API
Entry point for the FastAPI application.

Production-grade configuration:
- 32-thread pool for concurrent PyTorch inference (asyncio.to_thread)
- ORJSONResponse for ~10x faster JSON serialization
- GZip compression for bandwidth savings
- Request tracing (X-Request-ID, X-Process-Time-Ms)
- Structured logging
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
import uvicorn

# Add the parent directory to sys.path to allow running `python main.py` directly
sys.path.append(os.path.abspath(os.path.join(os.path.dirname(__file__), '..')))

from api.config import API_HOST, API_PORT, API_WORKERS, MAX_CONCURRENCY
from api.database.db import init_db
from api.services.model_orchestrator import load_all_models

from api.routers import auth, scan, admin, health, compatibility

# ═══════════════════════════════════════════════════════════════
# LOGGING
# ═══════════════════════════════════════════════════════════════

logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s │ %(levelname)-7s │ %(name)s │ %(message)s",
    datefmt="%Y-%m-%d %H:%M:%S",
)
logger = logging.getLogger("aegisone")


# ═══════════════════════════════════════════════════════════════
# APP LIFECYCLE
# ═══════════════════════════════════════════════════════════════

@contextlib.asynccontextmanager
async def lifespan(app: FastAPI):
    # Startup
    logger.info("Initializing AegisOne API...")

    # Expand the default thread pool for asyncio.to_thread()
    # With 4 CPU cores, 8 workers (2× cores) gives optimal overlap when
    # the GIL is released during PyTorch C++ forward passes.
    # Too many threads (e.g. 32) on 4 cores = context switching overhead.
    num_workers = min(os.cpu_count() * 2, 16)  # 2× cores, capped at 16
    thread_pool = ThreadPoolExecutor(
        max_workers=num_workers,
        thread_name_prefix="aegis-inference",
    )
    asyncio.get_running_loop().set_default_executor(thread_pool)
    logger.info(f"Thread pool configured: {num_workers} workers ({os.cpu_count()} CPU cores)")

    await init_db()
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

# 1. GZip Compression — reduces payload size for JSON responses
app.add_middleware(GZipMiddleware, minimum_size=1000)

# 2. CORS
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],  # Restrict in production
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


# 3. Request ID + timing middleware
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

app.include_router(health.router)
app.include_router(auth.router)
app.include_router(scan.router)
app.include_router(admin.router)
app.include_router(compatibility.router)


@app.get("/")
async def root():
    return {
        "message": "Welcome to AegisOne Unified API",
        "docs": "/docs",
        "health": "/health"
    }


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
        log_level="info",
    )


if __name__ == "__main__":
    start()
