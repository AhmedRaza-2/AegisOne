"""
AegisOne API — Compatibility & XAI Router
Exposes legacy /analyze/* and new /xai/* endpoints for full extension integration.
Also implements dashboard sync and policy fetching endpoints.
"""
import time
import tempfile
import os
import httpx
from fastapi import APIRouter, Form, UploadFile, File, HTTPException, Depends
from typing import Dict, Any, List
from pydantic import BaseModel

from api.services.model_orchestrator import (
    predict_url, predict_text, predict_email, predict_image, process_attachment
)
from api.services.content_router import route_image_input
from api.services.xai_service import generate_explanation

router = APIRouter(tags=["Compatibility & XAI"])


# --- Schemas for Dashboard Sync ---
class SecurityEvent(BaseModel):
    id: str
    type: str
    domain: str | None = ""
    url: str | None = ""
    risk_score: int | None = 0
    verdict: str | None = "unknown"
    threat_type: str | None = None
    timestamp: str | None = None
    org_id: str | None = None
    device_id: str | None = None
    details: Dict[str, Any] | None = None

class IngestRequest(BaseModel):
    events: List[SecurityEvent]


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

@router.get("/policy/current")
async def get_current_policy(device_id: str | None = None):
    """
    Returns the organization security policy for the requesting device.
    """
    return {
        "org_id": "org_default",
        "org_name": "AegisOne Enterprise",
        "allowlist": ["localhost", "127.0.0.1", "aegisone.ai"],
        "blocklist": ["phishsite.com", "malwaredownload.net"],
        "risk_thresholds": {
            "safe": 0.20,
            "warning": 0.50,
            "danger": 0.80
        }
    }


@router.post("/events/ingest")
async def ingest_security_events(payload: IngestRequest):
    """
    Ingests batch security events from the browser extension.
    Logs them to the server console.
    """
    print(f"\n[AegisOne Ingest] Received {len(payload.events)} security events:")
    for event in payload.events:
        print(f"  - Event: {event.type} | Domain: {event.domain} | Risk: {event.risk_score}% | Verdict: {event.verdict}")
    return {"status": "success", "count": len(payload.events)}
