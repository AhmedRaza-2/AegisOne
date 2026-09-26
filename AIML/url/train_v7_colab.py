import os
import sys
import time
import math
import json
import urllib.parse
from datetime import datetime
import pandas as pd
import numpy as np
import torch
import torch.nn as nn
import torch.nn.functional as F
from torch.utils.data import Dataset, DataLoader
from transformers import AutoTokenizer, AutoModel

# Check if running in Google Colab environment
IN_COLAB = 'google.colab' in sys.modules

if IN_COLAB:
    from google.colab import files

LABEL_MAP = {0: "BENIGN", 1: "PHISHING", 2: "MALWARE"}

# ═══════════════════════════════════════════════════════
# 1. CANONICALIZATION & FEATURE EXTRACTION (Shared Invariant)
# ═══════════════════════════════════════════════════════

SUSPICIOUS_TLDS = {'.tk', '.ml', '.ga', '.cf', '.gq', '.xyz', '.top', '.cc', '.zip', '.click', '.link'}
SHORTENERS      = {'bit.ly', 't.co', 'goo.gl', 'tinyurl.com', 'ow.ly', 'is.gd'}

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

def structuralize_url(url: str) -> str:
    import tldextract
    url_str = str(url).strip()
    if not url_str:
        return "[EMPTY_URL]"

    parsed_url = url_str
    if not parsed_url.startswith(('http://', 'https://')):
        parsed_url = 'http://' + parsed_url

    components = []
    try:
        parsed = urllib.parse.urlparse(parsed_url)
        ext = tldextract.extract(parsed_url)

        subdomain = ext.subdomain
        domain = ext.domain
        tld = ext.suffix
        hostname = parsed.hostname

        if not domain and not tld and hostname:
            domain = hostname

        if subdomain:
            components.append(f"[SUB] {subdomain}")
        if domain:
            components.append(f"[DOM] {domain}")
        if tld:
            components.append(f"[TLD] {tld}")

        path = urllib.parse.unquote(parsed.path)
        query = urllib.parse.unquote(parsed.query)

        if path and path != '/':
            for seg in path.split('/'):
                if seg:
                    components.append(f"[PATH_SEG] {seg}")

        if query:
            for param in query.split('&'):
                key = param.split('=', 1)[0]
                components.append(f"[QUERY_PARAM] {key}")

        if f".{tld}" in SUSPICIOUS_TLDS:
            components.append("[SUS_TLD]")

        if any(s in url_str for s in SHORTENERS):
            components.append("[SHORTENED]")

    except Exception:
        return "[MALFORMED_URL]"

    return " ".join(components) if components else "[UNPARSEABLE_URL]"

def extract_url_numerical_features(url: str) -> torch.Tensor:
    import re
    canon_url = canonicalize_url(url)
    url_clean = canon_url.replace("https://", "").replace("http://", "")

    try:
        parsed = urllib.parse.urlparse(canon_url)
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

# ═══════════════════════════════════════════════════════
# 2. MODEL DEFINITION (URLDetector)
# ═══════════════════════════════════════════════════════

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

# ═══════════════════════════════════════════════════════
# 3. DATASET CLASS
# ═══════════════════════════════════════════════════════

class URLDataset(Dataset):
    def __init__(self, urls, labels, tokenizer, max_length=128):
        self.urls = list(urls)
        self.labels = list(labels)
        self.tokenizer = tokenizer
        self.max_length = max_length

    def __len__(self):
        return len(self.urls)

    def __getitem__(self, idx):
        u = self.urls[idx]
        struct_u = structuralize_url(u)
        num_feat = extract_url_numerical_features(u)
        
        encoding = self.tokenizer(
            struct_u,
            truncation=True,
            padding='max_length',
            max_length=self.max_length,
            return_tensors='pt'
        )
        
        return {
            'input_ids': encoding['input_ids'].squeeze(0),
            'attention_mask': encoding['attention_mask'].squeeze(0),
            'numerical_feats': num_feat,
            'labels': torch.tensor(self.labels[idx], dtype=torch.long)
        }

# ═══════════════════════════════════════════════════════
# 4. TRAINING & EVALUATION FUNCTIONS
# ═══════════════════════════════════════════════════════

def train_epoch(model, dataloader, optimizer, criterion, device):
    model.train()
    total_loss = 0.0
    for batch in dataloader:
        optimizer.zero_grad()
        input_ids = batch['input_ids'].to(device)
        attention_mask = batch['attention_mask'].to(device)
        num_feats = batch['numerical_feats'].to(device)
        labels = batch['labels'].to(device)
        
        logits = model(input_ids, attention_mask, num_feats)
        loss = criterion(logits, labels)
        loss.backward()
        optimizer.step()
        
        total_loss += loss.item() * len(labels)
    return total_loss / len(dataloader.dataset)

def evaluate(model, dataloader, device):
    model.eval()
    all_preds, all_labels = [], []
    total_loss = 0.0
    criterion = nn.CrossEntropyLoss()
    
    with torch.no_grad():
        for batch in dataloader:
            input_ids = batch['input_ids'].to(device)
            attention_mask = batch['attention_mask'].to(device)
            num_feats = batch['numerical_feats'].to(device)
            labels = batch['labels'].to(device)
            
            logits = model(input_ids, attention_mask, num_feats)
            loss = criterion(logits, labels)
            total_loss += loss.item() * len(labels)
            
            preds = torch.argmax(logits, dim=1).cpu().numpy()
            all_preds.extend(preds)
            all_labels.extend(labels.cpu().numpy())
            
    val_loss = total_loss / len(dataloader.dataset)
    acc = np.mean(np.array(all_preds) == np.array(all_labels))
    
    # Calculate confusion matrix
    num_classes = 3
    cm = np.zeros((num_classes, num_classes), dtype=int)
    for t, p in zip(all_labels, all_preds):
        if 0 <= t < num_classes and 0 <= p < num_classes:
            cm[t, p] += 1
            
    # Class-level metrics
    f1s = []
    for c in range(num_classes):
        tp = cm[c, c]
        fp = cm[:, c].sum() - tp
        fn = cm[c, :].sum() - tp
        prec = tp / (tp + fp) if (tp + fp) > 0 else 0
        rec  = tp / (tp + fn) if (tp + fn) > 0 else 0
        f1   = 2 * prec * rec / (prec + rec) if (prec + rec) > 0 else 0
        f1s.append(f1)
        
    macro_f1 = np.mean(f1s)
    benign_fpr = cm[0, 1:].sum() / cm[0, :].sum() if cm[0, :].sum() > 0 else 0
    malicious_fnr = cm[1:, 0].sum() / cm[1:, :].sum() if cm[1:, :].sum() > 0 else 0
    
    return {
        'val_loss': val_loss,
        'accuracy': acc,
        'macro_f1': macro_f1,
        'benign_fpr': benign_fpr,
        'malicious_fnr': malicious_fnr,
        'class_f1s': f1s,
        'confusion_matrix': cm
    }

def run_counterfactual_test(model, tokenizer, device):
    model.eval()
    print("\n" + "="*80)
    print("MANDATORY ACCEPTANCE GATE: COUNTERFACTUAL STRUCTURAL INVARIANCE TEST")
    print("="*80)
    
    benign_counterfactuals = [
        'https://google.com',
        'https://www.google.com',
        'https://accounts.google.com',
        'https://google.com/search',
        'https://google.com/login',
        'https://google.com/a/b/c',
        'https://microsoft.com',
        'https://www.microsoft.com',
        'https://login.microsoft.com',
        'https://microsoft.com/security/'
    ]
    
    malicious_counterfactuals = [
        'https://google-login-verify.com',
        'https://google-login-verify.com/login',
        'https://google-login-verify.com/a/b/c',
        'https://paypal-security-update.com',
        'https://paypal-security-update.com/login'
    ]
    
    def eval_list(urls):
        res = []
        for u in urls:
            su = structuralize_url(u)
            enc = tokenizer([su], padding=True, truncation=True, max_length=128, return_tensors='pt')
            nf = batch_extract_url_features([u]).to(device)
            with torch.no_grad():
                logits = model(enc['input_ids'].to(device), enc['attention_mask'].to(device), nf)
                probs = F.softmax(logits, dim=1).cpu().numpy()[0]
                pred = torch.argmax(logits, dim=1).item()
            res.append((u, pred, probs))
        return res

    print("\n[Benign Domain Counterfactuals] (All MUST be classified BENIGN):")
    b_pass = True
    for u, p, probs in eval_list(benign_counterfactuals):
        status = "[PASS]" if p == 0 else "[FAIL]"
        if p != 0:
            b_pass = False
        print(f"  {status:6s} | {u:40s} -> {LABEL_MAP.get(p):10s} | P(benign): {probs[0]:.4f} | P(malicious): {1.0-probs[0]:.4f}")
        
    print("\n[Malicious Domain Counterfactuals] (All MUST be classified MALICIOUS):")
    m_pass = True
    for u, p, probs in eval_list(malicious_counterfactuals):
        status = "[PASS]" if p != 0 else "[FAIL]"
        if p == 0:
            m_pass = False
        print(f"  {status:6s} | {u:40s} -> {LABEL_MAP.get(p):10s} | P(benign): {probs[0]:.4f} | P(malicious): {1.0-probs[0]:.4f}")
        
    gate_passed = b_pass and m_pass
    print(f"\nCounterfactual Invariance Gate Verdict: {'[PASSED]' if gate_passed else '[FAILED]'}")
    return gate_passed

def batch_extract_url_features(urls):
    return torch.stack([extract_url_numerical_features(u) for u in urls])

# ═══════════════════════════════════════════════════════
# 5. MAIN EXECUTION PIPELINE
# ═══════════════════════════════════════════════════════

def main():
    print("="*80)
    print(" AEGISONE V7 3-CLASS MODEL TRAINING (GOOGLE COLAB GPU EDITION)")
    print(" Device: cuda | Model: distilbert-base-uncased | Num Classes: 3")
    print("="*80)
    
    device = torch.device('cuda' if torch.cuda.is_available() else 'cpu')
    print(f"Using device: {device}")
    
    data_dir = "AIML/url" if os.path.exists("AIML/url") else "."
    train_path = os.path.join(data_dir, "v7_train.csv")
    val_path   = os.path.join(data_dir, "v7_val.csv")
    test_path  = os.path.join(data_dir, "v7_test.csv")
    
    print("\nLoading V7 datasets...")
    df_train = pd.read_csv(train_path)
    df_val   = pd.read_csv(val_path)
    df_test  = pd.read_csv(test_path)
    
    print(f"  Train Set: {len(df_train)} rows")
    print(f"  Val Set:   {len(df_val)} rows")
    print(f"  Test Set:  {len(df_test)} rows")
    
    tokenizer = AutoTokenizer.from_pretrained('distilbert-base-uncased')
    
    train_ds = URLDataset(df_train['url'], df_train['label'], tokenizer)
    val_ds   = URLDataset(df_val['url'], df_val['label'], tokenizer)
    test_ds  = URLDataset(df_test['url'], df_test['label'], tokenizer)
    
    train_loader = DataLoader(train_ds, batch_size=32, shuffle=True)
    val_loader   = DataLoader(val_ds, batch_size=64, shuffle=False)
    test_loader  = DataLoader(test_ds, batch_size=64, shuffle=False)
    
    model = URLDetector(model_name='distilbert-base-uncased', num_labels=3).to(device)
    optimizer = torch.optim.AdamW(filter(lambda p: p.requires_grad, model.parameters()), lr=2e-5)
    criterion = nn.CrossEntropyLoss()
    
    epochs = 8
    best_val_loss = float('inf')
    best_checkpoint_path = "best_v7.pt"
    history = []
    
    print("\nStarting Fast GPU Training...")
    for epoch in range(1, epochs + 1):
        t0 = time.time()
        train_loss = train_epoch(model, train_loader, optimizer, criterion, device)
        val_metrics = evaluate(model, val_loader, device)
        elapsed = time.time() - t0
        
        val_loss = val_metrics['val_loss']
        acc = val_metrics['accuracy']
        f1  = val_metrics['macro_f1']
        fpr = val_metrics['benign_fpr']
        fnr = val_metrics['malicious_fnr']
        f1s = val_metrics['class_f1s']
        cm  = val_metrics['confusion_matrix']
        
        print(f"Epoch {epoch}/{epochs} | Time: {elapsed:.1f}s | Train Loss: {train_loss:.4f} | Val Loss: {val_loss:.4f}")
        print(f"  Accuracy: {acc*100:.2f}% | Macro F1: {f1:.4f} | FPR: {fpr*100:.2f}% | FNR: {fnr*100:.2f}%")
        print(f"  Per-Class F1 -> Benign: {f1s[0]:.4f} | Phishing: {f1s[1]:.4f} | Malware: {f1s[2] if len(f1s)>2 else 0:.4f}")
        print(f"  Confusion Matrix: {cm.tolist()}")
        
        history.append({
            'epoch': epoch,
            'train_loss': train_loss,
            'val_loss': val_loss,
            'accuracy': acc,
            'macro_f1': f1,
            'benign_fpr': fpr,
            'malicious_fnr': fnr,
            'f1_benign': f1s[0],
            'f1_phishing': f1s[1],
            'f1_malware': f1s[2] if len(f1s)>2 else 0.0
        })
        
        if val_loss < best_val_loss:
            best_val_loss = val_loss
            torch.save({
                'epoch': epoch,
                'model_state_dict': model.state_dict(),
                'val_loss': val_loss,
                'metrics': val_metrics
            }, best_checkpoint_path)
            print(f"  >>> NEW BEST CHECKPOINT (Epoch {epoch}, Val Loss: {val_loss:.4f}) Saved!")

    print(f"\nTraining Complete! Best Epoch Val Loss: {best_val_loss:.4f}")
    
    # Load Best Checkpoint
    checkpoint = torch.load(best_checkpoint_path, map_location=device, weights_only=False)
    model.load_state_dict(checkpoint['model_state_dict'])
    
    # Run Mandatory Counterfactual Acceptance Gate Test
    cf_passed = run_counterfactual_test(model, tokenizer, device)
    
    # Final Test Set Evaluation
    print("\nRunning Evaluation: Independent Test Set (v7_test.csv)...")
    test_metrics = evaluate(model, test_loader, device)
    print(f"  Test Accuracy: {test_metrics['accuracy']*100:.2f}%")
    print(f"  Test Macro F1: {test_metrics['macro_f1']:.4f}")
    print(f"  Test Benign FPR: {test_metrics['benign_fpr']*100:.2f}%")
    print(f"  Test Malicious FNR: {test_metrics['malicious_fnr']*100:.2f}%")

    # Generate Markdown Report
    report_md = "v7_training_evaluation_report.md"
    with open(report_md, "w") as f:
        f.write("# AegisOne V7 3-Class Training & Evaluation Report\n\n")
        f.write(f"**Build Timestamp:** {datetime.now().strftime('%Y-%m-%d %H:%M:%S')}  \n")
        f.write(f"**Best Checkpoint Epoch:** Epoch {checkpoint['epoch']} (Val Loss: {best_val_loss:.4f})  \n")
        f.write(f"**Counterfactual Invariance Gate:** {'PASSED' if cf_passed else 'FAILED'}\n\n")
        f.write("## 1. Test Set Metrics (`v7_test.csv`)\n\n")
        f.write(f"- **Accuracy**: {test_metrics['accuracy']*100:.2f}%\n")
        f.write(f"- **Macro F1**: {test_metrics['macro_f1']:.4f}\n")
        f.write(f"- **Benign FPR**: {test_metrics['benign_fpr']*100:.2f}%\n")
        f.write(f"- **Malicious FNR**: {test_metrics['malicious_fnr']*100:.2f}%\n")
        
    print(f"\nSaved Report to '{report_md}'.")
    
    if IN_COLAB:
        print("\n" + "="*70)
        print(" AUTO-DOWNLOADING MODEL CHECKPOINT & REPORT TO YOUR LOCAL DISK")
        print("="*70)
        try:
            files.download(best_checkpoint_path)
            files.download(report_md)
            print("  Auto-download triggered! Check your browser's Downloads folder.")
        except Exception as e:
            print(f"  Auto-download notice: {e}")

if __name__ == '__main__':
    main()
