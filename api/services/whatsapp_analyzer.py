"""
AegisOne WhatsApp Security Intelligence & Channel Router.
Passes incoming WhatsApp Web modalities (Text, Embedded URLs, Images) directly
into AegisOne's pre-trained core AI models:
- predict_text()   (DistilBERT NLP Neural Model)
- predict_url()    (XGBoost ML URL Classifier)
- predict_image()  (Vision & OCR Phishing Model)

Decision Logic:
Rely strictly on core models' canonical predictions.
If ANY model verdict flags content as phishing/malicious -> Alert User & Log Telemetry.
"""

import re
import logging
import hmac
import hashlib
import asyncio
from typing import List, Dict, Any

from api.services.model_orchestrator import predict_url, predict_text, predict_image

logger = logging.getLogger("aegisone.whatsapp_analyzer")

# HMAC secret key for sender pseudonymization
ORG_HMAC_SECRET = b"aegisone_org_sender_secret_2026_key"


def hmac_pseudonymize_sender(sender: str) -> str:
    """Generate deterministic HMAC-SHA256 hash for sender identifier to preserve privacy."""
    if not sender:
        return "anonymous_sender"
    clean = re.sub(r"[^\d+]", "", str(sender)).lower().strip()
    if not clean:
        clean = str(sender).strip().lower()
    return hmac.new(ORG_HMAC_SECRET, clean.encode("utf-8"), hashlib.sha256).hexdigest()[:24]


def compute_canonical_fingerprint(chat_id: str, sender_id: str, text: str) -> str:
    """
    Generate canonical deduplication fingerprint:
    SHA256("whatsapp:" + chat_id + ":" + sender_id + ":" + normalized_text + ":" + time_bucket_hour)
    """
    import time
    time_bucket = int(time.time() // 3600)  # Hourly bucket
    norm_text = re.sub(r"\s+", " ", (text or "").strip().lower())
    norm_chat = (chat_id or "default_chat").strip().lower()
    norm_sender = (sender_id or "default_sender").strip().lower()

    raw = f"whatsapp:{norm_chat}:{norm_sender}:{norm_text}:{time_bucket}"
    return hashlib.sha256(raw.encode("utf-8")).hexdigest()


def extract_urls_from_text(text: str) -> List[str]:
    """Extract all HTTP/HTTPS embedded URLs from text."""
    if not text:
        return []
    url_pattern = r'https?://[^\s<>"]+|www\.[^\s<>"]+'
    matches = re.findall(url_pattern, text, re.IGNORECASE)
    cleaned = []
    for m in matches:
        u = m.rstrip(".,;!?)']\"")
        if not u.startswith("http"):
            u = "http://" + u
        cleaned.append(u)
    return list(dict.fromkeys(cleaned))  # Deduplicate preserved order


def _is_model_phishing(result: Dict[str, Any]) -> bool:
    """Helper that inspects canonical model prediction outputs without hardcoded score thresholds."""
    if not isinstance(result, dict):
        return False
    pred = str(result.get("prediction", "")).lower()
    dec = str(result.get("decision", "")).lower()
    return pred in ("phishing", "malicious", "high_risk") or dec == "block"


def _get_score_from_result(res: Dict[str, Any]) -> int:
    """Extract 0-100 risk score integer from any model result schema."""
    if not isinstance(res, dict):
        return 0
    if "risk_score" in res and isinstance(res["risk_score"], (int, float)):
        return int(round(res["risk_score"]))
    if "phishing_probability" in res and isinstance(res["phishing_probability"], (int, float)):
        return int(round(res["phishing_probability"] * 100))
    if "confidence" in res and isinstance(res["confidence"], (int, float)):
        if res.get("prediction") in ("phishing", "malicious", "high_risk"):
            return int(round(res["confidence"] * 100))
    return 0


async def analyze_whatsapp_message(
    text: str = "",
    sender: str = "",
    chat_id: str = "",
    chat_title: str = "",
    image_base64: str = ""
) -> Dict[str, Any]:
    """
    Pure WhatsApp Modality Channel Router:
    1. Text -> predict_text(text, include_xai=True) (Core DistilBERT Model)
    2. URLs -> predict_url(url, include_xai=True) (Core ML URL Model)
    3. Image -> predict_image(image) (Core Vision & OCR Model)
    
    Preserves 100% of core models' XAI outputs and evidence fields.
    """
    clean_text = (text or "").strip()
    results: List[Dict[str, Any]] = []
    modalities: List[Dict[str, Any]] = []

    # 1. Text Modality -> Route to AegisOne DistilBERT Text Model
    if clean_text:
        try:
            t_res = await asyncio.to_thread(predict_text, clean_text, include_xai=True)
            if isinstance(t_res, dict):
                results.append(t_res)
                modalities.append({
                    "type": "text",
                    "model": t_res.get("model", "text"),
                    "score": _get_score_from_result(t_res),
                    "verdict": t_res.get("prediction", "legitimate"),
                    "is_threat": _is_model_phishing(t_res),
                    "model_result": t_res  # Full un-truncated model output dictionary
                })
        except Exception as err:
            logger.warning(f"WhatsApp predict_text execution warning: {err}")

    # 2. Embedded URLs Modality -> Route to AegisOne ML URL Model
    urls = extract_urls_from_text(clean_text)
    for u in urls:
        try:
            u_res = predict_url(u, include_xai=True)
            if isinstance(u_res, dict):
                results.append(u_res)
                modalities.append({
                    "type": "url",
                    "url": u,
                    "model": u_res.get("model", "url"),
                    "score": _get_score_from_result(u_res),
                    "verdict": u_res.get("prediction", "legitimate"),
                    "decision": u_res.get("decision", "allow"),
                    "is_threat": _is_model_phishing(u_res),
                    "model_result": u_res  # Full un-truncated model output dictionary
                })
        except Exception as err:
            logger.warning(f"WhatsApp predict_url execution warning for {u}: {err}")

    # 3. Image Modality (if media attachment is present) -> Route to AegisOne Vision Model
    if image_base64:
        try:
            i_res = await asyncio.to_thread(predict_image, image_base64)
            if isinstance(i_res, dict):
                results.append(i_res)
                modalities.append({
                    "type": "image",
                    "model": i_res.get("model", "vision"),
                    "score": _get_score_from_result(i_res),
                    "verdict": i_res.get("prediction", "legitimate"),
                    "is_threat": _is_model_phishing(i_res),
                    "model_result": i_res  # Full un-truncated model output dictionary
                })
        except Exception as err:
            logger.warning(f"WhatsApp predict_image execution warning: {err}")

    # Canonical Decision Logic: Consumes core models' predictions directly
    threats = [r for r in results if _is_model_phishing(r)]
    is_phishing = len(threats) > 0

    # Extract risk scores across modalities for analytics display
    scores = [_get_score_from_result(r) for r in results]
    max_score = max(scores, default=0)

    verdict = "phishing" if is_phishing else ("suspicious" if max_score >= 50 else "safe")
    decision = "block" if is_phishing else ("warn" if max_score >= 50 else "allow")
    threat_category = "MALICIOUS_LINK" if any(r.get("model") == "url" and _is_model_phishing(r) for r in results) else ("PHISHING_TEXT" if is_phishing else "SAFE")

    sender_hash = hmac_pseudonymize_sender(sender)
    fingerprint = compute_canonical_fingerprint(chat_id, sender, clean_text)

    # Collect model explanations and evidence fields directly from model_result objects
    factors = []
    for m in modalities:
        mr = m.get("model_result", {})
        if mr.get("explanation"):
            factors.append(mr["explanation"])
        if mr.get("xai_words"):
            factors.append(f"Model Tokens: {', '.join(mr['xai_words'][:5])}")
        if mr.get("top_factors"):
            tf = mr["top_factors"]
            if isinstance(tf, list):
                factors.extend([str(item.get("label", item) if isinstance(item, dict) else item) for item in tf])

    return {
        "verdict": verdict,
        "decision": decision,
        "risk_score": max_score,
        "is_phishing": is_phishing,
        "threat_category": threat_category,
        "risk_factors": list(dict.fromkeys(factors)),
        "detected_by": [r.get("model", "ai_model") for r in threats],
        "modalities": modalities,
        "xai_evidence": {
            "text": [m["model_result"] for m in modalities if m["type"] == "text"],
            "urls": [m["model_result"] for m in modalities if m["type"] == "url"],
            "images": [m["model_result"] for m in modalities if m["type"] == "image"]
        },
        "contains_url": len(urls) > 0,
        "embedded_urls": urls,
        "sender_hash": sender_hash,
        "fingerprint": fingerprint,
        "chat_title": chat_title or "WhatsApp Chat",
    }
