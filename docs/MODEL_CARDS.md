# AegisOne - Model Cards

What each shipped model is, the data it was trained on, how it was trained, and what it is (and is not) good at.
Numbers are measured on data the model never saw. Re-run commands are in `docs/MODEL_RESEARCH_AND_PLAN.md`.
Last updated 2026-11-02. Sections 3 and 4 are now the second half of the message-model blend (section 5).

**Stack for all models:** Python 3.13 (Kaggle: 3.11/3.12), PyTorch, Hugging Face Transformers, scikit-learn, `tldextract`
(Public Suffix List); GPU training on Kaggle (2 x T4, fp16 autocast, AdamW, linear warm-up/decay); serving on CPU
(dynamic int8 quantisation of the Linear layers). Model weights are `safetensors` or JSON - no pickle is loaded.

---
## 1. URL model v10 (`AIML/url/v10/`)

| | |
|---|---|
| Task | Is this link a phishing URL? Output: calibrated probability, mapped onto the product risk scale (WARN 35 / BLOCK 60) |
| Architecture | `thenlper/gte-small` (33M-parameter sub-word encoder, mean-pooled) **+ character CNN** (kernels 3/5/7 over the raw bytes), fused by a 2-layer MLP. Code: `AIML/url/urlnet_v10.py` (the same file trains and serves) |
| Input | Structured text, not the raw string: `flags [domain] <registered domain> [sub] <subdomains> [path] <path+query>`. The registered domain comes from the Public Suffix List (private section included). Punycode is decoded and look-alike (Cyrillic/Greek) letters are mapped to Latin with an explicit `idn`/`confusable` flag |
| Training data | **PhreshPhish** v1.0.1 train split (CC BY 4.0; real phishing/benign URLs Jul 2024 - Dec 2025, leakage- and diversity-filtered by its authors): newest 5% held out for calibration, the rest used. **allenai/c4** train shards (ODC-BY): 209,000 real ordinary-web URLs (max 3 per host, Pakistani hosts kept), domain-disjoint from the local test shard. Benign-looking path padding added to 15% of them. **Mutation families** applied to phishing: padding (10%), subdomain injection (8%), brand-in-path (4%), typosquats (25,000), homoglyph/Punycode (20,000). **Real brand domains with ordinary/sign-in paths** as benign (20,000). Total 824,318 training URLs. **TLD-swap is deliberately held out** and only tested |
| Training | 2 epochs, batch 256, lr 5e-5 encoder / 1e-3 head, fp16, DataParallel on 2 x T4 (~40 min). Temperature scaling and the WARN/BLOCK thresholds (1% / 0.1% false alarms) are fitted on **both** held-out benign pools (recent PhreshPhish traffic and long-tail web), so a threshold must hold on both |
| Serving path | brand rules -> v10 network -> reputation/fusion (`AIML/url/fusion_engine.py`) -> calibrated risk. 53 ms/URL on CPU |
| Held-out result (PhreshPhish test, later in time than all training) | AUC 0.9941; caught at 1% false alarms 93.3% (95% CI 93.0-93.5), at 0.1% 80.6% (77.9-82.1), at 0.01% 52.5%. Unseen padding strings 61%; unseen brand injection 99.6%; **held-out TLD-swap family 92.6%**; typosquats 99.95%; homoglyphs 100%; ordinary brand-domain URLs wrongly flagged 0.0% |
| Our independent sets (full pipeline) | popular-site deep links false alarms 2.4%; 2,000 long-tail web pages 0.8%; today's OpenPhish feed caught 94.0%; famous-domain subdomain injection caught 100%; padded paths caught 89.7%; 46/46 hard cases |
| Known weaknesses | Phishing on a **compromised popular domain** (the reputation cap hides it unless the network is very sure); **pages whose URL looks innocent** (needs the page model, section 2); URLs of phishing kits using random hostnames the model has never seen are caught on lexical grounds only; data ends Dec 2025 (drift: re-train from fresh feeds) |
| Previous generation | v7 (DistilBERT character network + lexical features) remains installed as `AEGIS_URL_ENGINE=v7`; v8/v9 (same encoder, less data) were trained and replaced |

## 2. Page model P1 (`AIML/url/page_p1/`)

| | |
|---|---|
| Task | Judge the **page** (not just the link) when it asks for credentials |
| Architecture | Same network as the URL model; input = URL structure + `[title] [inputs] password email otp [forms] n submit same/external/mixed [text] first 600 visible characters` (`AIML/url/page_summary.py`) |
| Why a summary | ~5% of a page's HTML holds nearly all the phishing signal (arXiv 2511.15434); the extension already sends these signals with every page scan, nothing new leaves the browser |
| Training data | PhreshPhish **with its page HTML** (HTML reduced to the summary while streaming, never stored): 290,900 train pages (45% phishing), 15,310 calibration, 61,010 test pages (later in time) |
| Held-out result | AUC 0.9973; caught at 1% false alarms **97.2%** (95% CI 96.9-97.5); at 0.1% 85.9%; legitimate login pages wrongly flagged 1.1%; phishing login pages caught 90.2% |
| In the product | Runs only on pages with a password/e-mail/OTP field; combined with the URL score by `AEGIS_PAGE_FUSION=mean` (chosen on 5,000 real test pages). On pages with login fields: caught 88.5% -> **93.5%**, false alarms 2.0% -> **1.4%** |
| Known weaknesses | Pages that hide their form in an iframe or build it late with JavaScript are only seen if the extension sees the final DOM; text-light image-only pages (a screenshot of a login) are not read - the image model covers part of that |

## 3. E-mail detector v2 (`AIML/email/v2/`)

| | |
|---|---|
| Architecture | **Frozen** `BAAI/bge-small-en-v1.5` sentence embedding (33M, CPU) + 30 structural features (`AIML/email/features_v2.py`) -> L2-regularised **logistic regression head**, Platt-calibrated; risk map onto the product scale. JSON file, no pickle |
| Training data (27,419 train / 3,046 calibration) | 12 sources: TREC-05/06/07, CEAS-08, Enron, SpamAssassin, Ling (the "seven phishing e-mail datasets"), Nazario + three more phishing corpora of `final_phishing_dataset_email.csv`, and **LLM-written modern phishing and legitimate mail** (`Dizzzy0x00/LLMGen-Phishing-Email-Dataset`, rows not used for evaluation) |
| Result (never trained on) | hand-written modern set AUC 0.996 (98.3% caught / 1.8% false alarms); 500 real legitimate mails 0.6% flagged; LLM-written mail AUC 0.981 (1.6% false alarms); live end-to-end guard 12/12, 0 false alarms |
| Weaknesses | 21% of LLM-written phishing stays below WARN; the training corpora are older than 2025 except the LLM-written set (small: 1,831 rows); no SPF/DKIM/DMARC learned (used by rules when present); English-centric |

## 4. Text / SMS / WhatsApp detector v2 (`AIML/text_general/v2/`)

| | |
|---|---|
| Architecture | **Frozen** `intfloat/multilingual-e5-small` + 22 structural features (`AIML/text_general/features_v2.py`: asks for a code/PIN/money, urgency, authority, wrong-number story, Urdu script ...) -> logistic head, Platt-calibrated |
| Training data (8,626 train / 958 calibration) | UCI SMS Spam Collection; CloveAI/india-spam-sms (MIT); short LLM-written phishing/legitimate messages; **180 Pakistani seed messages** (English, Roman Urdu, Urdu) and 530 transactional (OTP, bank alert) messages written with templates different from the test set |
| Result | UCI SMS AUC 0.993 (90.7% caught / 0.6% false alarms); Pakistani set AUC 0.977 (81.8% caught / 5.6% false alarms) |
| Weaknesses | **Small Pakistani training set** (3 scam families unseen in training are missed; one WhatsApp OTP format is flagged); no conversation context; Roman Urdu spelling variation is handled only by the multilingual embedding |

## 5. Message model M1 (`AIML/message/m1/`) - THE text model since 2026-11-07: English only, `BAAI/bge-small-en-v1.5` (33M), scores alone; sections 3 and 4 (v2 heads) now serve organisation retraining only. Results: docs/TEST_REPORT.md section 12; the older rows below describe the first multilingual version

| | |
|---|---|
| Task | One context-aware model for e-mail, SMS and WhatsApp/chat |
| Architecture | `intfloat/multilingual-e5-small` (100 languages incl. Urdu), **fully fine-tuned**, mean-pooled, + 54 structural features (`AIML/message/context.py`, shared by training and serving) -> MLP head; plus 9 auxiliary **intent heads** (urgency, credential request, payment, secrecy, reward, shared file, code request, authority claim, link mismatch) |
| Input | `[channel] [sender kind] [links: registered domains + flags (not the sender's domain, shortener, IP, punycode, risky TLD)] [subject] [body]`; an optional `[history]` slot for earlier turns is wired but **untrained** (no public multi-turn data) |
| Training data | **Retrained 2026-11-06 on 102,567 messages** (adds 4,018 machine-written hard genuine messages and paired scams, English and Roman Urdu; see docs/TEST_REPORT.md section 11). Earlier round: 98,550 messages, 21 sources (`AIML/eval/export_message_data.py`): TREC-05/06/07, CEAS-08, Enron, SpamAssassin, Ling, Nazario + three more phishing corpora, LLM-written modern phishing and legitimate mail, UCI SMS, India SMS, Pakistani and transactional SMS seeds. Evaluation sets excluded. LLM-written mail repeated 3x, Pakistani seeds 8x, transactional 4x. 10% held out for calibration |
| Training | Kaggle T4 x2, 3 epochs, batch 64, lr 3e-5 encoder / 1e-3 heads, fp16, loss = cross-entropy + 0.3 x intent BCE. Thresholds per channel at 1% / 0.1% false alarms; weights stored in fp16 (224 MB) |
| Serving | **Blend**: risk = mean(M1, v2 head). M1 alone ranks as well as v2 but is over-confident outside its training corpora; the blend keeps v2's calibration and, because the v2 head is what organisation retraining (8.11) updates, keeps retraining effective. E-mail WARN uses M1's 0.1%-false-alarm point (`AEGIS_M1_EMAIL_STRICT`). Switch: `AEGIS_MESSAGE_ENGINE` = `ensemble` (default) / `m1` / `v2` |
| Held-out result | Trained without CEAS-08: AUC 0.9994 on it (1.9% false alarms). Intent heads recover the lexicon intents with AUC 0.80-0.998 on unseen messages. Full before/after in `docs/TEST_REPORT.md` sections 3-4 |
| Known weaknesses | Small modern-phishing and Pakistani training sets (1.8k / 0.7k rows); 2 of 56 legitimate hand-written mails flagged; the intents come from lexicons, not human labels (weak labels: the intent heads inherit their blind spots); no conversation context yet; no header authentication (SPF/DKIM/DMARC) learned |

---
## What these numbers do and do not mean
- **No detector misses nothing.** The goal is a *measured* operating point: detection rate at a fixed, low false-alarm rate on data from after the training period, tracked weekly against a fresh feed. A miss in production becomes a verified report, then training data (`api/services/embed_retrain.py` for the message models; the vendor hub for URL).
- Public benchmark data is not your traffic. Until the system runs on real organisation traffic, every number above is an estimate for the *public* distribution.
- The image model (screenshots/QR images) was not retrained or audited in this work.
