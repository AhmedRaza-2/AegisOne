import json
from api.services.contextual_risk_engine import ContextualRiskEngine

# Mocking a simple adversarial harness
def run_adversarial_suite():
    engine = ContextualRiskEngine()
    
    # Define our 20 scenarios
    scenarios = [
        {
            "name": "1. Fake login, same-origin POST",
            "evidence": {
                "text": {"available": True, "risk": 98.0},
                "url": {"available": True, "risk": 20.0},
                "dom": {"available": True, "signals": {"password_inputs": 1, "credential_forms": 1, "external_form_actions": 0}}
            },
            "expected_decision": "BLOCK"
        },
        {
            "name": "2. Fake login, cross-origin POST",
            "evidence": {
                "text": {"available": True, "risk": 99.0},
                "url": {"available": True, "risk": 25.0},
                "dom": {"available": True, "signals": {"password_inputs": 1, "credential_forms": 1, "external_form_actions": 1}}
            },
            "expected_decision": "BLOCK"
        },
        {
            "name": "3. Fake login using JS fetch()",
            "evidence": {
                "text": {"available": True, "risk": 92.0},
                "url": {"available": True, "risk": 30.0},
                "dom": {"available": True, "signals": {"password_inputs": 1, "credential_forms": 0, "has_sensitive_action": True}} # No explicit form, just input
            },
            "expected_decision": "BLOCK"
        },
        {
            "name": "4. Fake login with no <form>",
            "evidence": {
                "text": {"available": True, "risk": 95.0},
                "dom": {"available": True, "signals": {"password_inputs": 1, "credential_forms": 0}}
            },
            "expected_decision": "BLOCK"
        },
        {
            "name": "6. OAuth impersonation",
            "evidence": {
                "text": {"available": True, "risk": 85.0},
                "visual": {"available": True, "risk": 92.0}, # Brand spoof
                "dom": {"available": True, "signals": {"has_sensitive_action": True, "credential_forms": 0}}
            },
            "expected_decision": "BLOCK"
        },
        {
            "name": "7. Brand impersonation without credentials",
            "evidence": {
                "visual": {"available": True, "risk": 95.0},
                "dom": {"available": True, "signals": {"password_inputs": 0, "credential_forms": 0}}
            },
            "expected_decision": "BLOCK"
        },
        {
            "name": "8. Malicious URL with completely innocent text",
            "evidence": {
                "text": {"available": True, "risk": 5.0},
                "url": {"available": True, "risk": 95.0, "source_type": "known_malicious", "confidence": 0.95},
                "dom": {"available": True, "signals": {"password_inputs": 0}}
            },
            "expected_decision": "BLOCK"
        },
        {
            "name": "17. Legitimate security documentation",
            "evidence": {
                "text": {"available": True, "risk": 96.0},
                "url": {"available": True, "risk": 5.0},
                "visual": {"available": False},
                "dom": {"available": True, "signals": {"password_inputs": 0, "credential_forms": 0}}
            },
            "expected_decision": "SAFE" # or SUSPICIOUS
        },
        {
            "name": "18. Legitimate banking login",
            "evidence": {
                "text": {"available": True, "risk": 40.0},
                "url": {"available": True, "risk": 2.0},
                "dom": {"available": True, "signals": {"password_inputs": 1, "credential_forms": 1, "external_form_actions": 0}}
            },
            "expected_decision": "SAFE"
        },
        {
            "name": "20. Cybersecurity marketing page",
            "evidence": {
                "text": {"available": True, "risk": 99.0}, # Max semantic risk
                "url": {"available": True, "risk": 5.0},
                "dom": {"available": True, "signals": {"password_inputs": 0}}
            },
            "expected_decision": "SAFE" # Should trigger contradiction
        }
    ]
    
    print("--- RUNNING ADVERSARIAL ENGINE SUITE ---")
    passed = 0
    for idx, case in enumerate(scenarios):
        res = engine.resolve(case["evidence"])
        match = res["decision"] == case["expected_decision"] or (case["expected_decision"] == "SAFE" and res["decision"] == "SUSPICIOUS")
        status = "✅ PASS" if match else f"❌ FAIL (Expected: {case['expected_decision']}, Got: {res['decision']})"
        if match: passed += 1
        print(f"{case['name']:<50} | {status}")
        
    print(f"\nResults: {passed}/{len(scenarios)} passed.")

if __name__ == "__main__":
    run_adversarial_suite()
