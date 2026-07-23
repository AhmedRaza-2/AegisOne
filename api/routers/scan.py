"""
AegisOne API — Scan Router
Unified scanning endpoints for URLs, Text, Emails, Images, and Documents.
Stores metadata in website_scans and handles high-performance async logging.
"""
import time
import json
import uuid
import logging
import asyncio
import hashlib
import tempfile
import os
from PIL import Image
import io

from fastapi import APIRouter, Depends, File, UploadFile, Form, BackgroundTasks, HTTPException, status
from sqlalchemy.ext.asyncio import AsyncSession

from api.database.db import get_db, get_background_db
from api.database.models import User, WebsiteScan
from api.database.schemas import (
    URLScanRequest, TextScanRequest, ScanResponse, ModelResult, URLResult, ScanType
)
from api.dependencies import get_optional_user
from api.config import MAX_FILE_SIZE_BYTES

from api.services.model_orchestrator import (
    predict_url, predict_text, predict_email, process_attachment
)
from api.services.content_router import route_image_input, route_text_input
from api.services.risk_aggregator import aggregate_model_results
from api.services.cache_service import (
    get_cached_url_result, set_cached_url_result,
    get_cached_text_result, set_cached_text_result,
    get_or_create_url_result, get_or_create_text_result,
)

logger = logging.getLogger("aegisone.scan")

router = APIRouter(prefix="/scan", tags=["Scanning"])

# In-flight request trackers to prevent Cache Stampedes
_in_flight_url = {}
_in_flight_text = {}
_db_queue = asyncio.Queue()


async def db_log_worker():
    """Background worker that pulls logs from the queue and bulk-inserts them into SQLite."""
    while True:
        try:
            log = await _db_queue.get()
            batch = [log]
            
            while len(batch) < 100 and not _db_queue.empty():
                try:
                    batch.append(_db_queue.get_nowait())
                except asyncio.QueueEmpty:
                    break
                    
            db = await get_background_db()
            try:
                db.add_all(batch)
                await db.commit()
            except Exception as e:
                logger.error(f"Bulk insert failed: {e}")
                await db.rollback()
            finally:
                await db.close()
                
            for _ in range(len(batch)):
                _db_queue.task_done()
        except Exception as e:
            logger.error(f"DB log worker error: {e}")
            await asyncio.sleep(1)


async def log_website_scan(
    scan_id: str,
    user: User | None,
    scan_type: ScanType,
    url_or_summary: str,
    results: dict,
):
    """Persist scan metadata to website_scans in a background task."""
    from api.database.db import async_session
    async with async_session() as db:
        try:
            verdict_str = results.get("verdict", "")
            verdict_val = verdict_str.value if hasattr(verdict_str, "value") else str(verdict_str)
            score = results.get("overall_risk_score", 0)

            if score >= 76:
                decision = "block"
            elif score >= 51:
                decision = "warn"
            else:
                decision = "allow"

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
                url=url_or_summary[:2048],
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
            logger.error(f"[AegisOne:ScanLog] Error: {e}")


def format_response(
    scan_type: ScanType,
    model_results: list[dict],
    start_time: float,
    extra_fields: dict = None,
) -> ScanResponse:
    """Standardize the response format across all scan endpoints."""
    url_res = []
    other_res = []

    for r in model_results:
        if "error" in r:
            logger.warning(f"Skipping error result from model '{r.get('model', 'unknown')}': {r['error']}")
            continue
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


def build_scan_log_payload(response: ScanResponse, model_results: list[dict]) -> dict:
    """Keep background logging payloads small so the hot path stays lean."""
    return {
        "verdict": response.verdict,
        "overall_risk_score": response.overall_risk_score,
        "verdict_label": response.verdict_label,
        "models_used": model_results[:5],
        "processing_time_ms": response.processing_time_ms,
    }


def _check_file_size(content_length: int | None, data: bytes | None = None):
    """Guard against oversized uploads."""
    size = content_length or (len(data) if data else 0)
    if size > MAX_FILE_SIZE_BYTES:
        raise HTTPException(
            status_code=status.HTTP_413_REQUEST_ENTITY_TOO_LARGE,
            detail=f"File too large. Maximum size: {MAX_FILE_SIZE_BYTES // (1024 * 1024)} MB"
        )


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
    elif req.url in _in_flight_url:
        result = await _in_flight_url[req.url]
    else:
        async def _load_url():
            loaded = await predict_url(req.url)
            loaded["url"] = req.url
            return loaded

        result = await get_or_create_url_result(req.url, _load_url)

    response = format_response(ScanType.URL, [result], start_time)
    bg_tasks.add_task(
        log_website_scan, response.scan_id, user, ScanType.URL,
        req.url, build_scan_log_payload(response, [result]),
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
    cached = get_cached_text_result(req.text)
    if cached:
        results = cached
    else:
        async def _load_text():
            return await route_text_input(req.text)

        results = await get_or_create_text_result(req.text, _load_text)
    response = format_response(ScanType.TEXT, results, start_time)
    summary = req.text[:80].replace("\n", " ") + "…" if len(req.text) > 80 else req.text
    bg_tasks.add_task(
        log_website_scan, response.scan_id, user, ScanType.TEXT,
        summary, build_scan_log_payload(response, results),
    )
    return response


@router.post("/email", response_model=ScanResponse)
async def scan_email(
    bg_tasks: BackgroundTasks,
    sender:   str = Form(""),
    subject:  str = Form(""),
    body:     str = Form(""),
    db: AsyncSession = Depends(get_db),
    user: User = Depends(get_optional_user),
):
    start_time   = time.time()
    text_content = f"Subject: {subject}\n\n{body}"
    results      = await route_text_input(text_content)
    response     = format_response(ScanType.EMAIL, results, start_time)
    bg_tasks.add_task(
        log_website_scan, response.scan_id, user, ScanType.EMAIL,
        f"email:{subject[:120]}", build_scan_log_payload(response, results),
    )
    return response


@router.post("/image", response_model=ScanResponse)
async def scan_image(
    bg_tasks: BackgroundTasks,
    file:     UploadFile = File(...),
    db: AsyncSession = Depends(get_db),
    user: User = Depends(get_optional_user),
):
    start_time = time.time()
    data       = await file.read()
    _check_file_size(None, data)
    results    = await route_image_input(data)
    response   = format_response(ScanType.IMAGE, results, start_time)
    bg_tasks.add_task(
        log_website_scan, response.scan_id, user, ScanType.IMAGE,
        f"image:{file.filename}", build_scan_log_payload(response, results),
    )
    return response


@router.post("/document", response_model=ScanResponse)
async def scan_document(
    bg_tasks: BackgroundTasks,
    file:     UploadFile = File(...),
    db: AsyncSession = Depends(get_db),
    user: User = Depends(get_optional_user),
):
    start_time = time.time()
    file_data  = await file.read()
    _check_file_size(None, file_data)

    suffix = os.path.splitext(file.filename)[1] if file.filename else ""
    fd, temp_path = tempfile.mkstemp(suffix=suffix)
    file_hash = hashlib.sha256(file_data).hexdigest()
    try:
        with os.fdopen(fd, "wb") as f:
            f.write(file_data)
        raw_result = await process_attachment(temp_path)
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
    bg_tasks.add_task(
        log_website_scan, response.scan_id, user, ScanType.DOCUMENT,
        f"file:{file.filename}|sha256:{file_hash[:16]}…", build_scan_log_payload(response, flat_results),
    )
    return response
