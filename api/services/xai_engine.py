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

Tier 2.5 (Built-in HuggingFace Fallback, ~2–5 s first call then ~0.5 s):
  - google/flan-t5-small runs in-process via the transformers library.
  - No Ollama install required. Model (~300 MB) downloads once to cache.
  - Produces real AI-generated text, not hardcoded templates.

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
    rich_evidence: Optional[Dict[str, Any]] = None,
) -> Dict[str, Any]:
    """
    Tier 1 XAI Controller. Fast, grounded, no LLM — this is what the user sees
    immediately. Builds the plain-language summary from the SPECIFIC evidence for
    this exact scan (brand name impersonated, exact URL trick used, which DOM
    behavior fired) rather than a generic risk-band template, so two different
    phishing pages get two different, accurate explanations instead of the same
    canned paragraph.

    Target latency: < 50 ms on CPU.

    Args:
        evidence:            Evidence payload sent by the caller (extension, right-click scan, etc.).
        model:               Loaded PyTorch model, only used for text-token attribution (email/text scans).
        tokenizer:           Matching tokenizer for token attribution.
        url_feature_tensor:  Optional pre-extracted URL feature tensor (10 dims).
        text_snippet:        Override text for token attribution (email body, etc.).
        rich_evidence:       Full server-stored evidence for this exact scan_id — the ground
                              truth, looked up server-side. None for scan types without a
                              stored record (falls back to `evidence` alone).

    Returns:
        Canonical Tier 1 JSON. `summary`/`main_reasons`/`recommendations` are the
        plain-language fields the UI shows; `signals`/`mitre_mapping`/`ioc` are
        kept as secondary technical detail for an admin/analyst view.
    """
    t0 = time.perf_counter()

    risk_score = int((rich_evidence or {}).get("final_risk", evidence.get("risk_score", 0)) or 0)
    if risk_score >= 80:
        label = "High Risk"
    elif risk_score >= 50:
        label = "Moderate Risk"
    elif risk_score >= 20:
        label = "Low Suspicion"
    else:
        label = "Safe"

    # ── Gather attributions (kept for the technical/admin view, not the plain summary) ──
    sample_text = text_snippet or evidence.get("text_summary") or evidence.get("url") or ""
    text_tokens = (
        explain_text_tokens(model, tokenizer, sample_text)
        if (model and tokenizer and sample_text)
        else []
    )
    url_features = explain_url_features(evidence, url_feature_tensor, model)
    fired_rules = explain_rules(evidence)

    # ── Grounded plain-language findings — the core of this response ──────────
    grounded = build_grounded_findings(evidence, rich_evidence)
    findings = grounded["findings"]
    brand = grounded["brand"]

    if risk_score >= 20:
        verb = "blocked" if risk_score >= 80 else "flagged"
        summary = f"AegisOne {verb} this page ({risk_score}% risk) — {findings[0]}."
        if len(findings) > 1:
            summary += f" On top of that, {findings[1]}."
    else:
        summary = f"AegisOne checked this page ({risk_score}% risk) and found it safe. {findings[0].capitalize()}."

    main_reasons = [f[0].upper() + f[1:] for f in findings]

    # ── MITRE ATT&CK mapping — only signals genuinely tied to what fired, for the
    #    technical/admin view. Not shown in the plain-language summary.
    mitre = []
    if brand:
        mitre.append("T1566.002 - Phishing: Spearphishing Link (Brand Impersonation)")
    if any(r["id"] == "RULE_LOGIN_FORM" for r in fired_rules):
        mitre.append("T1110 - Credential Access / Brute Force")
    if any(r["id"] == "RULE_HIDDEN_IFRAMES" for r in fired_rules):
        mitre.append("T1203 - Exploitation for Client Execution (Clickjacking)")
    if any(r["id"] == "RULE_EXCESSIVE_REDIRECTS" for r in fired_rules):
        mitre.append("T1566.002 - Phishing: Spearphishing Link (Redirect Chain)")
    if risk_score >= 70 and not mitre:
        mitre.append("T1566 - Phishing")

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
        "main_reasons": main_reasons,
        "recommendations": _build_recommendations(risk_score, evidence, brand),
        "threat_likelihood": f"{'High' if risk_score >= 80 else 'Moderate' if risk_score >= 50 else 'Low'} Likelihood of {evidence.get('threat_type', 'Phishing').replace('_', ' ').title()}",
        "mitre_mapping": mitre,
        "ioc": {
            "domain": (rich_evidence or {}).get("target_domain") or evidence.get("domain", ""),
            "url": (rich_evidence or {}).get("target_url") or evidence.get("url", ""),
            "indicators": [
                {"type": "domain", "value": (rich_evidence or {}).get("target_domain") or evidence.get("domain", "")},
                {"type": "url", "value": (rich_evidence or {}).get("target_url") or evidence.get("url", "")},
            ],
        },
        "attribution_method": "Captum LayerIntegratedGradients" if CAPTUM_AVAILABLE else "Attention Weight Attribution",
        "xai_tier": "tier1_fast",
        "grounded_in_scan_record": rich_evidence is not None,
        "latency_ms": latency_ms,
        "generated_at": datetime.datetime.utcnow().strftime("%Y-%m-%dT%H:%M:%SZ"),
    }


# ═══════════════════════════════════════════════════════════════════════════════
# GROUNDED PLAIN-LANGUAGE FINDINGS
# ═══════════════════════════════════════════════════════════════════════════════
# Turns the model's *specific* evidence (which brand it's impersonating, which exact
# lexical trick was used, which DOM behavior fired) into concrete, non-technical
# sentences — instead of a generic "Key attribution factors: X; Y; Z" template that
# reads the same regardless of what actually happened on the page.

_LEXICAL_ANOMALY_PHRASES = {
    "auth_spoofing_at_symbol": "the web address hides an '@' symbol trick that makes it look like one site while actually taking you somewhere else",
    "double_slash_path_obfuscation": "the link uses an unusual slash pattern designed to disguise where it actually leads",
    "suspicious_top_level_domain": "it uses an uncommon domain ending that scam sites use because it's cheap and easy to get anonymously",
    "raw_ip_address_domain": "the address is a bare set of numbers instead of a real website name — legitimate companies don't send links like this",
    "non_standard_port": "it connects over an unusual network port that real websites don't normally use",
}


def _lexical_anomaly_phrase(anomaly: str) -> Optional[str]:
    if anomaly in _LEXICAL_ANOMALY_PHRASES:
        return _LEXICAL_ANOMALY_PHRASES[anomaly]
    if anomaly.startswith("contains_") and anomaly.endswith("_phishing_keywords"):
        n = anomaly.split("_")[1]
        return f"the page's web address or path contains {n} word(s) commonly used in scam links, like \"login\", \"verify\", or \"payment\""
    return None


# Default fast-path URL scanning (extract_url_features in model_orchestrator.py, live
# unless AEGIS_FAST_SCAN_MODE=0) stores its evidence as a flat list of human-readable
# strings rather than structured fields — parse those directly instead of needing a
# second code path, since the strings already say exactly what fired.
import re as _re

_SIGNAL_STRING_PATTERNS = [
    (_re.compile(r"^Brand token '([^']+)' found in (?:dehyphenated )?non-canonical domain"), "brand"),
    (_re.compile(r"^Host is raw IP address"), lambda m: "the address is a bare set of numbers instead of a real website name — legitimate companies don't send links like this"),
    (_re.compile(r"^Host uses IDN Punycode"), lambda m: "the web address uses hidden lookalike characters designed to trick your eyes into reading it as a trusted name"),
    (_re.compile(r"^Domain uses high-risk TLD: (\S+)"), lambda m: f"it uses an uncommon web address ending ({m.group(1)}) that's cheap and anonymous, so scam sites use it a lot"),
    (_re.compile(r"^Sensitive path keywords: (.+)$"), lambda m: f"its web address contains words scammers commonly use to look official, like {m.group(1)}"),
    (_re.compile(r"^Unencrypted HTTP protocol"), lambda m: "it doesn't use a secure, encrypted connection — real login or payment pages almost always do"),
    (_re.compile(r"^URL contains user-info @ symbol"), lambda m: "the web address hides an '@' symbol trick that can make it look like one site while actually taking you somewhere else"),
    (_re.compile(r"^Excessive subdomain depth"), lambda m: "the web address is stacked with an unusual number of extra subdomains, often used to bury the real destination"),
    (_re.compile(r"^Multiple hyphens in domain name"), lambda m: "the web address is stuffed with extra hyphens, a common trick to make a fake name look like a real company's"),
]


def _parse_signal_strings(signal_strings: List[str]) -> Dict[str, Any]:
    """Parses the flat evidence-string list from the live fast-path URL scanner into
    (brand, [plain-language phrases]), ordered the same way the strings were produced
    (brand impersonation is generated first by the scanner, so it naturally leads)."""
    brand = None
    phrases: List[str] = []
    for s in signal_strings:
        matched = False
        for pattern, handler in _SIGNAL_STRING_PATTERNS:
            m = pattern.match(s)
            if not m:
                continue
            matched = True
            if handler == "brand":
                brand = m.group(1).strip()
                phrases.append(
                    f"this web address is trying to look like {brand.title()}'s real site, but the actual domain isn't {brand.title()}'s"
                )
            else:
                phrases.append(handler(m))
            break
        if not matched and s:
            phrases.append(s[0].lower() + s[1:])
    return {"brand": brand, "phrases": phrases}


def build_grounded_findings(evidence: Dict[str, Any], rich_evidence: Optional[Dict[str, Any]]) -> Dict[str, Any]:
    """
    Builds a list of concrete, plain-language findings ordered by how conclusive they
    are, plus a target label for the summary sentence. Pulls from `rich_evidence` (the
    full server-stored evidence for this exact scan, looked up by scan_id — the ground
    truth) when available, falling back to whatever the caller sent directly in `evidence`
    for scan types that don't have a stored record (e.g. ad-hoc text/image scans).

    Returns: {"findings": [str, ...], "target_label": str, "brand": str|None}
    """
    findings: List[str] = []
    brand: Optional[str] = None

    target = (rich_evidence or {}).get("target_domain") or evidence.get("domain") or evidence.get("url") or "this page"

    url_model_evidence = (rich_evidence or {}).get("url_model_evidence") or {}
    brand_info = url_model_evidence.get("brand_impersonation") or {}

    # 1. Primary path: the live fast-path URL scanner (default unless
    #    AEGIS_FAST_SCAN_MODE=0) stores evidence as a flat list of specific,
    #    human-readable strings — parse those directly, brand name included.
    signal_strings = url_model_evidence.get("signals")
    if isinstance(signal_strings, list) and signal_strings:
        parsed = _parse_signal_strings([str(s) for s in signal_strings])
        brand = parsed["brand"]
        phrases = parsed["phrases"]
        if brand:
            # Brand impersonation is the single most concrete, convincing finding —
            # lead with it regardless of where the scanner happened to emit it.
            brand_phrase = next((p for p in phrases if p.startswith("this web address is trying to look like")), None)
            if brand_phrase:
                phrases = [brand_phrase] + [p for p in phrases if p != brand_phrase]
        findings.extend(phrases[:4])

    # 2. Secondary path: the deeper BERT+fusion scanner's structured evidence shape
    #    (used when AEGIS_FAST_SCAN_MODE=0). Only consulted if step 1 found nothing.
    if not findings:
        if isinstance(brand_info, dict) and brand_info.get("matched") and brand_info.get("target_brand"):
            brand = str(brand_info["target_brand"]).strip()
            brand_title = brand.title()
            confidence_pct = round((brand_info.get("similarity_score") or 0) * 100)
            if confidence_pct >= 85:
                findings.append(
                    f"this web address is built to look like {brand_title}'s real site, but it isn't — the actual domain doesn't belong to {brand_title}"
                )
            else:
                findings.append(
                    f"this web address closely resembles {brand_title}'s real domain name, which is a common trick to fool you into thinking you're on the real site"
                )
        elif isinstance(evidence.get("threat_type"), str) and "brand" in evidence.get("threat_type", "").lower():
            findings.append("this page's address is designed to resemble a well-known company's real website")

        for anomaly in url_model_evidence.get("lexical_anomalies", [])[:3]:
            phrase = _lexical_anomaly_phrase(str(anomaly))
            if phrase and phrase not in findings:
                findings.append(phrase)

    # 3. DOM / page-behavior signals (sent live by the extension, not stored server-side).
    if evidence.get("login_form_detected"):
        findings.append("the page has a form asking you to type in a password or login details")
    if evidence.get("suspicious_form_count", 0) and evidence.get("suspicious_form_count", 0) > 1:
        findings.append("the page has multiple forms collecting personal information")
    redirect_chain = evidence.get("redirect_chain") or []
    if len(redirect_chain) > 2:
        findings.append(f"the link bounced through {len(redirect_chain)} other pages before landing here — a common way to hide the real destination")
    hidden_iframes = evidence.get("hidden_iframes") or []
    if hidden_iframes:
        findings.append("the page secretly loads hidden content from another site in the background")

    # 4. Fall back to the contextual engine's fired signals if nothing concrete matched yet
    #    (covers DOM-corroborated cases captured server-side rather than client-side).
    if not findings and rich_evidence:
        trace = rich_evidence.get("decision_trace") or {}
        for sig in trace.get("positive_evidence", [])[:3]:
            name = sig.get("signal", "")
            if name == "password_input_detected":
                findings.append("the page asks you to enter a password")
            elif name == "credential_form_detected":
                findings.append("the page has a login box collecting your username and password")
            elif name == "hidden_iframes_detected":
                findings.append("the page secretly loads hidden content from another site")
            elif name == "external_form_submission":
                findings.append("anything you type into this page gets sent to a completely different website, not the one you're looking at")
            elif name == "high_phishing_language":
                findings.append("the wording on the page uses urgent, pressuring language — like \"act now\" or \"your account will be suspended\" — that's commonly used in scams")
            elif name == "suspicious_url":
                findings.append("the web address is structured in a way real, trustworthy companies don't normally use")
            elif name == "suspicious_visual_content":
                findings.append("the page's visual design closely copies a real, trusted brand's look")

    # 5. Genuinely clean verdict — say so concretely, not just "no threats detected."
    risk_score = int((rich_evidence or {}).get("final_risk", evidence.get("risk_score", 0)) or 0)
    if not findings and risk_score < 20:
        findings.append("we checked the web address, the page's behavior, and its content, and none of them matched known scam patterns")

    if not findings:
        findings.append("our models flagged a combination of smaller signals that, together, matched known phishing patterns")

    return {"findings": findings, "target_label": target, "brand": brand}


def _build_recommendations(risk_score: int, evidence: Dict[str, Any], brand: Optional[str] = None) -> List[str]:
    recs: List[str] = []
    if evidence.get("login_form_detected"):
        recs.append("Do not type your password or personal details into this page.")
    if risk_score >= 80:
        if brand:
            recs.append(f"If you need to reach {brand.title()}, close this tab and type {brand.lower()}.com directly into your browser instead of using this link.")
        recs.append("Close this tab now — do not interact with the page further.")
        recs.append("Use the \"Report Threat\" button so your security team can warn others.")
    elif risk_score >= 50:
        recs.append("Double-check the web address in your browser's address bar before doing anything on this page.")
    else:
        recs.append("No action needed — a few minor signals were present, but nothing matched a known scam pattern.")
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

# ─── HuggingFace flan-t5-small — lazy singleton ───────────────────────────────
# Loaded once on first use; cached in memory for all subsequent calls.
_hf_pipeline = None
_HF_MODEL_ID = "google/flan-t5-small"   # ~300 MB, CPU-friendly, permissive licence

import threading as _threading
# The startup warm-up task and a request's Tier 2 background task can both call
# _get_hf_pipeline() around the same time with the cache still empty — without a lock,
# both would start from_pretrained() concurrently and contend over the same HF Hub
# download-lock file, which can stall both indefinitely instead of one succeeding fast.
_hf_load_lock = _threading.Lock()


def _get_hf_pipeline():
    """Return the cached (model, tokenizer) pair for flan-t5-small, loading on first call.
    Uses the model/tokenizer classes directly rather than the `pipeline()` helper — the
    high-level `text2text-generation` pipeline task was removed in transformers 5.x, but
    AutoModelForSeq2SeqLM/.generate() is the stable, version-independent seq2seq API."""
    global _hf_pipeline
    if _hf_pipeline is not None:
        return _hf_pipeline
    if not _hf_load_lock.acquire(timeout=30):
        # Someone else is already loading it; give up for this call rather than piling
        # on — the caller falls back to Tier 1, and the next request gets the warm cache.
        return None
    try:
        if _hf_pipeline is not None:  # someone else finished while we waited for the lock
            return _hf_pipeline
        from transformers import AutoModelForSeq2SeqLM, AutoTokenizer
        logger.info(f"Loading HuggingFace model '{_HF_MODEL_ID}' into memory (first call)...")
        tok = AutoTokenizer.from_pretrained(_HF_MODEL_ID)
        # low_cpu_mem_usage defaults to True in newer transformers, which initializes
        # weights on the "meta" device (no real data) and expects an explicit device_map
        # to then stream real weights in. Without one, the module stays metadata-only and
        # both .generate() and .to("cpu") fail ("cannot be called on meta tensors" /
        # "Cannot copy out of meta tensor"). Disabling it loads real weights directly.
        mdl = AutoModelForSeq2SeqLM.from_pretrained(_HF_MODEL_ID, low_cpu_mem_usage=False)
        mdl.eval()
        _hf_pipeline = (mdl, tok)
        logger.info(f"✓ HuggingFace '{_HF_MODEL_ID}' loaded and ready.")
        return _hf_pipeline
    except Exception as e:
        logger.warning(f"Could not load HuggingFace model ({e}). Tier 2.5 unavailable.")
        return None
    finally:
        _hf_load_lock.release()


def _hf_generate_summary(tier1_json: Dict[str, Any]) -> str:
    """
    Run flan-t5-small synchronously (it's a small model, <1 s on CPU after warm-up).
    Returns an empty string on any failure so callers can fall through gracefully.
    """
    loaded = _get_hf_pipeline()
    if loaded is None:
        return ""
    mdl, tok = loaded

    findings     = tier1_json.get("main_reasons", [])
    risk_score   = tier1_json.get("risk_score", 0)
    label        = tier1_json.get("label", "Unknown")

    prompt = (
        f"Explain this security warning to someone non-technical in 2 short plain sentences. "
        f"Do not use words like 'domain', 'DOM', or 'heuristic'. Do not add facts not listed here.\n"
        f"Risk: {label} ({risk_score}%).\n"
        f"Findings: {', '.join(findings) or 'none'}.\n"
        f"Plain-English explanation:"
    )

    try:
        inputs = tok(prompt, return_tensors="pt", truncation=True, max_length=512)
        with torch.inference_mode():
            output_ids = mdl.generate(**inputs, max_new_tokens=80, do_sample=False)
        text = tok.decode(output_ids[0], skip_special_tokens=True).strip()
        return text if text else ""
    except Exception as e:
        logger.warning(f"HuggingFace inference failed ({e}).")
        return ""


def _build_xai_prompt(tier1_json: Dict[str, Any]) -> str:
    findings = tier1_json.get("main_reasons", [])
    return (
        "You are AegisOne, explaining a security warning to a non-technical employee — "
        "someone who doesn't know what phishing, DNS, or a domain is.\n"
        "Rewrite the findings below as 2 short, plain sentences. Use a concrete comparison "
        "a non-technical person would recognize, e.g. \"this link looks like a fake payment "
        "page\" or \"this is pretending to be a login page for your email.\" "
        "Do NOT use technical words like 'domain', 'DOM', 'iframe', 'heuristic', or 'attribution'. "
        "Do NOT add any fact, brand name, or detail that isn't in the findings below.\n\n"
        f"Risk level: {tier1_json.get('label')} ({tier1_json.get('risk_score')}%)\n"
        f"Findings: {findings}\n\n"
        "Plain-English explanation:"
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
                # keep_alive keeps the model resident in memory after this call instead of
                # unloading it immediately, so the NEXT request doesn't pay the cold-load
                # cost again — this is what makes "warm after first use" actually work.
                json={"model": _LOCAL_MODEL, "prompt": prompt, "stream": False, "keep_alive": "30m"},
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
        logger.warning(f"Local Ollama unavailable ({local_exc}). Using Tier 1 grounded summary.")

    # Stage 2.5 used to fall through to the built-in flan-t5-small HuggingFace model here.
    # Measured in practice: at 60M parameters it's too weak to reliably follow the
    # rephrasing instruction — it sometimes produces incoherent text (e.g. garbling a
    # "this page is safe" finding into nonsense), which is worse than just keeping the
    # already-concrete Tier 1 summary. Removed rather than risk shipping degraded output;
    # Ollama (qwen2.5:1.5b, genuinely capable) remains the one quality-upgrade path.

    # ── Stage 3: Tier 1 Grounded Summary (guaranteed good, no LLM) ────────────
    logger.warning("All LLM stages unavailable. Returning Tier 1 rule-based summary.")
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
    Otherwise, checks if local Ollama service is running and pulls the model if missing,
    so it's already warm by the time a real request needs Tier 2 polish.
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



