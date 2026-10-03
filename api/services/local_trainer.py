"""
AegisOne API — Local Learning Worker
=====================================
Turns an organisation's VERIFIED incidents into a small, revocable correction layer
(see api/services/calibration.py). The base AI models are never modified.

Safety rules enforced here:
  * Refuses to run until there are enough verified examples of BOTH kinds
    (AEGIS_MIN_TRAIN_SAMPLES / AEGIS_MIN_TRAIN_PER_CLASS, default 20 / 5).
  * Validates on held-out data and compares against the unmodified base model.
  * Activates only if it is no worse on false alarms / misses and measurably better somewhere;
    otherwise the job is "rejected" and nothing changes.
  * Every accepted version is stored on disk and in the registry, and can be switched off or
    replaced at any time (base behaviour returns instantly).
"""
import os
import json
import uuid
import logging
from datetime import datetime
from typing import Dict, Any

from sqlalchemy.future import select

from api.database.db import get_background_db
from api.database.models import TrainingCandidate, TrainingJob, ModelVersion, AuditLog
from api.services import calibration

logger = logging.getLogger("aegisone.local_trainer")

BASE_DIR = os.path.abspath(os.path.join(os.path.dirname(__file__), "..", ".."))
ADAPTER_BASE_DIR = os.path.join(BASE_DIR, "AIML", "adapters")


def _evaluate_candidate_metrics(report: Dict[str, Any], model_type: str = "") -> tuple:
    """Kept for callers/tests: same decision as calibration.evaluate()."""
    return calibration.evaluate(report)


async def run_background_retraining(job_id: str, organization_id: str, model_type: str, force_cpu: bool = False):
    """Background worker entry point. Uses its own database session."""
    logger.info("[JOB %s] Learning job started: org=%s model=%s", job_id, organization_id, model_type)
    db = await get_background_db()
    try:
        job = (await db.execute(select(TrainingJob).where(TrainingJob.job_id == job_id))).scalar_one_or_none()
        if not job:
            logger.error("[JOB %s] TrainingJob record not found.", job_id)
            return

        job.status = "running"
        job.started_at = datetime.utcnow()
        await db.commit()

        # Everything verified for this model (pending + already learned): the adapter is always fitted
        # on the whole verified history, so it improves cumulatively instead of drifting on new batches.
        res = await db.execute(select(TrainingCandidate).where(
            TrainingCandidate.organization_id == organization_id,
            TrainingCandidate.model_type == model_type,
            TrainingCandidate.status.in_(["pending", "used"]),
        ))
        verified = res.scalars().all()
        pending = [c for c in verified if c.status == "pending"]
        job.candidate_count = len(verified)
        job.training_method = "calibration_adapter"

        report = calibration.train_and_validate(verified)
        ok, why = calibration.evaluate(report)
        job.metrics_json = report
        job.completed_at = datetime.utcnow()

        if not ok:
            job.status = "rejected"
            job.error_message = why
            db.add(AuditLog(
                organization_id=organization_id, actor_email="system@aegisone.local",
                action="MODEL_TRAINING_REJECTED", module="local_learning",
                target=f"{model_type}: {why}", result="warning", ip_address="127.0.0.1",
            ))
            await db.commit()
            logger.warning("[JOB %s] Not activated - base model unchanged. %s", job_id, why)
            return

        # Persist the adapter (two numbers) next to the metrics that justified it.
        version_tag = f"{organization_id}_{model_type}_{uuid.uuid4().hex[:6]}"
        target_dir = os.path.join(ADAPTER_BASE_DIR, organization_id, model_type, version_tag)
        os.makedirs(target_dir, exist_ok=True)
        artifact = {"adapter_type": "calibration", "model_type": model_type, "a": report["a"], "b": report["b"],
                    "max_shift": calibration.MAX_SHIFT, "samples": report["samples"], "job_id": job_id,
                    "created": datetime.utcnow().isoformat(), "metrics": report}
        with open(os.path.join(target_dir, "calibration.json"), "w", encoding="utf-8") as f:
            json.dump(artifact, f, indent=2)

        for prev in (await db.execute(select(ModelVersion).where(
                ModelVersion.organization_id == organization_id, ModelVersion.model_type == model_type,
                ModelVersion.is_production == True))).scalars().all():  # noqa: E712
            prev.is_production = False
            prev.is_active = False

        db.add(ModelVersion(
            version_id=f"MOD-{uuid.uuid4().hex[:8].upper()}", organization_id=organization_id,
            model_type=model_type, version_tag=version_tag, base_global_version="global_v1",
            is_global_base=False, artifact_path=target_dir, metrics_json=report,
            is_active=True, is_production=True,
        ))
        for c in pending:
            c.status = "used"
            c.used_in_job_id = job_id
            c.used_at = datetime.utcnow()
        job.status = "completed"
        job.target_adapter_version = version_tag

        from api.services.model_orchestrator import apply_adapter_weights
        apply_adapter_weights(model_type, target_dir, version_tag)

        cand, base = report["candidate"], report["base"]
        db.add(AuditLog(
            organization_id=organization_id, actor_email="system@aegisone.local",
            action="MODEL_TRAINED_AND_ACTIVATED", module="local_learning",
            target=(f"{model_type} adapter {version_tag} activated on {report['samples']} verified samples "
                    f"(held-out F1 {cand['f1']:.0%} vs base {base['f1']:.0%}, false alarms {cand['fpr']:.0%} vs {base['fpr']:.0%})"),
            result="success", ip_address="127.0.0.1",
        ))
        await db.commit()
        logger.info("[JOB %s] Adapter ACTIVE: %s (held-out F1 %.0f%% vs base %.0f%%)", job_id, version_tag, cand["f1"] * 100, base["f1"] * 100)

    except Exception as e:
        logger.exception("[JOB %s] Exception during learning job: %s", job_id, e)
        try:
            j = (await db.execute(select(TrainingJob).where(TrainingJob.job_id == job_id))).scalar_one_or_none()
            if j:
                j.status = "failed"
                j.error_message = str(e)
                j.completed_at = datetime.utcnow()
                await db.commit()
        except Exception:
            pass
    finally:
        await db.close()
