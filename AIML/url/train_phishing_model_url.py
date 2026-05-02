"""
train_phishing_model_url.py — Model 2 Training + Preprocessing Pipeline
======================================================================
Role: Handles both Data Preparation and Model Training.
Usage: Run this file on Colab/Local to get the trained model.
"""

import os
import re
import time
import argparse
import numpy as np
import pandas as pd
from datetime import datetime

import torch
import torch.nn as nn
from torch.utils.data import Dataset, DataLoader
from torch.optim import AdamW
from torch.optim.lr_scheduler import CosineAnnealingLR

from transformers import AutoTokenizer
from sklearn.model_selection import train_test_split
from sklearn.metrics import classification_report, f1_score, accuracy_score, confusion_matrix
from sklearn.utils import resample

# Import the model from the architecture file
from phishing_model_url import URLDetector, extract_url_numerical_features

# ═══════════════════════════════════════════════════════════════════════
# 1. CONFIGURATION & DYNAMIC PATHS
# ═══════════════════════════════════════════════════════════════════════

IS_COLAB = os.path.exists('/content')

class Config:
    # Path logic
    if IS_COLAB:
        drive_root = "/content/drive/MyDrive/AegisOne"
        dataset_path = os.path.join(drive_root, "final_url_dataset.csv")
        save_path = os.path.join(drive_root, "best_url_model.pt")
        checkpoint_path = os.path.join(drive_root, "latest_url_checkpoint.pt")
    else:
        dataset_path = "final_url_dataset.csv"
        save_path = "best_url_model.pt"
        checkpoint_path = "latest_url_checkpoint.pt"
    
    bert_model = "bert-base-uncased"
    max_len = 128
    batch_size = 32
    epochs = 5
    lr = 2e-4
    seed = 42
    cpu_cores = os.cpu_count() or 4

def check_dataset():
    """Ensures the final preprocessed dataset exists."""
    if not os.path.exists(Config.dataset_path):
        raise FileNotFoundError(
            f"❌ Dataset not found at {Config.dataset_path}.\n"
            f"Please ensure 'final_url_dataset.csv' is in your Drive (AegisOne folder) or local directory."
        )
    print(f"✅ Training Dataset Verified: {Config.dataset_path}")

# ═══════════════════════════════════════════════════════════════════════
# 2. PREPROCESSING LOGIC (Combined into Training Script)
# ═══════════════════════════════════════════════════════════════════════

def run_preprocessing(kaggle_path, phishtank_path, extra_path):
    """Prepares the final dataset from multiple sources."""
    if os.path.exists(Config.dataset_path):
        print(f"♻️  Dataset found at {Config.dataset_path}. Skipping preprocessing.")
        return

    print("\n🚀 Preprocessing URL Datasets (Kaggle + Phishtank + Extra)...")
    dfs = []
    
    # 1. Kaggle Dataset
    if kaggle_path:
        print("   - Loading Kaggle data...")
        df_k = pd.read_csv(kaggle_path)
        label_map = {'benign': 0, 'phishing': 1, 'malware': 2, 'defacement': 3}
        df_k['label'] = df_k['type'].map(label_map)
        dfs.append(df_k[['url', 'label']])
        
    # 2. Phishtank Dataset
    if phishtank_path:
        print("   - Loading Phishtank data...")
        df_p = pd.read_csv(phishtank_path, usecols=['url'])
        df_p['label'] = 1 # Phishing
        dfs.append(df_p)
        
    # 3. Extra urls.csv Dataset
    if extra_path:
        print("   - Loading extra urls.csv data...")
        df_e = pd.read_csv(extra_path)
        # Standardize columns to match (URL, Label) -> (url, label)
        df_e.columns = [c.lower() for c in df_e.columns]
        label_map_e = {'good': 0, 'bad': 1}
        df_e['label'] = df_e['label'].map(label_map_e)
        dfs.append(df_e[['url', 'label']])

    if not dfs:
        raise FileNotFoundError("❌ No raw data files found. Please provide at least one.")

    df = pd.concat(dfs, ignore_index=True)
    df = df.dropna(subset=['label']).drop_duplicates(subset=['url'])
    df['label'] = df['label'].astype(int)
    
    # Force Protocol-Neutrality: Strip http/https/www from all URLs
    print("🧹 Normalizing URLs for protocol-neutrality...")
    df['url'] = df['url'].apply(normalize_url)
    df = df.drop_duplicates(subset=['url']) # Re-drop duplicates after cleaning
    
    # Balance to 600k total (150k per class)
    samples_per_class = 150000
    balanced_dfs = []
    for label, sub_df in df.groupby('label'):
        if len(sub_df) > samples_per_class:
            balanced_dfs.append(resample(sub_df, replace=False, n_samples=samples_per_class, random_state=Config.seed))
        else:
            balanced_dfs.append(sub_df)
    
    df_final = pd.concat(balanced_dfs).sample(frac=1, random_state=Config.seed).reset_index(drop=True)
    
    if os.path.dirname(Config.dataset_path):
        os.makedirs(os.path.dirname(Config.dataset_path), exist_ok=True)
    df_final.to_csv(Config.dataset_path, index=False)
    print(f"✅ Final protocol-neutral dataset ready: {len(df_final):,} URLs")

# ═══════════════════════════════════════════════════════════════════════
# 3. TRAINING COMPONENTS
# ═══════════════════════════════════════════════════════════════════════

def normalize_url(url):
    """Strips common prefixes for protocol-neutrality."""
    url = str(url).lower().strip()
    url = url.replace("https://", "").replace("http://", "").replace("www.", "")
    return url.rstrip('/')

class URLDataset(Dataset):
    def __init__(self, urls, labels, tokenizer, max_len, augment=False):
        self.urls, self.labels, self.tokenizer, self.max_len = urls, labels, tokenizer, max_len
        self.augment = augment
        
    def __len__(self): return len(self.urls)
    
    def __getitem__(self, idx):
        url = str(self.urls[idx])
        
        # --- PROTOCOL NEUTRALITY ENFORCEMENT ---
        # The dataset is already clean, but we normalize again to be 100% sure
        url_to_train = normalize_url(url)

        encoding = self.tokenizer(url_to_train, max_length=self.max_len, padding='max_length', truncation=True, return_tensors='pt')
        
        return {
            'input_ids': encoding['input_ids'].flatten(),
            'mask': encoding['attention_mask'].flatten(),
            'num_feats': extract_url_numerical_features(url_to_train),
            'label': torch.tensor(self.labels[idx], dtype=torch.long)
        }

def train_epoch(model, loader, optimizer, scheduler, criterion, device):
    model.train()
    losses, correct, total = [], 0, 0
    for i, batch in enumerate(loader):
        ids, mask = batch['input_ids'].to(device), batch['mask'].to(device)
        num, y = batch['num_feats'].to(device), batch['label'].to(device)
        
        optimizer.zero_grad()
        logits = model(ids, mask, num)
        loss = criterion(logits, y); loss.backward(); optimizer.step(); scheduler.step()
        
        losses.append(loss.item())
        preds = torch.max(logits, 1)[1]
        correct += (preds == y).sum().item(); total += y.size(0)
        if (i + 1) % 100 == 0:
            print(f"    Batch {i+1}/{len(loader)} | Loss: {np.mean(losses[-100:]):.4f} | Acc: {correct/total*100:.2f}%")
    return np.mean(losses), correct / total

def eval_model(model, loader, device):
    model.eval()
    all_p, all_y = [], []
    with torch.no_grad():
        for b in loader:
            out = model(b['input_ids'].to(device), b['mask'].to(device), b['num_feats'].to(device))
            all_p.extend(torch.max(out, 1)[1].cpu().numpy()); all_y.extend(b['label'].numpy())
    return accuracy_score(all_y, all_p), f1_score(all_y, all_p, average='macro'), classification_report(all_y, all_p, target_names=['Benign', 'Phishing', 'Malware', 'Defacement'])

def save_checkpoint(model, optimizer, scheduler, epoch, best_f1, path):
    """Saves everything needed to resume training."""
    # Ensure directory exists (crucial for Drive)
    os.makedirs(os.path.dirname(path), exist_ok=True)
    
    checkpoint = {
        'epoch': epoch,
        'model_state_dict': model.state_dict(),
        'optimizer_state_dict': optimizer.state_dict(),
        'scheduler_state_dict': scheduler.state_dict(),
        'best_f1': best_f1
    }
    torch.save(checkpoint, path)
    print(f"📦 Checkpoint saved to {path}")

def load_checkpoint(model, optimizer, scheduler, path, device):
    """Loads a checkpoint and resumes state."""
    if not os.path.exists(path):
        return 0, 0
    print(f"🔄 Found checkpoint at {path}. Resuming...")
    checkpoint = torch.load(path, map_location=device)
    model.load_state_dict(checkpoint['model_state_dict'])
    optimizer.load_state_dict(checkpoint['optimizer_state_dict'])
    scheduler.load_state_dict(checkpoint['scheduler_state_dict'])
    return checkpoint['epoch'] + 1, checkpoint['best_f1']

# ═══════════════════════════════════════════════════════════════════════
# 4. MAIN EXECUTION
# ═══════════════════════════════════════════════════════════════════════

def main():
    parser = argparse.ArgumentParser()
    parser.add_argument("--smoke-test", action="store_true")
    args = parser.parse_args()

    torch.set_num_threads(Config.cpu_cores)
    device = torch.device('cuda' if torch.cuda.is_available() else 'cpu')
    print(f"\n🖥️  Device: {device} | ⚙️  Cores: {Config.cpu_cores}")

    # 1. Dataset Check
    check_dataset()

    # 2. Prepare Data
    print(f"\n🔧 Loading {Config.bert_model}...")
    tokenizer = AutoTokenizer.from_pretrained(Config.bert_model)
    df = pd.read_csv(Config.dataset_path)
    if args.smoke_test: df = df.sample(1000)
    
    train_df, test_df = train_test_split(df, test_size=0.2, stratify=df['label'], random_state=Config.seed)
    
    # Enable augmentation for training, keep original for testing
    train_loader = DataLoader(
        URLDataset(train_df['url'].values, train_df['label'].values, tokenizer, Config.max_len, augment=True), 
        batch_size=Config.batch_size, 
        shuffle=True
    )
    test_loader = DataLoader(
        URLDataset(test_df['url'].values, test_df['label'].values, tokenizer, Config.max_len, augment=False), 
        batch_size=Config.batch_size
    )

    # 3. Model & Train
    model = URLDetector(Config.bert_model).to(device)
    optimizer = AdamW(model.parameters(), lr=Config.lr)
    scheduler = CosineAnnealingLR(optimizer, T_max=len(train_loader)*Config.epochs)
    criterion = nn.CrossEntropyLoss()

    # --- RESUME LOGIC ---
    start_epoch, best_f1 = load_checkpoint(model, optimizer, scheduler, Config.checkpoint_path, device)
    
    print(f"\n🏁 Training Started...")
    for epoch in range(start_epoch, Config.epochs):
        print(f"\n--- Epoch {epoch+1}/{Config.epochs} ---")
        train_loss, train_acc = train_epoch(model, train_loader, optimizer, scheduler, criterion, device)
        val_acc, val_f1, report = eval_model(model, test_loader, device)
        print(f"📊 F1: {val_f1:.4f} | Acc: {val_acc:.4f}\n{report}")
        
        # Save latest checkpoint
        save_checkpoint(model, optimizer, scheduler, epoch, max(best_f1, val_f1), Config.checkpoint_path)

        if val_f1 > best_f1:
            best_f1 = val_f1
            os.makedirs(os.path.dirname(Config.save_path), exist_ok=True)
            torch.save(model.state_dict(), Config.save_path)
            print("⭐ New Best model saved!")

if __name__ == "__main__":
    main()
