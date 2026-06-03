"""
Phishing Detection Model — Full Training Pipeline
===================================================
Usage:
  # Full training (on GPU — Colab/Kaggle):
  python train_phishing_model.py

  # Smoke test (CPU, quick sanity check):
  python train_phishing_model.py --smo"""

import os, sys, json, time, argparse, re  # Core Python utilities
import numpy as np  # For numerical operations
import pandas as pd  # For data manipulation (reading CSVs)
from datetime import datetime  # For timestamps

import torch  # Main PyTorch library
import torch.nn as nn  # Neural network layers
from torch.utils.data import Dataset, DataLoader  # Data handling
from torch.optim import AdamW  # Adam optimizer with weight decay
from torch.optim.lr_scheduler import CosineAnnealingLR  # Learning rate scheduler
from torch.amp import autocast, GradScaler  # For Mixed Precision (faster GPU training)

from transformers import DistilBertTokenizer  # NLP tokenizer for DistilBERT
from sklearn.model_selection import train_test_split  # Splitting dataset
from sklearn.metrics import (  # NLP Evaluation metrics
    accuracy_score, f1_score, precision_score, recall_score,
    roc_auc_score, confusion_matrix, classification_report,
    matthews_corrcoef
)

# Import the architecture and feature extractor from the other file
from phishing_model_email import PhishingDetector, batch_extract_features


# ═══════════════════════════════════════════════════════════════════════
# CONFIGURATION
# ═══════════════════════════════════════════════════════════════════════

class Config:
    # Data Settings
    dataset_path = "datasets/final_phishing_dataset.csv"  # The 150K record dataset
    max_seq_len = 512  # Maximum words/tokens an email can have
    train_ratio = 0.70  # 70% for studying
    val_ratio = 0.15  # 15% for practice exams
    test_ratio = 0.15  # 15% for the final unseen test

    # Model Settings (Hyperparameters)
    lora_r = 16  # Rank of the LoRA adapter (higher = more capacity, but slower)
    lora_alpha = 32  # Scaling factor for LoRA
    lora_dropout = 0.1  # Prevents adapter overfitting
    lstm_hidden = 256  # Size of the Bi-LSTM memory
    attn_heads = 8  # Number of attention heads (detectives)
    dropout = 0.3  # General dropout for classification head

    # Training Settings
    epochs = 5  # Number of full passes over the data
    batch_size = 16  # How many emails the model reads at once
    lr_lora = 2e-5  # Very small learning rate so we don't break the pre-trained NLP knowledge
    lr_heads = 1e-3  # Larger learning rate for our custom head to learn fast
    weight_decay = 0.01  # Regularization to prevent overfitting
    max_grad_norm = 1.0  # Prevents gradients from exploding
    early_stop_patience = 3  # Stop training if it doesn't improve for 3 epochs
    warmup_steps = 500

    # System Settings
    seed = 42  # Ensures results are reproducible
    num_workers = 2  # Uses CPU cores to load data faster
    save_path = "best_phishing_model.pt"  # Where to save the weights
    metrics_path = "training_metrics.json"  # Where to save the report


# ═══════════════════════════════════════════════════════════════════════
# DATASET
# ═══════════════════════════════════════════════════════════════════════

class PhishingDataset(Dataset):
    """
    PyTorch Dataset: Feeds emails into the neural network one by one.
    """
    def __init__(self, records, tokenizer, max_len=512):
        self.records = records  # List of all email dictionaries
        self.tokenizer = tokenizer  # DistilBERT Tokenizer
        self.max_len = max_len

    def __len__(self):
        return len(self.records)  # Total number of emails

    def __getitem__(self, idx):
        rec = self.records[idx]  # Get a single email

        # Extract text components
        sender = str(rec.get("sender", ""))
        subject = str(rec.get("subject", ""))
        body = str(rec.get("body", ""))
        label = int(rec.get("label", 0))

        # Combine subject and body so the AI reads it as one block of text
        text = f"[SUBJECT]: {subject} [BODY]: {body}"

        # Convert the raw English text into numbers (tokens)
        encoding = self.tokenizer(
            text,
            max_length=self.max_len,
            padding="max_length",  # Add 0s if it's too short
            truncation=True,  # Cut it off if it's too long
            return_tensors="pt",  # Return PyTorch Tensors
        )

        # Simultaneously extract the 10 metadata rules (URL counts, CAPS ratio)
        struct_feats = batch_extract_features([sender], [subject], [body])[0]

        return {
            "input_ids": encoding["input_ids"].squeeze(0),  # The actual word IDs
            "attention_mask": encoding["attention_mask"].squeeze(0),  # Tells AI to ignore padding 0s
            "structured_feats": struct_feats,  # The 10 rules
            "label": torch.tensor(label, dtype=torch.float32),  # 1 = Phishing, 0 = Legit
        }


# ═══════════════════════════════════════════════════════════════════════
# DATA LOADING
# ═══════════════════════════════════════════════════════════════════════

def load_dataset(path, smoke_test=False):
    """Reads the massive CSV and safely splits it into Train, Val, and Test."""
    print(f"\n📂 Loading dataset from: {path}")

    # Load CSV using pandas
    df = pd.read_csv(path, engine='python', on_bad_lines='skip')
    
    # Standardize column names just in case
    if "Email Type" in df.columns and "label" not in df.columns:
        df["label"] = df["Email Type"].map({"Safe Email": 0, "Phishing Email": 1})
    if "Email Text" in df.columns and "body" not in df.columns:
        df["body"] = df["Email Text"]
        
    # Replace missing values (NaN) with empty strings so code doesn't crash
    for col in ["sender", "receiver", "subject", "body"]:
        if col in df.columns:
            df[col] = df[col].fillna("")
            
    # Ensure all labels are strictly integers (0 or 1)
    df["label"] = pd.to_numeric(df["label"], errors='coerce')
    df = df.dropna(subset=["label"])
    df["label"] = df["label"].astype(int)
    records = df.to_dict(orient="records")

    # If testing the code structure, only use 200 emails to save time
    if smoke_test:
        np.random.seed(Config.seed)
        records = list(np.random.choice(records, min(200, len(records)), replace=False))
        print(f"  🧪 SMOKE TEST: Using {len(records)} samples only")

    labels = [r["label"] for r in records]

    # Split: Extract Train (70%) vs Rest (30%), maintaining balance using stratify
    train_recs, temp_recs, train_labels, temp_labels = train_test_split(
        records, labels,
        test_size=(Config.val_ratio + Config.test_ratio),
        stratify=labels,
        random_state=Config.seed,
    )

    # Split the remaining 30% into Validation (15%) and Test (15%)
    val_size = Config.val_ratio / (Config.val_ratio + Config.test_ratio)
    val_recs, test_recs, _, _ = train_test_split(
        temp_recs, temp_labels,
        test_size=(1 - val_size),
        stratify=temp_labels,
        random_state=Config.seed,
    )

    print(f"  Train: {len(train_recs):,}  |  Val: {len(val_recs):,}  |  Test: {len(test_recs):,}")
    return train_recs, val_recs, test_recs


# ═══════════════════════════════════════════════════════════════════════
# TRAINING LOOP
# ═══════════════════════════════════════════════════════════════════════

def train_one_epoch(model, dataloader, optimizer, scheduler, scaler, device, epoch):
    """Trains the model for one full pass over the training data."""
    model.train()  # Turn on Dropout and LayerNorm
    total_loss, correct, total = 0, 0, 0
    num_batches = 0
    criterion = nn.BCEWithLogitsLoss()  # Best loss function for Binary Classification

    for batch_idx, batch in enumerate(dataloader):
        # Move all data to GPU for speed
        input_ids = batch["input_ids"].to(device)
        attention_mask = batch["attention_mask"].to(device)
        structured_feats = batch["structured_feats"].to(device)
        labels = batch["label"].to(device)

        optimizer.zero_grad()  # Reset gradients

        # Use Mixed Precision (autocast) if on GPU to double training speed
        if device.type == "cuda":
            with autocast(device_type="cuda"):
                logits = model(input_ids, attention_mask, structured_feats).squeeze(-1)
                loss = criterion(logits, labels)
            # Backward pass with scaler to prevent numerical underflow
            scaler.scale(loss).backward()
            scaler.unscale_(optimizer)
            torch.nn.utils.clip_grad_norm_(model.parameters(), Config.max_grad_norm)
            scaler.step(optimizer)
            scaler.update()
        else:
            # Standard CPU training
            logits = model(input_ids, attention_mask, structured_feats).squeeze(-1)
            loss = criterion(logits, labels)
            loss.backward()
            torch.nn.utils.clip_grad_norm_(model.parameters(), Config.max_grad_norm)
            optimizer.step()

        scheduler.step()  # Update learning rate

        # Track metrics
        total_loss += loss.item()
        num_batches += 1
        preds = (torch.sigmoid(logits) >= 0.5).float()
        correct += (preds == labels).sum().item()
        total += labels.size(0)

        # Print progress every 100 batches
        if (batch_idx + 1) % 100 == 0 or batch_idx == 0:
            avg_loss = total_loss / num_batches
            acc = correct / total * 100
            print(f"    Batch {batch_idx+1:>5}/{len(dataloader)}  |  Loss: {avg_loss:.4f}  |  Acc: {acc:.2f}%")

    return total_loss / num_batches, correct / total


@torch.no_grad()
def evaluate(model, dataloader, device):
    """Evaluates the model without tracking gradients (saves memory)."""
    model.eval()  # Turn off dropout
    all_preds, all_probs, all_labels = [], [], []
    total_loss, num_batches = 0, 0
    criterion = nn.BCEWithLogitsLoss()

    for batch in dataloader:
        input_ids = batch["input_ids"].to(device)
        attention_mask = batch["attention_mask"].to(device)
        structured_feats = batch["structured_feats"].to(device)
        labels = batch["label"].to(device)

        # Forward pass
        if device.type == "cuda":
            with autocast(device_type="cuda"):
                logits = model(input_ids, attention_mask, structured_feats).squeeze(-1)
                loss = criterion(logits, labels)
        else:
            logits = model(input_ids, attention_mask, structured_feats).squeeze(-1)
            loss = criterion(logits, labels)

        total_loss += loss.item()
        num_batches += 1

        # Convert raw logits to probabilities (0% to 100%) using Sigmoid
        probs = torch.sigmoid(logits).cpu().numpy()
        preds = (probs >= 0.5).astype(int)

        all_probs.extend(probs)
        all_preds.extend(preds)
        all_labels.extend(labels.cpu().numpy().astype(int))

    # Calculate complex metrics (F1, AUC, MCC)
    return {
        "loss": total_loss / max(num_batches, 1),
        "accuracy": accuracy_score(all_labels, all_preds),
        "f1": f1_score(all_labels, all_preds, average="binary"),
        "precision": precision_score(all_labels, all_preds, average="binary"),
        "recall": recall_score(all_labels, all_preds, average="binary"),
        "auc_roc": roc_auc_score(all_labels, all_probs),
        "mcc": matthews_corrcoef(all_labels, all_preds),
        "confusion_matrix": confusion_matrix(all_labels, all_preds).tolist(),
    }


def print_metrics_report(metrics, phase="Test"):
    """Prints a beautiful summary of the evaluation results."""
    cm = np.array(metrics["confusion_matrix"])
    tn, fp, fn, tp = cm.ravel()
    print(f"\n{'=' * 60}\n  {phase.upper()} METRICS REPORT\n{'=' * 60}")
    print(f"  Accuracy:          {metrics['accuracy']*100:.2f}%")
    print(f"  F1 Score:          {metrics['f1']*100:.2f}%")
    print(f"  AUC-ROC:           {metrics['auc_roc']:.4f}")
    print(f"  False Positive Rate: {fp/(fp+tn)*100:.2f}%")
    print(f"  False Negative Rate: {fn/(fn+tp)*100:.2f}%")
    print(f"{'=' * 60}")


# ═══════════════════════════════════════════════════════════════════════
# MAIN TRAINING FUNCTION
# ═══════════════════════════════════════════════════════════════════════

def main():
    parser = argparse.ArgumentParser(description="Train Phishing Detector")
    parser.add_argument("--smoke-test", action="store_true")
    args, _ = parser.parse_known_args()

    smoke_test = args.smoke_test
    torch.manual_seed(Config.seed)  # Lock randomness
    device = torch.device("cuda" if torch.cuda.is_available() else "cpu")  # Find GPU

    if smoke_test:
        Config.epochs = 1
        Config.batch_size = 4
        Config.num_workers = 0

    print("\n📝 Loading DistilBERT tokenizer...")
    tokenizer = DistilBertTokenizer.from_pretrained("distilbert-base-uncased")

    # Load and prepare DataLoaders
    train_recs, val_recs, test_recs = load_dataset(Config.dataset_path, smoke_test)
    train_dataset = PhishingDataset(train_recs, tokenizer, Config.max_seq_len)
    val_dataset = PhishingDataset(val_recs, tokenizer, Config.max_seq_len)
    test_dataset = PhishingDataset(test_recs, tokenizer, Config.max_seq_len)

    train_loader = DataLoader(train_dataset, batch_size=Config.batch_size, shuffle=True)
    val_loader = DataLoader(val_dataset, batch_size=Config.batch_size, shuffle=False)
    test_loader = DataLoader(test_dataset, batch_size=Config.batch_size, shuffle=False)

    print("\n🔧 Building PhishingDetector model...")
    model = PhishingDetector(
        lora_r=Config.lora_r, lora_alpha=Config.lora_alpha,
        lora_dropout=Config.lora_dropout, lstm_hidden=Config.lstm_hidden,
        attn_heads=Config.attn_heads, dropout=Config.dropout,
    ).to(device)

    # Create Dual-Learning Rates (Tiny for NLP, Normal for Custom Head)
    lora_params, head_params = [], []
    for name, param in model.named_parameters():
        if param.requires_grad:
            if "lora" in name.lower(): lora_params.append(param)
            else: head_params.append(param)

    optimizer = AdamW([
        {"params": lora_params, "lr": Config.lr_lora, "weight_decay": Config.weight_decay},
        {"params": head_params, "lr": Config.lr_heads, "weight_decay": Config.weight_decay},
    ])
    scheduler = CosineAnnealingLR(optimizer, T_max=len(train_loader) * Config.epochs)
    scaler = GradScaler() if device.type == "cuda" else None

    # Epoch Loop
    best_val_f1, patience_counter, training_history = 0, 0, []
    total_train_start = time.time()

    for epoch in range(Config.epochs):
        epoch_start = time.time()
        print(f"\n  EPOCH {epoch + 1}/{Config.epochs}")
        
        # Train & Evaluate
        train_loss, train_acc = train_one_epoch(model, train_loader, optimizer, scheduler, scaler, device, epoch)
        val_metrics = evaluate(model, val_loader, device)

        # Early Stopping Logic
        if val_metrics["f1"] > best_val_f1:
            best_val_f1 = val_metrics["f1"]
            patience_counter = 0
            # Save best weights
            torch.save({"model_state_dict": model.state_dict(), "val_f1": best_val_f1}, Config.save_path)
            print(f"     ✅ Best model saved! (val_f1={best_val_f1*100:.2f}%)")
        else:
            patience_counter += 1
            if patience_counter >= Config.early_stop_patience:
                print(f"\n  🛑 Early stopping triggered at epoch {epoch + 1}")
                break

    # ── Final Testing & Speed Evaluation ──
    checkpoint = torch.load(Config.save_path, map_location=device, weights_only=False)
    model.load_state_dict(checkpoint["model_state_dict"])
    
    test_metrics = evaluate(model, test_loader, device)
    print_metrics_report(test_metrics, "TEST")

    # Measure speed (Inference Time)
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
    print(f"  Average inference time: {np.mean(times[1:]):.1f}ms per email")
 for k, v in vars(Config).items() if not k.startswith("_")},
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
