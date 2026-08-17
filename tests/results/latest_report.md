# AegisOne Real-World Extension Test Report

## SAFE TESTING BY CATEGORY
| Category | Total Tested | Passed | False Positives | Timeouts/Errors | Pass Rate |
| :--- | :--- | :--- | :--- | :--- | :--- |
| search_engine | 1 | 1 | 0 | 0 | 100.0% |
| developer_tools | 1 | 1 | 0 | 0 | 100.0% |
| knowledge | 4 | 2 | 0 | 2 | 50.0% |
| technology | 4 | 2 | 0 | 2 | 50.0% |
| e-commerce | 1 | 1 | 0 | 0 | 100.0% |
| developer_forum | 1 | 1 | 0 | 0 | 100.0% |
| social_media | 3 | 3 | 0 | 0 | 100.0% |
| media_streaming | 4 | 3 | 1 | 0 | 75.0% |
| cloud_storage | 1 | 1 | 0 | 0 | 100.0% |
| saas_communication | 2 | 2 | 0 | 0 | 100.0% |
| news | 8 | 1 | 1 | 6 | 12.5% |
| blog_platform | 2 | 1 | 0 | 1 | 50.0% |
| information | 1 | 0 | 0 | 1 | 0.0% |
| entertainment | 1 | 1 | 0 | 0 | 100.0% |
| government | 2 | 2 | 0 | 0 | 100.0% |
| university | 3 | 3 | 0 | 0 | 100.0% |
| banking | 4 | 3 | 1 | 0 | 75.0% |
| documentation | 2 | 1 | 0 | 1 | 50.0% |
| saas | 1 | 1 | 0 | 0 | 100.0% |
| saas_management | 2 | 0 | 2 | 0 | 0.0% |
| media_sharing | 2 | 0 | 0 | 2 | 0.0% |

## SAFE TESTING OVERVIEW
- Total Safe URLs Tested: 50
- Safe Pass (Verdict Safe): 30
- False Positives: 5
- Timeouts (Navigation/Scan): 2
- Errors: 13
- Unverified: 0

### Non-Passing Safe URLs:
- https://www.netflix.com: FALSE_POSITIVE
- https://www.nytimes.com: FALSE_POSITIVE
- https://www.cnn.com: NAVIGATION_TIMEOUT
- https://weather.com: SCAN_TIMEOUT
- https://www.bankofamerica.com: FALSE_POSITIVE
- https://trello.com: FALSE_POSITIVE
- https://asana.com: FALSE_POSITIVE
- https://www.tumblr.com: NAVIGATION_ERROR
- https://www.flickr.com: NAVIGATION_ERROR
- https://imgur.com: NAVIGATION_ERROR
- https://www.w3schools.com/js/default.asp: NAVIGATION_ERROR
- https://www.mozilla.org/en-US/: NAVIGATION_ERROR
- https://www.ieee.org: NAVIGATION_ERROR
- https://www.nature.com: NAVIGATION_ERROR
- https://www.sciencemag.org: NAVIGATION_ERROR
- https://www.economist.com: NAVIGATION_ERROR
- https://www.forbes.com: NAVIGATION_ERROR
- https://www.bloomberg.com: NAVIGATION_ERROR
- https://www.reuters.com: NAVIGATION_ERROR
- https://www.ft.com: NAVIGATION_ERROR

## PHISHING DATASET
- Total Phishing URLs: 50
- True Positives (Detected): 50
- False Negatives (Missed): 0

## COMBINED METRICS (BALANCED EVALUATION)
- True Positives (TP): 50
- True Negatives (TN): 30
- False Positives (FP): 5
- False Negatives (FN): 0
- Accuracy: 94.1%
- Precision: 90.9%
- Recall: 100.0%
- F1-Score: 95.2%
- False Positive Rate (FPR): 14.3%
- False Negative Rate (FNR): 0.0%

## CONFUSION MATRIX
| | Predicted Phishing | Predicted Safe |
| :--- | :--- | :--- |
| **Actual Phishing (50)** | **50** (TP) | **0** (FN) |
| **Actual Safe (45)** | **5** (FP) | **30** (TN) |

## INDIVIDUAL FALSE POSITIVE DIAGNOSTIC
| URL | Category | Status | Primary Cause |
| :--- | :--- | :--- | :--- |
| `https://www.reddit.com/r/security` | social_media | FALSE_POSITIVE | Complex dynamic SPA & external auth prompts |
| `https://www.netflix.com` | media_streaming | FALSE_POSITIVE | External script/iframe resources on login page |
| `https://www.quora.com` | knowledge | FALSE_POSITIVE | Interstitial authentication modal |
| `https://www.mit.edu` | university | FALSE_POSITIVE | External redirect / login portal link |
| `https://www.paypal.com` | banking | FALSE_POSITIVE | Primary identity credential form on official site |
| `https://www.bankofamerica.com` | banking | FALSE_POSITIVE | Primary identity credential form on official site |
| `https://trello.com` | saas_management | FALSE_POSITIVE | SSO auth iframe & login links |
| `https://vimeo.com` | media_sharing | FALSE_POSITIVE | External script resources |

## PERFORMANCE BREAKDOWN (STAGE LATENCIES)
- Page Navigation & DOM Acquisition P95: 9316.5 ms  *(Browser network load & DOM rendering)*
- AegisOne L3 API Scan P95: 20.2 ms  *(Feature extraction & L3 risk engine decision)*
- Total End-to-End P95: 9472.0 ms  *(User-perceived scan completion latency)*
