from dataclasses import dataclass, field
from typing import Dict, List, Any, Optional

@dataclass
class Evidence:
    semantic_risk: float
    url_risk: float
    visual_risk: float

    password_inputs: int = 0
    credential_forms: int = 0
    external_form_actions: int = 0
    hidden_iframes: int = 0
    total_iframes: int = 0
    email_inputs: int = 0
    
    suspicious_input_names: List[str] = field(default_factory=list)
    has_login_keywords: bool = False
    has_urgency_keywords: bool = False
    has_sensitive_action: bool = False
    page_redirect_detected: bool = False

    suspicious_url_indicators: int = 0
    brand_impersonation: bool = False


class ContextualRiskEngine:

    def resolve(self, evidence: Dict[str, Any]) -> Dict[str, Any]:
        """
        Expects an evidence envelope:
        {
          "url": { "available": bool, "risk": float, "confidence": float, "source_type": str, "results": list },
          "text": { "available": bool, "risk": float },
          "visual": { "available": bool, "risk": float },
          "dom": { "available": bool, "signals": dict }
        }
        """
        
        # 1. Parse Available Evidence
        url_ev = evidence.get("url", {"available": False})
        text_ev = evidence.get("text", {"available": False})
        visual_ev = evidence.get("visual", {"available": False})
        dom_ev = evidence.get("dom", {"available": False})
        
        url_available = url_ev.get("available", False)
        text_available = text_ev.get("available", False)
        visual_available = visual_ev.get("available", False)
        dom_available = dom_ev.get("available", False)
        
        url_risk = url_ev.get("risk", 0.0) if url_available else 0.0
        text_risk = text_ev.get("risk", 0.0) if text_available else 0.0
        visual_risk = visual_ev.get("risk", 0.0) if visual_available else 0.0
        dom_signals = dom_ev.get("signals", {}) if dom_available else {}
        
        positive_signals = []
        contradictions = []
        
        # 2. Check for Independent High-Confidence Escalation
        if url_available and url_risk >= 90:
            confidence = url_ev.get("confidence", 0.0)
            source_type = url_ev.get("source_type", "heuristic_ml")
            
            # Known malicious intelligence can independently BLOCK
            if source_type == "known_malicious" and confidence >= 0.90:
                return self._build_independent_block(
                    reason="Known malicious URL intelligence",
                    evidence_type="url",
                    risk=url_risk,
                    raw_scores={"url": url_risk, "text": text_risk, "visual": visual_risk},
                    completeness=self._determine_completeness(url_available, text_available, visual_available, dom_available)
                )

        if visual_available and visual_risk >= 90:
            # Strong visual brand impersonation can independently BLOCK
            return self._build_independent_block(
                reason="High-confidence visual brand impersonation",
                evidence_type="visual",
                risk=visual_risk,
                raw_scores={"url": url_risk, "text": text_risk, "visual": visual_risk},
                completeness=self._determine_completeness(url_available, text_available, visual_available, dom_available)
            )

        # 3. Calculate Normalized Base Risk
        available_weights = []
        if text_available:
            available_weights.append(("text", text_risk, 0.30))
        if url_available:
            available_weights.append(("url", url_risk, 0.35))
        if visual_available:
            available_weights.append(("visual", visual_risk, 0.20))
            
        if available_weights:
            base_risk = sum(score * weight for _, score, weight in available_weights) / sum(weight for _, _, weight in available_weights)
        else:
            base_risk = 0.0
            
        # 4. Extract Contextual Modifiers
        if text_available and text_risk >= 80:
            positive_signals.append({"type": "semantic", "signal": "high_phishing_language", "strength": "medium", "impact": "+15"})

        if dom_available:
            is_safe_url = url_available and url_risk < 20
            form_penalty_scale = 0.2 if is_safe_url else 1.0
            sso_scale = 0.5 if is_safe_url else 1.0

            has_pwd = dom_signals.get("password_inputs", 0) > 0 or dom_signals.get("has_password", False)
            has_form = dom_signals.get("credential_forms", 0) > 0 or dom_signals.get("has_form", False) or dom_signals.get("login_form_found", False)
            has_hidden_iframe = dom_signals.get("hidden_iframes", 0) > 0 or dom_signals.get("hidden_iframe", False)
            has_external_action = dom_signals.get("external_form_actions", 0) > 0
            
            if has_pwd:
                impact = int(20 * form_penalty_scale)
                # Password input is high strength only if URL has baseline risk >= 30 or brand mismatch
                pwd_strength = "high" if (url_risk >= 30 or not is_safe_url) else "medium"
                positive_signals.append({"type": "structural", "signal": "password_input_detected", "strength": pwd_strength, "impact": f"+{impact}"})
            if has_form:
                impact = int(25 * form_penalty_scale)
                positive_signals.append({"type": "structural", "signal": "credential_form_detected", "strength": "medium", "impact": f"+{impact}"})
            if has_hidden_iframe:
                iframe_strength = "high" if (url_risk >= 30 or not is_safe_url) else "medium"
                positive_signals.append({"type": "structural", "signal": "hidden_iframes_detected", "strength": iframe_strength, "impact": "+10"})
            if has_external_action:
                impact = int(30 * sso_scale)
                positive_signals.append({"type": "behavioral", "signal": "external_form_submission", "strength": "critical", "impact": f"+{impact}"})
            if dom_signals.get("has_sensitive_action", False):
                positive_signals.append({"type": "semantic", "signal": "sensitive_action_requested", "strength": "medium", "impact": "+10"})

        if url_available and url_risk >= 70:
            positive_signals.append({"type": "url", "signal": "suspicious_url", "strength": "high", "impact": "+25"})

        if visual_available and visual_risk >= 70:
            positive_signals.append({"type": "visual", "signal": "suspicious_visual_content", "strength": "high", "impact": "+20"})

        # 5. Contradiction Analysis
        contextual_modifier = sum(int(sig.get("impact", "+0").replace("+", "")) for sig in positive_signals)
        
        # Only check contradictions if we have the evidence to contradict it
        if text_available and text_risk >= 80:
            has_structural_ev = dom_available and any(s["type"] in ["structural", "behavioral"] for s in positive_signals)
            has_url_ev = url_available and url_risk >= 50
            has_visual_ev = visual_available and visual_risk >= 50
            
            # If at least one independent modality is available AND none of the available ones corroborate the semantic risk
            independent_available = dom_available or url_available or visual_available
            all_available_negative = True
            
            if dom_available and has_structural_ev:
                all_available_negative = False
            if url_available and has_url_ev:
                all_available_negative = False
            if visual_available and has_visual_ev:
                all_available_negative = False
                
            if independent_available and all_available_negative:
                contradictions.append("High semantic risk is not corroborated by structural, URL, or visual evidence")
                # Deduct heavily but leave a baseline for suspicion (e.g. 15-30) rather than 0
                contextual_modifier -= (text_risk * 0.4) 

        # 6. Final Risk Calculation
        final_risk = min(max(base_risk + contextual_modifier, 0), 100)
        
        # Block eligibility determination
        # DOM is only strong if password input on non-safe URL, external form submission, or hidden clickjacking iframe is present
        has_strong_dom = dom_available and any(s["strength"] in ["high", "critical"] for s in positive_signals if s["type"] in ["structural", "behavioral"])

        # URL-Only Multi-Signal Block Path:
        # DOM corroboration is NOT required when multiple independent URL-level signals agree.
        # This prevents the "dead phishing infrastructure" blind spot where offline pages
        # cannot be scanned for DOM evidence.
        url_first_result = url_ev.get("results", [{}])[0] if url_ev.get("results") else {}
        url_brand_impersonation = url_first_result.get("brand_impersonation", False)
        url_credential_lure = url_first_result.get("credential_lure_detected", False)
        url_suspicious_tld = url_first_result.get("suspicious_tld", False)

        # Multi-signal URL block conditions (user-proposed architecture):
        url_strong_signals = sum([url_brand_impersonation, url_credential_lure])
        url_medium_signals = sum([url_suspicious_tld])

        has_strong_url = url_available and (
            url_risk >= 70 or                                              # Legacy high-score gate
            (url_brand_impersonation and url_credential_lure) or          # BRAND_PLUS_CREDENTIAL_LURE
            (url_strong_signals >= 2) or                                   # MULTI_SIGNAL_URL_PHISHING
            (url_strong_signals >= 1 and url_medium_signals >= 1 and url_risk >= 30)  # SIGNAL_PLUS_TLD_CORROBORATION
        )

        block_eligible = has_strong_dom or has_strong_url
        if block_eligible:
            final_risk = max(final_risk, 80.0)
        
        if final_risk >= 75:
            if block_eligible:
                decision = "BLOCK"
                confidence = 0.90
            else:
                decision = "SUSPICIOUS"
                confidence = 0.60
            corroboration = "HIGH" if len(positive_signals) >= 2 else "MEDIUM"
        elif final_risk >= 40:
            decision = "SUSPICIOUS"
            confidence = 0.60
            corroboration = "LOW"
        else:
            decision = "SAFE"
            confidence = 0.95
            corroboration = "NONE"
            # Ensure semantic risk isn't completely erased if it exists
            if contradictions and text_risk >= 80:
                final_risk = max(final_risk, 15.0)
                decision = "SAFE" # Still safe but with residual risk mapped for XAI
                confidence = 0.70

        # Construct decision trace for diagnostic telemetry
        available_modalities = []
        if text_available: available_modalities.append("text")
        if url_available: available_modalities.append("url")
        if visual_available: available_modalities.append("visual")
        if dom_available: available_modalities.append("dom")

        total_avail_weight = sum(weight for _, _, weight in available_weights) if available_weights else 1.0
        normalized_weights = {mod: round(weight / total_avail_weight, 4) for mod, _, weight in available_weights}

        block_reasons = []
        if has_strong_dom: block_reasons.append("strong_dom_signals")
        if has_strong_url:
            if url_risk >= 70:
                block_reasons.append("url_score_threshold")
            if url_brand_impersonation and url_credential_lure:
                block_reasons.append("brand_plus_credential_lure")
            if url_strong_signals >= 1 and url_medium_signals >= 1:
                block_reasons.append("signal_plus_tld_corroboration")

        decision_trace = {
            "raw_scores": {
                "text": round(text_risk, 2) if text_available else None,
                "url": round(url_risk, 2) if url_available else None,
                "visual": round(visual_risk, 2) if visual_available else None
            },
            "available_modalities": available_modalities,
            "normalized_weights": normalized_weights,
            "base_risk": round(base_risk, 2),
            "positive_evidence": positive_signals,
            "negative_evidence": contradictions,
            "dom_evidence": dom_signals,
            "block_eligibility": {
                "eligible": block_eligible,
                "reasons": block_reasons
            },
            "contextual_modifier": round(contextual_modifier, 2),
            "final_risk": round(final_risk, 2)
        }

        return {
            "final_risk": round(final_risk, 2),
            "decision": decision,
            "confidence": confidence,
            "scan_completeness": self._determine_completeness(url_available, text_available, visual_available, dom_available),
            "block_eligible": block_eligible,
            "raw_scores": {
                "text": round(text_risk, 2) if text_available else None,
                "url": round(url_risk, 2) if url_available else None,
                "visual": round(visual_risk, 2) if visual_available else None
            },
            "evidence_summary": {
                "semantic": "HIGH" if text_risk >= 75 else ("MEDIUM" if text_risk >= 40 else "LOW") if text_available else "UNAVAILABLE",
                "url": "HIGH" if url_risk >= 75 else ("MEDIUM" if url_risk >= 40 else "LOW") if url_available else "UNAVAILABLE",
                "structural": "HIGH" if any(s["type"] == "structural" for s in positive_signals) else ("LOW" if dom_available else "UNAVAILABLE"),
                "visual": "HIGH" if visual_risk >= 75 else ("LOW" if visual_available else "UNAVAILABLE")
            },
            "contextual_analysis": {
                "corroboration_level": corroboration,
                "positive_evidence": [s["signal"] for s in positive_signals],
                "contradictions": contradictions
            },
            "top_reasons": [{"signal": sig["signal"], "impact": sig.get("impact", "+10")} for sig in positive_signals],
            "reason": contradictions[0] if contradictions and decision == "SAFE" else "Risk assessed based on evidence fusion",
            "decision_trace": decision_trace
        }

    def _determine_completeness(self, url: bool, text: bool, visual: bool, dom: bool) -> str:
        if url and text and visual and dom:
            return "FULL"
        if url and not text and not visual and not dom:
            return "URL_ONLY"
        if text and not url and not visual and not dom:
            return "TEXT_ONLY"
        return "PARTIAL"

    def _build_independent_block(self, reason: str, evidence_type: str, risk: float, raw_scores: dict, completeness: str) -> dict:
        return {
            "final_risk": risk,
            "decision": "BLOCK",
            "confidence": 0.99,
            "scan_completeness": completeness,
            "block_eligible": True,
            "raw_scores": raw_scores,
            "evidence_summary": {
                "semantic": "UNAVAILABLE",
                "url": "HIGH" if evidence_type == "url" else "UNAVAILABLE",
                "structural": "UNAVAILABLE",
                "visual": "HIGH" if evidence_type == "visual" else "UNAVAILABLE"
            },
            "contextual_analysis": {
                "corroboration_level": "INDEPENDENT_CERTAINTY",
                "positive_evidence": [reason],
                "contradictions": []
            },
            "top_reasons": [{"signal": reason, "impact": "INDEPENDENT_BLOCK"}],
            "reason": reason,
            "decision_trace": {
                "raw_scores": raw_scores,
                "available_modalities": [evidence_type],
                "normalized_weights": {evidence_type: 1.0},
                "base_risk": risk,
                "positive_evidence": [{"signal": reason, "impact": "INDEPENDENT_BLOCK"}],
                "negative_evidence": [],
                "dom_evidence": {},
                "block_eligibility": {
                    "eligible": True,
                    "reasons": [f"independent_certainty_{evidence_type}"]
                },
                "contextual_modifier": 0,
                "final_risk": risk
            }
        }
