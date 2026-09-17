"""
AegisOne — Safe Retraining & Lifecycle Smoke Test
"""
import sys
import os
import asyncio
import json
from datetime import datetime

# Ensure root in sys.path
sys.path.insert(0, os.path.abspath(os.path.join(os.path.dirname(__file__), "..")))

from api.database.db import engine, Base, AsyncSessionLocal
from api.database.models import (
    User, TrainingCandidate, TrainingJob, ModelVersion, AuditLog
)
from api.services.local_trainer import run_background_retraining
from sqlalchemy.future import select

async def main():
    print("=== AEGIS-ONE REAL RETRAINING SMOKE TEST ===")
    
    # Init DB tables if needed
    async with engine.begin() as conn:
        await conn.run_sync(Base.metadata.create_all)
        
    async with AsyncSessionLocal() as db:
        org_id = "org_smoke_test"
        model_type = "url"
        
        # 1. Clean up existing test records
        await db.execute(
            select(TrainingCandidate).where(TrainingCandidate.organization_id == org_id)
        )
        
        # 2. Add a dummy pending TrainingCandidate
        cand = TrainingCandidate(
            candidate_id="cand_test_001",
            organization_id=org_id,
            incident_id="inc_test_001",
            model_type=model_type,
            sample_data="https://phishing-smoke-test-domain.xyz/login",
            label="phishing",
            content_fingerprint="fp_smoke_test_12345",
            status="pending"
        )
        db.add(cand)
        
        # Add initial base production model
        base_mv = ModelVersion(
            version_id="MOD-SMOKE-BASE",
            organization_id=org_id,
            model_type=model_type,
            version_tag=f"{org_id}_{model_type}_base",
            base_global_version="global_v1",
            is_global_base=True,
            artifact_path="AIML/url/best_v3.pt",
            metrics_json={"f1": 0.92, "accuracy": 0.93, "fpr": 0.03, "fnr": 0.05},
            is_active=True,
            is_production=True
        )
        db.add(base_mv)
        
        # Create retraining job
        job_id = "job_smoke_001"
        job = TrainingJob(
            job_id=job_id,
            organization_id=org_id,
            model_type=model_type,
            status="queued",
            created_at=datetime.utcnow()
        )
        db.add(job)
        await db.commit()
        print(f"[OK] TrainingJob '{job_id}' queued with 1 candidate sample.")
        
    # 3. Execute background retraining worker
    print("[...] Running background retraining execution...")
    await run_background_retraining(job_id, org_id, model_type, force_cpu=True)
    
    # 4. Verify results
    async with AsyncSessionLocal() as db:
        job_res = await db.execute(select(TrainingJob).where(TrainingJob.job_id == job_id))
        job = job_res.scalar_one_or_none()
        
        print(f"[VERIFY] TrainingJob Status: {job.status}")
        print(f"[VERIFY] Metrics JSON: {job.metrics_json}")
        
        # Check candidate status
        cand_res = await db.execute(select(TrainingCandidate).where(TrainingCandidate.candidate_id == "cand_test_001"))
        cand = cand_res.scalar_one_or_none()
        print(f"[VERIFY] Candidate status after job: {cand.status}")
        
        # Check production models
        mv_res = await db.execute(
            select(ModelVersion).where(ModelVersion.organization_id == org_id, ModelVersion.model_type == model_type)
        )
        mvs = mv_res.scalars().all()
        for m in mvs:
            print(f"[VERIFY] Model {m.version_id} ({m.version_tag}): is_production={m.is_production}, artifact_path={m.artifact_path}")
            if m.is_production and not m.is_global_base:
                adapter_conf = os.path.join(m.artifact_path, "adapter_config.json")
                exists = os.path.exists(adapter_conf)
                print(f"[VERIFY] Candidate Artifact File ({adapter_conf}) exists: {exists}")
                if exists:
                    with open(adapter_conf, "r") as f:
                        print(f"        Adapter Config Content:\n{json.dumps(json.load(f), indent=2)}")

if __name__ == "__main__":
    asyncio.run(main())
