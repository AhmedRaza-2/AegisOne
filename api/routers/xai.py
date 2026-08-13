from fastapi import APIRouter, HTTPException
from pydantic import BaseModel
import httpx
import logging

router = APIRouter()
logger = logging.getLogger(__name__)

class XAIRequest(BaseModel):
    target: str
    risk_score: int
    threat_type: str
    decision: str

# Local Ollama URL
OLLAMA_URL = "http://localhost:11434/api/generate"
# The fast, small model we will use
MODEL_NAME = "qwen2.5:1.5b"

@router.post("/xai/explain")
async def generate_xai_explanation(req: XAIRequest):
    """
    Generates a natural language explanation for a security event using a local, lightweight LLM (Ollama).
    """
    prompt = f"""You are AegisOne, an expert AI cybersecurity assistant. 
Explain the following security event to a non-technical employee in 2-3 simple, reassuring sentences. 
Do not use technical jargon.

Event Details:
- Target: {req.target}
- Risk Score: {req.risk_score}%
- Threat Type: {req.threat_type}
- Action Taken: {req.decision}

Explanation:"""

    try:
        async with httpx.AsyncClient(timeout=10.0) as client:
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
            return {"explanation": data.get("response", "").strip(), "model": MODEL_NAME, "source": "local_llm"}
            
    except httpx.ConnectError:
        logger.warning("Ollama is not running locally. Falling back to rule-based XAI.")
        # Fallback if Docker container is not running
        action_verb = "blocked" if req.decision == "block" else "flagged"
        fallback = f"AegisOne {action_verb} {req.target} because it was identified as a {req.threat_type} risk ({req.risk_score}% confidence). Your system remains completely secure."
        return {"explanation": fallback, "model": "rule-based", "source": "fallback"}
    except Exception as e:
        logger.error(f"Error communicating with local LLM: {str(e)}")
        raise HTTPException(status_code=500, detail="Failed to generate XAI summary.")
