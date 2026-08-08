"""
AegisOne URL Intelligence — Domain-Disjoint Dataset Splitter
============================================================
Enforces Train / Val / Test domain exclusivity (Train ∩ Test = ∅).
"""

import os
from pathlib import Path
from urllib.parse import urlparse
import pandas as pd
import numpy as np

PROJECT_ROOT = Path(__file__).resolve().parents[2]

def get_registered_domain(url: str) -> str:
    try:
        if not url.startswith(("http://", "https://")):
            parsed = urlparse("http://" + url)
        else:
            parsed = urlparse(url)
        netloc = parsed.netloc.split(':')[0].lower()
        if netloc.startswith("www."):
            netloc = netloc[4:]
        # Get base domain (second level domain + TLD)
        parts = netloc.split(".")
        if len(parts) >= 2:
            return ".".join(parts[-2:])
        return netloc
    except Exception:
        return ""

def main():
    model_dir = PROJECT_ROOT / "AIML" / "url"
    urls_path = model_dir / "urls.csv"
    phish_path = model_dir / "verified_online.csv"
    
    if not urls_path.exists():
        print(f"File not found: {urls_path}")
        return

    # Load and clean urls.csv
    df_mixed = pd.read_csv(urls_path)
    url_col = "url" if "url" in df_mixed.columns else ("URL" if "URL" in df_mixed.columns else "url")
    label_col = "label" if "label" in df_mixed.columns else ("Label" if "Label" in df_mixed.columns else "label")
    df_mixed = df_mixed.rename(columns={url_col: "url", label_col: "label"})
    
    df_benign = df_mixed[df_mixed["label"].astype(str).str.lower().isin({"good", "benign", "legitimate", "0"})].copy()
    df_benign["label"] = 0
    
    # Load verified phishing
    df_phish = pd.read_csv(phish_path) if phish_path.exists() else pd.DataFrame(columns=["url", "label"])
    df_phish["label"] = 1
    
    # Combine
    combined = pd.concat([df_benign[["url", "label"]], df_phish[["url", "label"]]]).dropna().drop_duplicates(subset=["url"])
    combined["domain"] = combined["url"].apply(get_registered_domain)
    combined = combined[combined["domain"] != ""]
    
    print(f"📊 Combined dataset contains {len(combined)} unique URLs across {combined['domain'].nunique()} registered domains.")
    
    # Domain-disjoint split
    unique_domains = combined["domain"].unique()
    np.random.seed(42)
    np.random.shuffle(unique_domains)
    
    n_domains = len(unique_domains)
    train_end = int(n_domains * 0.70)
    val_end = int(n_domains * 0.80)
    
    train_domains = set(unique_domains[:train_end])
    val_domains = set(unique_domains[train_end:val_end])
    test_domains = set(unique_domains[val_end:])
    
    train_df = combined[combined["domain"].isin(train_domains)].copy()
    val_df = combined[combined["domain"].isin(val_domains)].copy()
    test_df = combined[combined["domain"].isin(test_domains)].copy()
    
    # Check disjoint condition
    assert len(train_domains.intersection(test_domains)) == 0
    assert len(train_domains.intersection(val_domains)) == 0
    
    print(f"💾 Saving splits:")
    print(f"   - Train Split: {len(train_df)} samples across {len(train_domains)} domains")
    print(f"   - Val Split  : {len(val_df)} samples across {len(val_domains)} domains")
    print(f"   - Test Split : {len(test_df)} samples across {len(test_domains)} domains")
    
    train_df[["url", "label"]].to_csv(model_dir / "train_split.csv", index=False)
    val_df[["url", "label"]].to_csv(model_dir / "val_split.csv", index=False)
    test_df[["url", "label"]].to_csv(model_dir / "test_split.csv", index=False)
    print("🚀 Domain-disjoint datasets saved successfully.")

if __name__ == "__main__":
    main()
