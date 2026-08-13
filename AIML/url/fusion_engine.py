"""
AegisOne URL Intelligence Engine — Evidence Fusion & Decision Logic
===================================================================
Fuses neural network outputs, brand impersonation checks, and lexical features.
"""

import os
import pickle
from typing import Dict, List, Any
import torch
import numpy as np

from AIML.url.brand_engine import check_brand_impersonation
from AIML.url.lexical_engine import extract_expanded_features
from AIML.url.calibration import calibrate_probability

# Load the trained meta-classifier if available
BASE_DIR = os.path.dirname(os.path.abspath(__file__))
META_CLASSIFIER_PATH = os.path.join(BASE_DIR, "meta_classifier.pkl")

META_CLASSIFIER = None
if os.path.exists(META_CLASSIFIER_PATH):
    try:
        with open(META_CLASSIFIER_PATH, "rb") as f:
            META_CLASSIFIER = pickle.load(f)
        print("🧠 [OK] URL Meta-Classifier loaded from pkl checkpoint.")
    except Exception as e:
        print(f"⚠️ Failed to load meta-classifier pkl: {e}")

def fuse_url_intelligence(
    url: str,
    model_prediction_probs: List[float],
    brand_result: dict,
    lexical_tensor: torch.Tensor
) -> dict:
    """
    Fuses predictions, brand metrics, and lexical features into a final report.
    Implements a 3-level decision cascade:
      Level 1: Fast static whitelist / blacklist checks.
      Level 2: Structural / Brand reputation checks.
      Level 3: Calibrated Meta-Classifier (Random Forest + Sigmoid Platt).
    """
    global META_CLASSIFIER
    
    # Extract brand results
    brand_matched = brand_result.get("matched", False)
    brand_score = brand_result.get("score", 0.0)
    brand_brand = brand_result.get("matched_brand")
    brand_reason = brand_result.get("reason", "")

    # Extract lexical anomalies
    lexical_arr = lexical_tensor.numpy()
    lexical_risk = 0.0
    anomalies = []
    
    if lexical_arr[17] > 0.5:
        lexical_risk += 0.20
        anomalies.append("auth_spoofing_at_symbol")
    if lexical_arr[24] > 0.5:
        lexical_risk += 0.15
        anomalies.append("double_slash_path_obfuscation")
    if lexical_arr[28] > 0.5:
        lexical_risk += 0.25
        anomalies.append("suspicious_top_level_domain")
    if lexical_arr[30] > 0.5:
        lexical_risk += 0.35
        anomalies.append("raw_ip_address_domain")
    if lexical_arr[31] > 0.5:
        lexical_risk += 0.15
        anomalies.append("non_standard_port")
        
    kw_count = sum(lexical_arr[35:64])
    if kw_count > 0:
        lexical_risk += min(0.30, kw_count * 0.15)
        anomalies.append(f"contains_{int(kw_count)}_phishing_keywords")

    lexical_risk = min(1.0, lexical_risk)

    # ══════════════════════════════════════════════════════════════════
    # CASCADE LEVEL 1 & 2: Static Whitelist / Blacklist & Reputation
    # ══════════════════════════════════════════════════════════════════
    
    # Check if URL matches a definitive threat indicator
    is_blacklist_threat = (
        (brand_matched and brand_score >= 0.92) or  # High certainty typosquatting
        (lexical_arr[30] > 0.5 and kw_count > 0)    # Raw IP hosting a phishing page
    )
    
    if is_blacklist_threat:
        # Instant block bypass
        calibration = calibrate_probability(0.96)
        return {
            "prediction": "malicious",
            "risk_score": calibration["risk_score"],
            "category": calibration["category"],
            "confidence": calibration["confidence"],
            "explanation": f"✗ Instant Block: Verified phishing signature targeting '{brand_brand if brand_matched else 'IP domain'}'.",
            "evidence": {
                "model_malicious_probability": 0.0,
                "brand_impersonation": brand_result,
                "lexical_anomalies": anomalies,
                "structural_risk_score": round(lexical_risk, 4),
                "fusion_method": "Cascade Level 1: Static Threat Signature Override"
            }
        }

    # Check if URL is exceptionally clean (no threat signs whatsoever)
    is_structurally_clean = (
        kw_count == 0 and
        lexical_arr[28] < 0.5 and
        lexical_arr[30] < 0.5 and
        lexical_arr[17] < 0.5 and
        lexical_arr[24] < 0.5 and
        lexical_arr[31] < 0.5 and
        not brand_matched
    )

    # If the caller provides dummy/None probabilities, we can bypass BERT entirely
    if model_prediction_probs is None and is_structurally_clean:
        calibration = calibrate_probability(0.05)
        return {
            "prediction": "legitimate",
            "risk_score": calibration["risk_score"],
            "category": calibration["category"],
            "confidence": calibration["confidence"],
            "explanation": "✓ Instant Pass: Clean static structure and trusted domain verification.",
            "evidence": {
                "model_malicious_probability": 0.0,
                "brand_impersonation": brand_result,
                "lexical_anomalies": [],
                "structural_risk_score": 0.0,
                "fusion_method": "Cascade Level 2: Static Clean Pass Override"
            }
        }

    # ══════════════════════════════════════════════════════════════════
    # CASCADE LEVEL 3: Calibrated Meta-Classifier
    # ══════════════════════════════════════════════════════════════════
    if model_prediction_probs is None:
        model_prediction_probs = [1.0, 0.0, 0.0, 0.0]
        
    p_benign = model_prediction_probs[0]
    p_malicious_model = 1.0 - p_benign
    
    fused_prob = 0.0
    method = "Fallback Baseline Logic"

    if META_CLASSIFIER is not None:
        try:
            features = np.concatenate([model_prediction_probs, [brand_score], lexical_arr])
            probs_meta = META_CLASSIFIER.predict_proba([features])[0]
            fused_prob = float(probs_meta[1])
            method = "Trained Calibrated Meta-Classifier (Random Forest + Platt Sigmoid)"
        except Exception:
            META_CLASSIFIER = None

    if META_CLASSIFIER is None:
        fused_prob = p_malicious_model
        if brand_matched:
            fused_prob = max(fused_prob, brand_score)
        if lexical_risk > 0:
            fused_prob = min(1.0, fused_prob + (lexical_risk * 0.20))
            
        if is_structurally_clean and fused_prob < 0.85:
            fused_prob = min(fused_prob, 0.25)

    calibration = calibrate_probability(fused_prob)
    risk_category = calibration["category"]
    risk_score = calibration["risk_score"]
    confidence = calibration["confidence"]
    
    is_malicious = (risk_score >= 50.0)

    evidence = {
        "model_malicious_probability": round(p_malicious_model, 4),
        "brand_impersonation": {
            "matched": brand_matched,
            "target_brand": brand_brand,
            "similarity_score": round(brand_score, 4),
            "evidence_reason": brand_reason
        },
        "lexical_anomalies": anomalies,
        "structural_risk_score": round(lexical_risk, 4),
        "fusion_method": method
    }

    if is_malicious:
        if brand_matched:
            explanation = f"✗ Impersonation attempt targeting '{brand_brand}' brand (confidence: {round(confidence*100)}%)."
        elif len(anomalies) > 0:
            explanation = f"✗ Structural/lexical anomalies detected: {', '.join(anomalies[:2])}."
        else:
            explanation = "✗ Deep learning model identified semantic patterns matching threat vectors."
    else:
        explanation = "✓ Safe URL matching verified safe corporate structures."

    return {
        "prediction": "malicious" if is_malicious else "legitimate",
        "risk_score": risk_score,
        "category": risk_category,
        "confidence": confidence,
        "explanation": explanation,
        "evidence": evidence
    }
