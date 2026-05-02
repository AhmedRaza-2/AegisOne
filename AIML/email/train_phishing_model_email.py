"""
Phishing Detection Model — Full Training Pipeline
===================================================
Usage:
  # Full training (on GPU — Colab/Kaggle):
  python train_phishing_model.py

  # Smoke test (CPU, quick sanity check):
  python train_phishing_model.py --smoke-test

Files needed:
  1. final_phishing_dataset.csv  (150K records)
  2. phishing_model.py                    (model architecture)

Output:
  - best_phishing_model.pt         (saved model checkpoint)
  - training_metrics.json          (all metrics)
  - Printed: full training report with all AI metrics
"""

import os
import sys
import json
import time
import argparse
import re
import numpy as np
import pandas as pd
from datetime import datetime

import torch
import torch.nn as nn
from torch.utils.data import Dataset, DataLoader
from torch.optim import AdamW
from torch.optim.lr_scheduler import CosineAnnealingLR
from torch.amp import autocast, GradScaler

from transformers import DistilBertTokenizer
from sklearn.model_selection import train_test_split
from sklearn.metrics import (
    accuracy_score, f1_score, precision_score, recall_score,
    roc_auc_score, confusion_matrix, classification_report,
    matthews_corrcoef
)

from phishing_model_email import PhishingDetector, batch_extract_features


# ═══════════════════════════════════════════════════════════════════════
# CONFIGURATION
# ═══════════════════════════════════════════════════════════════════════

class Config:
    # Data
    dataset_path = "datasets/final_phishing_dataset.csv"
    max_seq_len = 512
    train_ratio = 0.70
    val_ratio = 0.15
    test_ratio = 0.15

    # Model
    lora_r = 16
    lora_alpha = 32
    lora_dropout = 0.1
    lstm_hidden = 256
    attn_heads = 8
    dropout = 0.3

    # Training
    epochs = 5
    batch_size = 16
    lr_lora = 2e-5          # Learning rate for LoRA params
    lr_heads = 1e-3         # Learning rate for LSTM/Attention/Classifier
    weight_decay = 0.01
    max_grad_norm = 1.0
    early_stop_patience = 3
    warmup_steps = 500

    # System
    seed = 42
    num_workers = 2
    save_path = "best_phishing_model.pt"
    metrics_path = "training_metrics.json"


# ═══════════════════════════════════════════════════════════════════════
# DATASET
# ═══════════════════════════════════════════════════════════════════════

class PhishingDataset(Dataset):
    """
    PyTorch Dataset for phishing email classification.
    Each item returns:
      - input_ids (seq_len,)
      - attention_mask (seq_len,)
      - structured_features (10,)
      - label (scalar)
    """

    def __init__(self, records, tokenizer, max_len=512):
        self.records = records
        self.tokenizer = tokenizer
        self.max_len = max_len

    def __len__(self):
        return len(self.records)

    def __getitem__(self, idx):
        rec = self.records[idx]

        sender = str(rec.get("sender", ""))
        subject = str(rec.get("subject", ""))
        body = str(rec.get("body", ""))
        label = int(rec.get("label", 0))

        # Combine subject + body with special markers
        text = f"[SUBJECT]: {subject} [BODY]: {body}"

        # Tokenize
        encoding = self.tokenizer(
            text,
            max_length=self.max_len,
            padding="max_length",
            truncation=True,
            return_tensors="pt",
        )

        # Extract structured features
        struct_feats = batch_extract_features([sender], [subject], [body])[0]

        return {
            "input_ids": encoding["input_ids"].squeeze(0),
            "attention_mask": encoding["attention_mask"].squeeze(0),
            "structured_feats": struct_feats,
            "label": torch.tensor(label, dtype=torch.float32),
        }


# ═══════════════════════════════════════════════════════════════════════
# DATA LOADING
# ═══════════════════════════════════════════════════════════════════════

def load_dataset(path, smoke_test=False):
    """Load CSV dataset and split into train/val/test."""
    print(f"\n📂 Loading dataset from: {path}")

    df = pd.read_csv(
        path,
        engine='python',
        on_bad_lines='skip',
    )
    
    print(f"  -> Found columns: {list(df.columns)}")
    
    # Handle case where user uploaded raw Phishing_Email.csv by mistake
    if "Email Type" in df.columns and "label" not in df.columns:
        df["label"] = df["Email Type"].map({"Safe Email": 0, "Phishing Email": 1})
    if "Email Text" in df.columns and "body" not in df.columns:
        df["body"] = df["Email Text"]
        
    if "label" not in df.columns:
        raise ValueError(f"CRITICAL ERROR: 'label' column is missing from the CSV! The CSV contains these columns: {list(df.columns)}\nMake sure you uploaded the CORRECT 'final_phishing_dataset.csv' that we generated.")

    # Fill any NaN values in text columns with empty string
    for col in ["sender", "receiver", "subject", "body"]:
        if col in df.columns:
            df[col] = df[col].fillna("")
            
    # Safely convert labels to int, coercing garbage strings to NaN which we then drop
    df["label"] = pd.to_numeric(df["label"], errors='coerce')
    df = df.dropna(subset=["label"])
    df["label"] = df["label"].astype(int)
    records = df.to_dict(orient="records")

    if smoke_test:
        # Use only 200 records for quick testing
        np.random.seed(Config.seed)
        records = list(np.random.choice(records, min(200, len(records)), replace=False))
        print(f"  🧪 SMOKE TEST: Using {len(records)} samples only")

    # Stratified split
    labels = [r["label"] for r in records]

    train_recs, temp_recs, train_labels, temp_labels = train_test_split(
        records, labels,
        test_size=(Config.val_ratio + Config.test_ratio),
        stratify=labels,
        random_state=Config.seed,
    )

    val_size = Config.val_ratio / (Config.val_ratio + Config.test_ratio)
    val_recs, test_recs, _, _ = train_test_split(
        temp_recs, temp_labels,
        test_size=(1 - val_size),
        stratify=temp_labels,
        random_state=Config.seed,
    )

    print(f"  Train: {len(train_recs):,}  |  Val: {len(val_recs):,}  |  Test: {len(test_recs):,}")

    for name, recs in [("Train", train_recs), ("Val", val_recs), ("Test", test_recs)]:
        n_phish = sum(1 for r in recs if r["label"] == 1)
        n_legit = len(recs) - n_phish
        print(f"    {name}: Phishing={n_phish:,} ({n_phish/len(recs)*100:.1f}%)  Legit={n_legit:,}")

    return train_recs, val_recs, test_recs


# ═══════════════════════════════════════════════════════════════════════
# TRAINING LOOP
# ═══════════════════════════════════════════════════════════════════════

def train_one_epoch(model, dataloader, optimizer, scheduler, scaler, device, epoch):
    """Train for one epoch. Returns average loss."""
    model.train()
    total_loss = 0
    num_batches = 0
    correct = 0
    total = 0

    criterion = nn.BCEWithLogitsLoss()

    for batch_idx, batch in enumerate(dataloader):
        input_ids = batch["input_ids"].to(device)
        attention_mask = batch["attention_mask"].to(device)
        structured_feats = batch["structured_feats"].to(device)
        labels = batch["label"].to(device)

        optimizer.zero_grad()

        # Mixed precision forward pass
        if device.type == "cuda":
            with autocast(device_type="cuda"):
                logits = model(input_ids, attention_mask, structured_feats).squeeze(-1)
                loss = criterion(logits, labels)
            scaler.scale(loss).backward()
            scaler.unscale_(optimizer)
            torch.nn.utils.clip_grad_norm_(model.parameters(), Config.max_grad_norm)
            scaler.step(optimizer)
            scaler.update()
        else:
            logits = model(input_ids, attention_mask, structured_feats).squeeze(-1)
            loss = criterion(logits, labels)
            loss.backward()
            torch.nn.utils.clip_grad_norm_(model.parameters(), Config.max_grad_norm)
            optimizer.step()

        scheduler.step()

        total_loss += loss.item()
        num_batches += 1

        # Accuracy tracking
        preds = (torch.sigmoid(logits) >= 0.5).float()
        correct += (preds == labels).sum().item()
        total += labels.size(0)

        # Progress logging
        if (batch_idx + 1) % 100 == 0 or batch_idx == 0:
            avg_loss = total_loss / num_batches
            acc = correct / total * 100
            lr = scheduler.get_last_lr()[0]
            print(f"    Batch {batch_idx+1:>5}/{len(dataloader)}  |  Loss: {avg_loss:.4f}  |  Acc: {acc:.2f}%  |  LR: {lr:.2e}")

    return total_loss / num_batches, correct / total


@torch.no_grad()
def evaluate(model, dataloader, device):
    """Evaluate model. Returns metrics dict."""
    model.eval()
    all_preds = []
    all_probs = []
    all_labels = []
    total_loss = 0
    num_batches = 0

    criterion = nn.BCEWithLogitsLoss()

    for batch in dataloader:
        input_ids = batch["input_ids"].to(device)
        attention_mask = batch["attention_mask"].to(device)
        structured_feats = batch["structured_feats"].to(device)
        labels = batch["label"].to(device)

        if device.type == "cuda":
            with autocast(device_type="cuda"):
                logits = model(input_ids, attention_mask, structured_feats).squeeze(-1)
                loss = criterion(logits, labels)
        else:
            logits = model(input_ids, attention_mask, structured_feats).squeeze(-1)
            loss = criterion(logits, labels)

        total_loss += loss.item()
        num_batches += 1

        probs = torch.sigmoid(logits).cpu().numpy()
        preds = (probs >= 0.5).astype(int)

        all_probs.extend(probs)
        all_preds.extend(preds)
        all_labels.extend(labels.cpu().numpy().astype(int))

    all_preds = np.array(all_preds)
    all_probs = np.array(all_probs)
    all_labels = np.array(all_labels)

    metrics = {
        "loss": total_loss / max(num_batches, 1),
        "accuracy": accuracy_score(all_labels, all_preds),
        "f1": f1_score(all_labels, all_preds, average="binary"),
        "precision": precision_score(all_labels, all_preds, average="binary"),
        "recall": recall_score(all_labels, all_preds, average="binary"),
        "auc_roc": roc_auc_score(all_labels, all_probs),
        "mcc": matthews_corrcoef(all_labels, all_preds),
        "confusion_matrix": confusion_matrix(all_labels, all_preds).tolist(),
    }

    return metrics


# ═══════════════════════════════════════════════════════════════════════
# PRINT METRICS REPORT
# ═══════════════════════════════════════════════════════════════════════

def print_metrics_report(metrics, phase="Test"):
    """Print a formatted metrics report."""
    cm = np.array(metrics["confusion_matrix"])
    tn, fp, fn, tp = cm.ravel()

    print(f"\n{'=' * 60}")
    print(f"  {phase.upper()} METRICS REPORT")
    print(f"{'=' * 60}")
    print(f"  Accuracy:          {metrics['accuracy']*100:.2f}%")
    print(f"  F1 Score:          {metrics['f1']*100:.2f}%")
    print(f"  Precision:         {metrics['precision']*100:.2f}%")
    print(f"  Recall:            {metrics['recall']*100:.2f}%")
    print(f"  AUC-ROC:           {metrics['auc_roc']:.4f}")
    print(f"  MCC:               {metrics['mcc']:.4f}")
    print(f"  Loss:              {metrics['loss']:.4f}")
    print(f"\n  Confusion Matrix:")
    print(f"                     Predicted")
    print(f"                  Legit   Phish")
    print(f"    Actual Legit  {tn:>6}  {fp:>6}")
    print(f"    Actual Phish  {fn:>6}  {tp:>6}")
    print(f"\n  False Positive Rate: {fp/(fp+tn)*100:.2f}%")
    print(f"  False Negative Rate: {fn/(fn+tp)*100:.2f}%")
    print(f"{'=' * 60}")


# ═══════════════════════════════════════════════════════════════════════
# MAIN TRAINING FUNCTION
# ═══════════════════════════════════════════════════════════════════════

def main():
    parser = argparse.ArgumentParser(description="Train Phishing Detector")
    parser.add_argument("--smoke-test", action="store_true", help="Quick test with 200 samples, 1 epoch")
    args, _ = parser.parse_known_args()  # parse_known_args ignores Colab/Jupyter kernel args

    smoke_test = args.smoke_test

    # ── Setup ──
    torch.manual_seed(Config.seed)
    np.random.seed(Config.seed)

    device = torch.device("cuda" if torch.cuda.is_available() else "cpu")
    print(f"\n🖥️  Device: {device}")
    if device.type == "cuda":
        print(f"   GPU: {torch.cuda.get_device_name(0)}")
        print(f"   Memory: {torch.cuda.get_device_properties(0).total_memory / 1024**3:.1f} GB")

    if smoke_test:
        Config.epochs = 1
        Config.batch_size = 4
        Config.num_workers = 0
        print("\n🧪 SMOKE TEST MODE — 200 samples, 1 epoch, batch_size=4")

    # ── Load tokenizer ──
    print("\n📝 Loading DistilBERT tokenizer...")
    tokenizer = DistilBertTokenizer.from_pretrained("distilbert-base-uncased")

    # ── Load data ──
    train_recs, val_recs, test_recs = load_dataset(Config.dataset_path, smoke_test)

    train_dataset = PhishingDataset(train_recs, tokenizer, Config.max_seq_len)
    val_dataset = PhishingDataset(val_recs, tokenizer, Config.max_seq_len)
    test_dataset = PhishingDataset(test_recs, tokenizer, Config.max_seq_len)

    train_loader = DataLoader(train_dataset, batch_size=Config.batch_size, shuffle=True, num_workers=Config.num_workers, pin_memory=(device.type == "cuda"))
    val_loader = DataLoader(val_dataset, batch_size=Config.batch_size, shuffle=False, num_workers=Config.num_workers, pin_memory=(device.type == "cuda"))
    test_loader = DataLoader(test_dataset, batch_size=Config.batch_size, shuffle=False, num_workers=Config.num_workers, pin_memory=(device.type == "cuda"))

    # ── Build Model ──
    print("\n🔧 Building PhishingDetector model...")
    model = PhishingDetector(
        lora_r=Config.lora_r,
        lora_alpha=Config.lora_alpha,
        lora_dropout=Config.lora_dropout,
        lstm_hidden=Config.lstm_hidden,
        attn_heads=Config.attn_heads,
        dropout=Config.dropout,
    )
    model.to(device)
    model.print_model_summary()

    # ── Optimizer (differential learning rates) ──
    lora_params = []
    head_params = []
    for name, param in model.named_parameters():
        if param.requires_grad:
            if "lora" in name.lower():
                lora_params.append(param)
            else:
                head_params.append(param)

    optimizer = AdamW([
        {"params": lora_params, "lr": Config.lr_lora, "weight_decay": Config.weight_decay},
        {"params": head_params, "lr": Config.lr_heads, "weight_decay": Config.weight_decay},
    ])

    total_steps = len(train_loader) * Config.epochs
    scheduler = CosineAnnealingLR(optimizer, T_max=total_steps, eta_min=1e-7)

    scaler = GradScaler() if device.type == "cuda" else None

    print(f"\n  LoRA params:  {len(lora_params)} groups (lr={Config.lr_lora})")
    print(f"  Head params:  {len(head_params)} groups (lr={Config.lr_heads})")
    print(f"  Total steps:  {total_steps:,}")

    # ── Training Loop ──
    print("\n" + "=" * 60)
    print("  TRAINING STARTED")
    print("=" * 60)

    best_val_f1 = 0
    patience_counter = 0
    training_history = []
    total_train_start = time.time()

    for epoch in range(Config.epochs):
        epoch_start = time.time()
        print(f"\n{'─' * 60}")
        print(f"  EPOCH {epoch + 1}/{Config.epochs}")
        print(f"{'─' * 60}")

        # Train
        train_loss, train_acc = train_one_epoch(
            model, train_loader, optimizer, scheduler, scaler, device, epoch
        )

        # Validate
        val_metrics = evaluate(model, val_loader, device)
        epoch_time = time.time() - epoch_start

        print(f"\n  📊 Epoch {epoch+1} Summary:")
        print(f"     Train Loss: {train_loss:.4f}  |  Train Acc: {train_acc*100:.2f}%")
        print(f"     Val Loss:   {val_metrics['loss']:.4f}  |  Val Acc:   {val_metrics['accuracy']*100:.2f}%")
        print(f"     Val F1:     {val_metrics['f1']*100:.2f}%  |  Val AUC:   {val_metrics['auc_roc']:.4f}")
        print(f"     Time:       {epoch_time:.1f}s")

        # Save history
        training_history.append({
            "epoch": epoch + 1,
            "train_loss": train_loss,
            "train_acc": train_acc,
            "val_loss": val_metrics["loss"],
            "val_acc": val_metrics["accuracy"],
            "val_f1": val_metrics["f1"],
            "val_auc": val_metrics["auc_roc"],
            "val_precision": val_metrics["precision"],
            "val_recall": val_metrics["recall"],
            "epoch_time": epoch_time,
        })

        # Early stopping / Best model
        if val_metrics["f1"] > best_val_f1:
            best_val_f1 = val_metrics["f1"]
            patience_counter = 0
            torch.save({
                "model_state_dict": model.state_dict(),
                "optimizer_state_dict": optimizer.state_dict(),
                "epoch": epoch + 1,
                "val_f1": best_val_f1,
                "config": {k: v for k, v in vars(Config).items() if not k.startswith("_")},
            }, Config.save_path)
            print(f"     ✅ Best model saved! (val_f1={best_val_f1*100:.2f}%)")
        else:
            patience_counter += 1
            print(f"     ⏳ No improvement. Patience: {patience_counter}/{Config.early_stop_patience}")
            if patience_counter >= Config.early_stop_patience:
                print(f"\n  🛑 Early stopping triggered at epoch {epoch + 1}")
                break

    total_train_time = time.time() - total_train_start

    # ── Load best model for testing ──
    print("\n\n" + "=" * 60)
    print("  TESTING WITH BEST MODEL")
    print("=" * 60)

    checkpoint = torch.load(Config.save_path, map_location=device, weights_only=False)
    model.load_state_dict(checkpoint["model_state_dict"])

    test_metrics = evaluate(model, test_loader, device)
    print_metrics_report(test_metrics, "TEST")

    # ── Inference Speed Test ──
    print("\n⏱️  Inference Speed Test...")
    model.eval()
    sample_batch = next(iter(test_loader))
    times = []
    for _ in range(10):
        start = time.time()
        with torch.no_grad():
            _ = model(
                sample_batch["input_ids"][:1].to(device),
                sample_batch["attention_mask"][:1].to(device),
                sample_batch["structured_feats"][:1].to(device),
            )
        times.append((time.time() - start) * 1000)
    avg_inference_ms = np.mean(times[1:])  # skip first (warmup)
    print(f"  Average inference time: {avg_inference_ms:.1f}ms per email")

    # ══════════════════════════════════════════════════════════════════
    # FINAL COMPREHENSIVE REPORT
    # ══════════════════════════════════════════════════════════════════

    params = model.count_parameters()
    cm = np.array(test_metrics["confusion_matrix"])
    tn, fp, fn, tp = cm.ravel()

    print("\n\n")
    print("╔" + "═" * 62 + "╗")
    print("║" + "  🏆 PHISHING DETECTOR — FINAL TRAINING REPORT".center(62) + "║")
    print("╠" + "═" * 62 + "╣")

    print("║" + "".center(62) + "║")
    print("║" + "  📐 MODEL ARCHITECTURE".ljust(62) + "║")
    print("║" + "  ─────────────────────────────────────────".ljust(62) + "║")
    print("║" + f"  Base Model:         DistilBERT (6 layers)".ljust(62) + "║")
    print("║" + f"  Fine-tuning:        LoRA (r={Config.lora_r}, α={Config.lora_alpha})".ljust(62) + "║")
    print("║" + f"  Sequence Layer:     Bi-LSTM (hidden={Config.lstm_hidden})".ljust(62) + "║")
    print("║" + f"  Attention:          Multi-Head ({Config.attn_heads} heads)".ljust(62) + "║")
    print("║" + f"  Structured:         10 features → 32 dims".ljust(62) + "║")
    print("║" + f"  Classifier:         544 → 128 → 1".ljust(62) + "║")

    print("║" + "".center(62) + "║")
    print("║" + "  📊 PARAMETERS".ljust(62) + "║")
    print("║" + "  ─────────────────────────────────────────".ljust(62) + "║")
    print("║" + f"  Total:              {params['total']:>12,}".ljust(62) + "║")
    print("║" + f"  Trainable:          {params['trainable']:>12,} ({params['trainable_pct']:.2f}%)".ljust(62) + "║")
    print("║" + f"  Frozen:             {params['frozen']:>12,}".ljust(62) + "║")

    print("║" + "".center(62) + "║")
    print("║" + "  🎯 TEST METRICS".ljust(62) + "║")
    print("║" + "  ─────────────────────────────────────────".ljust(62) + "║")
    print("║" + f"  Accuracy:           {test_metrics['accuracy']*100:>8.2f}%".ljust(62) + "║")
    print("║" + f"  F1 Score:           {test_metrics['f1']*100:>8.2f}%".ljust(62) + "║")
    print("║" + f"  Precision:          {test_metrics['precision']*100:>8.2f}%".ljust(62) + "║")
    print("║" + f"  Recall:             {test_metrics['recall']*100:>8.2f}%".ljust(62) + "║")
    print("║" + f"  AUC-ROC:            {test_metrics['auc_roc']:>8.4f}".ljust(62) + "║")
    print("║" + f"  MCC:                {test_metrics['mcc']:>8.4f}".ljust(62) + "║")
    print("║" + f"  False Positive:     {fp/(fp+tn)*100:>8.2f}%".ljust(62) + "║")
    print("║" + f"  False Negative:     {fn/(fn+tp)*100:>8.2f}%".ljust(62) + "║")

    print("║" + "".center(62) + "║")
    print("║" + "  📋 CONFUSION MATRIX".ljust(62) + "║")
    print("║" + "  ─────────────────────────────────────────".ljust(62) + "║")
    print("║" + f"                        Predicted".ljust(62) + "║")
    print("║" + f"                     Legit    Phish".ljust(62) + "║")
    print("║" + f"    Actual Legit   {tn:>6}   {fp:>6}".ljust(62) + "║")
    print("║" + f"    Actual Phish   {fn:>6}   {tp:>6}".ljust(62) + "║")

    print("║" + "".center(62) + "║")
    print("║" + "  ⚙️  TRAINING CONFIG".ljust(62) + "║")
    print("║" + "  ─────────────────────────────────────────".ljust(62) + "║")
    print("║" + f"  Dataset:            150,000 (75K/75K)".ljust(62) + "║")
    print("║" + f"  Split:              70/15/15".ljust(62) + "║")
    print("║" + f"  Epochs:             {checkpoint['epoch']}/{Config.epochs}".ljust(62) + "║")
    print("║" + f"  Batch size:         {Config.batch_size}".ljust(62) + "║")
    print("║" + f"  Max seq length:     {Config.max_seq_len}".ljust(62) + "║")
    print("║" + f"  LR (LoRA):          {Config.lr_lora}".ljust(62) + "║")
    print("║" + f"  LR (Heads):         {Config.lr_heads}".ljust(62) + "║")
    print("║" + f"  Device:             {device}".ljust(62) + "║")
    print("║" + f"  Total train time:   {total_train_time/60:.1f} minutes".ljust(62) + "║")
    print("║" + f"  Inference speed:    {avg_inference_ms:.1f}ms / email".ljust(62) + "║")

    print("║" + "".center(62) + "║")
    print("║" + "  📈 TRAINING HISTORY".ljust(62) + "║")
    print("║" + "  ─────────────────────────────────────────".ljust(62) + "║")
    print("║" + f"  {'Epoch':>5}  {'Train Loss':>10}  {'Val Loss':>10}  {'Val F1':>8}  {'Val AUC':>8}".ljust(62) + "║")
    for h in training_history:
        print("║" + f"  {h['epoch']:>5}  {h['train_loss']:>10.4f}  {h['val_loss']:>10.4f}  {h['val_f1']*100:>7.2f}%  {h['val_auc']:>8.4f}".ljust(62) + "║")

    print("║" + "".center(62) + "║")
    print("╚" + "═" * 62 + "╝")

    # ── Save all metrics to JSON ──
    all_metrics = {
        "timestamp": datetime.now().isoformat(),
        "device": str(device),
        "model_params": params,
        "config": {k: v for k, v in vars(Config).items() if not k.startswith("_")},
        "training_history": training_history,
        "test_metrics": {k: v if not isinstance(v, np.floating) else float(v) for k, v in test_metrics.items()},
        "inference_speed_ms": float(avg_inference_ms),
        "total_train_time_minutes": total_train_time / 60,
    }

    with open(Config.metrics_path, "w") as f:
        json.dump(all_metrics, f, indent=2, default=str)
    print(f"\n📊 All metrics saved to: {Config.metrics_path}")
    print(f"💾 Best model saved to: {Config.save_path}")
    print(f"\n✅ Training complete!")


if __name__ == "__main__":
    main()
