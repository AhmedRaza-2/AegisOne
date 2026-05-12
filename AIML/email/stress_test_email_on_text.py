"""
stress_test_email_on_text.py — Testing Email Model on General Text
===================================================================
Goal: Determine if the Email Model (DistilBERT + Bi-LSTM) can generalize 
to short-form SMS, Chat, and Website Pop-ups without a separate model.
"""

import torch
import torch.nn as nn
from transformers import DistilBertTokenizer
import pandas as pd
import numpy as np
import os
from phishing_model_email import PhishingDetector, extract_structured_features

# ═══════════════════════════════════════════════════════════════════════
# 1. GENERATE THE "HARD" 50 SAMPLES
# ═══════════════════════════════════════════════════════════════════════

test_data = [
    # --- PHISHING (SMS / CHAT / WEB) ---
    {"text": "IRS Alert: Your tax refund is ready. Claim here: bit.ly/IRS-Refund2024", "label": 1},
    {"text": "Mom, I lost my phone. This is my new number. Can you send 200 for a taxi? paypal.me/temp-pay", "label": 1},
    {"text": "Urgent: Your Netflix account will be suspended. Update payment now: https://netflix-billing-secure.com", "label": 1},
    {"text": "P@ypal: Unusual activity detected. Secure your account immediately: bit.ly/pay-secure-99", "label": 1},
    {"text": "CONGRATS! You won a $1000 Walmart Gift Card. Click to claim: walmart.gift-win.xyz", "label": 1},
    {"text": "[Amazon] Action Required: Your order #9921 is delayed. Verify info: amzn-security.verify.net", "label": 1},
    {"text": "B-ank of Americ-a: Your card is locked. v.erify at: bit.ly/boa-verif", "label": 1},
    {"text": "WhatsApp Security: Someone tried to login. If not you, click here: secure-wa.com", "label": 1},
    {"text": "Your Apple ID has been used to purchase 'iPhone 15'. Not you? Cancel at: apple-id-safety.com", "label": 1},
    {"text": "Free Crypto! Join our telegram for 0.5 BTC: t.me/free-btc-scam", "label": 1},
    {"text": "Your FedEX package is held at the warehouse. Pay $1.99 redelivery fee: fedex-parcel.info", "label": 1},
    {"text": "Zelle: You received $500 from 'Facebook Meta'. Accept here: zelle-meta-pay.com", "label": 1},
    {"text": "ATTENTION: System infected with 3 viruses. Download cleaner now: security-fix-it.exe", "label": 1},
    {"text": "Your PayPal account is under review. Please upload ID: paypal-id-center.com", "label": 1},
    {"text": "Direct Deposit Alert: Your salary was returned. Update details: payroll-verify.com", "label": 1},
    {"text": "Binary Options Hack: Earn $5000/day. No risk. Sign up: easy-money-scam.net", "label": 1},
    {"text": "Meta Support: Your page will be disabled for copyright. Appeal: business-meta-support.com", "label": 1},
    {"text": "Win 100,000 PKR! Just send your bank details to this number.", "label": 1},
    {"text": "Your cloud storage is full. Buy extra space for $0.99: cloud-up-safe.com", "label": 1},
    {"text": "Discord Nitro for FREE! Just scan this QR code or click: discord-gift.net", "label": 1},
    {"text": "Microsoft Alert: Someone has your password. Change it: ms-security-verify.com", "label": 1},
    {"text": "Your electricity bill is overdue. Power will be cut in 2 hours. Pay: utility-pay-online.com", "label": 1},
    {"text": "Snapchat: Someone added you using your contact list. See who: snap-lookup.xyz", "label": 1},
    {"text": "Your Uber code is 1992. Don't share it. Click if you didn't request: uber-verify.net", "label": 1},
    {"text": "Instagram: New login from Russia. Not you? Secure account: insta-guard.com", "label": 1},

    # --- LEGITIMATE (CHATS / REAL ALERTS) ---
    {"text": "Your Uber verification code is 1928. It will expire in 5 minutes.", "label": 0},
    {"text": "Hey bro, are you coming for cricket at 5 PM? Let me know.", "label": 0},
    {"text": "Bank Alfalah: Your transaction of PKR 500 at 'Foodpanda' was successful.", "label": 0},
    {"text": "Amazon: Your order has been shipped. Track at: https://www.amazon.com/track/123", "label": 0},
    {"text": "Netflix: A new device logged into your account. If it was you, ignore.", "label": 0},
    {"text": "Your OTP for login is 99281. Do not share this with anyone.", "label": 0},
    {"text": "Meeting moved to 3 PM in Conference Room A. See you there.", "label": 0},
    {"text": "Google: Your password was changed. If it wasn't you, check your activity.", "label": 0},
    {"text": "Dinner is ready. Come home early today!", "label": 0},
    {"text": "Your Zameen.com property ad is now live. View it: https://www.zameen.com/ad123", "label": 0},
    {"text": "HBL: Thank you for using your credit card at 'Total Fuel'. Balance: 12,000.", "label": 0},
    {"text": "Reminder: Your appointment with Dr. Ali is tomorrow at 10 AM.", "label": 0},
    {"text": "Hey, can you send me that project PDF? Need to submit it tonight.", "label": 0},
    {"text": "WhatsApp: Your code is 123-456. You can also tap this link to verify.", "label": 0},
    {"text": "Your flight PK-301 is delayed by 20 minutes. We apologize for the inconvenience.", "label": 0},
    {"text": "Standard Chartered: Your e-statement for March 2024 is ready.", "label": 0},
    {"text": "Can you call me when you're free? Need to discuss something important.", "label": 0},
    {"text": "Your Foodpanda order is being prepared by the restaurant.", "label": 0},
    {"text": "LinkedIn: 5 people viewed your profile this week. See who.", "label": 0},
    {"text": "GitHub: A new login was detected for your account. Was this you?", "label": 0},
    {"text": "Happy Birthday! Have a great day ahead.", "label": 0},
    {"text": "Your package has been delivered to your doorstep. Thank you for choosing us.", "label": 0},
    {"text": "Microsoft Teams: You have a new message from 'Project Manager'.", "label": 0},
    {"text": "Telenor: Your balance is low. Please recharge to continue using services.", "label": 0},
    {"text": "Don't forget to bring the keys when you leave.", "label": 0}
]

# ═══════════════════════════════════════════════════════════════════════
# 2. INFERENCE SCRIPT
# ═══════════════════════════════════════════════════════════════════════

def run_stress_test():
    device = torch.device("cuda" if torch.cuda.is_available() else "cpu")
    print(f"🖥️  Using Device: {device}")

    # Load Tokenizer
    tokenizer = DistilBertTokenizer.from_pretrained("distilbert-base-uncased")

    # Load Model
    model = PhishingDetector().to(device)
    model_path = "best_phishing_model.pt"
    
    if not os.path.exists(model_path):
        print(f"❌ Error: {model_path} not found in current directory!")
        return

    checkpoint = torch.load(model_path, map_location=device)
    state_dict = checkpoint.get('model_state_dict', checkpoint)
    model.load_state_dict(state_dict, strict=False)
    model.eval()
    print(f"✅ Email Model Loaded Successfully.")

    results = []
    correct = 0

    print("\n🚀 Running Stress Test on 50 General Text Samples...")
    print("-" * 60)

    for i, sample in enumerate(test_data):
        text = sample["text"]
        true_label = sample["label"]

        # Prepare input (Same as email format but empty subject/sender)
        # Architecture expects: "[SUBJECT]: {subject} [BODY]: {body}"
        full_text = f"[SUBJECT]:  [BODY]: {text}"
        
        encoding = tokenizer(
            full_text,
            max_length=512,
            padding='max_length',
            truncation=True,
            return_tensors='pt'
        ).to(device)

        # Extract features (sender='', subject='', body=text)
        struct_feats = extract_structured_features("", "", text).to(device).unsqueeze(0)

        with torch.no_grad():
            logits = model(encoding['input_ids'], encoding['attention_mask'], struct_feats)
            prob = torch.sigmoid(logits).item()
            pred = 1 if prob > 0.5 else 0

        is_correct = (pred == true_label)
        if is_correct: correct += 1

        status = "✅" if is_correct else "❌"
        type_str = "PHISH" if true_label == 1 else "LEGIT"
        
        print(f"[{i+1:02d}] {status} | True: {type_str} | Prob: {prob:.4f} | Text: {text[:50]}...")

    acc = correct / len(test_data)
    print("-" * 60)
    print(f"🏁 STRESS TEST COMPLETE")
    print(f"🏆 Final Accuracy: {acc:.2%}")
    print("-" * 60)

    if acc > 0.90:
        print("💡 VERDICT: The Email Model is EXCELLENT at General Text. We might not need a separate model!")
    elif acc > 0.75:
        print("💡 VERDICT: Good performance, but a separate Text model will definitely help catch the misses.")
    else:
        print("💡 VERDICT: Poor performance. We MUST build a separate General Text model.")

if __name__ == "__main__":
    run_stress_test()
