"""
AegisOne API — Model Orchestrator
Loads all 4 AI models at startup and provides async inference methods.
Adapted from the working AIML/unified_server.py logic.

Performance optimizations:
- All inference runs in thread pool via asyncio.to_thread() (non-blocking)
- Global semaphore caps concurrent inference to prevent OOM
- CPU: no per-model locks (eval-mode models are thread-safe for reads)
- CUDA: single exclusive lock (GPU ops not safe for concurrent access)
- torch.inference_mode() replaces no_grad() (faster, less overhead)
- Configurable torch thread count for CPU workloads
"""
import os
import sys
import contextlib
import io
import string
import zlib
import asyncio
import threading
import logging
import importlib.util
import torch
import torch.nn as nn
import torch.quantization
import numpy as np
from PIL import Image
from transformers import DistilBertTokenizer
from torchvision import models, transforms
from urllib.parse import urlparse
import re

from api.config import (
    EMAIL_MODEL_PY, EMAIL_MODEL_PT,
    TEXT_MODEL_PY, TEXT_MODEL_PT,
    URL_MODEL_PY, URL_MODEL_PT, URL_MODEL_PT_FALLBACK,
    IMAGE_CONFIG_PY, IMAGE_MODEL_PT,
    ATTACHMENT_DIR, URL_CLASSES,
    INFERENCE_SEMAPHORE_LIMIT, TORCH_NUM_THREADS,
)

FAST_SCAN_MODE = os.environ.get("AEGIS_FAST_SCAN_MODE", "1") != "0"
# URLs go through the neural pipeline by default. The rules-only shortcut scored worse than chance
# on recent PhishTank URLs (AUC 0.19 vs 0.93, recall 1% vs 91%); set AEGIS_FAST_URL_MODE=1 only
# for load testing.
FAST_URL_MODE = os.environ.get("AEGIS_FAST_URL_MODE", "0") != "0"
from AIML.message.normalize import normalize_message
logger = logging.getLogger("aegisone.orchestrator")

# GLOBALS
# ═══════════════════════════════════════════════════════════════

DEVICE = torch.device("cuda" if torch.cuda.is_available() else "cpu")
MODELS: dict = {}
TOKENIZER: DistilBertTokenizer | None = None
IMAGE_TRANSFORM = None
IMAGE_THRESHOLD = 0.5
ATTACHMENT_ORCH = None

# Concurrency control
_inference_semaphore: asyncio.Semaphore | None = None
_cuda_lock = threading.Lock()  # Only used when DEVICE is CUDA


def _get_semaphore() -> asyncio.Semaphore:
    """Lazy-init the semaphore (must be created inside a running event loop)."""
    global _inference_semaphore
    if _inference_semaphore is None:
        _inference_semaphore = asyncio.Semaphore(INFERENCE_SEMAPHORE_LIMIT)
    return _inference_semaphore


@contextlib.contextmanager
def _inference_guard():
    """
    Context manager for safe model inference.
    - CPU: no lock needed — eval() models are thread-safe for concurrent reads.
      The semaphore alone caps parallelism to prevent OOM.
    - CUDA: exclusive lock required — GPU ops are NOT safe for concurrent access.
    """
    if DEVICE.type == "cuda":
        with _cuda_lock:
            with torch.inference_mode():
                yield
    else:
        with torch.inference_mode():
            yield


# ═══════════════════════════════════════════════════════════════
# MODULE LOADER
# ═══════════════════════════════════════════════════════════════

def _load_module(name: str, path: str):
    """Load a .py file as a module to avoid stdlib name collisions (e.g. 'email')."""
    spec = importlib.util.spec_from_file_location(name, path)
    mod = importlib.util.module_from_spec(spec)
    sys.modules[name] = mod
    spec.loader.exec_module(mod)
    return mod


# ═══════════════════════════════════════════════════════════════
# STARTUP
# ═══════════════════════════════════════════════════════════════

def load_all_models():
    """Load all AI models into memory. Called once at API startup."""
    global MODELS, TOKENIZER, IMAGE_TRANSFORM, IMAGE_THRESHOLD, ATTACHMENT_ORCH

    # Configure torch threading for CPU workloads
    if TORCH_NUM_THREADS > 0:
        torch.set_num_threads(TORCH_NUM_THREADS)
        try:
            torch.set_num_interop_threads(max(1, TORCH_NUM_THREADS // 2))
        except RuntimeError as e:
            logger.warning(f"Could not set interop threads (already initialized): {e}")
        try:
            torch.set_flush_denormal(True)
        except Exception:
            pass
        logger.info(f"Torch threads: intra={TORCH_NUM_THREADS}, inter={max(1, TORCH_NUM_THREADS // 2)}")

    logger.info("=" * 60)
    logger.info("    AegisOne — Loading AI Models")
    logger.info("=" * 60)
    logger.info(f"  Device: {DEVICE}")
    logger.info(f"  Inference semaphore limit: {INFERENCE_SEMAPHORE_LIMIT}")

    # Shared tokenizer
    logger.info("  Loading DistilBERT tokenizer...")
    TOKENIZER = DistilBertTokenizer.from_pretrained("distilbert-base-uncased")

    # ── 1. EMAIL MODEL ──
    if EMAIL_MODEL_PT.exists():
        try:
            mod = _load_module("aegis_email", str(EMAIL_MODEL_PY))
            model = mod.PhishingDetector()
            model.load_state_dict(torch.load(str(EMAIL_MODEL_PT), map_location=DEVICE), strict=False)
            model.to(DEVICE).eval()
            if DEVICE == "cpu":
                model = torch.quantization.quantize_dynamic(model, {torch.nn.Linear}, dtype=torch.qint8)
            MODELS["email"] = {"model": model, "extract_features": mod.extract_structured_features}
            logger.info("  ✓ Email AI loaded")
        except Exception as e:
            logger.error(f"  ✗ Email AI failed: {e}")
    else:
        logger.warning(f"  ✗ Email weights not found: {EMAIL_MODEL_PT}")

    # ── 2. TEXT MODEL ──
    if TEXT_MODEL_PT.exists():
        try:
            mod = _load_module("aegis_text", str(TEXT_MODEL_PY))
            model = mod.PhishingDetectorText()
            model.load_state_dict(torch.load(str(TEXT_MODEL_PT), map_location=DEVICE), strict=False)
            model.to(DEVICE).eval()
            if DEVICE == "cpu":
                model = torch.quantization.quantize_dynamic(model, {torch.nn.Linear}, dtype=torch.qint8)
            MODELS["text"] = {"model": model, "extract_features": mod.extract_general_text_features}
            logger.info("  ✓ Text AI loaded")
        except Exception as e:
            logger.error(f"  ✗ Text AI failed: {e}")
    else:
        logger.warning(f"  ✗ Text weights not found: {TEXT_MODEL_PT}")

    # ── 3. URL MODEL ──
    url_candidates = [URL_MODEL_PT]
    if URL_MODEL_PT_FALLBACK != URL_MODEL_PT:
        url_candidates.append(URL_MODEL_PT_FALLBACK)

    loaded_url = False
    for url_pt in url_candidates:
        if not url_pt.exists():
            continue
        try:
            mod = _load_module("aegis_url", str(URL_MODEL_PY))
            model, model_name = mod.load_url_detector(str(url_pt), DEVICE)
            from transformers import AutoTokenizer
            url_tokenizer = AutoTokenizer.from_pretrained(model_name)
            if DEVICE == "cpu":
                model = torch.quantization.quantize_dynamic(model, {torch.nn.Linear}, dtype=torch.qint8)
            MODELS["url"] = {
                "model": model,
                "tokenizer": url_tokenizer,
                "extract_features": mod.extract_url_numerical_features
            }
            # Store sanitize_url if available
            if hasattr(mod, "sanitize_url"):
                MODELS["url"]["sanitize"] = mod.sanitize_url
            # best_v7.pt was trained on structuralize_url() text + canonicalized numeric features.
            # Serving must reproduce that exactly (AEGIS_URL_PREP=raw only for A/B experiments).
            if "v7" in url_pt.name.lower() and os.environ.get("AEGIS_URL_PREP", "auto") != "raw":
                from AIML.url import v7_features as _v7
                MODELS["url"]["prep"] = _v7.structuralize_url
                MODELS["url"]["extract_features"] = _v7.extract_url_numerical_features
                logger.info("  URL AI: using v7 training-identical preprocessing")
            logger.info(f"  ✓ URL AI loaded from {url_pt.name} (base: {model_name})")
            loaded_url = True
            break
        except Exception as e:
            logger.error(f"  ✗ URL AI failed from {url_pt}: {e}")
    if not loaded_url and any(path.exists() for path in url_candidates):
        logger.warning("  URL AI unavailable: checkpoint loading failed; see errors above.")
    elif not loaded_url:
        logger.warning(f"  ✗ URL weights not found: {URL_MODEL_PT} or {URL_MODEL_PT_FALLBACK}")

    # ── 4. IMAGE MODEL ──
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
            if DEVICE == "cpu":
                model = torch.quantization.quantize_dynamic(model, {torch.nn.Linear}, dtype=torch.qint8)

            IMAGE_TRANSFORM = transforms.Compose([
                transforms.Resize((cfg.IMAGE_SIZE, cfg.IMAGE_SIZE)),
                transforms.ToTensor(),
                transforms.Normalize([0.485, 0.456, 0.406], [0.229, 0.224, 0.225]),
            ])
            MODELS["image"] = {"model": model}
            logger.info(f"  ✓ Image AI loaded (threshold={IMAGE_THRESHOLD:.3f})")
        except Exception as e:
            logger.error(f"  ✗ Image AI failed: {e}")
    else:
        logger.warning(f"  ✗ Image weights not found: {IMAGE_MODEL_PT}")

    # ── 5. ATTACHMENT ORCHESTRATOR ──
    try:
        sys.path.insert(0, str(ATTACHMENT_DIR))
        att_mod = _load_module("aegis_attachment", str(ATTACHMENT_DIR / "attachment_orchestrator.py"))
        ATTACHMENT_ORCH = att_mod.AttachmentOrchestrator()
        logger.info("  ✓ Attachment Orchestrator loaded")
    except Exception as e:
        logger.error(f"  ✗ Attachment Orchestrator failed: {e}")

    # ── 5a. URL v8: gte-small fine-tuned on PhreshPhish (AIML/url/kaggle/train_url_v8.py). Replaces the v7 network's
    # probability inside the same fusion when present; AEGIS_URL_ENGINE=v7 switches back.
    # The newest installed transformer generation wins (v9 = v8 + long-tail web data); AEGIS_URL_MODEL_DIR overrides.
    _url_root = os.path.join(os.path.dirname(__file__), "..", "..", "AIML", "url")
    v8_dir = os.environ.get("AEGIS_URL_MODEL_DIR") or next(
        (os.path.join(_url_root, g) for g in ("v10", "v9", "v8") if os.path.exists(os.path.join(_url_root, g, "calibration.json"))),
        os.path.join(_url_root, "v8"))
    if _url_engine() in ("transformer", "ensemble") and os.path.exists(os.path.join(v8_dir, "calibration.json")):
        try:
            import json as _json
            from transformers import AutoModelForSequenceClassification, AutoTokenizer
            cal = _json.load(open(os.path.join(v8_dir, "calibration.json")))
            if cal.get("arch") == "urlnet_v10":
                # v10: structured registered-domain input + Punycode/confusable normalisation + character CNN
                from AIML.url import urlnet_v10
                m8, tok8, cal = urlnet_v10.load(v8_dir, "cpu")
            else:
                m8 = AutoModelForSequenceClassification.from_pretrained(v8_dir).eval()
                tok8 = AutoTokenizer.from_pretrained(v8_dir)
            if DEVICE.type == "cpu":
                m8 = torch.quantization.quantize_dynamic(m8, {torch.nn.Linear}, dtype=torch.qint8)
            MODELS["url_v8"] = {"model": m8.to(DEVICE), "tokenizer": tok8, "cal": cal,
                                "generation": os.path.basename(os.path.normpath(v8_dir))}
            logger.info(f"  ✓ URL transformer {MODELS['url_v8']['generation']} loaded ({cal.get('base_model')}, trained {cal.get('trained')})")
        except Exception as e:
            logger.error(f"  ✗ URL v8 failed, using v7: {e}")

    # ── 5a'. Page model P1: URL + compact page summary, for pages that ask for credentials (AIML/url/kaggle/p1)
    p1_dir = os.environ.get("AEGIS_PAGE_MODEL_DIR") or os.path.join(_url_root, "page_p1")
    if os.environ.get("AEGIS_PAGE_MODEL", "1") != "0" and os.path.exists(os.path.join(p1_dir, "calibration.json")):
        try:
            from AIML.url import urlnet_v10
            mp, tokp, calp = urlnet_v10.load(p1_dir, "cpu")
            if DEVICE.type == "cpu":
                mp = torch.quantization.quantize_dynamic(mp, {torch.nn.Linear}, dtype=torch.qint8)
            MODELS["page_p1"] = {"model": mp.to(DEVICE), "tokenizer": tokp, "cal": calp}
            logger.info(f"  ✓ Page model P1 loaded (trained {calp.get('trained')})")
        except Exception as e:
            logger.error(f"  ✗ Page model P1 failed, URL-only: {e}")

    # ── 5b. SHIPPED URL HEADS: a refreshed feature_mlp + classifier for the unchanged URL backbone
    # (AIML/eval/refresh_url_heads.py). AEGIS_URL_HEADS=<path> tries other heads; =base keeps the original ones.
    if "url" in MODELS:
        shipped = os.path.join(os.path.dirname(__file__), "..", "..", "AIML", "url", "heads_shipped.pt")
        choice = os.environ.get("AEGIS_URL_HEADS", "")
        path = None if choice == "base" else (choice or (shipped if os.path.exists(shipped) else None))
        if path and apply_head_weights(path, f"url-heads:{os.path.basename(path)}"):
            logger.info(f"  ✓ URL heads applied from {os.path.basename(path)}")

    # ── 6. V2 E-MAIL / TEXT DETECTORS (frozen sentence embeddings + trained head, AIML/embed_head.py) ──
    load_v2_heads()
    load_m1()

    loaded = [k for k in MODELS if k != "attachment_orch"]
    logger.info("=" * 60)
    logger.info(f"   {len(loaded)}/4 AI models loaded on {DEVICE}" + (f" + v2 heads: {', '.join(V2_HEADS)}" if V2_HEADS else ""))
    logger.info("=" * 60)


# v2 detectors: {"email": EmbedHead, "text": EmbedHead}. Used instead of the legacy networks when present;
# AEGIS_EMAIL_ENGINE / AEGIS_TEXT_ENGINE = "legacy" switches back without a code change.
V2_HEADS: dict = {}
V2_DIR = {"email": os.path.join(os.path.dirname(__file__), "..", "..", "AIML", "email", "v2"),
          "text": os.path.join(os.path.dirname(__file__), "..", "..", "AIML", "text_general", "v2")}


def _v2_featurizer(kind: str):
    if kind == "email":
        from AIML.email.features_v2 import email_features
        return email_features
    from AIML.text_general.features_v2 import text_features
    return text_features


M1: dict = {}     # message model M1 (e-mail + SMS + chat, AIML/message): {"net", "tok", "cal"}
M1_INTENT_TEXT = {
    "urgency": "pressure to act immediately", "credential_request": "asks for a password, PIN or personal details",
    "payment_request": "asks for money or a payment", "secrecy": "asks you to keep it secret",
    "reward_lure": "promises a prize or refund", "share_lure": "pushes you to open a shared file",
    "code_request": "asks you to send back a code", "authority_claim": "claims to be a bank or authority",
    "link_mismatch": "links to a site that is not the sender's"}


def _message_engine() -> str:
    """AEGIS_MESSAGE_ENGINE: m1 (default: ONE text model for e-mail, SMS and chat), ensemble (M1 averaged with the v2 head),
    v2 (frozen-embedding heads only). An organisation's own retrained head (8.11) is blended in automatically once active."""
    return os.environ.get("AEGIS_MESSAGE_ENGINE", "m1").lower()


def _m1_dir() -> str:
    return os.environ.get("AEGIS_MESSAGE_MODEL_DIR") or os.path.join(os.path.dirname(__file__), "..", "..", "AIML", "message", "m1")


def _m1_installed() -> bool:
    return _message_engine() != "v2" and os.path.exists(os.path.join(_m1_dir(), "calibration.json"))


def load_m1() -> None:
    """Load the unified message model if it is installed (AIML/message/m1) and AEGIS_MESSAGE_ENGINE allows it."""
    M1.clear()
    d = _m1_dir()
    if not _m1_installed():
        return
    try:
        from AIML.message import net as mnet
        net, tok, cal = mnet.load(d, "cpu")
        if DEVICE.type == "cpu":
            net = torch.quantization.quantize_dynamic(net, {torch.nn.Linear}, dtype=torch.qint8)
        M1.update({"net": net.to(DEVICE), "tok": tok, "cal": cal})
        logger.info(f"  ✓ message model M1 loaded (trained {cal.get('trained')})")
    except Exception as e:
        logger.error(f"  ✗ message model M1 failed, using the v2 detectors: {e}")
        M1.clear()


def _m1_risk(channel: str, sender: str, subject: str, body: str, history=None, kind: str = "email"):
    """(risk on the product scale, {intent: probability}) from M1. 0.35 / 0.51 / 0.76 = suspicious / WARN / BLOCK, the
    1%- and 0.1%-false-alarm points of THIS channel's legitimate traffic. An organisation's own retrained v2 head
    (8.11) is blended in 50/50, so retraining keeps its effect."""
    from AIML.message import net as mnet, context as mctx
    with torch.inference_mode():
        lg, ig = M1["net"](**mnet.encode(M1["tok"], [(channel, sender, subject, body, history)], DEVICE, prefix=M1["cal"].get("prefix", "query: ")))
    cal = M1["cal"]
    p = float(torch.sigmoid((lg[0, 1] - lg[0, 0]).float() / float(cal.get("temperature", 1.0))))
    th = cal["thresholds"].get(channel) or next(iter(cal["thresholds"].values()))
    if channel == "email" and os.environ.get("AEGIS_M1_EMAIL_STRICT", "1") == "1":
        # a fine-tuned network is over-confident outside its training corpora: use its 0.1%-false-alarm point as WARN
        th = {"suspicious": th["warn"], "warn": th["block"], "block": th["block"] + (1.0 - th["block"]) * 0.5}
    risk = float(np.interp(p, [0.0, th["suspicious"], th["warn"], max(th["block"], th["warn"] + 1e-6), 1.0], [0.0, 0.35, 0.51, 0.76, 1.0]))
    intents = {k: round(float(v), 3) for k, v in zip(mctx.INTENTS, torch.sigmoid(ig[0].float()).tolist())}
    if kind in V2_HEADS and (_message_engine() == "ensemble" or getattr(V2_HEADS[kind], "is_org", False)):
        # Blend with the v2 head: always when AEGIS_MESSAGE_ENGINE=ensemble, and by default only for an organisation's own
        # retrained head (so 8.11 keeps its effect while the shipped product scores with ONE text model).
        # Measured: M1 alone ranks as well as v2 but is over-confident outside its training corpora (12.5% false alarms on
        # hand-written mail at its own threshold); the average has v2's calibration and M1's recall.
        h = V2_HEADS[kind]
        text = (str(subject or "") + "\n" + str(body or ""))[:3000] if kind == "email" else str(body or "")
        feats = _v2_featurizer(kind)(sender, subject, body) if kind == "email" else _v2_featurizer(kind)(body)
        risk = 0.5 * risk + 0.5 * float(h.risk_from_design(h.design([text], feats[None, :]))[0])
    return risk, intents


def _m1_reasons(intents: dict) -> list:
    return [M1_INTENT_TEXT[k] for k, v in sorted(intents.items(), key=lambda kv: -kv[1]) if v >= 0.5 and k in M1_INTENT_TEXT][:4]


def load_v2_heads(override: dict | None = None) -> None:
    """Load the shipped v2 heads (or the organisation's active ones: override = {kind: head.json path})."""
    from AIML.embed_head import load as _load_head
    for kind in ("email", "text"):
        if os.environ.get(f"AEGIS_{kind.upper()}_ENGINE", "v2").lower() != "v2":
            V2_HEADS.pop(kind, None)
            continue
        path = (override or {}).get(kind) or os.path.join(V2_DIR[kind], f"{kind}_head.json")
        try:
            h = _load_head(path, _v2_featurizer(kind))
            if h is not None:
                h.is_org = bool((override or {}).get(kind))
                if _message_engine() != "m1" or not _m1_installed():
                    h.backbone  # load the embedding model now, not on the first request (skipped when M1 alone scores messages)
                V2_HEADS[kind] = h
                logger.info(f"  ✓ {kind} v2 detector loaded ({h.spec.get('meta', {}).get('version', 'base')})")
        except Exception as e:
            logger.error(f"  ✗ {kind} v2 detector failed, using the legacy model: {e}")
            V2_HEADS.pop(kind, None)


def apply_v2_head(kind: str, head_path: str | None, version_tag: str) -> bool:
    """Activate an organisation head (or the shipped one when head_path is None), swapping atomically."""
    from AIML.embed_head import load as _load_head
    try:
        path = head_path or os.path.join(V2_DIR[kind], f"{kind}_head.json")
        h = _load_head(path, _v2_featurizer(kind))
        if h is None:
            return False
        h.is_org = head_path is not None            # an organisation's own head is blended with M1 (8.11)
        old = V2_HEADS.get(kind)
        if old is not None and old.spec.get("backbone") == h.spec.get("backbone"):
            h._bb = old._bb
        V2_HEADS[kind] = h
        if kind in MODELS:
            MODELS[kind]["active_version"] = version_tag
        logger.info("%s v2 head switched to %s", kind, version_tag)
        return True
    except Exception as e:
        logger.error("Could not apply %s head %s: %s", kind, version_tag, e)
        return False


_FEATURE_PHRASES = {
    "url_host_not_sender": "a link that goes to a different site than the sender's",
    "url_ip_host": "a link to a raw IP address", "url_shortener": "a shortened link that hides where it goes",
    "url_bad_tld": "a link on a cheap, often-abused domain ending", "url_punycode": "a look-alike (punycode) web address",
    "url_brand_in_host": "a brand name inside an unrelated web address", "sender_freemail": "a free-mail sender address",
    "sender_display_brand_mismatch": "a sender name that claims a brand the address does not belong to",
    "sender_domain_bad_tld": "a sender on an often-abused domain ending", "urgency": "pressure to act quickly",
    "cred_ask": "a request for a password, PIN or code", "pay_ask": "a request for money, payment or bank details",
    "secrecy": "a request to keep it secret or not to call", "reward": "a prize, refund or reward lure",
    "share_lure": "a 'shared document' lure", "urgency_and_cred": "urgent request for login details",
    "pay_and_secrecy": "secret, urgent payment request (CEO-fraud pattern)", "attachment_mention": "an attachment to open",
    "has_url": "a link", "has_phone": "a phone number to call", "has_money": "an amount of money",
    "ask_code": "a request to send a verification code", "ask_secret": "a request for a PIN, password or CNIC",
    "ask_money": "a request to send money or a fee", "authority": "a claim to be a bank, PTA, FBR, NADRA or support team",
    "wrong_send_story": "a 'sent to you by mistake' story", "url_and_urgency": "a link together with pressure to act",
    "secret_and_urgency": "an urgent request for secret details", "reward_and_fee": "a prize that needs a fee first",
}


def _v2_explain(head, x) -> list[str]:
    out = []
    for c in head.contributions(x, top=4):
        phrase = _FEATURE_PHRASES.get(c["feature"])
        if phrase and phrase not in out:
            out.append(phrase)
    return out


def get_model_status() -> dict:
    return {
        "email": {"status": "online" if "email" in MODELS else "offline", "loaded": "email" in MODELS},
        "text": {"status": "online" if "text" in MODELS else "offline", "loaded": "text" in MODELS},
        "url": {"status": "online" if "url" in MODELS else "offline", "loaded": "url" in MODELS},
        "image": {"status": "online" if "image" in MODELS else "offline", "loaded": "image" in MODELS},
    }


# ═══════════════════════════════════════════════════════════════
# XAI HELPERS
# ═══════════════════════════════════════════════════════════════

_SPECIAL_TOKENS = {"[cls]", "[sep]", "[pad]", "http", "https", "www", "com"}
_TEXT_SAFE_LENGTH = 160
_TEXT_RISK_KEYWORDS = {
    "verify", "verification", "password", "passwd", "suspended", "urgent",
    "immediately", "login", "signin", "bank", "account", "security",
    "reset", "expired", "unlock", "invoice", "payment", "gift card",
    "office365", "microsoft", "okta", "docusign", "sharepoint",
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
    
    # Ignore generic browser UI / accessibility snippets
    if any(ui_kw in text_lower for ui_kw in ["skip to main content", "accessibility help", "choose your city", "keyboard shortcuts", "cookies policy"]):
        return {
            "prediction": "legitimate",
            "confidence": 0.98,
            "phishing_probability": 0.02,
            "model": "text",
            "xai_words": [],
            "explanation": "Standard UI / navigation element",
        }

    has_url = bool(re.search(r"https?://|www\.", text_lower))
    
    # High-confidence credential harvesting / urgency solicitation patterns
    credential_solicit = any(cs in text_lower for cs in ["enter your password", "confirm your password", "verify your account", "account suspended", "sign in to continue", "log in to your account", "update billing", "urgent action required"])
    
    keyword_hits = [kw for kw in _TEXT_RISK_KEYWORDS if kw in text_lower]
    urgency_hits = sum(1 for kw in ("urgent", "immediately", "action required", "verify") if kw in text_lower)

    # Require strong solicitation signals OR URL + multiple risk keywords before flagging
    if credential_solicit or (has_url and urgency_hits >= 1 and len(keyword_hits) >= 1) or (len(keyword_hits) >= 2 and urgency_hits >= 1):
        return {
            "prediction": "phishing",
            "confidence": 0.985,
            "phishing_probability": 0.94,
            "model": "text",
            "xai_words": keyword_hits[:3],
            "explanation": "Credential harvesting / phishing solicitation in text",
        }

    if len(text) <= _TEXT_SAFE_LENGTH and not has_url and not credential_solicit:
        return {
            "prediction": "legitimate",
            "confidence": 0.97,
            "phishing_probability": 0.03,
            "model": "text",
            "xai_words": [],
            "explanation": "Heuristic low-risk text snippet",
        }

    return None


def extract_url_features(url: str) -> dict:
    """
    AegisOne Feature Extraction & Signal Correlation Engine.
    Extracts structured, weighted security signals across:
    1. Domain Features (Punycode, Subdomains, Entropy, Brand Similarity, Hyphenation, TLD)
    2. URL Path & Query Features (Keywords, Obfuscation, Insecure HTTP, Executable Ext)
    3. Reputation & Whitelist Layer
    """
    try:
        # Bypass removed per architectural requirements.
        parsed = urlparse(url)
        domain = parsed.netloc.lower()
        if domain.startswith("www."):
            domain = domain[4:]

        if not domain and " " not in url and "." in url:
            parsed = urlparse("http://" + url)
            domain = parsed.netloc.lower()
            if domain.startswith("www."):
                domain = domain[4:]

        path_query = (parsed.path + "?" + parsed.query).lower()
        signals = []
        raw_score = 0


        # Signal 1: Raw IP Hostname
        if re.match(r"^\d+\.\d+\.\d+\.\d+$", domain):
            raw_score += 35
            signals.append({"signal": "ip_hostname", "severity": 0.35, "evidence": f"Host is raw IP address: {domain}"})

        # Signal 2: Punycode IDN Homograph
        if "xn--" in domain:
            raw_score += 30
            signals.append({"signal": "punycode_spoofing", "severity": 0.30, "evidence": "Host uses IDN Punycode character encoding"})

        # Signal 3: Suspicious TLD
        suspicious_tlds = {
            ".tk", ".ml", ".ga", ".cf", ".gq", ".xyz", ".top", ".cc",
            ".ru", ".link", ".click", ".zip", ".work",
            ".online", ".site", ".live", ".today", ".world", ".fun",
            ".shop", ".store", ".tech",
        }
        for tld in suspicious_tlds:
            if domain.endswith(tld):
                raw_score += 15
                signals.append({"signal": "suspicious_tld", "severity": 0.15, "evidence": f"Domain uses high-risk TLD: {tld}"})
                break

        # Signal 4: Subdomain Depth & Hyphenation
        subdomains = [p for p in domain.split(".") if p and p != "www"]
        if len(subdomains) > 3:
            depth_weight = (len(subdomains) - 3) * 10
            raw_score += depth_weight
            signals.append({"signal": "subdomain_depth", "severity": depth_weight / 100.0, "evidence": f"Excessive subdomain depth ({len(subdomains)} levels)"})

        hyphen_count = domain.count("-")
        if hyphen_count >= 2:
            raw_score += 10
            signals.append({"signal": "hyphenated_domain", "severity": 0.10, "evidence": f"Multiple hyphens in domain name ({hyphen_count} hyphens)"})

        # Signal 5: Brand Impersonation Check (with Homoglyph & Typosquat cleaning)
        from AIML.url.brand_engine import clean_homoglyphs
        cleaned_domain = clean_homoglyphs(domain)
        dehyphenated_domain = cleaned_domain.replace("-", "")

        target_brands = [
            # Finance
            "paypal", "chase", "wellsfargo", "bankofamerica", "citibank", "capitalone",
            "hsbc", "barclays", "americanexpress", "amex", "stripe",
            # Tech
            "microsoft", "google", "apple", "amazon", "github", "openai", "chatgpt",
            # Crypto
            "metamask", "trustwallet", "binance", "coinbase", "kraken", "kucoin",
            "blockchain", "opensea",
            # Social / SaaS
            "facebook", "instagram", "linkedin", "twitter", "discord", "slack",
            "telegram", "snapchat", "tiktok", "twitch", "spotify",
            # Media & Storage
            "netflix", "dropbox", "trello", "zoom", "youtube",
            # Gaming
            "steam", "epicgames", "roblox",
            # Logistics
            "dhl", "fedex", "ups", "usps",
            # ISP
            "comcast", "xfinity", "yahoo",
        ]
        _found_brand_impersonation = False
        for brand in target_brands:
            if brand in cleaned_domain and not domain.endswith(f"{brand}.com") and not domain.endswith(f"{brand}.ai") and not domain.endswith(f"{brand}.org") and not domain.endswith(f"{brand}.net"):
                raw_score += 35
                signals.append({"signal": "brand_impersonation", "severity": 0.35, "evidence": f"Brand token '{brand}' found in non-canonical domain: {domain}"})
                _found_brand_impersonation = True
                break

        if not _found_brand_impersonation:
            for brand in target_brands:
                if brand in dehyphenated_domain and not dehyphenated_domain.endswith(f"{brand}.com") and not dehyphenated_domain.endswith(f"{brand}.ai") and not dehyphenated_domain.endswith(f"{brand}.org") and not dehyphenated_domain.endswith(f"{brand}.net"):
                    raw_score += 35
                    signals.append({"signal": "brand_impersonation", "severity": 0.35, "evidence": f"Brand token '{brand}' found in dehyphenated non-canonical domain: {domain}"})
                    _found_brand_impersonation = True
                    break

        # Signal 6: Insecure HTTP Protocol
        if parsed.scheme == "http" and domain not in ("localhost", "127.0.0.1"):
            raw_score += 15
            signals.append({"signal": "insecure_http", "severity": 0.15, "evidence": "Unencrypted HTTP protocol"})

        # Signal 7: Credential & Sensitive Path Keywords
        credential_keywords = (
            # Classic
            "login", "signin", "verify", "verification", "password", "account", "banking", "secure", "security", "update", "upgrade", "portal", "access",
            # Action-lure
            "unlock", "restore", "recovery", "reset", "reactivate", "suspended", "resolve", "apply", "interview", "confirm", "support",
            # Crypto
            "wallet", "seed", "phrase", "backup", "mnemonic",
            # Reward-scam
            "claim", "redeem", "gift", "reward", "free", "nitro", "skins", "vbucks",
            # Delivery
            "tracking", "delivery", "shipment", "package",
            # Identity / access
            "auth", "credential", "badge", "invite", "member", "cardmember",
        )
        kw_hits = [kw for kw in credential_keywords if kw in path_query or kw in domain]
        _found_credential_lure = bool(kw_hits)
        if kw_hits:
            has_brand_or_http = any(s["signal"] in ("brand_impersonation", "insecure_http", "suspicious_tld") for s in signals)
            kw_weight = 20 if has_brand_or_http else 8
            raw_score += kw_weight
            signals.append({"signal": "credential_keywords", "severity": kw_weight / 100.0, "evidence": f"Sensitive path keywords: {', '.join(kw_hits[:3])}"})

        # Signal 8: URL Obfuscation (@ symbol or hex path)
        if "@" in parsed.netloc or "%" in parsed.path:
            raw_score += 20
            signals.append({"signal": "url_obfuscation", "severity": 0.20, "evidence": "URL contains user-info @ symbol or hex-encoded path"})

        # Brand Impersonation & High-Confidence Lure Compounding
        if _found_brand_impersonation:
            has_corroborating_lure = _found_credential_lure or any(s["signal"] == "suspicious_tld" for s in signals)
            if has_corroborating_lure:
                raw_score = max(raw_score, 85)

        final_score = min(100, max(0, raw_score))
        prob = round(final_score / 100.0, 3)
        verdict = "danger" if final_score >= 80 else "warning" if final_score >= 50 else "safe"
        prediction = "phishing" if final_score >= 50 else "legitimate"

        return {
            "prediction": prediction,
            "confidence": round(0.5 + (abs(prob - 0.5)), 2),
            "phishing_probability": prob,
            "category": "High Risk" if final_score >= 80 else "Suspicious" if final_score >= 50 else "Safe",
            "model": "url_feature_extractor",
            "score": final_score,
            "verdict": verdict,
            "signals": signals,
            "explanation": f"Feature Correlation Engine evaluated {len(signals)} risk signals ({final_score}% risk)",
            "brand_impersonation": _found_brand_impersonation,
            "credential_lure_detected": _found_credential_lure,
            "suspicious_tld": any(s["signal"] == "suspicious_tld" for s in signals),
            "evidence": {
                "signal_count": len(signals),
                "signals": [s["evidence"] for s in signals]
            }
        }
    except Exception as e:
        return {
            "prediction": "legitimate",
            "confidence": 0.99,
            "phishing_probability": 0.01,
            "category": "Safe",
            "model": "url_feature_extractor",
            "score": 0,
            "verdict": "safe",
            "signals": [],
            "explanation": f"Feature extraction fallback ({e})"
        }


def _heuristic_url_result(url: str) -> dict | None:
    try:
        return extract_url_features(url)
    except Exception:
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


# ═══════════════════════════════════════════════════════════════
# SYNCHRONOUS INFERENCE (internal — run inside thread pool)
# ═══════════════════════════════════════════════════════════════

def _email_scam_signals(subject: str, body: str) -> list:
    """High-precision e-mail rules (advance-fee, credential threat, CEO fraud). Shared by both e-mail engines."""
    # Advance fee / donation / inheritance scams
    # Scan both body AND subject for maximum recall
    combined_lower = (body + " " + subject).lower()
    scam_signals = []

    if any(k in combined_lower for k in [
        "passed away", "late husband", "late wife", "terminal", "cancer",
        "bequest", "inheritance", "deceased", "widow", "widower",
        "battled cancer", "medical professionals", "specialist hospital",
        "christine murphy", "66-year-old", "canadian citizen", "respected businessman"
    ]):
        scam_signals.append("inheritance/terminal illness narrative")

    if any(k in combined_lower for k in [
        "usd", "million", "billion", "35,565", "10,000,000", "funds",
        "$35,", "$10,", "$5,", "$1,", "35 million", "10 million",
        "large sum", "total amount"
    ]):
        scam_signals.append("large financial sum promise")

    if any(k in combined_lower for k in [
        "humanitarian", "charitable", "orphanage", "donate", "donation",
        "disadvantaged", "physical disabilities", "vulnerable groups",
        "philanthropist", "charitable causes", "good cause"
    ]):
        scam_signals.append("charity/humanitarian distribution proposal")

    if any(k in combined_lower for k in [
        "30%", "20%", "40%", "35%", "25%", "token of appreciation",
        "percentage", "in return for your", "allocate", "reward",
        "as compensation", "commission"
    ]):
        scam_signals.append("percentage reward offer")

    if any(k in combined_lower for k in [
        "found your email", "internet search", "contact you regarding",
        "matter of great importance", "oversee and coordinate",
        "provide further details", "reply to this email"
    ]):
        scam_signals.append("cold-contact solicitation pattern")

    # Credential-harvesting phishing ("your account will be suspended, verify your password").
    # The rules above only describe advance-fee scams, so this far more common kind got no help
    # when the neural score came back low. Deliberately conservative: it needs BOTH an
    # urgency/account-threat phrase AND a request for credentials or payment details, so ordinary
    # notifications ("your order shipped", "meeting notes") never match.
    _urgency = any(k in combined_lower for k in [
        "will be suspended", "has been suspended", "account suspended", "will be locked", "has been locked",
        "will be closed", "unusual activity", "suspicious activity", "unauthorized login", "unauthorised login",
        "within 24 hours", "within 48 hours", "act now", "action required", "urgent action", "final notice",
    ])
    _cred_ask = any(k in combined_lower for k in [
        "verify your password", "confirm your password", "enter your password", "your password",
        "login credentials", "verify your account", "verify your identity", "confirm your identity",
        "update your payment", "update your billing", "card number", "social security", "one-time code",
        "bank details", "account details", "sign in to verify", "log in to verify",
    ])
    if _urgency and _cred_ask:
        scam_signals.append("urgent account-threat language")
        scam_signals.append("request for password or account details")
        if "http://" in combined_lower or "https://" in combined_lower or "click here" in combined_lower:
            scam_signals.append("link to a verification page")

    # Business e-mail compromise ("CEO fraud"): a request to pay or buy untraceable value, wrapped in
    # secrecy or urgency, usually with no link at all, so link and wording models both miss it. Needs
    # BOTH halves, so an ordinary "please approve the invoices" never matches.
    _pay_ask = any(k in combined_lower for k in [
        "gift card", "gift cards", "itunes card", "google play card", "steam card", "wire transfer", "wire the funds",
        "wire me", "bitcoin", "send me the codes", "scratch off", "change of bank account", "new bank account",
        "updated bank details", "new banking details",
    ])
    _secrecy = any(k in combined_lower for k in [
        "confidential", "keep this between", "keep it quiet", "don't tell", "do not tell", "can't talk", "cannot talk",
        "in a meeting", "reply only to me", "reply to me only", "do not call", "don't call", "urgent", "right away", "asap",
        "before the end of the day", "today",
    ])
    if _pay_ask and _secrecy:
        scam_signals.append("payment request with secrecy or urgency (CEO-fraud pattern)")

    return scam_signals


def _predict_email_v2(sender: str, subject: str, body: str) -> dict:
    """v2 e-mail detector: frozen sentence embedding + calibrated head, with the high-precision rules as a floor."""
    h = V2_HEADS.get("email")
    if M1:
        prob, intents = _m1_risk("email", sender, subject, body, kind="email")
        m1_reasons = _m1_reasons(intents)
    else:
        feats = _v2_featurizer("email")(sender, subject, body)
        x = h.design([(str(subject or "") + "\n" + str(body or ""))[:3000]], feats[None, :])
        prob = float(h.risk_from_design(x)[0])   # product scale: 0.51 = WARN (1% of legitimate mail), 0.76 = BLOCK (0.1%)
        intents, m1_reasons = None, None
    scam_signals = _email_scam_signals(subject or "", body or "")
    # The keyword rules are explanations, not a score: measured on 1,056 legitimate e-mails (AIML/eval, 2026-11-01)
    # single rules fired on 25% of LLM-written corporate mail ("percentage reward", "CEO-fraud pattern" more often on
    # legitimate than on phishing mail). Three or more independent rules never fired on legitimate mail, so only then
    # do they set a BLOCK-level floor.
    if len(scam_signals) >= 3:
        prob = max(prob, 0.76)
    reasons = (m1_reasons if M1 else _v2_explain(h, x[0])) + [s for s in scam_signals]
    is_phish = prob >= 0.5
    return {
        "prediction": "phishing" if is_phish else "legitimate",
        "confidence": round(prob if is_phish else 1 - prob, 4),
        "phishing_probability": round(prob, 4),
        "model": "email",
        "model_version": MODELS.get("email", {}).get("active_version") or ("m1" if M1 else h.spec.get("meta", {}).get("version", "email_v2")),
        "engine": (_message_engine() if M1 else "v2"),
        "intents": intents,
        "xai_words": reasons,
        "explanation": (f"AI flagged: {', '.join(reasons[:4])}" if is_phish and reasons
                        else "AI found the wording and links consistent with ordinary mail" if not is_phish
                        else "AI identified a phishing pattern in the message as a whole"),
        "scam_signals": scam_signals,
    }


def _predict_email_sync(sender: str, subject: str, body: str, include_xai: bool = False) -> dict:
    subject, body = normalize_message(subject), normalize_message(body)
    if M1 or "email" in V2_HEADS:
        return _predict_email_v2(sender, subject, body)
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

    combined_lower = (body + " " + subject).lower()
    scam_signals = _email_scam_signals(subject, body)

    # Dynamic probability scaling based on neural inference + scam signals
    if len(scam_signals) > 0:
        base_boost = 0.52 + (len(scam_signals) * 0.12)
        # zlib.crc32 instead of Python's built-in hash(): string hashing is randomized per
        # process (PYTHONHASHSEED, for hash-flood protection) by design, so the same email
        # text used to get a different "variance" - and therefore a different risk score -
        # on every server restart. crc32 is deterministic, so the same email always scores
        # the same way regardless of when the server last restarted.
        variance = (zlib.crc32(combined_lower.encode("utf-8")) % 9) / 100.0  # Dynamic variance (0-8%)
        prob = min(0.97, max(prob, base_boost + variance))
    else:
        # If no scam signals detected and raw model probability is in uncalibrated neutral band (0.40-0.60):
        # Calibrate for standard benign notification/informational emails (2% - 18% risk)
        if 0.40 <= prob <= 0.60:
            prob = max(0.02, min(0.18, (prob - 0.40) * 0.8))

    is_phish = prob >= 0.5
    xai_words = []
    if _should_extract_xai(include_xai):
        tokens = TOKENIZER.convert_ids_to_tokens(enc["input_ids"][0])
        xai_words = _get_attention_xai(m["model"], tokens, enc["attention_mask"][0])
    if scam_signals:
        xai_words.extend([s for s in scam_signals if s not in xai_words])

    explanation = (f"AI flagged suspicious email indicators: {', '.join(xai_words)}"
                   if xai_words else "AI identified suspicious context structure")
    
    active_version = m.get("active_version", "email_base_v1")
    
    return {
        "prediction": "phishing" if is_phish else "legitimate",
        "confidence": round(prob if is_phish else 1 - prob, 4),
        "phishing_probability": round(prob, 4),
        "model": "email",
        "model_version": active_version,
        "xai_words": xai_words,
        "explanation": explanation,
        "scam_signals": scam_signals,
    }


def apply_adapter_weights(model_type: str, adapter_path: str, version_tag: str) -> bool:
    """
    Dynamically loads and applies trained adapter weights into the in-memory AI model.
    """
    if model_type not in MODELS:
        logger.warning(f"Cannot reload model adapter for {model_type}: model not loaded in memory")
        return False

    # Local learning adapters are a tiny correction applied AFTER the unmodified base model
    # (api/services/calibration.py) - the base weights are never overwritten, so revoking an adapter
    # simply removes the correction.
    from api.services import calibration
    if calibration.load_from_artifact(model_type, adapter_path, version_tag):
        MODELS[model_type]["active_version"] = version_tag
        MODELS[model_type]["active_adapter_path"] = adapter_path
        return True

    weights_file = os.path.join(adapter_path, "adapter_weights.pt")
    if os.path.exists(weights_file):
        try:
            state_dict = torch.load(weights_file, map_location=DEVICE)
            MODELS[model_type]["model"].load_state_dict(state_dict, strict=False)
            MODELS[model_type]["active_version"] = version_tag
            MODELS[model_type]["active_adapter_path"] = adapter_path
            logger.info(f"✓ Dynamic hot-reload successful: {model_type} -> {version_tag}")
            return True
        except Exception as e:
            logger.error(f"✗ Dynamic hot-reload failed for {version_tag}: {e}")
            return False
    else:
        MODELS[model_type]["active_version"] = version_tag
        MODELS[model_type]["active_adapter_path"] = adapter_path
        logger.info(f"✓ Active model version updated to: {version_tag}")
        return True


def apply_head_weights(heads_path: str | None, version_tag: str) -> bool:
    """Swap the URL model's trained heads (feature_mlp + classifier) into the served model.

    The language backbone is never modified. `heads_path=None` returns to the shipped base heads.
    The replacement is built off to the side and swapped in atomically, so requests in flight
    keep using a complete model."""
    if "url" not in MODELS:
        return False
    try:
        from api.services import weight_trainer as wt
        heads = wt.load_heads(heads_path) if heads_path else None
        bb = wt.get_backbone()
        model = bb.head_modules(heads).to(DEVICE).eval()
        already_quantized = any("quantized" in type(m).__module__ for m in MODELS["url"]["model"].modules())
        if already_quantized:
            model = torch.quantization.quantize_dynamic(model, {torch.nn.Linear}, dtype=torch.qint8)
        MODELS["url"]["model"] = model
        MODELS["url"]["active_version"] = version_tag
        MODELS["url"]["active_heads"] = heads_path
        logger.info("URL model heads switched to %s", version_tag)
        return True
    except Exception as e:
        logger.error("Could not apply head weights %s: %s", version_tag, e)
        return False


# The keyword heuristic as a floor under the v2 text score (credential-solicitation wording is high precision);
# set AEGIS_TEXT_RULE_FLOOR=0 to judge the v2 score alone. Measured in AIML/eval/results (eval_text.py).
TEXT_RULE_FLOOR = float(os.environ.get("AEGIS_TEXT_RULE_FLOOR", "0.9"))


def _predict_text_v2(text: str) -> dict:
    """v2 text / SMS / chat detector (multilingual embedding + calibrated head). Empty text and browser UI
    snippets are still answered by the cheap heuristic; short messages are NOT waved through any more, because
    one-line code-theft and 'send it back' scams are short and carry no link."""
    fast = _heuristic_text_result(text) if FAST_SCAN_MODE else None
    if fast is not None and fast.get("explanation") in ("Empty text payload", "Standard UI / navigation element"):
        return fast
    h = V2_HEADS.get("text")
    if M1:
        prob, intents = _m1_risk("sms", "", "", text or "", kind="text")
        reasons = _m1_reasons(intents)
    else:
        x = h.design([text or ""], _v2_featurizer("text")(text)[None, :])
        prob = float(h.risk_from_design(x)[0])   # product scale, as for e-mail
        intents, reasons = None, _v2_explain(h, x[0])
    if fast is not None and fast.get("prediction") == "phishing" and TEXT_RULE_FLOOR > 0:
        prob = max(prob, TEXT_RULE_FLOOR)
        reasons += [w for w in (fast.get("xai_words") or []) if w not in reasons]
    is_phish = prob >= 0.5
    return {
        "prediction": "phishing" if is_phish else "legitimate",
        "confidence": round(prob if is_phish else 1 - prob, 4),
        "phishing_probability": round(prob, 4),
        "model": "text",
        "model_version": MODELS.get("text", {}).get("active_version") or ("m1" if M1 else h.spec.get("meta", {}).get("version", "text_v2")),
        "engine": (_message_engine() if M1 else "v2"),
        "intents": intents,
        "xai_words": reasons,
        "explanation": (f"AI flagged: {', '.join(reasons[:4])}" if is_phish and reasons
                        else "AI identified a scam pattern in the message as a whole" if is_phish
                        else "AI found nothing that asks for codes, money, details or a risky click"),
    }


def _predict_text_sync(text: str, include_xai: bool = False) -> dict:
    text = normalize_message(text)      # undo invisible characters, look-alike letters, leetspeak and defanged links (model input only)
    if M1 or "text" in V2_HEADS:
        return _predict_text_v2(text)
    if "text" not in MODELS:
        return {"error": "Text model not loaded", "model": "text"}

    if FAST_SCAN_MODE:
        fast = _heuristic_text_result(text)
        if fast is not None:
            return fast

    m = MODELS["text"]
    # Matches training (AIML/text_general/train_phishing_model_text.py max_len=128) - this used
    # to truncate at 96, silently dropping roughly the last quarter of any longer message the
    # model was never trained to expect being cut short.
    enc = TOKENIZER(text, add_special_tokens=True, max_length=128,
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


def _url_engine() -> str:
    """AEGIS_URL_ENGINE: transformer (default - newest installed v10/v9/v8 alone), ensemble (+ v7, geometric mean),
    v7 (original network only). "v8" is kept as an alias of transformer."""
    mode = os.environ.get("AEGIS_URL_ENGINE", "transformer").lower()
    return "transformer" if mode == "v8" else mode


def _url_v7_probs(url: str) -> list:
    """[p_legit, p_phish] from the v7 URL network (character model + lexical features)."""
    m = MODELS["url"]
    clean_url = m.get("sanitize", lambda x: x)(url)
    model_text = m["prep"](clean_url) if "prep" in m else clean_url
    enc = m.get("tokenizer", TOKENIZER)(model_text, add_special_tokens=True, max_length=128,
                                        padding="max_length", truncation=True, return_tensors="pt").to(DEVICE)
    nn_feats = m["extract_features"](clean_url).unsqueeze(0).to(DEVICE)
    with torch.inference_mode():
        logits = m["model"](enc["input_ids"], enc["attention_mask"], nn_feats)
        return torch.softmax(logits, dim=1)[0].cpu().tolist()


def _page_model_score(url: str, page_signals: dict | None) -> float | None:
    """Page model P1 (URL + page summary), on the fusion's scale (WARN threshold mapped to 0.35). Runs only when it is
    installed and the page asks for credentials - the pages it was calibrated on (AIML/url/kaggle/p1)."""
    pm = MODELS.get("page_p1")
    if not pm or not page_signals:
        return None
    if not (page_signals.get("has_password") or page_signals.get("login_form_found") or page_signals.get("has_email")
            or page_signals.get("has_otp")):
        return None
    from AIML.url import urlnet_v10
    from AIML.url.page_summary import summary_from_signals
    text = summary_from_signals(url, page_signals, urlnet_v10.model_text(url))
    enc = pm["tokenizer"]([text], truncation=True, max_length=int(pm["cal"].get("page_len", 256)), padding=True, return_tensors="pt")
    with torch.inference_mode():
        lg = pm["model"](input_ids=enc["input_ids"].to(DEVICE), attention_mask=enc["attention_mask"].to(DEVICE),
                         char_ids=urlnet_v10.char_ids([url]).to(DEVICE))[0].float()
    p = float(torch.sigmoid((lg[1] - lg[0]) / float(pm["cal"].get("temperature", 1.0))))
    t_w = float(pm["cal"]["thresholds"]["warn"])
    return 0.35 * p / t_w if p < t_w else 0.35 + 0.65 * (p - t_w) / max(1e-6, 1 - t_w)


def _combine_url_page(p_url: float, p_page: float) -> float:
    """AEGIS_PAGE_FUSION: mean (default, best on PhreshPhish test pages), geo, max (either one), page (page model alone)."""
    mode = os.environ.get("AEGIS_PAGE_FUSION", "mean")
    if mode == "max":
        return max(p_url, p_page)
    if mode == "mean":
        return 0.5 * (p_url + p_page)
    if mode == "page":
        return p_page
    return float(np.sqrt(max(p_url, 0.0) * max(p_page, 0.0)))


def _predict_url_sync(url: str, include_xai: bool = False, form_actions: list[str] = None,
                      page_signals: dict | None = None) -> dict:
    if FAST_URL_MODE:
        fast = _heuristic_url_result(url)
        if fast is not None:
            return fast

    if "url" not in MODELS:
        return {"error": "URL model not loaded", "model": "url"}

    # 1. Fast-path trusted domain routing & brand impersonation check
    from AIML.url.brand_engine import check_brand_impersonation
    brand_result = check_brand_impersonation(url)
    
    # Removed hardcoded trusted domains bypass. Trusted domains will now be evaluated
    # through the fusion engine as a context signal.
    is_trusted = False
    try:
        parsed = urlparse(url)
        netloc = parsed.netloc.lower()
        if "@" in netloc:
            netloc = netloc.split("@")[-1]
        domain = netloc.split(":")[0]
        if domain.startswith("www."):
            domain = domain[4:]
            

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
            "brand_impersonation": brand_result.get("matched", False),
            "credential_lure_detected": len(cascade_res.get("evidence", {}).get("lexical_anomalies", [])) > 0,
            "suspicious_tld": "suspicious_top_level_domain" in cascade_res.get("evidence", {}).get("lexical_anomalies", []),
            "evidence": cascade_res["evidence"]
        }

    url_mode = _url_engine()
    if "url_v8" in MODELS and url_mode in ("transformer", "ensemble"):
        v8 = MODELS["url_v8"]
        with torch.inference_mode():
            if v8["cal"].get("arch") == "urlnet_v10":
                from AIML.url import urlnet_v10
                lg = v8["model"](**urlnet_v10.encode(v8["tokenizer"], [url], DEVICE))[0].float()
            else:
                enc8 = v8["tokenizer"]([url], truncation=True, max_length=int(v8["cal"].get("max_len", 128)),
                                       return_tensors="pt").to(DEVICE)
                lg = v8["model"](**enc8).logits[0].float()
        p8 = float(torch.sigmoid((lg[1] - lg[0]) / float(v8["cal"].get("temperature", 1.0))))
        # v8's WARN threshold (1% FPR on held-out PhreshPhish benign) is mapped onto the fusion's 0.35 warn point
        t_w = float(v8["cal"]["thresholds"]["warn"])
        p_fused = 0.35 * p8 / t_w if p8 < t_w else 0.35 + 0.65 * (p8 - t_w) / max(1e-6, 1 - t_w)
        if url_mode == "ensemble":
            # v8 alone over-fires on older long-tail sites (query-heavy CMS pages); v7 alone misses padded paths.
            # The geometric mean needs both networks to agree, which measured best at a fixed false-alarm budget.
            p7 = _url_v7_probs(url)[1]
            p_fused = float(np.sqrt(max(p7, 0.0) * max(p_fused, 0.0)))
        p_url_only = p_fused
        p_page = _page_model_score(url, page_signals)
        if p_page is not None:
            p_fused = _combine_url_page(p_fused, p_page)
        fusion_result = fuse_url_intelligence(url, [1.0 - p_fused, p_fused], brand_result, lexical_tensor)
        fusion_result["evidence"]["url_engine"] = f"{url_mode}:{v8.get('generation', 'v8')}"
        if p_page is not None:
            fusion_result["evidence"]["page_model"] = {"score": round(p_page, 4), "url_score": round(p_url_only, 4),
                                                       "fusion": os.environ.get("AEGIS_PAGE_FUSION", "mean")}
        out = {
            "prediction": fusion_result["prediction"], "confidence": fusion_result["confidence"],
            "phishing_probability": round(fusion_result["risk_score"] / 100.0, 4), "category": fusion_result["category"],
            "model": "url", "xai_words": [], "explanation": fusion_result["explanation"],
            "brand_impersonation": brand_result.get("matched", False),
            "credential_lure_detected": len(fusion_result.get("evidence", {}).get("lexical_anomalies", [])) > 0,
            "suspicious_tld": "suspicious_top_level_domain" in fusion_result.get("evidence", {}).get("lexical_anomalies", []),
            "evidence": fusion_result["evidence"],
        }
        # Open-source second opinion (api/services/second_opinion.py): shown to admins; in "upgrade" mode it may
        # raise a WARN to BLOCK when both models agree. Never lowers a verdict; rule overrides returned above.
        from api.services import second_opinion
        return second_opinion.apply(out, url)

    # 3. Deep Semantic Analysis (v7 network)
    probs = _url_v7_probs(url)

    # 4. Evidence Fusion & Calibration
    from AIML.url.fusion_engine import fuse_url_intelligence
    fusion_result = fuse_url_intelligence(url, probs, brand_result, lexical_tensor)

    # 4.5 Evaluate form_actions (Informational annotation, risk evaluation delegated to ContextualRiskEngine)
    if form_actions:
        for action in form_actions:
            if action.startswith("http://"):
                fusion_result["explanation"] += f" | ✗ Form submits to unencrypted HTTP ({action})"
            else:
                try:
                    action_domain = urlparse(action).netloc.lower()
                    action_root = action_domain.split(":")[0]
                    if action_root.startswith("www."):
                        action_root = action_root[4:]
                    
                    if action_root and action_root != domain and not action_root.endswith("." + domain):
                        fusion_result["explanation"] += f" | ℹ Form submits to external domain ({action_root})"
                except Exception:
                    pass

    # 5. XAI Attention Words Extraction
    is_phish = (fusion_result["prediction"] == "malicious")
    xai_words = []
    if is_phish and _should_extract_xai(include_xai):
        m = MODELS["url"]
        url_tokenizer = m.get("tokenizer", TOKENIZER)
        clean_url = m.get("sanitize", lambda x: x)(url)
        enc = url_tokenizer(m["prep"](clean_url) if "prep" in m else clean_url, add_special_tokens=True,
                            max_length=128, padding="max_length", truncation=True, return_tensors="pt").to(DEVICE)
        with torch.inference_mode():
            tokens = url_tokenizer.convert_ids_to_tokens(enc["input_ids"][0])
            xai_words = _get_bert_attention_xai(m["model"], tokens, enc["attention_mask"][0])
            if xai_words:
                fusion_result["explanation"] += f" | AI focused on: {', '.join(xai_words)}"

    brand_matched = brand_result.get("matched", False)
    lexical_anoms = fusion_result.get("evidence", {}).get("lexical_anomalies", [])
    has_lure_kw = any("phishing_keywords" in str(a) for a in lexical_anoms) or len(lexical_anoms) > 0
    has_susp_tld = "suspicious_top_level_domain" in lexical_anoms

    return {
        "prediction": fusion_result["prediction"],
        "confidence": fusion_result["confidence"],
        "phishing_probability": round(fusion_result["risk_score"] / 100.0, 4),
        "category": fusion_result["category"],
        "model": "url",
        "xai_words": xai_words,
        "explanation": fusion_result["explanation"],
        "brand_impersonation": brand_matched,
        "credential_lure_detected": has_lure_kw,
        "suspicious_tld": has_susp_tld,
        "evidence": fusion_result["evidence"]
    }


def _predict_image_sync(img_bytes: bytes) -> dict:
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


def _process_attachment_sync(file_path: str) -> dict:
    """Run the attachment orchestrator on a file, delegating extracted content to AI models."""
    if ATTACHMENT_ORCH is None:
        return {"error": "Attachment orchestrator not loaded"}

    extraction = ATTACHMENT_ORCH.process_file(file_path)

    signals = list(extraction.get("signals", []))

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
        text_res = _predict_text_sync(extracted_text[:2000])
        results["sub_results"]["text"] = text_res
        if text_res.get("prediction") == "phishing":
            text_prob = round((text_res.get("phishing_probability", 0.95)) * 100)
            signals.append(f"🤖 Text Model AI: Phishing language detected in attachment content ({text_prob}% risk)")

    # Delegate URLs
    url_results = []
    for url in extraction.get("urls", []):
        r = _predict_url_sync(url)
        r["url"] = url
        url_results.append(r)
        if r.get("phishing_probability", 0) > 0.5:
            signals.append(f"🔗 Malicious link inside file: {url[:50]}…")
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

    results["phishing_signals"] = list(dict.fromkeys(signals))
    results["prediction"] = "phishing" if is_phishing else "legitimate"
    results["phishing_probability"] = max(
        results["heuristic_risk"],
        results["sub_results"].get("text", {}).get("phishing_probability", 0),
        max((u.get("phishing_probability", 0) for u in url_results), default=0),
    )

    return results


# ═══════════════════════════════════════════════════════════════
# ASYNC INFERENCE (public API — non-blocking)
# ═══════════════════════════════════════════════════════════════

async def predict_email(sender: str, subject: str, body: str) -> dict:
    """Async email inference — runs in thread pool with semaphore guard."""
    async with _get_semaphore():
        from api.services.calibration import calibrate_result
        return calibrate_result("email", await asyncio.to_thread(_predict_email_sync, sender, subject, body))


async def predict_text(text: str) -> dict:
    """Async text inference — runs in thread pool with semaphore guard."""
    async with _get_semaphore():
        from api.services.calibration import calibrate_result
        return calibrate_result("text", await asyncio.to_thread(_predict_text_sync, text))


async def predict_url(url: str, form_actions: list[str] = None, page_signals: dict | None = None) -> dict:
    """Async URL inference — runs in thread pool with semaphore guard. page_signals = the extension's dom_signals."""
    async with _get_semaphore():
        from api.services.calibration import calibrate_result
        return calibrate_result("url", await asyncio.to_thread(_predict_url_sync, url, False, form_actions, page_signals))


async def predict_image(img_bytes: bytes) -> dict:
    """Async image inference — runs in thread pool with semaphore guard."""
    async with _get_semaphore():
        from api.services.calibration import calibrate_result
        return calibrate_result("image", await asyncio.to_thread(_predict_image_sync, img_bytes))


async def predict_image_pil(img: Image.Image) -> dict:
    """Predict from a PIL Image directly (used after OCR pipeline)."""
    buf = io.BytesIO()
    img.save(buf, format="PNG")
    return await predict_image(buf.getvalue())


async def process_attachment(file_path: str) -> dict:
    """Async attachment processing — runs in thread pool with semaphore guard."""
    async with _get_semaphore():
        return await asyncio.to_thread(_process_attachment_sync, file_path)


def extract_urls_from_text(text: str) -> list[str]:
    """Extract URLs from text content."""
    url_pattern = re.compile(r'https?://(?:[-\w.]|(?:%[\da-fA-F]{2}))+[/\w\-._~:/?#\[\]@!$&\'()*+,;=%]*')
    return list(set(url_pattern.findall(text)))
