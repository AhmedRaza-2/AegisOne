"""
AegisOne URL Intelligence — Dataset Forensic Audit
===================================================
Analyzes label quality, unique domains, length distributions, and TLD patterns.
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
        return netloc
    except Exception:
        return ""

def audit_file(path: Path):
    print(f"\n📊 Auditing File: {path.name}")
    if not path.exists():
        print("   File does not exist.")
        return
        
    df = pd.read_csv(path)
    print(f"   - Total rows: {len(df)}")
    
    url_col = "url" if "url" in df.columns else ("URL" if "URL" in df.columns else None)
    label_col = "label" if "label" in df.columns else ("Label" if "Label" in df.columns else None)
    
    if not url_col:
        print("   - No URL column found.")
        return
        
    # Standardize column names
    df = df.rename(columns={url_col: "url", label_col: "label"})
    
    # 1. Label distribution
    if "label" in df.columns:
        print("   - Label counts:")
        for k, v in df["label"].value_counts().items():
            print(f"     Class {k}: {v} samples ({v/len(df):.2%})")
            
    # 2. Duplicate rate
    unique_urls = df["url"].nunique()
    print(f"   - Unique URLs: {unique_urls} ({unique_urls/len(df):.2%} uniqueness)")
    
    # 3. Unique registered domains
    domains = df["url"].apply(get_registered_domain)
    unique_domains = domains.nunique()
    print(f"   - Unique Registered Domains: {unique_domains} ({unique_domains/len(df):.2%} uniqueness)")
    
    # 4. Length distributions
    lengths = df["url"].str.len().dropna()
    print(f"   - URL length stats: Mean={lengths.mean():.1f}, Median={lengths.median():.1f}, Max={lengths.max()}")
    
    # 5. TLD distribution
    tlds = domains.apply(lambda d: "." + d.split(".")[-1] if "." in d else "")
    print("   - Top 5 TLDs:")
    for k, v in tlds.value_counts().head(5).items():
        print(f"     TLD {k}: {v} ({v/len(df):.2%})")

def main():
    model_dir = PROJECT_ROOT / "AIML" / "url"
    
    # Audit final_url_dataset.csv
    final_path = model_dir / "final_url_dataset.csv"
    audit_file(final_path)
    
    # Audit urls.csv
    urls_path = model_dir / "urls.csv"
    audit_file(urls_path)

if __name__ == "__main__":
    main()
