"""
AegisOne — FastAPI Inference Server for General Text Phishing Detection
Architecture: DistilBERT (LoRA) + Bi-LSTM + Multi-Head Attention (SMS/Chat optimized)
Usage: uvicorn text_inference:app --host 0.0.0.0 --port 8002
"""
import os, torch
from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
from transformers import DistilBertTokenizer

from phishing_model_text import PhishingDetectorText, extract_general_text_features

app = FastAPI(title="AegisOne Text Phishing Detection", version="2.0")
app.add_middleware(CORSMiddleware, allow_origins=["*"], allow_methods=["*"], allow_headers=["*"])

# ===== Models =====
class TextRequest(BaseModel):
    text: str

class PredictionResult(BaseModel):
    prediction: str
    confidence: float
    phishing_probability: float
    model: str = "text"

class HealthResult(BaseModel):
    status: str
    model_loaded: bool
    device: str

# ===== Loading =====
MODEL = None
TOKENIZER = None
DEVICE = torch.device("cuda" if torch.cuda.is_available() else "cpu")
MODEL_PATH = "best_phishing_model_text.pt"

def load_model():
    global MODEL, TOKENIZER
    TOKENIZER = DistilBertTokenizer.from_pretrained("distilbert-base-uncased")
    
    if not os.path.exists(MODEL_PATH):
        print(f"[WARN] Model not found at {MODEL_PATH}")
        return
    
    MODEL = PhishingDetectorText()
    MODEL.load_state_dict(torch.load(MODEL_PATH, map_location=DEVICE), strict=False)
    MODEL.to(DEVICE).eval()
    print(f"[OK] Text model loaded on {DEVICE}")

@app.on_event("startup")
async def startup():
    load_model()

# ===== Endpoints =====
@app.get("/health", response_model=HealthResult)
async def health():
    return HealthResult(status="ok", model_loaded=MODEL is not None, device=str(DEVICE))

@app.post("/predict/text", response_model=PredictionResult)
async def predict_text(req: TextRequest):
    if MODEL is None:
        raise HTTPException(500, "Model not loaded")
    
    encoding = TOKENIZER(
        req.text, add_special_tokens=True, max_length=128,
        padding="max_length", truncation=True, return_tensors="pt"
    ).to(DEVICE)
    
    struct_feats = extract_general_text_features(req.text).unsqueeze(0).to(DEVICE)
    
    with torch.no_grad():
        logits = MODEL(encoding["input_ids"], encoding["attention_mask"], struct_feats)
        prob = torch.sigmoid(logits).item()
    
    is_phishing = prob >= 0.5
    confidence = prob if is_phishing else (1.0 - prob)
    
    return PredictionResult(
        prediction="phishing" if is_phishing else "legitimate",
        confidence=round(confidence, 4),
        phishing_probability=round(prob, 4),
        model="text"
    )

if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="0.0.0.0", port=8002)
