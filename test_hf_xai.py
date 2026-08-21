"""
Quick standalone test for the HuggingFace flan-t5-small XAI integration.

Run with:
    python test_hf_xai.py

First run will download google/flan-t5-small (~300 MB) to your HuggingFace cache.
Subsequent runs will be instant.
"""

import asyncio
import sys
import os

# Make sure the api package is discoverable
sys.path.insert(0, os.path.dirname(__file__))

from api.services.xai_engine import generate_tier2_deep_explanation

# ── Mock Tier 1 payload (same shape the real engine produces) ─────────────────
MOCK_TIER1 = {
    "risk_score": 87,
    "label": "Phishing",
    "summary": "AegisOne flagged this event with a composite risk score of 87% (Phishing). Key attribution factors: Login form on suspicious domain, Excessive subdomain nesting.",
    "signals": {
        "text_tokens": [
            {"token": "verify", "score": 0.91},
            {"token": "account", "score": 0.78},
            {"token": "suspended", "score": 0.75},
        ],
        "url_features": [
            {"label": "URL is unusually long", "score": 0.88},
            {"label": "Excessive subdomain nesting", "score": 0.82},
        ],
        "rules": [
            {"reason": "Login form detected on non-HTTPS page"},
            {"reason": "Domain registered less than 30 days ago"},
        ],
    },
    "main_reasons": [
        "Login form detected on non-HTTPS page",
        "Domain registered less than 30 days ago",
    ],
    "threat_likelihood": "High Likelihood of Phishing",
    "mitre_mapping": {"technique": "T1566", "name": "Phishing"},
}


async def main():
    print("=" * 65)
    print("  AegisOne XAI — HuggingFace Tier 2.5 Test")
    print("=" * 65)
    print()
    print("[*] Sending mock Tier 1 payload to generate_tier2_deep_explanation ...")
    print("    (First run downloads flan-t5-small if not already cached)")
    print()

    result = await generate_tier2_deep_explanation(MOCK_TIER1)

    print("─" * 65)
    print(f"  Source  : {result.get('source')}")
    print(f"  Model   : {result.get('model')}")
    print(f"  XAI Tier: {result.get('xai_tier')}")
    print()
    print("  Generated Explanation:")
    print("  " + "-" * 60)
    explanation = result.get("deep_explanation", "")
    # Pretty-wrap long lines
    words = explanation.split()
    line, lines = [], []
    for w in words:
        line.append(w)
        if len(" ".join(line)) > 70:
            lines.append("  " + " ".join(line))
            line = []
    if line:
        lines.append("  " + " ".join(line))
    print("\n".join(lines))
    print("─" * 65)

    if result.get("source") == "huggingface_builtin":
        print("\n  ✅ PASS — HuggingFace flan-t5-small is working correctly!")
    elif result.get("source") == "local_llm":
        print("\n  ✅ PASS — Local Ollama answered (HF not needed today).")
    elif result.get("source") == "fallback":
        print("\n  ⚠  Fell back to Tier 1 rule-based summary.")
        print("     Make sure 'transformers' and 'sentencepiece' are installed:")
        print("     pip install transformers sentencepiece")
    print()


if __name__ == "__main__":
    asyncio.run(main())
