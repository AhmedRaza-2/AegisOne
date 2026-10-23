"""
AegisOne API — improved model weights, organisation side
=========================================================
Train on the organisation's own server, submit to the vendor hub, receive vendor releases.
See api/services/weights_pipeline.py for the whole flow.
"""
import uuid
import logging
from datetime import datetime
from typing import Any, Dict

from fastapi import APIRouter, Depends, HTTPException, BackgroundTasks, status
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.future import select

from api.database.db import get_db
from api.database.models import (
    User, TrainingCandidate, TrainingJob, ModelVersion, AuditLog, WeightPackage, GlobalModelRelease, OrgLearningPolicy,
)
from api.auth.roles import Role, require_role
from api.services import weights_pipeline as wp
from api.services import weight_trainer as wt
from api.services import license as lic

logger = logging.getLogger("aegisone.model_updates")
router = APIRouter(prefix="/admin/model-updates", tags=["Model Updates"])


def _org(user: User) -> str:
    return user.organization_id or "org_default"


def _pkg_out(p: WeightPackage) -> Dict[str, Any]:
    rep = p.metrics_json or {}
    return {
        "package_id": p.package_id, "model_type": p.model_type, "version_tag": p.version_tag, "status": p.status,
        "checksum": p.checksum, "created_at": p.created_at, "submitted_at": p.submitted_at,
        "vendor_submission_id": p.vendor_submission_id, "vendor_verdict": p.vendor_verdict_json,
        "samples": rep.get("samples"), "org_holdout": rep.get("org_holdout"), "reference": rep.get("reference"),
        "reasons": rep.get("reasons"),
    }


@router.get("/status")
async def model_update_status(user: User = Depends(require_role(Role.ADMIN)), db: AsyncSession = Depends(get_db)):
    org = _org(user)
    pol = (await db.execute(select(OrgLearningPolicy).where(OrgLearningPolicy.organization_id == org))).scalar_one_or_none()
    ready = len((await db.execute(select(TrainingCandidate.id).where(
        TrainingCandidate.organization_id == org, TrainingCandidate.model_type == "url",
        TrainingCandidate.status.in_(["pending", "used"])))).all())
    active = (await db.execute(select(ModelVersion).where(
        ModelVersion.organization_id == org, ModelVersion.model_type == "url", ModelVersion.is_production == True))).scalars().first()  # noqa: E712
    return {
        "verified_url_samples": ready, "min_samples": wt.MIN_SAMPLES, "min_per_class": wt.MIN_PER_CLASS,
        "active_version": active.version_tag if active else "shipped base (v7)",
        "vendor_configured": bool(wp.VENDOR_URL), "licensed": bool(lic.ORG_ID and lic.LICENSE_KEY),
        "contribution_allowed": bool(pol and pol.allow_global_contribution), "gate": wt.GATE,
    }


@router.post("/train", status_code=status.HTTP_202_ACCEPTED)
async def train_weights(bg: BackgroundTasks, user: User = Depends(require_role(Role.ADMIN)), db: AsyncSession = Depends(get_db)):
    """Fine-tune the URL model heads on this organisation's verified incidents, on this server."""
    org = _org(user)
    running = (await db.execute(select(TrainingJob).where(
        TrainingJob.organization_id == org, TrainingJob.status.in_(["queued", "running"])))).scalars().first()
    if running:
        raise HTTPException(status_code=409, detail=f"Job {running.job_id} is still running.")
    n = len((await db.execute(select(TrainingCandidate.id).where(
        TrainingCandidate.organization_id == org, TrainingCandidate.model_type == "url",
        TrainingCandidate.status.in_(["pending", "used"])))).all())
    if n < wt.MIN_SAMPLES:
        raise HTTPException(status_code=400, detail=f"Need at least {wt.MIN_SAMPLES} verified URL incidents to learn safely (have {n}).")
    job = TrainingJob(job_id=f"JOB-{uuid.uuid4().hex[:8].upper()}", organization_id=org, model_type="url", base_model_version="v7",
                      target_adapter_version="pending", candidate_count=n, training_method="head_finetune", status="queued",
                      created_by_id=user.id)
    db.add(job)
    db.add(AuditLog(organization_id=org, actor_email=user.email, action="WEIGHTS_TRAINING_TRIGGERED", module="model_weights",
                    target=f"Server-side head training {job.job_id} on {n} verified URLs", result="success", ip_address="127.0.0.1"))
    await db.commit()
    bg.add_task(wp.run_weight_training, job.job_id, org)
    return {"job_id": job.job_id, "status": "queued", "samples": n}


@router.get("/packages")
async def list_packages(user: User = Depends(require_role(Role.OFFICE_ADMIN)), db: AsyncSession = Depends(get_db)):
    rows = (await db.execute(select(WeightPackage).where(WeightPackage.organization_id == _org(user))
                             .order_by(WeightPackage.created_at.desc()))).scalars().all()
    return [_pkg_out(p) for p in rows]


@router.post("/packages/{package_id}/submit")
async def submit_package(package_id: str, user: User = Depends(require_role(Role.ADMIN)), db: AsyncSession = Depends(get_db)):
    """Send a locally validated package to the vendor. Needs the organisation's explicit contribution policy."""
    org = _org(user)
    pkg = (await db.execute(select(WeightPackage).where(WeightPackage.package_id == package_id, WeightPackage.organization_id == org))).scalar_one_or_none()
    if not pkg:
        raise HTTPException(status_code=404, detail="Package not found.")
    pol = (await db.execute(select(OrgLearningPolicy).where(OrgLearningPolicy.organization_id == org))).scalar_one_or_none()
    if not pol or not pol.allow_global_contribution:
        raise HTTPException(status_code=403, detail="Global contribution is OFF for this organization. Enable it in Global Learning settings first.")
    if pkg.status in ("submitted", "accepted"):
        raise HTTPException(status_code=409, detail="This package was already submitted.")
    try:
        out = await wp.submit_package(pkg, org_name=org)
    except Exception as e:
        raise HTTPException(status_code=502, detail=str(e))
    pkg.status = "submitted"; pkg.vendor_submission_id = out.get("submission_id"); pkg.submitted_at = datetime.utcnow()
    db.add(AuditLog(organization_id=org, actor_email=user.email, action="WEIGHTS_SUBMITTED", module="model_weights",
                    target=f"Package {pkg.package_id} ({pkg.version_tag}) sent to the vendor as {pkg.vendor_submission_id}",
                    result="success", ip_address="127.0.0.1"))
    await db.commit()
    return _pkg_out(pkg)


@router.get("/packages/{package_id}/vendor-status")
async def package_vendor_status(package_id: str, user: User = Depends(require_role(Role.OFFICE_ADMIN)), db: AsyncSession = Depends(get_db)):
    pkg = (await db.execute(select(WeightPackage).where(WeightPackage.package_id == package_id, WeightPackage.organization_id == _org(user)))).scalar_one_or_none()
    if not pkg or not pkg.vendor_submission_id:
        raise HTTPException(status_code=404, detail="No vendor submission for this package.")
    try:
        v = await wp.refresh_vendor_status(pkg)
    except Exception as e:
        raise HTTPException(status_code=502, detail=f"Vendor hub unreachable: {e}")
    pkg.vendor_verdict_json = v
    if v.get("status") == "approved":
        pkg.status = "accepted"
    elif v.get("status") in ("rejected", "failed"):
        pkg.status = "rejected"
    await db.commit()
    return _pkg_out(pkg)


@router.get("/releases")
async def list_releases(refresh: bool = True, user: User = Depends(require_role(Role.OFFICE_ADMIN)), db: AsyncSession = Depends(get_db)):
    """Vendor releases available to this organisation (synced from the hub when it is reachable)."""
    error = None
    if refresh and wp.VENDOR_URL:
        try:
            await wp.pull_releases(db)
        except Exception as e:
            error = f"Vendor hub unreachable: {e}"
    rows = (await db.execute(select(GlobalModelRelease).where(GlobalModelRelease.status == "active")
                             .order_by(GlobalModelRelease.created_at.desc()))).scalars().all()
    active = (await db.execute(select(ModelVersion).where(
        ModelVersion.organization_id == _org(user), ModelVersion.model_type == "url", ModelVersion.is_production == True))).scalars().first()  # noqa: E712
    return {
        "vendor_configured": bool(wp.VENDOR_URL), "error": error,
        "active_version": active.version_tag if active else "shipped base (v7)",
        "releases": [{"release_id": r.release_id, "version_tag": r.version_tag, "model_type": r.model_type, "checksum": r.checksum,
                      "metrics": r.metrics_json, "release_notes": r.release_notes, "created_at": r.created_at,
                      "deployed": bool(active and active.version_tag == f"AEGIS_{r.version_tag}")} for r in rows],
    }


@router.post("/releases/{release_id}/deploy", status_code=status.HTTP_202_ACCEPTED)
async def deploy_release(release_id: str, bg: BackgroundTasks, user: User = Depends(require_role(Role.ADMIN)), db: AsyncSession = Depends(get_db)):
    org = _org(user)
    rel = (await db.execute(select(GlobalModelRelease).where(GlobalModelRelease.release_id == release_id, GlobalModelRelease.status == "active"))).scalar_one_or_none()
    if not rel:
        raise HTTPException(status_code=404, detail="Release not found.")
    job = TrainingJob(job_id=f"JOB-{uuid.uuid4().hex[:8].upper()}", organization_id=org, model_type=rel.model_type, base_model_version=rel.version_tag,
                      target_adapter_version="pending", candidate_count=0, training_method="release_validation", status="queued", created_by_id=user.id)
    db.add(job)
    await db.commit()
    bg.add_task(wp.validate_and_deploy_release, job.job_id, org, release_id)
    return {"job_id": job.job_id, "status": "queued"}


@router.post("/revert")
async def revert_to_shipped_base(user: User = Depends(require_role(Role.ADMIN)), db: AsyncSession = Depends(get_db)):
    """Switch the URL model back to the heads it shipped with."""
    import asyncio
    org = _org(user)
    for v in (await db.execute(select(ModelVersion).where(
            ModelVersion.organization_id == org, ModelVersion.model_type == "url", ModelVersion.is_production == True))).scalars().all():  # noqa: E712
        v.is_production = False; v.is_active = False
    from api.services.model_orchestrator import apply_head_weights
    ok = await asyncio.to_thread(apply_head_weights, None, "base_v7")
    wt.release_backbone()
    db.add(AuditLog(organization_id=org, actor_email=user.email, action="WEIGHTS_REVERTED", module="model_weights",
                    target="URL model returned to the shipped base heads", result="success" if ok else "warning", ip_address="127.0.0.1"))
    await db.commit()
    return {"status": "success" if ok else "partial", "message": "The URL model is back to its shipped base weights."}
