import os
import sys
import torch
import torch.nn as nn
from torch.utils.data import Dataset, DataLoader
from transformers import AutoTokenizer, get_linear_schedule_with_warmup
import pandas as pd
import numpy as np
from sklearn.metrics import classification_report, confusion_matrix
import time

# Import V5 structural parser and URLDetector
from phishing_model_url import URLDetector, extract_url_numerical_features, structuralize_url

# ═══════════════════════════════════════════════════════════════════════
# CONFIGURATION
# ═══════════════════════════════════════════════════════════════════════

class Config:
    MODEL_NAME = "distilbert-base-uncased"
    MAX_LEN = 128
    BATCH_SIZE = 128
    EPOCHS = 10
    LR = 3e-5
    NUM_CLASSES = 4
    DEVICE = torch.device("cuda" if torch.cuda.is_available() else "cpu")
    FNR_THRESHOLD = 0.25 # Maximum allowable binary FNR for checkpoint selection

# ═══════════════════════════════════════════════════════════════════════
# DATASET
# ═══════════════════════════════════════════════════════════════════════

class V5Dataset(Dataset):
    def __init__(self, df, tokenizer, max_len):
        self.urls = df['url'].values
        self.labels = df['label'].values
        self.tokenizer = tokenizer
        self.max_len = max_len

    def __len__(self):
        return len(self.urls)

    def __getitem__(self, idx):
        raw_url = str(self.urls[idx])
        
        # 1. Structural representation for the language model
        struct_url = structuralize_url(raw_url)
        
        # 2. Tokenize the structured string
        enc = self.tokenizer(
            struct_url,
            max_length=self.max_len,
            padding="max_length",
            truncation=True,
            return_tensors="pt"
        )
        
        # 3. Numerical features derived from the raw URL
        num_feats = extract_url_numerical_features(raw_url)
        
        return {
            "input_ids": enc["input_ids"].flatten(),
            "mask": enc["attention_mask"].flatten(),
            "num_feats": num_feats,
            "label": torch.tensor(self.labels[idx], dtype=torch.long)
        }

# ═══════════════════════════════════════════════════════════════════════
# TRAINING & EVALUATION LOGIC
# ═══════════════════════════════════════════════════════════════════════

def get_binary_metrics(y_true, y_pred):
    """
    Converts 4-class labels to binary (0=Benign, 1/2/3=Malicious)
    and computes FPR and FNR.
    """
    y_true_bin = (np.array(y_true) > 0).astype(int)
    y_pred_bin = (np.array(y_pred) > 0).astype(int)
    
    tn, fp, fn, tp = confusion_matrix(y_true_bin, y_pred_bin, labels=[0, 1]).ravel()
    
    fpr = fp / (fp + tn) if (fp + tn) > 0 else 0.0
    fnr = fn / (fn + tp) if (fn + tp) > 0 else 0.0
    
    return fpr, fnr

def train_epoch(model, loader, optimizer, scheduler, criterion):
    model.train()
    total_loss = 0
    for batch in loader:
        ids = batch["input_ids"].to(Config.DEVICE)
        mask = batch["mask"].to(Config.DEVICE)
        num = batch["num_feats"].to(Config.DEVICE)
        labels = batch["label"].to(Config.DEVICE)
        
        optimizer.zero_grad()
        logits = model(ids, mask, num)
        loss = criterion(logits, labels)
        
        loss.backward()
        torch.nn.utils.clip_grad_norm_(model.parameters(), 1.0)
        optimizer.step()
        scheduler.step()
        total_loss += loss.item()
        
    return total_loss / len(loader)

def evaluate(model, loader, criterion):
    model.eval()
    total_loss = 0
    all_preds, all_labels = [], []
    
    with torch.no_grad():
        for batch in loader:
            ids = batch["input_ids"].to(Config.DEVICE)
            mask = batch["mask"].to(Config.DEVICE)
            num = batch["num_feats"].to(Config.DEVICE)
            labels = batch["label"].to(Config.DEVICE)
            
            logits = model(ids, mask, num)
            loss = criterion(logits, labels)
            total_loss += loss.item()
            
            preds = torch.argmax(logits, dim=1).cpu().numpy()
            all_preds.extend(preds)
            all_labels.extend(labels.cpu().numpy())
            
    fpr, fnr = get_binary_metrics(all_labels, all_preds)
    report = classification_report(all_labels, all_preds, zero_division=0, output_dict=True)
    
    return total_loss / len(loader), fpr, fnr, report

# ═══════════════════════════════════════════════════════════════════════
# MAIN
# ═══════════════════════════════════════════════════════════════════════

if __name__ == "__main__":
    print(f"Device: {Config.DEVICE}")
    
    # Load tokenizers
    tokenizer = AutoTokenizer.from_pretrained(Config.MODEL_NAME)
    
    # Load Datasets (using perfectly balanced V4 splits)
    print("Loading datasets...")
    train_df = pd.read_csv("v4_train.csv")
    val_df = pd.read_csv("v4_val.csv")
    
    train_loader = DataLoader(V5Dataset(train_df, tokenizer, Config.MAX_LEN), batch_size=Config.BATCH_SIZE, shuffle=True, num_workers=4, pin_memory=True)
    val_loader = DataLoader(V5Dataset(val_df, tokenizer, Config.MAX_LEN), batch_size=Config.BATCH_SIZE, shuffle=False, num_workers=4, pin_memory=True)
    
    # Model
    model = URLDetector(model_name=Config.MODEL_NAME, num_labels=Config.NUM_CLASSES)
    model.to(Config.DEVICE)
    
    # Class weights for Focal Loss or CrossEntropy (optional, assuming balanced we just use CE)
    criterion = nn.CrossEntropyLoss()
    optimizer = torch.optim.AdamW(filter(lambda p: p.requires_grad, model.parameters()), lr=Config.LR)
    
    total_steps = len(train_loader) * Config.EPOCHS
    scheduler = get_linear_schedule_with_warmup(optimizer, num_warmup_steps=int(total_steps*0.1), num_training_steps=total_steps)
    
    best_fpr = float('inf')
    best_epoch = -1
    
    print("Starting V5 Training...")
    for epoch in range(1, Config.EPOCHS + 1):
        t0 = time.time()
        train_loss = train_epoch(model, train_loader, optimizer, scheduler, criterion)
        val_loss, val_fpr, val_fnr, report = evaluate(model, val_loader, criterion)
        t1 = time.time()
        
        macro_f1 = report['macro avg']['f1-score']
        
        print(f"Epoch {epoch}/{Config.EPOCHS} | Time: {t1-t0:.1f}s")
        print(f"  Train Loss: {train_loss:.4f} | Val Loss: {val_loss:.4f}")
        print(f"  BINARY METRICS -> FPR: {val_fpr*100:.2f}% | FNR: {val_fnr*100:.2f}%")
        print(f"  MULTI  METRICS -> Macro F1: {macro_f1:.4f}")
        
        # Explicit V5 Checkpoint Selection Criterion:
        # Priority 1: FNR must be <= FNR_THRESHOLD
        # Priority 2: Minimize FPR
        if val_fnr <= Config.FNR_THRESHOLD:
            if val_fpr < best_fpr:
                best_fpr = val_fpr
                best_epoch = epoch
                print(f"  >>> New Best Checkpoint (FPR {val_fpr*100:.2f}%) saved!")
                
                ckpt = {
                    'epoch': epoch,
                    'model_state_dict': model.state_dict(),
                    'metrics': {
                        'val_fpr': val_fpr,
                        'val_fnr': val_fnr,
                        'macro_f1': macro_f1
                    }
                }
                torch.save(ckpt, "best_v5.pt")
        else:
            print(f"  >>> Skipped saving (FNR {val_fnr*100:.2f}% exceeds {Config.FNR_THRESHOLD*100:.2f}% threshold)")
            
    print(f"\nTraining Complete. Best checkpoint from Epoch {best_epoch} with FPR: {best_fpr*100:.2f}%")
