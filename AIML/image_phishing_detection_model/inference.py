"""
AegisOne — FastAPI Inference Server for Phishing Image Detection
Supports: single image prediction, TTA, batch prediction, health check
Usage: uvicorn inference:app --host 0.0.0.0 --port 8000
"""
import io, os, torch
import torch.nn as nn
import numpy as np
from PIL import Image
from fastapi import FastAPI, File, UploadFile, HTTPException
from fastapi.responses import FileResponse
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
from torchvision import models, transforms
from torchvision.models import EfficientNet_B3_Weights
from typing import List

from config_v2 import cfg, get_tta_transforms, SEBlock


# ===== App Setup =====
app = FastAPI(
    title="AegisOne Phishing Image Detection",
    description="AI-powered visual phishing detection API",
    version="2.0"
)
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_methods=["*"],
    allow_headers=["*"],
)


# ===== Response Models =====
class PredictionResult(BaseModel):
    prediction: str
    confidence: float
    phishing_probability: float
    threshold_used: float
    tta_used: bool


class HealthResult(BaseModel):
    status: str
    model_loaded: bool
    device: str
    optimal_threshold: float


# ===== Model Loading =====
MODEL = None
OPTIMAL_THRESHOLD = 0.5
VAL_TRANSFORM = None
TTA_TRANSFORMS = None


def load_model():
    global MODEL, OPTIMAL_THRESHOLD, VAL_TRANSFORM, TTA_TRANSFORMS

    model = models.efficientnet_b3(weights=None)
    in_f = model.classifier[1].in_features
    model.classifier = nn.Sequential(
        nn.Dropout(p=cfg.DROPOUT_1),
        nn.Linear(in_f, 512),
        nn.BatchNorm1d(512),
        nn.ReLU(inplace=True),
        SEBlock(512, reduction=16),
        nn.Dropout(p=cfg.DROPOUT_2),
        nn.Linear(512, 128),
        nn.BatchNorm1d(128),
        nn.ReLU(inplace=True),
        nn.Linear(128, cfg.NUM_CLASSES)
    )

    if os.path.exists(cfg.BEST_MODEL_PATH):
        ck = torch.load(cfg.BEST_MODEL_PATH, map_location=cfg.DEVICE)
        model.load_state_dict(ck["model_state"])
        OPTIMAL_THRESHOLD = ck.get("optimal_threshold", 0.5)
        print(f"[OK] Model loaded | Threshold: {OPTIMAL_THRESHOLD:.3f}")
    else:
        print("[WARN] No trained model found, using random weights")

    model = model.to(cfg.DEVICE)
    model.eval()
    MODEL = model

    VAL_TRANSFORM = transforms.Compose([
        transforms.Resize((cfg.IMAGE_SIZE, cfg.IMAGE_SIZE)),
        transforms.ToTensor(),
        transforms.Normalize([0.485, 0.456, 0.406], [0.229, 0.224, 0.225]),
    ])
    TTA_TRANSFORMS = get_tta_transforms()


@app.on_event("startup")
async def startup():
    load_model()


# ===== Endpoints =====
@app.get("/health", response_model=HealthResult)
async def health():
    return HealthResult(
        status="ok",
        model_loaded=MODEL is not None,
        device=str(cfg.DEVICE),
        optimal_threshold=OPTIMAL_THRESHOLD,
    )


@app.post("/predict/image", response_model=PredictionResult)
async def predict_image(file: UploadFile = File(...), use_tta: bool = False):
    """Predict if a screenshot is phishing or legitimate."""
    if MODEL is None:
        raise HTTPException(500, "Model not loaded")

    try:
        data = await file.read()
        img = Image.open(io.BytesIO(data)).convert("RGB")
    except Exception:
        raise HTTPException(400, "Invalid image file")

    with torch.no_grad():
        if use_tta and TTA_TRANSFORMS:
            # Test-Time Augmentation: average predictions across augmented views
            probs_list = []
            for tf in TTA_TRANSFORMS:
                tensor = tf(img).unsqueeze(0).to(cfg.DEVICE)
                out = MODEL(tensor)
                prob = torch.softmax(out, dim=1)[0, 1].item()
                probs_list.append(prob)
            phishing_prob = float(np.mean(probs_list))
        else:
            tensor = VAL_TRANSFORM(img).unsqueeze(0).to(cfg.DEVICE)
            out = MODEL(tensor)
            phishing_prob = torch.softmax(out, dim=1)[0, 1].item()

    is_phishing = phishing_prob >= OPTIMAL_THRESHOLD
    confidence = phishing_prob if is_phishing else (1.0 - phishing_prob)

    return PredictionResult(
        prediction="phishing" if is_phishing else "legitimate",
        confidence=round(confidence, 4),
        phishing_probability=round(phishing_prob, 4),
        threshold_used=OPTIMAL_THRESHOLD,
        tta_used=use_tta,
    )


@app.post("/predict/batch")
async def predict_batch(files: List[UploadFile] = File(...)):
    """Batch prediction for multiple images."""
    if MODEL is None:
        raise HTTPException(500, "Model not loaded")

    results = []
    for file in files:
        try:
            data = await file.read()
            img = Image.open(io.BytesIO(data)).convert("RGB")
            tensor = VAL_TRANSFORM(img).unsqueeze(0).to(cfg.DEVICE)
            with torch.no_grad():
                out = MODEL(tensor)
                prob = torch.softmax(out, dim=1)[0, 1].item()
            is_phishing = prob >= OPTIMAL_THRESHOLD
            results.append({
                "filename": file.filename,
                "prediction": "phishing" if is_phishing else "legitimate",
                "confidence": round(prob if is_phishing else 1.0 - prob, 4),
                "phishing_probability": round(prob, 4),
            })
        except Exception as e:
            results.append({"filename": file.filename, "error": str(e)})

    return {"results": results, "total": len(results)}


if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="0.0.0.0", port=8000)
