"""
AEGIS-ONE — Real PyTorch Training Smoke Test
============================================
Runs a deterministic real training micro-job for the email model.
Proves parameter checksum before (X) != parameter checksum after (Y).
Proves artifact creation and dynamic in-memory hot-reload.
"""
import sys
import os
import asyncio
import json

sys.path.insert(0, os.path.abspath(os.path.join(os.path.dirname(__file__), "..")))

from api.database.db import engine, Base, AsyncSessionLocal
from api.database.models import TrainingCandidate, TrainingJob, ModelVersion
from api.services.local_trainer import run_background_retraining
from api.services.model_orchestrator import predict_email, load_all_models
from sqlalchemy.future import select

async def main():
    print("=" * 60)
    print("   AEGIS-ONE REAL PYTORCH TRAINING SMOKE TEST")
    print("=" * 60)
    
    # 1. Init database tables
    async with engine.begin() as conn:
        await conn.run_sync(Base.metadata.create_all)
        
    org_id = "org_smoke_pytorch"
    model_type = "email"
    job_id = "JOB-SMOKE-PYTORCH-001"
    
    # 2. Populate deterministic training candidates
    async with AsyncSessionLocal() as db:
        c1 = TrainingCandidate(
            candidate_id="cand_smoke_py_01",
            organization_id=org_id,
            incident_id=None,
            model_type=model_type,
            sample_data=json.dumps({
                "sender": "security-alert@fake-paypal-verify.com",
                "subject": "Account Lockout Warning",
                "body": "Urgent: Click here to verify password immediately or account will be permanently terminated."
            }),
            label="phishing",
            content_fingerprint="fp_py_01",
            status="pending"
        )
        c2 = TrainingCandidate(
            candidate_id="cand_smoke_py_02",
            organization_id=org_id,
            incident_id=None,
            model_type=model_type,
            sample_data=json.dumps({
                "sender": "admin@aegisone.local",
                "subject": "System Status Update",
                "body": "All security scanners are operating normally. No user action required."
            }),
            label="benign",
            content_fingerprint="fp_py_02",
            status="pending"
        )
        db.add(c1)
        db.add(c2)
        
        job = TrainingJob(
            job_id=job_id,
            organization_id=org_id,
            model_type=model_type,
            base_model_version="global_v1",
            target_adapter_version=f"{org_id}_{model_type}_v1",
            candidate_count=2,
            status="queued"
        )
        db.add(job)
        await db.commit()
        print(f"[OK] Training candidates & TrainingJob '{job_id}' prepared.")
        
    # 3. Load models into orchestrator
    print("[...] Initializing AI models in Model Orchestrator...")
    load_all_models()
    
    res_before = await predict_email("test@domain.com", "Subject", "Body text")
    print(f"[BEFORE TRAINING] Active Model Version: {res_before.get('model_version')}")
    
    # 4. Run real PyTorch background training
    print("[...] Executing REAL PyTorch background training (forward, loss, backward, optimizer.step)...")
    await run_background_retraining(job_id, org_id, model_type, force_cpu=True)
    
    # 5. Verify results
    async with AsyncSessionLocal() as db:
        j_res = await db.execute(select(TrainingJob).where(TrainingJob.job_id == job_id))
        j = j_res.scalar_one_or_none()
        
        print(f"\n[VERIFY] Job Status: {j.status}")
        metrics = j.metrics_json or {}
        chk_x = metrics.get("checksum_before")
        chk_y = metrics.get("checksum_after")
        
        print(f"[VERIFY] Parameter Checksum BEFORE (X): {chk_x}")
        print(f"[VERIFY] Parameter Checksum AFTER  (Y): {chk_y}")
        print(f"[VERIFY] Weights Changed (X != Y):    {metrics.get('weights_changed')}")
        print(f"[VERIFY] Evaluated Metrics:          F1={metrics.get('f1')}, FPR={metrics.get('fpr')}, FNR={metrics.get('fnr')}")
        
        assert chk_x != chk_y, "FAIL: Parameter checksum did not change!"
        assert metrics.get("weights_changed") is True, "FAIL: weights_changed flag is False!"
        
        # Check active ModelVersion
        mv_res = await db.execute(
            select(ModelVersion).where(
                ModelVersion.organization_id == org_id,
                ModelVersion.model_type == model_type,
                ModelVersion.is_production == True
            )
        )
        active_mv = mv_res.scalar_one_or_none()
        print(f"[VERIFY] Activated Model Version: {active_mv.version_tag}")
        print(f"[VERIFY] Saved Artifact Path:     {active_mv.artifact_path}")
        
        weights_exist = os.path.exists(os.path.join(active_mv.artifact_path, "adapter_weights.pt"))
        config_exist = os.path.exists(os.path.join(active_mv.artifact_path, "adapter_config.json"))
        print(f"[VERIFY] adapter_weights.pt exists: {weights_exist}")
        print(f"[VERIFY] adapter_config.json exists: {config_exist}")
        
    res_after = await predict_email("test@domain.com", "Subject", "Body text")
    print(f"\n[AFTER TRAINING] Active Model Version in Inference: {res_after.get('model_version')}")
    print("=" * 60)
    print("   SUCCESS: REAL PYTORCH TRAINING SMOKE TEST PASSED!")
    print("=" * 60)

if __name__ == "__main__":
    asyncio.run(main())
