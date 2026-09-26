# AegisOne V7 Dataset Quality & Structural Audit Report

**Build Date:** 2026-09-25 14:50:58  
**Target Architecture:** V7 3-Class Model (`0 = Benign`, `1 = Phishing`, `2 = Malware`)  
**Core Objective:** Real-world structural representation for benign URLs (apex, `www`, subdomains, deep paths, query strings) eliminating V6 path-presence shortcut without hardcoding brand allowlists.

---

## 1. Dataset Overview & Split Metrics

| Dataset Split | Total Rows | Benign Count | Phishing Count | Malware Count | Unique Domains |
| :--- | :---: | :---: | :---: | :---: | :---: |
| **Train Set (`v7_train.csv`)** | 109,773 | 64,599 | 45,173 | 1 | 43,111 |
| **Val Set (`v7_val.csv`)** | 13,721 | 9,093 | 4,628 | 0 | 7,061 |
| **Test Set (`v7_test.csv`)** | 13,723 | 5,885 | 7,838 | 0 | 4,332 |

---

## 2. Structural Breakdown Comparison (V6 vs V7)

### Benign URLs Structural Distribution (V7 Train Set)

| Structural Category | V6 Benign Train (%) | **V7 Benign Train (%)** | **V7 Real-World Alignment** |
| :--- | :---: | :---: | :--- |
| **Apex Domain %** | 90.96% | **35.99%** | Covered |
| **Has `www.` %** | 0.00% | **4.90%** | **Ingested (Fixed 0% bug)** |
| **Has Subdomain %** | 0.00% | **18.36%** | **Ingested (Fixed 0% bug)** |
| **Has `/path` %** | 9.04% | **61.15%** | **Ingested (Fixed 9% bug)** |
| **Has Query %** | 0.54% | **8.98%** | Ingested |
| **Has Deep Path %** | 1.05% | **21.56%** | Ingested |

---

## 3. Mandatory Safety & Hygiene Audits

1. **Benchmark Exclusion Standard**: Exact 400 frozen external benchmark URLs excluded. **[PASSED]**
2. **Domain-Disjoint Splitting**: 0 registrable domain overlap across Train, Val, and Test sets. **[PASSED]**
3. **Canonicalization Alignment**: All URLs processed through unified `canonicalize_url()`. **[PASSED]**
4. **Zero Allowlist Invariant**: Zero brand allowlists or pass-through rules inserted. **[PASSED]**
