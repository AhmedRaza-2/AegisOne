import os
import sys
import time
import json
import torch
import torch.nn as nn
from torch.utils.data import Dataset, DataLoader
from transformers import AutoTokenizer, get_linear_schedule_with_warmup
import pandas as pd
import numpy as np
from sklearn.metrics import classification_report, confusion_matrix, precision_recall_fscore_support, accuracy_score

# Ensure AIML/url is in python path
sys.path.append(os.path.dirname(os.path.abspath(__file__)))
from phishing_model_url import URLDetector, extract_url_numerical_features, structuralize_url

# ═══════════════════════════════════════════════════════════════════════
# CONFIGURATION
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
    CHECKPOINT_PATH = os.path.join(os.path.dirname(__file__), "best_v6.pt")
    REPORT_PATH = os.path.join(os.path.dirname(__file__), "v6_training_evaluation_report.md")

# ═══════════════════════════════════════════════════════════════════════
# DATASET CLASS
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

# ═══════════════════════════════════════════════════════════════════════
# METRICS COMPUTATION
# ═══════════════════════════════════════════════════════════════════════

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

# ═══════════════════════════════════════════════════════════════════════
# TRAINING & EVALUATION STEPS
# ═══════════════════════════════════════════════════════════════════════

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
    all_preds, all_labels, all_probs = [], [], []
    
    with torch.no_grad():
        for batch in loader:
            ids = batch["input_ids"].to(device)
            mask = batch["mask"].to(device)
            num = batch["num_feats"].to(device)
            labels = batch["label"].to(device)
            
            logits = model(ids, mask, num)
            loss = criterion(logits, labels)
            total_loss += loss.item()
            
            probs = torch.softmax(logits, dim=1).cpu().numpy()
            preds = torch.argmax(logits, dim=1).cpu().numpy()
            
            all_preds.extend(preds)
            all_labels.extend(labels.cpu().numpy())
            all_probs.extend(probs)
            
    avg_loss = total_loss / len(loader)
    metrics = compute_detailed_metrics(all_labels, all_preds, num_classes=Config.NUM_CLASSES)
    metrics['val_loss'] = float(avg_loss)
    metrics['all_preds'] = all_preds
    metrics['all_labels'] = all_labels
    metrics['all_probs'] = all_probs
    return metrics

# ═══════════════════════════════════════════════════════════════════════
# MAIN TRAINING PIPELINE
# ═══════════════════════════════════════════════════════════════════════

def run_v6_training():
    print("="*70)
    print(" AEGISONE V6 3-CLASS MODEL TRAINING")
    print(f" Device: {Config.DEVICE} | Model: {Config.MODEL_NAME} | Num Classes: {Config.NUM_CLASSES}")
    print("="*70)
    
    tokenizer = AutoTokenizer.from_pretrained(Config.MODEL_NAME)
    
    train_csv_path = os.path.join(os.path.dirname(__file__), "v6_train.csv")
    val_csv_path   = os.path.join(os.path.dirname(__file__), "v6_val.csv")
    test_csv_path  = os.path.join(os.path.dirname(__file__), "v6_test.csv")
    
    print("\nLoading V6 datasets...")
    train_df = pd.read_csv(train_csv_path)
    val_df   = pd.read_csv(val_csv_path)
    test_df  = pd.read_csv(test_csv_path)
    
    print(f"  Train Set: {len(train_df)} rows")
    print(f"  Val Set:   {len(val_df)} rows")
    print(f"  Test Set:  {len(test_df)} rows")
    
    num_workers = 0
    train_loader = DataLoader(V6Dataset(train_df, tokenizer, Config.MAX_LEN), batch_size=Config.BATCH_SIZE, shuffle=True, num_workers=num_workers)
    val_loader   = DataLoader(V6Dataset(val_df, tokenizer, Config.MAX_LEN), batch_size=Config.BATCH_SIZE, shuffle=False, num_workers=num_workers)
    test_loader  = DataLoader(V6Dataset(test_df, tokenizer, Config.MAX_LEN), batch_size=Config.BATCH_SIZE, shuffle=False, num_workers=num_workers)
    
    model = URLDetector(model_name=Config.MODEL_NAME, num_labels=Config.NUM_CLASSES)
    model.to(Config.DEVICE)
    
    criterion = nn.CrossEntropyLoss()
    optimizer = torch.optim.AdamW(filter(lambda p: p.requires_grad, model.parameters()), lr=Config.LR)
    
    total_steps = len(train_loader) * Config.EPOCHS
    scheduler = get_linear_schedule_with_warmup(optimizer, num_warmup_steps=int(total_steps*0.1), num_training_steps=total_steps)
    
    epoch_logs = []
    best_val_loss = float('inf')
    best_epoch = -1
    best_metrics = None
    
    print("\nStarting Training Epochs...")
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
        
        # Best Checkpoint Selection Criterion:
        # Min Validation Loss subject to Malicious FNR <= 15%
        if val_fnr <= Config.FNR_THRESHOLD and val_loss < best_val_loss:
            best_val_loss = val_loss
            best_epoch = epoch
            best_metrics = val_metrics
            print(f"  >>> NEW BEST CHECKPOINT (Epoch {epoch}, Val Loss: {val_loss:.4f}, FPR: {val_fpr*100:.2f}%, FNR: {val_fnr*100:.2f}%) Saved to {Config.CHECKPOINT_PATH}")
            
            ckpt = {
                'epoch': epoch,
                'model_state_dict': model.state_dict(),
                'config': {
                    'num_labels': Config.NUM_CLASSES,
                    'model_name': Config.MODEL_NAME
                },
                'metrics': {
                    'val_loss': val_loss,
                    'val_fpr': val_fpr,
                    'val_fnr': val_fnr,
                    'macro_f1': macro_f1,
                    'accuracy': acc
                }
            }
            torch.save(ckpt, Config.CHECKPOINT_PATH)
            
    if best_epoch == -1:
        best_epoch = Config.EPOCHS
        torch.save({'model_state_dict': model.state_dict(), 'config': {'num_labels': Config.NUM_CLASSES, 'model_name': Config.MODEL_NAME}}, Config.CHECKPOINT_PATH)
        print("\nFallback: Saved last epoch as best checkpoint.")
        
    print(f"\nTraining Completed. Best epoch: Epoch {best_epoch} with Val Loss {best_val_loss:.4f}")
    
    # Load best checkpoint for post-training evaluations
    print("\nLoading Best V6 Checkpoint for Evaluation...")
    best_ckpt = torch.load(Config.CHECKPOINT_PATH, map_location=Config.DEVICE)
    model.load_state_dict(best_ckpt['model_state_dict'])
    model.eval()
    
    # ═══════════════════════════════════════════════════════════════════════
    # POST-TRAINING EVALUATIONS
    # ═══════════════════════════════════════════════════════════════════════
    
    print("\n" + "="*70)
    print(" EVALUATION 1: INDEPENDENT V6 TEST SET (v6_test.csv)")
    print("="*70)
    test_metrics = evaluate_loader(model, test_loader, criterion, Config.DEVICE)
    print(f"Test Set Results ({len(test_df)} URLs):")
    print(f"  Accuracy: {test_metrics['accuracy']*100:.2f}% | Macro F1: {test_metrics['macro_f1']:.4f}")
    print(f"  Benign FPR: {test_metrics['benign_fpr']*100:.2f}% | Malicious FNR: {test_metrics['malicious_fnr']*100:.2f}%")
    print(f"  Per-Class F1 -> Benign: {test_metrics['per_class']['Benign']['f1']:.4f} | Phishing: {test_metrics['per_class']['Phishing']['f1']:.4f} | Malware: {test_metrics['per_class']['Malware']['f1']:.4f}")
    print(f"  Confusion Matrix:\n{np.array(test_metrics['confusion_matrix'])}")

    print("\n" + "="*70)
    print(" EVALUATION 2: FROZEN 400-URL EXTERNAL BENCHMARK")
    print("="*70)
    bench_b = pd.read_csv(r"api\tests\data\benchmark_b_clean_benign.csv")
    bench_c = pd.read_csv(r"api\tests\data\benchmark_c_clean_malicious.csv")
    
    bench_b_urls = bench_b['url'].tolist() if 'url' in bench_b.columns else bench_b.iloc[:,0].tolist()
    bench_c_urls = bench_c['url'].tolist() if 'url' in bench_c.columns else bench_c.iloc[:,0].tolist()
    
    bench_df = pd.DataFrame([
        {'url': u, 'label': 0} for u in bench_b_urls
    ] + [
        {'url': u, 'label': 1} for u in bench_c_urls
    ])
    
    bench_loader = DataLoader(V6Dataset(bench_df, tokenizer, Config.MAX_LEN), batch_size=Config.BATCH_SIZE, shuffle=False)
    bench_metrics = evaluate_loader(model, bench_loader, criterion, Config.DEVICE)
    
    print(f"Frozen 400 Benchmark Results (200 Benign / 200 Malicious):")
    print(f"  Accuracy: {bench_metrics['accuracy']*100:.2f}% | Macro F1: {bench_metrics['macro_f1']:.4f}")
    print(f"  External Benign FPR: {bench_metrics['benign_fpr']*100:.2f}%")
    print(f"  External Malicious FNR: {bench_metrics['malicious_fnr']*100:.2f}%")
    print(f"  Confusion Matrix:\n{np.array(bench_metrics['confusion_matrix'])}")

    print("\n" + "="*70)
    print(" EVALUATION 3: SEMANTIC HARD-URL BENCHMARK SUITE")
    print("="*70)
    
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
    
    hard_results = []
    class_names_map = {0: "BENIGN (0)", 1: "PHISHING (1)", 2: "MALWARE (2)"}
    
    with torch.no_grad():
        for u in hard_urls:
            struct_u = structuralize_url(u)
            enc = tokenizer(struct_u, max_length=Config.MAX_LEN, padding="max_length", truncation=True, return_tensors="pt")
            num = extract_url_numerical_features(u).unsqueeze(0)
            
            ids = enc["input_ids"].to(Config.DEVICE)
            mask = enc["attention_mask"].to(Config.DEVICE)
            num = num.to(Config.DEVICE)
            
            logits = model(ids, mask, num)
            probs = torch.softmax(logits, dim=1).cpu().numpy()[0]
            pred_class = int(np.argmax(probs))
            
            hard_results.append({
                'url': u,
                'predicted_class': class_names_map[pred_class],
                'p_benign': float(probs[0]),
                'p_phishing': float(probs[1]),
                'p_malware': float(probs[2]),
                'p_malicious_total': float(probs[1] + probs[2])
            })
            print(f"  {u:75s} -> Pred: {class_names_map[pred_class]:14s} | P(benign): {probs[0]:.4f} | P(malicious): {probs[1]+probs[2]:.4f}")

    print("\n" + "="*70)
    print(" EVALUATION 4: V4 vs V5 vs V6 MODEL COMPARISON")
    print("="*70)
    
    comparison_data = [
        {"Model": "V4 (DistilBERT Raw)", "Ext FPR": "79.0%", "Ext FNR": "0.0%", "google.com P(mal)": "0.8807", "microsoft.com P(mal)": "0.7361", "docs.google.com P(mal)": "0.9937"},
        {"Model": "V5 (Structural Token)", "Ext FPR": "33.5%", "Ext FNR": "9.0%", "google.com P(mal)": "0.8807", "microsoft.com P(mal)": "0.7361", "docs.google.com P(mal)": "0.9937"},
        {"Model": "V6 (Reconciled Data)", "Ext FPR": f"{bench_metrics['benign_fpr']*100:.2f}%", "Ext FNR": f"{bench_metrics['malicious_fnr']*100:.2f}%", 
         "google.com P(mal)": f"{hard_results[0]['p_malicious_total']:.4f}", 
         "microsoft.com P(mal)": f"{hard_results[5]['p_malicious_total']:.4f}", 
         "docs.google.com P(mal)": f"{hard_results[9]['p_malicious_total']:.4f}"}
    ]
    comp_df = pd.DataFrame(comparison_data)
    print(comp_df.to_string(index=False))

    # Generate Report
    generate_report_file(epoch_logs, best_epoch, best_val_loss, test_metrics, bench_metrics, hard_results, comp_df)

def generate_report_file(epoch_logs, best_epoch, best_val_loss, test_metrics, bench_metrics, hard_results, comp_df):
    report_lines = []
    report_lines.append("# AegisOne V6 3-Class Training & Evaluation Report\n")
    report_lines.append(f"**Build Timestamp:** {time.strftime('%Y-%m-%d %H:%M:%S')}  ")
    report_lines.append(f"**Model Architecture:** Hybrid DistilBERT + 10 Numerical Features (`URLDetector`, `num_labels=3`)  ")
    report_lines.append(f"**Training Dataset:** `v6_train.csv` (79,067 rows, 3 classes: `0=Benign`, `1=Phishing`, `2=Malware`)  ")
    report_lines.append(f"**Validation Dataset:** `v6_val.csv` (7,262 rows, domain-disjoint)  ")
    report_lines.append(f"**Best Checkpoint Selection Metric:** Min Validation Loss ({best_val_loss:.4f}) at Epoch {best_epoch} subject to Malicious FNR <= 15%\n")
    report_lines.append("---\n")
    
    report_lines.append("## 1. Epoch-by-Epoch Training & Validation Log\n")
    report_lines.append("| Epoch | Time | Train Loss | Val Loss | Accuracy | Macro F1 | Benign FPR | Malicious FNR | Benign F1 | Phishing F1 | Malware F1 |")
    report_lines.append("| :---: | :---: | :---: | :---: | :---: | :---: | :---: | :---: | :---: | :---: | :---: |")
    for log in epoch_logs:
        report_lines.append(f"| {log['epoch']} | {log['time_sec']}s | {log['train_loss']:.4f} | {log['val_loss']:.4f} | {log['accuracy']*100:.2f}% | {log['macro_f1']:.4f} | {log['benign_fpr']*100:.2f}% | {log['malicious_fnr']*100:.2f}% | {log['per_class']['Benign']['f1']:.4f} | {log['per_class']['Phishing']['f1']:.4f} | {log['per_class']['Malware']['f1']:.4f} |")
    
    report_lines.append("\n---\n")
    report_lines.append("## 2. Independent Test Set Evaluation (`v6_test.csv` - 9,328 URLs)\n")
    report_lines.append(f"- **Accuracy**: {test_metrics['accuracy']*100:.2f}%")
    report_lines.append(f"- **Macro F1**: {test_metrics['macro_f1']:.4f}")
    report_lines.append(f"- **Benign False Positive Rate (FPR)**: **{test_metrics['benign_fpr']*100:.2f}%**")
    report_lines.append(f"- **Malicious False Negative Rate (FNR)**: **{test_metrics['malicious_fnr']*100:.2f}%**\n")
    
    report_lines.append("### Per-Class Performance:")
    report_lines.append("| Class | Precision | Recall | F1-Score | Support |")
    report_lines.append("| :--- | :---: | :---: | :---: | :---: |")
    for cname in ['Benign', 'Phishing', 'Malware']:
        m = test_metrics['per_class'][cname]
        report_lines.append(f"| **{cname}** | {m['precision']:.4f} | {m['recall']:.4f} | {m['f1']:.4f} | {m['support']} |")
        
    report_lines.append("\n### 3x3 Test Confusion Matrix:")
    report_lines.append("```text")
    report_lines.append("Pred ->     [0=Benign]  [1=Phishing]  [2=Malware]")
    cm = test_metrics['confusion_matrix']
    report_lines.append(f"Actual 0:    {cm[0][0]:9d}   {cm[0][1]:11d}   {cm[0][2]:10d}")
    report_lines.append(f"Actual 1:    {cm[1][0]:9d}   {cm[1][1]:11d}   {cm[1][2]:10d}")
    report_lines.append(f"Actual 2:    {cm[2][0]:9d}   {cm[2][1]:11d}   {cm[2][2]:10d}")
    report_lines.append("```\n")
    
    report_lines.append("---\n")
    report_lines.append("## 3. Frozen 400-URL External Benchmark Evaluation\n")
    report_lines.append(f"- **External Accuracy**: {bench_metrics['accuracy']*100:.2f}%")
    report_lines.append(f"- **External Macro F1**: {bench_metrics['macro_f1']:.4f}")
    report_lines.append(f"- **External Benign FPR**: **{bench_metrics['benign_fpr']*100:.2f}%**")
    report_lines.append(f"- **External Malicious FNR**: **{bench_metrics['malicious_fnr']*100:.2f}%**\n")
    
    report_lines.append("### 3x3 Benchmark Confusion Matrix:")
    report_lines.append("```text")
    report_lines.append("Pred ->     [0=Benign]  [1=Phishing]  [2=Malware]")
    bcm = bench_metrics['confusion_matrix']
    report_lines.append(f"Actual 0:    {bcm[0][0]:9d}   {bcm[0][1]:11d}   {bcm[0][2]:10d}")
    report_lines.append(f"Actual 1:    {bcm[1][0]:9d}   {bcm[1][1]:11d}   {bcm[1][2]:10d}")
    report_lines.append(f"Actual 2:    {bcm[2][0]:9d}   {bcm[2][1]:11d}   {bcm[2][2]:10d}")
    report_lines.append("```\n")

    report_lines.append("---\n")
    report_lines.append("## 4. Semantic Hard-URL Benchmark Suite\n")
    report_lines.append("| Tested URL | Predicted Class | P(benign) | P(phishing) | P(malware) | P(malicious total) |")
    report_lines.append("| :--- | :---: | :---: | :---: | :---: | :---: |")
    for res in hard_results:
        report_lines.append(f"| `{res['url']}` | **{res['predicted_class']}** | {res['p_benign']:.4f} | {res['p_phishing']:.4f} | {res['p_malware']:.4f} | **{res['p_malicious_total']:.4f}** |")

    report_lines.append("\n---\n")
    report_lines.append("## 5. Comparative Evaluation Across Model Generations\n")
    report_lines.append(comp_df.to_markdown(index=False))
    report_lines.append("\n---\n")
    report_lines.append("> [!NOTE]\n> **RESTRAINT CONFIRMATION**:\n> - Fusion engine remains UNCHANGED.\n> - Model deployment remains PAUSED pending inspection.\n")

    with open(Config.REPORT_PATH, "w", encoding="utf-8") as f:
        f.write("\n".join(report_lines))
        
    print(f"\nSaved Complete Training & Evaluation Report to: {Config.REPORT_PATH}")

if __name__ == "__main__":
    run_v6_training()
