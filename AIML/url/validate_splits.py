"""
AegisOne URL Intelligence — Dataset Split Validator
===================================================
Verifies domain exclusivity and check for exact/near URL duplicates between splits.
"""

from pathlib import Path
from urllib.parse import urlparse
import pandas as pd

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
        parts = netloc.split(".")
        if len(parts) >= 2:
            return ".".join(parts[-2:])
        return netloc
    except Exception:
        return ""

def clean_url_comparison(url: str) -> str:
    url = str(url).lower().strip()
    url = url.replace("https://", "").replace("http://", "").replace("www.", "")
    return url.rstrip('/')

def main():
    model_dir = PROJECT_ROOT / "AIML" / "url"
    train_path = model_dir / "train_split.csv"
    val_path = model_dir / "val_split.csv"
    test_path = model_dir / "test_split.csv"
    
    if not train_path.exists() or not val_path.exists() or not test_path.exists():
        print("⚠️ Splits files not found. Please run dataset_splitter.py first.")
        return
        
    print("📥 Loading dataset splits...")
    df_train = pd.read_csv(train_path)
    df_val = pd.read_csv(val_path)
    df_test = pd.read_csv(test_path)
    
    print("\n🔍 Phase 5.1: Extracting Domains and URLs...")
    train_urls = set(df_train["url"].apply(clean_url_comparison))
    val_urls = set(df_val["url"].apply(clean_url_comparison))
    test_urls = set(df_test["url"].apply(clean_url_comparison))
    
    train_domains = set(df_train["url"].apply(get_registered_domain))
    val_domains = set(df_val["url"].apply(get_registered_domain))
    test_domains = set(df_test["url"].apply(get_registered_domain))
    
    # 1. Domain Exclusivity
    train_val_dom = train_domains.intersection(val_domains)
    train_test_dom = train_domains.intersection(test_domains)
    val_test_dom = val_domains.intersection(test_domains)
    
    print(f"📊 Domain Exclusivity Audit:")
    print(f"   - Train domains: {len(train_domains)}, Val domains: {len(val_domains)}, Test domains: {len(test_domains)}")
    print(f"   - Overlap (Train ∩ Val) : {len(train_val_dom)} domains")
    print(f"   - Overlap (Train ∩ Test): {len(train_test_dom)} domains")
    print(f"   - Overlap (Val ∩ Test)  : {len(val_test_dom)} domains")
    
    if len(train_val_dom) > 0 or len(train_test_dom) > 0 or len(val_test_dom) > 0:
        print("❌ FAIL: Domain overlap detected!")
    else:
        print("✅ PASS: Perfect domain exclusivity verified.")
        
    # 2. URL Leakage Audit
    train_val_url = train_urls.intersection(val_urls)
    train_test_url = train_urls.intersection(test_urls)
    val_test_url = val_urls.intersection(test_urls)
    
    print(f"\n📊 URL Leakage Audit (normalized comparisons):")
    print(f"   - Overlap (Train ∩ Val) : {len(train_val_url)} URLs")
    print(f"   - Overlap (Train ∩ Test): {len(train_test_url)} URLs")
    print(f"   - Overlap (Val ∩ Test)  : {len(val_test_url)} URLs")
    
    if len(train_val_url) > 0 or len(train_test_url) > 0 or len(val_test_url) > 0:
        print("❌ FAIL: URL leakage detected!")
    else:
        print("✅ PASS: Zero URL leaks verified.")

if __name__ == "__main__":
    main()
