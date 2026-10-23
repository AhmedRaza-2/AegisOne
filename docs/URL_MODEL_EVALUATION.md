# URL model: serving-pipeline evaluation (2026-10-23)

Reproduce: `python -m AIML.url.evaluate_serving_pipeline` (see the file header for the switches).
Data: 300 recent verified PhishTank URLs (submitted since 2026-03-01, `AIML/url/verified_online.csv`),
300 held-out benign URLs (`AIML/url/v7_test.csv`), and 47 hand-written URLs of famous sites with
realistic login/deep-link paths. Threshold 0.5 unless stated.

| Configuration | ROC-AUC | PhishTank-2026 recall | Benign FPR | Famous-site FPs |
|---|---|---|---|---|
| **Before** - rules-only shortcut (`AEGIS_FAST_SCAN_MODE=1` was the default) | 0.19 | 1.7% | 2.3% | n/a |
| Neural pipeline, raw URL as model input (train/serve mismatch) | 0.78 | 20.7% | 6.7% | not measured |
| Neural pipeline, training-identical v7 input, old 0.15 score ceiling | 0.93 | 23.3% | 5.3% | 5 / 47 |
| **Now** - v7 input, 0.6 ceiling for unknown domains, 0.2 for official domains | 0.93 | **90.7%** | 6.3% | **0 / 47** |

What changed and why
1. **The neural model was not used for URLs by default.** `AEGIS_FAST_SCAN_MODE` defaulted to on, which
   returned a hand-written rules score instead of running the DistilBERT model. On recent phishing it was
   worse than chance. URLs now always go through the neural pipeline (`AEGIS_FAST_URL_MODE=1` restores the shortcut).
2. **Train/serve mismatch.** `best_v7.pt` was trained on `structuralize_url(url)` text and canonicalized numeric
   features, but serving tokenized the raw URL with older features. `AIML/url/v7_features.py` is a verbatim copy
   of the training functions (checked identical on 500 URLs) and is used when a v7 checkpoint is loaded.
3. **Score ceiling.** URLs with no brand/lexical red flag were capped at 0.15, hiding most neural detections. The
   ceiling is now 0.6 (shows as *Suspicious*), tunable with `AEGIS_URL_CLEAN_CAP`.
4. **Official domains.** `brand_engine.OFFICIAL_DOMAINS` stops `login.microsoftonline.com`, `office.com`,
   `accounts.google.com`, `ubl.com.pk`... being reported as impersonating a brand, and the neural score for a genuine
   domain of a known service is capped at 0.2 unless it carries a structural red flag. Public hosting subdomains
   (sites.google.com, github.io, blogspot.com...) are deliberately excluded from this list.

Caveats (read before quoting numbers)
- The 47 famous sites were written after seeing which sites failed, so the 0/47 is a regression check, not an
  independent estimate. The 6.3% benign FPR on held-out URLs is the honest false-positive figure for unfamiliar sites.
- `v7_test.csv` benign URLs come from the same sources as training data. A fresh benign sample (e.g. a Tranco
  top-sites crawl) should be collected for a final report.
- PhishTank URLs may overlap the v7 training set; check `build_v7_dataset.py` sources before claiming a held-out result.
- Text and email detection still use their own paths; only the URL path was re-measured here.
