"""
AegisOne WhatsApp Security Intelligence & Channel Router.
Passes incoming WhatsApp Web modalities (Text, Embedded URLs, Images) directly
into AegisOne's pre-trained core AI models:
- predict_text()   (text model M1)
- predict_url()    (URL model v10 + page/brand/reputation fusion)
- QR decoding + OCR for pictures (QR links go to the URL model)

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

from api.services.secret_store import get_pseudonym_key  # per-deployment key, not a source-code constant


def hmac_pseudonymize_sender(sender: str) -> str:
    """Generate deterministic HMAC-SHA256 hash for sender identifier to preserve privacy."""
    if not sender:
        return "anonymous_sender"
    clean = re.sub(r"[^\d+]", "", str(sender)).lower().strip()
    if not clean:
        clean = str(sender).strip().lower()
    return hmac.new(get_pseudonym_key(), clean.encode("utf-8"), hashlib.sha256).hexdigest()[:24]


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
    image_base64: str = "",
    urls: List[str] | None = None,
) -> Dict[str, Any]:
    """
    WhatsApp channel router. Everything runs on the organisation's own server:
      1. text   -> text model (M1, "sms" channel thresholds)
      2. links  -> URL model (links found in the text + the real destinations the browser extension resolved)
      3. image  -> QR codes (decoded, link -> URL model, other kinds by their risk) and OCR text -> text/URL models.
                   The website-screenshot model is NOT used on chat photos: it was trained on web pages, not photos.
    """
    import base64
    from api.services.content_router import route_image_input_detailed

    clean_text = (text or "").strip()[:4000]
    results: List[Dict[str, Any]] = []
    modalities: List[Dict[str, Any]] = []

    def add(kind: str, res: Dict[str, Any], **extra):
        if isinstance(res, dict) and "error" not in res:
            results.append(res)
            modalities.append({"type": kind, "model": res.get("model", kind), "score": _get_score_from_result(res),
                               "verdict": res.get("prediction", "legitimate"), "is_threat": _is_model_phishing(res),
                               "model_result": res, **extra})

    # 1. text
    if clean_text:
        try:
            add("text", await predict_text(clean_text))
        except Exception as err:
            logger.warning("WhatsApp text scan failed: %s", err)

    # 2. links (deduplicated, capped): typed in the message plus the resolved hrefs from the page
    urls_all: List[str] = []
    for u in extract_urls_from_text(clean_text) + [str(x).strip() for x in (urls or []) if str(x).strip()]:
        if u.lower().startswith(("http://", "https://")) and u not in urls_all:
            urls_all.append(u[:2000])
    urls_all = urls_all[:6]
    if urls_all:
        scanned = await asyncio.gather(*[predict_url(u) for u in urls_all], return_exceptions=True)
        for u, u_res in zip(urls_all, scanned):
            if isinstance(u_res, Exception):
                logger.warning("WhatsApp URL scan failed for %s: %s", u, u_res)
                continue
            add("url", u_res, url=u)
    urls = urls_all

    # 3. picture: QR codes and the words written in it
    if image_base64:
        try:
            raw = base64.b64decode(image_base64.split(",", 1)[-1], validate=False)
            if 0 < len(raw) <= 8 * 1024 * 1024:
                detailed = await route_image_input_detailed(raw)
                for r in detailed["results"]:
                    if r.get("model") == "image":
                        continue
                    add("qr" if r.get("from_qr") else "image_text", r)
        except Exception as err:
            logger.warning("WhatsApp image scan failed: %s", err)

    # Canonical Decision Logic: Consumes core models' predictions directly
    threats = [r for r in results if _is_model_phishing(r)]
    is_phishing = len(threats) > 0
    if not results and (clean_text or urls_all or image_base64):
        logger.warning("WhatsApp message could not be scored by any model")

    # Extract risk scores across modalities for analytics display
    scores = [_get_score_from_result(r) for r in results]
    max_score = max(scores, default=0)

    is_phishing = is_phishing or max_score >= 76
    verdict = "phishing" if is_phishing else ("suspicious" if max_score >= 51 else "safe")
    decision = "block" if is_phishing else ("warn" if max_score >= 51 else "allow")
    qr_threat = any(m["type"] == "qr" and m["is_threat"] for m in modalities)
    threat_category = ("MALICIOUS_QR" if qr_threat else
                       "MALICIOUS_LINK" if any(m["type"] == "url" and m["is_threat"] for m in modalities) else
                       "PHISHING_TEXT" if is_phishing else "SAFE")

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
        "contains_url": len(urls_all) > 0,
        "embedded_urls": urls_all,
        "sender_hash": sender_hash,
        "fingerprint": fingerprint,
        "chat_title": chat_title or "WhatsApp Chat",
    }
