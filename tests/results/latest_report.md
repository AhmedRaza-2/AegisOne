# AegisOne Real-World Extension Test Report (HOLDOUT DATASET)

## 1. CLASSIFIER DETECTION QUALITY (ON COMPLETED SCANS)
- Evaluated Completed Samples: 9
- True Positives (TP): 6
- True Negatives (TN): 3
- False Positives (FP): 0
- False Negatives (FN): 0
- **Precision**: 100.0%
- **Recall**: 100.0%
- **F1-Score**: 100.0%
- **False Positive Rate (FPR)**: 0.0%
- **False Negative Rate (FNR)**: 0.0%

## 2. SYSTEM & PIPELINE RELIABILITY
- Total Attempted URLs: 9
- **Verdict Completion Rate**: 100.0% *(Final SAFE/WARN/BLOCK produced)*
- **Full Multimodal Completion Rate**: 100.0% *(URL + DOM available)*
- **URL-only Degradation Rate**: 0.0% *(DOM failed but URL analysis completed)*
- **Navigation Failure Rate**: 0.0% *(Could not process at all)*


## 3. SAFE TESTING BY CATEGORY
| Category | Total Tested | Passed | False Positives | Timeouts/Errors | Pass Rate |
| :--- | :--- | :--- | :--- | :--- | :--- |
| technology | 1 | 1 | 0 | 0 | 100.0% |
| e-commerce | 1 | 1 | 0 | 0 | 100.0% |
| saas | 1 | 1 | 0 | 0 | 100.0% |

## SAFE TESTING OVERVIEW
- Total Safe URLs Tested: 3
- Safe Pass (Verdict Safe): 3
- False Positives: 0
- Timeouts (Navigation/Scan): 0
- Errors: 0
- Unverified: 0

### Non-Passing Safe URLs:
None

## PHISHING DATASET
- Total Phishing URLs: 6
- True Positives (Detected): 6
- False Negatives (Missed): 0

## CONFUSION MATRIX (CLASSIFIER ONLY)
| | Predicted Phishing | Predicted Safe |
| :--- | :--- | :--- |
| **Actual Phishing (6)** | **6** (TP) | **0** (FN) |
| **Actual Safe (3)** | **0** (FP) | **3** (TN) |

## DYNAMIC FALSE POSITIVE DIAGNOSTIC & TELEMETRY TRACES
| URL | Status | Primary Decision Trace Factors |
| :--- | :--- | :--- |
| None | - | - |

## PERFORMANCE BREAKDOWN (STAGE LATENCIES)
- Page Navigation & DOM Acquisition P95: 4373.4 ms  *(Browser network load & DOM rendering)*
- AegisOne L3 API Scan P95: 6518.8 ms  *(Feature extraction & L3 risk engine decision)*
- Total End-to-End P95: 7923.4 ms  *(User-perceived scan completion latency)*
