# AegisOne Real-World Extension Test Report

## 1. CLASSIFIER DETECTION QUALITY (ON COMPLETED SCANS)
- Evaluated Completed Samples: 100
- True Positives (TP): 50
- True Negatives (TN): 50
- False Positives (FP): 0
- False Negatives (FN): 0
- **Precision**: 100.0%
- **Recall**: 100.0%
- **F1-Score**: 100.0%
- **False Positive Rate (FPR)**: 0.0%
- **False Negative Rate (FNR)**: 0.0%

## 2. SYSTEM & PIPELINE RELIABILITY
- Total Attempted URLs: 100
- **Verdict Completion Rate**: 100.0% *(Final SAFE/WARN/BLOCK produced)*
- **Full Multimodal Completion Rate**: 98.0% *(URL + DOM available)*
- **URL-only Degradation Rate**: 2.0% *(DOM failed but URL analysis completed)*
- **Navigation Failure Rate**: 0.0% *(Could not process at all)*


## 3. SAFE TESTING BY CATEGORY
| Category | Total Tested | Passed | False Positives | Timeouts/Errors | Pass Rate |
| :--- | :--- | :--- | :--- | :--- | :--- |
| search_engine | 1 | 1 | 0 | 0 | 100.0% |
| developer_tools | 1 | 1 | 0 | 0 | 100.0% |
| knowledge | 4 | 4 | 0 | 0 | 100.0% |
| technology | 4 | 4 | 0 | 0 | 100.0% |
| e-commerce | 1 | 1 | 0 | 0 | 100.0% |
| developer_forum | 1 | 1 | 0 | 0 | 100.0% |
| social_media | 3 | 3 | 0 | 0 | 100.0% |
| media_streaming | 4 | 4 | 0 | 0 | 100.0% |
| cloud_storage | 1 | 1 | 0 | 0 | 100.0% |
| saas_communication | 2 | 2 | 0 | 0 | 100.0% |
| news | 8 | 8 | 0 | 0 | 100.0% |
| blog_platform | 2 | 2 | 0 | 0 | 100.0% |
| information | 1 | 1 | 0 | 0 | 100.0% |
| entertainment | 1 | 1 | 0 | 0 | 100.0% |
| government | 2 | 2 | 0 | 0 | 100.0% |
| university | 3 | 3 | 0 | 0 | 100.0% |
| banking | 4 | 4 | 0 | 0 | 100.0% |
| documentation | 2 | 2 | 0 | 0 | 100.0% |
| saas | 1 | 1 | 0 | 0 | 100.0% |
| saas_management | 2 | 2 | 0 | 0 | 100.0% |
| media_sharing | 2 | 2 | 0 | 0 | 100.0% |

## SAFE TESTING OVERVIEW
- Total Safe URLs Tested: 50
- Safe Pass (Verdict Safe): 50
- False Positives: 0
- Timeouts (Navigation/Scan): 0
- Errors: 0
- Unverified: 0

### Non-Passing Safe URLs:
None

## PHISHING DATASET
- Total Phishing URLs: 50
- True Positives (Detected): 50
- False Negatives (Missed): 0

## CONFUSION MATRIX (CLASSIFIER ONLY)
| | Predicted Phishing | Predicted Safe |
| :--- | :--- | :--- |
| **Actual Phishing (50)** | **50** (TP) | **0** (FN) |
| **Actual Safe (50)** | **0** (FP) | **50** (TN) |

## DYNAMIC FALSE POSITIVE DIAGNOSTIC & TELEMETRY TRACES
| URL | Status | Primary Decision Trace Factors |
| :--- | :--- | :--- |
| None | - | - |

## PERFORMANCE BREAKDOWN (STAGE LATENCIES)
- Page Navigation & DOM Acquisition P95: 3636.5 ms  *(Browser network load & DOM rendering)*
- AegisOne L3 API Scan P95: 312.5 ms  *(Feature extraction & L3 risk engine decision)*
- Total End-to-End P95: 8683.9 ms  *(User-perceived scan completion latency)*
