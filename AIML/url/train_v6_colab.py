# ==============================================================================
# AEGISONE V6 3-CLASS MODEL TRAINING & EVALUATION SCRIPT (GOOGLE COLAB EDITION)
# ==============================================================================
# Instructions for Google Colab:
# 1. Open Google Colab (https://colab.research.google.com/)
# 2. Set Runtime -> Change runtime type -> T4 GPU (Hardware Accelerator)
# 3. Upload 'v6_train.csv', 'v6_val.csv', 'v6_test.csv' to Colab files
# 4. Copy-paste this ENTIRE script into a code cell and click Run!
# ==============================================================================

import os
import re
import sys
import time
import json
import urllib.parse
from urllib.parse import urlparse, unquote
import ipaddress
from datetime import datetime

# Install required packages if missing in Colab
try:
    import tldextract
except ImportError:
    os.system("pip install tldextract transformers scikit-learn pandas numpy torch")
    import tldextract

import torch
import torch.nn as nn
from torch.utils.data import Dataset, DataLoader
from transformers import AutoModel, AutoTokenizer, get_linear_schedule_with_warmup
import pandas as pd
import numpy as np
from sklearn.metrics import classification_report, confusion_matrix, precision_recall_fscore_support, accuracy_score

try:
    from google.colab import files
    COLAB_ENV = True
except ImportError:
    COLAB_ENV = False

# ═══════════════════════════════════════════════════════════════════════
# 1. CONFIGURATION
# ═══════════════════════════════════════════════════════════════════════

class Config:
    MODEL_NAME = "distilbert-base-uncased"
    MAX_LEN = 128
    BATCH_SIZE = 64
    EPOCHS = 8
    LR = 3e-5
    NUM_CLASSES = 3  # 3-Class Model (0=Benign, 1=Phishing, 2=Malware)
    DEVICE = torch.device("cuda" if torch.cuda.is_available() else "cpu")
    FNR_THRESHOLD = 0.15 # Maximum allowable malicious FNR for checkpoint selection
    CHECKPOINT_PATH = "best_v6.pt"
    REPORT_PATH = "v6_training_evaluation_report.md"

SUSPICIOUS_TLDS = {'.tk', '.ml', '.ga', '.cf', '.gq', '.xyz', '.top', '.cc', '.zip', '.click', '.link'}
SHORTENERS      = {'bit.ly', 't.co', 'goo.gl', 'tinyurl.com', 'ow.ly', 'is.gd'}

# ═══════════════════════════════════════════════════════════════════════
# 2. URL STRUCTURAL PARSER & FEATURE EXTRACTOR
# ═══════════════════════════════════════════════════════════════════════

def structuralize_url(url: str) -> str:
    url_str = str(url).strip()
    if not url_str:
        return "[EMPTY_URL]"
    parsed_url = url_str
    if not re.match(r'^[a-zA-Z]+://', parsed_url):
        parsed_url = 'http://' + parsed_url
    components = []
    try:
        parsed = urlparse(parsed_url)
        ext = tldextract.extract(parsed_url)
        subdomain, domain, tld = ext.subdomain, ext.domain, ext.suffix
        hostname = parsed.hostname
        if not domain and not tld and hostname:
            domain = hostname
        if subdomain:
            components.append(f"[SUB] {subdomain}")
        if domain:
            components.append(f"[DOM] {domain}")
        if tld:
            components.append(f"[TLD] {tld}")
        path = unquote(parsed.path)
        query = unquote(parsed.query)
        fragment = unquote(parsed.fragment)
        if path and path != '/':
            for seg in path.split('/'):
                if seg:
                    components.append(f"[PATH_SEG] {seg}")
        if query:
            for param in query.split('&'):
                key = param.split('=', 1)[0]
                components.append(f"[QUERY_PARAM] {key}")
        if fragment:
            components.append(f"[FRAGMENT] {fragment}")
        if f".{tld}" in SUSPICIOUS_TLDS:
            components.append("[SUS_TLD]")
        if any(s in url_str for s in SHORTENERS):
            components.append("[SHORTENED]")
        if hostname:
            try:
                ipaddress.ip_address(hostname)
                components.append("[IP_ADDRESS]")
            except ValueError:
                pass
    except Exception:
        return "[MALFORMED_URL_PARSE_ERROR]"
    if not components:
        return "[UNPARSEABLE_URL]"
    return " ".join(components)

def canonicalize_url(url_str: str) -> str:
    if not isinstance(url_str, str):
        url_str = str(url_str)
    url_str = url_str.strip()
    if not url_str:
        return ""
    has_scheme = url_str.startswith(('http://', 'https://'))
    raw = url_str if has_scheme else 'http://' + url_str
    try:
        parsed = urllib.parse.urlparse(raw)
        scheme = parsed.scheme.lower() if parsed.scheme else 'http'
        netloc = parsed.netloc.lower()
        if netloc.endswith(':80') and scheme == 'http':
            netloc = netloc[:-3]
        elif netloc.endswith(':443') and scheme == 'https':
            netloc = netloc[:-4]
        path = parsed.path
        if path:
            path = urllib.parse.unquote(path)
            if path == '/':
                path = ''
        else:
            path = ''
        query_str = ''
        if parsed.query:
            query_params = urllib.parse.parse_qsl(parsed.query, keep_blank_values=True)
            query_params.sort(key=lambda x: (x[0], x[1]))
            query_str = '?' + urllib.parse.urlencode(query_params)
        return f"{scheme}://{netloc}{path}{query_str}"
    except Exception:
        u = url_str.lower().strip()
        for prefix in ['https://', 'http://']:
            if u.startswith(prefix):
                u = u[len(prefix):]
        return u.rstrip('/')

def extract_url_numerical_features(url: str) -> torch.Tensor:
    canon_url = canonicalize_url(url)
    url_clean = canon_url.replace("https://", "").replace("http://", "")
    try:
        parsed = urlparse(canon_url)
        domain = parsed.netloc
    except Exception:
        return torch.zeros(10, dtype=torch.float32)

    features = [
        np.log1p(len(url_clean)) / 5.0,
        np.log1p(len(domain))  / 4.0,
        min(url_clean.count('.'), 10) / 10.0,
        min(url_clean.count('-'), 10) / 10.0,
        min(sum(c in "!@#$%^&*_=+" for c in url_clean), 20) / 20.0,
        1.0 if any(s in domain for s in SHORTENERS) else 0.0,
        1.0 if any(url_clean.endswith(t) for t in SUSPICIOUS_TLDS) else 0.0,
        1.0 if re.match(r'\d+\.\d+\.\d+\.\d+', domain) else 0.0,
        np.log1p(len(parsed.path))  / 4.0,
        np.log1p(len(parsed.query)) / 5.0,
    ]
    return torch.tensor(features, dtype=torch.float32)

# ═══════════════════════════════════════════════════════════════════════
# 3. HYBRID URL DETECTOR MODEL
# ═══════════════════════════════════════════════════════════════════════

class URLDetector(nn.Module):
    def __init__(self, model_name: str = 'distilbert-base-uncased', num_labels: int = 3):
        super().__init__()
        self.bert = AutoModel.from_pretrained(model_name)
        for param in self.bert.parameters():
            param.requires_grad = False
        if hasattr(self.bert, "transformer"):
            for param in self.bert.transformer.layer[-1:].parameters():
                param.requires_grad = True
        elif hasattr(self.bert, "encoder"):
            for param in self.bert.encoder.layer[-1:].parameters():
                param.requires_grad = True
                
        self.feature_mlp = nn.Sequential(
            nn.Linear(10, 64),
            nn.ReLU(),
            nn.Linear(64, 32)
        )
        self.classifier = nn.Sequential(
            nn.Linear(self.bert.config.hidden_size + 32, 256),
            nn.ReLU(),
            nn.Dropout(0.3),
            nn.Linear(256, num_labels)
        )

    def forward(self, input_ids, attention_mask, numerical_feats):
        outputs = self.bert(input_ids=input_ids, attention_mask=attention_mask)
        text_feat = outputs.last_hidden_state[:, 0, :]
        num_feat = self.feature_mlp(numerical_feats)
        combined = torch.cat([text_feat, num_feat], dim=1)
        return self.classifier(combined)

# ═══════════════════════════════════════════════════════════════════════
# 4. DATASET & METRICS LOGIC
# ═══════════════════════════════════════════════════════════════════════

class V6Dataset(Dataset):
    def __init__(self, df, tokenizer, max_len):
        self.urls = df['url'].values
        self.labels = df['label'].values
        self.tokenizer = tokenizer
        self.max_len = max_len

    def __len__(self):
        return len(self.urls)

    def __getitem__(self, idx):
        raw_url = str(self.urls[idx])
        struct_url = structuralize_url(raw_url)
        enc = self.tokenizer(
            struct_url,
            max_length=self.max_len,
            padding="max_length",
            truncation=True,
            return_tensors="pt"
        )
        num_feats = extract_url_numerical_features(raw_url)
        return {
            "input_ids": enc["input_ids"].flatten(),
            "mask": enc["attention_mask"].flatten(),
            "num_feats": num_feats,
            "label": torch.tensor(self.labels[idx], dtype=torch.long)
        }

def compute_detailed_metrics(y_true, y_pred, num_classes=3):
    acc = accuracy_score(y_true, y_pred)
    prec, recall, f1, support = precision_recall_fscore_support(y_true, y_pred, labels=list(range(num_classes)), zero_division=0)
    macro_f1 = np.mean(f1)
    cm = confusion_matrix(y_true, y_pred, labels=list(range(num_classes)))
    
    y_true_bin = (np.array(y_true) > 0).astype(int)
    y_pred_bin = (np.array(y_pred) > 0).astype(int)
    tn, fp, fn, tp = confusion_matrix(y_true_bin, y_pred_bin, labels=[0, 1]).ravel()
    
    benign_fpr = fp / (fp + tn) if (fp + tn) > 0 else 0.0
    malicious_fnr = fn / (fn + tp) if (fn + tp) > 0 else 0.0
    
    per_class_metrics = {}
    class_names = {0: 'Benign', 1: 'Phishing', 2: 'Malware'}
    for i in range(num_classes):
        per_class_metrics[class_names[i]] = {
            'precision': float(prec[i]),
            'recall': float(recall[i]),
            'f1': float(f1[i]),
            'support': int(support[i])
        }
    return {
        'accuracy': float(acc),
        'macro_f1': float(macro_f1),
        'benign_fpr': float(benign_fpr),
        'malicious_fnr': float(malicious_fnr),
        'per_class': per_class_metrics,
        'confusion_matrix': cm.tolist()
    }

def train_epoch(model, loader, optimizer, scheduler, criterion, device):
    model.train()
    total_loss = 0.0
    for batch in loader:
        ids = batch["input_ids"].to(device)
        mask = batch["mask"].to(device)
        num = batch["num_feats"].to(device)
        labels = batch["label"].to(device)
        
        optimizer.zero_grad()
        logits = model(ids, mask, num)
        loss = criterion(logits, labels)
        loss.backward()
        torch.nn.utils.clip_grad_norm_(model.parameters(), 1.0)
        optimizer.step()
        scheduler.step()
        total_loss += loss.item()
    return total_loss / len(loader)

def evaluate_loader(model, loader, criterion, device):
    model.eval()
    total_loss = 0.0
    all_preds, all_labels = [], []
    with torch.no_grad():
        for batch in loader:
            ids = batch["input_ids"].to(device)
            mask = batch["mask"].to(device)
            num = batch["num_feats"].to(device)
            labels = batch["label"].to(device)
            logits = model(ids, mask, num)
            loss = criterion(logits, labels)
            total_loss += loss.item()
            preds = torch.argmax(logits, dim=1).cpu().numpy()
            all_preds.extend(preds)
            all_labels.extend(labels.cpu().numpy())
    metrics = compute_detailed_metrics(all_labels, all_preds, num_classes=Config.NUM_CLASSES)
    metrics['val_loss'] = float(total_loss / len(loader))
    return metrics

# ═══════════════════════════════════════════════════════════════════════
# 5. MAIN EXECUTION PIPELINE
# ═══════════════════════════════════════════════════════════════════════

def main():
    print("="*70)
    print(" AEGISONE V6 3-CLASS MODEL TRAINING (GOOGLE COLAB GPU EDITION)")
    print(f" Device: {Config.DEVICE} | Model: {Config.MODEL_NAME} | Num Classes: {Config.NUM_CLASSES}")
    print("="*70)

    # Check for uploaded datasets
    for f_check in ["v6_train.csv", "v6_val.csv", "v6_test.csv"]:
        if not os.path.exists(f_check):
            print(f"\n[ERROR] '{f_check}' not found in current directory!")
            if COLAB_ENV:
                print(f"Please upload '{f_check}' to Google Colab using the file upload button on the left.")
                files.upload()
            else:
                sys.exit(1)

    print("\nLoading V6 datasets...")
    train_df = pd.read_csv("v6_train.csv")
    val_df   = pd.read_csv("v6_val.csv")
    test_df  = pd.read_csv("v6_test.csv")
    
    print(f"  Train Set: {len(train_df)} rows")
    print(f"  Val Set:   {len(val_df)} rows")
    print(f"  Test Set:  {len(test_df)} rows")
    
    tokenizer = AutoTokenizer.from_pretrained(Config.MODEL_NAME)
    
    train_loader = DataLoader(V6Dataset(train_df, tokenizer, Config.MAX_LEN), batch_size=Config.BATCH_SIZE, shuffle=True, num_workers=2, pin_memory=True)
    val_loader   = DataLoader(V6Dataset(val_df, tokenizer, Config.MAX_LEN), batch_size=Config.BATCH_SIZE, shuffle=False, num_workers=2, pin_memory=True)
    test_loader  = DataLoader(V6Dataset(test_df, tokenizer, Config.MAX_LEN), batch_size=Config.BATCH_SIZE, shuffle=False, num_workers=2, pin_memory=True)
    
    model = URLDetector(model_name=Config.MODEL_NAME, num_labels=Config.NUM_CLASSES)
    model.to(Config.DEVICE)
    
    criterion = nn.CrossEntropyLoss()
    optimizer = torch.optim.AdamW(filter(lambda p: p.requires_grad, model.parameters()), lr=Config.LR)
    
    total_steps = len(train_loader) * Config.EPOCHS
    scheduler = get_linear_schedule_with_warmup(optimizer, num_warmup_steps=int(total_steps*0.1), num_training_steps=total_steps)
    
    epoch_logs = []
    best_val_loss = float('inf')
    best_epoch = -1
    
    print("\nStarting Fast GPU Training...")
    for epoch in range(1, Config.EPOCHS + 1):
        t0 = time.time()
        train_loss = train_epoch(model, train_loader, optimizer, scheduler, criterion, Config.DEVICE)
        val_metrics = evaluate_loader(model, val_loader, criterion, Config.DEVICE)
        t1 = time.time()
        
        val_loss = val_metrics['val_loss']
        val_fpr  = val_metrics['benign_fpr']
        val_fnr  = val_metrics['malicious_fnr']
        macro_f1 = val_metrics['macro_f1']
        acc      = val_metrics['accuracy']
        
        log_entry = {
            'epoch': epoch,
            'time_sec': round(t1 - t0, 1),
            'train_loss': float(train_loss),
            'val_loss': float(val_loss),
            'accuracy': float(acc),
            'macro_f1': float(macro_f1),
            'benign_fpr': float(val_fpr),
            'malicious_fnr': float(val_fnr),
            'per_class': val_metrics['per_class'],
            'confusion_matrix': val_metrics['confusion_matrix']
        }
        epoch_logs.append(log_entry)
        
        print(f"Epoch {epoch}/{Config.EPOCHS} | Time: {t1-t0:.1f}s | Train Loss: {train_loss:.4f} | Val Loss: {val_loss:.4f}")
        print(f"  Accuracy: {acc*100:.2f}% | Macro F1: {macro_f1:.4f} | FPR: {val_fpr*100:.2f}% | FNR: {val_fnr*100:.2f}%")
        print(f"  Per-Class F1 -> Benign: {val_metrics['per_class']['Benign']['f1']:.4f} | Phishing: {val_metrics['per_class']['Phishing']['f1']:.4f} | Malware: {val_metrics['per_class']['Malware']['f1']:.4f}")
        print(f"  Confusion Matrix: {val_metrics['confusion_matrix']}")
        
        if val_fnr <= Config.FNR_THRESHOLD and val_loss < best_val_loss:
            best_val_loss = val_loss
            best_epoch = epoch
            print(f"  >>> NEW BEST CHECKPOINT (Epoch {epoch}, Val Loss: {val_loss:.4f}) Saved!")
            ckpt = {
                'epoch': epoch,
                'model_state_dict': model.state_dict(),
                'config': {'num_labels': Config.NUM_CLASSES, 'model_name': Config.MODEL_NAME},
                'metrics': {'val_loss': val_loss, 'val_fpr': val_fpr, 'val_fnr': val_fnr, 'macro_f1': macro_f1}
            }
            torch.save(ckpt, Config.CHECKPOINT_PATH)

    if best_epoch == -1:
        best_epoch = Config.EPOCHS
        torch.save({'model_state_dict': model.state_dict(), 'config': {'num_labels': Config.NUM_CLASSES, 'model_name': Config.MODEL_NAME}}, Config.CHECKPOINT_PATH)

    print(f"\nTraining Complete! Best Epoch: {best_epoch} with Val Loss: {best_val_loss:.4f}")
    
    # Reload best model for evaluations
    best_ckpt = torch.load(Config.CHECKPOINT_PATH, map_location=Config.DEVICE)
    model.load_state_dict(best_ckpt['model_state_dict'])
    model.eval()

    # Evaluation 1: Test Set
    print("\nRunning Evaluation 1: Independent Test Set (v6_test.csv)...")
    test_metrics = evaluate_loader(model, test_loader, criterion, Config.DEVICE)
    
    # Evaluation 2: Semantic Hard-URL Benchmark Suite
    print("\nRunning Evaluation 2: Semantic Hard-URL Suite...")
    hard_urls = [
        "https://google.com",
        "https://www.google.com",
        "https://accounts.google.com/login",
        "https://paypal.com/login",
        "https://login.microsoft.com",
        "https://microsoft.com/security/",
        "https://cisco.com",
        "https://google.com.attacker-domain.com/login",
        "https://paypal-login-verify.attacker.com/auth",
        "https://docs.google.com/forms/d/e/1FAIpQLSc9nDf52Db7I0r8OD0yH0tL3ciU9YNr1C3lnXE59tREON6_Q/viewform"
    ]
    class_names_map = {0: "BENIGN (0)", 1: "PHISHING (1)", 2: "MALWARE (2)"}
    hard_results = []
    with torch.no_grad():
        for u in hard_urls:
            struct_u = structuralize_url(u)
            enc = tokenizer(struct_u, max_length=Config.MAX_LEN, padding="max_length", truncation=True, return_tensors="pt")
            num = extract_url_numerical_features(u).unsqueeze(0)
            ids, mask, num = enc["input_ids"].to(Config.DEVICE), enc["attention_mask"].to(Config.DEVICE), num.to(Config.DEVICE)
            logits = model(ids, mask, num)
            probs = torch.softmax(logits, dim=1).cpu().numpy()[0]
            pred_class = int(np.argmax(probs))
            hard_results.append({
                'url': u, 'predicted_class': class_names_map[pred_class],
                'p_benign': float(probs[0]), 'p_phishing': float(probs[1]), 'p_malware': float(probs[2]),
                'p_malicious_total': float(probs[1] + probs[2])
            })
            print(f"  {u:75s} -> {class_names_map[pred_class]:14s} | P(benign): {probs[0]:.4f} | P(malicious): {probs[1]+probs[2]:.4f}")

    # Generate Evaluation Report Markdown
    report_lines = []
    report_lines.append("# AegisOne V6 3-Class Training & Evaluation Report\n")
    report_lines.append(f"**Build Timestamp:** {datetime.now().strftime('%Y-%m-%d %H:%M:%S')}  ")
    report_lines.append(f"**Best Checkpoint Epoch:** Epoch {best_epoch} (Val Loss: {best_val_loss:.4f})\n")
    report_lines.append("## 1. Epoch-by-Epoch Training & Validation Log\n")
    report_lines.append("| Epoch | Time | Train Loss | Val Loss | Accuracy | Macro F1 | Benign FPR | Malicious FNR | Benign F1 | Phishing F1 | Malware F1 |")
    report_lines.append("| :---: | :---: | :---: | :---: | :---: | :---: | :---: | :---: | :---: | :---: | :---: |")
    for log in epoch_logs:
        report_lines.append(f"| {log['epoch']} | {log['time_sec']}s | {log['train_loss']:.4f} | {log['val_loss']:.4f} | {log['accuracy']*100:.2f}% | {log['macro_f1']:.4f} | {log['benign_fpr']*100:.2f}% | {log['malicious_fnr']*100:.2f}% | {log['per_class']['Benign']['f1']:.4f} | {log['per_class']['Phishing']['f1']:.4f} | {log['per_class']['Malware']['f1']:.4f} |")
    
    report_lines.append("\n---\n## 2. Independent Test Set Results (`v6_test.csv`)\n")
    report_lines.append(f"- **Accuracy**: {test_metrics['accuracy']*100:.2f}%")
    report_lines.append(f"- **Macro F1**: {test_metrics['macro_f1']:.4f}")
    report_lines.append(f"- **Benign False Positive Rate (FPR)**: **{test_metrics['benign_fpr']*100:.2f}%**")
    report_lines.append(f"- **Malicious False Negative Rate (FNR)**: **{test_metrics['malicious_fnr']*100:.2f}%**\n")
    
    report_lines.append("## 3. Semantic Hard-URL Benchmark Suite Results\n")
    report_lines.append("| Tested URL | Predicted Class | P(benign) | P(phishing) | P(malware) | P(malicious total) |")
    report_lines.append("| :--- | :---: | :---: | :---: | :---: | :---: |")
    for res in hard_results:
        report_lines.append(f"| `{res['url']}` | **{res['predicted_class']}** | {res['p_benign']:.4f} | {res['p_phishing']:.4f} | {res['p_malware']:.4f} | **{res['p_malicious_total']:.4f}** |")
    
    with open(Config.REPORT_PATH, "w", encoding="utf-8") as f:
        f.write("\n".join(report_lines))

    print(f"\nSaved Report to '{Config.REPORT_PATH}'.")

    # AUTO-DOWNLOAD TO LOCAL DISK IF IN GOOGLE COLAB
    if COLAB_ENV:
        print("\n" + "="*70)
        print(" AUTO-DOWNLOADING MODEL CHECKPOINT & REPORT TO YOUR LOCAL DISK")
        print("="*70)
        try:
            files.download(Config.CHECKPOINT_PATH)
            files.download(Config.REPORT_PATH)
            print("  Auto-download triggered! Check your browser's Downloads folder.")
        except Exception as e:
            print(f"  Download trigger error ({e}). Files remain saved in Colab session.")

if __name__ == "__main__":
    main()
