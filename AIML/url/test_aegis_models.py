"""
test_aegis_url_model.py — Comprehensive URL Model Test Script (100+ URLs)
======================================================================
Tests URLDetector with 120 diverse URLs: legit, phishing, malware, defacement.
Expected: High accuracy on phish/malware; 100% on legit.
Run: python test_aegis_url_model.py
Requires: best_url_model.pt, phishing_model_url.py
"""

import sys
import time
import torch
import torch.nn.functional as F
import numpy as np
import pandas as pd
from datetime import datetime
from pathlib import Path

# Add current dir to path for local imports
sys.path.append('.')

from phishing_model_url import URLDetector, extract_url_numerical_features, batch_extract_url_features
from transformers import AutoTokenizer

# Config
CONFIG = {
    'bert_model': 'bert-base-uncased',
    'model_path': 'best_url_model.pt',
    'max_len': 128,
    'device': 'cuda' if torch.cuda.is_available() else 'cpu',
    'batch_size': 8
}

def normalize_url(url):
    """Strips common prefixes for protocol-neutrality."""
    url = str(url).lower().strip()
    url = url.replace("https://", "").replace("http://", "").replace("www.", "")
    return url.rstrip('/')

LABEL_MAP = {0: 'Benign', 1: 'Phishing', 2: 'Malware', 3: 'Defacement'}

def load_model():
    """Load trained URLDetector."""
    print(f"🖥️  Using Device: {CONFIG['device']}")
    
    tokenizer = AutoTokenizer.from_pretrained(CONFIG['bert_model'])
    model = URLDetector(CONFIG['bert_model']).to(CONFIG['device'])
    
    if not Path(CONFIG['model_path']).exists():
        raise FileNotFoundError(f"❌ Model not found: {CONFIG['model_path']}. Run train_phishing_model_url.py first!")
    
    model.load_state_dict(torch.load(CONFIG['model_path'], map_location=CONFIG['device']))
    model.eval()
    print("✅ URL Model Ready.")
    return model, tokenizer

def create_test_dataset():
    """120 diverse URLs with ground truth labels."""
    test_data = [
        # 30 Legit Benign (0)
        ('https://www.google.com', 0),
        ('https://github.com', 0),
        ('https://stackoverflow.com', 0),
        ('https://www.microsoft.com', 0),
        ('https://www.amazon.com', 0),
        ('https://www.netflix.com', 0),
        ('https://twitter.com', 0),
        ('https://facebook.com', 0),
        ('https://www.apple.com', 0),
        ('https://www.paypal.com', 0),
        ('https://www.youtube.com', 0),
        ('https://www.wikipedia.org', 0),
        ('https://www.reddit.com', 0),
        ('https://www.linkedin.com', 0),
        ('https://outlook.live.com', 0),
        ('https://www.dropbox.com', 0),
        ('https://www.zoom.us', 0),
        ('https://mail.google.com', 0),
        ('https://calendar.google.com', 0),
        ('https://drive.google.com', 0),
        ('https://www.bankofamerica.com', 0),
        ('https://www.wellsfargo.com', 0),
        ('https://www.chase.com', 0),
        ('https://www.nytimes.com', 0),
        ('https://www.bbc.com', 0),
        ('https://www.cnn.com', 0),
        ('https://www.github.com/AhmedRaza-2/AegisOne', 0),
        ('https://www.airuniversity.edu.pk', 0),
        ('https://www.ubank.com.pk', 0),
        ('https://inara.tech', 0),
        
        # 30 Phishing (1)
        ('http://paypa1-secure-verification.net/login', 1),
        ('https://netflix-account-update.com/signin', 1),
        ('http://secure-appleid-verify.com/recover', 1),
        ('https://amazon-login-security.com/verify', 1),
        ('http://microsoft365-fix-support.net/reset', 1),
        ('https://google-account-security.gq/update', 1),
        ('http://bankofamerica-alert.com/securelogin', 1),
        ('https://dropbox-security-update.net/verify', 1),
        ('http://chase-bank-login.ml/confirm', 1),
        ('https://outlook-mail-support.com/resetpw', 1),
        ('http://facebook-security-check.ga/login', 1),
        ('https://twitter-verify-account.top/secure', 1),
        ('http://linkedin-profile-update.site/confirm', 1),
        ('https://zoom-meeting-join.xyz/auth', 1),
        ('http://wellsfargo-online.cf/secure', 1),
        ('https://paypal-secure-payment.online/verify', 1),
        ('http://youtube-account-recovery.bit/login', 1),
        ('https://reddit-security-alert.com/reset', 1),
        ('http://wikipedia-donate.tk/support', 1),
        ('https://nytimes-subscribe.gq/renew', 1),
        ('http://bbc-news-update.ml/login', 1),
        ('https://cnn-account-verify.cf/secure', 1),
        ('http://airuniversity-student-portal.ga/login', 1),
        ('https://ubank-customer-support.top/verify', 1),
        ('http://inara-tech-login.site/secure', 1),
        ('https://github-security-update.xyz/auth', 1),
        ('http://stackoverflow-ask.bit/reset', 1),
        ('https://phish-example.com/login-phish', 1),
        ('http://fakebank-login.net/verify', 1),
        ('https://spoofed-site.org/account', 1),
        
        # 30 Malware (2)
        ('http://192.168.1.1/malware.exe', 2),
        ('http://malware-download.net/virus.apk', 2),
        ('https://trojan-host.com/backdoor.dll', 2),
        ('http://ransomware-site.ml/payload.exe', 2),
        ('https://keylogger-update.ga/installer', 2),
        ('http://spyware-drop.cf/malware.zip', 2),
        ('https://exploit-kit.top/pwnkit.js', 2),
        ('http://botnet-cnc.site/cmd.exe', 2),
        ('https://rootkit-download.online/root.sys', 2),
        ('http://worm-propagate.bit/infect.bat', 2),
        ('https://adware-installer.xyz/app.exe', 2),
        ('http://cryptominer.gq/miner.js', 2),
        ('https://ransom-note.cf/README.txt', 2),
        ('http://dropper-service.tk/drop.exe', 2),
        ('https://payload-host.ml/stage2.bin', 2),
        ('http://malicious-redirect.ga/evil', 2),
        ('https://infect-vector.top/download', 2),
        ('http://c2-server.site/beacon', 2),
        ('https://trojan-loader.online/stub.dll', 2),
        ('http://virus-host.bit/virus.scr', 2),
        ('https://backdoor-install.xyz/gate.exe', 2),
        ('http://keygen-fake.gq/cracker.exe', 2),
        ('https://fake-update.cf/patch.exe', 2),
        ('http://malware-archive.tk/samples.zip', 2),
        ('https://exploit-poc.ml/exploit.html', 2),
        ('http://phishkit.site/kit.zip', 2),
        ('https://ransomware-builder.top/builder.exe', 2),
        ('http://test-malware.net/sample.exe', 2),
        ('https://demo-virus.ga/virus.bat', 2),
        ('http://example-malware.cf/mal.exe', 2),
        
        # 30 Defacement (3)
        ('http://hacked-site.com/index.php', 3),
        ('https://defaced-domain.net/hacked.html', 3),
        ('http://compromised-server.ml/owned', 3),
        ('https://website-hacked.ga/pwned.php', 3),
        ('http://deface-victim.cf/index.html', 3),
        ('https://haxored-site.top/404.php', 3),
        ('http://pwned-domain.site/deface.html', 3),
        ('https://server-compromised.online/hacked', 3),
        ('http://website-defaced.bit/index.htm', 3),
        ('https://domain-hijacked.gq/owned.html', 3),
        ('http://site-defacement.tk/hax.html', 3),
        ('https://hacked-website.ml/pwn.html', 3),
        ('http://defaced-host.cf/deface.php', 3),
        ('https://victim-server.top/hacked.html', 3),
        ('http://compromised-site.site/owned.php', 3),
        ('https://defacement-example.online/index', 3),
        ('http://hacked-domain.bit/deface.html', 3),
        ('https://pwned-website.gq/hax.html', 3),
        ('http://server-defaced.tk/404.html', 3),
        ('https://domain-owned.ml/pwned.php', 3),
        ('http://website-hijacked.cf/hacked.html', 3),
        ('https://site-compromised.top/owned', 3),
        ('http://deface-host.site/deface.html', 3),
        ('https://hacked-server.online/pwn.html', 3),
        ('http://victim-domain.bit/index.php', 3),
        ('https://defaced-site.gq/hacked.html', 3),
        ('http://pwned-host.tk/owned.html', 3),
        ('https://server-hijacked.ml/deface.php', 3),
        ('http://website-owned.cf/hax.html', 3),
        ('https://domain-defaced.top/pwned.html', 3),
    ]
    df = pd.DataFrame(test_data, columns=['url', 'true_label'])
    return df

def predict_batch(model, tokenizer, urls, device):
    """Batch prediction."""
    # Standardize URLs for protocol-neutrality
    clean_urls = [normalize_url(u) for u in urls]
    
    encodings = tokenizer(clean_urls, max_length=CONFIG['max_len'], padding=True, truncation=True, return_tensors='pt')
    input_ids = encodings['input_ids'].to(device)
    attention_mask = encodings['attention_mask'].to(device)
    num_feats = batch_extract_url_features(clean_urls).to(device)
    
    with torch.no_grad():
        logits = model(input_ids, attention_mask, num_feats)
        probs = F.softmax(logits, dim=1)
        preds = torch.argmax(logits, dim=1).cpu().numpy()
        confidences = probs.max(dim=1)[0].cpu().numpy() * 100
    return preds, confidences

def run_tests(model, tokenizer):
    """Run comprehensive tests."""
    df = create_test_dataset()
    print("\n" + "="*80)
    print("🚀 AEGIS-ONE URL MODEL COMPREHENSIVE TEST (120 URLs)")
    print("="*80)
    
    all_preds, all_true, all_conf, all_times = [], [], [], []
    
    # Batch predict
    for i in range(0, len(df), CONFIG['batch_size']):
        batch_df = df.iloc[i:i+CONFIG['batch_size']]
        start_time = time.time()
        preds, confs = predict_batch(model, tokenizer, batch_df['url'], CONFIG['device'])
        batch_time = (time.time() - start_time) * 1000 / len(batch_df)
        
        all_preds.extend(preds)
        all_true.extend(batch_df['true_label'].tolist())
        all_conf.extend(confs)
        all_times.append(batch_time)
        
        # Print batch results
        for j, (url, pred, conf, true) in enumerate(zip(batch_df['url'], preds, confs, batch_df['true_label'])):
            status = '✅' if pred == true else '❌'
            label_pred = LABEL_MAP[pred]
            label_true = LABEL_MAP[true]
            print(f"{status:6} [{label_pred:10}] | {url[:60]:<60} | Conf: {conf:6.2f}% | True: {label_true}")
    
    # Metrics
    from sklearn.metrics import accuracy_score, f1_score, classification_report, confusion_matrix
    acc = accuracy_score(all_true, all_preds)
    f1 = f1_score(all_true, all_preds, average='macro')
    avg_speed = np.mean(all_times)
    print("\n" + "="*80)
    print(f"📊 FINAL METRICS")
    print(f"✅ Accuracy: {acc*100:.2f}% | F1: {f1:.4f} | Avg Speed: {avg_speed:.1f}ms")
    print("\nConfusion Matrix:")
    print(pd.DataFrame(confusion_matrix(all_true, all_preds, labels=[0,1,2,3]), 
                      index=['True\\Pred ' + l for l in LABEL_MAP.values()],
                      columns=['Pred ' + l for l in LABEL_MAP.values()]))
    print("\nDetailed Report:\n", classification_report(all_true, all_preds, target_names=list(LABEL_MAP.values())))
    print("="*80)

if __name__ == "__main__":
    model, tokenizer = load_model()
    run_tests(model, tokenizer)
    print("\n🎉 TESTING COMPLETE!")