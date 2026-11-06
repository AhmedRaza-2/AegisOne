# AegisOne - Viva preparation: the models, end to end

For the person presenting. Every claim says where it lives in the code (`file::function`) and where the number comes from.
Numbers are measured on data the model never saw unless a line says otherwise. Where something is weaker than it sounds,
it is marked **(weak)** - say it before the examiner finds it.

## 0. The one-minute story

AegisOne protects a company's staff from phishing. A Chrome extension watches every link, page, e-mail, message and
download; a server **inside the company's network** scores it and the extension warns or blocks. Two AI models do the
scoring: a **URL model** (with a **page model** that reads the login page) and a **text model** (e-mail, SMS, chat).
Everything runs on a CPU; nothing needs the internet; the company's data stays on its own server.

```
browser extension --(URL, page summary, message text)--> API (FastAPI)
   URL     -> brand rules -> URL network v10 -> reputation + fusion -> [+ page network P1 on login pages] -> risk 0-100
   TEXT    -> text model (M1, with the v2 head) -> risk 0-100 + "what it asks for" (intents)
   risk    -> WARN (>= 35 for URLs / 51 for messages) or BLOCK -> explanation (evidence, not a black box) -> dashboard, incident
```

## 1. URL model v10 (+ page model P1)

| Question | Answer | Where |
|---|---|---|
| Task | Is this link phishing? Output a calibrated probability, shown as risk 0-100 (WARN 35, BLOCK 60) | `api/services/model_orchestrator.py::_predict_url_sync` |
| Network | `thenlper/gte-small` sentence encoder (33M parameters, mean-pooled) **plus a character CNN** (kernels 3/5/7 over the raw bytes), joined by a 2-layer MLP. Fully fine-tuned | `AIML/url/urlnet_v10.py::UrlNetV10`, `CharCNN` |
| Why a transformer + char CNN | The encoder understands words in the path (`secure-login`, brand names); the char CNN catches misspellings and random strings. Papers: fusion of sub-word and character views beats either (TCURL 2025, URL2Graph++ 2025) | `docs/MODEL_RESEARCH_AND_PLAN.md` U3b |
| Input is not the raw string | `flags [domain] <registered domain> [sub] <subdomains> [path] <path+query>`; registered domain from the Public Suffix List; Punycode decoded; look-alike letters (Cyrillic `а`) mapped to Latin with a `confusable` flag | `urlnet_v10.py::structure`, `model_text`, `decode_host`, `skeleton` |
| Data | **PhreshPhish** (CC BY 4.0, real phishing + benign URLs Jul 2024 - Dec 2025; newest 5% held out) + **209,000 real ordinary-web URLs from allenai/c4** + attack-family mutations (typosquats, homoglyphs, padding, subdomain injection, TLD swaps) | `AIML/url/kaggle/v10/`, `docs/MODEL_CARDS.md` s1 |
| Why the c4 data | The first model learned "short URL = safe" because its benign data was bare home pages; it flagged 31.7% of real deep links on popular sites. Adding ordinary long-tail pages fixed it (2.4% now) | `docs/MODEL_RESEARCH_AND_PLAN.md` s4 "root cause" |
| Training | Kaggle 2 x T4, fp16, AdamW, 2 epochs, batch 256, ~40 minutes. Temperature scaling; WARN/BLOCK thresholds fitted at **1% / 0.1% false alarms on held-out benign data** (both recent traffic and long-tail pages) | `AIML/url/kaggle/v10/` |
| Serving | CPU, int8 dynamic quantisation of the Linear layers; no pickle (safetensors + JSON) | `urlnet_v10.py::load` |
| Brand rules | Whole-token, misspelling (Damerau-Levenshtein) and lure-word matching on the *registered domain*; popular listed domains never match. Popular-site false matches fell from 12.4% to 0.0% | `AIML/url/brand_engine.py::check_brand_impersonation` |
| Reputation + fusion | Tranco top-100k popularity can cap a score (but not on hosting platforms like blogspot or wildcard-DNS hosts, and not when the network is very sure: `AEGIS_URL_LISTED_OVERRIDE` 0.925) | `AIML/url/reputation.py`, `AIML/url/fusion_engine.py::fuse_url_intelligence` |
| Page model P1 | Same network; input = URL + a ~600-character **page summary** (title, form fields, form targets, first visible text). Runs only on pages with a password / e-mail / OTP field. Combined with the URL score by the mean | `AIML/url/page_summary.py`, `model_orchestrator.py::_page_model_score`, `_combine_url_page` |
| Why a summary | ~5% of the HTML holds nearly all the phishing signal (arXiv 2511.15434); it is also what keeps page content private | |

**Numbers (PhreshPhish test split, later in time than all training; 168,060 URLs):** AUC 0.994; **93.3% caught at 1% false
alarms** (CI 93.0-93.5), **80.6% at 0.1%**, 52.5% at 0.01%. Held-out attack family never trained on (TLD swap): 92.6%.
Typosquats 99.95%, homoglyph/Punycode 100%. Full pipeline on our own sets: popular deep links wrongly flagged 2.4%;
2,000 ordinary web pages 0.8%; fresh OpenPhish feed caught 94.0%. Page model on 61,010 test pages: AUC 0.997, 97.2% caught
at 1% false alarms; on login pages the URL-only 88.5% caught / 2.0% flagged becomes **93.5% / 1.4%**.
**Latency:** 53 ms per URL on an idle CPU; **191 ms** measured when the machine was busy. Quote both.

**Head-to-head (docs/TEST_REPORT.md s9):** 303 fresh phishing URLs and 2,000 genuine: AegisOne 89.8% caught / 0.9% flagged;
Google Safe Browsing 27.7% / 0.05%. VirusTotal's 100% is **not independent** (it pools the same feed our URLs came from).
Second cycle (300 new URLs, same minute): AegisOne 279/300, Google 52/300. **Zero-day lead time is not measured yet.**

**Weak (say it first):** phishing on a *compromised popular domain* (the reputation cap hides it); image-only pages; the
data ends Dec 2025, so it needs a weekly refresh; 31 of the 303 fresh URLs were missed.

## 2. Text model (e-mail, SMS, WhatsApp/chat)

**What runs (2026-11-07):** ONE English-only text model, **M1**, for e-mail, SMS and chat, with thresholds per channel.
It scores alone. The **v2 head** (a light classifier over a frozen embedding) is kept only so that an organisation's own
retraining (module 8.11) still has something to update: its head is blended in only once an organisation activates it.

| Question | Answer | Where |
|---|---|---|
| Task | Is this message a scam/phishing, and *what does it ask for* (credentials, payment, a code, secrecy, a reward, a shared file, authority, a link that is not the sender's)? | `model_orchestrator.py::_predict_email_sync`, `_predict_text_sync`, `_m1_risk` |
| Network | A sentence encoder, **fully fine-tuned** (`BAAI/bge-small-en-v1.5`, 33M parameters, English), mean-pooled, joined with **54 structural features** (links, sender/domain mismatch, urgency, amounts...) -> MLP; plus 9 auxiliary **intent heads** | `AIML/message/net.py::MessageNet`, `AIML/message/context.py::build_text, dense_features` |
| The input includes context | channel + sender kind + link/registered-domain context + subject + body. The same file builds the input in training and serving (no drift) | `context.py` |
| Data (round 3: 103,391 English messages) | Seven public e-mail corpora (TREC-05/06/07, CEAS-08, Enron, SpamAssassin, Ling), Nazario + three more phishing sources, LLM-written modern phishing **and legitimate** mail, UCI SMS, India SMS, Pakistani and transactional SMS seeds, **+9,870 cleaned machine-written hard messages (bank and card alerts, code notices, promotions, account security) with paired scams**. Non-English rows removed. Evaluation sets excluded | `AIML/eval/export_message_data.py` |
| Training | Kaggle 2 x T4, 3 epochs, batch 64, lr 3e-5 encoder / 1e-3 heads, loss = cross-entropy + 0.3 x intent loss. Thresholds per channel at 1% / 0.1% false alarms | `AIML/message/kaggle/train_message_m1.py` |
| Why not an LLM | A fine-tuned small encoder makes far fewer false alarms on genuine messages than a zero-shot LLM, runs on a CPU and cannot be prompt-injected (SecureNet 2406.06663; counter-scam study 2606.01475) | `docs/MODEL_RESEARCH_AND_PLAN.md` s6b-6c |
| v2 head | Frozen `bge-small-en-v1.5` embedding + 30 structural features -> logistic regression, Platt-calibrated, one JSON file. **This is what organisation retraining (module 8.11) updates**, because refitting a head on a few dozen verified reports is safe and fast | `AIML/embed_head.py`, `api/services/embed_retrain.py::train_org_head` |

**Numbers (independent sets, never trained on), English:**

| Set | Scams caught | Genuine flagged |
|---|---|---|
| ScamGuardBench v0.2, English part (610 messages, deliberately look-alike genuine ones) | **96.5%** (adversarial "hard" scams 20/20) | **9.1%** (was 65.3% at the start of this work; AUC 0.977) |
| 119 hand-written Pakistani messages, English part | 100% | 0% |
| 176 hand-written modern mails | 93.3% | 0.0% |
| 1,000 LLM-written mails (same generator family as part of the training data: optimistic) | 99.0% | 0.0% |
| 500 real legitimate mails | - | 0.0% |
| 1,100 real SMS (UCI) | 92.0% | 0.5% |
| 600 India SMS | 100% | 0% |

**Speed:** median 79 ms, p95 129 ms per message on a CPU. **Size:** 33M parameters, 67 MB (was 118M / 236 MB).

**Weak (say it first):** the 5% false-alarm target on the hard benchmark is **not met** (9.1%): bank transaction alerts are still
flagged 41% of the time (everything else is under 12% except untagged 18%). **Roman Urdu and Urdu are no longer supported by the
text model** (real Pakistani Roman Urdu SMS: scams caught 39%): the product decision was English only; links in such messages are
still scored by the URL model. Part of the gain may be generator style (the benchmark and our extra data are both LLM-written),
so the real-data sets are reported beside it. Promotions are labelled safe (the third "promotion" class from PhishFuzzer is
still not built).

## 3. Which techniques do we use (the question you will get)

| Technique | Used? | Detail |
|---|---|---|
| Transformer encoders | Yes | gte-small (URL, page), e5-small / bge-small (text) |
| Fine-tuning | Yes, **full** fine-tuning | URL v10, P1, M1 |
| LoRA / adapters | **No** | the "calibration adapter" in 8.11 is a small score-correction layer, not LoRA |
| LSTM | **No** | the older URL v7 used a character network; LSTMs are not in the shipped path |
| Distillation | **No** (an LLM only *writes training examples*; nothing is distilled into the model) | |
| Frozen embedding + linear head | Yes | the v2 text/e-mail heads |
| Quantisation | Yes | int8 dynamic quantisation for CPU serving |
| Calibration | Yes | temperature scaling (URL/M1), Platt scaling (heads) |
| Ensembling | Yes for URL (URL + page model mean); **no for text** (M1 alone; an organisation's retrained head is blended only once active) |

## 4. How we know the numbers are honest (methodology)

- **Temporal split**: test data is *later in time* than all training data (PhreshPhish test; fresh feeds), so it measures
  "will it work next month", not "can it memorise".
- **Held-out attack families**: a whole family (TLD swap) is kept out of training and tested alone.
- **Leave-one-source-out**: M1 trained without CEAS-08 still scored AUC 0.9994 on it (`train_message_m1.py --holdout-source`).
- **TPR at a fixed false-alarm rate**, not accuracy: 93.3% caught *at 1% false alarms*. Accuracy hides the false alarms.
- **Bootstrap confidence intervals** on the headline numbers; thresholds fitted on a held-out benign pool, never on test.
- **Independent benchmarks** we did not build: ScamGuardBench (flowxai), the Roman Urdu smishing set (Zenodo), OpenPhish feed.
- **Why accuracy is not quoted**: with 1% phishing in real traffic a model that says "safe" always is 99% accurate.

## 5. Learning from mistakes (module 8.11) - say exactly this

1. An employee reports a false positive / missed threat -> incident -> a manager triages -> an **admin verifies** it.
2. Only verified, redacted samples become training data (`TrainingCandidate`).
3. **URL:** the small heads are fine-tuned on the server (`api/services/weight_trainer.py`, run through `local_trainer.py::run_background_retraining`).
   **Messages:** the v2 head is refitted with a replay sample and a proximity penalty (`embed_retrain.py::train_org_head`).
4. **Gate:** a new version goes live only if it does not regress on frozen reference sets (AUC, recall at WARN, false alarms)
   (`embed_retrain.py` and `weight_trainer.py::judge`). Tests show it rejects poisoned and redundant updates and accepts a real new lure.
5. Organisations can share the ~1 MB head package (never raw data) with the vendor hub, which benchmarks and promotes it.
It is **not** neural fine-tuning of the whole network (that stays a vendor job on GPUs). Image model: calibration layer only.

## 6. Explainability and what is hard-coded

- **Explanations are evidence, not attributions** (we replaced SHAP/LIME, documented in the amended scope): which link, which
  intent (asks for a code, sender mismatch), domain age (real RDAP lookup), brand match. `api/services/xai_engine.py`,
  `evidence.py`. No gradient attribution runs.
- **Hard-coded (be upfront):** the brand list and official domains (`brand_engine.py`), hosting-platform lists and the Tranco
  top-100k (`reputation.py`), fusion caps and rule floors (`fusion_engine.py`), WARN/BLOCK thresholds (35/60 URL, 51/76
  messages) - fitted on held-out data, then fixed in a calibration file - lure-phrase lists for the explanation text.
  `AEGIS_*` environment variables switch engines (`AEGIS_URL_ENGINE`, `AEGIS_MESSAGE_ENGINE`, `AEGIS_PAGE_FUSION`).

## 7. Where we are going (research-driven, and what is not done)

| Paper (link in docs/MODEL_RESEARCH_AND_PLAN.md s7) | What it says | Status |
|---|---|---|
| PhishFuzzer, arXiv 2511.21448 | Sender/link metadata cut false alarms; use three classes (phish / spam / valid) | metadata yes; **3 classes not built** |
| AURA, arXiv 2609.19873 | Feed each link's risk into the text encoder; route uncertain cases | **not built** |
| Ahmed & Pourmoafi, arXiv 2607.18429 | 98% clean accuracy falls to ~64% under adversarial rewriting | **adversarial gate not built** |
| Cross-corpus fragility (BDCC 2026) | single-corpus models are fragile | done (leave-one-source-out) |
| SecureNet 2406.06663 / counter-scam 2606.01475 | small fine-tuned encoder beats zero-shot LLM on false alarms | our choice |
| Teacher-student SMS 2602.10869, COVA 2604.11752 | LLM-written training data is an accepted method | the only paper basis for our generated data |
| KnowPhish (USENIX Security 2024), PhishAgent (AAAI 2025) | brand-knowledge / reference-based URL detection | basis of the brand engine; not a full copy |

Most text-side papers are arXiv preprints or journals; we found no top-conference paper on exactly this text problem - say so.
**Done:** one English-only text model (no blend). **Planned next:** three classes (scam / promotion / genuine), URL risk of each
link as an input, uncertainty routing, an adversarial rewriting test as a release gate, human-written bank-alert data.

## 8. Other models (do not let the examiner lead you here)

- **Image model** (screenshots/logos): the weakest; val F1 0.835, test AUC 0.880; not retrained here. Not part of the "two models" story.
- **Attachments**: rule/structure analysis (macros, archives), not a neural model.
- Older e-mail/text/URL networks (v7 era) are still installed as fallbacks and are not the default path.

## 9. Likely questions - short answers

1. **Why two models?** Different inputs: a link is a short structured string; a message is language. One shared design (small encoder, CPU), two trainings.
2. **93.3% - is that accuracy?** No: share of phishing caught when the false-alarm rate is held at 1%, on data newer than training.
3. **How do you stop leakage?** Temporal split, domain-disjoint data, held-out attack family, held-out source, thresholds fitted on separate pools.
4. **What did you test against?** Google Safe Browsing and VirusTotal on 303 fresh phishing URLs; 89.8% vs 27.7%; VirusTotal's 100% is circular. Lead time not measured.
5. **Why not GPT?** False alarms on genuine traffic, latency (0.5-23 s per page in the literature), privacy, prompt injection.
6. **What happens when the model is wrong?** The user reports it -> incident -> admin verifies -> head retrained behind a no-regression gate.
7. **What is your biggest weakness?** Genuine bank transaction alerts that look like scams (41% flagged; 9.1% over the whole hard benchmark vs the 5% target); no Roman Urdu/Urdu support in the text model; compromised popular domains for URLs.
8. **Does user data leave the company?** No: scoring is on the company's own server; the extension sends the URL, a ~600-character page summary and message text to *that* server; PII is redacted for managers/admins.
9. **How fast?** URL 53 ms idle / 191 ms busy on CPU; message 79 ms median / 129 ms p95 on CPU.
10. **Is the data synthetic?** URL: real (PhreshPhish, c4). Text: real public corpora **plus** 4,018 LLM-written hard examples; we report real-data sets beside the LLM-written benchmark.
11. **Why does recall drop when false alarms drop?** The trade-off is a threshold; we chose thresholds on held-out data at 1% / 0.1% false alarms and say what we lose (UCI promotions).
12. **What is hard-coded?** s6.
13. **LoRA? LSTM? distillation?** No / no / no (s3).
14. **Why English only now?** The product scope is English; the English backbone is smaller (33M vs 118M), faster and more accurate on English; the price is that Roman Urdu/Urdu scams are no longer reliably caught by the text model (39% on real Pakistani SMS) - say so.

## 10. Run it end to end (for testing before the viva)

**Quick test that does not touch any existing containers (verified 2026-11-07 on the final images):**
```
docker network create aegistest
docker run -d --name aegistest-db --network aegistest -e POSTGRES_USER=aegis -e POSTGRES_PASSWORD=testpass -e POSTGRES_DB=aegisone postgres:16
docker run -d --name aegistest-backend --network aegistest -p 8100:8000 -e AEGIS_SLA_WATCH=0 -e AEGIS_PORT=8000 ^
  -e AEGIS_DATABASE_URL=postgresql+asyncpg://aegis:testpass@aegistest-db:5432/aegisone -e AEGIS_JWT_SECRET=any-long-random-text ^
  -e AEGIS_LICENSE_ENFORCE=off ahmedraza2006/aegisone-backend:2026-11-07b uvicorn api.main:app --host 0.0.0.0 --port 8000
docker run -d --name aegistest-dash --network aegistest -p 3100:3000 ahmedraza2006/aegisone-dashboard:2026-11-07
```
(`^` is the Windows line-continuation; on Linux/macOS use `\`.) The backend needs about a minute to load the models:
`curl http://127.0.0.1:8100/health` must show the four models `online`. The dashboard is at http://localhost:3100/login but calls
the API on port 8000 of the same host, so for the dashboard use `-p 8000:8000` on the backend instead of `8100`.
Scans work without signing in (form-encoded):
```
curl -X POST http://127.0.0.1:8100/analyze/url  --data-urlencode "url=http://paypa1-secure-login.xyz/verify?acct=7"   -> BLOCK 96
curl -X POST http://127.0.0.1:8100/analyze/url  --data-urlencode "url=https://www.google.com/search?q=weather"      -> SAFE 0.17
curl -X POST http://127.0.0.1:8100/analyze/text --data-urlencode "text=Your OTP is 482913. Do not share this code with anyone."            -> legitimate 1.9%
curl -X POST http://127.0.0.1:8100/analyze/text --data-urlencode "text=HBL: Rs 4,500 debited from A/c XX1234 ... call 111-111-425."          -> legitimate 0.3%
curl -X POST http://127.0.0.1:8100/analyze/text --data-urlencode "text=McDonald's: Get 20% off your next order! Use code LUNA20 ... Reply STOP."  -> legitimate 0.1%
curl -X POST http://127.0.0.1:8100/analyze/text --data-urlencode "text=Your account has been compromised. Send the code you just received to our agent now ..."  -> phishing 98.2%
curl -X POST http://127.0.0.1:8100/analyze/text --data-urlencode "text=Congratulations! You won a 500 dollar Best Buy gift card. Claim it at http://go.fo/claim ..."  -> phishing 99.1%
```
Clean up: `docker rm -f aegistest-db aegistest-backend aegistest-dash && docker network rm aegistest`.

**Full stack (`docker-compose.prod.yml`):** it uses fixed container names (`aegisone-backend`, `aegisone-db`, ...). If you ran an
earlier AegisOne stack on the same machine, remove the old containers first (`docker compose -f docker-compose.prod.yml down`,
add `-v` only if you also want to discard the old database), otherwise Docker answers "container name already in use".
`.env`: `SERVER_HOST=localhost  DB_PASSWORD=<choose>  AEGIS_JWT_SECRET=<random>  AEGIS_LICENSE_ENFORCE=off  AEGIS_TAG=2026-11-07`, then
`docker compose -f docker-compose.prod.yml up -d` (dashboard https://localhost, API https://localhost:8443; Caddy's own
certificate authority signs the certificate, so the browser warns until its root certificate is trusted). **Not run here** (ports
and names clash with the existing containers); the individual images were run as above.

**Browser extension:** `chrome://extensions` -> Developer mode -> Load unpacked -> `Extension/`. Try a normal site, a
`paypa1-secure-login.xyz`-style address, a fake bank login page and the messages above.
