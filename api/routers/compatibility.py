"""
AegisOne API — Compatibility & XAI Router
Exposes legacy /analyze/* and new /xai/* endpoints for full extension integration.
Also implements dashboard sync and policy fetching endpoints.
"""
import time
import tempfile
import os
import json
import uuid
import httpx
from fastapi import APIRouter, Form, UploadFile, File, HTTPException, Depends, Query
from typing import Dict, Any, List
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession
from pydantic import BaseModel as BaseModel_

from api.database.db import get_db
from api.database.models import (
    Device,
    Policy,
    SecurityEvent,
    ThreatReport,
    CredentialEvent,
    DownloadEvent,
    HoverScan,
    XAIReport,
)
from api.database.schemas import (
    DeviceHeartbeatRequest,
    DeviceRegisterRequest,
    PolicyResponse,
    SecurityEventIngestRequest,
    ThreatReportRequest,
    ThreatReportResponse,
)
from api.services.model_orchestrator import (
    predict_url, predict_text, predict_email, predict_image, process_attachment
)
from api.services.content_router import route_image_input
from api.services.xai_service import generate_explanation

router = APIRouter(tags=["Compatibility & XAI"])




DEFAULT_POLICY = {
    "org_id": "org_default",
    "org_name": "AegisOne Enterprise",
    "allowlist": ["localhost", "127.0.0.1"],
    "blocklist": ["phishsite.com", "malwaredownload.net"],
    "warninglist": [],
    "risk_thresholds": {"safe": 0.20, "warning": 0.50, "danger": 0.80},
}


# --- Compatibility Endpoints ---

@router.post("/analyze/url")
async def api_url(url: str = Form(...)):
    start = time.time()
    result = predict_url(url)
    result["latency_ms"] = round((time.time() - start) * 1000, 1)
    return result


@router.post("/analyze/text")
async def api_text(text: str = Form(...)):
    start = time.time()
    result = predict_text(text)
    result["latency_ms"] = round((time.time() - start) * 1000, 1)
    return result


@router.post("/analyze/email")
async def api_email(sender: str = Form(""), subject: str = Form(""), body: str = Form("")):
    start = time.time()
    result = predict_email(sender, subject, body)
    result["latency_ms"] = round((time.time() - start) * 1000, 1)
    return result


@router.post("/analyze/image")
async def api_image(file: UploadFile = File(...)):
    start = time.time()
    data = await file.read()
    results = await route_image_input(data)
    
    overall_prob = 0.0
    predictions = []
    
    for r in results:
        overall_prob = max(overall_prob, r.get("phishing_probability", 0.0))
        predictions.append(r.get("prediction", "legitimate"))
        
    is_phish = overall_prob >= 0.5
    
    return {
        "prediction": "phishing" if is_phish else "legitimate",
        "confidence": round(overall_prob if is_phish else 1.0 - overall_prob, 4),
        "phishing_probability": round(overall_prob, 4),
        "model": "image_ocr_composite",
        "sub_results": results,
        "latency_ms": round((time.time() - start) * 1000, 1)
    }


@router.post("/analyze/download_url")
async def api_download_url(url: str = Form(...)):
    start = time.time()
    
    is_local = False
    local_path = ""
    if url.startswith("file://"):
        is_local = True
        local_path = url.replace("file:///", "")
        if local_path.startswith("/") and len(local_path) > 2 and local_path[2] == ":":
            local_path = local_path[1:]
        import urllib.parse
        local_path = urllib.parse.unquote(local_path)
    elif os.path.exists(url):
        is_local = True
        local_path = url

    if is_local:
        if not os.path.exists(local_path):
            result = predict_url(url)
            result["latency_ms"] = round((time.time() - start) * 1000, 1)
            result["note"] = f"Local file not found: {local_path}"
            return result

        extraction = process_attachment(local_path)
        file_bytes_len = os.path.getsize(local_path)
        results = {
            "source_url": url,
            "file_type": extraction.get("file_type", "unknown"),
            "file_size_kb": round(file_bytes_len / 1024, 1),
            "macros_found": extraction.get("macros_found", False),
            "heuristic_risk": extraction.get("heuristic_risk", 0.0),
            "vba_analysis": extraction.get("vba_analysis"),
            "sub_results": extraction.get("sub_results", {}),
        }
    else:
        from urllib.parse import urlparse
        parsed = urlparse(url)
        path_part = parsed.path
        suffix = os.path.splitext(path_part)[1] or ".bin"

        try:
            async with httpx.AsyncClient(timeout=15.0, follow_redirects=True) as client:
                MAX_BYTES = 10 * 1024 * 1024
                chunks = []
                total = 0
                async with client.stream("GET", url) as response:
                    response.raise_for_status()
                    ct = response.headers.get("content-type", "")
                    if suffix == ".bin":
                        ct_map = {
                            "application/pdf": ".pdf",
                            "application/zip": ".zip",
                            "text/html": ".html",
                            "application/msword": ".doc",
                            "application/vnd.openxmlformats": ".docx",
                            "text/plain": ".txt",
                        }
                        for mime, ext in ct_map.items():
                            if mime in ct:
                                suffix = ext
                                break
                    async for chunk in response.aiter_bytes(chunk_size=65536):
                        chunks.append(chunk)
                        total += len(chunk)
                        if total > MAX_BYTES:
                            break

            file_bytes = b"".join(chunks)
        except Exception as e:
            result = predict_url(url)
            result["latency_ms"] = round((time.time() - start) * 1000, 1)
            result["note"] = f"Could not fetch file ({e}) — URL-only check"
            return result

        fd, temp_path = tempfile.mkstemp(suffix=suffix)
        try:
            with os.fdopen(fd, "wb") as f:
                f.write(file_bytes)
            extraction = process_attachment(temp_path)
        finally:
            if os.path.exists(temp_path):
                os.remove(temp_path)

        results = {
            "source_url": url,
            "file_type": extraction.get("file_type", "unknown"),
            "file_size_kb": round(len(file_bytes) / 1024, 1),
            "macros_found": extraction.get("macros_found", False),
            "heuristic_risk": extraction.get("heuristic_risk", 0.0),
            "vba_analysis": extraction.get("vba_analysis"),
            "sub_results": extraction.get("sub_results", {}),
        }

    sub_res = results.get("sub_results", {})
    text_pred = sub_res.get("text", {})
    url_results = sub_res.get("urls", [])
    
    is_phishing = False
    phishing_signals = []

    if results["heuristic_risk"] >= 0.5:
        is_phishing = True
        phishing_signals.append(f"Heuristic risk {results['heuristic_risk']:.0%}")
    if results["macros_found"]:
        is_phishing = True
        phishing_signals.append("Malicious macros found")
    if text_pred.get("prediction") == "phishing":
        is_phishing = True
        phishing_signals.append(f"Text AI: {text_pred.get('phishing_probability',0):.0%} risk")
    bad_urls = [u for u in url_results if u.get("phishing_probability", 0) > 0.5]
    if bad_urls:
        is_phishing = True
        phishing_signals.append(f"{len(bad_urls)} malicious URL(s) inside file")

    max_prob = max(
        results["heuristic_risk"],
        text_pred.get("phishing_probability", 0),
        max((u.get("phishing_probability", 0) for u in url_results), default=0),
    )

    results["prediction"] = "phishing" if is_phishing else "legitimate"
    results["final_prediction"] = results["prediction"]
    results["phishing_signals"] = phishing_signals
    results["phishing_probability"] = round(max_prob, 4)
    results["latency_ms"] = round((time.time() - start) * 1000, 1)
    
    return results


@router.post("/xai/explain")
async def api_explain(evidence: Dict[str, Any]):
    start = time.time()
    explanation = generate_explanation(evidence)
    explanation["latency_ms"] = round((time.time() - start) * 1000, 1)
    return explanation


# --- Policy & Ingest Endpoints ---

@router.get("/policy/current", response_model=PolicyResponse)
async def get_current_policy(
    device_id: str | None = Query(default=None),
    db: AsyncSession = Depends(get_db),
):
    """Returns the organization security policy for the requesting device."""
    org_id = DEFAULT_POLICY["org_id"]
    if device_id:
        device_res = await db.execute(select(Device).where(Device.device_id == device_id))
        device = device_res.scalar_one_or_none()
        if device and device.organization_id:
            org_id = device.organization_id

    rows = await db.execute(
        select(Policy).where(Policy.organization_id == org_id, Policy.enabled == True)  # noqa: E712
        .order_by(Policy.priority.asc())
    )
    policies = rows.scalars().all()
    if not policies:
        return PolicyResponse(**DEFAULT_POLICY)

    allowlist = []
    blocklist = []
    warninglist = []
    risk_thresholds = dict(DEFAULT_POLICY["risk_thresholds"])
    for policy in policies:
        value = policy.value.strip()
        if policy.policy_type == "allowlist":
            allowlist.append(value)
        elif policy.policy_type == "blocklist":
            blocklist.append(value)
        elif policy.policy_type == "warninglist":
            warninglist.append(value)
        elif policy.policy_type == "threshold":
            try:
                key, raw_value = value.split("=", 1)
                risk_thresholds[key.strip()] = float(raw_value.strip())
            except Exception:
                pass

    return PolicyResponse(
        org_id=org_id,
        org_name=DEFAULT_POLICY["org_name"],
        allowlist=allowlist or DEFAULT_POLICY["allowlist"],
        blocklist=blocklist or DEFAULT_POLICY["blocklist"],
        warninglist=warninglist,
        risk_thresholds=risk_thresholds,
    )


@router.post("/devices/register")
async def register_device(payload: DeviceRegisterRequest, db: AsyncSession = Depends(get_db)):
    device = await db.scalar(select(Device).where(Device.device_id == payload.device_id))
    if not device:
        device = Device(
            device_id=payload.device_id,
            organization_id=payload.organization_id or DEFAULT_POLICY["org_id"],
            user_id=payload.user_id,
            browser=payload.browser,
            browser_version=payload.browser_version,
            os=payload.os,
            status="active",
        )
        db.add(device)
    else:
        device.organization_id = payload.organization_id or device.organization_id or DEFAULT_POLICY["org_id"]
        device.user_id = payload.user_id if payload.user_id is not None else device.user_id
        device.browser = payload.browser
        device.browser_version = payload.browser_version
        device.os = payload.os
        device.status = "active"
    await db.commit()
    return {"ok": True, "device_id": payload.device_id, "organization_id": device.organization_id}


@router.post("/devices/heartbeat")
async def heartbeat_device(payload: DeviceHeartbeatRequest, db: AsyncSession = Depends(get_db)):
    device = await db.scalar(select(Device).where(Device.device_id == payload.device_id))
    if not device:
        device = Device(
            device_id=payload.device_id,
            organization_id=DEFAULT_POLICY["org_id"],
            browser=payload.browser,
            browser_version=payload.browser_version,
            os=payload.os,
            status="active",
        )
        db.add(device)
    else:
        device.browser = payload.browser
        device.browser_version = payload.browser_version
        device.os = payload.os
        device.status = "active"
    await db.commit()
    return {"ok": True, "device_id": payload.device_id, "status": "active"}


@router.post("/events/ingest")
async def ingest_security_events(payload: SecurityEventIngestRequest, db: AsyncSession = Depends(get_db)):
    """
    Ingests batch security events from the browser extension.
    Persists them to the database.
    """
    persisted = 0
    for event in payload.events:
        event_id = event.id or str(uuid.uuid4())
        details = event.details or {}
        entry = SecurityEvent(
            event_id=event_id,
            organization_id=event.org_id or DEFAULT_POLICY["org_id"],
            user_id=event.user_id,
            device_id=event.device_id,
            event_type=event.type,
            severity="high" if (event.risk_score or 0) >= 80 else "medium" if (event.risk_score or 0) >= 50 else "low",
            module=details.get("module", "extension"),
            decision=details.get("decision", event.verdict or "allow"),
            risk_score=event.risk_score or 0,
            details=json.dumps(event.model_dump()),
        )
        db.add(entry)
        persisted += 1

        if event.type == "credential_warning":
            db.add(CredentialEvent(
                credential_event_id=event_id,
                website_scan_id=details.get("website_scan_id"),
                form_action=details.get("form_action", ""),
                credential_type=details.get("credential_type", "unknown"),
                blocked=details.get("blocked", False),
                user_action=details.get("user_action", "warned"),
            ))
        elif event.type in {"download_blocked", "download_allowed"}:
            db.add(DownloadEvent(
                download_id=event_id,
                organization_id=event.org_id or DEFAULT_POLICY["org_id"],
                user_id=event.user_id,
                filename=details.get("filename", event.url or "unknown"),
                extension=details.get("extension", ""),
                sha256=details.get("sha256", ""),
                file_size_kb=float(details.get("size", 0) or 0) / 1024,
                risk_score=event.risk_score or 0,
                decision=details.get("decision", event.verdict or "allow"),
            ))
        elif event.type == "threat_report":
            db.add(ThreatReport(
                report_id=event_id,
                organization_id=event.org_id or DEFAULT_POLICY["org_id"],
                user_id=event.user_id,
                website=event.url or event.domain or "",
                reason=details.get("reason", ""),
                status="submitted",
            ))
        elif event.type == "xai_session":
            db.add(XAIReport(
                xai_id=event_id,
                scan_id=details.get("scan_id", event_id),
                module=details.get("module", "extension"),
                summary=details.get("summary", ""),
                explanation=details.get("explanation", ""),
                recommendation=details.get("recommendation", ""),
                llm_model=details.get("llm_model", ""),
                response_time=float(details.get("response_time", 0.0) or 0.0),
            ))

    await db.commit()
    return {"status": "success", "count": persisted}


@router.post("/reports/threat", response_model=ThreatReportResponse)
async def report_threat(payload: ThreatReportRequest, db: AsyncSession = Depends(get_db)):
    report_id = f"report-{uuid.uuid4().hex[:12]}"
    row = ThreatReport(
        report_id=report_id,
        organization_id=payload.organization_id or DEFAULT_POLICY["org_id"],
        user_id=payload.user_id,
        website=payload.website,
        reason=payload.reason,
        status="submitted",
    )
    db.add(row)
    await db.commit()
    return ThreatReportResponse(
        report_id=report_id,
        status="submitted",
        message="Report logged. Security team notified.",
    )


# ─── Module 7: JavaScript Analysis Telemetry ───────────────────────────────

class ScriptTelemetryRequest(BaseModel_):
    website_scan_id: str | None = None
    script_count: int = 0
    obfuscated: bool = False
    eval_found: bool = False
    redirect_script: bool = False
    clipboard_access: bool = False
    risk_score: int = 0
    device_id: str | None = None
    org_id: str | None = None


@router.post("/telemetry/scripts")
async def ingest_script_telemetry(payload: ScriptTelemetryRequest, db: AsyncSession = Depends(get_db)):
    """
    Module 7 — JavaScript Analysis.
    Content script sends extracted script metadata; we persist features + fire
    a security event when risk is meaningful.
    """
    from api.database.models import SecurityEvent as SecurityEventORM
    entry_id = str(uuid.uuid4())

    # Persist script analysis signals as a security event
    if payload.risk_score >= 30 or payload.obfuscated or payload.eval_found:
        severity = "high" if payload.risk_score >= 70 else "medium" if payload.risk_score >= 40 else "low"
        db.add(SecurityEventORM(
            event_id=entry_id,
            organization_id=payload.org_id or DEFAULT_POLICY["org_id"],
            device_id=payload.device_id,
            event_type="script_risk",
            severity=severity,
            module="script_analysis",
            decision="warn" if payload.risk_score >= 40 else "allow",
            risk_score=payload.risk_score,
            details=json.dumps({
                "website_scan_id": payload.website_scan_id,
                "script_count": payload.script_count,
                "obfuscated": payload.obfuscated,
                "eval_found": payload.eval_found,
                "redirect_script": payload.redirect_script,
                "clipboard_access": payload.clipboard_access,
            }),
        ))
        await db.commit()

    return {"ok": True, "event_id": entry_id, "risk_score": payload.risk_score}


# ─── Module 8: Cookie Analysis Telemetry ───────────────────────────────────

class CookieTelemetryRequest(BaseModel_):
    website_scan_id: str | None = None
    cookie_count: int = 0
    third_party: int = 0
    secure_flag: bool = True
    httponly: bool = True
    risk_score: int = 0
    device_id: str | None = None
    org_id: str | None = None


@router.post("/telemetry/cookies")
async def ingest_cookie_telemetry(payload: CookieTelemetryRequest, db: AsyncSession = Depends(get_db)):
    """
    Module 8 — Cookie Metadata Analysis.
    Privacy rule: only metadata (counts, flags) is transmitted — no cookie values.
    """
    from api.database.models import SecurityEvent as SecurityEventORM
    entry_id = str(uuid.uuid4())

    if payload.risk_score >= 30 or not payload.secure_flag or not payload.httponly:
        severity = "high" if payload.risk_score >= 70 else "medium" if payload.risk_score >= 40 else "low"
        db.add(SecurityEventORM(
            event_id=entry_id,
            organization_id=payload.org_id or DEFAULT_POLICY["org_id"],
            device_id=payload.device_id,
            event_type="cookie_risk",
            severity=severity,
            module="cookie_analysis",
            decision="warn" if payload.risk_score >= 40 else "allow",
            risk_score=payload.risk_score,
            details=json.dumps({
                "website_scan_id": payload.website_scan_id,
                "cookie_count": payload.cookie_count,
                "third_party": payload.third_party,
                "secure_flag": payload.secure_flag,
                "httponly": payload.httponly,
            }),
        ))
        await db.commit()

    return {"ok": True, "event_id": entry_id, "risk_score": payload.risk_score}


# ─── Module 11: Hover Scan Persistence ─────────────────────────────────────

class HoverScanRequest(BaseModel_):
    website_scan_id: str | None = None
    destination: str
    risk_score: int = 0
    cached: bool = False


@router.post("/telemetry/hover")
async def ingest_hover_scan(payload: HoverScanRequest, db: AsyncSession = Depends(get_db)):
    """
    Module 11 — Link Hover Analysis.
    Persists hover scan records so the dashboard can show what links
    users inspect before clicking.
    """
    hover_id = f"hover-{uuid.uuid4().hex[:12]}"
    db.add(HoverScan(
        hover_scan_id=hover_id,
        website_scan_id=payload.website_scan_id,
        destination=payload.destination,
        risk_score=payload.risk_score,
        cached=payload.cached,
    ))
    await db.commit()
    return {"ok": True, "hover_scan_id": hover_id}

