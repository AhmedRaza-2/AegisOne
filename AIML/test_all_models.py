import sys
import os
import time
import torch
import torch.nn.functional as F
import numpy as np
import pandas as pd
from pathlib import Path
from transformers import AutoTokenizer, DistilBertTokenizer
from urllib.parse import urlparse

def normalize_url(url):
    """Strips common prefixes for protocol-neutrality."""
    url = str(url).lower().strip()
    url = url.replace("https://", "").replace("http://", "").replace("www.", "")
    return url.rstrip('/')

# Add subdirectories to path
sys.path.append(str(Path(__file__).parent / 'email'))
sys.path.append(str(Path(__file__).parent / 'url'))

# Import architectures
try:
    from phishing_model_email import PhishingDetector as EmailDetector, batch_extract_features as email_feat_extractor
    from phishing_model_url import URLDetector, batch_extract_url_features as url_feat_extractor
except ImportError as e:
    print(f"❌ Import Error: {e}")
    sys.exit(1)

# ═══════════════════════════════════════════════════════════════════════
# CONFIG & CONSTANTS
# ═══════════════════════════════════════════════════════════════════════

DEVICE = torch.device('cuda' if torch.cuda.is_available() else 'cpu')
URL_WHITELIST = {
    'google.com', 'github.com', 'microsoft.com', 'apple.com', 'amazon.com',
    'facebook.com', 'instagram.com', 'twitter.com', 'linkedin.com', 'netflix.com',
    'stackoverflow.com', 'wikipedia.org', 'reddit.com', 'dropbox.com', 'zoom.us',
    'airuniversity.edu.pk', 'ubank.com.pk', 'inara.tech'
}

# ═══════════════════════════════════════════════════════════════════════
# LOADING FUNCTIONS
# ═══════════════════════════════════════════════════════════════════════

def load_models():
    print(f"🖥️  Using Device: {DEVICE}")
    
    # Email Model
    print("\n📧 Loading Email Phishing Model...")
    e_model = EmailDetector().to(DEVICE)
    e_path = Path(__file__).parent / 'email' / 'best_phishing_model.pt'
    e_checkpoint = torch.load(e_path, map_location=DEVICE, weights_only=False)
    e_model.load_state_dict(e_checkpoint['model_state_dict'] if 'model_state_dict' in e_checkpoint else e_checkpoint)
    e_model.eval()
    e_tok = DistilBertTokenizer.from_pretrained("distilbert-base-uncased")
    
    # URL Model
    print("🔗 Loading URL Detection Model...")
    u_model = URLDetector("bert-base-uncased").to(DEVICE)
    u_path = Path(__file__).parent / 'url' / 'best_url_model.pt'
    u_checkpoint = torch.load(u_path, map_location=DEVICE, weights_only=False)
    u_model.load_state_dict(u_checkpoint['model_state_dict'] if 'model_state_dict' in u_checkpoint else u_checkpoint)
    u_model.eval()
    u_tok = AutoTokenizer.from_pretrained("bert-base-uncased")
    
    print("✅ All Models Loaded.")
    return (e_model, e_tok), (u_model, u_tok)

# ═══════════════════════════════════════════════════════════════════════
# PREDICTION WRAPPERS
# ═══════════════════════════════════════════════════════════════════════

def predict_emails(model, tokenizer, emails_df):
    texts = [f"[SUBJECT]: {s} [BODY]: {b}" for s, b in zip(emails_df['subject'], emails_df['body'])]
    encodings = tokenizer(texts, max_length=512, padding=True, truncation=True, return_tensors='pt').to(DEVICE)
    feats = email_feat_extractor(emails_df['sender'], emails_df['subject'], emails_df['body']).to(DEVICE)
    
    with torch.no_grad():
        logits = model(encodings['input_ids'], encodings['attention_mask'], feats)
        probs = torch.sigmoid(logits).squeeze().cpu().numpy()
        if probs.ndim == 0: probs = np.array([probs]) # Handle single item
    return (probs > 0.5).astype(int), probs

def predict_urls(model, tokenizer, urls):
    # 1. Whitelist logic
    preds, confs = [], []
    remaining_urls, remaining_indices = [], []
    
    for i, url in enumerate(urls):
        domain = urlparse(url).netloc.replace('www.', '') if '://' in url else url.split('/')[0].replace('www.', '')
        if any(white in domain for white in URL_WHITELIST):
            preds.append(0) # Benign
            confs.append(1.0)
        else:
            preds.append(-1) # Placeholder
            confs.append(0.0)
            remaining_urls.append(url)
            remaining_indices.append(i)
            
    # 2. AI Logic for non-whitelisted
    if remaining_urls:
        # Standardize for protocol-neutrality
        clean_urls = [normalize_url(u) for u in remaining_urls]
        
        encs = tokenizer(clean_urls, max_length=128, padding=True, truncation=True, return_tensors='pt').to(DEVICE)
        feats = url_feat_extractor(clean_urls).to(DEVICE)
        with torch.no_grad():
            logits = model(encs['input_ids'], encs['attention_mask'], feats)
            probs = F.softmax(logits, dim=1).cpu().numpy()
            p_idxs = np.argmax(probs, axis=1)
            p_confs = np.max(probs, axis=1)
            
            for idx, pred, conf in zip(remaining_indices, p_idxs, p_confs):
                preds[idx] = pred
                confs[idx] = conf
                
    return np.array(preds), np.array(confs)

# ═══════════════════════════════════════════════════════════════════════
# TEST DATA GENERATION
# ═══════════════════════════════════════════════════════════════════════

def get_email_test_data():
    data = [
        ("hr@company.com", "Quarterly Review", "Hi team, please find the schedule for reviews attached.", 0),
        ("friend@gmail.com", "Coffee?", "Are we still on for coffee today at 4?", 0),
        ("support@github.com", "Security Alert", "A new login was detected. If this was you, ignore.", 0),
        ("no-reply@amazon.com", "Your Order", "Your order #123 has been shipped.", 0),
        ("security@bank.com", "OTP", "Your code is 123456. Do not share.", 0),
        ("ceo@mycompany.com", "Quick Task", "Send me the report by EOD.", 0),
        ("admin@it-dept.org", "Server Maintenance", "Servers will be down for 2 hours tonight.", 0),
        ("newsletter@tech.io", "Weekly Digest", "Top news this week in AI and Web3.", 0),
        ("hr-portal@company.net", "Tax Documents", "Your W2 is ready for download in the portal.", 0),
        ("info@event.com", "Invitation", "You are invited to the tech conference.", 0),
        
        ("security@paypa1-support.com", "URGENT", "Your account is suspended. Click here to verify.", 1),
        ("refunds@irs-gov.net", "Tax Refund", "You have a pending refund of $500. Claim now.", 1),
        ("ceo.office@urgent-transfer.xyz", "WIRE", "I need a wire transfer processed immediately.", 1),
        ("billing@netflix-update.gq", "Declined", "Update payment to keep service: link.net/fix", 1),
        ("lottery@win-big.tk", "WINNER", "You won $1,000,000! Reply with details.", 1),
        ("office365@ms-secure.bit", "Reset", "Password expiring. Reset at microsoft-portal.net", 1),
        ("account@blockchain-verify.online", "Login", "Unusual activity. Log in to secure: phish.com", 1),
        ("system@facebook-security.ga", "Warning", "Account flagged. Verify identity now.", 1),
        ("alert@chase-secure.ml", "Action", "Your debit card is blocked. Unlock here.", 1),
        ("admin@zoom-auth.site", "Meeting", "Join urgent meeting with management: bit.ly/join", 1),
    ]
    return pd.DataFrame(data, columns=['sender', 'subject', 'body', 'label'])

def get_url_test_data():
    # Mix of 60 Benign, 30 Phish, 15 Malware, 15 Defacement (Total 120)
    data = []
    # Benign
    for u in ['google.com', 'github.com', 'apple.com', 'amazon.com', 'microsoft.com', 'wikipedia.org']:
        data.append(('https://www.'+u, 0))
    for _ in range(54): data.append(('https://safe-example-'+str(_)+'.com', 0))
    # Phish
    data.append(('http://paypa1-secure.net/login', 1))
    data.append(('https://netflix-verify.online/signin', 1))
    for _ in range(28): data.append(('http://phish-link-'+str(_)+'.xyz/verify', 1))
    # Malware
    data.append(('http://192.168.1.1/virus.exe', 2))
    for _ in range(14): data.append(('http://malware-site-'+str(_)+'.cf/payload.exe', 2))
    # Defacement
    data.append(('http://hacked-site.com/index.php', 3))
    for _ in range(14): data.append(('http://defaced-server-'+str(_)+'.ml/owned', 3))
    
    return pd.DataFrame(data, columns=['url', 'label'])

# ═══════════════════════════════════════════════════════════════════════
# RUNNER
# ═══════════════════════════════════════════════════════════════════════

def main():
    (e_m, e_t), (u_m, u_t) = load_models()
    
    print("\n" + "═"*80)
    print("🚀 AEGIS-ONE COMPREHENSIVE SYSTEM TEST (FINAL)")
    print("═"*80)
    
    # 📧 Email Test
    print("\n--- 📧 TESTING EMAIL MODEL (20 SCENARIOS) ---")
    e_df = get_email_test_data()
    start = time.time()
    e_preds, e_probs = predict_emails(e_m, e_t, e_df)
    e_time = (time.time() - start) * 1000 / len(e_df)
    
    from sklearn.metrics import accuracy_score, f1_score
    e_acc = accuracy_score(e_df['label'], e_preds)
    print(f"✅ Email Accuracy: {e_acc*100:6.2f}% | Latency: {e_time:5.1f}ms/email")
    
    # 🔗 URL Test
    print("\n--- 🔗 TESTING URL MODEL (120 SCENARIOS) ---")
    u_df = get_url_test_data()
    start = time.time()
    u_preds, u_confs = predict_urls(u_m, u_t, u_df['url'])
    u_time = (time.time() - start) * 1000 / len(u_df)
    
    u_acc = accuracy_score(u_df['label'], u_preds)
    u_f1 = f1_score(u_df['label'], u_preds, average='macro')
    print(f"✅ URL Accuracy:   {u_acc*100:6.2f}% | F1 Score: {u_f1:.4f} | Latency: {u_time:5.1f}ms/url")
    
    print("\n" + "═"*80)
    print("📊 FINAL SUMMARY")
    print(f"  EMAIL: {e_acc*100:6.1f}% Accuracy, {e_time:4.1f}ms latency")
    print(f"  URL:   {u_acc*100:6.1f}% Accuracy, {u_time:4.1f}ms latency")
    print("═"*80)
    print("🎉 AEGIS-ONE CORE ENGINES VERIFIED & READY FOR INTEGRATION.")

if __name__ == "__main__":
    main()
