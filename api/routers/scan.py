"""
AegisOne API — Scan Router
===========================
All AI scan endpoints. Stores results in website_scans (metadata only).
No raw HTML, images, or page content ever persisted.
"""
import time
import json
import uuid
from fastapi import APIRouter, Depends, File, UploadFile, Form, BackgroundTasks
from sqlalchemy.ext.asyncio import AsyncSession
from PIL import Image
import io

from api.database.db import get_db
from api.database.models import User, WebsiteScan
from api.database.schemas import (
    URLScanRequest, TextScanRequest, ScanResponse, ModelResult, URLResult, ScanType
)
from api.dependencies import get_optional_user

from api.services.model_orchestrator import (
    predict_url, predict_text, predict_email, process_attachment
)
from api.services.content_router import route_image_input, route_text_input
from api.services.risk_aggregator import aggregate_model_results
from api.services.cache_service import get_cached_url_result, set_cached_url_result

router = APIRouter(prefix="/scan", tags=["Scanning"])


# ── Background logging ────────────────────────────────────────────────────────

async def log_website_scan(
    db: AsyncSession,
    scan_id: str,
    user: User | None,
    scan_type: ScanType,
    url_or_summary: str,
    results: dict,
):
    """
    Persist the scan result to website_scans (metadata only).
    Called as a background task — never blocks the response.
    """
    try:
        verdict_str = results.get("verdict", "")
        verdict_val = verdict_str.value if hasattr(verdict_str, "value") else str(verdict_str)
        score = results.get("overall_risk_score", 0)

        # Map internal verdict labels to decision
        if score >= 76:
            decision = "block"
        elif score >= 51:
            decision = "warn"
        else:
            decision = "allow"

        # Extract top factors (labels only, no page content)
        models_used = results.get("models_used", [])
        top_factors = [
            m.get("explanation", m.get("prediction", ""))
            for m in models_used[:5]
            if isinstance(m, dict)
        ]

        from urllib.parse import urlparse
        domain = ""
        try:
            domain = urlparse(url_or_summary).netloc or url_or_summary[:255]
        except Exception:
            domain = url_or_summary[:255]

        ws = WebsiteScan(
            scan_id=scan_id,
            organization_id=getattr(user, "organization_id", "org_default") or "org_default",
            user_id=getattr(user, "id", None),
            scan_type=scan_type.value,
            url=url_or_summary[:2048],       # URL stored; HTML is NOT
            domain=domain[:255],
            risk_score=score,
            confidence=round(
                max((m.get("confidence", 0) for m in models_used if isinstance(m, dict)), default=0.0),
                4,
            ),
            threat_type=results.get("verdict_label", ""),
            verdict=decision,
            decision=decision,
            modules_used=json.dumps([
                m.get("model", "") for m in models_used if isinstance(m, dict)
            ]),
            top_factors=json.dumps(top_factors),
            scan_duration_ms=results.get("processing_time_ms", 0.0),
        )
        db.add(ws)
        await db.commit()
    except Exception as e:
        print(f"[AegisOne:ScanLog] Error: {e}")


# ── Response builder ──────────────────────────────────────────────────────────

def format_response(
    scan_type: ScanType,
    model_results: list[dict],
    start_time: float,
    extra_fields: dict = None,
) -> ScanResponse:
    """Standardize the response format across all scan endpoints."""
    url_res   = []
    other_res = []

    for r in model_results:
        if r.get("model") == "url":
            url_res.append(URLResult(
                url=r.get("url", "unknown"),
                prediction=r["prediction"],
                confidence=r["confidence"],
                phishing_probability=r["phishing_probability"],
                category=r.get("category", "unknown"),
            ))
        else:
            other_res.append(ModelResult(**r))

    overall_score, verdict, label = aggregate_model_results(model_results)

    resp = {
        "scan_id":            f"aegis-{int(time.time())}-{str(uuid.uuid4())[:8]}",
        "timestamp":          time.strftime("%Y-%m-%dT%H:%M:%SZ", time.gmtime()),
        "overall_risk_score": overall_score,
        "verdict":            verdict,
        "verdict_label":      label,
        "models_used":        other_res,
        "url_results":        url_res,
        "input_type_detected": scan_type.value,
        "processing_time_ms": round((time.time() - start_time) * 1000, 1),
    }

    if extra_fields:
        resp.update(extra_fields)

    return ScanResponse(**resp)


# ── Endpoints ─────────────────────────────────────────────────────────────────

@router.post("/url", response_model=ScanResponse)
async def scan_url(
    req: URLScanRequest,
    bg_tasks: BackgroundTasks,
    db: AsyncSession = Depends(get_db),
    user: User = Depends(get_optional_user),
):
    start_time = time.time()
    cached = get_cached_url_result(req.url)
    if cached:
        result = cached
    else:
        result = predict_url(req.url)
        result["url"] = req.url
        set_cached_url_result(req.url, result)

    response = format_response(ScanType.URL, [result], start_time)
    bg_tasks.add_task(
        log_website_scan, db, response.scan_id, user, ScanType.URL,
        req.url, response.model_dump(),
    )
    return response


@router.post("/text", response_model=ScanResponse)
async def scan_text(
    req: TextScanRequest,
    bg_tasks: BackgroundTasks,
    db: AsyncSession = Depends(get_db),
    user: User = Depends(get_optional_user),
):
    start_time = time.time()
    results    = await route_text_input(req.text)
    response   = format_response(ScanType.TEXT, results, start_time)
    # Summary: truncated first 80 chars of text — no full content stored
    summary = req.text[:80].replace("\n", " ") + "…" if len(req.text) > 80 else req.text
    bg_tasks.add_task(
        log_website_scan, db, response.scan_id, user, ScanType.TEXT,
        summary, response.model_dump(),
    )
    return response


@router.post("/email", response_model=ScanResponse)
async def scan_email(
    sender:   str = Form(""),
    subject:  str = Form(""),
    body:     str = Form(""),
    bg_tasks: BackgroundTasks = BackgroundTasks(),
    db: AsyncSession = Depends(get_db),
    user: User = Depends(get_optional_user),
):
    start_time   = time.time()
    text_content = f"Subject: {subject}\n\n{body}"
    results      = await route_text_input(text_content)
    response     = format_response(ScanType.EMAIL, results, start_time)
    # Store subject only — not the body
    bg_tasks.add_task(
        log_website_scan, db, response.scan_id, user, ScanType.EMAIL,
        f"email:{subject[:120]}", response.model_dump(),
    )
    return response


@router.post("/image", response_model=ScanResponse)
async def scan_image(
    file:     UploadFile = File(...),
    bg_tasks: BackgroundTasks = BackgroundTasks(),
    db: AsyncSession = Depends(get_db),
    user: User = Depends(get_optional_user),
):
    start_time = time.time()
    data       = await file.read()
    results    = await route_image_input(data)
    response   = format_response(ScanType.IMAGE, results, start_time)
    # Store filename only — image bytes are not stored
    bg_tasks.add_task(
        log_website_scan, db, response.scan_id, user, ScanType.IMAGE,
        f"image:{file.filename}", response.model_dump(),
    )
    return response


@router.post("/document", response_model=ScanResponse)
async def scan_document(
    file:     UploadFile = File(...),
    bg_tasks: BackgroundTasks = BackgroundTasks(),
    db: AsyncSession = Depends(get_db),
    user: User = Depends(get_optional_user),
):
    """Handles PDF, DOCX, etc. via AttachmentOrchestrator."""
    start_time = time.time()
    import tempfile
    import os
    import hashlib

    suffix = os.path.splitext(file.filename)[1] if file.filename else ""
    fd, temp_path = tempfile.mkstemp(suffix=suffix)
    file_hash = ""
    try:
        raw = await file.read()
        file_hash = hashlib.sha256(raw).hexdigest()
        with os.fdopen(fd, "wb") as f:
            f.write(raw)
        raw_result = process_attachment(temp_path)
    finally:
        if os.path.exists(temp_path):
            os.remove(temp_path)

    flat_results = []
    if "text" in raw_result.get("sub_results", {}):
        flat_results.append(raw_result["sub_results"]["text"])
    for u in raw_result.get("sub_results", {}).get("urls", []):
        flat_results.append(u)

    extra = {
        "file_type":    raw_result.get("file_type"),
        "macros_found": raw_result.get("macros_found"),
        "heuristic_risk": raw_result.get("heuristic_risk"),
    }

    response = format_response(ScanType.DOCUMENT, flat_results, start_time, extra)
    # Store filename + hash only — file is deleted immediately above
    bg_tasks.add_task(
        log_website_scan, db, response.scan_id, user, ScanType.DOCUMENT,
        f"file:{file.filename}|sha256:{file_hash[:16]}…", response.model_dump(),
    )
    return response
