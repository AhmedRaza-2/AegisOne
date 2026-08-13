"""
AegisOne URL Intelligence — Meta-Classifier Trainer with Active Hard-Negative Mining
==================================================================================
Trains a calibrated classifier on domain-disjoint splits with active mining loops.
"""

import os
import sys
import pickle
from pathlib import Path
import pandas as pd
import numpy as np
import torch
from transformers import AutoTokenizer
from sklearn.ensemble import RandomForestClassifier
from sklearn.calibration import CalibratedClassifierCV

PROJECT_ROOT = Path(__file__).resolve().parents[2]
if str(PROJECT_ROOT) not in sys.path:
    sys.path.insert(0, str(PROJECT_ROOT))

DEVICE = torch.device("cuda" if torch.cuda.is_available() else "cpu")

from AIML.url.phishing_model_url import load_url_detector, extract_url_numerical_features
from AIML.url.brand_engine import check_brand_impersonation
from AIML.url.lexical_engine import extract_expanded_features
from AIML.url.train_meta_classifier import extract_fused_vector

def load_split(path: Path) -> pd.DataFrame:
    if not path.exists():
        raise FileNotFoundError(f"Split file {path} not found.")
    return pd.read_csv(path)

def main():
    model_dir = PROJECT_ROOT / "AIML" / "url"
    best_v3_path = model_dir / "best_v3.pt"
    
    train_path = model_dir / "train_split.csv"
    val_path = model_dir / "val_split.csv"
    
    if not train_path.exists() or not val_path.exists():
        print("⚠️ Domain splits not found. Running dataset splitter first...")
        from dataset_splitter import main as run_splitter
        run_splitter()
        
    df_train = load_split(train_path)
    df_val = load_split(val_path)
    
    print("📥 Loading BERT-Mini base detector...")
    model, model_name = load_url_detector(str(best_v3_path), DEVICE)
    tokenizer = AutoTokenizer.from_pretrained(model_name)
    
    # Scale up training pool to 5,000 samples (2,500 benign, 2,500 phishing)
    df_train_benign = df_train[df_train["label"] == 0].sample(n=min(2500, len(df_train[df_train["label"] == 0])), random_state=42)
    df_train_phish = df_train[df_train["label"] == 1].sample(n=min(2500, len(df_train[df_train["label"] == 1])), random_state=42)
    df_train_sampled = pd.concat([df_train_benign, df_train_phish])
    
    # Scale up validation mining pool to 2,000 samples
    df_val_sampled = df_val.sample(n=min(2000, len(df_val)), random_state=42)
    
    print(f"🚀 Training pool size: {len(df_train_sampled)}, Val pool size: {len(df_val_sampled)}")
    
    def get_features(df):
        X, y = [], []
        for idx, row in df.iterrows():
            url = row["url"]
            label = row["label"]
            try:
                X.append(extract_fused_vector(url, model, tokenizer))
                y.append(label)
            except Exception:
                continue
        return np.array(X), np.array(y)
        
    print("⚡ Extracting training features...")
    X_train, y_train = get_features(df_train_sampled)
    
    print("⚡ Extracting validation features...")
    X_val, y_val = get_features(df_val_sampled)
    
    # --- Active Mining Loop ---
    print("\n🔄 Round 1: Training initial classifier...")
    clf = RandomForestClassifier(n_estimators=100, max_depth=6, random_state=42)
    clf.fit(X_train, y_train)
    
    # Find False Positives on validation set to mine hard negatives
    preds_val = clf.predict(X_val)
    false_positives_idx = np.where((y_val == 0) & (preds_val == 1))[0]
    
    print(f"🔥 Mined {len(false_positives_idx)} hard negatives from validation split.")
    
    if len(false_positives_idx) > 0:
        # Append mined hard negatives to training pool
        mined_negatives = X_val[false_positives_idx]
        mined_labels = np.zeros(len(false_positives_idx))
        
        X_train = np.concatenate([X_train, mined_negatives])
        y_train = np.concatenate([y_train, mined_labels])
        
        print(f"🔄 Round 2: Retraining with mined hard negatives (Train size: {X_train.shape[0]})...")
        clf = RandomForestClassifier(n_estimators=100, max_depth=6, random_state=42)
        clf.fit(X_train, y_train)
        
    print("⚖️ Performing Sigmoid calibration...")
    calibrated_clf = CalibratedClassifierCV(estimator=clf, method='sigmoid', cv=3)
    calibrated_clf.fit(X_train, y_train)
    
    val_score = calibrated_clf.score(X_val, y_val)
    print(f"✅ Final Calibrated Model Score on Val Split: {val_score:.2%}")
    
    out_path = model_dir / "meta_classifier.pkl"
    with open(out_path, "wb") as f:
        pickle.dump(calibrated_clf, f)
    print(f"📝 Saved final mined meta-classifier to {out_path}")

if __name__ == "__main__":
    main()
