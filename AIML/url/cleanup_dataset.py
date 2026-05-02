import pandas as pd
import os
import shutil

def normalize_url(url):
    """Strips common prefixes for protocol-neutrality."""
    url = str(url).lower().strip()
    url = url.replace("https://", "").replace("http://", "").replace("www.", "")
    return url.rstrip('/')

def main():
    # File Paths
    kaggle_path = 'malicious_phish.csv'
    phishtank_path = 'verified_online.csv'
    extra_path = 'urls.csv'
    output_path = 'final_url_dataset.csv'
    backup_path = 'final_url_dataset_backup.csv'
    # 1. Backup existing final dataset
    if os.path.exists(output_path):
        print(f"📦 Creating backup of existing dataset at {backup_path}...")
        shutil.copy(output_path, backup_path)

    print("\n🚀 Building Protocol-Neutral Dataset...")
    dfs = []

    # 2. Process Kaggle
    if os.path.exists(kaggle_path):
        print("   - Processing Kaggle data...")
        df_k = pd.read_csv(kaggle_path)
        label_map = {'benign': 0, 'phishing': 1, 'malware': 2, 'defacement': 3}
        df_k['label'] = df_k['type'].map(label_map)
        dfs.append(df_k[['url', 'label']])

    # 3. Process Phishtank
    if os.path.exists(phishtank_path):
        print("   - Processing Phishtank data...")
        df_p = pd.read_csv(phishtank_path, usecols=['url'])
        df_p['label'] = 1 # Phishing
        dfs.append(df_p)

    # 4. Process Extra urls.csv
    if os.path.exists(extra_path):
        print("   - Processing extra urls.csv data...")
        df_e = pd.read_csv(extra_path)
        df_e.columns = [c.lower() for c in df_e.columns]
        label_map_e = {'good': 0, 'bad': 1}
        df_e['label'] = df_e['label'].map(label_map_e)
        dfs.append(df_e[['url', 'label']])

    if not dfs:
        print("❌ No source files found!")
        return

    # 5. Merge and Clean
    print("📖 Merging datasets...")
    df = pd.concat(dfs, ignore_index=True).dropna(subset=['label'])
    initial_count = len(df)

    print("🧹 Normalizing URLs (stripping protocols)...")
    df['url'] = df['url'].apply(normalize_url)
    
    print("✨ Removing duplicates...")
    df = df.drop_duplicates(subset=['url'])
    final_count = len(df)

    # 6. Save
    print(f"💾 Saving cleaned dataset to {output_path}...")
    df.to_csv(output_path, index=False)
    
    print("\n" + "="*40)
    print("✅ DATASET CLEANUP COMPLETE")
    print(f"   Initial Rows: {initial_count:,}")
    print(f"   Final Rows:   {final_count:,}")
    print(f"   Removed:      {initial_count - final_count:,} duplicates")
    print("="*40)
    print("🚀 You are now ready to run: python AIML/url/train_phishing_model_url.py")

if __name__ == "__main__":
    main()
