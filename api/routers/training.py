"""
AegisOne API — Admin Local Training & Model Lifecycle Router (Phases 2 & 3)
===========================================================================
Allows admins to view training candidate statistics, trigger background model retraining,
inspect training job progress, manage model versions, and trigger safe rollbacks.
"""
import uuid
import logging
from typing import List, Optional, Dict, Any
from datetime import datetime

from fastapi import APIRouter, Depends, HTTPException, status, BackgroundTasks, Query
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.future import select
from sqlalchemy import func, or_, and_

from api.database.db import get_db
from api.database.models import User, TrainingCandidate, TrainingJob, ModelVersion, AuditLog
from api.database.schemas import (
    TrainingCandidateSummary,
    RetrainRequest,
    TrainingJobResponse,
    ModelVersionResponse
)
from api.auth.roles import Role, require_role
from api.services.local_trainer import run_background_retraining

logger = logging.getLogger("aegisone.training_router")

router = APIRouter(prefix="/admin", tags=["Admin Local Training & Models"])


# ═══════════════════════════════════════════════════════════════
# PHASE 2: TRAINING CANDIDATE VIEWS
# ═══════════════════════════════════════════════════════════════

@router.get("/training-candidates/summary", response_model=TrainingCandidateSummary)
async def get_training_candidates_summary(
    current_user: User = Depends(require_role(Role.OFFICE_ADMIN)),
    db: AsyncSession = Depends(get_db),
):
    """
    Get aggregated summary of local verified training candidates.
    Never leaves the organization.
    """
    org_id = current_user.organization_id or "org_default"

    query = select(TrainingCandidate).where(TrainingCandidate.organization_id == org_id)
    result = await db.execute(query)
    candidates = result.scalars().all()

    total_verified = len(candidates)
    samples_by_model: Dict[str, int] = {}
    samples_by_class: Dict[str, Dict[str, int]] = {}
    pending_count = 0
    used_count = 0
    rejected_count = 0

    for c in candidates:
        m_type = c.model_type
        label = c.label

        samples_by_model[m_type] = samples_by_model.get(m_type, 0) + 1
        
        if m_type not in samples_by_class:
            samples_by_class[m_type] = {"benign": 0, "phishing": 0}
        samples_by_class[m_type][label] = samples_by_class[m_type].get(label, 0) + 1

        if c.status == "pending":
            pending_count += 1
        elif c.status == "used":
            used_count += 1
        elif c.status == "rejected":
            rejected_count += 1

    return TrainingCandidateSummary(
        total_verified_samples=total_verified,
        samples_by_model=samples_by_model,
        samples_by_class=samples_by_class,
        pending_candidates=pending_count,
        used_candidates=used_count,
        rejected_candidates=rejected_count
    )


@router.get("/training-candidates", response_model=List[Dict[str, Any]])
async def list_training_candidates(
    model_type: Optional[str] = None,
    status_filter: Optional[str] = Query(None, alias="status"),
    current_user: User = Depends(require_role(Role.OFFICE_ADMIN)),
    db: AsyncSession = Depends(get_db),
):
    """
    List individual training candidate samples.
    """
    org_id = current_user.organization_id or "org_default"
    query = select(TrainingCandidate).where(TrainingCandidate.organization_id == org_id)

    if model_type:
        query = query.where(TrainingCandidate.model_type == model_type)
    if status_filter:
        query = query.where(TrainingCandidate.status == status_filter.lower())

    query = query.order_by(TrainingCandidate.created_at.desc())
    result = await db.execute(query)
    cands = result.scalars().all()

    return [
        {
            "id": c.id,
            "candidate_id": c.candidate_id,
            "organization_id": c.organization_id,
            "incident_id": c.incident_id,
            "model_type": c.model_type,
            "label": c.label,
            "content_fingerprint": c.content_fingerprint,
            "sample_data": c.sample_data,
            "status": c.status,
            "created_at": c.created_at,
            "used_at": c.used_at
        }
        for c in cands
    ]


# ═══════════════════════════════════════════════════════════════
# PHASE 3: LOCAL RETRAINING & MODEL LIFECYCLE
# ═══════════════════════════════════════════════════════════════

@router.post("/models/retrain", response_model=TrainingJobResponse, status_code=status.HTTP_202_ACCEPTED)
async def trigger_model_retraining(
    payload: RetrainRequest,
    background_tasks: BackgroundTasks,
    current_user: User = Depends(require_role(Role.ADMIN)),
    db: AsyncSession = Depends(get_db),
):
    """
    Admin triggers asynchronous model retraining for a specific model type.
    Creates a TrainingJob and dispatches execution to background task worker.
    """
    org_id = current_user.organization_id or "org_default"
    model_type = payload.model_type.lower()

    valid_types = ["url", "email", "text", "image"]
    if model_type not in valid_types:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=f"Invalid model_type. Must be one of {valid_types}")

    # Count pending candidates
    pending_res = await db.execute(
        select(func.count(TrainingCandidate.id)).where(
            TrainingCandidate.organization_id == org_id,
            TrainingCandidate.model_type == model_type,
            TrainingCandidate.status == "pending"
        )
    )
    pending_count = pending_res.scalar_one_or_none() or 0

    if pending_count == 0:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"No pending verified training candidates available for '{model_type}' model."
        )

    job_id = f"JOB-{uuid.uuid4().hex[:8].upper()}"
    base_version = "global_v1"
    target_adapter_version = f"{org_id}_{model_type}_v{uuid.uuid4().hex[:4]}"

    job = TrainingJob(
        job_id=job_id,
        organization_id=org_id,
        model_type=model_type,
        base_model_version=base_version,
        target_adapter_version=target_adapter_version,
        candidate_count=pending_count,
        training_method="lora",
        status="queued",
        created_by_id=current_user.id
    )
    db.add(job)

    audit = AuditLog(
        organization_id=org_id,
        actor_email=current_user.email,
        action="MODEL_RETRAINING_TRIGGERED",
        module="local_learning",
        target=f"Retraining job {job_id} launched for {model_type} with {pending_count} samples",
        result="success",
        ip_address="127.0.0.1"
    )
    db.add(audit)

    await db.commit()
    await db.refresh(job)

    # Dispatch non-blocking background retraining
    background_tasks.add_task(
        run_background_retraining,
        job_id=job_id,
        organization_id=org_id,
        model_type=model_type,
        force_cpu=payload.force_cpu
    )

    logger.info(f"Retraining job {job_id} queued for org {org_id} ({model_type})")
    return job


@router.get("/training-jobs", response_model=List[TrainingJobResponse])
async def list_training_jobs(
    current_user: User = Depends(require_role(Role.OFFICE_ADMIN)),
    db: AsyncSession = Depends(get_db),
):
    """
    List all background retraining jobs for the admin's organization.
    """
    org_id = current_user.organization_id or "org_default"
    query = select(TrainingJob).where(TrainingJob.organization_id == org_id).order_by(TrainingJob.created_at.desc())
    result = await db.execute(query)
    return result.scalars().all()


@router.get("/training-jobs/{job_id}", response_model=TrainingJobResponse)
async def get_training_job_detail(
    job_id: str,
    current_user: User = Depends(require_role(Role.OFFICE_ADMIN)),
    db: AsyncSession = Depends(get_db),
):
    """
    Get progress, evaluation metrics, or error message of a training job.
    """
    org_id = current_user.organization_id or "org_default"
    query = select(TrainingJob).where(
        TrainingJob.job_id == job_id,
        TrainingJob.organization_id == org_id
    )
    result = await db.execute(query)
    job = result.scalar_one_or_none()
    if not job:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Training job not found.")
    return job


@router.get("/models", response_model=List[ModelVersionResponse])
async def list_model_versions(
    current_user: User = Depends(require_role(Role.OFFICE_ADMIN)),
    db: AsyncSession = Depends(get_db),
):
    """
    List all registered model versions (production, active, and rollbacks).
    """
    org_id = current_user.organization_id or "org_default"
    query = select(ModelVersion).where(
        or_(ModelVersion.organization_id == org_id, ModelVersion.is_global_base == True)
    ).order_by(ModelVersion.created_at.desc())
    result = await db.execute(query)
    return result.scalars().all()


@router.post("/models/{version_id}/activate", response_model=Dict[str, Any])
async def activate_model_version(
    version_id: str,
    current_user: User = Depends(require_role(Role.ADMIN)),
    db: AsyncSession = Depends(get_db),
):
    """
    Manually activate a specific trained adapter version as active production model.
    """
    org_id = current_user.organization_id or "org_default"

    res = await db.execute(
        select(ModelVersion).where(
            ModelVersion.version_id == version_id,
            ModelVersion.organization_id == org_id
        )
    )
    target_mod = res.scalar_one_or_none()
    if not target_mod:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Model version not found.")

    # Deactivate current active production version for this model_type
    prods_res = await db.execute(
        select(ModelVersion).where(
            ModelVersion.organization_id == org_id,
            ModelVersion.model_type == target_mod.model_type,
            ModelVersion.is_production == True
        )
    )
    for p in prods_res.scalars().all():
        p.is_production = False
        p.is_active = False

    target_mod.is_active = True
    target_mod.is_production = True

    # Trigger dynamic model hot-reload in orchestrator
    from api.services.model_orchestrator import apply_adapter_weights
    apply_adapter_weights(target_mod.model_type, target_mod.artifact_path, target_mod.version_tag)

    audit = AuditLog(
        organization_id=org_id,
        actor_email=current_user.email,
        action="MODEL_ACTIVATED",
        module="local_learning",
        target=f"Model version {version_id} ({target_mod.version_tag}) set to production",
        result="success",
        ip_address="127.0.0.1"
    )
    db.add(audit)

    await db.commit()
    return {"status": "success", "message": f"Model version '{target_mod.version_tag}' activated as production."}


@router.post("/models/{version_id}/rollback", response_model=Dict[str, Any])
async def rollback_model_version(
    version_id: str,
    current_user: User = Depends(require_role(Role.ADMIN)),
    db: AsyncSession = Depends(get_db),
):
    """
    Roll back production model to a previously known-good version.
    """
    org_id = current_user.organization_id or "org_default"

    res = await db.execute(
        select(ModelVersion).where(
            ModelVersion.version_id == version_id,
            ModelVersion.organization_id == org_id
        )
    )
    rollback_target = res.scalar_one_or_none()
    if not rollback_target:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Target rollback model version not found.")

    # Deactivate current active model
    prods_res = await db.execute(
        select(ModelVersion).where(
            ModelVersion.organization_id == org_id,
            ModelVersion.model_type == rollback_target.model_type,
            ModelVersion.is_production == True
        )
    )
    for p in prods_res.scalars().all():
        p.is_production = False
        p.is_active = False

    rollback_target.is_active = True
    rollback_target.is_production = True

    # Trigger dynamic model hot-reload in orchestrator
    from api.services.model_orchestrator import apply_adapter_weights
    apply_adapter_weights(rollback_target.model_type, rollback_target.artifact_path, rollback_target.version_tag)

    audit = AuditLog(
        organization_id=org_id,
        actor_email=current_user.email,
        action="MODEL_ROLLBACK_EXECUTED",
        module="local_learning",
        target=f"Model rolled back to {rollback_target.version_tag} ({version_id})",
        result="success",
        ip_address="127.0.0.1"
    )
    db.add(audit)

    await db.commit()
    return {"status": "success", "message": f"Rolled back to model version '{rollback_target.version_tag}'."}
