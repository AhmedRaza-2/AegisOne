# AegisOne V6 3-Class Training & Evaluation Report

**Build Timestamp:** 2026-09-25 08:55:06  
**Best Checkpoint Epoch:** Epoch 7 (Val Loss: 0.0551)

## 1. Epoch-by-Epoch Training & Validation Log

| Epoch | Time | Train Loss | Val Loss | Accuracy | Macro F1 | Benign FPR | Malicious FNR | Benign F1 | Phishing F1 | Malware F1 |
| :---: | :---: | :---: | :---: | :---: | :---: | :---: | :---: | :---: | :---: | :---: |
| 1 | 458.6s | 0.2757 | 0.0907 | 97.53% | 0.9668 | 0.16% | 3.51% | 0.9877 | 0.9558 | 0.9569 |
| 2 | 467.2s | 0.0617 | 0.0704 | 98.13% | 0.9778 | 0.05% | 3.37% | 0.9887 | 0.9664 | 0.9782 |
| 3 | 467.7s | 0.0513 | 0.0621 | 98.32% | 0.9793 | 0.22% | 2.63% | 0.9903 | 0.9701 | 0.9775 |
| 4 | 467.3s | 0.0454 | 0.0603 | 98.39% | 0.9815 | 0.09% | 3.01% | 0.9897 | 0.9710 | 0.9838 |
| 5 | 467.2s | 0.0416 | 0.0587 | 98.46% | 0.9819 | 0.09% | 2.77% | 0.9905 | 0.9725 | 0.9827 |
| 6 | 467.4s | 0.0395 | 0.0611 | 98.41% | 0.9809 | 0.16% | 2.68% | 0.9904 | 0.9716 | 0.9808 |
| 7 | 467.0s | 0.0371 | 0.0551 | 98.58% | 0.9842 | 0.13% | 2.68% | 0.9906 | 0.9747 | 0.9875 |
| 8 | 467.2s | 0.0361 | 0.0586 | 98.46% | 0.9823 | 0.13% | 2.79% | 0.9902 | 0.9725 | 0.9842 |

---
## 2. Independent Test Set Results (`v6_test.csv`)

- **Accuracy**: 98.90%
- **Macro F1**: 0.9886
- **Benign False Positive Rate (FPR)**: **0.21%**
- **Malicious False Negative Rate (FNR)**: **1.40%**

## 3. Semantic Hard-URL Benchmark Suite Results

| Tested URL | Predicted Class | P(benign) | P(phishing) | P(malware) | P(malicious total) |
| :--- | :---: | :---: | :---: | :---: | :---: |
| `https://google.com` | **BENIGN (0)** | 0.9995 | 0.0005 | 0.0000 | **0.0005** |
| `https://www.google.com` | **PHISHING (1)** | 0.0001 | 0.9998 | 0.0001 | **0.9999** |
| `https://accounts.google.com/login` | **PHISHING (1)** | 0.0000 | 0.9999 | 0.0001 | **1.0000** |
| `https://paypal.com/login` | **PHISHING (1)** | 0.0000 | 0.9996 | 0.0004 | **1.0000** |
| `https://login.microsoft.com` | **PHISHING (1)** | 0.0000 | 0.9999 | 0.0001 | **1.0000** |
| `https://microsoft.com/security/` | **BENIGN (0)** | 0.9983 | 0.0017 | 0.0000 | **0.0017** |
| `https://cisco.com` | **BENIGN (0)** | 0.9989 | 0.0011 | 0.0000 | **0.0011** |
| `https://google.com.attacker-domain.com/login` | **PHISHING (1)** | 0.0000 | 0.9999 | 0.0001 | **1.0000** |
| `https://paypal-login-verify.attacker.com/auth` | **PHISHING (1)** | 0.0000 | 0.9997 | 0.0003 | **1.0000** |
| `https://docs.google.com/forms/d/e/1FAIpQLSc9nDf52Db7I0r8OD0yH0tL3ciU9YNr1C3lnXE59tREON6_Q/viewform` | **PHISHING (1)** | 0.0000 | 0.9999 | 0.0001 | **1.0000** |