"""
AegisOne API — Report Evidence Snapshots
==========================================
When someone reports a detection, a reviewer later needs to see *why* it fired and
*where the risk came from* without re-running anything. This builds that snapshot:
the server's own record of the scan (trusted) merged with what the reporter's client
says they were shown (untrusted, size-capped).
"""
import json
from datetime import datetime
from typing import Any, Dict, Optional

from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.future import select

from api.database.models import WebsiteScan
from api.services.xai_engine import build_grounded_findings

_SOURCE_LABELS = {
    "image": "Image model + OCR text/link models",
    "text": "Text phishing model",
    "email": "Email phishing model",
    "contextual": "URL model + page-behaviour fusion",
    "full_page": "URL + text + page-behaviour fusion",
}

_CLIENT_KEYS = ("reported_from", "target_url", "page_url", "page_title", "risk_score",
                "threat_type", "findings", "summary", "captured_at")


def _clip(value: Any, limit: int = 300) -> Any:
    return value[:limit] if isinstance(value, str) else value


def _sanitize_client(raw: Optional[Dict[str, Any]]) -> Dict[str, Any]:
    out: Dict[str, Any] = {}
    if not isinstance(raw, dict):
        return out
    for key in _CLIENT_KEYS:
        if key not in raw:
            continue
        val = raw[key]
        if key == "findings" and isinstance(val, list):
            out[key] = [_clip(str(v)) for v in val[:10]]
        elif key == "summary":
            out[key] = _clip(val, 800)
        elif isinstance(val, (str, int, float)) or val is None:
            out[key] = _clip(val)
    return out


async def build_report_evidence(
    db: AsyncSession,
    org_id: str,
    scan_id: Optional[str],
    client_evidence: Optional[Dict[str, Any]],
    target_ref: Optional[str],
    risk_score: Optional[int],
) -> Dict[str, Any]:
    snapshot: Dict[str, Any] = {"captured_at": datetime.utcnow().isoformat() + "Z"}
    client = _sanitize_client(client_evidence)

    scan = None
    if scan_id:
        scan = (await db.execute(
            select(WebsiteScan).where(WebsiteScan.scan_id == scan_id, WebsiteScan.organization_id == org_id)
        )).scalar_one_or_none()

    if scan is not None:
        rich = None
        if scan.xai_explanation:
            try:
                rich = json.loads(scan.xai_explanation)
            except Exception:
                rich = None
        grounded = build_grounded_findings(
            {"risk_score": scan.risk_score, "domain": scan.domain, "url": scan.url, "scan_type": scan.scan_type},
            rich,
        )
        kind = grounded["kind"]
        snapshot.update({
            "scan_id": scan.scan_id,
            "scan_kind": kind,
            "source_model": (rich or {}).get("source_model") or _SOURCE_LABELS.get(scan.scan_type, "URL model (heuristics + ML)"),
            "target": scan.url,
            "domain": scan.domain,
            "risk_score": round(scan.risk_score or 0),
            "decision": scan.decision,
            "threat_type": scan.threat_type,
            "detected_at": scan.created_at.isoformat() if scan.created_at else None,
            "findings": grounded["findings"],
            "brand": grounded["brand"],
            "signals": ((rich or {}).get("url_model_evidence") or {}).get("signals", [])[:8],
        })
    else:
        snapshot.update({
            "scan_kind": "page",
            "target": target_ref,
            "risk_score": risk_score,
            "findings": client.get("findings") or [],
            "source_model": "Not linked to a stored scan",
        })

    # What the reporter's browser says they were looking at, kept separate from server facts.
    if client:
        snapshot["reporter_view"] = client
        if not snapshot.get("findings"):
            snapshot["findings"] = client.get("findings", [])
    return snapshot
