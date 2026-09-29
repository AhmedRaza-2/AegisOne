"""
AegisOne API — Health Router
"""
import asyncio
from fastapi import APIRouter, Request
from fastapi.responses import JSONResponse
from sqlalchemy import text
from api.database.db import async_session
from api.database.schemas import HealthResponse, ModelStatus
from api.services.model_orchestrator import DEVICE, get_model_status

router = APIRouter(prefix="/health", tags=["System"])
ready_router = APIRouter(tags=["System"])

@router.get("", response_model=HealthResponse)
@router.get("/", response_model=HealthResponse)
async def health_check():
    statuses = get_model_status()
    models_status = {
        name: ModelStatus(status=info["status"], loaded=info["loaded"])
        for name, info in statuses.items()
    }
    
    return HealthResponse(
        status="ok",
        device=str(DEVICE),
        models=models_status
    )


@ready_router.get("/ready")
async def readiness_check(request: Request):
    """Readiness: 200 only when startup finished, the DB answers, and models are loaded.
    /health only proves the process is alive; the setup UI polls this instead."""
    startup_complete = bool(getattr(request.app.state, "startup_complete", False))

    database_ok = False
    if startup_complete:
        try:
            async def _ping():
                async with async_session() as db:
                    await db.execute(text("SELECT 1"))
            await asyncio.wait_for(_ping(), timeout=3)
            database_ok = True
        except Exception:
            database_ok = False

    models_loaded = sum(1 for info in get_model_status().values() if info["loaded"])
    models_ok = models_loaded > 0

    is_ready = startup_complete and database_ok and models_ok
    body = {
        "status": "ready" if is_ready else "starting",
        "startup": startup_complete,
        "database": database_ok,
        "models": models_ok,
        "models_loaded": models_loaded,
    }
    return JSONResponse(status_code=200 if is_ready else 503, content=body)
