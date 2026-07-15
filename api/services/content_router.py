"""
AegisOne API — Content Router
Automatically detects the type of input and routes it through the appropriate models.
<<<<<<< HEAD

Performance: all synchronous inference functions are offloaded to threads via
asyncio.to_thread(), allowing the event loop to handle concurrent requests.
=======
Uses asyncio.gather() for parallel URL scanning.
>>>>>>> ff262510555dc5ea98c2935a24986f2270118617
"""
import re
import io
import asyncio
<<<<<<< HEAD
=======
import logging
>>>>>>> ff262510555dc5ea98c2935a24986f2270118617
from PIL import Image
from api.database.schemas import ScanType
from api.services.model_orchestrator import (
    predict_text, predict_url, predict_email, predict_image_pil,
    predict_image, extract_urls_from_text
)
from api.services.risk_aggregator import aggregate_model_results
from api.services.ocr_service import extract_text_from_image

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
    """Routes a raw text string to the appropriate models.
    
    All synchronous model calls are offloaded to threads so the event loop
    stays free to accept more requests during inference.
    """
    input_type = detect_text_type(text)
    results = []

    if input_type == ScanType.URL:
<<<<<<< HEAD
        # Offload synchronous PyTorch inference to thread pool
        result = await asyncio.to_thread(predict_url, text)
        results.append(result)
=======
        results.append(await predict_url(text))
>>>>>>> ff262510555dc5ea98c2935a24986f2270118617
    elif input_type == ScanType.EMAIL:
        # Best effort parse
        subject_match = re.search(r'(?i)subject:\s*(.*?)(?=\n|$)', text)
        subject = subject_match.group(1) if subject_match else ""
<<<<<<< HEAD
        # Offload synchronous PyTorch inference to thread pool
        result = await asyncio.to_thread(predict_email, "", subject, text)
        results.append(result)
        
        # Extract and scan URLs concurrently
        urls = extract_urls_from_text(text)
        if urls:
            url_tasks = [asyncio.to_thread(predict_url, u) for u in urls]
            url_results = await asyncio.gather(*url_tasks)
            results.extend(url_results)
    else:
        # General Text — offload to thread pool
        result = await asyncio.to_thread(predict_text, text)
        results.append(result)
        
        # Extract and scan URLs concurrently
        urls = extract_urls_from_text(text)
        if urls:
            url_tasks = [asyncio.to_thread(predict_url, u) for u in urls]
            url_results = await asyncio.gather(*url_tasks)
            results.extend(url_results)
            
=======
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

>>>>>>> ff262510555dc5ea98c2935a24986f2270118617
    return results


async def route_image_input(image_bytes: bytes) -> list[dict]:
    """
<<<<<<< HEAD
    1. Runs Image Model (in thread)
    2. Runs OCR (already async)
    3. Routes OCR text to Text/Email/URL models (in threads)
    """
    results = []
    
    # 1. Image Model — offload to thread pool
    img_result = await asyncio.to_thread(predict_image, image_bytes)
    results.append(img_result)
    
    # 2. OCR
    try:
        img = Image.open(io.BytesIO(image_bytes)).convert("RGB")
        ocr_text = await extract_text_from_image(img)
        
        if ocr_text.strip():
            # 3. Route extracted text (already uses asyncio.to_thread internally)
            text_results = await route_text_input(ocr_text)
            for r in text_results:
                r["explanation"] = "[From OCR] " + r.get("explanation", "")
                results.append(r)
    except Exception as e:
        print(f"Error processing image for OCR: {e}")
        
=======
    1. Runs Image Model and OCR in parallel
    2. Routes OCR text to Text/Email/URL models
    """
    results = []

    # Run image model and OCR concurrently
    async def _run_image_model():
        return await predict_image(image_bytes)

    async def _run_ocr():
        try:
            img = Image.open(io.BytesIO(image_bytes)).convert("RGB")
            return await extract_text_from_image(img)
        except Exception as e:
            logger.error(f"OCR error: {e}")
            return ""

    img_result, ocr_text = await asyncio.gather(_run_image_model(), _run_ocr())
    results.append(img_result)

    # Route extracted OCR text
    if ocr_text and ocr_text.strip():
        text_results = await route_text_input(ocr_text)
        for r in text_results:
            r["explanation"] = "[From OCR] " + r.get("explanation", "")
            results.append(r)

>>>>>>> ff262510555dc5ea98c2935a24986f2270118617
    return results
