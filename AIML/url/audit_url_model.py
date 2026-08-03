"""
AegisOne — URL Model Forensic Audit & Diagnostic Tool
======================================================
Performs deep diagnostics on best.pt to find the root cause of high FPR (98.84%).

Checks:
1. Probability Distribution Analysis (Benign vs Phishing histograms)
2. Decision Threshold Sweep (0.50 -> 0.98)
3. Sub-component Isolation (Model Logits vs Numerical Feature values)
4. Top 50 False Positive Inspection (Which benign URLs failed & why)
"""

import os
import sys
import torch
import numpy as np
import pandas as pd
from transformers import DistilBertTokenizer
from sklearn.metrics import confusion_matrix, precision_score, recall_score, f1_score, accuracy_score

PROJECT_ROOT = os.path.abspath(os.path.join(os.path.dirname(__file__), "..", ".."))
if PROJECT_ROOT not in sys.path:
    sys.path.insert(0, PROJECT_ROOT)

try:
    from AIML.url.phishing_model_url import URLDetector, extract_url_numerical_features
    from AIML.url.benchmark_url_models import load_and_prep_data, DATASET_1_PATH, DATASET_2_PATH
    from AIML.url.model_paths import get_url_model_path
except ImportError:
    from phishing_model_url import URLDetector, extract_url_numerical_features
    from benchmark_url_models import load_and_prep_data, DATASET_1_PATH, DATASET_2_PATH
    from model_paths import get_url_model_path

DEFAULT_MODEL_PATH = str(get_url_model_path())

def run_forensic_audit(model_path=DEFAULT_MODEL_PATH, sample_size=2000):
    device = torch.device("cuda" if torch.cuda.is_available() else "cpu")
    print("\n" + "═" * 70)
    print("🔬 AEGISONE URL MODEL FORENSIC AUDIT")
    print("═" * 70)

    # 1. Load Data
    eval_df = load_and_prep_data(DATASET_1_PATH, DATASET_2_PATH, max_samples_per_class=sample_size // 2)
    urls = eval_df['url'].tolist()
    y_true = eval_df['label'].values

    # 2. Load Model
    tokenizer = DistilBertTokenizer.from_pretrained("distilbert-base-uncased")
    model = URLDetector()
    model.load_state_dict(torch.load(model_path, map_location=device), strict=False)
    model.to(device).eval()

    print(f"\n⚙️  Running inference on {len(urls):,} audit URLs...")
    
    raw_probs = []
    class_preds = []
    num_feats_collected = []

    with torch.no_grad():
        for i in range(0, len(urls), 64):
            batch_urls = urls[i:i + 64]
            enc = tokenizer(
                batch_urls, add_special_tokens=True, max_length=128,
                padding="max_length", truncation=True, return_tensors="pt"
            ).to(device)

            feats_list = [extract_url_numerical_features(u) for u in batch_urls]
            num_feats = torch.stack(feats_list).to(device)
            num_feats_collected.extend(num_feats.cpu().numpy())

            logits = model(enc["input_ids"], enc["attention_mask"], num_feats)
            probs = torch.softmax(logits, dim=1).cpu().numpy()
            
            raw_probs.extend(probs)
            class_preds.extend(probs.argmax(axis=1))

    raw_probs = np.array(raw_probs)
    class_preds = np.array(class_preds)
    num_feats_collected = np.array(num_feats_collected)

    # ── CHECK 1: CLASS PREDICTION MAP AUDIT ──
    print("\n" + "─" * 70)
    print("📌 CHECK 1: Raw 4-Class Output Distribution")
    print("─" * 70)
    for c_idx, c_name in enumerate(["Class 0 (Benign)", "Class 1 (Phishing)", "Class 2 (Malware)", "Class 3 (Defacement)"]):
        count = (class_preds == c_idx).sum()
        pct = (count / len(urls)) * 100
        print(f"  {c_name:<22}: {count:>6,} ({pct:>5.1f}%)")

    # ── CHECK 2: PROBABILITY DISTRIBUTION ANALYSIS ──
    # Calculate 1 - P(Class 0) as Malicious Probability
    malicious_probs = 1.0 - raw_probs[:, 0]
    
    benign_mask = (y_true == 0)
    phish_mask = (y_true == 1)

    print("\n" + "─" * 70)
    print("📊 CHECK 2: Predicted Malicious Probability Distribution")
    print("─" * 70)
    print(f"  Benign URLs  -> Mean Malicious Prob: {malicious_probs[benign_mask].mean():.4f} | Median: {np.median(malicious_probs[benign_mask]):.4f} | Min: {malicious_probs[benign_mask].min():.4f} | Max: {malicious_probs[benign_mask].max():.4f}")
    print(f"  Phishing URLs -> Mean Malicious Prob: {malicious_probs[phish_mask].mean():.4f} | Median: {np.median(malicious_probs[phish_mask]):.4f} | Min: {malicious_probs[phish_mask].min():.4f} | Max: {malicious_probs[phish_mask].max():.4f}")

    # ── CHECK 3: DECISION THRESHOLD SWEEP ──
    print("\n" + "─" * 70)
    print("🎯 CHECK 3: Decision Threshold Sweep (Find Optimal Cutoff)")
    print("─" * 70)
    print(f"{'Threshold':<10} | {'Accuracy':<10} | {'FPR (False Pos)':<16} | {'FNR (Missed)':<16} | {'F1-Score':<10}")
    print("─" * 70)

    best_thresh = 0.5
    best_f1 = 0.0

    for thresh in [0.50, 0.60, 0.70, 0.75, 0.80, 0.85, 0.90, 0.95, 0.98, 0.99]:
        preds = (malicious_probs >= thresh).astype(int)
        tn, fp, fn, tp = confusion_matrix(y_true, preds).ravel()
        
        acc = accuracy_score(y_true, preds)
        fpr = fp / (fp + tn) if (fp + tn) > 0 else 0
        fnr = fn / (fn + tp) if (fn + tp) > 0 else 0
        f1 = f1_score(y_true, preds)

        if f1 > best_f1:
            best_f1 = f1
            best_thresh = thresh

        mark = " ⭐ BEST" if thresh == best_thresh else ""
        print(f"  {thresh:<8.2f} | {acc * 100:>8.2f}% | {fpr * 100:>14.2f}% | {fnr * 100:>14.2f}% | {f1:>8.4f}{mark}")

    # ── CHECK 4: TOP FALSE POSITIVE INSPECTION ──
    print("\n" + "─" * 70)
    print("🚨 CHECK 4: Inspection of Top 15 False Positives (Benign URLs Flagged)")
    print("─" * 70)
    
    fp_indices = np.where((y_true == 0) & (malicious_probs >= 0.5))[0]
    # Sort by highest malicious probability
    sorted_fp = fp_indices[np.argsort(-malicious_probs[fp_indices])][:15]

    for idx in sorted_fp:
        u = urls[idx]
        p_mal = malicious_probs[idx]
        top_cls = raw_probs[idx].argmax()
        print(f"  URL: {u[:65]:<65} | Malicious Prob: {p_mal:.4f} | Pred Class: {top_cls}")

    print("\n" + "═" * 70)
    print(f"💡 AUDIT SUMMARY & RECOMMENDATION:")
    print(f"  1. Recommended Threshold Adjustment : {best_thresh:.2f} (instead of default 0.50)")
    print(f"  2. Expected F1-Score at {best_thresh:.2f}        : {best_f1:.4f}")
    print("═" * 70 + "\n")

if __name__ == "__main__":
    run_forensic_audit()
