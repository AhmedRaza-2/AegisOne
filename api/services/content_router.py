"""
AegisOne API — Content Router
Automatically detects the type of input and routes it through the appropriate models.
Uses asyncio.gather() for parallel URL scanning.
"""
import re
import io
import asyncio
import logging
from PIL import Image
from api.database.schemas import ScanType
from api.services.model_orchestrator import (
    predict_text, predict_url, predict_email, predict_image_pil,
    predict_image, extract_urls_from_text
)
from api.services.risk_aggregator import aggregate_model_results
from api.services.ocr_service import extract_text_from_image
from api.services.qr_service import decode_qr_codes

logger = logging.getLogger("aegisone.router")


def detect_text_type(text: str) -> ScanType:
    """Heuristic to detect if text is a URL, Email, or General Text."""
    text = text.strip()

    # 1. URL check (basic)
    url_pattern = re.compile(r'^(https?://)?([-\w]+\.)+[a-zA-Z]{2,}(/.*)?$')
    if url_pattern.match(text) and " " not in text:
        return ScanType.URL

    # 2. Email check (presence of email headers)
    lower_text = text.lower()
    if ("subject:" in lower_text or "from:" in lower_text) and ("@" in text):
        return ScanType.EMAIL

    # Default to general text
    return ScanType.TEXT


async def _scan_urls_parallel(urls: list[str]) -> list[dict]:
    """Scan multiple URLs in parallel using asyncio.gather()."""
    if not urls:
        return []
    tasks = [predict_url(u) for u in urls]
    return list(await asyncio.gather(*tasks))


async def route_text_input(text: str) -> list[dict]:
    """Routes a raw text string to the appropriate models."""
    input_type = detect_text_type(text)
    results = []

    if input_type == ScanType.URL:
        results.append(await predict_url(text))
    elif input_type == ScanType.EMAIL:
        subject_match = re.search(r'(?i)subject:\s*(.*?)(?=\n|$)', text)
        subject = subject_match.group(1) if subject_match else ""
        results.append(await predict_email(sender="", subject=subject, body=text))

        # Extract and scan URLs in parallel
        urls = extract_urls_from_text(text)
        url_results = await _scan_urls_parallel(urls)
        results.extend(url_results)
    else:
        # General Text
        results.append(await predict_text(text))

        # Extract and scan URLs in parallel
        urls = extract_urls_from_text(text)
        url_results = await _scan_urls_parallel(urls)
        results.extend(url_results)

    return results


async def route_qr_payload(payload: str):
    """Score one decoded QR payload. Returns (model results, detail) where detail = {payload, kind, leads_to, reasons}."""
    from api.services.qr_payload import classify_qr_payload
    info = classify_qr_payload(payload)
    kind = info["kind"]
    results: list[dict] = []
    leads_to = info.get("url") or info["payload"]
    reasons: list[str] = [info["reason"]] if info.get("reason") else []

    if kind == "url":
        results.append(await predict_url(info["url"]))
        if info.get("shortener"):
            from api.services.redirect_tracer import trace_redirects
            trace = await trace_redirects(info["url"])
            final = trace.get("final_url")
            if final and final != info["url"]:
                fr = await predict_url(final)
                fr["qr_final_url"] = final
                results.append(fr)
                leads_to = final
                reasons.append("it redirects to " + final[:120])
    elif kind in ("text", "contact"):
        results.extend(await route_text_input(info.get("text") or info["payload"]))
    # script / payment / wifi / app: no model can judge these - the kind itself is the evidence

    if info["floor"] > 0:
        results.append({
            "model": "qr_payload", "prediction": "phishing" if info["floor"] >= 0.51 else "legitimate",
            "phishing_probability": info["floor"], "confidence": info["floor"],
            "explanation": "This QR code " + info["reason"] + ".",
        })
    for r in results:
        r["qr_kind"] = kind
    return results, {"payload": info["payload"], "kind": kind, "leads_to": leads_to[:300], "reasons": reasons}


async def route_image_input(image_bytes: bytes) -> list[dict]:
    """Backwards-compatible wrapper: just the per-model results."""
    return (await route_image_input_detailed(image_bytes))["results"]


async def route_image_input_detailed(image_bytes: bytes) -> dict:
    """
    1. Runs Image Model and OCR in parallel
    2. Routes OCR text to Text/Email/URL models

    Returns {"results": [model result dicts], "ocr_text": str} — the OCR text is kept so
    callers can record *what* the image said, which is what an explanation needs.
    """
    results = []

    async def _run_image_model():
        return await predict_image(image_bytes)

    async def _run_ocr():
        try:
            img = Image.open(io.BytesIO(image_bytes)).convert("RGB")
            return await extract_text_from_image(img)
        except Exception as e:
            logger.error(f"OCR error: {e}")
            return ""

    async def _run_qr():
        return await asyncio.to_thread(decode_qr_codes, image_bytes)

    img_result, ocr_text, qr_payloads = await asyncio.gather(_run_image_model(), _run_ocr(), _run_qr())
    results.append(img_result)

    # QR codes: the payload is classified (link / script / payment / Wi-Fi / contact ...) and a link goes to the URL
    # model exactly like a link typed by the user - before anyone opens it. Shortened links are followed (SSRF-guarded)
    # and the final destination is scored too. Results are tagged so explanations can say it came from a QR code.
    qr_details = []
    for payload in qr_payloads:
        try:
            qr_results, detail = await route_qr_payload(payload)
        except Exception as e:
            logger.error(f"QR payload scan error: {e}")
            continue
        qr_details.append(detail)
        for r in qr_results:
            r["from_qr"] = True
            r["qr_payload"] = payload[:300]
            r["explanation"] = "[From QR code] " + (r.get("explanation") or "")
            results.append(r)

    # Route extracted OCR text
    if ocr_text and ocr_text.strip():
        text_results = await route_text_input(ocr_text)
        for r in text_results:
            r["explanation"] = "[From OCR] " + r.get("explanation", "")
            results.append(r)

    return {"results": results, "ocr_text": (ocr_text or "").strip(), "qr_payloads": qr_payloads, "qr_details": qr_details}
