# train_general_text_phishing.py — Single‑File Training Pipeline for SMS/Chat Phishing Detection
"""
This script loads the balanced Smishing dataset (CSV with columns LABEL, TEXT), preprocesses it,
trains the DistilBERT‑based PhishingDetectorText model (transfer‑learning from the email model),
evaluates on a validation split, and saves the best checkpoint.

Usage (local or Colab):
    python train_general_text_phishing.py --dataset_path path/to/Dataset_10191.csv \
        [--email_model_path path/to/best_phishing_model.pt] [--output_dir ./]
"""

import os
import argparse
import time
import json
import numpy as np
import pandas as pd
from sklearn.model_selection import train_test_split
from sklearn.metrics import f1_score, accuracy_score, classification_report
import torch
import torch.nn as nn
from torch.utils.data import Dataset, DataLoader
from torch.optim import AdamW
from torch.optim.lr_scheduler import ReduceLROnPlateau
from transformers import DistilBertTokenizer

# Local import – model architecture defined elsewhere in the repository
from phishing_model_text import PhishingDetectorText, batch_extract_text_features


class GeneralTextDataset(Dataset):
    """PyTorch dataset for tokenised SMS/Chat text."""

    def __init__(self, texts, labels, tokenizer, max_len=128):
        self.texts = texts
        self.labels = labels
        self.tokenizer = tokenizer
        self.max_len = max_len

    def __len__(self):
        return len(self.texts)

    def __getitem__(self, idx):
        text = str(self.texts[idx])
        label = self.labels[idx]
        encoding = self.tokenizer(
            text,
            add_special_tokens=True,
            max_length=self.max_len,
            padding="max_length",
            truncation=True,
            return_tensors="pt",
        )
        return {
            "input_ids": encoding["input_ids"].flatten(),
            "attention_mask": encoding["attention_mask"].flatten(),
            "text": text,
            "label": torch.tensor(label, dtype=torch.float),
        }


def parse_args():
    parser = argparse.ArgumentParser(description="Train General‑Text Phishing Detector")
    parser.add_argument("--dataset_path", type=str, required=True, help="Path to CSV dataset (must contain LABEL and TEXT columns)")
    parser.add_argument("--email_model_path", type=str, default="../email/best_phishing_model.pt", help="Path to pretrained email checkpoint (optional)")
    parser.add_argument("--output_dir", type=str, default="./output", help="Directory to store checkpoint and metrics")
    parser.add_argument("--epochs", type=int, default=10, help="Number of training epochs")
    parser.add_argument("--batch_size", type=int, default=64, help="Batch size for training")
    parser.add_argument("--lr", type=float, default=5e-5, help="Learning rate")
    parser.add_argument("--max_len", type=int, default=128, help="Maximum token length for DistilBERT")
    parser.add_argument("--seed", type=int, default=42, help="Random seed for reproducibility")
    parser.add_argument("--test_samples", type=int, default=50, help="Number of samples for a quick post‑training stress test")
    return parser.parse_args()


def set_seed(seed: int):
    np.random.seed(seed)
    torch.manual_seed(seed)
    if torch.cuda.is_available():
        torch.cuda.manual_seed_all(seed)


def train_one_epoch(model, loader, optimizer, criterion, device):
    model.train()
    total_loss = 0.0
    all_preds, all_labels = [], []
    for batch in loader:
        input_ids = batch["input_ids"].to(device)
        attention_mask = batch["attention_mask"].to(device)
        labels = batch["label"].to(device).unsqueeze(1)
        struct_feats = batch_extract_text_features(batch["text"]).to(device)
        optimizer.zero_grad()
        logits = model(input_ids, attention_mask, struct_feats)
        loss = criterion(logits, labels)
        loss.backward()
        nn.utils.clip_grad_norm_(model.parameters(), max_norm=1.0)
        optimizer.step()
        total_loss += loss.item()
        preds = (torch.sigmoid(logits) > 0.5).float()
        all_preds.extend(preds.cpu().numpy())
        all_labels.extend(labels.cpu().numpy())
    avg_loss = total_loss / len(loader)
    acc = accuracy_score(all_labels, all_preds)
    return avg_loss, acc


def evaluate(model, loader, criterion, device):
    model.eval()
    total_loss = 0.0
    all_preds, all_labels = [], []
    with torch.no_grad():
        for batch in loader:
            input_ids = batch["input_ids"].to(device)
            attention_mask = batch["attention_mask"].to(device)
            labels = batch["label"].to(device).unsqueeze(1)
            struct_feats = batch_extract_text_features(batch["text"]).to(device)
            logits = model(input_ids, attention_mask, struct_feats)
            loss = criterion(logits, labels)
            total_loss += loss.item()
            preds = (torch.sigmoid(logits) > 0.5).float()
            all_preds.extend(preds.cpu().numpy())
            all_labels.extend(labels.cpu().numpy())
    avg_loss = total_loss / len(loader)
    acc = accuracy_score(all_labels, all_preds)
    f1 = f1_score(all_labels, all_preds)
    return avg_loss, acc, f1


def stress_test(model, tokenizer, device, dataset_path, n_samples=50, max_len=128):
    df = pd.read_csv(dataset_path)
    if df['LABEL'].dtype == object:
        df['label'] = df['LABEL'].map({"ham": 0, "spam": 0, "smishing": 1}).fillna(0).astype(int)
    else:
        df['label'] = df['LABEL'].astype(int)
    subset = df.sample(n=min(n_samples, len(df)), random_state=0)
    dataset = GeneralTextDataset(subset['TEXT'].values, subset['label'].values, tokenizer, max_len)
    loader = DataLoader(dataset, batch_size=16, shuffle=False)
    model.eval()
    all_preds, all_labels = [], []
    with torch.no_grad():
        for batch in loader:
            input_ids = batch["input_ids"].to(device)
            attention_mask = batch["attention_mask"].to(device)
            labels = batch["label"].to(device).unsqueeze(1)
            struct_feats = batch_extract_text_features(batch["text"]).to(device)
            logits = model(input_ids, attention_mask, struct_feats)
            preds = (torch.sigmoid(logits) > 0.5).float()
            all_preds.extend(preds.cpu().numpy())
            all_labels.extend(labels.cpu().numpy())
    acc = accuracy_score(all_labels, all_preds)
    f1 = f1_score(all_labels, all_preds)
    print(f"\n⚡ Stress‑test ({len(subset)} samples): Accuracy = {acc:.4f}, F1 = {f1:.4f}")


def main():
    args = parse_args()
    set_seed(args.seed)
    os.makedirs(args.output_dir, exist_ok=True)
    device = torch.device('cuda' if torch.cuda.is_available() else 'cpu')
    print(f"🖥️  Device: {device}")

    if not os.path.exists(args.dataset_path):
        raise FileNotFoundError(f"Dataset not found at {args.dataset_path}")
    df = pd.read_csv(args.dataset_path)
    # Normalise label column to binary 0/1
    if df['LABEL'].dtype == object:
        df['label'] = df['LABEL'].map({"ham": 0, "spam": 0, "smishing": 1}).fillna(0).astype(int)
    else:
        df['label'] = df['LABEL'].astype(int)
    print(f"📊 Loaded {len(df)} rows – phishing ratio: {df['label'].mean():.2%}")

    train_df, val_df = train_test_split(df, test_size=0.15, random_state=args.seed, stratify=df['label'])
    tokenizer = DistilBertTokenizer.from_pretrained('distilbert-base-uncased')
    train_set = GeneralTextDataset(train_df['TEXT'].values, train_df['label'].values, tokenizer, args.max_len)
    val_set = GeneralTextDataset(val_df['TEXT'].values, val_df['label'].values, tokenizer, args.max_len)
    train_loader = DataLoader(train_set, batch_size=args.batch_size, shuffle=True)
    val_loader = DataLoader(val_set, batch_size=args.batch_size)

    model = PhishingDetectorText().to(device)
    if os.path.exists(args.email_model_path):
        print(f"🔄 Loading email checkpoint from {args.email_model_path}")
        model.load_from_email_model(args.email_model_path, device=device)
    else:
        print("⚠️  Email checkpoint not found – training from scratch (DistilBERT only).")

    optimizer = AdamW(model.parameters(), lr=args.lr, weight_decay=0.01)
    criterion = nn.BCEWithLogitsLoss()
    scheduler = ReduceLROnPlateau(optimizer, mode='max', factor=0.5, patience=2, verbose=True)

    best_f1 = 0.0
    history = {'train_loss': [], 'val_loss': [], 'val_f1': []}
    print("\n🚀 Starting training…")
    for epoch in range(args.epochs):
        start = time.time()
        train_loss, train_acc = train_one_epoch(model, train_loader, optimizer, criterion, device)
        val_loss, val_acc, val_f1 = evaluate(model, val_loader, criterion, device)
        scheduler.step(val_f1)
        epoch_time = time.time() - start
        print(f"Epoch {epoch+1}/{args.epochs} – Train loss: {train_loss:.4f} – Val loss: {val_loss:.4f} – Val F1: {val_f1:.4f} – Time: {epoch_time:.1f}s")
        if val_f1 > best_f1:
            best_f1 = val_f1
            ckpt_path = os.path.join(args.output_dir, 'best_phishing_model_text.pt')
            torch.save(model.state_dict(), ckpt_path)
            print(f"⭐ New best model saved @ {ckpt_path} (F1={best_f1:.4f})")
        history['train_loss'].append(train_loss)
        history['val_loss'].append(val_loss)
        history['val_f1'].append(val_f1)

    metrics_path = os.path.join(args.output_dir, 'training_metrics.json')
    with open(metrics_path, 'w') as f:
        json.dump(history, f, indent=2)
    print("\n✅ Training complete – Best Val F1:", best_f1)
    print("📁 Metrics saved to", metrics_path)

    if args.test_samples > 0:
        stress_test(model, tokenizer, device, args.dataset_path, n_samples=args.test_samples, max_len=args.max_len)

if __name__ == '__main__':
    main()
