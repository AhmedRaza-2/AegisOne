# AegisOne Real-World Extension Test Report

## SAFE TESTING BY CATEGORY
| Category | Total Tested | Passed | False Positives | Timeouts/Errors | Pass Rate |
| :--- | :--- | :--- | :--- | :--- | :--- |
| search_engine | 1 | 1 | 0 | 0 | 100.0% |
| developer_tools | 1 | 1 | 0 | 0 | 100.0% |
| knowledge | 4 | 4 | 0 | 0 | 100.0% |
| technology | 4 | 3 | 0 | 1 | 75.0% |
| e-commerce | 1 | 1 | 0 | 0 | 100.0% |
| developer_forum | 1 | 1 | 0 | 0 | 100.0% |
| social_media | 3 | 3 | 0 | 0 | 100.0% |
| media_streaming | 4 | 4 | 0 | 0 | 100.0% |
| cloud_storage | 1 | 0 | 1 | 0 | 0.0% |
| saas_communication | 2 | 2 | 0 | 0 | 100.0% |
| news | 8 | 3 | 3 | 2 | 37.5% |
| blog_platform | 2 | 1 | 0 | 1 | 50.0% |
| information | 1 | 0 | 0 | 1 | 0.0% |
| entertainment | 1 | 1 | 0 | 0 | 100.0% |
| government | 2 | 2 | 0 | 0 | 100.0% |
| university | 3 | 3 | 0 | 0 | 100.0% |
| banking | 4 | 3 | 1 | 0 | 75.0% |
| documentation | 2 | 2 | 0 | 0 | 100.0% |
| saas | 1 | 1 | 0 | 0 | 100.0% |
| saas_management | 2 | 0 | 2 | 0 | 0.0% |
| media_sharing | 2 | 0 | 1 | 1 | 0.0% |

## SAFE TESTING OVERVIEW
- Total Safe URLs Tested: 50
- Safe Pass (Verdict Safe): 36
- False Positives: 8
- Timeouts (Navigation/Scan): 4
- Errors: 2
- Unverified: 0

### Non-Passing Safe URLs:
- https://www.microsoft.com: NAVIGATION_TIMEOUT
- https://www.dropbox.com: FALSE_POSITIVE
- https://www.nytimes.com: FALSE_POSITIVE
- https://www.bbc.com/news: FALSE_POSITIVE
- https://www.cnn.com: NAVIGATION_TIMEOUT
- https://weather.com: SCAN_TIMEOUT
- https://www.bankofamerica.com: FALSE_POSITIVE
- https://trello.com: FALSE_POSITIVE
- https://asana.com: FALSE_POSITIVE
- https://www.tumblr.com: NAVIGATION_ERROR
- https://www.flickr.com: NAVIGATION_ERROR
- https://imgur.com: FALSE_POSITIVE
- https://www.forbes.com: FALSE_POSITIVE
- https://www.bloomberg.com: NAVIGATION_TIMEOUT

## PHISHING DATASET
- Total Phishing URLs: 50
- True Positives (Detected): 50
- False Negatives (Missed): 0

## COMBINED METRICS (BALANCED EVALUATION)
- True Positives (TP): 50
- True Negatives (TN): 36
- False Positives (FP): 8
- False Negatives (FN): 0
- Accuracy: 91.5%
- Precision: 86.2%
- Recall: 100.0%
- F1-Score: 92.6%
- False Positive Rate (FPR): 18.2%
- False Negative Rate (FNR): 0.0%

## FUNCTIONAL TESTS
- Credential Guard: Failed
- Warning UI Gating: Passed

## PERFORMANCE BREAKDOWN (P95 LATENCY)
- Page Navigation P95: 10092.4 ms
- L3 Scan P95: 12.5 ms
- Total Scan Completion P95: 10159.6 ms
