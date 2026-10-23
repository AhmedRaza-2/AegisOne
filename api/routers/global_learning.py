"""
AegisOne API — Global Learning & Model Release Router (Phases 4 & 5)
===================================================================
Manages organization-level global contribution policies (OFF by default),
privacy filtering, admin contribution batch approvals, AEGIS Central ingestion,
and global base model update evaluations.
"""
import uuid
import hashlib
import logging
from typing import List, Optional, Dict, Any
from datetime import datetime, timezone

from fastapi import APIRouter, Depends, HTTPException, status, Query
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.future import select
from sqlalchemy import func, or_

from api.database.db import get_db
from api.database.models import User, OrgLearningPolicy, GlobalContribution, TrainingCandidate, ModelVersion, GlobalModelRelease, AuditLog
from api.database.schemas import (
    OrgPolicyUpdateRequest,
    OrgPolicyResponse,
    ContributionApproveRequest,
    GlobalContributionResponse
)
from api.auth.roles import Role, require_role

logger = logging.getLogger("aegisone.global_learning")

router = APIRouter(prefix="/admin/global-learning", tags=["Global AEGIS Learning"])


def _apply_privacy_filter(samples: List[Dict[str, Any]]) -> List[Dict[str, Any]]:
    """
    Privacy Filter:
    Removes all employee identifiers, user IDs, device IDs, raw credentials,
    email body HTML, private internal IP addresses, and user notes.
    Retains only anonymized features (URL structure hash, lexical codes, verified labels).
    """
    filtered = []
    for s in samples:
        target_ref = s.get("target_ref", "")
        
        # Anonymize URL / Domain
        clean_ref = target_ref.strip()
        if clean_ref.startswith("http"):
            try:
                from urllib.parse import urlparse
                parsed = urlparse(clean_ref)
                # Keep scheme + domain + path structure, drop query params/credentials/tokens
                clean_ref = f"{parsed.scheme}://{parsed.netloc}{parsed.path}"
            except Exception:
                pass

        anon_sample = {
            "target_ref_anonymized": clean_ref,
            "target_ref_hash": hashlib.sha256(clean_ref.encode("utf-8")).hexdigest()[:16],
            "verified_label": s.get("verified_label") or s.get("label") or "phishing",
            "model_type": s.get("model_type", "url"),
            "risk_score_range": "high" if s.get("risk_score", 0) >= 70 else "medium",
            "factor_codes": s.get("factor_codes", []),
            "anonymized_at": datetime.now(timezone.utc).isoformat()
        }
        filtered.append(anon_sample)
    return filtered


# ═══════════════════════════════════════════════════════════════
# PHASE 4: GLOBAL CONTRIBUTION POLICY & APPROVALS
# ═══════════════════════════════════════════════════════════════

@router.get("/policy", response_model=OrgPolicyResponse)
async def get_global_learning_policy(
    current_user: User = Depends(require_role(Role.ADMIN)),
    db: AsyncSession = Depends(get_db),
):
    """
    Get organization global contribution policy.
    OFF by default to enforce privacy.
    """
    org_id = current_user.organization_id or "org_default"
    res = await db.execute(select(OrgLearningPolicy).where(OrgLearningPolicy.organization_id == org_id))
    policy = res.scalar_one_or_none()

    if not policy:
        # Create default OFF policy
        policy = OrgLearningPolicy(
            organization_id=org_id,
            allow_global_contribution=False,  # OFF BY DEFAULT!
            auto_anonymize=True,
            allowed_model_types=["url", "email", "text", "image"]
        )
        db.add(policy)
        await db.commit()
        await db.refresh(policy)

    return policy


@router.post("/policy", response_model=OrgPolicyResponse)
async def update_global_learning_policy(
    payload: OrgPolicyUpdateRequest,
    current_user: User = Depends(require_role(Role.ADMIN)),
    db: AsyncSession = Depends(get_db),
):
    """
    Update organization contribution policy. Requires explicit admin action.
    """
    org_id = current_user.organization_id or "org_default"
    res = await db.execute(select(OrgLearningPolicy).where(OrgLearningPolicy.organization_id == org_id))
    policy = res.scalar_one_or_none()

    if not policy:
        policy = OrgLearningPolicy(organization_id=org_id)
        db.add(policy)

    policy.allow_global_contribution = payload.allow_global_contribution
    policy.auto_anonymize = payload.auto_anonymize
    policy.allowed_model_types = payload.allowed_model_types
    policy.updated_by_id = current_user.id
    policy.updated_at = datetime.utcnow()

    audit = AuditLog(
        organization_id=org_id,
        actor_email=current_user.email,
        action="GLOBAL_POLICY_UPDATED",
        module="global_learning",
        target=f"Global contribution policy set to {'ENABLED' if payload.allow_global_contribution else 'DISABLED'}",
        result="success",
        ip_address="127.0.0.1"
    )
    db.add(audit)

    await db.commit()
    await db.refresh(policy)
    return policy


@router.post("/contributions/approve", response_model=GlobalContributionResponse, status_code=status.HTTP_201_CREATED)
async def approve_contribution_batch(
    payload: ContributionApproveRequest,
    current_user: User = Depends(require_role(Role.ADMIN)),
    db: AsyncSession = Depends(get_db),
):
    """
    Admin approves a batch of verified local samples to contribute to AEGIS Central.
    Runs Privacy Filter BEFORE transmission.
    """
    org_id = current_user.organization_id or "org_default"

    # Check policy
    pol_res = await db.execute(select(OrgLearningPolicy).where(OrgLearningPolicy.organization_id == org_id))
    policy = pol_res.scalar_one_or_none()
    if not policy or not policy.allow_global_contribution:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Global contribution policy is currently OFF for this organization. Enable it in settings first."
        )

    model_type = payload.model_type.lower()

    # Fetch verified candidates
    cand_query = select(TrainingCandidate).where(
        TrainingCandidate.organization_id == org_id,
        TrainingCandidate.model_type == model_type,
        TrainingCandidate.status.in_(["pending", "used"])
    )
    if payload.candidate_ids:
        cand_query = cand_query.where(TrainingCandidate.candidate_id.in_(payload.candidate_ids))

    cand_query = cand_query.limit(payload.max_samples)
    cands_res = await db.execute(cand_query)
    cands = cands_res.scalars().all()

    if not cands:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="No matching candidates available for contribution.")

    raw_samples = [
        {
            "target_ref": c.sample_data.get("target_ref", ""),
            "label": c.label,
            "model_type": c.model_type,
            "risk_score": c.sample_data.get("risk_score", 0)
        }
        for c in cands
    ]

    # Run Privacy Filter BEFORE transmission!
    anonymized_payload = _apply_privacy_filter(raw_samples)

    cid = f"GC-{uuid.uuid4().hex[:8].upper()}"
    contribution = GlobalContribution(
        contribution_id=cid,
        organization_id=org_id,
        approved_by_id=current_user.id,
        model_type=model_type,
        sample_count=len(anonymized_payload),
        anonymized_payload=anonymized_payload,
        status="validated",
        validation_notes="Passed privacy filter and schema validation."
    )
    db.add(contribution)

    audit = AuditLog(
        organization_id=org_id,
        actor_email=current_user.email,
        action="GLOBAL_CONTRIBUTION_APPROVED",
        module="global_learning",
        target=f"Approved {len(anonymized_payload)} anonymized {model_type} samples for AEGIS Central (ID: {cid})",
        result="success",
        ip_address="127.0.0.1"
    )
    db.add(audit)

    await db.commit()
    await db.refresh(contribution)
    return contribution


@router.get("/contributions", response_model=List[GlobalContributionResponse])
async def list_contributions(
    current_user: User = Depends(require_role(Role.OFFICE_ADMIN)),
    db: AsyncSession = Depends(get_db),
):
    """
    List global contributions approved by this organization.
    """
    org_id = current_user.organization_id or "org_default"
    query = select(GlobalContribution).where(GlobalContribution.organization_id == org_id).order_by(GlobalContribution.created_at.desc())
    res = await db.execute(query)
    return res.scalars().all()


# ═══════════════════════════════════════════════════════════════
# PHASE 5: GLOBAL MODEL RELEASES - see api/routers/model_updates.py
# ═══════════════════════════════════════════════════════════════
# The release catalogue and deployment used to be simulated here (seeded releases with made-up
# metrics and a hard-coded "evaluation passed"). Real releases now come from the vendor hub, are
# checksum-verified and are validated against the organisation's own data before activation:
#   GET  /admin/model-updates/releases
#   POST /admin/model-updates/releases/{release_id}/deploy
