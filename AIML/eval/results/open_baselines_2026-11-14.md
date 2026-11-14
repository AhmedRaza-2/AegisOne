# Open-source baselines vs AegisOne - 2026-11-14

Same data for every model: 2498 genuine URLs (popular-site deep links + long-tail web) and 599 fresh OpenPhish URLs. Thresholds are set per model at the stated false-alarm budget on the pooled genuine URLs.

## Each model alone

- **AegisOne final** (ours): AUC 0.992 | caught @1% FPR 91.7% | @0.1% 32.9% | AP@1% 0.598
- **AegisOne neural only** (ours): AUC 0.800 | caught @1% FPR 58.8% | @0.1% 24.7% | AP@1% 0.460
- **ealvaradob/bert-finetuned-phishing** (apache-2.0): AUC 0.924 | caught @1% FPR 46.9% | @0.1% 3.0% | AP@1% 0.270
- **kmack/malicious-url-detection** (apache-2.0): AUC 0.957 | caught @1% FPR 52.3% | @0.1% 22.7% | AP@1% 0.432
- **imanoop7/bert-phishing-detector** (mit): AUC 0.587 | caught @1% FPR 0.0% | @0.1% 0.0% | AP@1% 0.013

## Does adding the open model to AegisOne help?

Baseline - AegisOne final alone: AUC 0.992 | caught @1% FPR 91.7% | @0.1% 32.9% | AP@1% 0.598

**+ ealvaradob/bert-finetuned-phishing**
- stacked (logistic, 5-fold out-of-fold): AUC 0.994 | caught @1% FPR 90.5% | @0.1% 32.9% | AP@1% 0.702  (caught @1% FPR -1.2 points)
- max of the two: AUC 0.976 | caught @1% FPR 49.2% | @0.1% 13.0% | AP@1% 0.389  (caught @1% FPR -42.4 points)
- mean of the two ranks: AUC 0.979 | caught @1% FPR 74.6% | @0.1% 44.4% | AP@1% 0.658  (caught @1% FPR -17.0 points)

**+ kmack/malicious-url-detection**
- stacked (logistic, 5-fold out-of-fold): AUC 0.994 | caught @1% FPR 92.3% | @0.1% 55.1% | AP@1% 0.805  (caught @1% FPR +0.7 points)
- max of the two: AUC 0.964 | caught @1% FPR 53.3% | @0.1% 27.0% | AP@1% 0.465  (caught @1% FPR -38.4 points)
- mean of the two ranks: AUC 0.990 | caught @1% FPR 81.5% | @0.1% 47.2% | AP@1% 0.711  (caught @1% FPR -10.2 points)

**+ imanoop7/bert-phishing-detector**
- stacked (logistic, 5-fold out-of-fold): AUC 0.992 | caught @1% FPR 87.3% | @0.1% 33.1% | AP@1% 0.674  (caught @1% FPR -4.3 points)
- max of the two: AUC 0.612 | caught @1% FPR 0.0% | @0.1% 0.0% | AP@1% 0.015  (caught @1% FPR -91.7 points)
- mean of the two ranks: AUC 0.856 | caught @1% FPR 23.9% | @0.1% 14.4% | AP@1% 0.197  (caught @1% FPR -67.8 points)