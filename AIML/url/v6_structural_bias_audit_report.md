# AegisOne V6 Structural Bias Audit & Challenge Set Evaluation

**Audit Date:** 2026-09-25  
**Audited Datasets:** `v6_train.csv` (91,231 rows), `v6_val.csv` (9,165 rows), `v6_test.csv` (12,588 rows)  
**Evaluated Model Checkpoint:** `AIML/url/best_v6.pt`

---

## Executive Summary

A comprehensive forensic audit of the **V6 dataset splits and model checkpoint** confirms the user's diagnosis: **V6 is not deployment-ready**.

While V6 achieved **98.90% test accuracy** on `v6_test.csv`, this performance is an artifact of **identical structural bias** across the train, val, and test splits:
- **90.96% of benign training URLs** are raw apex domains (`http://google.com`), and **0.00% contain `www` or subdomains**.
- **80.47% of malicious training URLs** contain paths, and **54.04% contain subdomains**.
- As a result, V6 learned a structural shortcut rather than URL semantics:
  $$\text{Apex domain} \implies \text{BENIGN} \quad \Big| \quad \text{Subdomain or Path or } \texttt{www.} \implies \text{MALICIOUS}$$

---

## 1. Quantitative Structural Audit of Dataset Splits

We audited the structural composition across `v6_train.csv`, `v6_val.csv`, and `v6_test.csv`:

| Structural Metric | Benign Train (%) | Malicious Train (%) | Benign Val (%) | Malicious Val (%) | Benign Test (%) | Malicious Test (%) |
| :--- | :---: | :---: | :---: | :---: | :---: | :---: |
| **Apex Domain %** | **90.96%** | **1.92%** | **90.75%** | **3.45%** | **90.67%** | **1.83%** |
| **Has `www` %** | **0.00%** | **2.73%** | **0.00%** | **5.48%** | **0.00%** | **1.96%** |
| **Has Subdomain (excl `www`) %** | **0.00%** | **51.31%** | **0.00%** | **39.48%** | **0.00%** | **18.77%** |
| **Has `/path` %** | **9.04%** | **80.47%** | **9.25%** | **68.77%** | **9.33%** | **84.20%** |
| **Has Query String %** | **0.54%** | **14.20%** | **0.54%** | **6.03%** | **0.54%** | **2.26%** |
| **Has Deep Path ($\ge 3$ seg) %** | **1.05%** | **19.33%** | **1.14%** | **6.27%** | **1.16%** | **2.86%** |

### Key Takeaway
The `v6_test.csv` dataset contains the **exact same structural imbalance** as `v6_train.csv`. High test set accuracy (98.90%) is driven by the fact that 90.67% of benign test URLs are bare apex domains, masking the model's inability to evaluate legitimate deep paths and subdomains.

---

## 2. Balanced Structural Challenge Set Evaluation

We constructed a balanced challenge set covering all structural archetypes and evaluated `best_v6.pt`:

### Category Breakdown & Error Rates

| Category | Type | Count | Metric | Error Rate | Accuracy | Tested URLs & V6 Behavior |
| :--- | :---: | :---: | :---: | :---: | :---: | :--- |
| **`benign_apex`** | Benign | 7 | FPR | **0.0%** | **100.0%** | `google.com`, `microsoft.com`, `cisco.com` ✅ (Passed) |
| **`benign_www`** | Benign | 6 | FPR | **100.0%** | **0.0%** | `www.google.com`, `www.microsoft.com` ❌ (**All Phishing**) |
| **`benign_subdomain`** | Benign | 5 | FPR | **100.0%** | **0.0%** | `accounts.google.com`, `login.microsoft.com` ❌ (**All Phishing**) |
| **`benign_path`** | Benign | 4 | FPR | **50.0%** | **50.0%** | `microsoft.com/security/` ✅, `paypal.com/login` ❌ |
| **`benign_deep_path`** | Benign | 5 | FPR | **100.0%** | **0.0%** | `wikipedia.org/wiki/Phishing`, `github.com/torvalds/linux` ❌ |
| **`malicious_apex_impersonation`** | Malicious | 3 | FNR | **100.0%** | **0.0%** | `google-login-verify.com` ❌ (**Missed as Benign!**) |
| **`malicious_subdomain`** | Malicious | 4 | FNR | **0.0%** | **100.0%** | `google.com.attacker.com/login` ✅ (Caught) |
| **`malicious_path` / `deep_path`** | Malicious | 2 | FNR | **0.0%** | **100.0%** | `attacker.com/google/login` ✅ (Caught) |
| **`malicious_saas_abuse`** | Malicious | 1 | FNR | **0.0%** | **100.0%** | `docs.google.com/forms/d/e/.../viewform` ✅ (Caught) |

---

## 3. Major Findings

1. **The `www.` Flip**:
   - `google.com` $\rightarrow$ **`BENIGN`** (0.0005 malicious probability)
   - `www.google.com` $\rightarrow$ **`PHISHING`** (0.9999 malicious probability)
   - *Proof*: V6 flips to `PHISHING` simply due to the presence of `www.` or subdomains.

2. **Apex Malicious Blindspot**:
   - `https://google-login-verify.com` (a bare apex phishing domain) $\rightarrow$ **`BENIGN`** (0.0431 malicious probability).
   - Because V6 learned that bare apex domains are benign, malicious apex domains bypass detection.

3. **Validation / Test Metric Illusion**:
   - Training checkpoint selection based on validation loss on `v6_val.csv` selected Epoch 7, which was heavily optimized for apex domain separation rather than true semantic path modeling.

---

## 4. Remediation Plan for V7 Construction

To resolve this issue naturally at the dataset level without adding brand allowlist hacks:

1. **Ingest Legitimate Subdomains & Deep Sub-pages**:
   - Pull legitimate subdomains (`www.domain.com`, `subdomain.domain.com`) from Tranco / Open Page Rank.
   - Crawl deep legitimate sub-paths from Wikipedia, Common Crawl, documentation sites, and top web properties (`/wiki/...`, `/docs/...`, `/security/`, `/about`, `/contact`).
2. **Reflect Real-World Structural Distribution**:
   - Construct `v7_train.csv` such that benign URLs reflect real-world structural diversity:
     - 35% Apex domains (`domain.com`)
     - 30% `www.` prefixed domains (`www.domain.com`)
     - 15% Subdomains (`accounts.domain.com`, `docs.domain.com`)
     - 20% Deep sub-paths (`domain.com/path/to/resource`)
3. **Include Malicious Apex Impersonation**:
   - Include 10,000+ bare apex malicious domains (`brand-login-verify.com`) in the training feed so the model learns lexical and TLD intent rather than relying on path presence.
4. **Structural Challenge Benchmarking**:
   - Evaluate V7 against the **Balanced Structural Challenge Set** as part of checkpoint validation before accepting any model.
