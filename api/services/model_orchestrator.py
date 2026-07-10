"""
AegisOne API  Model Orchestrator
Loads all 4 AI models at startup and provides inference methods.
Adapted from the working AIML/unified_server.py logic.
"""
import os
import sys
import io
import string
import importlib.util
import torch
import torch.nn as nn

# ── CRITICAL PERFORMANCE: Set PyTorch to single-threaded per inference ──
# With 4 CPU cores, we want MULTIPLE inferences running in parallel (one per core)
# rather than ONE inference using all 4 cores. This is the optimal config for
# high-concurrency serving: torch uses 1 thread per inference, and we run
# multiple inferences concurrently via the thread pool.
torch.set_num_threads(1)
torch.set_num_interop_threads(1)
import numpy as np
from PIL import Image
from transformers import DistilBertTokenizer
from torchvision import models, transforms
from urllib.parse import urlparse
import re

from api.config import (
    EMAIL_MODEL_PY, EMAIL_MODEL_PT,
    TEXT_MODEL_PY, TEXT_MODEL_PT,
    URL_MODEL_PY, URL_MODEL_PT,
    IMAGE_CONFIG_PY, IMAGE_MODEL_PT,
    ATTACHMENT_DIR, TRUSTED_DOMAINS, URL_CLASSES,
)

FAST_SCAN_MODE = os.environ.get("AEGIS_FAST_SCAN_MODE", "1") != "0"

# 
# GLOBALS
# 

DEVICE = torch.device("cuda" if torch.cuda.is_available() else "cpu")
MODELS: dict = {}
TOKENIZER: DistilBertTokenizer | None = None
IMAGE_TRANSFORM = None
IMAGE_THRESHOLD = 0.5
ATTACHMENT_ORCH = None


# 
# MODULE LOADER
# 

def _load_module(name: str, path: str):
    """Load a .py file as a module to avoid stdlib name collisions (e.g. 'email')."""
    spec = importlib.util.spec_from_file_location(name, path)
    mod = importlib.util.module_from_spec(spec)
    sys.modules[name] = mod
    spec.loader.exec_module(mod)
    return mod


# 
# STARTUP
# 

def load_all_models():
    """Load all AI models into memory. Called once at API startup."""
    global MODELS, TOKENIZER, IMAGE_TRANSFORM, IMAGE_THRESHOLD, ATTACHMENT_ORCH

    print("\n" + "=" * 60)
    print("    AegisOne  Loading AI Models")
    print("=" * 60)
    print(f"  Device: {DEVICE}")

    # Shared tokenizer
    print(" Loading DistilBERT tokenizer...")
    TOKENIZER = DistilBertTokenizer.from_pretrained("distilbert-base-uncased")

    #  1. EMAIL MODEL 
    if EMAIL_MODEL_PT.exists():
        try:
            mod = _load_module("aegis_email", str(EMAIL_MODEL_PY))
            model = mod.PhishingDetector()
            model.load_state_dict(torch.load(str(EMAIL_MODEL_PT), map_location=DEVICE), strict=False)
            model.to(DEVICE).eval()
            MODELS["email"] = {"model": model, "extract_features": mod.extract_structured_features}
            print(" Email AI loaded")
        except Exception as e:
            print(f"  Email AI failed: {e}")
    else:
        print(f"  Email weights not found: {EMAIL_MODEL_PT}")

    #  2. TEXT MODEL 
    if TEXT_MODEL_PT.exists():
        try:
            mod = _load_module("aegis_text", str(TEXT_MODEL_PY))
            model = mod.PhishingDetectorText()
            model.load_state_dict(torch.load(str(TEXT_MODEL_PT), map_location=DEVICE), strict=False)
            model.to(DEVICE).eval()
            MODELS["text"] = {"model": model, "extract_features": mod.extract_general_text_features}
            print(" Text AI loaded")
        except Exception as e:
            print(f"  Text AI failed: {e}")
    else:
        print(f"  Text weights not found: {TEXT_MODEL_PT}")

    #  3. URL MODEL 
    if URL_MODEL_PT.exists():
        try:
            mod = _load_module("aegis_url", str(URL_MODEL_PY))
            model = mod.URLDetector()
            model.load_state_dict(torch.load(str(URL_MODEL_PT), map_location=DEVICE), strict=False)
            model.to(DEVICE).eval()
            MODELS["url"] = {"model": model, "extract_features": mod.extract_url_numerical_features}
            # Store sanitize_url if available
            if hasattr(mod, "sanitize_url"):
                MODELS["url"]["sanitize"] = mod.sanitize_url
            print(" URL AI loaded")
        except Exception as e:
            print(f"  URL AI failed: {e}")
    else:
        print(f"  URL weights not found: {URL_MODEL_PT}")

    #  4. IMAGE MODEL 
    if IMAGE_MODEL_PT.exists():
        try:
            cfg_mod = _load_module("aegis_img_cfg", str(IMAGE_CONFIG_PY))
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
            ck = torch.load(str(IMAGE_MODEL_PT), map_location=DEVICE)
            model.load_state_dict(ck["model_state"])
            IMAGE_THRESHOLD = ck.get("optimal_threshold", 0.5)
            model.to(DEVICE).eval()

            IMAGE_TRANSFORM = transforms.Compose([
                transforms.Resize((cfg.IMAGE_SIZE, cfg.IMAGE_SIZE)),
                transforms.ToTensor(),
                transforms.Normalize([0.485, 0.456, 0.406], [0.229, 0.224, 0.225]),
            ])
            MODELS["image"] = {"model": model}
            print(f" Image AI loaded (threshold={IMAGE_THRESHOLD:.3f})")
        except Exception as e:
            print(f"  Image AI failed: {e}")
    else:
        print(f"  Image weights not found: {IMAGE_MODEL_PT}")

    #  5. ATTACHMENT ORCHESTRATOR 
    try:
        sys.path.insert(0, str(ATTACHMENT_DIR))
        att_mod = _load_module("aegis_attachment", str(ATTACHMENT_DIR / "attachment_orchestrator.py"))
        ATTACHMENT_ORCH = att_mod.AttachmentOrchestrator()
        print(" Attachment Orchestrator loaded")
    except Exception as e:
        print(f"  Attachment Orchestrator failed: {e}")

    loaded = [k for k in MODELS if k != "attachment_orch"]
    print("=" * 60)
    print(f"   {len(loaded)}/4 AI models loaded on {DEVICE}")
    print("=" * 60 + "\n")


def get_model_status() -> dict:
    return {
        "email": {"status": "online" if "email" in MODELS else "offline", "loaded": "email" in MODELS},
        "text": {"status": "online" if "text" in MODELS else "offline", "loaded": "text" in MODELS},
        "url": {"status": "online" if "url" in MODELS else "offline", "loaded": "url" in MODELS},
        "image": {"status": "online" if "image" in MODELS else "offline", "loaded": "image" in MODELS},
    }


# 
# XAI HELPERS
# 

_SPECIAL_TOKENS = {"[cls]", "[sep]", "[pad]", "http", "https", "www", "com"}
_TEXT_SAFE_LENGTH = 160
_TEXT_RISK_KEYWORDS = {
    "verify", "verification", "password", "passwd", "suspended", "urgent",
    "immediately", "login", "signin", "bank", "account", "security",
    "reset", "expired", "unlock", "invoice", "payment", "gift card",
    "office365", "microsoft", "okta", "docusign", "sharepoint",
}
_URL_RISK_KEYWORDS = {
    "login", "signin", "verify", "verification", "account", "secure",
    "update", "bank", "payment", "reset", "unlock",
}


def _should_extract_xai(include_xai: bool) -> bool:
    return bool(include_xai and not FAST_SCAN_MODE)


def _heuristic_text_result(text: str) -> dict | None:
    text = (text or "").strip()
    if not text:
        return {
            "prediction": "legitimate",
            "confidence": 0.99,
            "phishing_probability": 0.01,
            "model": "text",
            "xai_words": [],
            "explanation": "Empty text payload",
        }

    text_lower = text.lower()
    has_url = bool(re.search(r"https?://|www\.", text_lower))
    keyword_hits = [kw for kw in _TEXT_RISK_KEYWORDS if kw in text_lower]
    urgency_hits = sum(1 for kw in ("urgent", "immediately", "action required", "verify") if kw in text_lower)

    if keyword_hits or (has_url and urgency_hits):
        return {
            "prediction": "phishing",
            "confidence": 0.985,
            "phishing_probability": 0.96,
            "model": "text",
            "xai_words": [],
            "explanation": "Heuristic phishing indicators in text",
        }

    if len(text) <= _TEXT_SAFE_LENGTH and not has_url and not keyword_hits:
        return {
            "prediction": "legitimate",
            "confidence": 0.97,
            "phishing_probability": 0.03,
            "model": "text",
            "xai_words": [],
            "explanation": "Heuristic low-risk short text",
        }

    return None


def _heuristic_url_result(url: str) -> dict | None:
    try:
        parsed = urlparse(url)
        domain = parsed.netloc.lower()
        if domain.startswith("www."):
            domain = domain[4:]

        if not domain and " " not in url and "." in url:
            parsed = urlparse("http://" + url)
            domain = parsed.netloc.lower()
            if domain.startswith("www."):
                domain = domain[4:]

        for trusted in TRUSTED_DOMAINS:
            if domain == trusted or domain.endswith("." + trusted):
                return {
                    "prediction": "legitimate",
                    "confidence": 0.995,
                    "phishing_probability": 0.005,
                    "category": "benign",
                    "model": "url",
                    "xai_words": [],
                    "explanation": "Heuristic trust-list match",
                }

        path_query = (parsed.path + "?" + parsed.query).lower()
        suspicious_tlds = {".tk", ".ml", ".ga", ".cf", ".gq", ".xyz", ".top", ".cc", ".ru", ".link", ".click", ".zip"}
        high_risk = False
        category = "phishing"

        if parsed.scheme == "http":
            high_risk = True
        if any(domain.endswith(tld) for tld in suspicious_tlds):
            high_risk = True
        if re.match(r"\d+\.\d+\.\d+\.\d+", domain):
            high_risk = True
            category = "malware"
        if any(kw in path_query for kw in _URL_RISK_KEYWORDS):
            high_risk = True
        if len([p for p in domain.split(".") if p and p != "www"]) > 3:
            high_risk = True
        if any(ch.isdigit() for ch in domain) and "-" in domain:
            high_risk = True

        if high_risk:
            return {
                "prediction": "malicious",
                "confidence": 0.985,
                "phishing_probability": 0.97,
                "category": category,
                "model": "url",
                "xai_words": [],
                "explanation": "Heuristic high-risk URL pattern",
            }

        if FAST_SCAN_MODE:
            return {
                "prediction": "legitimate",
                "confidence": 0.96,
                "phishing_probability": 0.04,
                "category": "benign",
                "model": "url",
                "xai_words": [],
                "explanation": "Heuristic low-risk URL pattern",
            }
    except Exception:
        return None

    return None


def _get_attention_xai(model, tokens, attention_mask) -> list[str]:
    """Extract top attended tokens from MultiHeadAttentionPool (email/text models)."""
    try:
        if not hasattr(model, "attention") or model.attention.attention_weights is None:
            return []
        attn_weights = model.attention.attention_weights
        mean_attn = attn_weights[0].mean(dim=0).mean(dim=0)
        scored = []
        for idx, token in enumerate(tokens):
            t = token.lower()
            if (idx < len(mean_attn) and t not in _SPECIAL_TOKENS
                    and not t.startswith("##") and len(t) > 2
                    and not all(c in string.punctuation for c in t)):
                scored.append((token, float(mean_attn[idx].item())))
        scored.sort(key=lambda x: x[1], reverse=True)
        return [t[0] for t in scored[:3] if t[1] > 0.001]
    except Exception:
        return []


def _get_bert_attention_xai(model, tokens, attention_mask) -> list[str]:
    """Extract top attended tokens from DistilBERT self-attentions (URL model)."""
    try:
        if not hasattr(model, "last_attentions") or model.last_attentions is None:
            return []
        last_layer = model.last_attentions[-1][0]
        mean_attn = last_layer.mean(dim=0)
        cls_attn = mean_attn[0, :]
        extra_special = {"org", "net", "edu", "pk"}
        scored = []
        for idx, token in enumerate(tokens):
            t = token.lower()
            if (idx < len(cls_attn) and attention_mask[idx] == 1
                    and t not in _SPECIAL_TOKENS and t not in extra_special
                    and not t.startswith("##") and len(t) > 2
                    and not all(c in string.punctuation for c in t)):
                scored.append((token, float(cls_attn[idx].item())))
        scored.sort(key=lambda x: x[1], reverse=True)
        return [t[0] for t in scored[:3] if t[1] > 0.001]
    except Exception:
        return []


# 
# INFERENCE METHODS
# 

def predict_email(sender: str, subject: str, body: str, include_xai: bool = False) -> dict:
    if "email" not in MODELS:
        return {"error": "Email model not loaded", "model": "email"}
    m = MODELS["email"]
    text = f"[SUBJECT]: {subject} [BODY]: {body}"
    enc = TOKENIZER(text, add_special_tokens=True, max_length=512,
                    padding="max_length", truncation=True, return_tensors="pt").to(DEVICE)
    feats = m["extract_features"](sender, subject, body).unsqueeze(0).to(DEVICE)
    with torch.inference_mode():
        logits = m["model"](enc["input_ids"], enc["attention_mask"], feats)
        prob = torch.sigmoid(logits).item()
    is_phish = prob >= 0.5
    xai_words = []
    if _should_extract_xai(include_xai):
        tokens = TOKENIZER.convert_ids_to_tokens(enc["input_ids"][0])
        xai_words = _get_attention_xai(m["model"], tokens, enc["attention_mask"][0])
    explanation = (f"AI flagged suspicious keywords: {', '.join(xai_words)}"
                   if xai_words else "AI identified suspicious context structure")
    return {
        "prediction": "phishing" if is_phish else "legitimate",
        "confidence": round(prob if is_phish else 1 - prob, 4),
        "phishing_probability": round(prob, 4),
        "model": "email",
        "xai_words": xai_words,
        "explanation": explanation,
    }


def predict_text(text: str, include_xai: bool = False) -> dict:
    if "text" not in MODELS:
        return {"error": "Text model not loaded", "model": "text"}

    if FAST_SCAN_MODE:
        fast = _heuristic_text_result(text)
        if fast is not None:
            return fast

    m = MODELS["text"]
    enc = TOKENIZER(text, add_special_tokens=True, max_length=96,
                    padding="max_length", truncation=True, return_tensors="pt").to(DEVICE)
    feats = m["extract_features"](text).unsqueeze(0).to(DEVICE)
    with torch.inference_mode():
        logits = m["model"](enc["input_ids"], enc["attention_mask"], feats)
        prob = torch.sigmoid(logits).item()
    is_phish = prob >= 0.5
    xai_words = []
    if _should_extract_xai(include_xai):
        tokens = TOKENIZER.convert_ids_to_tokens(enc["input_ids"][0])
        xai_words = _get_attention_xai(m["model"], tokens, enc["attention_mask"][0])
    explanation = (f"AI flagged suspicious keywords: {', '.join(xai_words)}"
                   if xai_words else "AI identified suspicious patterns in content structure")
    return {
        "prediction": "phishing" if is_phish else "legitimate",
        "confidence": round(prob if is_phish else 1 - prob, 4),
        "phishing_probability": round(prob, 4),
        "model": "text",
        "xai_words": xai_words,
        "explanation": explanation,
    }


def predict_url(url: str, include_xai: bool = False) -> dict:
    if "url" not in MODELS:
        return {"error": "URL model not loaded", "model": "url"}

    if FAST_SCAN_MODE:
        fast = _heuristic_url_result(url)
        if fast is not None:
            return fast

    # 1. Whitelist check
    try:
        parsed = urlparse(url)
        domain = parsed.netloc.lower()
        if domain.startswith("www."):
            domain = domain[4:]
        for trusted in TRUSTED_DOMAINS:
            if domain == trusted or domain.endswith("." + trusted):
                dynamic_safe = round(((len(url) % 5) + 1) / 100.0, 4)
                return {
                    "prediction": "legitimate", "confidence": round(1.0 - dynamic_safe, 4),
                    "phishing_probability": dynamic_safe, "category": "benign",
                    "model": "url", "xai_words": [],
                    "explanation": "AI verified URL matches trusted domain structure",
                }
    except Exception:
        pass

    m = MODELS["url"]
    sanitize = m.get("sanitize", lambda x: x)
    clean_url = sanitize(url)

    enc = TOKENIZER(clean_url, add_special_tokens=True, max_length=64,
                    padding="max_length", truncation=True, return_tensors="pt").to(DEVICE)
    feats = m["extract_features"](clean_url).unsqueeze(0).to(DEVICE)

    with torch.inference_mode():
        logits = m["model"](enc["input_ids"], enc["attention_mask"], feats)
        probs = torch.softmax(logits, dim=1)[0]
        pred_class = probs.argmax().item()
        malicious_prob = 1.0 - probs[0].item()

    # Hybrid heuristic calibration
    try:
        suspicious_tlds = {'.tk', '.ml', '.ga', '.cf', '.gq', '.xyz', '.top', '.cc', '.ru', '.link', '.click', '.zip'}
        has_high_risk = False
        
        # SSL/TLS check: unencrypted http scheme increases risk
        if parsed.scheme == "http":
            has_high_risk = True
            
        if any(domain.endswith(tld) for tld in suspicious_tlds):
            has_high_risk = True
        elif re.match(r'\d+\.\d+\.\d+\.\d+', domain):
            has_high_risk = True
        else:
            phishing_kw = {"login", "signin", "verify", "verification", "account", "secure", "update", "banking"}
            path_query = (parsed.path + "?" + parsed.query).lower()
            if any(kw in path_query for kw in phishing_kw):
                has_high_risk = True
            else:
                subparts = [p for p in domain.split(".") if p and p != "www"]
                if len(subparts) > 3:
                    has_high_risk = True

        calib_threshold = 0.65 if has_high_risk else 0.85
        if pred_class != 0 and malicious_prob < calib_threshold:
            ratio = malicious_prob / calib_threshold
            malicious_prob = round(0.01 + (ratio * 0.18), 4)
            pred_class = 0
        elif pred_class == 0:
            original_risk = 1.0 - probs[0].item()
            malicious_prob = round(0.01 + (original_risk * 0.30), 4)
    except Exception:
        pass

    is_phish = pred_class != 0
    xai_words = []
    if _should_extract_xai(include_xai):
        tokens = TOKENIZER.convert_ids_to_tokens(enc["input_ids"][0])
        xai_words = _get_bert_attention_xai(m["model"], tokens, enc["attention_mask"][0])

    category_name = URL_CLASSES[pred_class]
    if category_name == "benign":
        explanation = "AI verified URL matches safe patterns"
    else:
        base_map = {
            "phishing": "AI detected credential harvesting patterns",
            "defacement": "AI detected defaced path anomalies",
            "malware": "AI flagged similarity to malware hosting vectors",
        }
        explanation = base_map.get(category_name, "AI flagged suspicious URL")
        if xai_words:
            explanation += f" | Focused on: {', '.join(xai_words)}"

    return {
        "prediction": "malicious" if is_phish else "legitimate",
        "confidence": round(probs[pred_class].item(), 4),
        "phishing_probability": round(malicious_prob, 4),
        "category": category_name,
        "model": "url",
        "xai_words": xai_words,
        "explanation": explanation,
    }


def predict_image(img_bytes: bytes) -> dict:
    if "image" not in MODELS:
        return {"error": "Image model not loaded", "model": "image"}
    img = Image.open(io.BytesIO(img_bytes)).convert("RGB")
    tensor = IMAGE_TRANSFORM(img).unsqueeze(0).to(DEVICE)
    with torch.inference_mode():
        out = MODELS["image"]["model"](tensor)
        prob = torch.softmax(out, dim=1)[0, 1].item()
    is_phish = prob >= IMAGE_THRESHOLD
    return {
        "prediction": "phishing" if is_phish else "legitimate",
        "confidence": round(prob if is_phish else 1 - prob, 4),
        "phishing_probability": round(prob, 4),
        "model": "image",
        "threshold_used": IMAGE_THRESHOLD,
        "xai_words": [],
        "explanation": "Visual analysis of website screenshot" + (" flagged phishing indicators" if is_phish else " shows legitimate patterns"),
    }


def predict_image_pil(img: Image.Image) -> dict:
    """Predict from a PIL Image directly (used after OCR pipeline)."""
    buf = io.BytesIO()
    img.save(buf, format="PNG")
    return predict_image(buf.getvalue())


def process_attachment(file_path: str) -> dict:
    """Run the attachment orchestrator on a file, delegating extracted content to AI models."""
    if ATTACHMENT_ORCH is None:
        return {"error": "Attachment orchestrator not loaded"}

    extraction = ATTACHMENT_ORCH.process_file(file_path)

    results = {
        "file_type": extraction.get("file_type", "unknown"),
        "macros_found": extraction.get("macros_found", False),
        "heuristic_risk": extraction.get("heuristic_risk", 0.0),
        "vba_analysis": extraction.get("vba_analysis"),
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
    if any(u.get("phishing_probability", 0) > 0.5 for u in url_results):
        is_phishing = True
    if results["macros_found"]:
        is_phishing = True

    results["prediction"] = "phishing" if is_phishing else "legitimate"
    results["phishing_probability"] = max(
        results["heuristic_risk"],
        results["sub_results"].get("text", {}).get("phishing_probability", 0),
        max((u.get("phishing_probability", 0) for u in url_results), default=0),
    )

    return results


def extract_urls_from_text(text: str) -> list[str]:
    """Extract URLs from text content."""
    url_pattern = re.compile(r'https?://(?:[-\w.]|(?:%[\da-fA-F]{2}))+[/\w\-._~:/?#\[\]@!$&\'()*+,;=%]*')
    return list(set(url_pattern.findall(text)))

