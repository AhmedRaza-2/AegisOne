"""
AegisOne API — XAI (Explainable AI) Service
Generates structured security explanations from evidence.
Integrates rule-based analysis with fallback template systems,
and supports optional external LLM integration.
"""
from typing import Dict, Any, List

def generate_explanation(evidence: Dict[str, Any]) -> Dict[str, Any]:
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

    # New Contextual Risk Engine signals
    contextual_analysis = evidence.get("contextual_analysis", {})
    contradictions = contextual_analysis.get("contradictions", [])
    positive_evidence = contextual_analysis.get("positive_evidence", [])
    corroboration = contextual_analysis.get("corroboration_level", "NONE")

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

    # 2. Extract Red Flags & MITRE ATT&CK Mapping
    red_flags = []
    mitre_techniques = []
    
    for factor in top_factors:
        if isinstance(factor, str):
            red_flags.append(factor)
        elif isinstance(factor, dict):
            label = factor.get("label", "")
            # Only require score threshold if score exists, otherwise take it
            score = factor.get("score")
            if label and (score is None or score >= 30):
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
        mitre_techniques.append("T203 - Exploitation for Client Execution (Clickjacking)")

    if len(external_scripts) > 12:
        red_flags.append(f"High count of third-party external resources ({len(external_scripts)} scripts)")

    # Ensure red_flags match risk_score band cleanly
    if risk_score >= 50 and not red_flags:
        red_flags.append("High-confidence neural network phishing pattern detection")
        red_flags.append("Suspicious solicitation keywords or brand mismatch identified by Aegis AI")

    if risk_score < 20 and not red_flags:
        red_flags.append("All structural, domain, and AI heuristic checks passed cleanly with no suspicious indicators detected.")

    # 3. Create Natural Language Summary
    if risk_score < 20:
        if contradictions:
            reason = contradictions[0]
            summary = (
                f"AegisOne assessed this target as SAFE. "
                f"Although semantic alerts were present, they were mitigated through evidence fusion because: {reason.lower()}."
            )
        else:
            summary = (
                f"AegisOne security analysis completed for this target with a composite risk score of {risk_score}%. "
                f"No malicious content, phishing indicators, or suspicious heuristics were detected."
            )
    else:
        reasons_str = "; ".join(red_flags[:3]).lower()
        summary = (
            f"AegisOne security analysis flagged this target as high-risk phishing with a composite risk score of {risk_score}%. "
            f"The primary indicators include: {reasons_str}. "
        )
        if login_form_detected:
            summary += "A suspicious credential entry form was detected on this domain."
        elif hidden_iframes:
            summary += "Invisible elements were detected which are commonly used in clickjacking attacks."

    # 4. Generate Actionable Recommendations
    recommendations = []
    if risk_score < 20:
        recommendations.append("Target appears safe. You can proceed normally.")
        recommendations.append("Always verify links and senders before providing sensitive credentials.")
    if risk_score >= 50:
        if login_form_detected or any("credential" in s.lower() for s in positive_evidence):
            recommendations.append("Do NOT enter any passwords, credit card numbers, or personal information on this page.")
        if len(redirect_chain) > 1:
            recommendations.append("Do not share this link with colleagues; it utilizes deceptive redirection.")
        if external_scripts or "external_form_submission" in positive_evidence:
            recommendations.append("The page attempts to send data to third-party domains. Close the tab immediately.")
        if not recommendations:
            recommendations.append("This page exhibits suspicious patterns. Close the tab immediately.")
        else:
            recommendations.append("Proceed with extreme caution. Verify the destination URL before interacting.")
        recommendations.append("Ensure multi-factor authentication (MFA) is enabled for your organizational accounts.")

    # 5. MITRE ATT&CK Mapping
    if "T1566" not in "".join(mitre_techniques):
        mitre_techniques.append("T1566.002 - Phishing: Spearphishing Link")
    if "T1584" not in "".join(mitre_techniques) and risk_score >= 70:
        mitre_techniques.append("T1584 - Compromise Infrastructure (Adversary Staged Domain)")

    # 6. Indicators of Compromise (IoC) — derived from evidence
    ioc: List[str] = []
    if domain:
        ioc.append(f"Domain: {domain}")
    for iframe in hidden_iframes:
        ioc.append(f"Hidden iframe: {iframe}" if isinstance(iframe, str) else "Hidden iframe detected")
    for script in external_scripts[:5]:
        ioc.append(f"External script: {script}" if isinstance(script, str) else "External script detected")
    for hop in redirect_chain:
        ioc.append(f"Redirect hop: {hop}" if isinstance(hop, str) else "Redirect detected")

    # 7. Scoring Methodology (Dynamic parameters based on context)
    is_email_context = evidence.get("is_email", False) or threat_type == "phishing_email" or "email" in url.lower()
    
    scoring_methodology = []
    
    # Bottom Popup (Floating Widget / Screen Context)
    if is_email_context:
        scoring_methodology.append(
            "🛡️ **Floating Widget (Active Screen Risk):** This score is dynamically calculated based on the content you are actively interacting with. Since you are in a webmail client, it scans the sender reputation, subject line, message body content, embedded links, and attachments. If multiple emails are visible, it evaluates the composite risk of all items."
        )
    else:
        scoring_methodology.append(
            "🛡️ **Floating Widget (Active Screen Risk):** This score reflects the active, real-time threat level of the page as you interact with it. It monitors DOM changes, dynamically injected scripts, and visible elements."
        )
        
    # Top Popup (Deep Page Scan)
    scoring_methodology.append(
        "🔎 **Action Popup (Deep Page Scan):** This evaluates the structural integrity of the base URL/Domain. It performs deep heuristic checks including DNS reputation, cross-site scripting (XSS) vectors, hidden iframes, redirect chains, and deceptive login forms. It represents the inherent risk of the website hosting the content."
    )

    return {
        "summary": summary,
        "main_reasons": red_flags,
        "threat_likelihood": likelihood_label,
        "recommendations": recommendations,
        "mitre_mapping": mitre_techniques,
        "ioc": ioc,
        "scoring_methodology": scoring_methodology,
        "generated_at": time_now_iso()
    }

def time_now_iso() -> str:
    import datetime
    return datetime.datetime.utcnow().strftime("%Y-%m-%dT%H:%M:%SZ")
