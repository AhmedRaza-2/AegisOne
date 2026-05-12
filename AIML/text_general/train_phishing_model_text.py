"""
train_phishing_model_text.py — General Text Phishing Trainer
============================================================
Strategy: Sequential Fine-Tuning (Email Intelligence -> General Text)
Architecture: DistilBERT-LoRA + Bi-LSTM + Attention + Text-Heuristics
"""

import os
import time
import json
import torch
import torch.nn as nn
import pandas as pd
import numpy as np
from torch.utils.data import Dataset, DataLoader
from torch.optim import AdamW
from torch.optim.lr_scheduler import ReduceLROnPlateau
from transformers import DistilBertTokenizer
from sklearn.model_selection import train_test_split
from sklearn.metrics import classification_report, f1_score, accuracy_score, confusion_matrix
from tqdm import tqdm

from phishing_model_text import PhishingDetectorText, batch_extract_text_features

# ═══════════════════════════════════════════════════════════════════════
# 1. CONFIGURATION
# ═══════════════════════════════════════════════════════════════════════

IS_COLAB = os.path.exists('/content')

class Config:
    # --- Paths ---
    if IS_COLAB:
        drive_root = "/content/drive/MyDrive/AegisOne/text_general"
        email_model_path = "/content/drive/MyDrive/AegisOne/email/best_phishing_model.pt"
        dataset_path = "general_text_phishing_dataset.csv" # Uploaded to Colab sidebar
        save_path = os.path.join(drive_root, "best_text_model.pt")
        metrics_path = os.path.join(drive_root, "training_metrics.json")
    else:
        email_model_path = "../email/best_phishing_model.pt"
        dataset_path = "general_text_phishing_dataset.csv"
        save_path = "best_text_model.pt"
        metrics_path = "training_metrics.json"

    # --- Hyperparameters ---
    model_name = "distilbert-base-uncased"
    max_len = 128     # SMS/Chat are usually short
    batch_size = 64
    epochs = 10       # Fewer epochs needed because we start from Email Model
    lr = 5e-5         # Lower LR to avoid "Catastrophic Forgetting"
    weight_decay = 0.01
    seed = 42

# ═══════════════════════════════════════════════════════════════════════
# 2. DATASET ENGINE
# ═══════════════════════════════════════════════════════════════════════

class GeneralTextDataset(Dataset):
    def __init__(self, texts, labels, tokenizer, max_len):
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
            padding='max_length',
            truncation=True,
            return_tensors='pt'
        )

        return {
            'input_ids': encoding['input_ids'].flatten(),
            'attention_mask': encoding['attention_mask'].flatten(),
            'text': text,
            'label': torch.tensor(label, dtype=torch.float)
        }

# ═══════════════════════════════════════════════════════════════════════
# 3. TRAINING ENGINE
# ═══════════════════════════════════════════════════════════════════════

def train_one_epoch(model, loader, optimizer, criterion, device):
    model.train()
    total_loss = 0
    all_preds = []
    all_labels = []

    pbar = tqdm(loader, desc="  Training", leave=False)
    for batch in pbar:
        input_ids = batch['input_ids'].to(device)
        attention_mask = batch['attention_mask'].to(device)
        labels = batch['label'].to(device).unsqueeze(1)
        
        # Extract features from text batch
        struct_feats = batch_extract_text_features(batch['text']).to(device)

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
        
        pbar.set_postfix({'loss': f"{loss.item():.4f}"})

    avg_loss = total_loss / len(loader)
    acc = accuracy_score(all_labels, all_preds)
    return avg_loss, acc

def evaluate(model, loader, criterion, device):
    model.eval()
    total_loss = 0
    all_preds = []
    all_probs = []
    all_labels = []

    with torch.no_grad():
        for batch in tqdm(loader, desc="  Evaluating", leave=False):
            input_ids = batch['input_ids'].to(device)
            attention_mask = batch['attention_mask'].to(device)
            labels = batch['label'].to(device).unsqueeze(1)
            struct_feats = batch_extract_text_features(batch['text']).to(device)

            logits = model(input_ids, attention_mask, struct_feats)
            loss = criterion(logits, labels)
            total_loss += loss.item()

            probs = torch.sigmoid(logits)
            preds = (probs > 0.5).float()
            
            all_probs.extend(probs.cpu().numpy())
            all_preds.extend(preds.cpu().numpy())
            all_labels.extend(labels.cpu().numpy())

    avg_loss = total_loss / len(loader)
    acc = accuracy_score(all_labels, all_preds)
    f1 = f1_score(all_labels, all_preds)
    report = classification_report(all_labels, all_preds, target_names=["Legit", "Phishing"])
    
    return avg_loss, acc, f1, report

# ═══════════════════════════════════════════════════════════════════════
# 4. MAIN RUNNER
# ═══════════════════════════════════════════════════════════════════════

def main():
    print("="*60)
    print("🚀 AEGIS-ONE | GENERAL TEXT PHISHING TRAINER")
    print("="*60)

    device = torch.device("cuda" if torch.cuda.is_available() else "cpu")
    print(f"🖥️  Device: {device}")

    # 1. Load Data
    if not os.path.exists(Config.dataset_path):
        print(f"❌ Error: Dataset not found at {Config.dataset_path}")
        return

    df = pd.read_csv(Config.dataset_path)
    print(f"📊 Dataset: {len(df)} samples | Phishing ratio: {df['label'].mean():.2%}")

    train_df, val_df = train_test_split(df, test_size=0.15, random_state=Config.seed, stratify=df['label'])
    
    tokenizer = DistilBertTokenizer.from_pretrained(Config.model_name)
    
    train_loader = DataLoader(
        GeneralTextDataset(train_df['text'].values, train_df['label'].values, tokenizer, Config.max_len),
        batch_size=Config.batch_size, shuffle=True
    )
    val_loader = DataLoader(
        GeneralTextDataset(val_df['text'].values, val_df['label'].values, tokenizer, Config.max_len),
        batch_size=Config.batch_size
    )

    # 2. Init Model & Transfer Intelligence
    model = PhishingDetectorText().to(device)
    
    # LOAD FROM EMAIL MODEL
    if os.path.exists(Config.email_model_path):
        model.load_from_email_model(Config.email_model_path, device=device)
    else:
        print("⚠️ Warning: No Email model found. Training from scratch (DistilBERT only).")

    # 3. Training Setup
    optimizer = AdamW(model.parameters(), lr=Config.lr, weight_decay=Config.weight_decay)
    criterion = nn.BCEWithLogitsLoss()
    scheduler = ReduceLROnPlateau(optimizer, mode='max', factor=0.5, patience=2, verbose=True)

    best_f1 = 0
    history = {"train_loss": [], "val_loss": [], "val_f1": []}

    print(f"\n🏁 Starting Sequential Fine-tuning ({Config.epochs} epochs)...")
    
    for epoch in range(Config.epochs):
        start_time = time.time()
        
        train_loss, train_acc = train_one_epoch(model, train_loader, optimizer, criterion, device)
        val_loss, val_acc, val_f1, report = evaluate(model, val_loader, criterion, device)
        
        elapsed = time.time() - start_time
        scheduler.step(val_f1)

        print(f"Epoch {epoch+1}/{Config.epochs} | Loss: {train_loss:.4f} | Val F1: {val_f1:.4f} | Time: {elapsed:.1f}s")
        
        if val_f1 > best_f1:
            best_f1 = val_f1
            torch.save(model.state_dict(), Config.save_path)
            print(f"⭐ New Best Model Saved (F1: {val_f1:.4f})")
            
        history["train_loss"].append(train_loss)
        history["val_loss"].append(val_loss)
        history["val_f1"].append(val_f1)

    # 4. Save Metrics
    with open(Config.metrics_path, 'w') as f:
        json.dump(history, f)
    
    print("\n" + "="*60)
    print("✅ TRAINING COMPLETE")
    print(f"📍 Best Model: {Config.save_path}")
    print(f"🏆 Final F1:   {best_f1:.4f}")
    print("="*60)

if __name__ == "__main__":
    main()
