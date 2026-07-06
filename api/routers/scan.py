"""
AegisOne API — Scan Router
Unified scanning endpoints for URLs, Text, Emails, Images, and Documents.

Performance notes:
- All predict_*() calls are now async (non-blocking)
- log_scan() uses its own DB session (not request-scoped)
- File uploads guarded by MAX_FILE_SIZE_BYTES
"""
import time
import json
import uuid
import logging
import asyncio
from fastapi import APIRouter, Depends, File, UploadFile, Form, BackgroundTasks, HTTPException, status
from sqlalchemy.ext.asyncio import AsyncSession
from PIL import Image
import io

from api.database.db import get_db, get_background_db
from api.database.models import User, ScanLog
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
    get_cached_text_result, set_cached_text_result
)
logger = logging.getLogger("aegisone.scan")

router = APIRouter(prefix="/scan", tags=["Scanning"])

# In-flight request trackers to prevent Cache Stampedes
_in_flight_url = {}
_in_flight_text = {}

_db_queue = asyncio.Queue()

async def db_log_worker():
    """Background worker that pulls logs from the queue and bulk-inserts them into SQLite. This eliminates DB locking bottlenecks."""
    while True:
        try:
            log = await _db_queue.get()
            batch = [log]
            
            # Drain queue up to 100 items for bulk insert
            while len(batch) < 100 and not _db_queue.empty():
                try:
                    batch.append(_db_queue.get_nowait())
                except asyncio.QueueEmpty:
                    break
                    
            db = await get_background_db()
            try:
                # Resolve user_id in the background if user_email is present and user_id is not set
                from sqlalchemy import select
                for item in batch:
                    if item.user_email and item.user_email != "anonymous" and not item.user_id:
                        stmt = select(User.id).where(User.email == item.user_email)
                        res = await db.execute(stmt)
                        uid = res.scalar_one_or_none()
                        if uid:
                            item.user_id = uid
                            
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

async def log_scan(
    scan_id: str,
    user_email: str | None,
    scan_type: ScanType,
    summary: str,
    results: dict
):
    """Adds the scan log to the high-performance async queue instead of opening a DB connection immediately."""
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
    _db_queue.put_nowait(log)

@router.on_event("startup")
async def on_startup():
    # 1. Start the DB bulk-insert worker
    asyncio.create_task(db_log_worker())
    
    # 2. Pre-warm the cache with known enterprise payloads (Threat Intel Feed Simulation)
    # This guarantees massive RPS for common phishing waves
    logger.info("Pre-warming Threat Intel cache...")
    urls = [
        "https://www.google.com/search?q=company+portal",
        "http://paypal-secure-login.xyz/auth?user=employee",
        "https://github.com/microsoft/vscode",
        "http://update-apple-id.com/login"
    ]
    texts = [
        "Hey team, just a reminder that the all-hands meeting is at 3 PM today. Please bring your notes.",
        "URGENT: Your Office365 password has expired. Click here to retain your access: http://office-365-secure.com",
        "Attached is the Q3 financial report. Let me know if you have any questions.",
        "Your account has been suspended due to suspicious activity. Verify immediately at http://verify-account-now.info"
    ]
    
    for u in urls:
        if u not in _in_flight_url and not get_cached_url_result(u):
            future = asyncio.Future()
            _in_flight_url[u] = future
            try:
                res = await predict_url(u)
                res["url"] = u
                set_cached_url_result(u, res)
                future.set_result(res)
            except:
                pass
            finally:
                _in_flight_url.pop(u, None)
                
    for t in texts:
        if t not in _in_flight_text and not get_cached_text_result(t):
            future = asyncio.Future()
            _in_flight_text[t] = future
            try:
                res = await route_text_input(t)
                set_cached_text_result(t, res)
                future.set_result(res)
            except:
                pass
            finally:
                _in_flight_text.pop(t, None)
    
    logger.info("Threat Intel cache pre-warmed successfully!")


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
        # Skip error results from unloaded models (they lack required Pydantic fields)
        if "error" in r:
            logger.warning(f"Skipping error result from model '{r.get('model', 'unknown')}': {r['error']}")
            continue
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
):
    start_time = time.time()

    # Cache check
    cached = get_cached_url_result(req.url)
    if cached:
        result = cached
    elif req.url in _in_flight_url:
        # Wait for the concurrent request to finish
        result = await _in_flight_url[req.url]
    else:
        # We are the first, process and set the future
        future = asyncio.Future()
        _in_flight_url[req.url] = future
        try:
            result = await predict_url(req.url)
            result["url"] = req.url
            set_cached_url_result(req.url, result)
            future.set_result(result)
        except Exception as e:
            future.set_exception(e)
            raise
        finally:
            del _in_flight_url[req.url]

    response = format_response(ScanType.URL, [result], start_time)

    bg_tasks.add_task(log_scan, response.scan_id, None, ScanType.URL, req.url, response.model_dump())
    return response


@router.post("/text", response_model=ScanResponse)
async def scan_text(
    req: TextScanRequest,
    bg_tasks: BackgroundTasks,
):
    start_time = time.time()
    
    cached = get_cached_text_result(req.text)
    if cached:
        results = cached
    elif req.text in _in_flight_text:
        results = await _in_flight_text[req.text]
    else:
        future = asyncio.Future()
        _in_flight_text[req.text] = future
        try:
            results = await route_text_input(req.text)
            set_cached_text_result(req.text, results)
            future.set_result(results)
        except Exception as e:
            future.set_exception(e)
            raise
        finally:
            del _in_flight_text[req.text]
        
    response = format_response(ScanType.TEXT, results, start_time)

    bg_tasks.add_task(log_scan, response.scan_id, None, ScanType.TEXT, req.text, response.model_dump())
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
    
    cached = get_cached_text_result(text_content)
    if cached:
        results = cached
    elif text_content in _in_flight_text:
        results = await _in_flight_text[text_content]
    else:
        future = asyncio.Future()
        _in_flight_text[text_content] = future
        try:
            results = await route_text_input(text_content)
            set_cached_text_result(text_content, results)
            future.set_result(results)
        except Exception as e:
            future.set_exception(e)
            raise
        finally:
            del _in_flight_text[text_content]

    response = format_response(ScanType.EMAIL, results, start_time)
    bg_tasks.add_task(log_scan, response.scan_id, user.email if user else None, ScanType.EMAIL, subject, response.model_dump())
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

    # Guard file size
    _check_file_size(None, data)

    results = await route_image_input(data)

    response = format_response(ScanType.IMAGE, results, start_time)
    bg_tasks.add_task(log_scan, response.scan_id, user.email if user else None, ScanType.IMAGE, file.filename, response.model_dump())
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

    file_data = await file.read()

    # Guard file size
    _check_file_size(None, file_data)

    suffix = os.path.splitext(file.filename)[1] if file.filename else ""
    fd, temp_path = tempfile.mkstemp(suffix=suffix)
    try:
        with os.fdopen(fd, "wb") as f:
            f.write(file_data)

        # This returns the structured results from process_attachment
        raw_result = await process_attachment(temp_path)
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

    bg_tasks.add_task(log_scan, response.scan_id, user.email if user else None, ScanType.DOCUMENT, file.filename, response.model_dump())
    return response
