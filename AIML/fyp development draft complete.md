x  
---

## **🔗 MODEL 2 — URL Detection**

### **Architecture**

Input: Raw URL string  
"http://paypa1-secure.verify.com/login"  
           ↓  
  ┌────────────────────────────────┐  
  │  BERT Embeddings               │  
  │  (DomURLs\_BERT pretrained)     │  
  │  domain-specific pretraining   │  
  └──────────────┬─────────────────┘  
                 ↓  
         BiLSTM \+ GRU  
         (paper proven:  
          97.5% @ 0.119ms)  
                 ↓  
  ┌────────────────────────────────┐  
  │  Handcrafted Features          │  
  │  (parallel branch)             │  
  │  url\_length, has\_ip,           │  
  │  typosquatting\_score,          │  
  │  subdomain\_depth,              │  
  │  tld\_suspicious,               │  
  │  brand\_in\_domain,              │  
  │  https\_used,                   │  
  │  special\_char\_ratio,           │  
  │  shortener\_used,               │  
  │  redirect\_count                │  
  └──────────────┬─────────────────┘  
                 ↓  
         Concatenate both  
                 ↓  
    Dense → Dropout → Output  
    4 classes:  
    Phishing / Malware /  
    Defacement / Benign

### **Dataset**

Kaggle Malicious URLs (primary):  
kaggle.com/datasets/sid321axn/malicious-urls-dataset  
651,191 URLs — 4 classes ✅

PhishTank (extra phishing):  
data.phishtank.com/data/online-valid.csv  
1M+ verified phishing URLs ✅

Tranco Legit URLs:  
tranco-list.eu  
Top 1M legitimate domains ✅

Target: 500K balanced dataset

### **References**

1\. Kibriya et al. (2025) Nature Scientific Reports  
   BERT \+ LSTM \+ GRU → 97.5%, 0.119ms  
   doi: 10.1038/s41598-025-26653-2

2\. El Mahdaouy et al. (2026) DomURLs\_BERT  
   Domain-specific pretrained BERT → 99.11%  
   doi: 10.1007/s10922-025-10010-9

Combined expected: 98.5%+  
Training: 2-3 hrs Colab (CPU even\!)  
Inference: \<1ms  
---

## **📄 MODEL 3 — Web/SMS Text Detection**

### **Architecture**

Input: Raw text (webpage / SMS / any text)  
           ↓  
   DistilBERT (LoRA)  
   shared backbone with Email model  
   — no extra training needed\!  
           ↓  
   Separate classification head  
   (fine-tuned on web/SMS data)  
           ↓  
   PHISHING / LEGIT

### **Dataset**

SMS Spam Collection (UCI):  
kaggle.com/datasets/uciml/sms-spam-collection-dataset  
5,574 SMS messages ✅

Web phishing pages:  
kaggle.com/datasets/xwolf12/malicious-and-benign-websites  
✅

Kaggle SMS Phishing:  
kaggle.com/datasets/uciml/sms-spam-collection-dataset  
✅

Note: Shared DistilBERT backbone —  
GPU aane pe email model ke saath  
ek hi training run mein done\!  
---

## **⚡ XAI Layer — All 3 Models**

Fast XAI (real-time, every request):  
→ Attention weights from model  
→ Top 5 risky tokens highlight  
→ \<5ms overhead

Deep XAI (on demand):  
→ SHAP values  
→ Feature importance scores  
→ \~50ms overhead

Human Readable Output (always):  
{  
  "verdict": "PHISHING",  
  "confidence": 94.5%,  
  "risk\_score": 0.945,  
  "risk\_level": "HIGH",  
  "reasons": \[  
    "Urgency language: 'verify immediately'",  
    "Sender domain mismatch detected",  
    "Typosquatting: 'paypa1' → 'paypal'"  
  \],  
  "highlighted\_tokens": \[  
    {"token": "verify", "risk": 0.89},  
    {"token": "immediately", "risk": 0.84}  
  \]  
}  
---

## **🏗️ Complete System Flow**

Request comes in  
      ↓  
FastAPI Router  
      ↓  
┌─────────────────────────────────────┐  
│ has sender \+ subject?               │  
│   → Email Model (45ms)              │  
│                                     │  
│ is URL string?                      │  
│   → URL Model (\<1ms)                │  
│                                     │  
│ raw text / SMS / web?               │  
│   → Text Model (45ms)               │  
└─────────────────────────────────────┘  
      ↓  
Risk Score \+ XAI  
      ↓  
Dashboard / Browser Extension  
/ Outlook Add-in / API Response  
---

## **📊 Final Expected Performance**

Model         Accuracy    FPR      Inference  
─────────────────────────────────────────────  
Email         99%+        \<1.5%    \~45ms  
URL           98.5%+      \<1%      \<1ms  
Text/SMS      97%+        \<2%      \~45ms  
─────────────────────────────────────────────  
Combined      99%+        \<1%      \<50ms total

command→bro now moving on to urls work\! like code proeprly setup krlety hain dataset preprocess krky 2no files sy aik file ma krky then script likh laty hain according to requred instrcutions i am gving highley optimized slution \[plz\! no gaps test it properly for proper response time \! and all that 1 \--\> urls dataset is here \--\>  D:\\Coding Projects\\AegisOne\\datasets\\malicious\_phish.csv &  D:\\Coding Projects\\AegisOne\\datasets\\verified\_online.csv   and combine them in same format jo reuqired data zrurt hy and check for any issudes proper labeled honac hahiya with no extra infor \!--\>🔗 MODEL 2 — URL Detection  
Architecture  
Input: Raw URL string  
"http://paypa1-secure.verify.com/login"  
           ↓  
  ┌────────────────────────────────┐  
  │  BERT Embeddings               │  
  │  (DomURLs\_BERT pretrained)     │  
  │  domain-specific pretraining   │  
  └──────────────┬─────────────────┘  
                 ↓  
         BiLSTM \+ GRU  
         (paper proven:  
          97.5% @ 0.119ms)  
                 ↓  
  ┌────────────────────────────────┐  
  │  Handcrafted Features          │  
  │  (parallel branch)             │  
  │  url\_length, has\_ip,           │  
  │  typosquatting\_score,          │  
  │  subdomain\_depth,              │  
  │  tld\_suspicious,               │  
  │  brand\_in\_domain,              │  
  │  https\_used,                   │  
  │  special\_char\_ratio,           │  
  │  shortener\_used,               │  
  │  redirect\_count                │  
  └──────────────┬─────────────────┘  
                 ↓  
         Concatenate both  
                 ↓  
    Dense → Dropout → Output  
    4 classes:  
    Phishing / Malware /  
    Defacement / Benign  
Dataset  
Kaggle Malicious URLs (primary):  
kaggle.com/datasets/sid321axn/malicious-urls-dataset  
651,191 URLs — 4 classes ✅

PhishTank (extra phishing):  
data.phishtank.com/data/online-valid.csv  
1M+ verified phishing URLs ✅

Tranco Legit URLs:  
tranco-list.eu  
Top 1M legitimate domains ✅

Target: 500K balanced dataset--\>URL           98.5%+      \<1%      \<1msModel         Accuracy    FPR      Inference

Email model trained \!  
Here are specs

### ✅ What is Perfect (The "Sahi" Stuff)

1. **Accuracy (99.43%)**: It’s nearly perfect. Out of 22,500 test emails, the model only got a tiny fraction wrong.  
2. **False Positives (0.76%)**: Only **85 safe emails** were incorrectly marked as phishing. This is the most important metric because you don't want the model blocking your important "Legit" emails.  
3. **False Negatives (0.38%)**: Only **43 phishing emails** were missed out of 11,250. This means the model is extremely "aggressive" at catching hackers.  
4. **Inference Speed (33.4ms)**: This is lightning fast. You can scan about **30 emails every single second**.  
5. **Early Stopping**: You noticed it stopped at Epoch 4/5? That is **GOOD**. It means the model realized it couldn't learn anything more without starting to "memorize" (overfit) the data. It saved the best version automatically.

\========================================================  
  TESTING WITH BEST MODEL  
\============================================================

\============================================================  
  TEST METRICS REPORT  
\============================================================  
  Accuracy:          99.43%  
  F1 Score:          99.43%  
  Precision:         99.25%  
  Recall:            99.62%  
  AUC-ROC:           0.9991  
  MCC:               0.9886  
  Loss:              0.0300

  Confusion Matrix:  
                     Predicted  
                  Legit   Phish  
    Actual Legit   11163      85  
    Actual Phish      43   11207

  False Positive Rate: 0.76%  
  False Negative Rate: 0.38%  
\============================================================

⏱️  Inference Speed Test...  
  Average inference time: 33.4ms per email

╔══════════════════════════════════════════════════════════════╗  
║          🏆 PHISHING DETECTOR — FINAL TRAINING REPORT         ║  
╠══════════════════════════════════════════════════════════════╣  
║                                                              ║  
║  📐 MODEL ARCHITECTURE                                        ║  
║  ─────────────────────────────────────────                   ║  
║  Base Model:         DistilBERT (6 layers)                   ║  
║  Fine-tuning:        LoRA (r=16, α=32)                       ║  
║  Sequence Layer:     Bi-LSTM (hidden=256)                    ║  
║  Attention:          Multi-Head (8 heads)                    ║  
║  Structured:         10 features → 32 dims                   ║  
║  Classifier:         544 → 128 → 1                           ║  
║                                                              ║  
║  📊 PARAMETERS                                                ║  
║  ─────────────────────────────────────────                   ║  
║  Total:                69,883,489                            ║  
║  Trainable:             3,520,609 (5.04%)                    ║  
║  Frozen:               66,362,880                            ║  
║                                                              ║  
║  🎯 TEST METRICS                                              ║  
║  ─────────────────────────────────────────                   ║  
║  Accuracy:              99.43%                               ║  
║  F1 Score:              99.43%                               ║  
║  Precision:             99.25%                               ║  
║  Recall:                99.62%                               ║  
║  AUC-ROC:              0.9991                                ║  
║  MCC:                  0.9886                                ║  
║  False Positive:         0.76%                               ║  
║  False Negative:         0.38%                               ║  
║                                                              ║  
║  📋 CONFUSION MATRIX                                          ║  
║  ─────────────────────────────────────────                   ║  
║                        Predicted                             ║  
║                     Legit    Phish                           ║  
║    Actual Legit    11163       85                            ║  
║    Actual Phish       43    11207                            ║  
║                                                              ║  
║  ⚙️  TRAINING CONFIG                                         ║  
║  ─────────────────────────────────────────                   ║  
║  Dataset:            150,000 (75K/75K)                       ║  
║  Split:              70/15/15                                ║  
║  Epochs:             4/5                                     ║  
║  Batch size:         16                                      ║  
║  Max seq length:     512                                     ║  
║  LR (LoRA):          2e-05                                   ║  
║  LR (Heads):         0.001                                   ║  
║  Device:             cuda                                    ║  
║  Total train time:   117.6 minutes                           ║  
║  Inference speed:    33.4ms / email                          ║  
║                                                              ║  
║  📈 TRAINING HISTORY                                         ║  
║  ─────────────────────────────────────────                   ║  
║  Epoch  Train Loss    Val Loss    Val F1   Val AUC           ║  
║      1      0.0929      0.1444    98.73%    0.9972           ║  
║      2      0.0474      0.0603    99.13%    0.9976           ║  
║      3      0.0264      0.0435    99.37%    0.9984           ║  
║      4      0.0130      0.0261    99.49%    0.9992           ║  
║      5      0.0063      0.0443    99.46%    0.9986           ║  
║                                                              ║  
╚══════════════════════════════════════════════════════════════╝

📊 All metrics saved to: training\_metrics.json  
💾 Best model saved to: best\_phishing\_model.pt

✅ Training complete\! 

🖥️  Device: cuda | ⚙️  Cores: 2  
🚀 Mixed Precision: True  
🔄 Gradient Accumulation Steps: 2  
♻️  Dataset found at final\_url\_dataset.csv. Skipping preprocessing.

🔧 Loading bert-base-uncased...  
/usr/local/lib/python3.12/dist-packages/huggingface\_hub/utils/\_auth.py:93: UserWarning:   
The secret \`HF\_TOKEN\` does not exist in your Colab secrets.  
To authenticate with the Hugging Face Hub, create a token in your settings tab (https://huggingface.co/settings/tokens), set it as secret in your Google Colab and restart your session.  
You will be able to reuse this secret in all of your notebooks.  
Please note that authentication is recommended but still optional to access public models or datasets.  
  warnings.warn(  
Warning: You are sending unauthenticated requests to the HF Hub. Please set a HF\_TOKEN to enable higher rate limits and faster downloads.  
WARNING:huggingface\_hub.utils.\_http:Warning: You are sending unauthenticated requests to the HF Hub. Please set a HF\_TOKEN to enable higher rate limits and faster downloads.  
config.json: 100%  
 570/570 \[00:00\<00:00, 13.4kB/s\]  
tokenizer\_config.json: 100%  
 48.0/48.0 \[00:00\<00:00, 1.36kB/s\]  
vocab.txt:   
 232k/? \[00:00\<00:00, 1.35MB/s\]  
tokenizer.json:   
 466k/? \[00:00\<00:00, 1.08MB/s\]  
model.safetensors: 100%  
 440M/440M \[00:03\<00:00, 498MB/s\]  
Loading weights: 100%  
 199/199 \[00:00\<00:00, 549.37it/s, Materializing param=pooler.dense.weight\]  
BertModel LOAD REPORT from: bert-base-uncased  
Key                                        | Status     |  |   
\-------------------------------------------+------------+--+-  
cls.predictions.bias                       | UNEXPECTED |  |   
cls.predictions.transform.dense.bias       | UNEXPECTED |  |   
cls.seq\_relationship.weight                | UNEXPECTED |  |   
cls.seq\_relationship.bias                  | UNEXPECTED |  |   
cls.predictions.transform.dense.weight     | UNEXPECTED |  |   
cls.predictions.transform.LayerNorm.weight | UNEXPECTED |  |   
cls.predictions.transform.LayerNorm.bias   | UNEXPECTED |  | 

Notes:  
\- UNEXPECTED	:can be ignored when loading from different task/architecture; not ok if you expect identical arch.

🏁 Training Started...

\============================================================  
\--- Epoch 1/5 \---  
\============================================================  
/tmp/ipykernel\_3155/2410752472.py:366: FutureWarning: \`torch.cuda.amp.GradScaler(args...)\` is deprecated. Please use \`torch.amp.GradScaler('cuda', args...)\` instead.  
  scaler \= GradScaler() if (Config.use\_mixed\_precision and torch.cuda.is\_available()) else None  
/tmp/ipykernel\_3155/2410752472.py:228: FutureWarning: \`torch.cuda.amp.autocast(args...)\` is deprecated. Please use \`torch.amp.autocast('cuda', args...)\` instead.  
  with autocast():  
    Batch 100/9224 | Loss: 0.9280 | Acc: 68.19%  
    Batch 200/9224 | Loss: 0.4361 | Acc: 77.91%  
    Batch 300/9224 | Loss: 0.3552 | Acc: 81.52%  
    Batch 400/9224 | Loss: 0.2753 | Acc: 84.10%  
    Batch 500/9224 | Loss: 0.2695 | Acc: 85.67%  
💾 Saved \+ Synced: checkpoint\_epoch0\_batch500.pt  
    Batch 600/9224 | Loss: 0.2131 | Acc: 86.90%  
    Batch 700/9224 | Loss: 0.2115 | Acc: 87.79%  
    Batch 800/9224 | Loss: 0.2073 | Acc: 88.51%  
    Batch 900/9224 | Loss: 0.1742 | Acc: 89.22%  
    Batch 1000/9224 | Loss: 0.1891 | Acc: 89.68%  
💾 Saved \+ Synced: checkpoint\_epoch0\_batch1000.pt  
    Batch 1100/9224 | Loss: 0.1706 | Acc: 90.14%  
    Batch 1200/9224 | Loss: 0.1643 | Acc: 90.56%  
    Batch 1300/9224 | Loss: 0.1723 | Acc: 90.92%  
    Batch 1400/9224 | Loss: 0.1715 | Acc: 91.19%  
    Batch 1500/9224 | Loss: 0.1642 | Acc: 91.44%  
💾 Saved \+ Synced: checkpoint\_epoch0\_batch1500.pt  
    Batch 1600/9224 | Loss: 0.1593 | Acc: 91.68%  
    Batch 1700/9224 | Loss: 0.1458 | Acc: 91.92%  
    Batch 1800/9224 | Loss: 0.1320 | Acc: 92.12%  
    Batch 1900/9224 | Loss: 0.1520 | Acc: 92.27%  
    Batch 2000/9224 | Loss: 0.1481 | Acc: 92.41%  
💾 Saved \+ Synced: checkpoint\_epoch0\_batch2000.pt  
    Batch 2100/9224 | Loss: 0.1246 | Acc: 92.59%  
    Batch 2200/9224 | Loss: 0.1543 | Acc: 92.72%  
    Batch 2300/9224 | Loss: 0.1307 | Acc: 92.87%  
    Batch 2400/9224 | Loss: 0.1331 | Acc: 92.99%  
    Batch 2500/9224 | Loss: 0.1484 | Acc: 93.08%  
💾 Saved \+ Synced: checkpoint\_epoch0\_batch2500.pt  
    Batch 2600/9224 | Loss: 0.1349 | Acc: 93.18%  
    Batch 2700/9224 | Loss: 0.1134 | Acc: 93.30%  
    Batch 2800/9224 | Loss: 0.1276 | Acc: 93.40%  
    Batch 2900/9224 | Loss: 0.1161 | Acc: 93.50%  
    Batch 3000/9224 | Loss: 0.1233 | Acc: 93.58%  
💾 Saved \+ Synced: checkpoint\_epoch0\_batch3000.pt  
    Batch 3100/9224 | Loss: 0.1209 | Acc: 93.67%  
    Batch 3200/9224 | Loss: 0.1312 | Acc: 93.74%  
    Batch 3300/9224 | Loss: 0.1201 | Acc: 93.81%  
    Batch 3400/9224 | Loss: 0.1101 | Acc: 93.89%  
    Batch 3500/9224 | Loss: 0.1330 | Acc: 93.94%  
💾 Saved \+ Synced: checkpoint\_epoch0\_batch3500.pt  
    Batch 3600/9224 | Loss: 0.1259 | Acc: 94.00%  
    Batch 3700/9224 | Loss: 0.1092 | Acc: 94.07%  
    Batch 3800/9224 | Loss: 0.1174 | Acc: 94.13%  
    Batch 3900/9224 | Loss: 0.1118 | Acc: 94.20%  
    Batch 4000/9224 | Loss: 0.1162 | Acc: 94.25%  
💾 Saved \+ Synced: checkpoint\_epoch0\_batch4000.pt  
    Batch 4100/9224 | Loss: 0.1040 | Acc: 94.31%  
    Batch 4200/9224 | Loss: 0.1171 | Acc: 94.35%  
    Batch 4300/9224 | Loss: 0.1151 | Acc: 94.40%  
    Batch 4400/9224 | Loss: 0.1052 | Acc: 94.46%  
    Batch 4500/9224 | Loss: 0.1170 | Acc: 94.49%  
💾 Saved \+ Synced: checkpoint\_epoch0\_batch4500.pt  
    Batch 4600/9224 | Loss: 0.1169 | Acc: 94.53%  
    Batch 4700/9224 | Loss: 0.1044 | Acc: 94.57%  
    Batch 4800/9224 | Loss: 0.1165 | Acc: 94.60%  
    Batch 4900/9224 | Loss: 0.0973 | Acc: 94.64%  
    Batch 5000/9224 | Loss: 0.0906 | Acc: 94.70%  
💾 Saved \+ Synced: checkpoint\_epoch0\_batch5000.pt  
    Batch 5100/9224 | Loss: 0.1177 | Acc: 94.73%  
    Batch 5200/9224 | Loss: 0.0957 | Acc: 94.78%  
    Batch 5300/9224 | Loss: 0.1142 | Acc: 94.81%  
    Batch 5400/9224 | Loss: 0.1064 | Acc: 94.84%  
    Batch 5500/9224 | Loss: 0.0910 | Acc: 94.88%  
💾 Saved \+ Synced: checkpoint\_epoch0\_batch5500.pt  
    Batch 5600/9224 | Loss: 0.1057 | Acc: 94.91%  
    Batch 5700/9224 | Loss: 0.1057 | Acc: 94.94%  
    Batch 5800/9224 | Loss: 0.1148 | Acc: 94.96%  
    Batch 5900/9224 | Loss: 0.1054 | Acc: 94.99%  
    Batch 6000/9224 | Loss: 0.1095 | Acc: 95.01%  
💾 Saved \+ Synced: checkpoint\_epoch0\_batch6000.pt  
    Batch 6100/9224 | Loss: 0.0980 | Acc: 95.04%  
    Batch 6200/9224 | Loss: 0.0861 | Acc: 95.08%  
    Batch 6300/9224 | Loss: 0.0913 | Acc: 95.11%  
    Batch 6400/9224 | Loss: 0.1023 | Acc: 95.13%  
    Batch 6500/9224 | Loss: 0.0933 | Acc: 95.16%  
💾 Saved \+ Synced: checkpoint\_epoch0\_batch6500.pt  
    Batch 6600/9224 | Loss: 0.0788 | Acc: 95.20%  
    Batch 6700/9224 | Loss: 0.1024 | Acc: 95.22%  
    Batch 6800/9224 | Loss: 0.1015 | Acc: 95.24%  
    Batch 6900/9224 | Loss: 0.0949 | Acc: 95.26%  
    Batch 7000/9224 | Loss: 0.1020 | Acc: 95.28%  
💾 Saved \+ Synced: checkpoint\_epoch0\_batch7000.pt  
    Batch 7100/9224 | Loss: 0.1108 | Acc: 95.30%  
    Batch 7200/9224 | Loss: 0.0884 | Acc: 95.33%  
    Batch 7300/9224 | Loss: 0.0862 | Acc: 95.35%  
    Batch 7400/9224 | Loss: 0.1032 | Acc: 95.37%  
    Batch 7500/9224 | Loss: 0.1147 | Acc: 95.38%  
💾 Saved \+ Synced: checkpoint\_epoch0\_batch7500.pt  
    Batch 7600/9224 | Loss: 0.0911 | Acc: 95.40%  
    Batch 7700/9224 | Loss: 0.0884 | Acc: 95.42%  
    Batch 7800/9224 | Loss: 0.0912 | Acc: 95.45%  
    Batch 7900/9224 | Loss: 0.0952 | Acc: 95.46%  
    Batch 8000/9224 | Loss: 0.1031 | Acc: 95.48%  
💾 Saved \+ Synced: checkpoint\_epoch0\_batch8000.pt  
    Batch 8100/9224 | Loss: 0.0842 | Acc: 95.50%  
    Batch 8200/9224 | Loss: 0.1059 | Acc: 95.52%  
    Batch 8300/9224 | Loss: 0.0933 | Acc: 95.53%  
    Batch 8400/9224 | Loss: 0.0849 | Acc: 95.56%  
    Batch 8500/9224 | Loss: 0.0922 | Acc: 95.57%  
💾 Saved \+ Synced: checkpoint\_epoch0\_batch8500.pt  
    Batch 8600/9224 | Loss: 0.0897 | Acc: 95.59%  
    Batch 8700/9224 | Loss: 0.0772 | Acc: 95.61%  
    Batch 8800/9224 | Loss: 0.0788 | Acc: 95.63%  
    Batch 8900/9224 | Loss: 0.0815 | Acc: 95.65%  
    Batch 9000/9224 | Loss: 0.1010 | Acc: 95.67%  
💾 Saved \+ Synced: checkpoint\_epoch0\_batch9000.pt  
    Batch 9100/9224 | Loss: 0.0854 | Acc: 95.68%  
    Batch 9200/9224 | Loss: 0.0928 | Acc: 95.69%

⏱️  Epoch time: 993.66s  
📉 Train Loss: 0.1354 | Train Acc: 95.70%

🔍 Evaluating...  
/tmp/ipykernel\_3155/2410752472.py:291: FutureWarning: \`torch.cuda.amp.autocast(args...)\` is deprecated. Please use \`torch.amp.autocast('cuda', args...)\` instead.  
  with autocast():

\============================================================  
📊 Validation Results \- Epoch 1  
\============================================================  
F1 Score: 0.9715 | Accuracy: 0.9743

              precision    recall  f1-score   support

      Benign       0.97      0.97      0.97     25000  
    Phishing       0.96      0.97      0.97     25000  
     Malware       0.98      0.93      0.96      4729  
  Defacement       0.99      1.00      0.99     19062

    accuracy                           0.97     73791  
   macro avg       0.98      0.97      0.97     73791  
weighted avg       0.97      0.97      0.97     73791

💾 🏆 New best model saved\! F1: 0.9715  
💾 Saved \+ Synced: checkpoint\_epoch1\_batch0.pt

\============================================================  
\--- Epoch 2/5 \---  
\============================================================  
/tmp/ipykernel\_3155/2410752472.py:228: FutureWarning: \`torch.cuda.amp.autocast(args...)\` is deprecated. Please use \`torch.amp.autocast('cuda', args...)\` instead.  
  with autocast():  
    Batch 100/9224 | Loss: 0.0975 | Acc: 96.72%  
    Batch 200/9224 | Loss: 0.0801 | Acc: 97.08%  
    Batch 300/9224 | Loss: 0.0971 | Acc: 97.00%  
    Batch 400/9224 | Loss: 0.0755 | Acc: 97.15%  
    Batch 500/9224 | Loss: 0.0786 | Acc: 97.24%  
💾 Saved \+ Synced: checkpoint\_epoch1\_batch500.pt  
    Batch 600/9224 | Loss: 0.0631 | Acc: 97.36%  
    Batch 700/9224 | Loss: 0.0863 | Acc: 97.34%  
    Batch 800/9224 | Loss: 0.0981 | Acc: 97.30%  
    Batch 900/9224 | Loss: 0.0796 | Acc: 97.27%  
    Batch 1000/9224 | Loss: 0.0832 | Acc: 97.30%  
💾 Saved \+ Synced: checkpoint\_epoch1\_batch1000.pt  
    Batch 1100/9224 | Loss: 0.0880 | Acc: 97.28%  
    Batch 1200/9224 | Loss: 0.0815 | Acc: 97.28%  
    Batch 1300/9224 | Loss: 0.0900 | Acc: 97.28%  
    Batch 1400/9224 | Loss: 0.0788 | Acc: 97.28%  
    Batch 1500/9224 | Loss: 0.0895 | Acc: 97.29%  
💾 Saved \+ Synced: checkpoint\_epoch1\_batch1500.pt  
    Batch 1600/9224 | Loss: 0.0777 | Acc: 97.30%  
    Batch 1700/9224 | Loss: 0.0861 | Acc: 97.30%  
    Batch 1800/9224 | Loss: 0.0764 | Acc: 97.33%  
    Batch 1900/9224 | Loss: 0.0896 | Acc: 97.31%  
    Batch 2000/9224 | Loss: 0.0828 | Acc: 97.31%  
💾 Saved \+ Synced: checkpoint\_epoch1\_batch2000.pt  
    Batch 2100/9224 | Loss: 0.0784 | Acc: 97.32%  
    Batch 2200/9224 | Loss: 0.0782 | Acc: 97.33%  
    Batch 2300/9224 | Loss: 0.0746 | Acc: 97.34%  
    Batch 2400/9224 | Loss: 0.0910 | Acc: 97.33%  
    Batch 2500/9224 | Loss: 0.0892 | Acc: 97.33%  
💾 Saved \+ Synced: checkpoint\_epoch1\_batch2500.pt  
    Batch 2600/9224 | Loss: 0.0822 | Acc: 97.33%  
    Batch 2700/9224 | Loss: 0.0778 | Acc: 97.34%  
    Batch 2800/9224 | Loss: 0.0814 | Acc: 97.34%  
    Batch 2900/9224 | Loss: 0.0805 | Acc: 97.34%  
    Batch 3000/9224 | Loss: 0.0850 | Acc: 97.35%  
💾 Saved \+ Synced: checkpoint\_epoch1\_batch3000.pt  
    Batch 3100/9224 | Loss: 0.0684 | Acc: 97.35%  
    Batch 3200/9224 | Loss: 0.0822 | Acc: 97.35%  
    Batch 3300/9224 | Loss: 0.0870 | Acc: 97.35%  
    Batch 3400/9224 | Loss: 0.0794 | Acc: 97.35%  
    Batch 3500/9224 | Loss: 0.0843 | Acc: 97.34%  
💾 Saved \+ Synced: checkpoint\_epoch1\_batch3500.pt  
    Batch 3600/9224 | Loss: 0.0858 | Acc: 97.34%  
    Batch 3700/9224 | Loss: 0.0782 | Acc: 97.35%  
    Batch 3800/9224 | Loss: 0.0808 | Acc: 97.35%  
    Batch 3900/9224 | Loss: 0.0856 | Acc: 97.35%  
    Batch 4000/9224 | Loss: 0.0708 | Acc: 97.36%  
💾 Saved \+ Synced: checkpoint\_epoch1\_batch4000.pt  
    Batch 4100/9224 | Loss: 0.0899 | Acc: 97.36%  
    Batch 4200/9224 | Loss: 0.0728 | Acc: 97.36%  
    Batch 4300/9224 | Loss: 0.0798 | Acc: 97.36%  
    Batch 4400/9224 | Loss: 0.0727 | Acc: 97.37%  
    Batch 4500/9224 | Loss: 0.0864 | Acc: 97.36%  
💾 Saved \+ Synced: checkpoint\_epoch1\_batch4500.pt  
    Batch 4600/9224 | Loss: 0.0839 | Acc: 97.35%  
    Batch 4700/9224 | Loss: 0.0992 | Acc: 97.34%  
    Batch 4800/9224 | Loss: 0.0701 | Acc: 97.34%  
    Batch 4900/9224 | Loss: 0.0855 | Acc: 97.34%  
    Batch 5000/9224 | Loss: 0.0806 | Acc: 97.33%  
💾 Saved \+ Synced: checkpoint\_epoch1\_batch5000.pt  
    Batch 5100/9224 | Loss: 0.0662 | Acc: 97.34%  
    Batch 5200/9224 | Loss: 0.0749 | Acc: 97.35%  
    Batch 5300/9224 | Loss: 0.0789 | Acc: 97.36%  
    Batch 5400/9224 | Loss: 0.0667 | Acc: 97.36%  
    Batch 5500/9224 | Loss: 0.0728 | Acc: 97.36%  
💾 Saved \+ Synced: checkpoint\_epoch1\_batch5500.pt  
    Batch 5600/9224 | Loss: 0.0641 | Acc: 97.37%  
    Batch 5700/9224 | Loss: 0.0730 | Acc: 97.38%  
    Batch 5800/9224 | Loss: 0.0867 | Acc: 97.38%  
    Batch 5900/9224 | Loss: 0.0670 | Acc: 97.39%  
    Batch 6000/9224 | Loss: 0.0696 | Acc: 97.39%  
💾 Saved \+ Synced: checkpoint\_epoch1\_batch6000.pt  
    Batch 6100/9224 | Loss: 0.0769 | Acc: 97.40%  
    Batch 6200/9224 | Loss: 0.0748 | Acc: 97.40%  
    Batch 6300/9224 | Loss: 0.0830 | Acc: 97.40%  
    Batch 6400/9224 | Loss: 0.0863 | Acc: 97.39%  
    Batch 6500/9224 | Loss: 0.0831 | Acc: 97.39%  
💾 Saved \+ Synced: checkpoint\_epoch1\_batch6500.pt  
    Batch 6600/9224 | Loss: 0.0776 | Acc: 97.39%  
    Batch 6700/9224 | Loss: 0.0632 | Acc: 97.40%  
    Batch 6800/9224 | Loss: 0.0765 | Acc: 97.40%  
    Batch 6900/9224 | Loss: 0.0753 | Acc: 97.40%  
    Batch 7000/9224 | Loss: 0.0715 | Acc: 97.40%  
💾 Saved \+ Synced: checkpoint\_epoch1\_batch7000.pt  
    Batch 7100/9224 | Loss: 0.0690 | Acc: 97.41%  
    Batch 7200/9224 | Loss: 0.0750 | Acc: 97.41%  
    Batch 7300/9224 | Loss: 0.0716 | Acc: 97.41%  
    Batch 7400/9224 | Loss: 0.0655 | Acc: 97.42%  
    Batch 7500/9224 | Loss: 0.0729 | Acc: 97.42%  
💾 Saved \+ Synced: checkpoint\_epoch1\_batch7500.pt  
    Batch 7600/9224 | Loss: 0.0794 | Acc: 97.41%  
    Batch 7700/9224 | Loss: 0.0690 | Acc: 97.41%  
    Batch 7800/9224 | Loss: 0.0789 | Acc: 97.41%  
    Batch 7900/9224 | Loss: 0.0699 | Acc: 97.42%  
    Batch 8000/9224 | Loss: 0.0836 | Acc: 97.41%  
💾 Saved \+ Synced: checkpoint\_epoch1\_batch8000.pt  
    Batch 8100/9224 | Loss: 0.0838 | Acc: 97.42%  
    Batch 8200/9224 | Loss: 0.0773 | Acc: 97.42%  
    Batch 8300/9224 | Loss: 0.0705 | Acc: 97.42%  
    Batch 8400/9224 | Loss: 0.0688 | Acc: 97.43%  
    Batch 8500/9224 | Loss: 0.0793 | Acc: 97.43%  
💾 Saved \+ Synced: checkpoint\_epoch1\_batch8500.pt  
    Batch 8600/9224 | Loss: 0.0802 | Acc: 97.43%  
    Batch 8700/9224 | Loss: 0.0657 | Acc: 97.43%  
    Batch 8800/9224 | Loss: 0.0790 | Acc: 97.43%  
    Batch 8900/9224 | Loss: 0.0679 | Acc: 97.43%  
    Batch 9000/9224 | Loss: 0.0789 | Acc: 97.44%  
💾 Saved \+ Synced: checkpoint\_epoch1\_batch9000.pt  
    Batch 9100/9224 | Loss: 0.0786 | Acc: 97.44%  
    Batch 9200/9224 | Loss: 0.0717 | Acc: 97.44%

⏱️  Epoch time: 1164.20s  
📉 Train Loss: 0.0788 | Train Acc: 97.44%

🔍 Evaluating...  
/tmp/ipykernel\_3155/2410752472.py:291: FutureWarning: \`torch.cuda.amp.autocast(args...)\` is deprecated. Please use \`torch.amp.autocast('cuda', args...)\` instead.  
  with autocast():

\============================================================  
📊 Validation Results \- Epoch 2  
\============================================================  
F1 Score: 0.9759 | Accuracy: 0.9790

              precision    recall  f1-score   support

      Benign       0.98      0.98      0.98     25000  
    Phishing       0.97      0.97      0.97     25000  
     Malware       0.99      0.93      0.96      4729  
  Defacement       0.98      1.00      0.99     19062

    accuracy                           0.98     73791  
   macro avg       0.98      0.97      0.98     73791  
weighted avg       0.98      0.98      0.98     73791

💾 🏆 New best model saved\! F1: 0.9759  
💾 Saved \+ Synced: checkpoint\_epoch2\_batch0.pt

\============================================================  
\--- Epoch 3/5 \---  
\============================================================  
/tmp/ipykernel\_3155/2410752472.py:228: FutureWarning: \`torch.cuda.amp.autocast(args...)\` is deprecated. Please use \`torch.amp.autocast('cuda', args...)\` instead.  
  with autocast():  
    Batch 100/9224 | Loss: 0.0764 | Acc: 97.41%  
    Batch 200/9224 | Loss: 0.0684 | Acc: 97.59%  
    Batch 300/9224 | Loss: 0.0588 | Acc: 97.75%  
    Batch 400/9224 | Loss: 0.0649 | Acc: 97.81%  
    Batch 500/9224 | Loss: 0.0637 | Acc: 97.85%  
💾 Saved \+ Synced: checkpoint\_epoch2\_batch500.pt  
    Batch 600/9224 | Loss: 0.0641 | Acc: 97.86%  
    Batch 700/9224 | Loss: 0.0792 | Acc: 97.73%  
    Batch 800/9224 | Loss: 0.0686 | Acc: 97.77%  
    Batch 900/9224 | Loss: 0.0714 | Acc: 97.76%  
    Batch 1000/9224 | Loss: 0.0627 | Acc: 97.77%  
💾 Saved \+ Synced: checkpoint\_epoch2\_batch1000.pt  
    Batch 1100/9224 | Loss: 0.0640 | Acc: 97.78%  
    Batch 1200/9224 | Loss: 0.0625 | Acc: 97.78%  
    Batch 1300/9224 | Loss: 0.0713 | Acc: 97.78%  
    Batch 1400/9224 | Loss: 0.0701 | Acc: 97.75%  
    Batch 1500/9224 | Loss: 0.0654 | Acc: 97.78%  
💾 Saved \+ Synced: checkpoint\_epoch2\_batch1500.pt  
    Batch 1600/9224 | Loss: 0.0610 | Acc: 97.80%  
    Batch 1700/9224 | Loss: 0.0693 | Acc: 97.80%  
    Batch 1800/9224 | Loss: 0.0743 | Acc: 97.78%  
    Batch 1900/9224 | Loss: 0.0610 | Acc: 97.80%  
    Batch 2000/9224 | Loss: 0.0748 | Acc: 97.78%  
💾 Saved \+ Synced: checkpoint\_epoch2\_batch2000.pt  
    Batch 2100/9224 | Loss: 0.0690 | Acc: 97.77%  
    Batch 2200/9224 | Loss: 0.0642 | Acc: 97.79%  
    Batch 2300/9224 | Loss: 0.0677 | Acc: 97.80%  
    Batch 2400/9224 | Loss: 0.0746 | Acc: 97.78%  
    Batch 2500/9224 | Loss: 0.0638 | Acc: 97.79%  
💾 Saved \+ Synced: checkpoint\_epoch2\_batch2500.pt  
    Batch 2600/9224 | Loss: 0.0711 | Acc: 97.78%  
    Batch 2700/9224 | Loss: 0.0770 | Acc: 97.77%  
    Batch 2800/9224 | Loss: 0.0531 | Acc: 97.78%  
    Batch 2900/9224 | Loss: 0.0704 | Acc: 97.77%  
    Batch 3000/9224 | Loss: 0.0655 | Acc: 97.78%  
💾 Saved \+ Synced: checkpoint\_epoch2\_batch3000.pt  
    Batch 3100/9224 | Loss: 0.0587 | Acc: 97.79%  
    Batch 3200/9224 | Loss: 0.0670 | Acc: 97.78%  
    Batch 3300/9224 | Loss: 0.0615 | Acc: 97.79%  
    Batch 3400/9224 | Loss: 0.0739 | Acc: 97.79%  
    Batch 3500/9224 | Loss: 0.0761 | Acc: 97.78%  
💾 Saved \+ Synced: checkpoint\_epoch2\_batch3500.pt  
    Batch 3600/9224 | Loss: 0.0622 | Acc: 97.78%  
    Batch 3700/9224 | Loss: 0.0649 | Acc: 97.78%  
    Batch 3800/9224 | Loss: 0.0737 | Acc: 97.77%  
    Batch 3900/9224 | Loss: 0.0668 | Acc: 97.77%  
    Batch 4000/9224 | Loss: 0.0606 | Acc: 97.78%  
💾 Saved \+ Synced: checkpoint\_epoch2\_batch4000.pt  
    Batch 4100/9224 | Loss: 0.0630 | Acc: 97.79%  
    Batch 4200/9224 | Loss: 0.0739 | Acc: 97.79%  
    Batch 4300/9224 | Loss: 0.0756 | Acc: 97.78%  
    Batch 4400/9224 | Loss: 0.0571 | Acc: 97.79%  
    Batch 4500/9224 | Loss: 0.0640 | Acc: 97.79%  
💾 Saved \+ Synced: checkpoint\_epoch2\_batch4500.pt  
    Batch 4600/9224 | Loss: 0.0554 | Acc: 97.81%  
    Batch 4700/9224 | Loss: 0.0697 | Acc: 97.80%  
    Batch 4800/9224 | Loss: 0.0644 | Acc: 97.81%  
    Batch 4900/9224 | Loss: 0.0638 | Acc: 97.80%  
    Batch 5000/9224 | Loss: 0.0776 | Acc: 97.79%  
💾 Saved \+ Synced: checkpoint\_epoch2\_batch5000.pt  
    Batch 5100/9224 | Loss: 0.0800 | Acc: 97.78%  
    Batch 5200/9224 | Loss: 0.0678 | Acc: 97.78%  
    Batch 5300/9224 | Loss: 0.0622 | Acc: 97.79%  
    Batch 5400/9224 | Loss: 0.0564 | Acc: 97.80%  
    Batch 5500/9224 | Loss: 0.0658 | Acc: 97.80%  
💾 Saved \+ Synced: checkpoint\_epoch2\_batch5500.pt  
    Batch 5600/9224 | Loss: 0.0753 | Acc: 97.79%  
    Batch 5700/9224 | Loss: 0.0593 | Acc: 97.80%  
    Batch 5800/9224 | Loss: 0.0533 | Acc: 97.80%  
    Batch 5900/9224 | Loss: 0.0796 | Acc: 97.79%  
    Batch 6000/9224 | Loss: 0.0615 | Acc: 97.79%  
💾 Saved \+ Synced: checkpoint\_epoch2\_batch6000.pt  
    Batch 6100/9224 | Loss: 0.0600 | Acc: 97.80%  
    Batch 6200/9224 | Loss: 0.0664 | Acc: 97.79%  
    Batch 6300/9224 | Loss: 0.0675 | Acc: 97.79%  
    Batch 6400/9224 | Loss: 0.0737 | Acc: 97.79%  
    Batch 6500/9224 | Loss: 0.0590 | Acc: 97.79%  
💾 Saved \+ Synced: checkpoint\_epoch2\_batch6500.pt  
    Batch 6600/9224 | Loss: 0.0713 | Acc: 97.79%  
    Batch 6700/9224 | Loss: 0.0652 | Acc: 97.79%  
    Batch 6800/9224 | Loss: 0.0610 | Acc: 97.79%  
    Batch 6900/9224 | Loss: 0.0654 | Acc: 97.79%  
    Batch 7000/9224 | Loss: 0.0657 | Acc: 97.79%  
💾 Saved \+ Synced: checkpoint\_epoch2\_batch7000.pt  
    Batch 7100/9224 | Loss: 0.0755 | Acc: 97.79%  
    Batch 7200/9224 | Loss: 0.0641 | Acc: 97.79%  
    Batch 7300/9224 | Loss: 0.0635 | Acc: 97.79%  
    Batch 7400/9224 | Loss: 0.0718 | Acc: 97.79%  
    Batch 7500/9224 | Loss: 0.0662 | Acc: 97.79%  
💾 Saved \+ Synced: checkpoint\_epoch2\_batch7500.pt  
    Batch 7600/9224 | Loss: 0.0657 | Acc: 97.79%  
    Batch 7700/9224 | Loss: 0.0714 | Acc: 97.79%  
    Batch 7800/9224 | Loss: 0.0705 | Acc: 97.79%  
    Batch 7900/9224 | Loss: 0.0815 | Acc: 97.78%  
    Batch 8000/9224 | Loss: 0.0687 | Acc: 97.78%  
💾 Saved \+ Synced: checkpoint\_epoch2\_batch8000.pt  
    Batch 8100/9224 | Loss: 0.0566 | Acc: 97.78%  
    Batch 8200/9224 | Loss: 0.0741 | Acc: 97.78%  
    Batch 8300/9224 | Loss: 0.0621 | Acc: 97.78%  
    Batch 8400/9224 | Loss: 0.0545 | Acc: 97.79%  
    Batch 8500/9224 | Loss: 0.0598 | Acc: 97.79%  
💾 Saved \+ Synced: checkpoint\_epoch2\_batch8500.pt  
    Batch 8600/9224 | Loss: 0.0725 | Acc: 97.79%  
    Batch 8700/9224 | Loss: 0.0624 | Acc: 97.79%  
    Batch 8800/9224 | Loss: 0.0666 | Acc: 97.79%  
    Batch 8900/9224 | Loss: 0.0678 | Acc: 97.79%  
    Batch 9000/9224 | Loss: 0.0665 | Acc: 97.79%  
💾 Saved \+ Synced: checkpoint\_epoch2\_batch9000.pt  
    Batch 9100/9224 | Loss: 0.0643 | Acc: 97.80%  
    Batch 9200/9224 | Loss: 0.0575 | Acc: 97.80%

⏱️  Epoch time: 1172.79s  
📉 Train Loss: 0.0667 | Train Acc: 97.80%

🔍 Evaluating...  
/tmp/ipykernel\_3155/2410752472.py:291: FutureWarning: \`torch.cuda.amp.autocast(args...)\` is deprecated. Please use \`torch.amp.autocast('cuda', args...)\` instead.  
  with autocast():

\============================================================  
📊 Validation Results \- Epoch 3  
\============================================================  
F1 Score: 0.9782 | Accuracy: 0.9800

              precision    recall  f1-score   support

      Benign       0.99      0.97      0.98     25000  
    Phishing       0.96      0.98      0.97     25000  
     Malware       1.00      0.94      0.97      4729  
  Defacement       0.99      1.00      1.00     19062

    accuracy                           0.98     73791  
   macro avg       0.98      0.97      0.98     73791  
weighted avg       0.98      0.98      0.98     73791

💾 🏆 New best model saved\! F1: 0.9782  
💾 Saved \+ Synced: checkpoint\_epoch3\_batch0.pt

\============================================================  
\--- Epoch 4/5 \---  
\============================================================  
/tmp/ipykernel\_3155/2410752472.py:228: FutureWarning: \`torch.cuda.amp.autocast(args...)\` is deprecated. Please use \`torch.amp.autocast('cuda', args...)\` instead.  
  with autocast():  
    Batch 100/9224 | Loss: 0.0532 | Acc: 98.28%  
    Batch 200/9224 | Loss: 0.0545 | Acc: 98.22%  
    Batch 300/9224 | Loss: 0.0550 | Acc: 98.24%  
    Batch 400/9224 | Loss: 0.0591 | Acc: 98.19%  
    Batch 500/9224 | Loss: 0.0535 | Acc: 98.19%  
💾 Saved \+ Synced: checkpoint\_epoch3\_batch500.pt  
    Batch 600/9224 | Loss: 0.0566 | Acc: 98.12%  
    Batch 700/9224 | Loss: 0.0823 | Acc: 98.01%  
    Batch 800/9224 | Loss: 0.0495 | Acc: 98.08%  
    Batch 900/9224 | Loss: 0.0483 | Acc: 98.14%  
    Batch 1000/9224 | Loss: 0.0546 | Acc: 98.12%  
💾 Saved \+ Synced: checkpoint\_epoch3\_batch1000.pt  
    Batch 1100/9224 | Loss: 0.0613 | Acc: 98.11%  
    Batch 1200/9224 | Loss: 0.0566 | Acc: 98.12%  
    Batch 1300/9224 | Loss: 0.0622 | Acc: 98.13%  
    Batch 1400/9224 | Loss: 0.0597 | Acc: 98.13%  
    Batch 1500/9224 | Loss: 0.0777 | Acc: 98.08%  
💾 Saved \+ Synced: checkpoint\_epoch3\_batch1500.pt  
    Batch 1600/9224 | Loss: 0.0584 | Acc: 98.07%  
    Batch 1700/9224 | Loss: 0.0612 | Acc: 98.06%  
    Batch 1800/9224 | Loss: 0.0499 | Acc: 98.06%  
    Batch 1900/9224 | Loss: 0.0611 | Acc: 98.06%  
    Batch 2000/9224 | Loss: 0.0563 | Acc: 98.04%  
💾 Saved \+ Synced: checkpoint\_epoch3\_batch2000.pt  
    Batch 2100/9224 | Loss: 0.0507 | Acc: 98.05%  
    Batch 2200/9224 | Loss: 0.0689 | Acc: 98.04%  
    Batch 2300/9224 | Loss: 0.0662 | Acc: 98.03%  
    Batch 2400/9224 | Loss: 0.0563 | Acc: 98.03%  
    Batch 2500/9224 | Loss: 0.0563 | Acc: 98.04%  
💾 Saved \+ Synced: checkpoint\_epoch3\_batch2500.pt  
    Batch 2600/9224 | Loss: 0.0640 | Acc: 98.03%  
    Batch 2700/9224 | Loss: 0.0486 | Acc: 98.03%  
    Batch 2800/9224 | Loss: 0.0521 | Acc: 98.03%  
    Batch 2900/9224 | Loss: 0.0463 | Acc: 98.04%  
    Batch 3000/9224 | Loss: 0.0671 | Acc: 98.04%  
💾 Saved \+ Synced: checkpoint\_epoch3\_batch3000.pt  
    Batch 3100/9224 | Loss: 0.0679 | Acc: 98.02%  
    Batch 3200/9224 | Loss: 0.0557 | Acc: 98.02%  
    Batch 3300/9224 | Loss: 0.0583 | Acc: 98.02%  
    Batch 3400/9224 | Loss: 0.0644 | Acc: 98.02%  
    Batch 3500/9224 | Loss: 0.0476 | Acc: 98.02%  
💾 Saved \+ Synced: checkpoint\_epoch3\_batch3500.pt  
    Batch 3600/9224 | Loss: 0.0643 | Acc: 98.02%  
    Batch 3700/9224 | Loss: 0.0697 | Acc: 98.02%  
    Batch 3800/9224 | Loss: 0.0608 | Acc: 98.01%  
    Batch 3900/9224 | Loss: 0.0513 | Acc: 98.02%  
    Batch 4000/9224 | Loss: 0.0611 | Acc: 98.02%  
💾 Saved \+ Synced: checkpoint\_epoch3\_batch4000.pt  
    Batch 4100/9224 | Loss: 0.0685 | Acc: 98.02%  
    Batch 4200/9224 | Loss: 0.0560 | Acc: 98.03%  
    Batch 4300/9224 | Loss: 0.0619 | Acc: 98.02%  
    Batch 4400/9224 | Loss: 0.0589 | Acc: 98.03%  
    Batch 4500/9224 | Loss: 0.0697 | Acc: 98.02%  
💾 Saved \+ Synced: checkpoint\_epoch3\_batch4500.pt  
    Batch 4600/9224 | Loss: 0.0598 | Acc: 98.02%  
    Batch 4700/9224 | Loss: 0.0661 | Acc: 98.02%  
    Batch 4800/9224 | Loss: 0.0537 | Acc: 98.02%  
    Batch 4900/9224 | Loss: 0.0530 | Acc: 98.03%  
    Batch 5000/9224 | Loss: 0.0636 | Acc: 98.03%  
💾 Saved \+ Synced: checkpoint\_epoch3\_batch5000.pt  
    Batch 5100/9224 | Loss: 0.0686 | Acc: 98.02%  
    Batch 5200/9224 | Loss: 0.0752 | Acc: 98.00%  
    Batch 5300/9224 | Loss: 0.0704 | Acc: 98.00%  
    Batch 5400/9224 | Loss: 0.0612 | Acc: 98.00%  
    Batch 5500/9224 | Loss: 0.0541 | Acc: 98.01%  
💾 Saved \+ Synced: checkpoint\_epoch3\_batch5500.pt  
    Batch 5600/9224 | Loss: 0.0534 | Acc: 98.01%  
    Batch 5700/9224 | Loss: 0.0538 | Acc: 98.01%  
    Batch 5800/9224 | Loss: 0.0658 | Acc: 98.01%  
    Batch 5900/9224 | Loss: 0.0575 | Acc: 98.01%  
    Batch 6000/9224 | Loss: 0.0538 | Acc: 98.01%  
💾 Saved \+ Synced: checkpoint\_epoch3\_batch6000.pt  
    Batch 6100/9224 | Loss: 0.0747 | Acc: 98.00%  
    Batch 6200/9224 | Loss: 0.0475 | Acc: 98.00%  
    Batch 6300/9224 | Loss: 0.0573 | Acc: 98.00%  
    Batch 6400/9224 | Loss: 0.0535 | Acc: 98.01%  
    Batch 6500/9224 | Loss: 0.0498 | Acc: 98.01%  
💾 Saved \+ Synced: checkpoint\_epoch3\_batch6500.pt  
    Batch 6600/9224 | Loss: 0.0520 | Acc: 98.01%  
    Batch 6700/9224 | Loss: 0.0555 | Acc: 98.02%  
    Batch 6800/9224 | Loss: 0.0475 | Acc: 98.02%  
    Batch 6900/9224 | Loss: 0.0522 | Acc: 98.02%  
    Batch 7000/9224 | Loss: 0.0472 | Acc: 98.03%  
💾 Saved \+ Synced: checkpoint\_epoch3\_batch7000.pt  
    Batch 7100/9224 | Loss: 0.0567 | Acc: 98.03%  
    Batch 7200/9224 | Loss: 0.0508 | Acc: 98.03%  
    Batch 7300/9224 | Loss: 0.0556 | Acc: 98.03%  
    Batch 7400/9224 | Loss: 0.0683 | Acc: 98.03%  
    Batch 7500/9224 | Loss: 0.0509 | Acc: 98.03%  
💾 Saved \+ Synced: checkpoint\_epoch3\_batch7500.pt  
    Batch 7600/9224 | Loss: 0.0706 | Acc: 98.03%  
    Batch 7700/9224 | Loss: 0.0490 | Acc: 98.03%  
    Batch 7800/9224 | Loss: 0.0462 | Acc: 98.04%  
    Batch 7900/9224 | Loss: 0.0654 | Acc: 98.04%  
    Batch 8000/9224 | Loss: 0.0477 | Acc: 98.04%  
💾 Saved \+ Synced: checkpoint\_epoch3\_batch8000.pt  
    Batch 8100/9224 | Loss: 0.0461 | Acc: 98.05%  
    Batch 8200/9224 | Loss: 0.0699 | Acc: 98.05%  
    Batch 8300/9224 | Loss: 0.0547 | Acc: 98.05%  
    Batch 8400/9224 | Loss: 0.0614 | Acc: 98.05%  
    Batch 8500/9224 | Loss: 0.0598 | Acc: 98.05%  
💾 Saved \+ Synced: checkpoint\_epoch3\_batch8500.pt  
    Batch 8600/9224 | Loss: 0.0565 | Acc: 98.05%  
    Batch 8700/9224 | Loss: 0.0647 | Acc: 98.05%  
    Batch 8800/9224 | Loss: 0.0636 | Acc: 98.04%  
    Batch 8900/9224 | Loss: 0.0554 | Acc: 98.04%  
    Batch 9000/9224 | Loss: 0.0548 | Acc: 98.04%  
💾 Saved \+ Synced: checkpoint\_epoch3\_batch9000.pt  
    Batch 9100/9224 | Loss: 0.0483 | Acc: 98.05%  
    Batch 9200/9224 | Loss: 0.0530 | Acc: 98.05%

⏱️  Epoch time: 1131.41s  
📉 Train Loss: 0.0582 | Train Acc: 98.05%

🔍 Evaluating...  
/tmp/ipykernel\_3155/2410752472.py:291: FutureWarning: \`torch.cuda.amp.autocast(args...)\` is deprecated. Please use \`torch.amp.autocast('cuda', args...)\` instead.  
  with autocast():

\============================================================  
📊 Validation Results \- Epoch 4  
\============================================================  
F1 Score: 0.9785 | Accuracy: 0.9806

              precision    recall  f1-score   support

      Benign       0.98      0.98      0.98     25000  
    Phishing       0.97      0.97      0.97     25000  
     Malware       1.00      0.94      0.97      4729  
  Defacement       0.99      1.00      0.99     19062

    accuracy                           0.98     73791  
   macro avg       0.98      0.97      0.98     73791  
weighted avg       0.98      0.98      0.98     73791

💾 🏆 New best model saved\! F1: 0.9785  
💾 Saved \+ Synced: checkpoint\_epoch4\_batch0.pt

\============================================================  
\--- Epoch 5/5 \---  
\============================================================  
/tmp/ipykernel\_3155/2410752472.py:228: FutureWarning: \`torch.cuda.amp.autocast(args...)\` is deprecated. Please use \`torch.amp.autocast('cuda', args...)\` instead.  
  with autocast():  
    Batch 100/9224 | Loss: 0.0479 | Acc: 98.47%  
    Batch 200/9224 | Loss: 0.0548 | Acc: 98.38%  
    Batch 300/9224 | Loss: 0.0628 | Acc: 98.20%  
    Batch 400/9224 | Loss: 0.0434 | Acc: 98.31%  
    Batch 500/9224 | Loss: 0.0572 | Acc: 98.26%  
💾 Saved \+ Synced: checkpoint\_epoch4\_batch500.pt  
    Batch 600/9224 | Loss: 0.0472 | Acc: 98.29%  
    Batch 700/9224 | Loss: 0.0494 | Acc: 98.31%  
    Batch 800/9224 | Loss: 0.0620 | Acc: 98.27%  
    Batch 900/9224 | Loss: 0.0497 | Acc: 98.27%  
    Batch 1000/9224 | Loss: 0.0588 | Acc: 98.27%  
💾 Saved \+ Synced: checkpoint\_epoch4\_batch1000.pt  
    Batch 1100/9224 | Loss: 0.0541 | Acc: 98.27%  
    Batch 1200/9224 | Loss: 0.0506 | Acc: 98.27%  
    Batch 1300/9224 | Loss: 0.0522 | Acc: 98.28%  
    Batch 1400/9224 | Loss: 0.0523 | Acc: 98.27%  
    Batch 1500/9224 | Loss: 0.0395 | Acc: 98.30%  
💾 Saved \+ Synced: checkpoint\_epoch4\_batch1500.pt  
    Batch 1600/9224 | Loss: 0.0508 | Acc: 98.30%  
    Batch 1700/9224 | Loss: 0.0516 | Acc: 98.29%  
    Batch 1800/9224 | Loss: 0.0550 | Acc: 98.29%  
    Batch 1900/9224 | Loss: 0.0516 | Acc: 98.29%  
    Batch 2000/9224 | Loss: 0.0473 | Acc: 98.31%  
💾 Saved \+ Synced: checkpoint\_epoch4\_batch2000.pt  
    Batch 2100/9224 | Loss: 0.0536 | Acc: 98.31%  
    Batch 2200/9224 | Loss: 0.0499 | Acc: 98.31%  
    Batch 2300/9224 | Loss: 0.0632 | Acc: 98.29%  
    Batch 2400/9224 | Loss: 0.0398 | Acc: 98.31%  
    Batch 2500/9224 | Loss: 0.0473 | Acc: 98.31%  
💾 Saved \+ Synced: checkpoint\_epoch4\_batch2500.pt  
    Batch 2600/9224 | Loss: 0.0564 | Acc: 98.31%  
    Batch 2700/9224 | Loss: 0.0422 | Acc: 98.31%  
    Batch 2800/9224 | Loss: 0.0528 | Acc: 98.30%  
    Batch 2900/9224 | Loss: 0.0551 | Acc: 98.29%  
    Batch 3000/9224 | Loss: 0.0543 | Acc: 98.29%  
💾 Saved \+ Synced: checkpoint\_epoch4\_batch3000.pt  
    Batch 3100/9224 | Loss: 0.0657 | Acc: 98.28%  
    Batch 3200/9224 | Loss: 0.0544 | Acc: 98.28%  
    Batch 3300/9224 | Loss: 0.0460 | Acc: 98.29%  
    Batch 3400/9224 | Loss: 0.0489 | Acc: 98.29%  
    Batch 3500/9224 | Loss: 0.0545 | Acc: 98.28%  
💾 Saved \+ Synced: checkpoint\_epoch4\_batch3500.pt  
    Batch 3600/9224 | Loss: 0.0570 | Acc: 98.27%  
    Batch 3700/9224 | Loss: 0.0523 | Acc: 98.27%  
    Batch 3800/9224 | Loss: 0.0559 | Acc: 98.27%  
    Batch 3900/9224 | Loss: 0.0488 | Acc: 98.27%  
    Batch 4000/9224 | Loss: 0.0514 | Acc: 98.27%  
💾 Saved \+ Synced: checkpoint\_epoch4\_batch4000.pt  
    Batch 4100/9224 | Loss: 0.0507 | Acc: 98.28%  
    Batch 4200/9224 | Loss: 0.0524 | Acc: 98.28%  
    Batch 4300/9224 | Loss: 0.0543 | Acc: 98.28%  
    Batch 4400/9224 | Loss: 0.0462 | Acc: 98.28%  
    Batch 4500/9224 | Loss: 0.0639 | Acc: 98.27%  
💾 Saved \+ Synced: checkpoint\_epoch4\_batch4500.pt  
    Batch 4600/9224 | Loss: 0.0562 | Acc: 98.27%  
    Batch 4700/9224 | Loss: 0.0451 | Acc: 98.27%  
    Batch 4800/9224 | Loss: 0.0536 | Acc: 98.28%  
    Batch 4900/9224 | Loss: 0.0575 | Acc: 98.28%  
    Batch 5000/9224 | Loss: 0.0589 | Acc: 98.27%  
💾 Saved \+ Synced: checkpoint\_epoch4\_batch5000.pt  
    Batch 5100/9224 | Loss: 0.0488 | Acc: 98.28%  
    Batch 5200/9224 | Loss: 0.0541 | Acc: 98.27%  
    Batch 5300/9224 | Loss: 0.0520 | Acc: 98.27%  
    Batch 5400/9224 | Loss: 0.0553 | Acc: 98.27%  
    Batch 5500/9224 | Loss: 0.0529 | Acc: 98.27%  
💾 Saved \+ Synced: checkpoint\_epoch4\_batch5500.pt  
    Batch 5600/9224 | Loss: 0.0505 | Acc: 98.27%  
    Batch 5700/9224 | Loss: 0.0542 | Acc: 98.27%  
    Batch 5800/9224 | Loss: 0.0540 | Acc: 98.27%  
    Batch 5900/9224 | Loss: 0.0490 | Acc: 98.27%  
    Batch 6000/9224 | Loss: 0.0580 | Acc: 98.27%  
💾 Saved \+ Synced: checkpoint\_epoch4\_batch6000.pt  
    Batch 6100/9224 | Loss: 0.0488 | Acc: 98.27%  
    Batch 6200/9224 | Loss: 0.0419 | Acc: 98.27%  
    Batch 6300/9224 | Loss: 0.0443 | Acc: 98.28%  
    Batch 6400/9224 | Loss: 0.0449 | Acc: 98.28%  
    Batch 6500/9224 | Loss: 0.0494 | Acc: 98.28%  
💾 Saved \+ Synced: checkpoint\_epoch4\_batch6500.pt  
    Batch 6600/9224 | Loss: 0.0418 | Acc: 98.28%  
    Batch 6700/9224 | Loss: 0.0485 | Acc: 98.28%  
    Batch 6800/9224 | Loss: 0.0423 | Acc: 98.29%  
    Batch 6900/9224 | Loss: 0.0537 | Acc: 98.29%  
    Batch 7000/9224 | Loss: 0.0477 | Acc: 98.29%  
💾 Saved \+ Synced: checkpoint\_epoch4\_batch7000.pt  
    Batch 7100/9224 | Loss: 0.0543 | Acc: 98.29%  
    Batch 7200/9224 | Loss: 0.0548 | Acc: 98.29%  
    Batch 7300/9224 | Loss: 0.0596 | Acc: 98.29%  
    Batch 7400/9224 | Loss: 0.0414 | Acc: 98.29%  
    Batch 7500/9224 | Loss: 0.0397 | Acc: 98.30%  
💾 Saved \+ Synced: checkpoint\_epoch4\_batch7500.pt  
    Batch 7600/9224 | Loss: 0.0430 | Acc: 98.30%  
    Batch 7700/9224 | Loss: 0.0531 | Acc: 98.30%  
    Batch 7800/9224 | Loss: 0.0510 | Acc: 98.30%  
    Batch 7900/9224 | Loss: 0.0471 | Acc: 98.30%  
    Batch 8000/9224 | Loss: 0.0475 | Acc: 98.30%  
💾 Saved \+ Synced: checkpoint\_epoch4\_batch8000.pt  
    Batch 8100/9224 | Loss: 0.0445 | Acc: 98.31%  
    Batch 8200/9224 | Loss: 0.0529 | Acc: 98.31%  
    Batch 8300/9224 | Loss: 0.0520 | Acc: 98.31%  
    Batch 8400/9224 | Loss: 0.0561 | Acc: 98.31%  
    Batch 8500/9224 | Loss: 0.0458 | Acc: 98.31%  
💾 Saved \+ Synced: checkpoint\_epoch4\_batch8500.pt  
    Batch 8600/9224 | Loss: 0.0466 | Acc: 98.31%  
    Batch 8700/9224 | Loss: 0.0516 | Acc: 98.31%  
    Batch 8800/9224 | Loss: 0.0360 | Acc: 98.32%  
    Batch 8900/9224 | Loss: 0.0417 | Acc: 98.32%  
    Batch 9000/9224 | Loss: 0.0546 | Acc: 98.32%  
💾 Saved \+ Synced: checkpoint\_epoch4\_batch9000.pt  
    Batch 9100/9224 | Loss: 0.0415 | Acc: 98.32%  
    Batch 9200/9224 | Loss: 0.0501 | Acc: 98.33%

⏱️  Epoch time: 982.55s  
📉 Train Loss: 0.0509 | Train Acc: 98.33%

🔍 Evaluating...  
/tmp/ipykernel\_3155/2410752472.py:291: FutureWarning: \`torch.cuda.amp.autocast(args...)\` is deprecated. Please use \`torch.amp.autocast('cuda', args...)\` instead.  
  with autocast():

\============================================================  
📊 Validation Results \- Epoch 5  
\============================================================  
F1 Score: 0.9803 | Accuracy: 0.9825

              precision    recall  f1-score   support

      Benign       0.99      0.98      0.98     25000  
    Phishing       0.97      0.98      0.98     25000  
     Malware       0.99      0.95      0.97      4729  
  Defacement       0.99      1.00      0.99     19062

    accuracy                           0.98     73791  
   macro avg       0.98      0.98      0.98     73791  
weighted avg       0.98      0.98      0.98     73791

💾 🏆 New best model saved\! F1: 0.9803  
💾 Saved \+ Synced: checkpoint\_epoch5\_batch0.pt

\============================================================  
🎉 Training Complete\!  
\============================================================  
🏆 Best F1 Score: 0.9803  
💾 Best model saved at: /content/drive/MyDrive/phishing\_checkpoints/best\_url\_model.pt  
📁 Checkpoints saved in: /content/checkpoints

# Multi-Modal Attachment Phishing Detection Strategy (2024-2025)

## 1\. Overview: What Exactly Are We Doing?

Instead of training a single, massive neural network to understand every file format in existence (which is computationally expensive and slow), we are building a **Multi-Modal Attachment Orchestrator**.  
This approach acts as a "smart disassembler." It opens the attachment, extracts the malicious components (Text, URLs, Scripts, Images), and **delegates** them to the specialized AI models we have already built (Text Model, URL Model, Image Model).  
This is formally known in Machine Learning as a **Late Fusion Ensemble Architecture**.

## 2\. The Architectural Flow

1. **File Type Verification:** The system uses "magic bytes" to determine the true file type, preventing attackers from disguising a .exe malware as an invoice.pdf.  
2. **Specialized Extraction:**  
   * **PDFs:** Extracts hidden text, clickable URLs, and flags embedded JavaScript.  
   * **Office Docs (.docx, .xlsx):** Uses oletools to scan for malicious VBA Macros (the most common ransomware delivery method) and extracts readable text/links.  
   * **HTML Attachments:** Parses for credential-harvesting forms and hidden scripts.  
   * **Images:** Sent directly to the existing Image Phishing Model.  
3. **AI Delegation (Reusability):**  
   * Extracted **Text** → Sent to our DistilBERT General Text Model.  
   * Extracted **URLs** → Sent to our URL Phishing Model.  
4. **Threat Scoring (Late Fusion):** The Orchestrator calculates a final "Malicious Probability Score" based on the combined outputs of the macro analysis, text model, and URL model.

## 3\. Why This is the Most Optimized & Scalable Solution

* **Zero Redundancy:** We don't waste time retraining a model to read text inside a PDF when our PhishingDetectorText model is already an expert at detecting phishing text.  
* **Ultra-Low Latency:** Content extraction takes milliseconds. By feeding only the extracted strings to our FastAPI endpoints, we maintain real-time performance.  
* **Future-Proof:** If we upgrade our URL model next year, the Attachment Engine automatically gets smarter without needing any updates.

## 4\. Academic References (2023-2025)

This approach is backed by the latest state-of-the-art research in cybersecurity machine learning:

1. **"Multimodal Ensemble Approach for Phishing Detection" (2023-2024 Trends)**  
   * *Concept:* Research shows that analyzing the Email Body \+ Headers \+ Attachments independently and fusing the results (Ensemble) achieves significantly higher AUC scores (often \>0.99) than trying to process the raw email file as a single data block.  
2. **"Late Fusion Architecture for Phishing Detection" (Preprints 2024\)**  
   * *Concept:* Demonstrates that using independent, specialized models for different data types (e.g., CodeBERT for HTML/Scripts, NLP Transformers for Text, EfficientNet for Images) and combining their predictions via weighted voting is the most robust way to handle zero-day phishing attacks.  
3. **"PhishAgent: A Robust Multimodal Agent for Phishing Detection" (AAAI 2024\)**  
   * *Concept:* Highlights the necessity of multi-modal analysis (combining text semantics with visual brand recognition and structural data) to defeat modern, AI-generated phishing campaigns that bypass traditional static filters.

## 5\. Next Steps for Implementation

To build this, we will write a single python script (e.g., attachment\_orchestrator.py) utilizing:

* python-magic (File identification)  
* PyMuPDF / pdfminer (PDF extraction)  
* oletools (VBA Macro detection in Office files)  
* BeautifulSoup (HTML parsing)

I actually like the direction you're taking because **you're no longer building a phishing detector**. You're building an **AI Security Copilot** for web browsing. The important thing is that AI shouldn't interrupt users every second. It should only become "smart" when needed.

---

# **1\. Explainable AI (XAI) Module**

I wouldn't run XAI on every request because LLMs are expensive (even local ones).

Instead, make it **on-demand**.

## **Workflow**

User visits website

↓

Quick Scan

↓

Risk \= 81%

↓

"⚠ Suspicious Website"

↓

\[Continue\]  
\[View Details\]  
\[Explain with AI\]

If the user clicks **Explain with AI**,

then the extension sends the collected evidence to the XAI service.

Not the whole webpage.

Only:

URL

Domain

Risk Features

Images detected

Forms detected

JS Behaviour

Text Summary

Screenshot (optional)

Cookies Metadata

Redirection Chain

The AI returns something like

---

### **Why is this website risky?**

Risk Score : 91%

Main Reasons

✓ Domain registered 5 days ago

✓ Login page imitates Microsoft

✓ Uses urgency phrases

✓ Redirect chain detected

✓ Hidden iframe found

✓ Brand logo mismatch

✓ Requests password before identity verification

Likelihood

Credential Harvesting

---

Then

Explain Further

can answer

> Why is domain age important?

or

> Why did you think this was Microsoft?

or

> Show suspicious elements.

Now it becomes an AI assistant rather than only an AI classifier.

---

# **2\. Dashboard XAI**

This is where it becomes even more useful.

SOC analysts don't want just a risk score.

They want

Event

↓

Explain

↓

Evidence

↓

Recommendation

↓

MITRE Mapping

↓

IOC

↓

Action

Example

Website

paypal-login-support.xyz

AI Explanation

This website impersonates PayPal.

Evidence

Logo Similarity : 96%

Domain Age : 3 Days

TLS Certificate : Self Signed

Hidden Login Form

Recommendation

Block Domain

Notify Employees

Add to Blacklist

---

# **3\. Database Design (Very Important)**

Don't store everything.

Store **events**, not browsing history.

Bad idea

Every mouse movement

Every image

Every HTML

Entire webpage

Entire JS

Entire cookies

Storage explodes.

Instead

Store

User

Time

Domain

URL

Risk Score

Threat Type

Decision

Features Used

Detection Time

Policy Applied

Organization

Device ID

If XAI was requested

Store

Explanation ID

Evidence Summary

Prompt Version

LLM Response

Timestamp

Only store the explanation if someone actually requested it.

---

# **4\. Event-Based Storage**

Think like Windows Defender.

If I visit

google.com

Nothing happens.

No event.

If I visit

microsoft-login-security.xyz

Store

Website Event

If I download

invoice.exe

Store

Download Event

If I submit password

Store

Credential Protection Event

This reduces storage dramatically.

---

# **5\. Dashboard Performance**

One mistake many projects make:

SELECT \*

FROM EVENTS

Imagine

5000 users

100 websites/day

\=

500,000 records/day

One year

180 Million

Dashboard becomes unusable.

Instead

Store in layers.

## **Hot Storage**

Last

7 Days

Fast

Redis

or PostgreSQL indexes

---

## **Warm Storage**

1 Month

6 Months

PostgreSQL

---

## **Cold Storage**

Older than

6 months

Archive

Compressed

Used only for reports.

---

Dashboard only loads

Today's Events

Top Threats

Recent Alerts

Current Statistics

Never entire database.

---

# **6\. Feature Cache**

If 300 employees visit

google.com

Don't analyze it 300 times.

Instead

Employee A

↓

AI Scan

↓

Cache Result

Next employees

Cache

↓

5ms Response

Huge performance improvement.

---

# **7\. Risk Calculation**

Instead of

AI says 92%

Build a weighted engine.

Example

| Feature | Weight |
| ----- | ----- |
| URL | 20 |
| Domain Reputation | 20 |
| Login Form | 10 |
| OCR | 10 |
| Images | 10 |
| JS Behaviour | 10 |
| Cookies | 5 |
| Redirects | 10 |
| SSL | 5 |

Total

Risk

↓

Explainability

↓

AI

Now every score becomes explainable.

---

# **8\. Final Feature List**

I think this is the complete browser security module.

## **Search Protection**

**1\. Search Result Risk Score**

* Shows a risk badge beside every search result.  
* *Example:* Google search displays "Safe 8%" or "High Risk 91%" before you click.

**2\. AI Explanation**

* Click "Explain" to understand why a site is considered risky.  
* *Example:* "The domain is new, imitates Microsoft, and contains a hidden login form."

---

## **Website Protection**

**3\. Navigation-Time URL Scan**

* Scans the destination while the page is opening.

**4\. Website Reputation Check**

* Uses local cache and AI reputation.

**5\. Redirect Detection**

* Detects suspicious redirect chains.

**6\. SSL/TLS Validation**

* Warns about certificate problems.

---

## **Content Protection**

**7\. Webpage Text Analysis**

* Detects phishing language and social engineering.

**8\. Login Form Detection**

* Finds suspicious login pages.

**9\. Credential Protection**

* Warns before passwords are submitted to suspicious websites.

**10\. Image Analysis**

* Detects fake logos and suspicious visual content.

**11\. OCR Analysis**

* Reads text embedded inside images.

**12\. QR Code Detection**

* Scans QR codes embedded on websites.

**13\. Brand Impersonation Detection**

* Compares page branding with the actual domain.

---

## **Technical Protection**

**14\. JavaScript Behaviour Analysis**

* Detects obfuscated or malicious scripts.

**15\. Cookie Inspection**

* Flags suspicious cookie behaviour without reading sensitive values.

**16\. Hidden iFrame Detection**

* Detects invisible embedded phishing content.

**17\. External Resource Inspection**

* Reviews third-party scripts and resources loaded by the page.

---

## **User Protection**

**18\. Hover Link Analysis**

* Shows the real destination and risk before clicking.

**19\. Download Protection**

* Scans files before download completes.

**20\. Clipboard URL Protection**

* Warns when copied links appear suspicious.

**21\. Right-Click AI Scan**

* Lets users manually scan selected text, links, or images.

**22\. Explain with AI (XAI)**

* Provides detailed reasoning only when requested.

---

## **Enterprise Features**

**23\. Organization Policies**

* Custom allowlists, blocklists, and warning lists.

**24\. Threat Reporting**

* Employees can report suspicious websites with one click.

**25\. SOC Dashboard Integration**

* Sends security events to the central dashboard.

**26\. Event Timeline**

* Shows what happened, when, and what action was taken.

**27\. Threat Intelligence Sync**

* Shares newly discovered phishing indicators across the organization.

**28\. Local Cache**

* Avoids rescanning trusted websites, improving speed.

**29\. Multi-Tenant Support**

* Keeps every organization's data isolated while using the same platform.

---

## **Overall Vision**

If we step back and look at the entire project, you'll end up with three tightly integrated layers:

* **Email Security** – Protects users before they click phishing links in emails.  
* **Browser Security Agent** – Protects users while they browse the web.  
* **SOC & AI Dashboard** – Gives administrators visibility, explainability, incident management, and policy control.

That makes the platform much stronger than a traditional phishing detector. Instead of protecting just one entry point (email), it continuously reduces phishing risk across the user's daily workflow while keeping the heavy AI processing centralized and the browser extension lightweight. I think this architecture is strong enough for both a serious FYP and a product that could evolve into an enterprise cybersecurity platform.

