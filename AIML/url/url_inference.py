"""
AegisOne — FastAPI Inference Server for URL Phishing Detection
Architecture: Hybrid BERT-Mini / DistilBERT + Brand Impersonation + 64 Lexical Features + Evidence Fusion
Usage: uvicorn url_inference:app --host 0.0.0.0 --port 8003
"""
import os
import sys
import torch
from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
from transformers import AutoTokenizer

# Add parent directory to path to allow importing brand, lexical, and fusion engines
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))

from phishing_model_url import URLDetector, extract_url_numerical_features, load_url_detector
from model_paths import get_url_model_path
from brand_engine import check_brand_impersonation
from lexical_engine import extract_expanded_features
from fusion_engine import fuse_url_intelligence

app = FastAPI(title="AegisOne URL Phishing Detection", version="3.0")
app.add_middleware(CORSMiddleware, allow_origins=["*"], allow_methods=["*"], allow_headers=["*"])

# ===== Models =====
class URLRequest(BaseModel):
    url: str

class PredictionResult(BaseModel):
    prediction: str
    confidence: float
    phishing_probability: float
    category: str
    explanation: str
    evidence: dict
    model: str = "url"

class HealthResult(BaseModel):
    status: str
    model_loaded: bool
    device: str

# ===== Loading =====
MODEL = None
TOKENIZER = None
DEVICE = torch.device("cuda" if torch.cuda.is_available() else "cpu")
MODEL_PATH = str(get_url_model_path())

def load_model():
    global MODEL, TOKENIZER
    if not os.path.exists(MODEL_PATH):
        print(f"[WARN] Model not found at {MODEL_PATH}")
        return
    
    MODEL, model_name = load_url_detector(MODEL_PATH, DEVICE)
    TOKENIZER = AutoTokenizer.from_pretrained(model_name)
    print(f"[OK] URL model loaded on {DEVICE} (base: {model_name})")

@app.on_event("startup")
async def startup():
    load_model()

# ===== Endpoints =====
@app.get("/health", response_model=HealthResult)
async def health():
    return HealthResult(status="ok", model_loaded=MODEL is not None, device=str(DEVICE))

@app.post("/predict/url", response_model=PredictionResult)
async def predict_url(req: URLRequest):
    if MODEL is None:
        raise HTTPException(500, "Model not loaded")
    
    url = req.url
    
    # 1. Brand Impersonation Check
    brand_result = check_brand_impersonation(url)
    
    # 2. Extract 64 Lexical Features
    lexical_tensor = extract_expanded_features(url)
    
    # 2.5 Fast-Path / Cascaded Decision Check
    cascade_res = fuse_url_intelligence(url, None, brand_result, lexical_tensor)
    if cascade_res["evidence"]["fusion_method"] in {
        "Cascade Level 1: Static Threat Signature Override",
        "Cascade Level 2: Static Clean Pass Override"
    }:
        return PredictionResult(
            prediction=cascade_res["prediction"],
            confidence=cascade_res["confidence"],
            phishing_probability=round(cascade_res["risk_score"] / 100.0, 4),
            category=cascade_res["category"],
            explanation=cascade_res["explanation"],
            evidence=cascade_res["evidence"],
            model="url"
        )
    
    # 3. Model Semantic Score (expects original 10 features)
    encoding = TOKENIZER(
        url, add_special_tokens=True, max_length=128,
        padding="max_length", truncation=True, return_tensors="pt"
    ).to(DEVICE)
    
    numerical_feats = extract_url_numerical_features(url).unsqueeze(0).to(DEVICE)
    
    with torch.no_grad():
        logits = MODEL(encoding["input_ids"], encoding["attention_mask"], numerical_feats)
        probs = torch.softmax(logits, dim=1)[0].cpu().tolist()
        
    # 4. Evidence Fusion & Decision
    fusion = fuse_url_intelligence(url, probs, brand_result, lexical_tensor)
    
    # 5. Extract XAI Focus Words if malicious
    explanation = fusion["explanation"]
    xai_words = []
    if fusion["prediction"] == "malicious":
        try:
            tokens = TOKENIZER.convert_ids_to_tokens(encoding["input_ids"][0])
            # Check for DistilBERT last_attentions helper or similar
            if hasattr(MODEL, "last_attentions") and MODEL.last_attentions is not None:
                last_layer = MODEL.last_attentions[-1][0]
                mean_attn = last_layer.mean(dim=0)
                cls_attn = mean_attn[0, :]
                scored = []
                for idx, token in enumerate(tokens):
                    t = token.lower()
                    if (idx < len(cls_attn) and encoding["attention_mask"][0][idx] == 1
                            and t not in {"[cls]", "[sep]", "[pad]", "http", "https", "www", "com"}
                            and not t.startswith("##") and len(t) > 2):
                        scored.append((token, float(cls_attn[idx].item())))
                scored.sort(key=lambda x: x[1], reverse=True)
                xai_words = [t[0] for t in scored[:3] if t[1] > 0.001]
                if xai_words:
                    explanation += f" | AI focused on: {', '.join(xai_words)}"
        except Exception:
            pass

    return PredictionResult(
        prediction=fusion["prediction"],
        confidence=fusion["confidence"],
        phishing_probability=round(fusion["risk_score"] / 100.0, 4),
        category=fusion["category"],
        explanation=explanation,
        evidence=fusion["evidence"],
        model="url"
    )

if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="0.0.0.0", port=8003)
