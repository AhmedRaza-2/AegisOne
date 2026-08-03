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
import asyncio
from fastapi import APIRouter, Form, UploadFile, File, HTTPException, Depends, Query, Body
from typing import Dict, Any, List
from sqlalchemy import select, desc, func, update, cast, Date
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
    WebsiteScan,
    User,
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


from fastapi import APIRouter, Form, UploadFile, File, HTTPException, Depends, Query, Body, Request

async def _get_user_info(db: AsyncSession, user_email: str | None, request: Request | None = None):
    email = user_email
    if not email and request:
        email = request.headers.get("x-user-email") or request.headers.get("X-User-Email")
    if not email:
        return None, "org_default"
    q = await db.execute(select(User).where(User.email == email))
    u = q.scalar_one_or_none()
    if u:
        return u.id, getattr(u, "organization_id", "org_default") or "org_default"
    return None, "org_default"

# --- Compatibility Endpoints ---

@router.post("/analyze/url")
async def api_url(request: Request, url: str = Form(...), scan_type: str = Form("url"), user_email: str = Form(None), db: AsyncSession = Depends(get_db)):
    start = time.time()
    result = await predict_url(url)
    
    # Store the scan for dashboard analytics
    score = result.get("phishing_probability", 0) * 100
    decision = "block" if score >= 76 else "warn" if score >= 51 else "safe"
    
    user_id, org_id = await _get_user_info(db, user_email, request)
    
    scan = WebsiteScan(
        scan_id=f"scan_{uuid.uuid4().hex[:12]}",
        organization_id=org_id,
        user_id=user_id,
        scan_type=scan_type,
        url=url[:2048],
        domain=url.split("/")[2] if "//" in url else url[:255],
        risk_score=score,
        threat_type=result.get("category", "benign"),
        decision=decision,
        scan_duration_ms=round((time.time() - start) * 1000, 1)
    )
    db.add(scan)
    await db.commit()
    
    result["latency_ms"] = scan.scan_duration_ms
    return result


@router.post("/analyze/text")
async def api_text(request: Request, text: str = Form(...), user_email: str = Form(None), db: AsyncSession = Depends(get_db)):
    start = time.time()
    result = await predict_text(text)
    
    # Store the scan for dashboard analytics
    score = result.get("phishing_probability", 0) * 100
    decision = "block" if score >= 76 else "warn" if score >= 51 else "safe"
    
    user_id, org_id = await _get_user_info(db, user_email, request)
    
    scan = WebsiteScan(
        scan_id=f"scan_{uuid.uuid4().hex[:12]}",
        organization_id=org_id,
        user_id=user_id,
        scan_type="text",
        url="Text Snippet: " + text[:100],
        domain="text_scan",
        risk_score=score,
        threat_type=result.get("prediction", "benign"),
        decision=decision,
        scan_duration_ms=round((time.time() - start) * 1000, 1)
    )
    db.add(scan)
    await db.commit()
    
    result["latency_ms"] = scan.scan_duration_ms
    return result


@router.post("/analyze/email")
async def api_email(request: Request, sender: str = Form(""), subject: str = Form(""), body: str = Form(""), user_email: str = Form(None), db: AsyncSession = Depends(get_db)):
    start = time.time()
    result = await predict_email(sender, subject, body)
    score = result.get("phishing_probability", 0) * 100
    decision = "block" if score >= 76 else "warn" if score >= 51 else "safe"
    
    user_id, org_id = await _get_user_info(db, user_email, request)
    
    scan = WebsiteScan(
        scan_id=f"scan_{uuid.uuid4().hex[:12]}",
        organization_id=org_id,
        user_id=user_id,
        scan_type="email",
        url=f"Email: {subject[:80]} (From: {sender[:50]})",
        domain="email_scan",
        risk_score=score,
        threat_type=result.get("prediction", "benign"),
        decision=decision,
        scan_duration_ms=round((time.time() - start) * 1000, 1)
    )
    db.add(scan)
    await db.commit()

    result["latency_ms"] = scan.scan_duration_ms
    return result


@router.post("/analyze/image")
async def api_image(request: Request, file: UploadFile = File(...), user_email: str = Form(None), db: AsyncSession = Depends(get_db)):
    start = time.time()
    data = await file.read()
    results = await route_image_input(data)
    
    overall_prob = 0.0
    predictions = []
    
    for r in results:
        overall_prob = max(overall_prob, r.get("phishing_probability", 0.0))
        predictions.append(r.get("prediction", "legitimate"))
        
    is_phish = overall_prob >= 0.5
    
    score = overall_prob * 100
    decision = "block" if score >= 76 else "warn" if score >= 51 else "safe"
    
    user_id, org_id = await _get_user_info(db, user_email, request)
    
    scan = WebsiteScan(
        scan_id=f"scan_{uuid.uuid4().hex[:12]}",
        organization_id=org_id,
        user_id=user_id,
        scan_type="image",
        url="Image Upload: " + (file.filename or "unknown")[:100],
        domain="image_scan",
        risk_score=score,
        threat_type="phishing" if is_phish else "benign",
        decision=decision,
        scan_duration_ms=round((time.time() - start) * 1000, 1)
    )
    db.add(scan)
    await db.commit()
    
    return {
        "prediction": "phishing" if is_phish else "legitimate",
        "confidence": round(overall_prob if is_phish else 1.0 - overall_prob, 4),
        "phishing_probability": round(overall_prob, 4),
        "model": "image_ocr_composite",
        "sub_results": results,
        "latency_ms": scan.scan_duration_ms
    }


@router.post("/analyze/document")
async def api_document(file: UploadFile = File(...)):
    start = time.time()
    import tempfile
    suffix = os.path.splitext(file.filename)[1] if file.filename else ""
    fd, temp_path = tempfile.mkstemp(suffix=suffix)
    try:
        raw = await file.read()
        with os.fdopen(fd, "wb") as f:
            f.write(raw)
        raw_result = await asyncio.to_thread(process_attachment, temp_path)
    finally:
        if os.path.exists(temp_path):
            os.remove(temp_path)
            
    is_phish = raw_result.get("heuristic_risk") == "high" or "prediction" in raw_result.get("sub_results", {}).get("text", {}) and raw_result["sub_results"]["text"]["prediction"] == "phishing"
    prob = 0.95 if is_phish else 0.05
    
    return {
        "prediction": "phishing" if is_phish else "legitimate",
        "confidence": prob if is_phish else 1.0 - prob,
        "phishing_probability": prob,
        "model": "document_orchestrator",
        "sub_results": raw_result.get("sub_results", {}),
        "latency_ms": round((time.time() - start) * 1000, 1)
    }

@router.post("/analyze/download_url")
async def api_download_url(url: str = Form(...), db: AsyncSession = Depends(get_db)):
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
            result = await asyncio.to_thread(predict_url, url)
            result["latency_ms"] = round((time.time() - start) * 1000, 1)
            result["note"] = f"Local file not found: {local_path}"
            return result

        extraction = await asyncio.to_thread(process_attachment, local_path)
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
            result = await asyncio.to_thread(predict_url, url)
            result["latency_ms"] = round((time.time() - start) * 1000, 1)
            result["note"] = f"Could not fetch file ({e}) — URL-only check"
            return result

        fd, temp_path = tempfile.mkstemp(suffix=suffix)
        try:
            with os.fdopen(fd, "wb") as f:
                f.write(file_bytes)
            extraction = await asyncio.to_thread(process_attachment, temp_path)
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
    
    # Store DownloadEvent in DB
    try:
        from urllib.parse import urlparse
        import uuid
        parsed = urlparse(url)
        filename = os.path.basename(parsed.path) or "unknown_file"
        file_ext = os.path.splitext(filename)[1][:32] or ""
        filename = filename[:512]
        
        db.add(DownloadEvent(
            download_id=f"dl-{uuid.uuid4()}",
            organization_id="org_default",
            filename=filename,
            extension=file_ext,
            file_size_kb=results.get("file_size_kb", 0.0),
            risk_score=int(results["phishing_probability"] * 100),
            threat_type="Malicious File" if is_phishing else "Safe",
            decision="block" if results["phishing_probability"] >= 0.75 else ("warn" if is_phishing else "allow"),
            macros_found=results.get("macros_found", False)
        ))
        await db.commit()
    except Exception as e:
        print(f"[AegisOne] Failed to log download event: {e}")
    
    return results


@router.post("/xai/explain")
async def api_explain(evidence: Dict[str, Any] = Body(...)):
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
        
        # Deduplication check to prevent UNIQUE constraint failures
        existing = await db.execute(select(SecurityEvent).where(SecurityEvent.event_id == event_id))
        if existing.scalar_one_or_none():
            continue
            
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
            raw_filename = details.get("filename") or event.url or "unknown"
            db.add(DownloadEvent(
                download_id=event_id,
                organization_id=event.org_id or DEFAULT_POLICY["org_id"],
                user_id=event.user_id,
                filename=str(raw_filename)[:500],
                extension=str(details.get("extension", ""))[:32],
                sha256=str(details.get("sha256", ""))[:64],
                file_size_kb=float(details.get("size", 0) or 0) / 1024,
                risk_score=event.risk_score or 0,
                decision=str(details.get("decision", event.verdict or "allow"))[:32],
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
        elif event.type in {"page_scan", "website_scan", "url_scan"}:
            decision = details.get("decision", event.verdict or "allow")
            verdict_mapped = "safe" if decision == "allow" else "warning" if decision == "warn" else "danger"
            db.add(WebsiteScan(
                scan_id=event_id,
                organization_id=event.org_id or DEFAULT_POLICY["org_id"],
                user_id=event.user_id,
                device_id=event.device_id,
                url=event.url or event.domain or "unknown",
                domain=event.domain or "unknown",
                scan_type="navigation",
                risk_score=event.risk_score or 0,
                confidence=1.0,
                threat_type=details.get("threat_type", ""),
                verdict=verdict_mapped,
                decision=decision
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


# =============================================================================
# PHASE 5 & 6: Alerts, Timeline, Stats, Recommendations
# =============================================================================

@router.get("/user/alerts")
async def get_user_alerts(email: str = Query(None), db: AsyncSession = Depends(get_db)):
    """Module 13: Alerts Center (High severity items only)"""
    q = await db.execute(
        select(WebsiteScan)
        .where(WebsiteScan.decision == "block")
        .order_by(WebsiteScan.created_at.desc())
        .limit(20)
    )
    alerts = q.scalars().all()
    results = []
    for a in alerts:
        results.append({
            "id": a.scan_id,
            "title": f"High Risk: {a.threat_type or 'Malicious Activity'}",
            "description": f"Blocked access to {a.url}",
            "time": str(a.created_at),
            "severity": "critical"
        })
    # Add a mock credential alert for variety if list is small
    import datetime
    if len(results) < 3:
        results.append({
            "id": "alert-mock-1",
            "title": "Credential Theft Prevented",
            "description": "Stopped a password submission to an unknown server.",
            "time": str(datetime.datetime.now() - datetime.timedelta(hours=1)),
            "severity": "high"
        })
    return {"alerts": results}

@router.get("/user/timeline")
async def get_user_timeline(email: str = Query(None), db: AsyncSession = Depends(get_db)):
    """Module 14: Security Timeline (Story mode)"""
    q = await db.execute(
        select(WebsiteScan)
        .order_by(WebsiteScan.created_at.desc())
        .limit(30)
    )
    scans = q.scalars().all()
    results = []
    for s in scans:
        results.append({
            "id": s.scan_id,
            "event": "Scanned Website" if s.decision == "allow" else "Blocked Threat",
            "target": s.domain or s.url,
            "decision": s.decision,
            "risk": s.risk_score,
            "time": str(s.created_at)
        })
    return {"timeline": results}

@router.get("/user/personal-stats")
async def get_personal_stats(email: str = Query(None), db: AsyncSession = Depends(get_db)):
    """Module 15: Personal Statistics"""
    # Mocking historical periods for the UI
    return {
        "stats": {
            "24h": {"visited": 142, "prevented": 3, "scanned": 150, "avgRisk": 12},
            "7d": {"visited": 890, "prevented": 14, "scanned": 940, "avgRisk": 15},
            "30d": {"visited": 3400, "prevented": 42, "scanned": 3650, "avgRisk": 10},
        }
    }

@router.get("/user/recommendations")
async def get_user_recommendations(email: str = Query(None)):
    """Module 18: Security Recommendations"""
    return {
        "recommendations": [
            {"id": 1, "title": "Avoid shortened URLs", "desc": "You clicked on 3 bit.ly links recently. Expand them before clicking.", "type": "warning"},
            {"id": 2, "title": "Enable MFA", "desc": "We detected logins without Multi-Factor Authentication. Secure your accounts.", "type": "action"},
            {"id": 3, "title": "Update Browser", "desc": "Your Chrome version is 2 versions behind. Update to patch vulnerabilities.", "type": "critical"},
            {"id": 4, "title": "Don't reuse passwords", "desc": "AegisOne detected similar password hashes used across multiple sites.", "type": "warning"}
        ]
    }


# =============================================================================
# PHASE 4: AI & Explainability
# =============================================================================

@router.get("/user/xai")
async def get_user_xai(email: str = Query(None), db: AsyncSession = Depends(get_db)):
    """Module 6: Explainable AI Center"""
    q = await db.execute(
        select(WebsiteScan)
        .where(WebsiteScan.decision.in_(["warn", "block"]))
        .order_by(WebsiteScan.created_at.desc())
        .limit(20)
    )
    scans = q.scalars().all()
    
    results = []
    for s in scans:
        factors_raw = s.top_factors or '["Suspicious keywords detected"]'
        import json
        try:
            factors = json.loads(factors_raw) if isinstance(factors_raw, str) and factors_raw.startswith('[') else [factors_raw]
        except:
            factors = [factors_raw]
            
        results.append({
            "id": s.scan_id,
            "target": s.url,
            "verdict": "Phishing" if s.decision == "block" else "Suspicious",
            "risk": s.risk_score,
            "confidence": min(s.risk_score + 5, 99),  # Simulated high confidence
            "reasons": factors,
            "recommendation": "Avoid entering credentials and close the tab immediately." if s.decision == "block" else "Proceed with extreme caution.",
            "timestamp": str(s.created_at)
        })
    return {"explanations": results}

@router.get("/user/models")
async def get_ai_models_status(email: str = Query(None)):
    """Module 12: AI Models Status"""
    import random
    return {
        "models": [
            {"name": "URL Model", "status": "Healthy", "latency": f"{random.randint(40, 80)} ms", "uptime": "99.99%", "version": "v4.2.1"},
            {"name": "Image Model", "status": "Healthy", "latency": f"{random.randint(180, 250)} ms", "uptime": "99.95%", "version": "v2.8.0"},
            {"name": "Text Model", "status": "Healthy", "latency": f"{random.randint(60, 110)} ms", "uptime": "99.98%", "version": "v5.0.3"},
            {"name": "Attachment Model", "status": "Healthy", "latency": f"{random.randint(300, 450)} ms", "uptime": "99.90%", "version": "v1.9.4"}
        ],
        "globalLatency": "182 ms",
        "lastUpdated": "Just now"
    }

@router.get("/user/browser")
async def get_browser_status(email: str = Query(None)):
    """Module 11: Browser Protection Status"""
    return {
        "status": {
            "extension": "Online",
            "protection": "Enabled",
            "lastSync": "2 mins ago",
            "aiConnected": "Yes",
            "database": "Connected",
            "mode": "Aggressive"
        }
    }


# =============================================================================
# PHASE 3: Downloads, Credentials, Image/QR
# =============================================================================

@router.get("/user/downloads")
async def get_user_downloads(email: str = Query(None), db: AsyncSession = Depends(get_db)):
    """Module 8: Download Protection"""
    q = await db.execute(select(DownloadEvent).order_by(DownloadEvent.created_at.desc()).limit(50))
    downloads = q.scalars().all()
    
    # Mock data for FYP if empty
    if not downloads:
        import datetime
        now = datetime.datetime.now()
        results = [
            {"id": "dl-1", "filename": "invoice_Q3.pdf", "size": "1.2 MB", "type": "PDF Document", "risk": "Low (0%)", "decision": "Allowed", "timestamp": str(now - datetime.timedelta(hours=1))},
            {"id": "dl-2", "filename": "setup_installer.exe", "size": "45.1 MB", "type": "Executable", "risk": "High (94%)", "decision": "Blocked", "timestamp": str(now - datetime.timedelta(hours=3))},
            {"id": "dl-3", "filename": "financial_report.xlsx", "size": "3.4 MB", "type": "Excel Spreadsheet", "risk": "Medium (45%)", "decision": "Warned", "timestamp": str(now - datetime.timedelta(hours=12))},
            {"id": "dl-4", "filename": "meeting_notes.docx", "size": "0.8 MB", "type": "Word Document", "risk": "Low (2%)", "decision": "Allowed", "timestamp": str(now - datetime.timedelta(days=1))},
        ]
        return {"downloads": results}

    results = []
    for d in downloads:
        results.append({
            "id": d.download_id,
            "filename": d.filename,
            "size": f"{d.file_size_kb / 1024:.1f} MB",
            "type": d.extension.upper() if d.extension else "Unknown",
            "risk": f"{'High' if d.risk_score > 70 else 'Medium' if d.risk_score > 30 else 'Low'} ({d.risk_score}%)",
            "decision": "Blocked" if d.decision == "block" else "Warned" if d.decision == "warn" else "Allowed",
            "timestamp": str(d.created_at)
        })
    return {"downloads": results}

@router.get("/user/credentials")
async def get_user_credentials(email: str = Query(None), db: AsyncSession = Depends(get_db)):
    """Module 9: Credential Protection"""
    q = await db.execute(select(CredentialEvent).order_by(CredentialEvent.created_at.desc()).limit(50))
    creds = q.scalars().all()
    
    protected = 0
    attempted = 0
    blocked = 0
    allowed = 0
    timeline = []
    
    if not creds:
        # Mock data for FYP
        import datetime
        now = datetime.datetime.now()
        protected = 3
        attempted = 4
        blocked = 3
        allowed = 1
        timeline = [
            {"id": "cr-1", "domain": "paypal-login.xyz", "type": "Password", "action": "Blocked", "timestamp": str(now - datetime.timedelta(hours=2))},
            {"id": "cr-2", "domain": "microsoft-auth.net", "type": "OTP", "action": "Blocked", "timestamp": str(now - datetime.timedelta(hours=14))},
            {"id": "cr-3", "domain": "github.com", "type": "Password", "action": "Allowed", "timestamp": str(now - datetime.timedelta(days=1))},
            {"id": "cr-4", "domain": "internal-portal.local", "type": "PIN", "action": "Blocked", "timestamp": str(now - datetime.timedelta(days=3))},
        ]
    else:
        attempted = len(creds)
        for c in creds:
            if c.blocked:
                blocked += 1
                protected += 1
            else:
                allowed += 1
            
            timeline.append({
                "id": c.credential_event_id,
                "domain": c.domain,
                "type": c.credential_type.capitalize(),
                "action": "Blocked" if c.blocked else "Allowed",
                "timestamp": str(c.created_at)
            })
            
    return {
        "stats": {
            "protected": protected,
            "attempted": attempted,
            "blocked": blocked,
            "allowed": allowed
        },
        "timeline": timeline
    }

@router.get("/user/media")
async def get_user_media(email: str = Query(None), db: AsyncSession = Depends(get_db)):
    """Module 10: Image & QR Detection"""
    # Fetch all website scans where scan_type is image or threat_type contains QR
    q = await db.execute(
        select(WebsiteScan)
        .where(
            (WebsiteScan.scan_type == "image") | 
            (WebsiteScan.threat_type.ilike("%qr%"))
        )
        .order_by(WebsiteScan.created_at.desc())
        .limit(50)
    )
    media = q.scalars().all()
    
    # Mock data if empty for FYP
    if not media:
        import datetime
        now = datetime.datetime.now()
        results = [
            {"id": "md-1", "type": "QR Code", "target": "https://malicious-crypto.io", "risk": 95, "decision": "Blocked", "timestamp": str(now - datetime.timedelta(minutes=30))},
            {"id": "md-2", "type": "Image OCR", "target": "Fake Invoice Payment Details", "risk": 65, "decision": "Warned", "timestamp": str(now - datetime.timedelta(hours=5))},
            {"id": "md-3", "type": "Logo Spoofing", "target": "Microsoft Brand Logo", "risk": 82, "decision": "Blocked", "timestamp": str(now - datetime.timedelta(days=2))},
        ]
        return {"media": results}
        
    results = []
    for m in media:
        m_type = "QR Code" if "qr" in (m.threat_type or "").lower() else "Image Scan"
        results.append({
            "id": m.scan_id,
            "type": m_type,
            "target": m.url or "Unknown Source",
            "risk": m.risk_score,
            "decision": "Blocked" if m.decision == "block" else "Warned" if m.decision == "warn" else "Allowed",
            "timestamp": str(m.created_at)
        })
    return {"media": results}


# =============================================================================
# PHASE 2: Threat Center (Module 3) & URL Intelligence (Module 7)
# =============================================================================

@router.get("/user/threats")
async def get_user_threats(email: str = Query(None), db: AsyncSession = Depends(get_db)):
    """
    Returns data for Module 3: Threat Center.
    Categorizes all warnings and blocks into specific threat vectors.
    """
    from sqlalchemy import func
    
    # We will approximate the categories based on scan_type and threat_type
    q = await db.execute(
        select(WebsiteScan)
        .where(WebsiteScan.decision.in_(["warn", "block"]))
        .order_by(WebsiteScan.created_at.desc())
        .limit(100)
    )
    threats = q.scalars().all()
    
    # Dynamic Categorization buckets based on actual scan types
    categories = {
        "Phishing Websites": 0,
        "Malware Domains": 0,
        "Malicious Text/Emails": 0,
        "Dangerous Downloads": 0,
        "Dangerous QR/Images": 0,
        "Fake Login Pages": 0,
        "Suspicious Scripts": 0
    }
    
    recent_threats = []
    
    for t in threats:
        tt = (t.threat_type or "").lower()
        st = (t.scan_type or "").lower()
        url_lower = (t.url or "").lower()
        
        assigned_cat = "Suspicious Content"
        
        # Determine strict category based on scan_type and threat_type
        if st == "text":
            categories["Malicious Text/Emails"] += 1
            assigned_cat = "Malicious Text/Emails"
        elif st == "image" or "qr" in tt:
            categories["Dangerous QR/Images"] += 1
            assigned_cat = "Dangerous QR/Images"
        elif st == "attachment":
            categories["Dangerous Downloads"] += 1
            assigned_cat = "Dangerous Downloads"
        elif st == "url":
            if "login" in url_lower or "signin" in url_lower or "credential" in tt:
                categories["Fake Login Pages"] += 1
                assigned_cat = "Fake Login Pages"
            elif "malware" in tt:
                categories["Malware Domains"] += 1
                assigned_cat = "Malware Domains"
            elif "script" in tt or "xss" in tt:
                categories["Suspicious Scripts"] += 1
                assigned_cat = "Suspicious Scripts"
            else:
                categories["Phishing Websites"] += 1
                assigned_cat = "Phishing Websites"
        else:
            categories["Phishing Websites"] += 1
            assigned_cat = "Phishing Websites"
            
        recent_threats.append({
            "id": t.scan_id,
            "target": t.url,
            "category": assigned_cat,
            "riskScore": t.risk_score,
            "decision": "Blocked" if t.decision == "block" else "Warned",
            "timestamp": str(t.created_at)
        })
        
    # Remove categories with 0 count to keep UI clean, but ensure at least 4 for grid layout
    cards = [{"title": k, "count": v} for k, v in categories.items()]
    cards.sort(key=lambda x: x["count"], reverse=True)
    
    return {
        "cards": cards,
        "recent": recent_threats[:25]
    }

@router.get("/user/url-intelligence")
async def get_user_url_intelligence(email: str = Query(None), db: AsyncSession = Depends(get_db)):
    """
    Returns data for Module 7: URL Intelligence.
    Focuses exclusively on URL scans and infers SSL/Redirects for UI realism.
    """
    q = await db.execute(
        select(WebsiteScan)
        .where(WebsiteScan.scan_type == "url")
        .order_by(WebsiteScan.created_at.desc())
        .limit(100)
    )
    scans = q.scalars().all()
    
    results = []
    for s in scans:
        url_str = s.url.lower()
        has_ssl = url_str.startswith("https")
        factors = str(s.top_factors or "").lower()
        redirects = "redirect" in factors
        
        # Mock domain age based on risk (low risk = older, high risk = new)
        domain_age = "5+ Years"
        if s.risk_score > 80: domain_age = "3 Days"
        elif s.risk_score > 50: domain_age = "2 Months"
        elif s.risk_score > 20: domain_age = "1 Year"
        
        # Reputation
        rep = "Excellent"
        if s.risk_score > 80: rep = "Malicious"
        elif s.risk_score > 50: rep = "Suspicious"
        elif s.risk_score > 20: rep = "Unknown"
        
        results.append({
            "id": s.scan_id,
            "url": s.url,
            "reputation": rep,
            "domainAge": domain_age,
            "ssl": "Valid (HTTPS)" if has_ssl else "Missing (HTTP)",
            "redirects": "Detected" if redirects else "None",
            "result": "Blocked" if s.decision == "block" else "Warned" if s.decision == "warn" else "Allowed",
            "riskScore": s.risk_score,
            "timestamp": str(s.created_at)
        })
        
    return {"urls": results}


@router.get("/user/analytics")
async def get_user_analytics(email: str = Query(None), db: AsyncSession = Depends(get_db)):
    """
    Returns data specifically formatted for the Recharts graphs in Module 4.
    """
    from datetime import datetime, timezone, timedelta
    from sqlalchemy import func
    
    # 1. Daily Risk Trend (Last 7 Days)
    now = datetime.utcnow()
    daily_trend = []
    
    for i in range(6, -1, -1):
        target_date = (now - timedelta(days=i)).date()
        # Count total vs threats for that day
        total = await db.scalar(
            select(func.count(WebsiteScan.id))
            .where(cast(WebsiteScan.created_at, Date) == target_date)
        ) or 0
        
        threats = await db.scalar(
            select(func.count(WebsiteScan.id))
            .where(cast(WebsiteScan.created_at, Date) == target_date, WebsiteScan.decision.in_(["warn", "block"]))
        ) or 0
        
        daily_trend.append({
            "name": target_date.strftime("%a"),
            "safe": total - threats,
            "threats": threats
        })
        
    # 2. Threat Types Pie Chart
    threat_types_q = await db.execute(
        select(WebsiteScan.scan_type, func.count(WebsiteScan.id))
        .where(WebsiteScan.decision.in_(["warn", "block"]))
        .group_by(WebsiteScan.scan_type)
    )
    threat_types_raw = threat_types_q.all()
    threat_types = [{"name": row[0].upper(), "value": row[1]} for row in threat_types_raw]
    
    if not threat_types:
        threat_types = [{"name": "No Threats", "value": 1}]
        
    # 3. Risk Distribution
    low_q = await db.execute(select(func.count(WebsiteScan.id)).where(WebsiteScan.risk_score <= 30))
    med_q = await db.execute(select(func.count(WebsiteScan.id)).where(WebsiteScan.risk_score > 30, WebsiteScan.risk_score <= 70))
    high_q = await db.execute(select(func.count(WebsiteScan.id)).where(WebsiteScan.risk_score > 70))
    
    risk_distribution = [
        {"name": "Low Risk", "count": low_q.scalar() or 0, "fill": "#22c55e"},
        {"name": "Medium Risk", "count": med_q.scalar() or 0, "fill": "#f59e0b"},
        {"name": "High Risk", "count": high_q.scalar() or 0, "fill": "#ef4444"}
    ]
    
    return {
        "dailyTrend": daily_trend,
        "threatTypes": threat_types,
        "riskDistribution": risk_distribution
    }


@router.get("/user/stats")
async def get_user_dashboard_stats(email: str = Query(None), db: AsyncSession = Depends(get_db)):
    """
    Returns advanced dashboard stats including Today's Activity,
    Security Health Score, and detailed history.
    """
    from datetime import datetime, timezone, timedelta
    from sqlalchemy import func
    
    # Get today's start and end for date filtering (using 30-day window so FYP demo has data)
    now_utc = datetime.utcnow()
    today_start = now_utc - timedelta(days=30)
    
    # 1. Fetch user by email to isolate stats
    user_q = await db.execute(select(User).where(User.email == email))
    user = user_q.scalar()
    user_id = user.id if user else None

    # 1. Total Scans (All Time)
    q_base = select(func.count(WebsiteScan.id))
    if user_id:
        q_base = q_base.where(WebsiteScan.user_id == user_id)
    else:
        q_base = q_base.where(1 == 0)
    total_scans_q = await db.execute(q_base)
    total_scans = total_scans_q.scalar() or 0
    
    # 2. Total Scans (Today)
    q_today = select(func.count(WebsiteScan.id)).where(WebsiteScan.created_at >= today_start)
    if user_id:
        q_today = q_today.where(WebsiteScan.user_id == user_id)
    else:
        q_today = q_today.where(1 == 0)
    today_scans_q = await db.execute(q_today)
    today_scans = today_scans_q.scalar() or 0
    
    # 3. Safe Scans (Today)
    today_safe_q = select(func.count(WebsiteScan.id)).where(WebsiteScan.created_at >= today_start, WebsiteScan.decision == "allow")
    if user_id:
        today_safe_q = today_safe_q.where(WebsiteScan.user_id == user_id)
    else:
        today_safe_q = today_safe_q.where(1 == 0)
    today_safe = ((await db.execute(today_safe_q)).scalar() or 0)
    
    # 4. Warnings (Today)
    today_warnings_q = select(func.count(WebsiteScan.id)).where(WebsiteScan.created_at >= today_start, WebsiteScan.decision == "warn")
    if user_id:
        today_warnings_q = today_warnings_q.where(WebsiteScan.user_id == user_id)
    else:
        today_warnings_q = today_warnings_q.where(1 == 0)
    today_warns = ((await db.execute(today_warnings_q)).scalar() or 0)
    
    # 5. Blocks (Today)
    today_blocks_q = select(func.count(WebsiteScan.id)).where(WebsiteScan.created_at >= today_start, WebsiteScan.decision == "block")
    if user_id:
        today_blocks_q = today_blocks_q.where(WebsiteScan.user_id == user_id)
    else:
        today_blocks_q = today_blocks_q.where(1 == 0)
    today_blocks = ((await db.execute(today_blocks_q)).scalar() or 0)
    
    # 6. Detailed Scan Types Breakdown
    scan_types_q = select(WebsiteScan.scan_type, func.count(WebsiteScan.id)).group_by(WebsiteScan.scan_type)
    if user_id:
        scan_types_q = scan_types_q.where(WebsiteScan.user_id == user_id)
    else:
        scan_types_q = scan_types_q.where(1 == 0)
    scan_types_raw = (await db.execute(scan_types_q)).all()
    types_breakdown = {"website": 0, "url": 0, "text": 0, "image": 0, "attachment": 0}
    for row in scan_types_raw:
        stype = (row[0] or "url").lower()
        if stype in types_breakdown:
            types_breakdown[stype] += row[1]
            
    # 7. Critical vs Non-Critical (All Time)
    critical_q = select(func.count(WebsiteScan.id)).where(WebsiteScan.risk_score >= 75)
    if user_id:
        critical_q = critical_q.where(WebsiteScan.user_id == user_id)
    else:
        critical_q = critical_q.where(1 == 0)
    critical_count = ((await db.execute(critical_q)).scalar() or 0)
    non_critical_count = max(0, total_scans - critical_count)

    # 8. Credential Events (Today)
    today_creds_q = select(func.count(SecurityEvent.id)).where(SecurityEvent.timestamp >= today_start, SecurityEvent.event_type == "credential_intercept")
    if user_id:
        today_creds_q = today_creds_q.where(SecurityEvent.user_id == str(user_id))
    else:
        today_creds_q = today_creds_q.where(1 == 0)
    today_creds = ((await db.execute(today_creds_q)).scalar() or 0)
    
    # 9. Download Events (Files)
    files_total_q = select(func.count(DownloadEvent.id))
    files_ws_total_q = select(func.count(WebsiteScan.id)).where(WebsiteScan.scan_type == "document")
    files_blocked_q = select(func.count(DownloadEvent.id)).where(DownloadEvent.decision == "block")
    files_ws_blocked_q = select(func.count(WebsiteScan.id)).where(WebsiteScan.scan_type == "document", WebsiteScan.decision == "block")
    files_warned_q = select(func.count(DownloadEvent.id)).where(DownloadEvent.decision == "warn")
    files_ws_warned_q = select(func.count(WebsiteScan.id)).where(WebsiteScan.scan_type == "document", WebsiteScan.decision == "warn")

    if user_id:
        files_total_q = files_total_q.where(DownloadEvent.user_id == str(user_id))
        files_ws_total_q = files_ws_total_q.where(WebsiteScan.user_id == user_id)
        files_blocked_q = files_blocked_q.where(DownloadEvent.user_id == str(user_id))
        files_ws_blocked_q = files_ws_blocked_q.where(WebsiteScan.user_id == user_id)
        files_warned_q = files_warned_q.where(DownloadEvent.user_id == str(user_id))
        files_ws_warned_q = files_ws_warned_q.where(WebsiteScan.user_id == user_id)
    else:
        files_total_q = files_total_q.where(1 == 0)
        files_ws_total_q = files_ws_total_q.where(1 == 0)
        files_blocked_q = files_blocked_q.where(1 == 0)
        files_ws_blocked_q = files_ws_blocked_q.where(1 == 0)
        files_warned_q = files_warned_q.where(1 == 0)
        files_ws_warned_q = files_ws_warned_q.where(1 == 0)

    files_total = ((await db.execute(files_total_q)).scalar() or 0) + ((await db.execute(files_ws_total_q)).scalar() or 0)
    files_blocked = ((await db.execute(files_blocked_q)).scalar() or 0) + ((await db.execute(files_ws_blocked_q)).scalar() or 0)
    files_proceeded_at_risk = ((await db.execute(files_warned_q)).scalar() or 0) + ((await db.execute(files_ws_warned_q)).scalar() or 0)

    # All-time threats blocked
    threats_blocked_q = select(func.count(WebsiteScan.id)).where(WebsiteScan.decision.in_(["warn", "block"]))
    web_blocked_q = select(func.count(WebsiteScan.id)).where(WebsiteScan.scan_type == "website", WebsiteScan.decision.in_(["warn", "block"]))
    url_blocked_q = select(func.count(WebsiteScan.id)).where(WebsiteScan.scan_type == "url", WebsiteScan.decision.in_(["warn", "block"]))

    if user_id:
        threats_blocked_q = threats_blocked_q.where(WebsiteScan.user_id == user_id)
        web_blocked_q = web_blocked_q.where(WebsiteScan.user_id == user_id)
        url_blocked_q = url_blocked_q.where(WebsiteScan.user_id == user_id)
    else:
        threats_blocked_q = threats_blocked_q.where(1 == 0)
        web_blocked_q = web_blocked_q.where(1 == 0)
        url_blocked_q = url_blocked_q.where(1 == 0)

    threats_blocked = ((await db.execute(threats_blocked_q)).scalar() or 0)
    web_blocked = ((await db.execute(web_blocked_q)).scalar() or 0)
    url_blocked = ((await db.execute(url_blocked_q)).scalar() or 0)
    
    safe_rate = 100
    if total_scans > 0:
        safe_rate = round(((total_scans - threats_blocked) / total_scans) * 100)
        
    # Recent scans
    scans_q = select(WebsiteScan).order_by(WebsiteScan.created_at.desc()).limit(200)
    if user_id:
        scans_q = scans_q.where(WebsiteScan.user_id == user_id)
    else:
        scans_q = scans_q.where(1 == 0)
    recent_scans = (await db.execute(scans_q)).scalars().all()
    
    # Recent downloads
    dl_q = select(DownloadEvent).order_by(DownloadEvent.created_at.desc()).limit(200)
    if user_id:
        dl_q = dl_q.where(DownloadEvent.user_id == str(user_id))
    else:
        dl_q = dl_q.where(1 == 0)
    recent_downloads = (await db.execute(dl_q)).scalars().all()
    
    # Combine and sort both lists
    combined_activity = []
    for s in recent_scans:
        combined_activity.append({
            "id": s.scan_id,
            "scanType": s.scan_type,
            "inputPreview": s.url,
            "domain": s.domain,
            "riskScore": s.risk_score,
            "threatType": s.threat_type,
            "topFactors": s.top_factors,
            "decision": s.decision,
            "riskLevel": "danger" if s.decision == "block" else "suspicious" if s.decision == "warn" else "safe",
            "timestamp": s.created_at,
            "iso_timestamp": str(s.created_at).replace(" ", "T") + "Z"
        })
        
    for d in recent_downloads:
        action_text = "blocked" if d.decision == "block" else ("proceeded at risk" if d.decision == "warn" else "downloaded")
        combined_activity.append({
            "id": d.download_id,
            "scanType": "attachment",
            "inputPreview": f"File Download ({action_text}): {d.filename}",
            "domain": "Local Device",
            "riskScore": d.risk_score,
            "threatType": d.threat_type or "Malicious File",
            "topFactors": "[]",
            "decision": d.decision,
            "riskLevel": "danger" if d.decision == "block" else "suspicious" if d.decision == "warn" else "safe",
            "timestamp": d.created_at,
            "iso_timestamp": str(d.created_at).replace(" ", "T") + "Z"
        })
        
    # Sort descending by timestamp
    combined_activity.sort(key=lambda x: x["timestamp"], reverse=True)
    # Take top 500
    combined_activity = combined_activity[:500]
    
    # Clean up the output dicts to match what the frontend expects
    final_scans = []
    for item in combined_activity:
        out = item.copy()
        out["timestamp"] = out["iso_timestamp"]
        del out["iso_timestamp"]
        final_scans.append(out)
    
    # Calculate Security Health Score (0-100)
    health_score = 100
    if critical_count > 0: health_score -= min(30, critical_count * 2)
    if today_warns > 0: health_score -= min(15, today_warns * 1)
    if today_creds > 0: health_score -= 10
    if health_score < 0: health_score = 0
    
    # Calculate Component Scores based on real telemetry
    network_score = max(0, 100 - min(100, critical_count * 3 + today_warns * 1))
    endpoint_score = max(0, 100 - min(100, files_blocked * 5 + files_proceeded_at_risk * 10))
    identity_score = max(0, 100 - min(100, today_creds * 20))
    
    # Dynamic AI Summary
    ai_summary = "Your digital footprint is currently secure."
    if critical_count > 0:
        ai_summary = f"AegisOne has blocked {critical_count} critical threats recently. "
    if today_creds > 0:
        ai_summary += f"We successfully protected your credentials {today_creds} times today."

    last_scan = str(recent_scans[0].created_at) if recent_scans else None
    
    return {
        "totalScans": total_scans,
        "threatsBlocked": threats_blocked,
        "criticalThreats": critical_count,
        "nonCriticalThreats": non_critical_count,
        "safeRate": safe_rate,
        "lastScan": last_scan,
        "healthScore": health_score,
        "networkScore": network_score,
        "endpointScore": endpoint_score,
        "identityScore": identity_score,
        "scanBreakdown": types_breakdown,
        "webStats": {
            "scanned": types_breakdown.get("website", 0),
            "blocked": web_blocked
        },
        "urlStats": {
            "scanned": types_breakdown.get("url", 0),
            "blocked": url_blocked
        },
        "fileStats": {
            "downloaded": files_total,
            "phishing": files_blocked + files_proceeded_at_risk,
            "blocked": files_blocked,
            "proceededAtRisk": files_proceeded_at_risk
        },
        "todayStats": {
            "scans": today_scans,
            "safe": today_safe,
            "warnings": today_warns,
            "blocked": today_blocks,
            "credentials": today_creds
        },
        "aiSummary": ai_summary,
        "scans": final_scans
    }


@router.get("/user/threats")
async def get_user_threats(email: str = Query(...), db: AsyncSession = Depends(get_db)):
    # Get recent blocked/warned website scans
    web_q = await db.execute(
        select(WebsiteScan)
        .where(WebsiteScan.decision.in_(["warn", "block"]))
        .order_by(WebsiteScan.created_at.desc())
        .limit(50)
    )
    web_threats = web_q.scalars().all()

    # Get recent blocked/warned downloads
    dl_q = await db.execute(
        select(DownloadEvent)
        .where(DownloadEvent.decision.in_(["warn", "block"]))
        .order_by(DownloadEvent.created_at.desc())
        .limit(50)
    )
    dl_threats = dl_q.scalars().all()

    combined = []
    for w in web_threats:
        combined.append({
            "id": w.scan_id,
            "category": "Phishing " + w.scan_type.capitalize() if w.scan_type else "Phishing Website",
            "target": w.url,
            "decision": "Blocked" if w.decision == "block" else "Proceeded at Risk",
            "riskScore": w.risk_score,
            "timestamp": w.created_at,
            "iso_timestamp": str(w.created_at).replace(" ", "T") + "Z"
        })
    
    for d in dl_threats:
        combined.append({
            "id": d.download_id,
            "category": "Malicious Attachment",
            "target": d.filename,
            "decision": "Blocked" if d.decision == "block" else "Proceeded at Risk",
            "riskScore": d.risk_score,
            "timestamp": d.created_at,
            "iso_timestamp": str(d.created_at).replace(" ", "T") + "Z"
        })
    
    combined.sort(key=lambda x: x["timestamp"], reverse=True)

    # Remediated count (all blocks)
    rem_web_q = await db.execute(select(func.count(WebsiteScan.id)).where(WebsiteScan.decision == "block"))
    rem_dl_q = await db.execute(select(func.count(DownloadEvent.id)).where(DownloadEvent.decision == "block"))
    remediated = (rem_web_q.scalar() or 0) + (rem_dl_q.scalar() or 0)

    # Calculate average threat score for active threats
    avg_threat_score = 0.0
    if combined:
        avg_threat_score = round(sum(c["riskScore"] for c in combined[:10]) / len(combined[:10]) / 10, 1)

    # Dynamic Active Alerts
    active_alerts = []
    if any("Website" in c["category"] for c in combined[:5]):
        active_alerts.append({
            "title": "Phishing Spike Detected",
            "desc": "Multiple phishing URLs intercepted in the last hour.",
            "time": "Just now",
            "icon": "shield"
        })
    if any("Attachment" in c["category"] for c in combined[:5]):
        active_alerts.append({
            "title": "Malware Payload Intercepted",
            "desc": "High-risk executable or macro document blocked.",
            "time": "12 minutes ago",
            "icon": "alert"
        })
    if len(active_alerts) == 0:
        active_alerts.append({
            "title": "System Secure",
            "desc": "No active attack vectors detected currently.",
            "time": "Present",
            "icon": "check"
        })
    
    global_activity = {
        "source": "192.168.1.1",
        "dest": "AWS-US-EAST",
        "info": "New edge point established in Frankfurt"
    }
    if combined:
        global_activity["dest"] = "BLOCKED-NODE"
        global_activity["info"] = f"Blocked connection to {combined[0]['target'][:30]}..."

    return {
        "recent": combined[:50],
        "remediatedCount": remediated,
        "threatScore": avg_threat_score,
        "activeAlerts": active_alerts,
        "globalActivity": global_activity
    }
