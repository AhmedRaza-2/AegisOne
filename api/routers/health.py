"""
AegisOne API — Health Router
"""
from fastapi import APIRouter
from api.database.schemas import HealthResponse, ModelStatus
from api.services.model_orchestrator import DEVICE, get_model_status

router = APIRouter(prefix="/health", tags=["System"])

@router.get("", response_model=HealthResponse)
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
