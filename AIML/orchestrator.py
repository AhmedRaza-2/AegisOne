"""
AegisOne — Master Orchestrator
Routes any input (email, text, URL, image, attachment) to the correct specialist API.
Serves the Test UI dashboard.

Specialist Endpoints:
  - Email:      http://localhost:8001/predict/email
  - Text:       http://localhost:8002/predict/text
  - URL:        http://localhost:8003/predict/url
  - Image:      http://localhost:8000/predict/image
  - Attachment:  Handled internally (extracts → delegates)

Usage: uvicorn orchestrator:app --host 0.0.0.0 --port 9000
"""
import os, io, time, tempfile, shutil
import httpx
from fastapi import FastAPI, File, UploadFile, HTTPException, Form
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import HTMLResponse, FileResponse
from fastapi.staticfiles import StaticFiles
from pydantic import BaseModel
from typing import Optional

import sys
sys.path.insert(0, os.path.join(os.path.dirname(__file__), "attachements"))
from attachements.attachment_orchestrator import AttachmentOrchestrator

app = FastAPI(title="AegisOne Master Orchestrator", version="3.0")
app.add_middleware(CORSMiddleware, allow_origins=["*"], allow_methods=["*"], allow_headers=["*"])

# ===== Config =====
SERVICES = {
    "email": "http://localhost:8001",
    "text":  "http://localhost:8002",
    "url":   "http://localhost:8003",
    "image": "http://localhost:8000",
}

orchestrator = AttachmentOrchestrator()

# ===== Serve Test UI =====
@app.get("/", response_class=HTMLResponse)
async def serve_ui():
    ui_path = os.path.join(os.path.dirname(__file__), "test_ui.html")
    with open(ui_path, "r", encoding="utf-8") as f:
        return HTMLResponse(content=f.read())

# ===== Health Check =====
@app.get("/health")
async def health():
    statuses = {}
    async with httpx.AsyncClient(timeout=3.0) as client:
        for name, url in SERVICES.items():
            try:
                r = await client.get(f"{url}/health")
                statuses[name] = r.json()
            except:
                statuses[name] = {"status": "offline"}
    return {"orchestrator": "online", "services": statuses}

# ===== Route: Email =====
@app.post("/analyze/email")
async def analyze_email(sender: str = Form(""), subject: str = Form(""), body: str = Form("")):
    start = time.time()
    async with httpx.AsyncClient(timeout=60.0) as client:
        try:
            r = await client.post(f"{SERVICES['email']}/predict/email", json={
                "sender": sender, "subject": subject, "body": body
            })
            result = r.json()
        except httpx.ConnectError:
            raise HTTPException(503, "Email service offline. Start it with: uvicorn email_inference:app --port 8001")
    result["latency_ms"] = round((time.time() - start) * 1000, 1)
    return result

# ===== Route: Text =====
@app.post("/analyze/text")
async def analyze_text(text: str = Form(...)):
    start = time.time()
    async with httpx.AsyncClient(timeout=60.0) as client:
        try:
            r = await client.post(f"{SERVICES['text']}/predict/text", json={"text": text})
            result = r.json()
        except httpx.ConnectError:
            raise HTTPException(503, "Text service offline. Start it with: uvicorn text_inference:app --port 8002")
    result["latency_ms"] = round((time.time() - start) * 1000, 1)
    return result

# ===== Route: URL =====
@app.post("/analyze/url")
async def analyze_url(url: str = Form(...)):
    start = time.time()
    async with httpx.AsyncClient(timeout=60.0) as client:
        try:
            r = await client.post(f"{SERVICES['url']}/predict/url", json={"url": url})
            result = r.json()
        except httpx.ConnectError:
            raise HTTPException(503, "URL service offline. Start it with: uvicorn url_inference:app --port 8003")
    result["latency_ms"] = round((time.time() - start) * 1000, 1)
    return result

# ===== Route: Image =====
@app.post("/analyze/image")
async def analyze_image(file: UploadFile = File(...)):
    start = time.time()
    file_bytes = await file.read()
    async with httpx.AsyncClient(timeout=60.0) as client:
        try:
            r = await client.post(
                f"{SERVICES['image']}/predict/image",
                files={"file": (file.filename, file_bytes, file.content_type)}
            )
            result = r.json()
        except httpx.ConnectError:
            raise HTTPException(503, "Image service offline. Start it with: uvicorn inference:app --port 8000")
    result["latency_ms"] = round((time.time() - start) * 1000, 1)
    return result

# ===== Route: Attachment (Multi-Modal) =====
@app.post("/analyze/attachment")
async def analyze_attachment(file: UploadFile = File(...)):
    start = time.time()
    
    # Save to temp file
    suffix = os.path.splitext(file.filename)[1] if file.filename else ""
    fd, temp_path = tempfile.mkstemp(suffix=suffix)
    try:
        with os.fdopen(fd, "wb") as f:
            content = await file.read()
            f.write(content)
        
        # Extract content
        extraction = orchestrator.process_file(temp_path)
    finally:
        if os.path.exists(temp_path):
            os.remove(temp_path)
    
    # Delegate extracted content to specialist APIs
    results = {
        "file_type": extraction.get("file_type", "unknown"),
        "macros_found": extraction.get("macros_found", False),
        "heuristic_risk": extraction.get("heuristic_risk", 0.0),
        "vba_analysis": extraction.get("vba_analysis"),
        "extracted_urls_count": len(extraction.get("urls", [])),
        "sub_results": {}
    }
    
    async with httpx.AsyncClient(timeout=60.0) as client:
        # Delegate text
        extracted_text = extraction.get("text", "")
        if extracted_text.strip() and extracted_text != "[ZIP CONTENT]":
            try:
                r = await client.post(f"{SERVICES['text']}/predict/text", json={"text": extracted_text[:2000]})
                results["sub_results"]["text"] = r.json()
            except:
                results["sub_results"]["text"] = {"error": "Text service offline"}
        
        # Delegate URLs
        url_results = []
        for url in extraction.get("urls", []):
            try:
                r = await client.post(f"{SERVICES['url']}/predict/url", json={"url": url})
                url_data = r.json()
                url_data["url"] = url
                url_results.append(url_data)
            except:
                url_results.append({"url": url, "error": "URL service offline"})
        results["sub_results"]["urls"] = url_results
    
    # Final verdict
    is_phishing = False
    if results["heuristic_risk"] >= 0.5:
        is_phishing = True
    if results["sub_results"].get("text", {}).get("prediction") == "phishing":
        is_phishing = True
    if any(u.get("prediction") == "malicious" for u in url_results):
        is_phishing = True
    
    results["final_prediction"] = "phishing" if is_phishing else "legitimate"
    results["latency_ms"] = round((time.time() - start) * 1000, 1)
    return results

if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="0.0.0.0", port=9000)
