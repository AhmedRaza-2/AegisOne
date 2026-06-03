"""
AegisOne — FastAPI Inference Server for URL Phishing Detection
Architecture: DistilBERT + Feature MLP (4-class: benign/defacement/phishing/malware)
Usage: uvicorn url_inference:app --host 0.0.0.0 --port 8003
"""
import os, torch
from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
from transformers import DistilBertTokenizer

from phishing_model_url import URLDetector, extract_url_numerical_features

app = FastAPI(title="AegisOne URL Phishing Detection", version="2.0")
app.add_middleware(CORSMiddleware, allow_origins=["*"], allow_methods=["*"], allow_headers=["*"])

# ===== Models =====
class URLRequest(BaseModel):
    url: str

class PredictionResult(BaseModel):
    prediction: str
    confidence: float
    phishing_probability: float
    category: str
    model: str = "url"

class HealthResult(BaseModel):
    status: str
    model_loaded: bool
    device: str

# ===== Loading =====
MODEL = None
TOKENIZER = None
DEVICE = torch.device("cuda" if torch.cuda.is_available() else "cpu")
MODEL_PATH = "best.pt"
CLASSES = ["benign", "defacement", "phishing", "malware"]

def load_model():
    global MODEL, TOKENIZER
    TOKENIZER = DistilBertTokenizer.from_pretrained("distilbert-base-uncased")
    
    if not os.path.exists(MODEL_PATH):
        print(f"[WARN] Model not found at {MODEL_PATH}")
        return
    
    MODEL = URLDetector()
    MODEL.load_state_dict(torch.load(MODEL_PATH, map_location=DEVICE), strict=False)
    MODEL.to(DEVICE).eval()
    print(f"[OK] URL model loaded on {DEVICE}")

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
    
    encoding = TOKENIZER(
        req.url, add_special_tokens=True, max_length=128,
        padding="max_length", truncation=True, return_tensors="pt"
    ).to(DEVICE)
    
    numerical_feats = extract_url_numerical_features(req.url).unsqueeze(0).to(DEVICE)
    
    with torch.no_grad():
        logits = MODEL(encoding["input_ids"], encoding["attention_mask"], numerical_feats)
        probs = torch.softmax(logits, dim=1)[0]
        pred_class = probs.argmax().item()
        malicious_prob = 1.0 - probs[0].item()  # 1 - benign probability
    
    is_phishing = pred_class != 0
    confidence = probs[pred_class].item()
    
    return PredictionResult(
        prediction="malicious" if is_phishing else "legitimate",
        confidence=round(confidence, 4),
        phishing_probability=round(malicious_prob, 4),
        category=CLASSES[pred_class],
        model="url"
    )

if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="0.0.0.0", port=8003)
