from fastapi import APIRouter, HTTPException
from pydantic import BaseModel
from typing import Optional, Dict, Any, List
import httpx
import logging

router = APIRouter()
logger = logging.getLogger(__name__)

class XAIRequest(BaseModel):
    target: Optional[str] = None
    url: Optional[str] = None
    domain: Optional[str] = None
    risk_score: Optional[int] = 0
    threat_type: Optional[str] = "phishing"
    decision: Optional[str] = "warned"
    verdict: Optional[str] = "warning"
    features: Optional[Dict[str, Any]] = None
    top_factors: Optional[List[Dict[str, Any]]] = None
    text_summary: Optional[str] = None

# Local Ollama URL
OLLAMA_URL = "http://localhost:11434/api/generate"
# The fast, small model we will use
MODEL_NAME = "qwen2.5:1.5b"

@router.post("/xai/explain")
async def generate_xai_explanation(req: XAIRequest):
    """
    Generates a natural language explanation for a security event using a local, lightweight LLM (Ollama),
    with robust rule-based fallback.
    """
    target_name = req.target or req.domain or req.url or "Target site"
    raw_s = req.risk_score or 0
    score = int(round(raw_s * 100)) if 0 < raw_s <= 1 else int(raw_s)
    threat = req.threat_type or "phishing"
    decision = req.decision or "warned"

    factors_str = ""
    if req.top_factors:
        factors_list = [f.get("label") for f in req.top_factors if isinstance(f, dict) and f.get("label")]
        if factors_list:
            factors_str = f"\n- Key Factors: {', '.join(factors_list[:3])}"

    prompt = f"""You are AegisOne, an expert AI cybersecurity assistant. 
Explain the following security event to a non-technical employee in 2-3 simple, reassuring sentences. 
Do not use technical jargon.

Event Details:
- Target: {target_name}
- Risk Score: {score}%
- Threat Type: {threat}
- Action Taken: {decision}{factors_str}

Explanation:"""

    try:
        async with httpx.AsyncClient(timeout=6.0) as client:
            response = await client.post(
                OLLAMA_URL,
                json={
                    "model": MODEL_NAME,
                    "prompt": prompt,
                    "stream": False
                }
            )
            response.raise_for_status()
            data = response.json()
            llm_text = data.get("response", "").strip()
            return {
                "summary": llm_text,
                "explanation": llm_text,
                "model": MODEL_NAME,
                "source": "local_llm",
                "generated_locally": False
            }
            
    except Exception as e:
        logger.warning(f"Ollama unavailable ({str(e)}). Using intelligent rule-based XAI explanation.")
        action_verb = "blocked" if decision in ["block", "blocked"] else "flagged"
        reasons = []
        if req.top_factors:
            reasons = [f.get("label") for f in req.top_factors if isinstance(f, dict) and f.get("label")]

        if score >= 80:
            summary = f"⚠️ AegisOne {action_verb} access to {target_name} ({score}% risk). This page displays strong signals of phishing or credential theft. Avoid sharing passwords or sensitive data."
        elif score >= 50:
            summary = f"🔶 AegisOne detected suspicious activity on {target_name} ({score}% risk). Proceed with caution and verify the website URL carefully."
        else:
            summary = f"✅ AegisOne scanned {target_name} ({score}% risk). No active threat detected."

        recommendations = []
        if score >= 80:
            recommendations.append("🚫 Do NOT enter passwords or financial details on this page")
            recommendations.append("← Go back or close this tab to remain protected")
            recommendations.append("📢 Click Report Threat to inform your security administrator")
        elif score >= 50:
            recommendations.append("👀 Double-check the URL in your address bar for typos")
            recommendations.append("🔑 Avoid logging in unless you are completely sure of the domain")
        else:
            recommendations.append("✅ Carry on safely — AegisOne is continuously scanning")

        return {
            "summary": summary,
            "explanation": summary,
            "main_reasons": reasons if reasons else [f"Identified as {threat} by AegisOne security models"],
            "recommendations": recommendations,
            "model": "rule-based",
            "source": "fallback",
            "generated_locally": True
        }

