"""
AegisOne API — Vendor Model Hub
================================
Mounted only when AEGIS_VENDOR_MODE=1 (the vendor runs one hub; customers never do).

  Organisation side (authenticated with ORG_ID + LICENSE_KEY + DEPLOYMENT_TOKEN, verified against the
  vendor registry):
      POST /vendor/submissions            upload an improved-heads package
      GET  /vendor/submissions/{id}       see its verdict
      GET  /vendor/releases               catalogue of promoted releases
      GET  /vendor/releases/{id}/download fetch one

  Vendor staff (X-Vendor-Admin-Key = VENDOR_ADMIN_KEY), used by the landing-page admin UI:
      GET  /vendor/admin/overview, /vendor/admin/submissions, /vendor/admin/releases
      POST /vendor/admin/submissions/{id}/decision   approve / reject / re-evaluate (manual override)
      POST /vendor/admin/releases/{id}/withdraw

Every submission is evaluated automatically against the CURRENT baseline on a benchmark the
organisations never see; promotion happens only if it improves without regressing.
"""
import os
import hmac
import json
import uuid
import logging
from datetime import datetime
from pathlib import Path
from typing import Optional

from fastapi import APIRouter, Depends, Header, HTTPException, BackgroundTasks, UploadFile, File, Form
from fastapi.responses import FileResponse
from pydantic import BaseModel
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.future import select

from api.database.db import get_db
from api.database.models import VendorSubmission, GlobalModelRelease
from api.services import license as lic
from api.services import weights_pipeline as wp
from api.services import weight_trainer as wt

logger = logging.getLogger("aegisone.vendor_hub")
router = APIRouter(prefix="/vendor", tags=["Vendor Model Hub"])

VENDOR_ADMIN_KEY = os.environ.get("VENDOR_ADMIN_KEY", "")


async def org_auth(x_org_id: str = Header(""), x_license_key: str = Header(""), x_deployment_token: str = Header("")) -> dict:
    v = await lic.verify_credentials(x_org_id.strip(), x_license_key.strip(), x_deployment_token.strip())
    if not v.get("valid"):
        raise HTTPException(status_code=401, detail=v.get("reason") or "Invalid organization credentials.")
    return {"org_id": x_org_id.strip(), "org_name": v.get("org_name")}


def vendor_admin(x_vendor_admin_key: str = Header("")):
    if not VENDOR_ADMIN_KEY or not hmac.compare_digest(x_vendor_admin_key, VENDOR_ADMIN_KEY):
        raise HTTPException(status_code=403, detail="Vendor admin key required.")
    return True


def _sub_out(s: VendorSubmission, full: bool = False) -> dict:
    out = {
        "submission_id": s.submission_id, "organization_id": s.organization_id, "org_name": s.org_name, "model_type": s.model_type,
        "status": s.status, "reason": s.reason, "release_id": s.release_id, "decided_by": s.decided_by,
        "baseline": s.baseline_release_id, "created_at": s.created_at, "decided_at": s.decided_at, "checksum": s.checksum,
    }
    if full:
        out["evaluation"] = s.eval_json
        out["org_claimed_metrics"] = s.org_metrics_json
    return out


def _rel_out(r: GlobalModelRelease) -> dict:
    return {"release_id": r.release_id, "version_tag": r.version_tag, "model_type": r.model_type, "checksum": r.checksum,
            "metrics": r.metrics_json, "release_notes": r.release_notes, "created_at": r.created_at, "status": r.status,
            "source_org_id": r.source_org_id, "submission_id": r.submission_id}


# ── organisation endpoints ───────────────────────────────────────────────────────────

@router.post("/submissions", status_code=202)
async def receive_submission(
    bg: BackgroundTasks,
    package: UploadFile = File(...),
    model_type: str = Form("url"),
    org_name: str = Form(""),
    metrics: str = Form("{}"),
    org: dict = Depends(org_auth),
    db: AsyncSession = Depends(get_db),
):
    if model_type != "url":
        raise HTTPException(status_code=400, detail="Only the URL model accepts weight submissions at the moment.")
    blob = await package.read(wp.MAX_PACKAGE_BYTES + 1)
    if len(blob) > wp.MAX_PACKAGE_BYTES:
        raise HTTPException(status_code=413, detail="Package too large.")
    pending = (await db.execute(select(VendorSubmission).where(
        VendorSubmission.organization_id == org["org_id"], VendorSubmission.status.in_(["received", "evaluating"])))).scalars().first()
    if pending:
        raise HTTPException(status_code=409, detail=f"Submission {pending.submission_id} is still being evaluated.")
    # Structural validation BEFORE anything is stored (weights-only load: no code can execute)
    try:
        wt.load_heads(bytes(blob))
    except Exception as e:
        raise HTTPException(status_code=400, detail=f"Invalid package: {e}")
    finally:
        wt.release_backbone()
    sid = f"SUB-{uuid.uuid4().hex[:8].upper()}"
    path = wp.SUBMISSION_DIR / org["org_id"] / f"{sid}.pt"
    path.parent.mkdir(parents=True, exist_ok=True)
    path.write_bytes(blob)
    try:
        claimed = json.loads(metrics)
    except Exception:
        claimed = {}
    sub = VendorSubmission(submission_id=sid, organization_id=org["org_id"], org_name=org.get("org_name") or org_name or org["org_id"],
                           model_type=model_type, weights_path=str(path), checksum=wt.sha256_file(path), org_metrics_json=claimed, status="received")
    db.add(sub)
    await db.commit()
    bg.add_task(wp.evaluate_submission_job, sid)
    return {"submission_id": sid, "status": "received"}


@router.get("/submissions/{submission_id}")
async def my_submission(submission_id: str, org: dict = Depends(org_auth), db: AsyncSession = Depends(get_db)):
    s = (await db.execute(select(VendorSubmission).where(
        VendorSubmission.submission_id == submission_id, VendorSubmission.organization_id == org["org_id"]))).scalar_one_or_none()
    if not s:
        raise HTTPException(status_code=404, detail="Submission not found.")
    return _sub_out(s, full=True)


@router.get("/releases")
async def list_releases(org: dict = Depends(org_auth), db: AsyncSession = Depends(get_db)):
    rows = (await db.execute(select(GlobalModelRelease).where(GlobalModelRelease.status == "active")
                             .order_by(GlobalModelRelease.created_at.desc()))).scalars().all()
    return {"releases": [_rel_out(r) for r in rows]}


@router.get("/releases/{release_id}/download")
async def download_release(release_id: str, org: dict = Depends(org_auth), db: AsyncSession = Depends(get_db)):
    r = (await db.execute(select(GlobalModelRelease).where(GlobalModelRelease.release_id == release_id, GlobalModelRelease.status == "active"))).scalar_one_or_none()
    if not r or not r.artifact_url or not Path(r.artifact_url).exists():
        raise HTTPException(status_code=404, detail="Release not found.")
    return FileResponse(r.artifact_url, media_type="application/octet-stream", filename="heads.pt")


# ── vendor staff endpoints ───────────────────────────────────────────────────────────

@router.get("/admin/overview")
async def overview(_=Depends(vendor_admin), db: AsyncSession = Depends(get_db)):
    subs = (await db.execute(select(VendorSubmission))).scalars().all()
    rels = (await db.execute(select(GlobalModelRelease).where(GlobalModelRelease.status == "active"))).scalars().all()
    counts = {}
    for s in subs:
        counts[s.status] = counts.get(s.status, 0) + 1
    latest = max(rels, key=lambda r: r.created_at or datetime.min, default=None)
    return {"submissions": counts, "total_submissions": len(subs), "active_releases": len(rels),
            "current_baseline": latest.version_tag if latest else "shipped base (v7)", "gate": wt.GATE, "auto_promote": wp.AUTO_PROMOTE,
            "organizations_contributing": len({s.organization_id for s in subs})}


@router.get("/admin/submissions")
async def admin_submissions(_=Depends(vendor_admin), db: AsyncSession = Depends(get_db)):
    rows = (await db.execute(select(VendorSubmission).order_by(VendorSubmission.created_at.desc()))).scalars().all()
    return [_sub_out(s) for s in rows]


@router.get("/admin/submissions/{submission_id}")
async def admin_submission(submission_id: str, _=Depends(vendor_admin), db: AsyncSession = Depends(get_db)):
    s = (await db.execute(select(VendorSubmission).where(VendorSubmission.submission_id == submission_id))).scalar_one_or_none()
    if not s:
        raise HTTPException(status_code=404, detail="Submission not found.")
    return _sub_out(s, full=True)


class DecisionIn(BaseModel):
    action: str            # approve | reject | reevaluate
    note: Optional[str] = None


@router.post("/admin/submissions/{submission_id}/decision")
async def admin_decision(submission_id: str, body: DecisionIn, bg: BackgroundTasks, _=Depends(vendor_admin), db: AsyncSession = Depends(get_db)):
    s = (await db.execute(select(VendorSubmission).where(VendorSubmission.submission_id == submission_id))).scalar_one_or_none()
    if not s:
        raise HTTPException(status_code=404, detail="Submission not found.")
    if body.action == "reevaluate":
        s.status = "received"; await db.commit()
        bg.add_task(wp.evaluate_submission_job, submission_id)
        return _sub_out(s)
    if body.action == "approve":
        if s.release_id:
            raise HTTPException(status_code=409, detail="Already promoted.")
        await wp.promote_submission(db, s, s.eval_json or {"reasons": ["manual vendor approval"]}, "vendor-admin")
        s.reason = (body.note or "Manually approved by a vendor admin.")
    elif body.action == "reject":
        s.status = "rejected"; s.decided_by = "vendor-admin"; s.decided_at = datetime.utcnow(); s.reason = body.note or "Rejected by a vendor admin."
    else:
        raise HTTPException(status_code=400, detail="action must be approve, reject or reevaluate")
    await db.commit()
    return _sub_out(s, full=True)


@router.get("/admin/releases")
async def admin_releases(_=Depends(vendor_admin), db: AsyncSession = Depends(get_db)):
    rows = (await db.execute(select(GlobalModelRelease).order_by(GlobalModelRelease.created_at.desc()))).scalars().all()
    return [_rel_out(r) for r in rows]


@router.post("/admin/releases/{release_id}/withdraw")
async def withdraw_release(release_id: str, _=Depends(vendor_admin), db: AsyncSession = Depends(get_db)):
    r = (await db.execute(select(GlobalModelRelease).where(GlobalModelRelease.release_id == release_id))).scalar_one_or_none()
    if not r:
        raise HTTPException(status_code=404, detail="Release not found.")
    r.status = "withdrawn"
    await db.commit()
    return _rel_out(r)
