# ============================================================
# AegisOne — Quick Test on Colab using Gradio
# Run this cell AFTER training is complete
# It creates a public URL you can open in any browser
# ============================================================

# CELL 1: Install Gradio
# !pip install -q gradio torch torchvision pillow

# CELL 2: Run Testing UI
import gradio as gr
import torch
import torch.nn as nn
import numpy as np
from torchvision import models, transforms
from PIL import Image
import os, sys

sys.path.insert(0, "/content/drive/MyDrive/FYP_Phishing")
from config_v2 import cfg, SEBlock, get_tta_transforms

# Load model
def load_model():
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

    best_path = "/content/drive/MyDrive/FYP_Phishing/checkpoints_v2/best_model.pth"
    if os.path.exists(best_path):
        ck = torch.load(best_path, map_location=cfg.DEVICE)
        model.load_state_dict(ck["model_state"])
        threshold = ck.get("optimal_threshold", 0.5)
        print(f"[OK] Model loaded | Threshold: {threshold:.3f}")
    else:
        threshold = 0.5
        print("[WARN] No model found, using random weights")

    model = model.to(cfg.DEVICE)
    model.eval()
    return model, threshold

MODEL, THRESHOLD = load_model()

val_tf = transforms.Compose([
    transforms.Resize((224, 224)),
    transforms.ToTensor(),
    transforms.Normalize([0.485, 0.456, 0.406], [0.229, 0.224, 0.225]),
])

tta_tfs = get_tta_transforms()

def predict(image, use_tta):
    if image is None:
        return "Upload an image", 0, 0, ""

    img = Image.fromarray(image).convert("RGB")

    with torch.no_grad():
        if use_tta:
            probs = []
            for tf in tta_tfs:
                tensor = tf(img).unsqueeze(0).to(cfg.DEVICE)
                out = MODEL(tensor)
                p = torch.softmax(out, dim=1)[0, 1].item()
                probs.append(p)
            phish_prob = float(np.mean(probs))
        else:
            tensor = val_tf(img).unsqueeze(0).to(cfg.DEVICE)
            out = MODEL(tensor)
            phish_prob = torch.softmax(out, dim=1)[0, 1].item()

    is_phishing = phish_prob >= THRESHOLD
    confidence = phish_prob if is_phishing else (1.0 - phish_prob)
    verdict = "⚠️ PHISHING DETECTED" if is_phishing else "✅ LEGITIMATE"

    details = f"Phishing Probability: {phish_prob*100:.1f}%\n"
    details += f"Confidence: {confidence*100:.1f}%\n"
    details += f"Threshold: {THRESHOLD:.3f}\n"
    details += f"TTA: {'Yes' if use_tta else 'No'}"

    return verdict, confidence, phish_prob, details

# Build Gradio UI
demo = gr.Interface(
    fn=predict,
    inputs=[
        gr.Image(label="Upload Screenshot", type="numpy"),
        gr.Checkbox(label="Use TTA (slower but more accurate)", value=False),
    ],
    outputs=[
        gr.Textbox(label="Verdict"),
        gr.Number(label="Confidence"),
        gr.Number(label="Phishing Probability"),
        gr.Textbox(label="Details"),
    ],
    title="🛡️ AegisOne — Phishing Image Tester",
    description="Upload a website screenshot to check if it's phishing or legitimate",
    theme=gr.themes.Soft(primary_hue="indigo"),
    allow_flagging="never",
)

# share=True gives you a PUBLIC URL anyone can access for 72 hours
demo.launch(share=True)
