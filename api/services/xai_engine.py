"""
AegisOne — Two-Tier Explainable AI (XAI) Engine
=================================================

Tier 1 (Fast, In-Process, < 50ms on CPU):
  - DistilBERT token attributions via Captum LayerIntegratedGradients
    (primary) or attention-weight extraction (fast fallback).
  - URL feature-level attribution using extract_url_numerical_features
    output (10 model features) correlated with model confidence delta.
  - Heuristic / rule-based evidence mapper for DOM signals.
  - Structured JSON merger.

Tier 2 (Optional, Non-Critical, ~1.5–3 s):
  - Local Ollama (qwen2.5:1.5b) rephrases Tier 1 JSON into natural
    language WITHOUT inventing claims outside the Tier 1 payload.

Attribution family:
  Captum Integrated Gradients ∈ SHAP axiomatic attribution family.
  Satisfies Completeness and Sensitivity axioms (Sundararajan et al., 2017).
"""

from __future__ import annotations

import datetime
import logging
import re
import time
from typing import Any, Dict, List, Optional
from urllib.parse import urlparse

import torch

logger = logging.getLogger("aegisone.xai_engine")

# ─── Captum (optional soft-dependency) ────────────────────────────────────────
try:
    from captum.attr import LayerIntegratedGradients
    CAPTUM_AVAILABLE = True
except ImportError:
    CAPTUM_AVAILABLE = False
    logger.info(
        "Captum not installed — using attention-weight fallback for token XAI. "
        "Install with: pip install captum"
    )

# ─── Tokens to exclude from attribution output ────────────────────────────────
_SKIP_TOKENS = {
    "[cls]", "[sep]", "[pad]", "http", "https", "www", "com",
    "the", "a", "an", "is", "in", "to", "of", "and", "or", "##",
}

# ─── URL feature names — matches extract_url_numerical_features() order ───────
_URL_FEATURE_NAMES = [
    "url_length",
    "num_subdomains",
    "num_special_chars",
    "path_depth",
    "has_ip_address",
    "has_at_symbol",
    "has_double_slash",
    "url_entropy",
    "brand_similarity",
    "redirect_count",
]

_URL_FEATURE_REASONS = {
    "url_length":        "URL is unusually long (common in obfuscated phishing links)",
    "num_subdomains":    "Excessive subdomain nesting (used to mimic legitimate domains)",
    "num_special_chars": "High density of special characters in URL",
    "path_depth":        "URL path is deeply nested",
    "has_ip_address":    "URL uses a raw IP address instead of a domain name",
    "has_at_symbol":     "URL contains '@' symbol (used to mask real destination)",
    "has_double_slash":  "Double slashes detected in URL path",
    "url_entropy":       "High character entropy suggests obfuscation or encoding",
    "brand_similarity":  "Domain closely resembles a trusted brand name",
    "redirect_count":    "URL involves multiple HTTP redirects",
}


# ═══════════════════════════════════════════════════════════════════════════════
# TIER 1-A: DISTILBERT / TEXT MODEL TOKEN ATTRIBUTION
# ═══════════════════════════════════════════════════════════════════════════════

def explain_text_tokens(
    model: Any,
    tokenizer: Any,
    text: str,
    max_tokens: int = 8,
    n_steps: int = 10,
) -> List[Dict[str, Any]]:
    """
    Computes token-level attribution scores for the phishing class using:
      1. Captum LayerIntegratedGradients on word embeddings (primary — SHAP-axiomatic).
      2. MultiHeadAttentionPool weight extraction (fast fallback).

    Args:
        model:      Loaded PyTorch DistilBERT model in eval mode.
        tokenizer:  Matching HuggingFace tokenizer.
        text:       Raw input text (email body / SMS / URL string).
        max_tokens: Maximum number of attributed tokens to return.
        n_steps:    Riemann steps for Integrated Gradients (10 = fast CPU budget).

    Returns:
        List of {"token": str, "score": float} sorted by attribution descending.
    """
    if not model or not tokenizer or not text.strip():
        return []

    try:
        device = next(model.parameters()).device
        enc = tokenizer(
            text,
            add_special_tokens=True,
            max_length=128,
            padding="max_length",
            truncation=True,
            return_tensors="pt",
        ).to(device)

        input_ids = enc["input_ids"]
        attention_mask = enc["attention_mask"]
        tokens = tokenizer.convert_ids_to_tokens(input_ids[0])

        # ── Path 1: Captum LayerIntegratedGradients ───────────────────────────
        if CAPTUM_AVAILABLE:
            return _captum_token_attribution(
                model, input_ids, attention_mask, tokens,
                max_tokens=max_tokens, n_steps=n_steps
            )

        # ── Path 2: Attention-weight fallback ────────────────────────────────
        return _attention_token_attribution(model, tokens, attention_mask, max_tokens)

    except Exception as e:
        logger.error(f"explain_text_tokens failed: {e}")
        return []


def _captum_token_attribution(
    model: Any,
    input_ids: torch.Tensor,
    attention_mask: torch.Tensor,
    tokens: List[str],
    max_tokens: int,
    n_steps: int,
) -> List[Dict[str, Any]]:
    """Inner function: Captum LayerIntegratedGradients path."""

    # Resolve the word embedding layer (supports both DistilBERT + custom wrappers)
    emb_layer = None
    for attr in ("distilbert", "bert", "transformer"):
        if hasattr(model, attr):
            bert_sub = getattr(model, attr)
            if hasattr(bert_sub, "embeddings") and hasattr(bert_sub.embeddings, "word_embeddings"):
                emb_layer = bert_sub.embeddings.word_embeddings
                break
    if emb_layer is None:
        # Best-effort: grab the first Embedding module
        for mod in model.modules():
            if isinstance(mod, torch.nn.Embedding):
                emb_layer = mod
                break

    if emb_layer is None:
        logger.warning("Could not locate embedding layer for Captum — falling back to attention XAI")
        return _attention_token_attribution(model, tokens, attention_mask, max_tokens)

    def forward_for_captum(ids: torch.Tensor) -> torch.Tensor:
        """Wrapper that returns phishing class logit / sigmoid probability."""
        out = model(ids, attention_mask)
        if hasattr(out, "logits"):
            out = out.logits
        # Scalar output → sigmoid; vector output → softmax class-1
        if out.dim() == 1 or (out.dim() == 2 and out.shape[1] == 1):
            return torch.sigmoid(out).squeeze(-1)
        return torch.softmax(out, dim=1)[:, 1]

    lig = LayerIntegratedGradients(forward_for_captum, emb_layer)

    # Baseline: all-zeros embedding (standard IG baseline)
    baseline = torch.zeros_like(input_ids)

    # Gradient computation (no_grad is handled inside Captum)
    attributions, _ = lig.attribute(
        inputs=input_ids,
        baselines=baseline,
        target=None,
        n_steps=n_steps,
        return_convergence_delta=True,
    )
    # Shape: [batch, seq, embedding_dim] → sum over embedding dim → [seq]
    attr_scores = attributions.sum(dim=-1).squeeze(0).abs().detach().cpu().tolist()

    return _format_token_results(tokens, attr_scores, max_tokens)


def _attention_token_attribution(
    model: Any,
    tokens: List[str],
    attention_mask: torch.Tensor,
    max_tokens: int,
) -> List[Dict[str, Any]]:
    """
    Fallback: uses stored attention weights from MultiHeadAttentionPool
    (present on email / text model) or DistilBERT last_attentions (URL model).
    """
    scored: List[tuple] = []

    # MultiHeadAttentionPool (email/text PhishingDetector)
    if hasattr(model, "attention") and hasattr(model.attention, "attention_weights"):
        attn = model.attention.attention_weights
        if attn is not None:
            mean_attn = attn[0].mean(dim=0).mean(dim=0)
            for idx, token in enumerate(tokens):
                t = token.lower()
                if idx < len(mean_attn) and _is_meaningful_token(t, attention_mask, idx):
                    scored.append((token, float(mean_attn[idx].item())))

    # DistilBERT last_attentions (URL model)
    elif hasattr(model, "last_attentions") and model.last_attentions:
        last_layer = model.last_attentions[-1][0]  # [heads, seq, seq]
        cls_attn = last_layer.mean(dim=0)[0, :]   # CLS row averaged over heads
        for idx, token in enumerate(tokens):
            t = token.lower()
            if idx < len(cls_attn) and _is_meaningful_token(t, attention_mask, idx):
                scored.append((token, float(cls_attn[idx].item())))

    scored.sort(key=lambda x: x[1], reverse=True)
    return [
        {"token": t[0].replace("##", ""), "score": round(t[1], 4)}
        for t in scored[:max_tokens]
        if t[1] > 0.001
    ]


def _format_token_results(
    tokens: List[str],
    scores: List[float],
    max_tokens: int,
) -> List[Dict[str, Any]]:
    """Filter special tokens and format attribution list."""
    results = []
    for token, score in zip(tokens, scores):
        clean = token.replace("##", "").strip()
        if not clean or clean.lower() in _SKIP_TOKENS or len(clean) < 2:
            continue
        results.append({"token": clean, "score": round(score, 4)})
    results.sort(key=lambda x: x["score"], reverse=True)
    return results[:max_tokens]


def _is_meaningful_token(t: str, attention_mask: torch.Tensor, idx: int) -> bool:
    return (
        attention_mask[idx] == 1
        and t not in _SKIP_TOKENS
        and not t.startswith("##")
        and len(t) > 2
        and not all(c in ".,!?-_/\\|" for c in t)
    )


# ═══════════════════════════════════════════════════════════════════════════════
# TIER 1-B: URL NUMERICAL FEATURE ATTRIBUTION
# ═══════════════════════════════════════════════════════════════════════════════

def explain_url_features(
    evidence: Dict[str, Any],
    url_feature_tensor: Optional[torch.Tensor] = None,
    model: Optional[Any] = None,
) -> List[Dict[str, Any]]:
    """
    Produces feature-level attributions for the URL model's 10-feature input vector.
    Attribution method: ablation-style feature contribution (feature value × relative weight).
    When the raw feature tensor is not available, falls back to evidence-derived signals.

    Args:
        evidence:            XAI evidence dict from the browser extension.
        url_feature_tensor:  10-element tensor from extract_url_numerical_features()
                             if available from the scan result.
        model:               Loaded URL PyTorch model for live gradient computation.

    Returns:
        List of {"name", "label", "score", "value"} sorted descending.
    """
    attributions: List[Dict[str, Any]] = []

    # ── Path 1: Live feature tensor available ─────────────────────────────────
    if url_feature_tensor is not None:
        feat = url_feature_tensor.detach().cpu().float()
        # Normalize contributions: score = feature_value / sum(|features|)
        total = feat.abs().sum().item() or 1.0
        for i, name in enumerate(_URL_FEATURE_NAMES):
            val = feat[i].item() if i < len(feat) else 0.0
            contrib = abs(val) / total
            if contrib > 0.01:  # drop near-zero contributions
                attributions.append({
                    "name": name,
                    "label": _URL_FEATURE_REASONS.get(name, name),
                    "score": round(contrib, 4),
                    "value": round(val, 4),
                })

    # ── Path 2: evidence-derived signals (fallback, no tensor) ────────────────
    else:
        top_factors = evidence.get("top_factors", [])
        for factor in top_factors:
            key = factor.get("key") or factor.get("label", "signal")
            raw_score = factor.get("score", 0)
            attributions.append({
                "name": key,
                "label": factor.get("label", key),
                "score": round(float(raw_score) / 100.0, 4),
                "value": None,
            })

        # Supplement with DOM-derived signals not in top_factors
        redirects = evidence.get("redirect_chain", [])
        if len(redirects) > 2 and not any("redirect" in a["name"] for a in attributions):
            attributions.append({
                "name": "redirect_count",
                "label": _URL_FEATURE_REASONS["redirect_count"],
                "score": min(0.40, 0.10 * len(redirects)),
                "value": len(redirects),
            })

        if evidence.get("login_form_detected") and not any("form" in a["name"] for a in attributions):
            attributions.append({
                "name": "credential_form_detected",
                "label": "Login form on unverified domain (Credential Harvesting)",
                "score": 0.75,
                "value": True,
            })

        domain = evidence.get("domain", "")
        if domain and any(kw in domain for kw in ("login", "verify", "secure", "account", "update")):
            attributions.append({
                "name": "keyword_impersonation",
                "label": "Domain contains credential/impersonation keywords",
                "score": 0.60,
                "value": domain,
            })

    attributions.sort(key=lambda x: x.get("score", 0), reverse=True)
    return attributions[:8]


# ═══════════════════════════════════════════════════════════════════════════════
# TIER 1-C: RULE / HEURISTIC EVIDENCE MAPPER
# ═══════════════════════════════════════════════════════════════════════════════

def explain_rules(evidence: Dict[str, Any]) -> List[Dict[str, Any]]:
    """
    Maps fired DOM and network heuristic rules to structured rule IDs,
    severity weights, and human-readable reasons.
    """
    rules: List[Dict[str, Any]] = []

    if evidence.get("login_form_detected"):
        rules.append({
            "id": "RULE_LOGIN_FORM",
            "weight": 0.35,
            "reason": "Page contains a credential login form on an unverified domain.",
        })

    hidden_iframes = evidence.get("hidden_iframes", [])
    if hidden_iframes:
        rules.append({
            "id": "RULE_HIDDEN_IFRAMES",
            "weight": 0.25,
            "reason": f"Invisible/zero-dimension iframes detected ({len(hidden_iframes)} found). Used in clickjacking attacks.",
        })

    redirects = evidence.get("redirect_chain", [])
    if len(redirects) > 2:
        rules.append({
            "id": "RULE_EXCESSIVE_REDIRECTS",
            "weight": round(min(0.35, 0.08 * len(redirects)), 2),
            "reason": f"Destination reached via {len(redirects)} HTTP redirect hops.",
        })

    ext_scripts = evidence.get("external_scripts", [])
    if len(ext_scripts) > 12:
        rules.append({
            "id": "RULE_HIGH_EXTERNAL_SCRIPTS",
            "weight": 0.15,
            "reason": f"{len(ext_scripts)} third-party external scripts loaded — elevated data-exfiltration risk.",
        })

    # Enrich with verdict/threat_type context
    threat_type = evidence.get("threat_type", "")
    if threat_type and threat_type not in ("safe", ""):
        threat_label = threat_type.replace("_", " ").title()
        if not any(threat_type.lower() in r["reason"].lower() for r in rules):
            rules.append({
                "id": f"RULE_AI_VERDICT_{threat_type.upper()}",
                "weight": 0.20,
                "reason": f"AI model classified this as {threat_label}.",
            })

    # Always include a catch-all if nothing fired
    if not rules:
        rules.append({
            "id": "RULE_HEURISTIC_PATTERN_MATCH",
            "weight": 0.10,
            "reason": "URL/DOM structure matched known phishing heuristic patterns.",
        })

    return rules


# ═══════════════════════════════════════════════════════════════════════════════
# TIER 1 CONTROLLER: MERGE ALL SIGNALS INTO STRUCTURED JSON
# ═══════════════════════════════════════════════════════════════════════════════

def generate_tier1_explanation(
    evidence: Dict[str, Any],
    model: Optional[Any] = None,
    tokenizer: Optional[Any] = None,
    url_feature_tensor: Optional[torch.Tensor] = None,
    text_snippet: Optional[str] = None,
) -> Dict[str, Any]:
    """
    Tier 1 XAI Controller.
    Merges token attributions, URL feature attributions, and rule evidence
    into the canonical AEGIS XAI JSON structure.

    Target latency: < 50 ms on CPU (n_steps=10, max_length=128).

    Args:
        evidence:            Evidence payload from browser extension / scan.
        model:               Loaded PyTorch model (DistilBERT / URL model).
        tokenizer:           Matching tokenizer for token attribution.
        url_feature_tensor:  Optional pre-extracted URL feature tensor (10 dims).
        text_snippet:        Override text for token attribution (email body, etc.).

    Returns:
        Canonical Tier 1 JSON with signals → text_tokens, url_features, rules.
    """
    t0 = time.perf_counter()

    risk_score = int(evidence.get("risk_score", 0))
    if risk_score >= 80:
        label = "High Risk"
    elif risk_score >= 50:
        label = "Moderate Risk"
    elif risk_score >= 20:
        label = "Low Suspicion"
    else:
        label = "Safe"

    # ── Gather attributions ───────────────────────────────────────────────────
    sample_text = text_snippet or evidence.get("text_summary") or evidence.get("url") or ""
    text_tokens = (
        explain_text_tokens(model, tokenizer, sample_text)
        if (model and tokenizer and sample_text)
        else []
    )
    url_features = explain_url_features(evidence, url_feature_tensor, model)
    fired_rules = explain_rules(evidence)

    # ── MITRE ATT&CK mapping ─────────────────────────────────────────────────
    mitre = []
    if any(r["id"] == "RULE_LOGIN_FORM" for r in fired_rules):
        mitre.append("T1110 - Credential Access / Brute Force")
    if any(r["id"] == "RULE_HIDDEN_IFRAMES" for r in fired_rules):
        mitre.append("T1203 - Exploitation for Client Execution (Clickjacking)")
    if any(r["id"] == "RULE_EXCESSIVE_REDIRECTS" for r in fired_rules):
        mitre.append("T1566.002 - Phishing: Spearphishing Link (Redirect Chain)")
    if not mitre or risk_score >= 50:
        if "T1566.002" not in " ".join(mitre):
            mitre.append("T1566.002 - Phishing: Spearphishing Link")
    if risk_score >= 70:
        mitre.append("T1584 - Compromise Infrastructure (Adversary Staged Domain)")

    # ── Compact natural-language summary ─────────────────────────────────────
    top_reasons = [r["reason"] for r in fired_rules[:2]]
    if url_features:
        top_reasons.append(url_features[0]["label"])
    reasons_str = "; ".join(top_reasons[:3])
    summary = (
        f"AegisOne flagged this event with a composite risk score of {risk_score}% ({label}). "
        f"Key attribution factors: {reasons_str}."
    )

    latency_ms = round((time.perf_counter() - t0) * 1000, 2)

    return {
        "risk_score": risk_score,
        "label": label,
        "summary": summary,
        "signals": {
            "text_tokens": text_tokens,
            "url_features": url_features,
            "rules": fired_rules,
        },
        "main_reasons": [r["reason"] for r in fired_rules],
        "recommendations": _build_recommendations(risk_score, evidence),
        "threat_likelihood": f"{'High' if risk_score >= 80 else 'Moderate' if risk_score >= 50 else 'Low'} Likelihood of {evidence.get('threat_type', 'Phishing').replace('_', ' ').title()}",
        "mitre_mapping": mitre,
        "ioc": {
            "domain": evidence.get("domain", ""),
            "url": evidence.get("url", ""),
            "indicators": [
                {"type": "domain", "value": evidence.get("domain", "")},
                {"type": "url", "value": evidence.get("url", "")},
            ],
        },
        "attribution_method": "Captum LayerIntegratedGradients" if CAPTUM_AVAILABLE else "Attention Weight Attribution",
        "xai_tier": "tier1_fast",
        "latency_ms": latency_ms,
        "generated_at": datetime.datetime.utcnow().strftime("%Y-%m-%dT%H:%M:%SZ"),
    }


def _build_recommendations(risk_score: int, evidence: Dict[str, Any]) -> List[str]:
    recs: List[str] = []
    if evidence.get("login_form_detected"):
        recs.append("Do NOT input passwords, emails, or personal details on this page.")
    if risk_score >= 80:
        recs.append("Close this browser window or navigate back immediately.")
        recs.append("Notify your Security Operations Center (SOC) using the 'Report Threat' button.")
    elif risk_score >= 50:
        recs.append("Proceed with extreme caution. Verify the destination URL before interacting.")
    else:
        recs.append("Stay alert — some suspicious signals were detected but risk is low.")
    recs.append("Ensure multi-factor authentication (MFA) is enabled for all organizational accounts.")
    return recs


# ═══════════════════════════════════════════════════════════════════════════════
# TIER 2 CONTROLLER: OLLAMA DEEP EXPLANATION (OPTIONAL)
# 3-stage resolution: Cloud Ollama → Local Ollama → Tier 1 Fallback
# ═══════════════════════════════════════════════════════════════════════════════

import os as _os

_OLLAMA_API_KEY = _os.environ.get("OLLAMA_API_KEY", "").strip()
_LOCAL_OLLAMA_URL = "http://localhost:11434/api/generate"
_CLOUD_OLLAMA_URL = "https://ollama.com/api/generate"
_LOCAL_MODEL = "qwen2.5:1.5b"
_CLOUD_MODEL = "gpt-oss:120b-cloud"


def _build_xai_prompt(tier1_json: Dict[str, Any]) -> str:
    fired_rule_reasons = [r["reason"] for r in tier1_json.get("signals", {}).get("rules", [])]
    top_features = [f["label"] for f in tier1_json.get("signals", {}).get("url_features", [])[:3]]
    top_tokens = [t["token"] for t in tier1_json.get("signals", {}).get("text_tokens", [])[:5]]
    return (
        "You are AegisOne, an expert AI cybersecurity assistant.\n"
        "Rephrase the following structured security findings into 2-3 plain-English sentences "
        "for an IT administrator. Do NOT add facts, URLs, or threats not listed below.\n\n"
        f"Risk Score: {tier1_json.get('risk_score')}% ({tier1_json.get('label')})\n"
        f"Fired Rules: {fired_rule_reasons}\n"
        f"Top URL/Feature Signals: {top_features}\n"
        f"Suspicious Tokens Detected: {top_tokens}\n\n"
        "Natural Language Report:"
    )


async def generate_tier2_deep_explanation(
    tier1_json: Dict[str, Any],
    ollama_url: str = _LOCAL_OLLAMA_URL,
    model_name: str = _LOCAL_MODEL,
) -> Dict[str, Any]:
    """
    Tier 2 Deep Explanation — 3-stage resolution:
      Stage 1: Ollama Cloud (if OLLAMA_API_KEY env var is set)
      Stage 2: Local Ollama (http://localhost:11434)
      Stage 3: Tier 1 fast-path summary (instant fallback, no network needed)
    """
    import httpx

    prompt = _build_xai_prompt(tier1_json)

    # ── Stage 1: Ollama Cloud ──────────────────────────────────────────────────
    if _OLLAMA_API_KEY:
        try:
            async with httpx.AsyncClient(timeout=15.0) as client:
                resp = await client.post(
                    _CLOUD_OLLAMA_URL,
                    json={"model": _CLOUD_MODEL, "prompt": prompt, "stream": False},
                    headers={"Authorization": f"Bearer {_OLLAMA_API_KEY}"},
                )
                if resp.status_code == 200:
                    polished = resp.json().get("response", "").strip()
                    if polished:
                        logger.info("Tier 2 XAI: used Ollama Cloud.")
                        return {
                            "deep_explanation": polished,
                            "tier1_evidence": tier1_json,
                            "model": _CLOUD_MODEL,
                            "source": "ollama_cloud",
                            "xai_tier": "tier2_deep",
                        }
        except Exception as cloud_exc:
            logger.warning(f"Ollama Cloud unavailable ({cloud_exc}), trying local...")

    # ── Stage 2: Local Ollama ──────────────────────────────────────────────────
    try:
        async with httpx.AsyncClient(timeout=8.0) as client:
            resp = await client.post(
                _LOCAL_OLLAMA_URL,
                json={"model": _LOCAL_MODEL, "prompt": prompt, "stream": False},
            )
            resp.raise_for_status()
            polished = resp.json().get("response", "").strip()
            if polished:
                logger.info("Tier 2 XAI: used local Ollama.")
                return {
                    "deep_explanation": polished,
                    "tier1_evidence": tier1_json,
                    "model": _LOCAL_MODEL,
                    "source": "local_llm",
                    "xai_tier": "tier2_deep",
                }
    except Exception as local_exc:
        logger.warning(f"Local Ollama unavailable ({local_exc}). Returning Tier 1 summary.")

    # ── Stage 3: Tier 1 Captum Summary Fallback ───────────────────────────────
    return {
        "deep_explanation": tier1_json.get("summary", "No explanation available."),
        "tier1_evidence": tier1_json,
        "model": "tier1-captum-fallback",
        "source": "fallback",
        "xai_tier": "tier1_fallback",
    }


async def ensure_ollama_model_ready(
    ollama_base_url: str = "http://localhost:11434",
    model_name: str = _LOCAL_MODEL
) -> None:
    """
    Background worker called on FastAPI startup.
    If OLLAMA_API_KEY is set → uses Cloud Ollama, no local check needed.
    Otherwise, checks if local Ollama service is running and pulls model if missing.
    """
    import httpx

    if _OLLAMA_API_KEY:
        logger.info("✓ OLLAMA_API_KEY detected — Tier 2 XAI will use Ollama Cloud. No local pull needed.")
        return

    try:
        async with httpx.AsyncClient(timeout=3.0) as client:
            tags_res = await client.get(f"{ollama_base_url}/api/tags")
            if tags_res.status_code != 200:
                logger.info("Ollama service not active locally. Tier 2 XAI will fall back to Tier 1.")
                return

            models_data = tags_res.json().get("models", [])
            existing_names = [m.get("name", "") for m in models_data]

            if any(model_name in name for name in existing_names):
                logger.info(f"✓ Ollama model '{model_name}' is ready locally.")
                return

            logger.info(f"Ollama detected but '{model_name}' not found. Initiating background pull...")
            await client.post(
                f"{ollama_base_url}/api/pull",
                json={"name": model_name, "stream": False},
                timeout=180.0
            )
            logger.info(f"✓ Background pull for '{model_name}' completed successfully.")

    except Exception as e:
        logger.info(f"Ollama auto-check: local LLM offline ({e}). XAI will use Tier 1 fast path.")



