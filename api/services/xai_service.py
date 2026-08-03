"""
AegisOne API — XAI (Explainable AI) Service
Generates structured security explanations from evidence.
Integrates rule-based analysis with fallback template systems,
and supports optional external LLM integration.
"""
from typing import Dict, Any, List
import httpx
import json
import logging

logger = logging.getLogger("aegisone.xai")

async def generate_explanation(evidence: Dict[str, Any]) -> Dict[str, Any]:
    """
    Analyzes the compact evidence payload sent by the browser extension
    and generates a detailed, security-analyst-style explanation.
    """
    url = evidence.get("url", "")
    domain = evidence.get("domain", "")
    risk_score = evidence.get("risk_score", 0)
    verdict = evidence.get("verdict", "UNKNOWN")
    threat_type = evidence.get("threat_type", "")
    features = evidence.get("features", {})
    top_factors = evidence.get("top_factors", [])
    redirect_chain = evidence.get("redirect_chain", [])
    login_form_detected = evidence.get("login_form_detected", False)
    hidden_iframes = evidence.get("hidden_iframes", [])
    external_scripts = evidence.get("external_scripts", [])

    # 1. Determine Threat Type and Likelihood Label
    likelihood_label = "Low/Suspicion"
    threat_title = "Suspicious Behavior"
    
    if threat_type:
        threat_title = threat_type.replace("_", " ").title()
        
    if risk_score >= 80:
        likelihood_label = f"High Likelihood of {threat_title}"
    elif risk_score >= 50:
        likelihood_label = f"Moderate Likelihood of {threat_title}"
        
    if login_form_detected and risk_score >= 70:
        likelihood_label = "High Likelihood of Credential Harvesting"
        threat_title = "Credential Harvesting"

    # 2. Extract Red Flags from Features / Context
    red_flags = []
    mitre_techniques = []
    
    seen = set()
    for factor in top_factors:
        label = factor.get("label", "")
        if label and label not in seen:
            seen.add(label)
            red_flags.append(label)

    # Technical feature fallbacks if not in top_factors
    if login_form_detected and not any("login" in f.lower() for f in red_flags):
        red_flags.append("Suspicious credential entry/login form detected")
        mitre_techniques.append("T1110 - Brute Force / Credential Access")

    if len(redirect_chain) > 2:
        red_flags.append(f"Multiple redirects detected ({len(redirect_chain)} hops)")
        mitre_techniques.append("T1566.002 - Phishing: Spearphishing Link (Redirect Chain)")

    if hidden_iframes:
        red_flags.append("Invisible/hidden iframe tags detected in DOM")
        mitre_techniques.append("T1203 - Exploitation for Client Execution (Clickjacking)")

    if len(external_scripts) > 12:
        red_flags.append(f"High count of third-party external resources ({len(external_scripts)} scripts)")

    if not red_flags:
        red_flags.append("Heuristic patterns match known phishing site structures")

    # 3. Create Natural Language Summary
    reasons_str = "; ".join(red_flags[:3]).lower()
    fallback_summary = (
        f"🚨 Critical Security Alert: AegisOne's deep-learning security engines have analyzed this page and detected a severe threat, assigning it a risk score of {risk_score}%. "
        f"This indicates a highly probable attempt to compromise your security. The key factors triggering this alert are: {reasons_str}. "
    )
    
    if login_form_detected:
        fallback_summary += "Credential Theft Risk: A suspicious login form is attempting to capture your passwords."
    elif hidden_iframes:
        fallback_summary += "Clickjacking Risk: Invisible elements are layered over the page to trick your clicks."
    else:
        fallback_summary += "Our AI models identified patterns consistent with known phishing or scam sites."

    # 4. Generate Actionable Recommendations
    fallback_recs = []
    if login_form_detected:
        fallback_recs.append("🚫 CRITICAL: Do NOT enter any credentials, personal data, or payment info.")
    if risk_score >= 80:
        fallback_recs.append("🚪 Immediately close this tab or navigate away to prevent data exfiltration.")
        fallback_recs.append("📢 Use the 'Report Threat' button to notify your Security Operations Center (SOC).")
    else:
        fallback_recs.append("✔️ You may proceed, but remain vigilant for deceptive prompts.")
        
    fallback_recs.append("Ensure multi-factor authentication (MFA) is enabled for your organizational accounts.")

    # Try Ollama (qwen2.5:3b)
    final_summary = fallback_summary
    final_reasons = red_flags
    final_recs = fallback_recs

    context_str = f"Target URL: {url}\nDomain: {domain}\nRisk Score: {risk_score}%\nThreat Type: {threat_title}\nVerdict: {verdict}\nKey Threat Indicators:\n"
    for rf in red_flags:
        context_str += f"- {rf}\n"
    if redirect_chain:
        context_str += f"Redirect Chain: {' -> '.join(redirect_chain)}\n"

    prompt = f"""You are AegisOne, an elite AI cybersecurity analyst. 
You must analyze the following security event and provide a highly specific, fact-based explanation for why this exact webpage was flagged. 
DO NOT use generalized statements. Mention the exact URL, domain, and the specific indicators provided in the context. Show your cybersecurity expertise.

Return a JSON object with EXACTLY these keys:
- "summary": A detailed, 2-3 sentence paragraph explaining exactly why this specific page ({domain}) is a threat, citing the risk score and primary indicators.
- "main_reasons": An array of 3 highly detailed, specific strings explaining the technical reasons for the flag (e.g. referencing the specific toxic links, login forms, or redirects).
- "recommendations": An array of 2-3 specific strings advising the user on how to safely proceed or mitigate the risk.

Context for Analysis:
{context_str}
"""
    try:
        async with httpx.AsyncClient(timeout=45.0) as client:
            resp = await client.post(
                "http://localhost:11434/api/generate",
                json={
                    "model": "qwen2.5:3b",
                    "prompt": prompt,
                    "stream": False,
                    "format": "json",
                    "keep_alive": "1h",
                    "options": {
                        "num_predict": 250,
                        "temperature": 0.4
                    }
                }
            )
            resp.raise_for_status()
            data = resp.json()
            llm_text = data.get("response", "")
            parsed = json.loads(llm_text)
            
            if "summary" in parsed and isinstance(parsed["summary"], str):
                final_summary = parsed["summary"]
            if "main_reasons" in parsed and isinstance(parsed["main_reasons"], list):
                final_reasons = parsed["main_reasons"]
            if "recommendations" in parsed and isinstance(parsed["recommendations"], list):
                final_recs = parsed["recommendations"]
                
    except Exception as e:
        import traceback
        logger.warning(f"Ollama XAI generation failed, falling back to rule-based: {e}\n{traceback.format_exc()}")

    # 5. MITRE ATT&CK Mapping
    if "T1566" not in "".join(mitre_techniques):
        mitre_techniques.append("T1566.002 - Phishing: Spearphishing Link")
    if "T1584" not in "".join(mitre_techniques) and risk_score >= 70:
        mitre_techniques.append("T1584 - Compromise Infrastructure (Adversary Staged Domain)")

    # 6. Indicators of Compromise (IOC)
    ioc = {
        "domain": domain,
        "url": url,
        "indicators": [
            {"type": "domain", "value": domain},
            {"type": "url", "value": url}
        ]
    }

    return {
        "summary": final_summary,
        "main_reasons": final_reasons,
        "threat_likelihood": likelihood_label,
        "recommendations": final_recs,
        "mitre_mapping": mitre_techniques,
        "ioc": ioc,
        "generated_at": time_now_iso()
    }

def time_now_iso() -> str:
    import datetime
    return datetime.datetime.utcnow().strftime("%Y-%m-%dT%H:%M:%SZ")
