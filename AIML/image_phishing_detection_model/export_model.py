"""
AegisOne — Model Export to ONNX for production deployment.
Usage: python export_model.py
"""
import torch
import torch.nn as nn
from torchvision import models
from config_v2 import cfg, SEBlock
import os


def export_to_onnx():
    # Rebuild architecture
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

    # Load weights
    if not os.path.exists(cfg.BEST_MODEL_PATH):
        print("[ERROR] No best_model.pth found. Train the model first.")
        return

    ck = torch.load(cfg.BEST_MODEL_PATH, map_location="cpu")
    model.load_state_dict(ck["model_state"])
    model.eval()

    # Export
    dummy = torch.randn(1, 3, cfg.IMAGE_SIZE, cfg.IMAGE_SIZE)
    torch.onnx.export(
        model, dummy, cfg.EXPORT_PATH,
        input_names=["image"],
        output_names=["logits"],
        dynamic_axes={"image": {0: "batch"}, "logits": {0: "batch"}},
        opset_version=14,
    )

    threshold = ck.get("optimal_threshold", 0.5)
    auc = ck.get("test_auc", "N/A")

    print(f"[OK] ONNX exported -> {cfg.EXPORT_PATH}")
    print(f"     Optimal threshold: {threshold}")
    print(f"     Test AUC: {auc}")
    print(f"     File size: {os.path.getsize(cfg.EXPORT_PATH) / 1e6:.1f} MB")


if __name__ == "__main__":
    export_to_onnx()
