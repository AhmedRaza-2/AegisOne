"""
AegisOne — FastAPI Inference Server for Email Phishing Detection
Architecture: DistilBERT (LoRA) + Bi-LSTM + Multi-Head Attention
Usage: uvicorn email_inference:app --host 0.0.0.0 --port 8001
"""
import os, sys, torch
from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
from transformers import DistilBertTokenizer

# Import model architecture
from phishing_model_email import PhishingDetector, extract_structured_features

app = FastAPI(title="AegisOne Email Phishing Detection", version="2.0")
app.add_middleware(CORSMiddleware, allow_origins=["*"], allow_methods=["*"], allow_headers=["*"])

# ===== Response Models =====
class EmailRequest(BaseModel):
    sender: str = ""
    subject: str = ""
    body: str = ""

class PredictionResult(BaseModel):
    prediction: str
    confidence: float
    phishing_probability: float
    model: str = "email"

class HealthResult(BaseModel):
    status: str
    model_loaded: bool
    device: str

# ===== Model Loading =====
MODEL = None
TOKENIZER = None
DEVICE = torch.device("cuda" if torch.cuda.is_available() else "cpu")
MODEL_PATH = "best_phishing_model.pt"

def load_model():
    global MODEL, TOKENIZER
    TOKENIZER = DistilBertTokenizer.from_pretrained("distilbert-base-uncased")
    
    if not os.path.exists(MODEL_PATH):
        print(f"[WARN] Model not found at {MODEL_PATH}")
        return
    
    MODEL = PhishingDetector()
    MODEL.load_state_dict(torch.load(MODEL_PATH, map_location=DEVICE), strict=False)
    MODEL.to(DEVICE).eval()
    print(f"[OK] Email model loaded on {DEVICE}")

@app.on_event("startup")
async def startup():
    load_model()

# ===== Endpoints =====
@app.get("/health", response_model=HealthResult)
async def health():
    return HealthResult(status="ok", model_loaded=MODEL is not None, device=str(DEVICE))

@app.post("/predict/email", response_model=PredictionResult)
async def predict_email(req: EmailRequest):
    if MODEL is None:
        raise HTTPException(500, "Model not loaded")
    
    # Tokenize
    combined_text = f"[SUBJECT]: {req.subject} [BODY]: {req.body}"
    encoding = TOKENIZER(
        combined_text, add_special_tokens=True, max_length=512,
        padding="max_length", truncation=True, return_tensors="pt"
    ).to(DEVICE)
    
    # Extract structured features
    struct_feats = extract_structured_features(req.sender, req.subject, req.body).unsqueeze(0).to(DEVICE)
    
    with torch.no_grad():
        logits = MODEL(encoding["input_ids"], encoding["attention_mask"], struct_feats)
        prob = torch.sigmoid(logits).item()
    
    is_phishing = prob >= 0.5
    confidence = prob if is_phishing else (1.0 - prob)
    
    return PredictionResult(
        prediction="phishing" if is_phishing else "legitimate",
        confidence=round(confidence, 4),
        phishing_probability=round(prob, 4),
        model="email"
    )

if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="0.0.0.0", port=8001)
