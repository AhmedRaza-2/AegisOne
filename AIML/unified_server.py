"""
AegisOne — Unified AI Server (Single File, All Models)
======================================================
One command starts everything:
    python unified_server.py

Loads ALL models internally:
  - Email AI    (DistilBERT + Bi-LSTM + Attention)
  - Text AI     (DistilBERT + Bi-LSTM, short-form optimized)
  - URL AI      (DistilBERT + Feature MLP, 4-class)
  - Image AI    (EfficientNet-B3 + SE Blocks)
  - Attachment   (Orchestrator → delegates to above)

Test UI: http://localhost:9000
"""

import os, sys, io, time, tempfile, importlib.util
import torch
import torch.nn as nn
import numpy as np
from PIL import Image
from fastapi import FastAPI, File, UploadFile, HTTPException, Form
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import HTMLResponse
from transformers import DistilBertTokenizer
from torchvision import models, transforms
from pathlib import Path

# ===== Setup Paths =====
BASE_DIR = os.path.dirname(os.path.abspath(__file__))
URL_MODEL_PATH = str(Path(BASE_DIR) / "url" / "best (3).pt" if os.path.exists(os.path.join(BASE_DIR, "url", "best (3).pt")) else Path(BASE_DIR) / "url" / "best.pt")
DEVICE = torch.device("cuda" if torch.cuda.is_available() else "cpu")

# ===== Safe Module Loader =====
def load_module(name, path):
    """Load a .py file as a module without import conflicts (avoids 'email' stdlib clash)."""
    spec = importlib.util.spec_from_file_location(name, path)
    mod = importlib.util.module_from_spec(spec)
    sys.modules[name] = mod
    spec.loader.exec_module(mod)
    return mod

# ===== FastAPI App =====
app = FastAPI(title="AegisOne Unified AI Server", version="3.0")
app.add_middleware(CORSMiddleware, allow_origins=["*"], allow_methods=["*"], allow_headers=["*"])

# ===== Global Model Registry =====
MODELS = {}
TOKENIZER = None
IMAGE_TRANSFORM = None
IMAGE_THRESHOLD = 0.5


# ══════════════════════════════════════════════════════════════════
# STARTUP: Load All Models Once
# ══════════════════════════════════════════════════════════════════

@app.on_event("startup")
async def load_all_models():
    global MODELS, TOKENIZER, IMAGE_TRANSFORM, IMAGE_THRESHOLD

    print("\n" + "=" * 60)
    print("  🛡️  AegisOne Unified AI Server — Starting Up")
    print("=" * 60)

    # Shared tokenizer for all NLP models
    print("📥 Loading DistilBERT tokenizer...")
    TOKENIZER = DistilBertTokenizer.from_pretrained("distilbert-base-uncased")

    # ---------- 1. EMAIL MODEL ----------
    email_py = os.path.join(BASE_DIR, "email", "phishing_model_email.py")
    email_pt = os.path.join(BASE_DIR, "email", "best_phishing_model.pt")
    if os.path.exists(email_pt):
        try:
            mod = load_module("aegis_email", email_py)
            model = mod.PhishingDetector()
            model.load_state_dict(torch.load(email_pt, map_location=DEVICE), strict=False)
            model.to(DEVICE).eval()
            MODELS["email"] = {"model": model, "extract_features": mod.extract_structured_features}
            print("✅ Email AI loaded")
        except Exception as e:
            print(f"⚠️  Email AI failed: {e}")
    else:
        print(f"⚠️  Email weights not found: {email_pt}")

    # ---------- 2. TEXT MODEL ----------
    text_py = os.path.join(BASE_DIR, "text_general", "phishing_model_text.py")
    text_pt = os.path.join(BASE_DIR, "text_general", "best_phishing_model_text.pt")
    if os.path.exists(text_pt):
        try:
            mod = load_module("aegis_text", text_py)
            model = mod.PhishingDetectorText()
            model.load_state_dict(torch.load(text_pt, map_location=DEVICE), strict=False)
            model.to(DEVICE).eval()
            MODELS["text"] = {"model": model, "extract_features": mod.extract_general_text_features}
            print("✅ Text AI loaded")
        except Exception as e:
            print(f"⚠️  Text AI failed: {e}")
    else:
        print(f"⚠️  Text weights not found: {text_pt}")

    # ---------- 3. URL MODEL ----------
    url_py = os.path.join(BASE_DIR, "url", "phishing_model_url.py")
    url_pt = URL_MODEL_PATH
    if os.path.exists(url_pt):
        try:
            mod = load_module("aegis_url", url_py)
            model, model_name = mod.load_url_detector(url_pt, DEVICE)
            from transformers import AutoTokenizer
            url_tokenizer = AutoTokenizer.from_pretrained(model_name)
            MODELS["url"] = {
                "model": model,
                "tokenizer": url_tokenizer,
                "extract_features": mod.extract_url_numerical_features
            }
            print(f"✅ URL AI loaded (base: {model_name})")
        except Exception as e:
            print(f"⚠️  URL AI failed: {e}")
    else:
        print(f"⚠️  URL weights not found: {url_pt}")

    # ---------- 4. IMAGE MODEL ----------
    img_config_py = os.path.join(BASE_DIR, "image_phishing_detection_model", "config_v2.py")
    img_pt = os.path.join(BASE_DIR, "image_phishing_detection_model", "checkpoints_v2", "best_model.pth")
    if os.path.exists(img_pt):
        try:
            cfg_mod = load_module("aegis_img_cfg", img_config_py)
            cfg = cfg_mod.cfg
            SEBlock = cfg_mod.SEBlock

            model = models.efficientnet_b3(weights=None)
            in_f = model.classifier[1].in_features
            model.classifier = nn.Sequential(
                nn.Dropout(p=cfg.DROPOUT_1),
                nn.Linear(in_f, 512),
                nn.BatchNorm1d(512),
                nn.ReLU(inplace=True),
                SEBlock(512, reduction=16),
                nn.Dropout(p=cfg.DROPOUT_2),
                nn.Linear(512, 128),
                nn.BatchNorm1d(128),
                nn.ReLU(inplace=True),
                nn.Linear(128, cfg.NUM_CLASSES),
            )
            ck = torch.load(img_pt, map_location=DEVICE)
            model.load_state_dict(ck["model_state"])
            IMAGE_THRESHOLD = ck.get("optimal_threshold", 0.5)
            model.to(DEVICE).eval()

            IMAGE_TRANSFORM = transforms.Compose([
                transforms.Resize((cfg.IMAGE_SIZE, cfg.IMAGE_SIZE)),
                transforms.ToTensor(),
                transforms.Normalize([0.485, 0.456, 0.406], [0.229, 0.224, 0.225]),
            ])
            MODELS["image"] = {"model": model}
            print(f"✅ Image AI loaded (threshold={IMAGE_THRESHOLD:.3f})")
        except Exception as e:
            print(f"⚠️  Image AI failed: {e}")
    else:
        print(f"⚠️  Image weights not found: {img_pt}")

    # ---------- 5. ATTACHMENT ORCHESTRATOR ----------
    try:
        sys.path.insert(0, os.path.join(BASE_DIR, "attachements"))
        from attachment_orchestrator import AttachmentOrchestrator
        MODELS["attachment_orch"] = AttachmentOrchestrator()
        print("✅ Attachment Orchestrator loaded")
    except Exception as e:
        print(f"⚠️  Attachment Orchestrator failed: {e}")

    print("=" * 60)
    loaded = [k for k in MODELS if k != "attachment_orch"]
    print(f"  🚀 Ready! {len(loaded)}/4 AI models loaded on {DEVICE}")
    print(f"  🌐 Open http://localhost:9000 to test")
    print("=" * 60 + "\n")


# ══════════════════════════════════════════════════════════════════
# INFERENCE HELPERS
# ══════════════════════════════════════════════════════════════════

URL_CLASSES = ["benign", "defacement", "phishing", "malware"]

def get_attention_based_xai(model, tokens, attention_mask):
    """
    Extracts the tokens with the highest attention weights from the MultiHeadAttentionPool.
    Returns a list of the top 3 highly attended words.
    """
    try:
        if not hasattr(model, "attention") or model.attention.attention_weights is None:
            return []
        attn_weights = model.attention.attention_weights
        mean_attn = attn_weights[0].mean(dim=0).mean(dim=0)
        import string
        special_tokens = {"[cls]", "[sep]", "[pad]", "http", "https", "www", "com"}
        scored_tokens = []
        for idx, token in enumerate(tokens):
            t_lower = token.lower()
            if (idx < len(mean_attn) and 
                t_lower not in special_tokens and 
                not t_lower.startswith("##") and 
                len(t_lower) > 2 and 
                not all(c in string.punctuation for c in t_lower)):
                scored_tokens.append((token, float(mean_attn[idx].item())))
        scored_tokens.sort(key=lambda x: x[1], reverse=True)
        top_words = [t[0] for t in scored_tokens[:3] if t[1] > 0.001]
        return top_words
    except Exception as e:
        print(f"Error extracting XAI: {e}")
        return []

def get_bert_attention_xai(model, tokens, attention_mask):
    """
    Extracts tokens with the highest attention weights from the DistilBERT self-attentions.
    """
    try:
        if not hasattr(model, "last_attentions") or model.last_attentions is None:
            return []
        last_layer_attn = model.last_attentions[-1][0]
        mean_attn = last_layer_attn.mean(dim=0)
        cls_attn = mean_attn[0, :]
        import string
        special_tokens = {"[cls]", "[sep]", "[pad]", "http", "https", "www", "com", "org", "net", "edu", "pk"}
        scored_tokens = []
        for idx, token in enumerate(tokens):
            t_lower = token.lower()
            if (idx < len(cls_attn) and 
                attention_mask[idx] == 1 and 
                t_lower not in special_tokens and 
                not t_lower.startswith("##") and 
                len(t_lower) > 2 and 
                not all(c in string.punctuation for c in t_lower)):
                scored_tokens.append((token, float(cls_attn[idx].item())))
        scored_tokens.sort(key=lambda x: x[1], reverse=True)
        return [t[0] for t in scored_tokens[:3] if t[1] > 0.001]
    except Exception as e:
        print(f"Error extracting URL XAI: {e}")
        return []

# ===== Sync Prediction Core Logic =====

def predict_email(sender, subject, body):
    if "email" not in MODELS:
        return {"error": "Email model not loaded"}
    m = MODELS["email"]
    text = f"[SUBJECT]: {subject} [BODY]: {body}"
    enc = TOKENIZER(text, add_special_tokens=True, max_length=512,
                    padding="max_length", truncation=True, return_tensors="pt").to(DEVICE)
    feats = m["extract_features"](sender, subject, body).unsqueeze(0).to(DEVICE)
    with torch.no_grad():
        logits = m["model"](enc["input_ids"], enc["attention_mask"], feats)
        prob = torch.sigmoid(logits).item()
    is_phish = prob >= 0.5
    tokens = TOKENIZER.convert_ids_to_tokens(enc["input_ids"][0])
    xai_words = get_attention_based_xai(m["model"], tokens, enc["attention_mask"][0])
    explanation = f"AI flagged suspicious keywords: {', '.join(xai_words)}" if xai_words else "AI identified suspicious context structure"
    return {"prediction": "phishing" if is_phish else "legitimate",
            "confidence": round(prob if is_phish else 1-prob, 4),
            "phishing_probability": round(prob, 4),
            "model": "email",
            "xai_words": xai_words,
            "explanation": explanation}

def predict_text(text):
    if "text" not in MODELS:
        return {"error": "Text model not loaded"}
    m = MODELS["text"]
    enc = TOKENIZER(text, add_special_tokens=True, max_length=96,
                    padding="max_length", truncation=True, return_tensors="pt").to(DEVICE)
    feats = m["extract_features"](text).unsqueeze(0).to(DEVICE)
    with torch.no_grad():
        logits = m["model"](enc["input_ids"], enc["attention_mask"], feats)
        prob = torch.sigmoid(logits).item()
    is_phish = prob >= 0.5
    tokens = TOKENIZER.convert_ids_to_tokens(enc["input_ids"][0])
    xai_words = get_attention_based_xai(m["model"], tokens, enc["attention_mask"][0])
    explanation = f"AI flagged suspicious keywords: {', '.join(xai_words)}" if xai_words else "AI identified suspicious patterns in content structure"

    return {"prediction": "phishing" if is_phish else "legitimate",
            "confidence": round(prob if is_phish else 1-prob, 4),
            "phishing_probability": round(prob, 4), 
            "model": "text",
            "xai_words": xai_words,
            "explanation": explanation}

def predict_url(url):
    if "url" not in MODELS:
        return {"error": "URL model not loaded"}
    
    # 1. Fast-path trusted domain routing & brand impersonation check
    from AIML.url.brand_engine import check_brand_impersonation
    brand_result = check_brand_impersonation(url)
    
    # Check if exactly a trusted domain to bypass deep checks
    trusted_domains = {
        "google.com", "google.com.pk", "youtube.com", "facebook.com", "instagram.com", 
        "twitter.com", "x.com", "linkedin.com", "github.com", "microsoft.com", 
        "apple.com", "amazon.com", "netflix.com", "wikipedia.org", "yahoo.com",
        "espncricinfo.com", "icc-cricket.com", "tapmad.com", "outlook.com", "gmail.com", 
        "zoom.us", "slack.com", "teams.live.com", "spotify.com", "pinterest.com", "reddit.com"
    }
    
    try:
        from urllib.parse import urlparse
        parsed = urlparse(url)
        netloc = parsed.netloc.lower()
        if "@" in netloc:
            netloc = netloc.split("@")[-1]
        domain = netloc.split(":")[0]
        if domain.startswith("www."):
            domain = domain[4:]
            
        is_trusted = False
        for trusted in trusted_domains:
            if domain == trusted or domain.endswith("." + trusted):
                is_trusted = True
                break
                
        # Stage 2: Risky file check on trusted domain
        risky_extensions = {".exe", ".zip", ".rar", ".pdf", ".doc", ".docx", ".xls", ".xlsx", ".html", ".htm", ".bin", ".sh"}
        path_and_query = (parsed.path + "?" + parsed.query).lower()
        has_risky_file = any(ext in path_and_query for ext in risky_extensions)
        
        if is_trusted and not has_risky_file:
            dynamic_safe = round(((len(url) % 5) + 1) / 100.0, 4)
            return {
                "prediction": "legitimate",
                "confidence": round(1.0 - dynamic_safe, 4),
                "phishing_probability": dynamic_safe,
                "category": "Safe",
                "model": "url",
                "xai_words": [],
                "explanation": "✓ Verified legitimate corporate domain",
                "evidence": {
                    "trusted_domain": True,
                    "reason": "URL matches a trusted domain whitelist pattern"
                }
            }
    except Exception:
        pass

    # 2. Extract expanded lexical features (64 features)
    from AIML.url.lexical_engine import extract_expanded_features
    lexical_tensor = extract_expanded_features(url)

    # 2.5 Fast-Path / Cascaded Decision Check
    from AIML.url.fusion_engine import fuse_url_intelligence
    cascade_res = fuse_url_intelligence(url, None, brand_result, lexical_tensor)
    if cascade_res["evidence"]["fusion_method"] in {
        "Cascade Level 1: Static Threat Signature Override",
        "Cascade Level 2: Static Clean Pass Override"
    }:
        return {
            "prediction": cascade_res["prediction"],
            "confidence": cascade_res["confidence"],
            "phishing_probability": round(cascade_res["risk_score"] / 100.0, 4),
            "category": cascade_res["category"],
            "model": "url",
            "xai_words": [],
            "explanation": cascade_res["explanation"],
            "evidence": cascade_res["evidence"]
        }

    # 3. Deep Semantic Analysis (DistilBERT/BERT-Mini)
    m = MODELS["url"]
    
    # Import the URL sanitization logic locally to avoid breaking existing imports
    import sys
    sys.path.insert(0, os.path.join(BASE_DIR, "url"))
    from phishing_model_url import sanitize_url
    clean_url = sanitize_url(url)

    url_tokenizer = m.get("tokenizer", TOKENIZER)
    enc = url_tokenizer(clean_url, add_special_tokens=True, max_length=128,
                        padding="max_length", truncation=True, return_tensors="pt").to(DEVICE)
                        
    # Model forward pass expects original 10 features
    nn_feats = m["extract_features"](clean_url).unsqueeze(0).to(DEVICE)

    with torch.no_grad():
        logits = m["model"](enc["input_ids"], enc["attention_mask"], nn_feats)
        probs = torch.softmax(logits, dim=1)[0].cpu().tolist()

    # 4. Evidence Fusion & Calibration
    from AIML.url.fusion_engine import fuse_url_intelligence
    fusion_result = fuse_url_intelligence(url, probs, brand_result, lexical_tensor)

    # 5. XAI Attention Words Extraction
    is_phish = (fusion_result["prediction"] == "malicious")
    xai_words = []
    if is_phish:
        with torch.no_grad():
            tokens = url_tokenizer.convert_ids_to_tokens(enc["input_ids"][0])
            xai_words = get_bert_attention_xai(m["model"], tokens, enc["attention_mask"][0])
            if xai_words:
                fusion_result["explanation"] += f" | AI focused on: {', '.join(xai_words)}"

    return {
        "prediction": fusion_result["prediction"],
        "confidence": fusion_result["confidence"],
        "phishing_probability": round(fusion_result["risk_score"] / 100.0, 4),
        "category": fusion_result["category"],
        "model": "url",
        "xai_words": xai_words,
        "explanation": fusion_result["explanation"],
        "evidence": fusion_result["evidence"]
    }

def predict_image_bytes(img_bytes):
    if "image" not in MODELS:
        return {"error": "Image model not loaded"}
    img = Image.open(io.BytesIO(img_bytes)).convert("RGB")
    tensor = IMAGE_TRANSFORM(img).unsqueeze(0).to(DEVICE)
    with torch.no_grad():
        out = MODELS["image"]["model"](tensor)
        prob = torch.softmax(out, dim=1)[0, 1].item()
    is_phish = prob >= IMAGE_THRESHOLD
    return {"prediction": "phishing" if is_phish else "legitimate",
            "confidence": round(prob if is_phish else 1-prob, 4),
            "phishing_probability": round(prob, 4),
            "threshold_used": IMAGE_THRESHOLD, "model": "image"}


# ══════════════════════════════════════════════════════════════════
# API ENDPOINTS
# ══════════════════════════════════════════════════════════════════

@app.get("/", response_class=HTMLResponse)
async def serve_ui():
    ui_path = os.path.join(BASE_DIR, "test_ui.html")
    with open(ui_path, "r", encoding="utf-8") as f:
        return HTMLResponse(content=f.read())

@app.get("/health")
async def health():
    loaded = {k: True for k in MODELS if k != "attachment_orch"}
    return {"status": "ok", "device": str(DEVICE), "models_loaded": loaded,
            "services": {
                "email": {"status": "ok" if "email" in MODELS else "offline"},
                "text": {"status": "ok" if "text" in MODELS else "offline"},
                "url": {"status": "ok" if "url" in MODELS else "offline"},
                "image": {"status": "ok" if "image" in MODELS else "offline"},
            }}

@app.post("/analyze/email")
async def api_email(sender: str = Form(""), subject: str = Form(""), body: str = Form("")):
    start = time.time()
    result = predict_email(sender, subject, body)
    result["latency_ms"] = round((time.time() - start) * 1000, 1)
    return result

@app.post("/analyze/text")
async def api_text(text: str = Form(...)):
    start = time.time()
    result = predict_text(text)
    result["latency_ms"] = round((time.time() - start) * 1000, 1)
    return result

@app.post("/analyze/url")
async def api_url(url: str = Form(...)):
    start = time.time()
    result = predict_url(url)
    result["latency_ms"] = round((time.time() - start) * 1000, 1)
    return result

@app.post("/analyze/image")
async def api_image(file: UploadFile = File(...)):
    start = time.time()
    data = await file.read()
    result = predict_image_bytes(data)
    result["latency_ms"] = round((time.time() - start) * 1000, 1)
    return result

@app.post("/analyze/attachment")
async def api_attachment(file: UploadFile = File(...)):
    start = time.time()
    orch = MODELS.get("attachment_orch")
    if not orch:
        raise HTTPException(500, "Attachment orchestrator not loaded")

    suffix = os.path.splitext(file.filename or "")[1]
    fd, temp_path = tempfile.mkstemp(suffix=suffix)
    try:
        with os.fdopen(fd, "wb") as f:
            f.write(await file.read())
        extraction = orch.process_file(temp_path)
    finally:
        if os.path.exists(temp_path):
            os.remove(temp_path)

    results = {
        "file_type": extraction.get("file_type", "unknown"),
        "macros_found": extraction.get("macros_found", False),
        "heuristic_risk": extraction.get("heuristic_risk", 0.0),
        "vba_analysis": extraction.get("vba_analysis"),
        "extracted_urls_count": len(extraction.get("urls", [])),
        "sub_results": {},
    }

    # Delegate text
    extracted_text = extraction.get("text", "")
    if extracted_text.strip() and extracted_text != "[ZIP CONTENT]":
        results["sub_results"]["text"] = predict_text(extracted_text[:2000])

    # Delegate URLs
    url_results = []
    for url in extraction.get("urls", []):
        r = predict_url(url)
        r["url"] = url
        url_results.append(r)
    results["sub_results"]["urls"] = url_results

    # Final verdict
    is_phishing = False
    if results["heuristic_risk"] >= 0.5:
        is_phishing = True
    if results["sub_results"].get("text", {}).get("prediction") == "phishing":
        is_phishing = True
    if any(u.get("prediction") == "malicious" for u in url_results):
        is_phishing = True

    results["prediction"] = "phishing" if is_phishing else "legitimate"
    results["final_prediction"] = results["prediction"]
    results["latency_ms"] = round((time.time() - start) * 1000, 1)
    return results


@app.post("/analyze/download_url")
async def api_download_url(url: str = Form(...)):
    """
    Extension calls this when a download is intercepted.
    Backend fetches the file from the URL, saves to temp,
    runs AttachmentOrchestrator (text→Text AI, URLs→URL AI),
    returns full verdict so extension can block or allow.
    """
    import httpx
    import urllib.parse
    start = time.time()
    orch = MODELS.get("attachment_orch")
    if not orch:
        # Fallback: just check the URL itself
        result = predict_url(url)
        result["latency_ms"] = round((time.time() - start) * 1000, 1)
        result["note"] = "Attachment orchestrator unavailable — URL-only check"
        return result

    # Check if this is a local file scheme (e.g. file:///)
    is_local = False
    local_path = ""
    if url.startswith("file://"):
        is_local = True
        local_path = url.replace("file:///", "")
        # On Windows, file:///D:/path becomes D:/path. Clean up starting slash.
        if local_path.startswith("/") and len(local_path) > 2 and local_path[2] == ":":
            local_path = local_path[1:]
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

        extraction = orch.process_file(local_path)
        file_bytes_len = os.path.getsize(local_path)
        
        results = {
            "source_url": url,
            "file_type": extraction.get("file_type", "unknown"),
            "file_size_kb": round(file_bytes_len / 1024, 1),
            "macros_found": extraction.get("macros_found", False),
            "heuristic_risk": extraction.get("heuristic_risk", 0.0),
            "vba_analysis": extraction.get("vba_analysis"),
            "extracted_urls_count": len(extraction.get("urls", [])),
            "sub_results": {},
        }
        # Proceed with return block below after extraction
        file_bytes = b""
    else:
        # Derive file extension from URL
        from urllib.parse import urlparse
        parsed = urlparse(url)
        path_part = parsed.path
        suffix = os.path.splitext(path_part)[1] or ".bin"

        try:
            async with httpx.AsyncClient(timeout=15.0, follow_redirects=True) as client:
                # Stream download (max 10MB for safety)
                MAX_BYTES = 10 * 1024 * 1024
                chunks = []
                total = 0
                async with client.stream("GET", url) as response:
                    response.raise_for_status()
                    # Detect suffix from Content-Type if not in URL
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
            # Network error — fall back to URL-only check
            result = predict_url(url)
            result["latency_ms"] = round((time.time() - start) * 1000, 1)
            result["note"] = f"Could not fetch file ({e}) — URL-only check"
            return result

        # Save to temp file and run AttachmentOrchestrator
        fd, temp_path = tempfile.mkstemp(suffix=suffix)
        try:
            with os.fdopen(fd, "wb") as f:
                f.write(file_bytes)
            extraction = orch.process_file(temp_path)
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
        "extracted_urls_count": len(extraction.get("urls", [])),
        "sub_results": {},
    }

    # ── Text → Text AI ──
    extracted_text = extraction.get("text", "")
    if extracted_text.strip() and extracted_text != "[ZIP CONTENT]":
        results["sub_results"]["text"] = predict_text(extracted_text[:2000])

    # ── URLs → URL AI (each one) ──
    url_results = []
    for u in extraction.get("urls", []):
        r = predict_url(u)
        r["url"] = u
        url_results.append(r)
    results["sub_results"]["urls"] = url_results

    # ── Final verdict (OR logic: any signal → phishing) ──
    is_phishing = False
    phishing_signals = []

    if results["heuristic_risk"] >= 0.5:
        is_phishing = True
        phishing_signals.append(f"Heuristic risk {results['heuristic_risk']:.0%}")
    if results["macros_found"]:
        is_phishing = True
        phishing_signals.append("Malicious macros found")
    text_pred = results["sub_results"].get("text", {})
    if text_pred.get("prediction") == "phishing":
        is_phishing = True
        phishing_signals.append(f"Text AI: {text_pred.get('phishing_probability',0):.0%} risk")
    bad_urls = [u for u in url_results if u.get("phishing_probability", 0) > 0.5]
    if bad_urls:
        is_phishing = True
        phishing_signals.append(f"{len(bad_urls)} malicious URL(s) inside file")

    results["prediction"] = "phishing" if is_phishing else "legitimate"
    results["final_prediction"] = results["prediction"]
    results["phishing_signals"] = phishing_signals
    results["phishing_probability"] = max(
        results["heuristic_risk"],
        text_pred.get("phishing_probability", 0),
        max((u.get("phishing_probability", 0) for u in url_results), default=0),
    )
    results["latency_ms"] = round((time.time() - start) * 1000, 1)
    return results


# ══════════════════════════════════════════════════════════════════
# RUN
# ══════════════════════════════════════════════════════════════════

if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="0.0.0.0", port=9000)
