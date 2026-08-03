"""
AegisOne — URL Model Evaluation & Benchmarking Tool
=====================================================
Evaluates the currently loaded URL Phishing Detection model (or any specified model checkpoint)
against external datasets.

Inputs:
  1. URL dataset.csv (mixed URLs)
  2. Phishing URLs.csv (phishing-only URLs)

Outputs:
  - Classification Report (Accuracy, Precision, Recall, F1-Score)
  - Confusion Matrix (False Positive Rate, False Negative Rate)
  - Average Inference Speed (ms/URL)
  - Saved JSON report for side-by-side comparison with future models
"""

import os
import sys
import time
import json
import argparse
import pandas as pd
import numpy as np
import torch

# Ensure project root is in sys.path
PROJECT_ROOT = os.path.abspath(os.path.join(os.path.dirname(__file__), "..", ".."))
if PROJECT_ROOT not in sys.path:
    sys.path.insert(0, PROJECT_ROOT)

from transformers import DistilBertTokenizer
from sklearn.metrics import classification_report, confusion_matrix, f1_score, accuracy_score, precision_score, recall_score

# Import AegisOne URL Detector architecture
try:
    from AIML.url.phishing_model_url import URLDetector, extract_url_numerical_features
    from AIML.url.model_paths import get_url_model_path
except ImportError:
    from phishing_model_url import URLDetector, extract_url_numerical_features
    from model_paths import get_url_model_path

# Default dataset paths
DATASET_1_PATH = r"D:\downloads\Phishing URL dataset\Phishing URL dataset\URL dataset.csv"
DATASET_2_PATH = r"D:\downloads\Phishing URL dataset\Phishing URL dataset\Phishing URLs.csv"
DEFAULT_MODEL_PATH = str(get_url_model_path())

def load_and_prep_data(ds1_path, ds2_path, max_samples_per_class=10000):
    """Loads, cleans, labels, and balances the external evaluation datasets."""
    print("📥 Loading evaluation datasets...")
    dfs = []
    
    # 1. Process Dataset 1 (Mixed)
    if os.path.exists(ds1_path):
        df1 = pd.read_csv(ds1_path)
        df1.columns = [c.lower() for c in df1.columns]
        # Standardize labels
        label_map = {
            'legitimate': 0, 'benign': 0, 'good': 0, 0: 0,
            'phishing': 1, 'malware': 1, 'defacement': 1, 'bad': 1, 1: 1
        }
        df1['label'] = df1['type'].astype(str).str.lower().map(label_map)
        dfs.append(df1[['url', 'label']].dropna())
        print(f"   ✓ Dataset 1 loaded: {len(df1):,} rows")
    else:
        print(f"   ⚠️ Warning: Dataset 1 not found at {ds1_path}")

    # 2. Process Dataset 2 (Phishing Only)
    if os.path.exists(ds2_path):
        df2 = pd.read_csv(ds2_path)
        df2.columns = [c.lower() for c in df2.columns]
        df2['label'] = 1 # Force phishing label
        dfs.append(df2[['url', 'label']].dropna())
        print(f"   ✓ Dataset 2 loaded: {len(df2):,} rows")
    else:
        print(f"   ⚠️ Warning: Dataset 2 not found at {ds2_path}")

    if not dfs:
        raise FileNotFoundError("❌ Neither evaluation dataset was found!")

    df = pd.concat(dfs, ignore_index=True)
    df = df.drop_duplicates(subset=['url']).reset_index(drop=True)
    df['label'] = df['label'].astype(int)

    # Balance samples for a fair evaluation
    benign_df = df[df['label'] == 0]
    phish_df = df[df['label'] == 1]
    
    n_benign = min(len(benign_df), max_samples_per_class)
    n_phish = min(len(phish_df), max_samples_per_class)
    n_per_class = min(n_benign, n_phish)

    eval_df = pd.concat([
        benign_df.sample(n=n_per_class, random_state=42),
        phish_df.sample(n=n_per_class, random_state=42)
    ]).sample(frac=1, random_state=42).reset_index(drop=True)

    print(f"\n✅ Evaluation Test Set Ready: {len(eval_df):,} total URLs ({n_per_class:,} Benign vs {n_per_class:,} Phishing)")
    return eval_df

def run_benchmark(model_path, eval_df, output_name="model_benchmark_report.json", batch_size=64):
    """Runs batch inference and outputs evaluation metrics."""
    device = torch.device("cuda" if torch.cuda.is_available() else "cpu")
    print(f"\n🖥️  Running benchmark on: {device}")
    
    print(f"📦 Loading Model Weights: {model_path}")
    if not os.path.exists(model_path):
        raise FileNotFoundError(f"❌ Model weights not found at {model_path}")
        
    tokenizer = DistilBertTokenizer.from_pretrained("distilbert-base-uncased")
    model = URLDetector()
    model.load_state_dict(torch.load(model_path, map_location=device), strict=False)
    model.to(device).eval()

    urls = eval_df['url'].tolist()
    y_true = eval_df['label'].values
    y_pred = []
    y_probs = []

    start_time = time.time()
    
    with torch.no_grad():
        for i in range(0, len(urls), batch_size):
            batch_urls = urls[i:i + batch_size]
            enc = tokenizer(
                batch_urls, add_special_tokens=True, max_length=128,
                padding="max_length", truncation=True, return_tensors="pt"
            ).to(device)

            # Numerical feature extraction
            num_feats_list = [extract_url_numerical_features(u) for u in batch_urls]
            num_feats = torch.stack(num_feats_list).to(device)

            logits = model(enc["input_ids"], enc["attention_mask"], num_feats)
            probs = torch.softmax(logits, dim=1)

            # Class 0 = Benign, Classes 1,2,3 = Malicious/Phishing
            benign_probs = probs[:, 0].cpu().numpy()
            malicious_probs = 1.0 - benign_probs

            # Prediction threshold (0.5)
            preds = (malicious_probs >= 0.5).astype(int)

            y_pred.extend(preds)
            y_probs.extend(malicious_probs)

            if (i + batch_size) % 1280 == 0 or (i + batch_size) >= len(urls):
                print(f"   Processed {min(i + batch_size, len(urls)):,}/{len(urls):,} URLs...")

    total_time = time.time() - start_time
    avg_latency_ms = (total_time / len(urls)) * 1000

    y_pred = np.array(y_pred)
    
    # Compute confusion matrix metrics
    cm = confusion_matrix(y_true, y_pred)
    tn, fp, fn, tp = cm.ravel()

    acc = accuracy_score(y_true, y_pred)
    prec = precision_score(y_true, y_pred)
    rec = recall_score(y_true, y_pred)
    f1 = f1_score(y_true, y_pred)
    fpr = fp / (fp + tn) if (fp + tn) > 0 else 0
    fnr = fn / (fn + tp) if (fn + tp) > 0 else 0

    results = {
        "model_path": model_path,
        "eval_timestamp": time.strftime("%Y-%m-%d %H:%M:%S"),
        "total_test_urls": len(urls),
        "samples_per_class": len(urls) // 2,
        "metrics": {
            "accuracy": round(float(acc), 4),
            "precision": round(float(prec), 4),
            "recall": round(float(rec), 4),
            "f1_score": round(float(f1), 4),
            "false_positive_rate": round(float(fpr), 4),
            "false_negative_rate": round(float(fnr), 4),
            "avg_latency_ms": round(float(avg_latency_ms), 2)
        },
        "confusion_matrix": {
            "true_negatives": int(tn),
            "false_positives": int(fp),
            "false_negatives": int(fn),
            "true_positives": int(tp)
        }
    }

    # Print Report
    print("\n" + "=" * 65)
    print(f"📊 BENCHMARK RESULTS — {os.path.basename(model_path)}")
    print("=" * 65)
    print(f"🎯 Accuracy            : {acc * 100:.2f}%")
    print(f"⚖️  F1-Score            : {f1:.4f}")
    print(f"🔍 Precision           : {prec:.4f}")
    print(f"📢 Recall (Sensitivity): {rec:.4f}")
    print(f"🚨 False Positive Rate : {fpr * 100:.2f}% (Benign URLs misflagged as phishing)")
    print(f"⚠️  False Negative Rate : {fnr * 100:.2f}% (Phishing URLs missed)")
    print(f"⚡ Avg Latency          : {avg_latency_ms:.2f} ms / URL")
    print("-" * 65)
    print(f"Confusion Matrix:\n  [TN: {tn:,}  FP: {fp:,}]\n  [FN: {fn:,}  TP: {tp:,}]")
    print("=" * 65)

    # Save output JSON report
    report_path = os.path.join(PROJECT_ROOT, output_name)
    with open(report_path, "w", encoding="utf-8") as f:
        json.dump(results, f, indent=2)
    print(f"💾 Report saved to: {report_path}\n")

    return results

if __name__ == "__main__":
    parser = argparse.ArgumentParser(description="AegisOne URL Model Benchmark Tool")
    parser.add_argument("--model", type=str, default=DEFAULT_MODEL_PATH, help="Path to .pt model checkpoint")
    parser.add_argument("--ds1", type=str, default=DATASET_1_PATH, help="Path to URL dataset.csv")
    parser.add_argument("--ds2", type=str, default=DATASET_2_PATH, help="Path to Phishing URLs.csv")
    parser.add_argument("--samples", type=int, default=10000, help="Max samples per class (default 10,000)")
    parser.add_argument("--output", type=str, default="current_url_model_benchmark.json", help="Output JSON report name")

    args = parser.parse_args()

    eval_df = load_and_prep_data(args.ds1, args.ds2, max_samples_per_class=args.samples)
    run_benchmark(args.model, eval_df, output_name=args.output)
