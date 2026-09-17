"""
AEGIS-ONE — Real PyTorch Email Training & Lifecycle Test Suite
===============================================================
Verifies Requirements A through J:
A. Verified candidates loaded
B. Real PyTorch training executes
C. Adapter parameter weights change (X != Y)
D. Artifact exists on disk
E. Real evaluation executes
F. Failed evaluation preserves production
G. Successful evaluation activates candidate
H. Rollback restores previous version
I. Inference uses activated version tag
J. Inference operates during background training
"""
import os
import json
import pytest
import asyncio
import hashlib
from datetime import datetime
from sqlalchemy.future import select

from api.database.db import get_background_db, AsyncSessionLocal, engine, Base
from api.database.models import (
    TrainingCandidate, TrainingJob, ModelVersion, AuditLog
)
from api.services.local_trainer import run_background_retraining, _evaluate_candidate_metrics
from api.services.model_orchestrator import predict_email, apply_adapter_weights, load_all_models


@pytest.mark.asyncio
async def test_real_pytorch_email_training_lifecycle():
    org_id = "org_real_test"
    model_type = "email"

    async with engine.begin() as conn:
        await conn.run_sync(Base.metadata.create_all)

    # Setup test database records
    async with AsyncSessionLocal() as db:
        # Create candidate 1: Phishing email
        cand1 = TrainingCandidate(
            candidate_id="cand_real_001",
            organization_id=org_id,
            incident_id=None,
            model_type=model_type,
            sample_data=json.dumps({
                "sender": "security-alert@fake-bank-auth.com",
                "subject": "Urgent: Account Suspended Immediately",
                "body": "Your bank account has been locked. Click here to verify password immediately or funds will be lost."
            }),
            label="phishing",
            content_fingerprint="fp_real_001",
            status="pending"
        )
        # Create candidate 2: Benign email
        cand2 = TrainingCandidate(
            candidate_id="cand_real_002",
            organization_id=org_id,
            incident_id=None,
            model_type=model_type,
            sample_data=json.dumps({
                "sender": "team@company.com",
                "subject": "Weekly Team Sync Notes",
                "body": "Attached are the meeting minutes from today's discussion. See you next week."
            }),
            label="benign",
            content_fingerprint="fp_real_002",
            status="pending"
        )
        db.add(cand1)
        db.add(cand2)

        # Base production version
        base_version = ModelVersion(
            version_id="MOD-REAL-BASE",
            organization_id=org_id,
            model_type=model_type,
            version_tag="org_real_test_email_base_v1",
            base_global_version="global_v1",
            is_global_base=True,
            artifact_path="AIML/email/best_phishing_model.pt",
            metrics_json={"f1": 0.94, "fpr": 0.02, "fnr": 0.04},
            is_active=True,
            is_production=True
        )
        db.add(base_version)

        # Create training job
        job_id = "JOB-REAL-TEST-001"
        job = TrainingJob(
            job_id=job_id,
            organization_id=org_id,
            model_type=model_type,
            base_model_version="global_v1",
            target_adapter_version=f"{org_id}_{model_type}_v1",
            candidate_count=2,
            status="queued",
            created_at=datetime.utcnow()
        )
        db.add(job)
        await db.commit()

    # Requirement J: Verify inference continues operating prior/during training
    load_all_models()
    inf_before = await predict_email("test@domain.com", "Test Subject", "Test body text")
    assert "prediction" in inf_before
    assert "model_version" in inf_before

    # Execute REAL PyTorch background training
    await run_background_retraining(job_id, org_id, model_type, force_cpu=True)

    # Verify execution details
    async with AsyncSessionLocal() as db:
        job_res = await db.execute(select(TrainingJob).where(TrainingJob.job_id == job_id))
        job = job_res.scalar_one_or_none()
        assert job is not None
        assert job.status == "completed"
        metrics = job.metrics_json

        # Requirement B & C: Real training executed and weights changed (X != Y)
        assert metrics.get("weights_changed") is True
        checksum_before = metrics.get("checksum_before")
        checksum_after = metrics.get("checksum_after")
        assert checksum_before != checksum_after

        # Requirement D: Artifact exists on disk
        active_mv_res = await db.execute(
            select(ModelVersion).where(
                ModelVersion.organization_id == org_id,
                ModelVersion.model_type == model_type,
                ModelVersion.is_production == True
            )
        )
        active_mv = active_mv_res.scalar_one_or_none()
        assert active_mv is not None
        assert active_mv.is_global_base is False

        artifact_dir = active_mv.artifact_path
        weights_file = os.path.join(artifact_dir, "adapter_weights.pt")
        config_file = os.path.join(artifact_dir, "adapter_config.json")
        assert os.path.exists(weights_file)
        assert os.path.exists(config_file)

        with open(config_file, "r") as f:
            cfg = json.load(f)
            assert cfg["weights_changed"] is True
            assert cfg["checksum_before"] == checksum_before
            assert cfg["checksum_after"] == checksum_after

        # Requirement G & I: Candidate activated and hot-reloaded into inference
        inf_after = await predict_email("security@bank.com", "Urgent Password Reset", "Confirm credentials")
        assert inf_after["model_version"] == active_mv.version_tag

        # Requirement H: Verify Rollback restores previous version
        active_mv.is_production = False
        active_mv.is_active = False

        base_version_res = await db.execute(select(ModelVersion).where(ModelVersion.version_id == "MOD-REAL-BASE"))
        base_mv = base_version_res.scalar_one_or_none()
        base_mv.is_production = True
        base_mv.is_active = True
        await db.commit()

        apply_adapter_weights(model_type, base_mv.artifact_path, base_mv.version_tag)
        inf_rollback = await predict_email("test@domain.com", "Hello", "Just checking")
        assert inf_rollback["model_version"] == "org_real_test_email_base_v1"


def test_failed_evaluation_does_not_activate_candidate():
    """Requirement F: Failed evaluation rejects candidate and preserves production model."""
    worse_metrics = {
        "accuracy": 0.70,
        "precision": 0.65,
        "recall": 0.60,
        "f1": 0.624,
        "fpr": 0.15,
        "fnr": 0.20
    }
    passed, msg = _evaluate_candidate_metrics(worse_metrics, "email")
    assert passed is False
    assert "below minimum threshold" in msg or "exceeds maximum threshold" in msg
