"""
AegisOne API — Scan Router
Unified scanning endpoints for URLs, Text, Emails, Images, and Documents.
"""
import time
import json
import uuid
from fastapi import APIRouter, Depends, File, UploadFile, Form, BackgroundTasks
from sqlalchemy.ext.asyncio import AsyncSession
from PIL import Image
import io

from api.database.db import get_db
from api.database.models import User, ScanLog
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


async def log_scan(
    db: AsyncSession,
    scan_id: str,
    user_email: str | None,
    scan_type: ScanType,
    summary: str,
    results: dict
):
    """Background task to log scan history."""
    try:
        log = ScanLog(
            scan_id=scan_id,
            user_email=user_email or "anonymous",
            scan_type=scan_type.value,
            input_summary=summary[:500],
            overall_risk_score=results["overall_risk_score"],
            verdict=results["verdict"].value,
            models_used=json.dumps([m for m in results["models_used"]]),
            processing_time_ms=results["processing_time_ms"],
            is_threat=results["overall_risk_score"] > 50
        )
        db.add(log)
        await db.commit()
    except Exception as e:
        print(f"Error logging scan: {e}")


def format_response(
    scan_type: ScanType, 
    model_results: list[dict], 
    start_time: float,
    extra_fields: dict = None
) -> ScanResponse:
    """Standardize the response format."""
    
    # Separate URL results from text/email/image results
    url_res = []
    other_res = []
    
    for r in model_results:
        if r.get("model") == "url":
            url_res.append(URLResult(
                url=r.get("url", "unknown"),
                prediction=r["prediction"],
                confidence=r["confidence"],
                phishing_probability=r["phishing_probability"],
                category=r.get("category", "unknown")
            ))
        else:
            other_res.append(ModelResult(**r))
            
    overall_score, verdict, label = aggregate_model_results(model_results)
    
    resp = {
        "scan_id": f"aegis-{int(time.time())}-{str(uuid.uuid4())[:8]}",
        "timestamp": time.strftime("%Y-%m-%dT%H:%M:%SZ", time.gmtime()),
        "overall_risk_score": overall_score,
        "verdict": verdict,
        "verdict_label": label,
        "models_used": other_res,
        "url_results": url_res,
        "input_type_detected": scan_type.value,
        "processing_time_ms": round((time.time() - start_time) * 1000, 1),
    }
    
    if extra_fields:
        resp.update(extra_fields)
        
    return ScanResponse(**resp)


@router.post("/url", response_model=ScanResponse)
async def scan_url(
    req: URLScanRequest, 
    bg_tasks: BackgroundTasks,
    db: AsyncSession = Depends(get_db),
    user: User = Depends(get_optional_user)
):
    start_time = time.time()
    
    # Cache check
    cached = get_cached_url_result(req.url)
    if cached:
        result = cached
    else:
        result = predict_url(req.url)
        result["url"] = req.url
        set_cached_url_result(req.url, result)
        
    response = format_response(ScanType.URL, [result], start_time)
    
    bg_tasks.add_task(log_scan, db, response.scan_id, user.email if user else None, ScanType.URL, req.url, response.model_dump())
    return response


@router.post("/text", response_model=ScanResponse)
async def scan_text(
    req: TextScanRequest, 
    bg_tasks: BackgroundTasks,
    db: AsyncSession = Depends(get_db),
    user: User = Depends(get_optional_user)
):
    start_time = time.time()
    results = await route_text_input(req.text)
    response = format_response(ScanType.TEXT, results, start_time)
    
    bg_tasks.add_task(log_scan, db, response.scan_id, user.email if user else None, ScanType.TEXT, req.text, response.model_dump())
    return response


@router.post("/email", response_model=ScanResponse)
async def scan_email(
    sender: str = Form(""),
    subject: str = Form(""),
    body: str = Form(""),
    bg_tasks: BackgroundTasks = BackgroundTasks(),
    db: AsyncSession = Depends(get_db),
    user: User = Depends(get_optional_user)
):
    start_time = time.time()
    
    text_content = f"Subject: {subject}\n\n{body}"
    results = await route_text_input(text_content)
    
    response = format_response(ScanType.EMAIL, results, start_time)
    bg_tasks.add_task(log_scan, db, response.scan_id, user.email if user else None, ScanType.EMAIL, subject, response.model_dump())
    return response


@router.post("/image", response_model=ScanResponse)
async def scan_image(
    file: UploadFile = File(...),
    bg_tasks: BackgroundTasks = BackgroundTasks(),
    db: AsyncSession = Depends(get_db),
    user: User = Depends(get_optional_user)
):
    start_time = time.time()
    data = await file.read()
    
    results = await route_image_input(data)
    
    response = format_response(ScanType.IMAGE, results, start_time)
    bg_tasks.add_task(log_scan, db, response.scan_id, user.email if user else None, ScanType.IMAGE, file.filename, response.model_dump())
    return response


@router.post("/document", response_model=ScanResponse)
async def scan_document(
    file: UploadFile = File(...),
    bg_tasks: BackgroundTasks = BackgroundTasks(),
    db: AsyncSession = Depends(get_db),
    user: User = Depends(get_optional_user)
):
    """Handles PDF, DOCX, etc using AttachmentOrchestrator."""
    start_time = time.time()
    
    import tempfile
    import os
    
    suffix = os.path.splitext(file.filename)[1] if file.filename else ""
    fd, temp_path = tempfile.mkstemp(suffix=suffix)
    try:
        with os.fdopen(fd, "wb") as f:
            f.write(await file.read())
        
        # This returns the structured results from process_attachment
        raw_result = process_attachment(temp_path)
    finally:
        if os.path.exists(temp_path):
            os.remove(temp_path)
            
    # Re-map raw_result into list of model results for format_response
    flat_results = []
    if "text" in raw_result.get("sub_results", {}):
        flat_results.append(raw_result["sub_results"]["text"])
    for u in raw_result.get("sub_results", {}).get("urls", []):
        flat_results.append(u)
        
    extra = {
        "file_type": raw_result.get("file_type"),
        "macros_found": raw_result.get("macros_found"),
        "heuristic_risk": raw_result.get("heuristic_risk"),
    }
        
    response = format_response(ScanType.DOCUMENT, flat_results, start_time, extra)
    
    bg_tasks.add_task(log_scan, db, response.scan_id, user.email if user else None, ScanType.DOCUMENT, file.filename, response.model_dump())
    return response
