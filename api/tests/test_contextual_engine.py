from api.services.contextual_risk_engine import ContextualRiskEngine

def test_independent_url_block():
    engine = ContextualRiskEngine()
    evidence = {
        "url": { "available": True, "risk": 95.0, "confidence": 0.95, "source_type": "known_malicious" },
        "text": { "available": False, "risk": 0.0 },
        "visual": { "available": False, "risk": 0.0 },
        "dom": { "available": False, "signals": {} }
    }
    res = engine.resolve(evidence)
    assert res["decision"] == "BLOCK"
    assert res["final_risk"] == 95.0
    assert res["block_eligible"] == True

def test_heuristic_url_not_independent_block():
    engine = ContextualRiskEngine()
    evidence = {
        "url": { "available": True, "risk": 95.0, "confidence": 0.95, "source_type": "heuristic_ml" },
        "text": { "available": False, "risk": 0.0 },
        "visual": { "available": False, "risk": 0.0 },
        "dom": { "available": False, "signals": {} }
    }
    res = engine.resolve(evidence)
    # Heuristic URL with 95 risk + 25 modifier = 120 (100) -> BLOCK, but NOT independent.
    assert res["decision"] == "BLOCK"
    assert res["final_risk"] == 100.0
    assert res["block_eligible"] == True
    assert "known malicious" not in str(res.get("contextual_analysis", {}).get("positive_evidence", []))

def test_semantic_only_not_block():
    engine = ContextualRiskEngine()
    # High text risk, but no other evidence available
    evidence = {
        "url": { "available": False },
        "text": { "available": True, "risk": 96.0 },
        "visual": { "available": False },
        "dom": { "available": False }
    }
    res = engine.resolve(evidence)
    assert res["decision"] == "SUSPICIOUS" # Must not block
    assert res["block_eligible"] == False
    assert res["scan_completeness"] == "TEXT_ONLY"

def test_contradiction_logic_with_missing_vision():
    engine = ContextualRiskEngine()
    # High text risk, BUT we HAVE DOM evidence which shows NO forms, 
    # and we HAVE URL evidence which shows LOW risk
    # Visual is unavailable (this used to break contradiction logic)
    evidence = {
        "url": { "available": True, "risk": 10.0, "confidence": 0.9, "source_type": "heuristic_ml" },
        "text": { "available": True, "risk": 96.0 },
        "visual": { "available": False },
        "dom": { "available": True, "signals": { "credential_forms": 0, "password_inputs": 0 } }
    }
    res = engine.resolve(evidence)
    assert res["decision"] == "SAFE" or res["decision"] == "SUSPICIOUS"
    assert "not corroborated" in str(res["contextual_analysis"]["contradictions"])
    assert res["block_eligible"] == False

def test_decision_trace_structure():
    engine = ContextualRiskEngine()
    evidence = {
        "url": { "available": True, "risk": 15.0, "confidence": 0.9, "source_type": "heuristic_ml" },
        "text": { "available": True, "risk": 85.0 },
        "visual": { "available": False },
        "dom": { "available": True, "signals": { "password_inputs": 1, "credential_forms": 1 } }
    }
    res = engine.resolve(evidence)
    assert "decision_trace" in res
    trace = res["decision_trace"]
    assert "raw_scores" in trace
    assert trace["raw_scores"]["text"] == 85.0
    assert trace["raw_scores"]["url"] == 15.0
    assert "available_modalities" in trace
    assert "normalized_weights" in trace
    assert "base_risk" in trace
    assert "positive_evidence" in trace
    assert "block_eligibility" in trace
