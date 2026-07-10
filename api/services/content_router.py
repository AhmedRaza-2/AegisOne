"""
AegisOne API — Content Router
Automatically detects the type of input and routes it through the appropriate models.

Performance: all synchronous inference functions are offloaded to threads via
asyncio.to_thread(), allowing the event loop to handle concurrent requests.
"""
import re
import io
import asyncio
from PIL import Image
from api.database.schemas import ScanType
from api.services.model_orchestrator import (
    predict_text, predict_url, predict_email, predict_image_pil, 
    extract_urls_from_text, predict_image
)
from api.services.risk_aggregator import aggregate_model_results
from api.services.ocr_service import extract_text_from_image


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


async def route_text_input(text: str) -> list[dict]:
    """Routes a raw text string to the appropriate models.
    
    All synchronous model calls are offloaded to threads so the event loop
    stays free to accept more requests during inference.
    """
    input_type = detect_text_type(text)
    results = []
    
    if input_type == ScanType.URL:
        # Offload synchronous PyTorch inference to thread pool
        result = await asyncio.to_thread(predict_url, text)
        results.append(result)
    elif input_type == ScanType.EMAIL:
        # Best effort parse
        subject_match = re.search(r'(?i)subject:\s*(.*?)(?=\n|$)', text)
        subject = subject_match.group(1) if subject_match else ""
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
            
    return results


async def route_image_input(image_bytes: bytes) -> list[dict]:
    """
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
        
    return results
