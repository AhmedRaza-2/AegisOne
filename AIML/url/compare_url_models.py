"""
AegisOne URL Model Comparator
==============================
Compares two URL checkpoints on the same real URL samples:
  - AIML/url/best.pt
  - AIML/url/best (3).pt

Uses local real-world URL lists already in the repository:
  - verified_online.csv
  - urls.csv

Outputs a JSON report and prints a side-by-side summary.
"""

from __future__ import annotations

import argparse
import json
import os
import sys
import time
from dataclasses import dataclass
from pathlib import Path

import numpy as np
import pandas as pd
import torch
from sklearn.metrics import accuracy_score, confusion_matrix, f1_score, precision_score, recall_score
from transformers import DistilBertTokenizer

PROJECT_ROOT = Path(__file__).resolve().parents[2]
if str(PROJECT_ROOT) not in sys.path:
    sys.path.insert(0, str(PROJECT_ROOT))

from AIML.url.phishing_model_url import URLDetector, extract_url_numerical_features
from AIML.url.model_paths import DEFAULT_URL_MODEL, ALT_URL_MODEL


@dataclass
class ModelMetrics:
    model_path: str
    samples: int
    accuracy: float
    precision: float
    recall: float
    f1: float
    false_positive_rate: float
    false_negative_rate: float
    avg_latency_ms: float
    confusion: dict[str, int]


def _clean_url(url: str) -> str:
    url = str(url).strip()
    if not url.startswith(("http://", "https://")):
        url = "http://" + url
    return url


def load_real_urls(max_benign: int = 200, max_phishing: int = 200) -> pd.DataFrame:
    benign_path = PROJECT_ROOT / "AIML" / "url" / "urls.csv"
    phish_path = PROJECT_ROOT / "AIML" / "url" / "verified_online.csv"

    rows = []

    if benign_path.exists():
        benign = pd.read_csv(benign_path)
        benign_col = "URL" if "URL" in benign.columns else "url"
        label_col = "Label" if "Label" in benign.columns else "label"
        if label_col in benign.columns:
            benign = benign[benign[label_col].astype(str).str.lower().isin({"good", "benign", "legitimate", "0"})]
        benign_urls = benign[benign_col].dropna().astype(str).tolist()
        rows.extend([(_clean_url(u), 0) for u in benign_urls[:max_benign]])

    if phish_path.exists():
        phish = pd.read_csv(phish_path)
        phish_urls = phish["url"].dropna().astype(str).tolist()
        rows.extend([(_clean_url(u), 1) for u in phish_urls[:max_phishing]])

    # urls.csv also contains real phishing URLs; include those too.
    if benign_path.exists():
        mixed = pd.read_csv(benign_path)
        url_col = "URL" if "URL" in mixed.columns else "url"
        label_col = "Label" if "Label" in mixed.columns else "label"
        if label_col in mixed.columns:
            phish_from_mixed = mixed[mixed[label_col].astype(str).str.lower().isin({"bad", "phishing", "malicious", "1"})]
            rows.extend([(_clean_url(u), 1) for u in phish_from_mixed[url_col].dropna().astype(str).tolist()[:max_phishing]])

    if not rows:
        raise FileNotFoundError("No real URL samples found in AIML/url/urls.csv or AIML/url/verified_online.csv")

    return pd.DataFrame(rows, columns=["url", "label"]).sample(frac=1, random_state=42).reset_index(drop=True)


def load_model(model_path: Path, device: torch.device) -> URLDetector:
    if not model_path.exists():
        raise FileNotFoundError(f"Model checkpoint not found: {model_path}")

    model = URLDetector()
    state = torch.load(str(model_path), map_location=device)
    if isinstance(state, dict) and "model_state_dict" in state:
        state = state["model_state_dict"]
    current = model.state_dict()
    filtered = {}
    skipped = []
    for key, value in state.items():
        if key in current and current[key].shape == value.shape:
            filtered[key] = value
        else:
            skipped.append(key)
    model.load_state_dict(filtered, strict=False)
    if skipped:
        print(f"[WARN] {model_path.name}: skipped {len(skipped)} incompatible keys")
    model.to(device).eval()
    return model


def evaluate_checkpoint(model_path: Path, eval_df: pd.DataFrame, batch_size: int = 64) -> ModelMetrics:
    device = torch.device("cuda" if torch.cuda.is_available() else "cpu")
    tokenizer = DistilBertTokenizer.from_pretrained("distilbert-base-uncased")
    model = load_model(model_path, device)

    urls = eval_df["url"].tolist()
    y_true = eval_df["label"].to_numpy()
    y_pred = []

    start = time.time()
    with torch.no_grad():
        for i in range(0, len(urls), batch_size):
            batch = urls[i:i + batch_size]
            enc = tokenizer(
                batch,
                add_special_tokens=True,
                max_length=128,
                padding="max_length",
                truncation=True,
                return_tensors="pt",
            ).to(device)
            feats = torch.stack([extract_url_numerical_features(u) for u in batch]).to(device)
            logits = model(enc["input_ids"], enc["attention_mask"], feats)
            probs = torch.softmax(logits, dim=1)
            preds = (1.0 - probs[:, 0]).cpu().numpy() >= 0.5
            y_pred.extend(preds.astype(int).tolist())

    elapsed = time.time() - start
    y_pred_arr = np.array(y_pred)
    tn, fp, fn, tp = confusion_matrix(y_true, y_pred_arr).ravel()

    return ModelMetrics(
        model_path=str(model_path),
        samples=len(urls),
        accuracy=float(accuracy_score(y_true, y_pred_arr)),
        precision=float(precision_score(y_true, y_pred_arr, zero_division=0)),
        recall=float(recall_score(y_true, y_pred_arr, zero_division=0)),
        f1=float(f1_score(y_true, y_pred_arr, zero_division=0)),
        false_positive_rate=float(fp / (fp + tn)) if (fp + tn) else 0.0,
        false_negative_rate=float(fn / (fn + tp)) if (fn + tp) else 0.0,
        avg_latency_ms=float((elapsed / len(urls)) * 1000.0),
        confusion={"tn": int(tn), "fp": int(fp), "fn": int(fn), "tp": int(tp)},
    )


def print_comparison(old_metrics: ModelMetrics, new_metrics: ModelMetrics) -> None:
    print("\n" + "=" * 86)
    print("AEGIS-ONE URL MODEL COMPARISON")
    print("=" * 86)
    print(f"{'Metric':<24} {'best.pt':<20} {'best (3).pt':<20} {'Delta':<12}")
    print("-" * 86)

    rows = [
        ("Accuracy", old_metrics.accuracy, new_metrics.accuracy),
        ("Precision", old_metrics.precision, new_metrics.precision),
        ("Recall", old_metrics.recall, new_metrics.recall),
        ("F1", old_metrics.f1, new_metrics.f1),
        ("FPR", old_metrics.false_positive_rate, new_metrics.false_positive_rate),
        ("FNR", old_metrics.false_negative_rate, new_metrics.false_negative_rate),
        ("Latency ms", old_metrics.avg_latency_ms, new_metrics.avg_latency_ms),
    ]

    for name, old_val, new_val in rows:
        delta = new_val - old_val
        print(f"{name:<24} {old_val:<20.4f} {new_val:<20.4f} {delta:<12.4f}")

    better = "best (3).pt" if new_metrics.f1 >= old_metrics.f1 else "best.pt"
    print("-" * 86)
    print(f"Recommended checkpoint: {better}")
    print("=" * 86)


def main() -> None:
    parser = argparse.ArgumentParser(description="Compare AegisOne URL checkpoints on real URLs")
    parser.add_argument("--benign", type=int, default=200, help="Max benign URLs to sample")
    parser.add_argument("--phishing", type=int, default=200, help="Max phishing URLs to sample")
    parser.add_argument("--batch-size", type=int, default=64)
    parser.add_argument("--output", type=str, default="url_model_comparison.json")
    args = parser.parse_args()

    eval_df = load_real_urls(max_benign=args.benign, max_phishing=args.phishing)
    checkpoints = [DEFAULT_URL_MODEL]
    if ALT_URL_MODEL.exists():
        checkpoints.append(ALT_URL_MODEL)

    results = []
    for ckpt in checkpoints:
        print(f"\nEvaluating {ckpt.name} on {len(eval_df)} real URLs...")
        results.append(evaluate_checkpoint(ckpt, eval_df, batch_size=args.batch_size))

    print_comparison(results[0], results[-1])

    report = {
        "evaluated_at": time.strftime("%Y-%m-%d %H:%M:%S"),
        "dataset": {
            "total_samples": len(eval_df),
            "benign": int((eval_df["label"] == 0).sum()),
            "phishing": int((eval_df["label"] == 1).sum()),
            "source_files": [
                str(PROJECT_ROOT / "AIML" / "url" / "urls.csv"),
                str(PROJECT_ROOT / "AIML" / "url" / "verified_online.csv"),
            ],
        },
        "models": [m.__dict__ for m in results],
        "recommended_model": results[-1].model_path if results[-1].f1 >= results[0].f1 else results[0].model_path,
    }

    out_path = PROJECT_ROOT / args.output
    out_path.write_text(json.dumps(report, indent=2), encoding="utf-8")
    print(f"Saved comparison report to: {out_path}")


if __name__ == "__main__":
    main()
