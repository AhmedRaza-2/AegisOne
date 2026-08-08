"""
AegisOne URL Intelligence — Hard Negatives & Positives Curation
================================================================
Generates high-difficulty evaluation slices to test robust generalization.
"""

import os
from pathlib import Path
import pandas as pd
import numpy as np

PROJECT_ROOT = Path(__file__).resolve().parents[2]

def main():
    model_dir = PROJECT_ROOT / "AIML" / "url"
    urls_path = model_dir / "urls.csv"
    phish_path = model_dir / "verified_online.csv"
    
    if not urls_path.exists():
        print(f"File not found: {urls_path}")
        return

    df_mixed = pd.read_csv(urls_path)
    url_col = "url" if "url" in df_mixed.columns else ("URL" if "URL" in df_mixed.columns else "url")
    label_col = "label" if "label" in df_mixed.columns else ("Label" if "Label" in df_mixed.columns else "label")
    df_mixed = df_mixed.rename(columns={url_col: "url", label_col: "label"})

    # Filter legitimate samples
    df_benign = df_mixed[df_mixed["label"].astype(str).str.lower().isin({"good", "benign", "legitimate", "0"})].copy()
    
    # 1. Curate Hard Negatives (legitimate, but contain hyphens, subdomains, deep paths, or keywords)
    suspicious_keywords = ["login", "signin", "verify", "verification", "secure", "account", "update", "billing", "confirm", "portal"]
    
    def is_hard_negative(url: str) -> bool:
        url_lower = str(url).lower()
        has_hyphen = url_lower.count("-") >= 2
        has_subdomain = url_lower.count(".") >= 3
        has_deep_path = url_lower.count("/") >= 4
        has_keyword = any(kw in url_lower for kw in suspicious_keywords)
        return has_hyphen or has_subdomain or has_deep_path or has_keyword

    df_benign["is_hard"] = df_benign["url"].apply(is_hard_negative)
    hard_negatives = df_benign[df_benign["is_hard"] == True]["url"].dropna().tolist()
    print(f"📊 Identified {len(hard_negatives)} hard negatives in urls.csv")

    # 2. Curate Hard Positives (phishing, but have clean short structure, standard TLDs, no suspicious keywords)
    hard_positives = []
    if phish_path.exists():
        df_phish = pd.read_csv(phish_path)
        phish_urls = df_phish["url"].dropna().astype(str).tolist()
        
        def is_hard_positive(url: str) -> bool:
            url_lower = str(url).lower()
            is_short = len(url_lower) < 45
            standard_tld = any(url_lower.endswith(tld) or (tld + "/") in url_lower for tld in [".com", ".net", ".org"])
            no_keywords = not any(kw in url_lower for kw in suspicious_keywords)
            return is_short and standard_tld and no_keywords
            
        hard_positives = [u for u in phish_urls if is_hard_positive(u)]
        print(f"📊 Identified {len(hard_positives)} hard positives in verified_online.csv")

    # Create hard evaluation dataset (up to 2500 of each for a balanced 5000 sample hard test)
    n_samples = min(2500, len(hard_negatives), len(hard_positives))
    
    rows = []
    for u in hard_negatives[:n_samples]:
        rows.append((u, 0)) # 0 = benign
    for u in hard_positives[:n_samples]:
        rows.append((u, 1)) # 1 = malicious

    out_df = pd.DataFrame(rows, columns=["url", "label"])
    out_path = model_dir / "hard_evaluation_dataset.csv"
    out_df.to_csv(out_path, index=False)
    print(f"📝 Hard evaluation dataset saved successfully to {out_path} ({len(out_df)} balanced samples).")

if __name__ == "__main__":
    main()
