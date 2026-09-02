import pytest
import asyncio
from api.services.model_orchestrator import _predict_url_sync, FAST_SCAN_MODE, MODELS
from AIML.url.brand_engine import clean_homoglyphs, check_brand_impersonation
from api.services.contextual_risk_engine import ContextualRiskEngine

# 1. Fast Scan Runs Without Neural Model
def test_fast_scan_runs_without_neural_model(monkeypatch):
    # Simulate missing neural model
    monkeypatch.setitem(MODELS, "url", None)
    monkeypatch.delitem(MODELS, "url", raising=False)
    
    # Fast scan should still successfully process an obvious phishing URL
    url = "http://microsoft-office365-upgrade.site"
    result = _predict_url_sync(url)
    
    assert "error" not in result
    assert result.get("prediction") == "phishing"
    assert result.get("phishing_probability", 0) >= 0.85

# 2. Brand Impersonation With Lure Blocks
@pytest.mark.parametrize("url", [
    "http://microsoft-office365-upgrade.site",
    "http://bankofamerica-access-online-portal.gq",
    "http://citibank-cardmember-login-security.net",
    "http://linkedin-job-apply-interview-portal.online",
])
def test_brand_impersonation_with_lure_blocks(url):
    result = _predict_url_sync(url)
    assert result.get("phishing_probability", 0) >= 0.85

# 3. Canonical Domains Remain Safe
@pytest.mark.parametrize("url", [
    "https://microsoft.com",
    "https://google.com",
    "https://paypal.com",
    "https://linkedin.com",
    "https://citibank.com",
])
def test_official_domains_not_marked_as_impersonation(url):
    result = check_brand_impersonation(url)
    assert result.get("matched") is False

# 4. Homoglyph Normalization Idempotency
@pytest.mark.parametrize("value", [
    "citibank", "microsoft", "linkedin", "paypal", "apple", "google", "office365"
])
def test_normalization_is_idempotent(value):
    normalized_once = clean_homoglyphs(value)
    normalized_twice = clean_homoglyphs(normalized_once)
    assert normalized_once == normalized_twice
    # Also verify that replacing circular homoglyphs didn't destroy letters
    assert normalized_once == value.lower()

# 6. Model Failure Does Not Become Default Risk
def test_model_failure_does_not_become_default_risk():
    # Simulate an error response from the neural layer
    engine = ContextualRiskEngine()
    
    evidence_envelope = {
        "url": { "available": False, "risk": 0.0, "error": "URL model not loaded" },
        "text": { "available": False, "risk": 0.0 },
        "visual": { "available": False, "risk": 0.0 },
        "dom": { "available": False, "signals": {} }
    }
    
    result = engine.resolve(evidence_envelope)
    # The system shouldn't invent a risk score out of thin air (like 40.0)
    assert result["final_risk"] == 0.0
    assert result["decision"] == "SAFE"

# 7. Single Verdict Authority
def test_only_canonical_decision_engine_generates_verdict():
    # Check that model_orchestrator returns probabilities/scores, NOT verdicts
    url = "http://microsoft-office365-upgrade.site"
    result = _predict_url_sync(url)
    
    # Should contain prediction/probability/category, but NOT SAFE/WARN/BLOCK
    assert "decision" not in result
    assert result.get("prediction") in ["phishing", "legitimate"]
    
    # The actual verdict comes from DecisionPolicy via ContextualRiskEngine
    engine = ContextualRiskEngine()
    evidence_envelope = {
        "url": { 
            "available": True, 
            "risk": result.get("phishing_probability", 0) * 100,
            "results": [{
                "brand_impersonation": result.get("brand_impersonation", False),
                "credential_lure_detected": result.get("credential_lure_detected", False),
            }]
        },
        "text": { "available": False, "risk": 0.0 },
        "visual": { "available": False, "risk": 0.0 },
        "dom": { "available": False, "signals": {} }
    }
    
    ctx_result = engine.resolve(evidence_envelope)
    assert ctx_result["decision"] in ["SAFE", "SUSPICIOUS", "BLOCK"]

# 8. Benchmark Regression Snapshot
def test_benchmark_regression_snapshot():
    import os
    import json
    
    # Load the latest benchmark report
    report_path = os.path.join("tests", "results", "latest_report.json")
    if not os.path.exists(report_path):
        pytest.skip("No benchmark report found to compare against.")
        
    with open(report_path, "r", encoding="utf-8") as f:
        data = json.load(f)
        
    # Baseline expected values (100% on current 100-sample set)
    # The actual constraint: Recall >= 1.0 (or baseline), FPR <= 0.0
    
    combined = data.get("combined", {})
    recall = combined.get("recall", 0.0)
    fpr = combined.get("fpr", 1.0)
    
    # Ensure our structural accuracy hasn't degraded
    assert recall >= 1.0, f"Recall degraded: {recall} < 1.0"
    assert fpr <= 0.0, f"False Positive Rate increased: {fpr} > 0.0"

