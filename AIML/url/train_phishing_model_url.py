"""
AegisOne — URL Model Training Pipeline (Colab + Local)
=======================================================
Handles dataset loading, domain-level splitting, and model training.

COLAB SETUP:
  1. Mount Google Drive.
  2. Upload final_url_dataset.csv + phishing_model_url.py to MyDrive/AegisOne/
  3. Run all cells. Trained best.pt saves back to Drive automatically.

LOCAL SETUP:
  python train_phishing_model_url.py
  python train_phishing_model_url.py --smoke-test   # quick 1000-sample test
"""

import os
import re
import sys
import argparse
import numpy as np
import pandas as pd
from urllib.parse import urlparse

import torch
import torch.nn as nn
from torch.utils.data import Dataset, DataLoader
from torch.optim import AdamW
from torch.optim.lr_scheduler import CosineAnnealingLR

from transformers import AutoTokenizer
from sklearn.model_selection import train_test_split
from sklearn.metrics import (
    classification_report, f1_score, accuracy_score,
    precision_score, recall_score, confusion_matrix,
)
from sklearn.utils import resample

# ── Import model architecture ──────────────────────────────────────────
# Works both locally (same folder) and on Colab (same Drive folder mounted)
_SCRIPT_DIR = os.path.dirname(os.path.abspath(__file__)) if "__file__" in dir() else "/content/drive/MyDrive/AegisOne"
if _SCRIPT_DIR not in sys.path:
    sys.path.insert(0, _SCRIPT_DIR)

from phishing_model_url import URLDetector, extract_url_numerical_features

# ═══════════════════════════════════════════════════════════════════════
# CONFIGURATION
# ═══════════════════════════════════════════════════════════════════════

IS_COLAB = os.path.exists('/content')

class Config:
    if IS_COLAB:
        _root        = "/content/drive/MyDrive/AegisOne"
    else:
        _root        = _SCRIPT_DIR

    dataset_path    = os.path.join(_root, "final_url_dataset.csv")
    save_path       = os.path.join(_root, "best.pt")
    checkpoint_path = os.path.join(_root, "latest_url_checkpoint.pt")

    bert_model  = "distilbert-base-uncased"
    max_len     = 128
    batch_size  = 64        # Increased for GPU (Colab T4 can handle 128 if OOM, drop to 64)
    epochs      = 8         # More epochs for better convergence
    lr          = 2e-4
    seed        = 42
    num_workers = 2 if IS_COLAB else 0   # parallel DataLoader workers on Colab

# ═══════════════════════════════════════════════════════════════════════
# HELPERS
# ═══════════════════════════════════════════════════════════════════════

def normalize_url(url: str) -> str:
    """Strip protocol/www for protocol-neutral tokenization."""
    url = str(url).lower().strip()
    for prefix in ("https://", "http://", "www."):
        url = url.replace(prefix, "")
    return url.rstrip("/")


def get_registered_domain(url: str) -> str:
    """Extract netloc for domain-level train/test splitting."""
    try:
        return urlparse("http://" + normalize_url(url)).netloc
    except Exception:
        return str(url)


def check_dataset():
    if not os.path.exists(Config.dataset_path):
        raise FileNotFoundError(
            f"❌ Dataset not found: {Config.dataset_path}\n"
            f"Upload 'final_url_dataset.csv' to {Config._root}"
        )
    print(f"✅ Dataset found: {Config.dataset_path}")


# ═══════════════════════════════════════════════════════════════════════
# PYTORCH DATASET
# ═══════════════════════════════════════════════════════════════════════

class URLDataset(Dataset):
    def __init__(self, urls, labels, tokenizer, max_len):
        self.urls      = urls
        self.labels    = labels
        self.tokenizer = tokenizer
        self.max_len   = max_len

    def __len__(self):
        return len(self.urls)

    def __getitem__(self, idx):
        url  = normalize_url(str(self.urls[idx]))
        enc  = self.tokenizer(
            url,
            max_length=self.max_len,
            padding="max_length",
            truncation=True,
            return_tensors="pt",
        )
        return {
            "input_ids":  enc["input_ids"].flatten(),
            "mask":       enc["attention_mask"].flatten(),
            "num_feats":  extract_url_numerical_features(url),
            "label":      torch.tensor(self.labels[idx], dtype=torch.long),
        }


# ═══════════════════════════════════════════════════════════════════════
# TRAINING & EVALUATION
# ═══════════════════════════════════════════════════════════════════════

def train_epoch(model, loader, optimizer, scheduler, criterion, device):
    model.train()
    losses, correct, total = [], 0, 0
    for i, batch in enumerate(loader):
        ids  = batch["input_ids"].to(device)
        mask = batch["mask"].to(device)
        num  = batch["num_feats"].to(device)
        y    = batch["label"].to(device)

        optimizer.zero_grad()
        logits = model(ids, mask, num)
        loss   = criterion(logits, y)
        loss.backward()
        torch.nn.utils.clip_grad_norm_(model.parameters(), 1.0)   # gradient clipping
        optimizer.step()
        scheduler.step()

        losses.append(loss.item())
        preds   = logits.argmax(dim=1)
        correct += (preds == y).sum().item()
        total   += y.size(0)

        if (i + 1) % 200 == 0:
            print(f"    Batch {i+1:>4}/{len(loader)} | Loss: {np.mean(losses[-200:]):.4f} | Acc: {correct/total*100:.2f}%")

    return float(np.mean(losses)), correct / total


def eval_model(model, loader, device):
    model.eval()
    all_p, all_y = [], []
    with torch.no_grad():
        for batch in loader:
            out = model(
                batch["input_ids"].to(device),
                batch["mask"].to(device),
                batch["num_feats"].to(device),
            )
            all_p.extend(out.argmax(dim=1).cpu().numpy())
            all_y.extend(batch["label"].numpy())

    acc    = accuracy_score(all_y, all_p)
    f1     = f1_score(all_y, all_p, average="macro", zero_division=0)
    report = classification_report(
        all_y, all_p,
        target_names=["Benign", "Phishing", "Malware", "Defacement"],
        zero_division=0,
    )
    cm = confusion_matrix(all_y, all_p)
    return acc, f1, report, cm


# ═══════════════════════════════════════════════════════════════════════
# CHECKPOINT HELPERS
# ═══════════════════════════════════════════════════════════════════════

def save_checkpoint(model, optimizer, scheduler, epoch, best_f1, path):
    os.makedirs(os.path.dirname(path) or ".", exist_ok=True)
    torch.save({
        "epoch":                epoch,
        "model_state_dict":     model.state_dict(),
        "optimizer_state_dict": optimizer.state_dict(),
        "scheduler_state_dict": scheduler.state_dict(),
        "best_f1":              best_f1,
    }, path)
    print(f"📦 Checkpoint saved → {path}")


def load_checkpoint(model, optimizer, scheduler, path, device):
    if not os.path.exists(path):
        return 0, 0.0

    print(f"🔄 Resuming from checkpoint: {path}")
    ckpt = torch.load(path, map_location=device)

    # Safe model state load (skip size-mismatched layers)
    saved  = ckpt["model_state_dict"]
    curr   = model.state_dict()
    clean  = {k: v for k, v in saved.items() if k in curr and v.shape == curr[k].shape}
    skipped = len(saved) - len(clean)
    if skipped:
        print(f"⚠️  Skipped {skipped} layers due to shape mismatch (architecture changed).")
    model.load_state_dict(clean, strict=False)

    try:
        optimizer.load_state_dict(ckpt["optimizer_state_dict"])
    except Exception as e:
        print(f"⚠️  Optimizer state not loaded ({e}). Starting fresh optimizer.")

    try:
        scheduler.load_state_dict(ckpt["scheduler_state_dict"])
    except Exception as e:
        print(f"⚠️  Scheduler state not loaded ({e}). Starting fresh scheduler.")

    return ckpt["epoch"] + 1, ckpt["best_f1"]


# ═══════════════════════════════════════════════════════════════════════
# MAIN
# ═══════════════════════════════════════════════════════════════════════

def main():
    parser = argparse.ArgumentParser(description="AegisOne URL Model Training")
    parser.add_argument("--smoke-test", action="store_true", help="Quick 1000-sample smoke test")
    parser.add_argument("--epochs",     type=int, default=None, help="Override epoch count")
    parser.add_argument("--batch-size", type=int, default=None, help="Override batch size")
    args = parser.parse_args()

    if args.epochs:
        Config.epochs = args.epochs
    if args.batch_size:
        Config.batch_size = args.batch_size

    torch.set_num_threads(os.cpu_count() or 4)
    device = torch.device("cuda" if torch.cuda.is_available() else "cpu")
    print(f"\n🖥️  Device: {device} | Batch: {Config.batch_size} | Epochs: {Config.epochs}")

    # ── 1. Dataset ─────────────────────────────────────────────────────
    check_dataset()
    print(f"\n📂 Loading dataset...")
    df = pd.read_csv(Config.dataset_path)
    print(f"   {len(df):,} total URLs | {df['label'].value_counts().to_dict()}")

    # ── 2. Domain-Level Split (no data leakage) ────────────────────────
    print("\n🛡️  Domain-level train/test split...")
    df["domain"] = df["url"].apply(get_registered_domain)
    unique_domains = df["domain"].unique()
    train_doms, test_doms = train_test_split(unique_domains, test_size=0.2, random_state=Config.seed)
    train_dom_set = set(train_doms)

    train_df = df[df["domain"].isin(train_dom_set)].copy()
    test_df  = df[~df["domain"].isin(train_dom_set)].copy()

    if args.smoke_test:
        train_df = train_df.sample(min(800, len(train_df)),  random_state=Config.seed)
        test_df  = test_df.sample(min(200, len(test_df)),   random_state=Config.seed)

    print(f"   Train: {len(train_df):,} URLs across {len(train_doms):,} domains")
    print(f"   Test : {len(test_df):,}  URLs across {len(test_doms):,} domains")
    print(f"   Train class dist: {train_df['label'].value_counts().to_dict()}")
    print(f"   Test  class dist: {test_df['label'].value_counts().to_dict()}")

    # ── 3. DataLoaders ──────────────────────────────────────────────────
    tokenizer    = AutoTokenizer.from_pretrained(Config.bert_model)
    train_loader = DataLoader(
        URLDataset(train_df["url"].values, train_df["label"].values, tokenizer, Config.max_len),
        batch_size=Config.batch_size,
        shuffle=True,
        num_workers=Config.num_workers,
        pin_memory=(device.type == "cuda"),
    )
    test_loader  = DataLoader(
        URLDataset(test_df["url"].values, test_df["label"].values, tokenizer, Config.max_len),
        batch_size=Config.batch_size,
        num_workers=Config.num_workers,
        pin_memory=(device.type == "cuda"),
    )

    # ── 4. Model, Optimizer, Scheduler ─────────────────────────────────
    model     = URLDetector(Config.bert_model).to(device)
    optimizer = AdamW(model.parameters(), lr=Config.lr, weight_decay=1e-2)
    scheduler = CosineAnnealingLR(optimizer, T_max=len(train_loader) * Config.epochs)
    criterion = nn.CrossEntropyLoss(label_smoothing=0.05)  # label smoothing reduces overconfidence

    start_epoch, best_f1 = load_checkpoint(
        model, optimizer, scheduler, Config.checkpoint_path, device
    )

    # ── 5. Training Loop ────────────────────────────────────────────────
    print(f"\n🏁 Training from epoch {start_epoch + 1}/{Config.epochs}...")
    for epoch in range(start_epoch, Config.epochs):
        print(f"\n{'═'*60}")
        print(f"  Epoch {epoch+1}/{Config.epochs}")
        print(f"{'═'*60}")

        train_loss, train_acc = train_epoch(
            model, train_loader, optimizer, scheduler, criterion, device
        )
        val_acc, val_f1, report, cm = eval_model(model, test_loader, device)

        print(f"\n📊 Train Loss: {train_loss:.4f} | Train Acc: {train_acc*100:.2f}%")
        print(f"📊 Val   F1  : {val_f1:.4f}   | Val   Acc: {val_acc*100:.2f}%")
        print(f"\n{report}")
        print(f"Confusion Matrix:\n{cm}\n")

        save_checkpoint(model, optimizer, scheduler, epoch, max(best_f1, val_f1), Config.checkpoint_path)

        if val_f1 > best_f1:
            best_f1 = val_f1
            os.makedirs(os.path.dirname(Config.save_path) or ".", exist_ok=True)
            torch.save(model.state_dict(), Config.save_path)
            print(f"⭐ New best model saved → {Config.save_path}  (F1={best_f1:.4f})")

    print(f"\n✅ Training complete. Best macro F1: {best_f1:.4f}")
    print(f"   Model saved at: {Config.save_path}")


if __name__ == "__main__":
    main()
