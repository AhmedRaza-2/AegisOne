"""
AegisOne — improved-weights pipeline (org server  ->  vendor hub  ->  every org server)
========================================================================================
1. ORG SERVER   run_weight_training(): fine-tune the URL model heads on the organisation's verified
                 incidents, on the server, and gate the result locally. A package is only created when
                 it beats the current model without regressions.
2. SUBMISSION    submit_package(): the admin (policy permitting) sends the ~1 MB heads package to the
                 vendor hub, signed in with the organisation's ORG_ID / LICENSE_KEY / DEPLOYMENT_TOKEN.
3. VENDOR HUB    evaluate_submission_job(): the vendor re-validates the package, benchmarks it against
                 the CURRENT baseline on data the organisation never saw, and - if the gate passes -
                 promotes it to a new global release automatically. A vendor admin can override.
4. EVERY ORG     validate_and_deploy_release(): downloads the release, checks its checksum, re-checks it
                 against that organisation's own verified data, and only then switches to it. Reverting
                 to the shipped base is one call.
Nothing here ever runs on an employee's or admin's machine.
"""
import os
import uuid
import logging
import hashlib
from datetime import datetime
from pathlib import Path
from typing import Any, Dict, Optional

import numpy as np
from sqlalchemy.future import select

from api.database.db import get_background_db
from api.database.models import (
    TrainingCandidate, TrainingJob, ModelVersion, AuditLog, WeightPackage, VendorSubmission, GlobalModelRelease,
)
from api.services import weight_trainer as wt

logger = logging.getLogger("aegisone.weights_pipeline")

BASE_DIR = Path(__file__).resolve().parents[2]
DATA_DIR = Path(os.environ.get("AEGIS_DATA_DIR", str(BASE_DIR / "AIML" / "adapters")))
VENDOR_URL = os.environ.get("AEGIS_VENDOR_URL", "").strip().rstrip("/")
AUTO_PROMOTE = os.environ.get("AEGIS_VENDOR_AUTO_PROMOTE", "1") != "0"
MAX_PACKAGE_BYTES = 5 * 1024 * 1024


def _audit(db, org_id: str, action: str, target: str, result: str = "success", actor: str = "system@aegisone.local"):
    db.add(AuditLog(organization_id=org_id, actor_email=actor, action=action, module="model_weights",
                    target=target[:500], result=result, ip_address="127.0.0.1"))


def _url_samples(cands) -> tuple:
    urls, labels = [], []
    for c in cands:
        data = c.sample_data if isinstance(c.sample_data, dict) else {}
        ref = str(data.get("target_ref") or "").strip()
        if not ref or c.label not in ("phishing", "benign"):
            continue
        urls.append(ref)
        labels.append(1 if c.label == "phishing" else 0)
    return urls, labels


# ═════════════════════════════════════════════════════════════════════════════════════
# 1. ORG SERVER: train + gate + (maybe) activate locally
# ═════════════════════════════════════════════════════════════════════════════════════

async def run_weight_training(job_id: str, organization_id: str):
    import asyncio
    db = await get_background_db()
    try:
        job = (await db.execute(select(TrainingJob).where(TrainingJob.job_id == job_id))).scalar_one_or_none()
        if not job:
            return
        job.status = "running"; job.started_at = datetime.utcnow(); await db.commit()

        cands = (await db.execute(select(TrainingCandidate).where(
            TrainingCandidate.organization_id == organization_id, TrainingCandidate.model_type == "url",
            TrainingCandidate.status.in_(["pending", "used"])))).scalars().all()
        urls, labels = _url_samples(cands)
        job.candidate_count = len(urls)
        job.training_method = "head_finetune"

        # CPU/GPU heavy: keep it off the event loop
        res = await asyncio.to_thread(wt.train_org_heads, urls, labels)
        job.metrics_json = res["report"]
        job.completed_at = datetime.utcnow()

        if not res["accepted"]:
            job.status = "rejected"
            job.error_message = "; ".join(res["reasons"])[:1000]
            _audit(db, organization_id, "WEIGHTS_TRAINING_REJECTED", f"url heads not activated: {job.error_message}", "warning")
            await db.commit()
            logger.warning("[JOB %s] weights not activated: %s", job_id, job.error_message)
            return

        tag = f"{organization_id}_url_w{uuid.uuid4().hex[:6]}"
        path = DATA_DIR / organization_id / "url" / tag / "heads.pt"
        sha = wt.save_heads(path, res["heads"], {"org": organization_id, "job": job_id, "created": datetime.utcnow().isoformat()})

        for prev in (await db.execute(select(ModelVersion).where(
                ModelVersion.organization_id == organization_id, ModelVersion.model_type == "url",
                ModelVersion.is_production == True))).scalars().all():  # noqa: E712
            prev.is_production = False; prev.is_active = False
        db.add(ModelVersion(version_id=f"MOD-{uuid.uuid4().hex[:8].upper()}", organization_id=organization_id, model_type="url",
                            version_tag=tag, base_global_version="v7", is_global_base=False, artifact_path=str(path.parent),
                            metrics_json=res["report"], is_active=True, is_production=True))
        pkg = WeightPackage(package_id=f"WP-{uuid.uuid4().hex[:8].upper()}", organization_id=organization_id, job_id=job_id,
                            model_type="url", version_tag=tag, artifact_path=str(path), checksum=sha,
                            metrics_json=res["report"], status="validated", created_by_id=job.created_by_id)
        db.add(pkg)
        for c in cands:
            if c.status == "pending":
                c.status = "used"; c.used_in_job_id = job_id; c.used_at = datetime.utcnow()
        job.status = "completed"; job.target_adapter_version = tag

        from api.services.model_orchestrator import apply_head_weights
        await asyncio.to_thread(apply_head_weights, str(path), tag)
        _audit(db, organization_id, "WEIGHTS_TRAINED_AND_ACTIVATED",
               f"url heads {tag} activated; " + "; ".join(res["reasons"][:3]))
        await db.commit()
        logger.info("[JOB %s] url heads ACTIVE: %s", job_id, tag)
    except Exception as e:
        logger.exception("[JOB %s] weight training failed", job_id)
        try:
            j = (await db.execute(select(TrainingJob).where(TrainingJob.job_id == job_id))).scalar_one_or_none()
            if j:
                j.status = "failed"; j.error_message = str(e)[:1000]; j.completed_at = datetime.utcnow(); await db.commit()
        except Exception:
            pass
    finally:
        wt.release_backbone()
        await db.close()


async def restore_active_heads():
    """After a restart, re-apply the active head weights (they live on the persistent data volume)."""
    import asyncio
    db = await get_background_db()
    try:
        mv = (await db.execute(select(ModelVersion).where(
            ModelVersion.model_type == "url", ModelVersion.is_production == True)  # noqa: E712
            .order_by(ModelVersion.created_at.desc()))).scalars().all()
        for v in mv:
            p = Path(v.artifact_path) / "heads.pt"
            if p.exists():
                from api.services.model_orchestrator import apply_head_weights
                ok = await asyncio.to_thread(apply_head_weights, str(p), v.version_tag)
                logger.info("Restored URL head weights %s: %s", v.version_tag, ok)
                break
    except Exception:
        logger.exception("restore_active_heads failed")
    finally:
        wt.release_backbone()
        await db.close()


# ═════════════════════════════════════════════════════════════════════════════════════
# 2. SUBMISSION to the vendor hub
# ═════════════════════════════════════════════════════════════════════════════════════

def vendor_headers() -> Dict[str, str]:
    from api.services import license as lic
    return {"X-Org-Id": lic.ORG_ID, "X-License-Key": lic.LICENSE_KEY, "X-Deployment-Token": lic.DEPLOYMENT_TOKEN}


async def submit_package(package: WeightPackage, org_name: Optional[str] = None) -> Dict[str, Any]:
    """Upload a validated package to the vendor hub. Returns the hub's answer."""
    import httpx
    if not VENDOR_URL:
        raise RuntimeError("No vendor hub configured (AEGIS_VENDOR_URL).")
    from api.services import license as lic
    if not (lic.ORG_ID and lic.LICENSE_KEY):
        raise RuntimeError("This deployment has no ORG_ID / LICENSE_KEY, so the vendor cannot authenticate it.")
    data = Path(package.artifact_path).read_bytes()
    async with httpx.AsyncClient(timeout=60) as client:
        r = await client.post(
            f"{VENDOR_URL}/vendor/submissions", headers=vendor_headers(),
            files={"package": ("heads.pt", data, "application/octet-stream")},
            data={"model_type": package.model_type, "org_name": org_name or "", "metrics": __import__("json").dumps(package.metrics_json or {})[:20000]},
        )
    if r.status_code >= 400:
        try:
            detail = r.json().get("detail", r.text)
        except Exception:
            detail = r.text
        raise RuntimeError(f"Vendor hub refused the submission ({r.status_code}): {detail}")
    return r.json()


async def refresh_vendor_status(package: WeightPackage) -> Dict[str, Any]:
    import httpx
    async with httpx.AsyncClient(timeout=30) as client:
        r = await client.get(f"{VENDOR_URL}/vendor/submissions/{package.vendor_submission_id}", headers=vendor_headers())
    r.raise_for_status()
    return r.json()


# ═════════════════════════════════════════════════════════════════════════════════════
# 3. VENDOR HUB: automatic evaluation + promotion
# ═════════════════════════════════════════════════════════════════════════════════════

RELEASE_DIR = DATA_DIR / "_vendor_releases"
SUBMISSION_DIR = DATA_DIR / "_vendor_submissions"


async def current_baseline(db, model_type: str = "url"):
    """(release row | None, heads dict | None): the model a new submission has to beat."""
    rel = (await db.execute(select(GlobalModelRelease).where(
        GlobalModelRelease.model_type == model_type, GlobalModelRelease.status == "active")
        .order_by(GlobalModelRelease.created_at.desc()))).scalars().first()
    if rel and rel.artifact_url and Path(rel.artifact_url).exists():
        return rel, wt.load_heads(Path(rel.artifact_url))
    return None, None


def _next_tag(existing_count: int) -> str:
    return f"v7.{existing_count + 1}"


async def promote_submission(db, sub: VendorSubmission, evalr: Dict[str, Any], decided_by: str) -> GlobalModelRelease:
    count = len((await db.execute(select(GlobalModelRelease).where(GlobalModelRelease.model_type == sub.model_type))).scalars().all())
    tag = _next_tag(count)
    dest = RELEASE_DIR / sub.model_type / tag / "heads.pt"
    dest.parent.mkdir(parents=True, exist_ok=True)
    dest.write_bytes(Path(sub.weights_path).read_bytes())
    rel = GlobalModelRelease(
        release_id=f"GMR-{uuid.uuid4().hex[:8].upper()}", version_tag=tag, model_type=sub.model_type,
        checksum=wt.sha256_file(dest), artifact_url=str(dest),
        metrics_json={"baseline": evalr.get("base"), "candidate": evalr.get("candidate")},
        release_notes=f"Promoted from an organisation submission after passing the vendor benchmark gate ({decided_by}). " + "; ".join(evalr.get("reasons", [])[:4]),
        status="active", submission_id=sub.submission_id, source_org_id=sub.organization_id)
    db.add(rel)
    sub.status = "approved"; sub.release_id = rel.release_id; sub.decided_by = decided_by; sub.decided_at = datetime.utcnow()
    return rel


async def evaluate_submission_job(submission_id: str):
    import asyncio
    db = await get_background_db()
    try:
        sub = (await db.execute(select(VendorSubmission).where(VendorSubmission.submission_id == submission_id))).scalar_one_or_none()
        if not sub:
            return
        sub.status = "evaluating"; await db.commit()
        baseline_rel, baseline_heads = await current_baseline(db, sub.model_type)
        cand = wt.load_heads(Path(sub.weights_path))
        evalr = await asyncio.to_thread(wt.evaluate_submission, cand, baseline_heads)
        sub.eval_json = evalr
        sub.baseline_release_id = baseline_rel.release_id if baseline_rel else "shipped-base"
        if evalr["accepted"]:
            if AUTO_PROMOTE:
                await promote_submission(db, sub, evalr, "auto")
            else:
                sub.status = "approved"; sub.reason = "Passed the benchmark gate; waiting for a vendor admin to promote it."
        else:
            sub.status = "rejected"; sub.reason = "; ".join(evalr["reasons"])[:1000]; sub.decided_by = "auto"; sub.decided_at = datetime.utcnow()
        await db.commit()
        logger.info("Submission %s -> %s", submission_id, sub.status)
    except Exception as e:
        logger.exception("evaluation of %s failed", submission_id)
        try:
            s = (await db.execute(select(VendorSubmission).where(VendorSubmission.submission_id == submission_id))).scalar_one_or_none()
            if s:
                s.status = "failed"; s.reason = str(e)[:500]; await db.commit()
        except Exception:
            pass
    finally:
        wt.release_backbone()
        await db.close()


# ═════════════════════════════════════════════════════════════════════════════════════
# 4. EVERY ORG SERVER: pull, validate locally, deploy
# ═════════════════════════════════════════════════════════════════════════════════════

async def pull_releases(db) -> list:
    """Sync the vendor's active releases into the local catalogue (metadata only)."""
    import httpx
    if not VENDOR_URL:
        return []
    async with httpx.AsyncClient(timeout=30) as client:
        r = await client.get(f"{VENDOR_URL}/vendor/releases", headers=vendor_headers())
    r.raise_for_status()
    out = []
    for item in r.json().get("releases", []):
        row = (await db.execute(select(GlobalModelRelease).where(GlobalModelRelease.release_id == item["release_id"]))).scalar_one_or_none()
        if not row:
            row = GlobalModelRelease(release_id=item["release_id"], version_tag=item["version_tag"], model_type=item["model_type"],
                                     checksum=item["checksum"], metrics_json=item.get("metrics"), release_notes=item.get("release_notes"),
                                     status="active", source_org_id=item.get("source_org_id"))
            db.add(row)
        row.status = item.get("status", "active")
        out.append(row)
    await db.commit()
    return out


async def _download_release(rel: GlobalModelRelease) -> Path:
    import httpx
    dest = DATA_DIR / "_releases" / rel.model_type / rel.version_tag / "heads.pt"
    if dest.exists() and wt.sha256_file(dest) == rel.checksum:
        return dest
    async with httpx.AsyncClient(timeout=120) as client:
        r = await client.get(f"{VENDOR_URL}/vendor/releases/{rel.release_id}/download", headers=vendor_headers())
    r.raise_for_status()
    blob = r.content
    if len(blob) > MAX_PACKAGE_BYTES or hashlib.sha256(blob).hexdigest() != rel.checksum:
        raise RuntimeError("Downloaded release failed its checksum - refusing to install it.")
    dest.parent.mkdir(parents=True, exist_ok=True)
    dest.write_bytes(blob)
    return dest


async def validate_and_deploy_release(job_id: str, organization_id: str, release_id: str):
    """Download a vendor release, re-check it against THIS organisation's verified data, then switch."""
    import asyncio
    db = await get_background_db()
    try:
        job = (await db.execute(select(TrainingJob).where(TrainingJob.job_id == job_id))).scalar_one_or_none()
        rel = (await db.execute(select(GlobalModelRelease).where(GlobalModelRelease.release_id == release_id))).scalar_one_or_none()
        if not job or not rel:
            return
        job.status = "running"; job.started_at = datetime.utcnow(); job.training_method = "release_validation"; await db.commit()

        path = await _download_release(rel)
        new_heads = wt.load_heads(path)

        cur = (await db.execute(select(ModelVersion).where(
            ModelVersion.organization_id == organization_id, ModelVersion.model_type == "url",
            ModelVersion.is_production == True))).scalars().first()  # noqa: E712
        cur_heads = wt.load_heads(Path(cur.artifact_path) / "heads.pt") if cur and (Path(cur.artifact_path) / "heads.pt").exists() else None

        if cur and (Path(cur.artifact_path) / "heads.pt").exists() and wt.sha256_file(Path(cur.artifact_path) / "heads.pt") == rel.checksum:
            job.status = "completed"; job.completed_at = datetime.utcnow(); job.target_adapter_version = cur.version_tag
            job.metrics_json = {"release": rel.version_tag, "accepted": True, "reasons": ["This release is already the active model."]}
            await db.commit()
            return

        cands = (await db.execute(select(TrainingCandidate).where(
            TrainingCandidate.organization_id == organization_id, TrainingCandidate.model_type == "url",
            TrainingCandidate.status.in_(["pending", "used"])))).scalars().all()
        urls, labels = _url_samples(cands)

        def _check():
            bb = wt.get_backbone()
            base = cur_heads or bb.base_heads
            bench = wt.benchmark_embeddings(bb)
            rb = {n: wt.metrics(d["y"], bb.p_phish(base, d["cls"], d["feats"])) for n, d in bench.items()}
            rn = {n: wt.metrics(d["y"], bb.p_phish(new_heads, d["cls"], d["feats"])) for n, d in bench.items()}
            ob = on = None
            y = np.array(labels)
            if len(y) >= 10 and len(set(labels)) == 2:
                cls, feats = bb.embed(urls)       # none of this was used to train the release
                ob = wt.metrics(y, bb.p_phish(base, cls, feats)); on = wt.metrics(y, bb.p_phish(new_heads, cls, feats))
            ok, why = wt.judge(rb, rn, ob, on)
            if not bench:
                ok, why = False, ["No reference benchmark available to validate the release."]
            return ok, why, {"current": rb, "release": rn, "org_current": ob, "org_release": on}

        ok, why, rep = await asyncio.to_thread(_check)
        job.metrics_json = {"release": rel.version_tag, "accepted": ok, "reasons": why, **rep}
        job.completed_at = datetime.utcnow()
        if not ok:
            job.status = "rejected"; job.error_message = "; ".join(why)[:1000]
            _audit(db, organization_id, "RELEASE_VALIDATION_REJECTED", f"{rel.version_tag}: {job.error_message}", "warning")
            await db.commit()
            return

        for prev in (await db.execute(select(ModelVersion).where(
                ModelVersion.organization_id == organization_id, ModelVersion.model_type == "url",
                ModelVersion.is_production == True))).scalars().all():  # noqa: E712
            prev.is_production = False; prev.is_active = False
        db.add(ModelVersion(version_id=f"MOD-{uuid.uuid4().hex[:8].upper()}", organization_id=organization_id, model_type="url",
                            version_tag=f"AEGIS_{rel.version_tag}", base_global_version=rel.version_tag, is_global_base=True,
                            artifact_path=str(path.parent), metrics_json=job.metrics_json, is_active=True, is_production=True))
        job.status = "completed"; job.target_adapter_version = f"AEGIS_{rel.version_tag}"
        from api.services.model_orchestrator import apply_head_weights
        await asyncio.to_thread(apply_head_weights, str(path), f"AEGIS_{rel.version_tag}")
        _audit(db, organization_id, "GLOBAL_MODEL_DEPLOYED", f"AEGIS {rel.version_tag} validated on local data and activated")
        await db.commit()
    except Exception as e:
        logger.exception("release deployment failed")
        try:
            j = (await db.execute(select(TrainingJob).where(TrainingJob.job_id == job_id))).scalar_one_or_none()
            if j:
                j.status = "failed"; j.error_message = str(e)[:1000]; j.completed_at = datetime.utcnow(); await db.commit()
        except Exception:
            pass
    finally:
        wt.release_backbone()
        await db.close()
