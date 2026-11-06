# AegisOne - Model Quality: Where We Are and the Road to Enterprise-Grade

Updated 2026-11-01 (first version 2026-10-25). Section 1 is measured in this repository with the evaluation harness in
`AIML/eval/` (every number can be re-run). Section 3 summarises 2024-2026 research; links are in section 7, and where
only an abstract or a secondary summary was read it is said so. Sections 4-6 are the plan, channel by channel:
URL first, then e-mail, then text/SMS.

## 1. Where we are (measured 2026-11-01)

All sets below are **never used for training, calibration or thresholds**. Re-run with `python -m AIML.eval.eval_url
--mutations`, `python -m AIML.eval.eval_email --scorer v2`, `python -m AIML.eval.eval_text --scorer v2`, and
`python -m AIML.eval.probe_hard_urls`. Results JSON/markdown in `AIML/eval/results/`.

**URL** (WARN = risk >= 35, as the extension uses it)

| Set | Before (v7, 2026-10-31) | v7 + v8 ensemble | **Shipped: v10 + rule fixes** |
|---|---|---|---|
| 498 real deep links on popular sites (incl. 158 Pakistani) - false WARN | 31.7% | 3.8% | **2.4%** |
| 2,000 ordinary web pages (allenai/c4) - false WARN | 9.3% | 8.1% | **0.8%** |
| 300 phishing URLs from today's OpenPhish feed - caught | 84.3% | 88.0% | **94.0%** |
| same, with a famous domain injected as a subdomain - caught | 99.7% | 100% | **100%** |
| same, with benign-looking path padding - caught | 37.7% | 47.0% | **89.7%** |
| 46-URL hard-case probe (Google Docs/Drive, OAuth, typosquats) | 31 legitimate URLs flagged earlier | 46/46 | **46/46** |
| Held-out TLD-swap attack family (never in training) | - | - | **92.6%** |
| Pages with login fields (5,000 real PhreshPhish test pages), phishing caught / legit flagged | - | - | **93.5% / 1.4%** (URL only: 88.5% / 2.0%) |

Three fixes beyond the new model, all found by looking at what the pipeline missed: the brand rule matched substrings of
ordinary words ("comcast" in `manufacturers.com.tw`, "twitter" via the alias `x.com` in `olx.com.pk`) and fired on 12.4% of
popular links - rewritten to whole-token / misspelling / lure-word matching on the registered domain (0.0% on popular links,
Punycode look-alikes now caught); the popularity list hid 240 of 2,347 phishing pages on `*.blogspot.<country>`, e-mail
click-trackers (`sendgrid.net`) and wildcard DNS (`sslip.io`) - now treated as hosting; and a very confident network score
(its 0.1%-false-alarm block threshold) is no longer capped by domain popularity.

Latency (CPU, per URL, full pipeline): v7 107 ms, v10 53 ms. `AEGIS_URL_ENGINE` = `transformer` (default: newest installed
of v10/v9/v8 alone), `ensemble` (+ v7), `v7`. Full model description and data: `docs/MODEL_CARDS.md`.

**E-mail** (WARN = 51 on the product scale = 1% of legitimate mail)

| Set | Before (neural + keyword rules) | Now (v2 embedding detector) |
|---|---|---|
| 176 hand-written modern mails (credential, payroll, shared file, bank, MFA, CEO fraud vs hard negatives) - AUC | 0.689 | **0.996** |
| ... phishing caught at WARN / legitimate flagged | 9.2% / 0% | **98.3% / 1.8%** |
| 500 real legitimate mails (Enron, SpamAssassin, Ling) - flagged | 7.8% | **0.6%** |
| 1,000 LLM-written mails (500 phishing, 500 legitimate) - AUC | 0.623 | **0.981** |
| ... legitimate LLM-written mail flagged | 25.2% | **1.6%** |
| live regression guard (12 modern phishing / 12 business mails, end to end) | 9/12 caught earlier | **12/12, 0 false alarms** |

**Text / SMS / WhatsApp** (WARN = 51)

| Set | Before (keyword shortcut, then neural) | Now (v2 multilingual detector) |
|---|---|---|
| 1,100 real SMS (UCI) - AUC | 0.561 | **0.993** |
| ... scams caught / legitimate flagged | 13.3% / 0% | **90.7% / 0.6%** |
| 200 Pakistani SMS (English, Roman Urdu, Urdu) - AUC | 0.691 | **0.977** |
| ... scams caught / legitimate flagged | 40.0% / 0% | **81.8% / 5.6%** |

**Extension in a real browser** (`Extension/tests/e2e_extension.py`, Chromium, live API): 17/17 - popup sign-in,
tokens AES-GCM encrypted, no warning on ordinary pages, fake bank page caught, password-typing alert, risky links
flagged in normal DOM / shadow DOM / iframes, QR destination decoded and rated, risky download stopped at the click
and by the download guard, no visited phishing address readable in extension storage (this last check found and
fixed a plain-text scan cache, download list and e-mail verdict cache).

## 2. What "enterprise-grade" means here (the contract every model must meet)

1. **Measured on data it never saw**: time-split (newer than training), source-split (a corpus or feed not used in
   training) and *fresh* feeds (today's OpenPhish). Random splits are not reported as quality.
2. **Judged at the false-alarm rate a company can live with**: detection rate at a fixed FPR (1%, 0.1%) and average
   precision at realistic phishing base rates (0.05%-5%, as PhreshPhish does), not accuracy.
3. **Separate false-alarm budgets for popular and long-tail sites**: a reputation list hides the problem on popular
   sites; the long tail is where a model has to stand on its own.
4. **Calibrated scores and fixed thresholds**: WARN / BLOCK thresholds are chosen on held-out legitimate traffic for
   a target FPR and shipped with the model; scores mean the same thing after every retrain.
5. **Robust to cheap evasion**: subdomain injection, path padding, brand stuffing, LLM-rephrased mail, prompt
   injection against any LLM component.
6. **Explainable and auditable**: every verdict carries the evidence that drove it; every model version, its data and
   its metrics are stored, and any version can be reverted.
7. **Private by design**: models and organisation retraining run on the customer's server; only weights / heads go
   to the vendor hub, never raw mail, URLs browsed or messages.
8. **Fast on a CPU**: the extension must not slow browsing; target P95 well under 200 ms per URL and per message.

## 3. What the latest research says (and what we take from it)

**URLs and web pages**
- *PhreshPhish* (2025, rev. 2026): ~250k phishing / 367k benign URLs+HTML over 17 months, temporal split, leakage and
  diversity filters, benchmarks at base rates 0.05%-5%. A fully fine-tuned GTE-large embedding model on raw URL+HTML
  was clearly best (AP 0.605 at a 0.05% base rate vs 0.223 linear, 0.251 small MLP, 0.100 zero-shot Gemini-2.5-Pro);
  every model degrades as the base rate falls. *Take:* fine-tune a compact embedding model on URL + page text,
  evaluate on a temporal split at realistic base rates; do not rely on a zero-shot LLM.
- *Frontiers in Computer Science 2026* (URL robustness): random splits hide domain leakage, campaign shift and
  adversarial edits. With domain-disjoint splits, subdomain injection drove LR, XGBoost and a char-CNN to the
  prevalence floor (~0.43 accuracy); on PhishTank with independent benign hosts accuracy fell to 0.87 / 0.73 / 0.85
  (LR / XGB / BERT). Adversarial training helped only the attack family it saw. *Take:* domain-disjoint evaluation,
  mutation tests in CI, registered-domain reasoning instead of string tricks.
- *URLTran* (Microsoft): transformer on URLs, 86.8% TPR at 0.01% FPR vs 71.2% next baseline. *Take:* low-FPR
  operating points are achievable with a domain-adapted transformer.
- *KnowPhish* (USENIX Security 2024) and *PhishAgent* (AAAI 2025): reference-based detection with a ~20k-brand
  multimodal knowledge base; PhishAgent found 4,139 phishing pages vs 681 in a Singapore field study at 95.1% vs
  97.4% precision. *MemoPhishAgent* (2026) keeps recall at 0.88 under screenshot prompt injection where a plain MLLM
  falls from 0.80 to 0.52. *Take:* a brand knowledge base (incl. Pakistani banks/telcos/government) for pages that
  claim a brand their domain does not own.
- *Clouding the Mirror* (2026): stealthy prompt injection against multimodal-LLM phishing detectors works even on
  frontier models; the proposed defence combines prompt hardening, allow-list retrieval and output validation.
  *Take:* any LLM judge we add is confined to the uncertain band, hardened, and can never override a hard rule.

**E-mail**
- *Cross-corpus fragility* (BDCC 2026): detectors trained on one corpus are unstable on others; corpus identity is
  itself learnable (0.97-0.98), i.e. models learn dataset artefacts; pooled multi-corpus (leave-one-corpus-out)
  training transferred best (LR F1 ~0.82-0.90 on unseen corpora). *Take:* train on many sources, select models by
  leave-one-source-out, never report a single-corpus split.
- *LLM-generated phishing*: classical detectors lose recall on LLM-rephrased mail (several 2024-2025 studies;
  PhishFuzzer 2025 builds 23,100 controlled LLM variants for exactly this test); *LLM-PEA* (2025) finds frontier LLMs
  >90% accurate but vulnerable to combined/prompt-injection attacks (1-12% attack success). *Take:* include
  LLM-written phishing AND LLM-written legitimate mail in training and testing, so "sounds like an LLM" is not a cue.
- *Diagnosing generalization failures in fine-tuned LLMs* (Jan 2026): Llama 3.1 8B, Gemma 2 9B and Mistral fine-tuned
  for phishing generalise according to data diversity and architecture (Gemma 2 9B >91% F1 only with a diverse
  "generalist" set; Mistral most consistent). *Take:* diversity of training data matters more than model size.
- *DeBERTa-v3 vs LLMs* (2024): a fine-tuned DeBERTa-v3 beat zero-shot GPT-4 on recall and is orders of magnitude
  cheaper. *Take:* a fine-tuned encoder is the production workhorse; LLMs are a second opinion at most.

**SMS / chat**
- *Multi-signal evasive smishing model* (2025): 84k relabelled SMS; combining region-aware semantic tags, structural
  patterns, character-level style and phrase embeddings reached AUC 0.997 and beat any single stream. *Take:* our
  v2 text detector combines a multilingual embedding with explicit, region-aware request/pressure features.
- *Conversational smishing datasets* (2026, 3,201+ multi-turn synthetic conversations; English, US-centric) and
  *adversarial fragility of smishing detectors* (2026). *Take:* WhatsApp needs conversation-level detection next.
- *Bangla smishing* (2025): BERT + character-level CNN for a low-resource script. *Take:* a character channel helps
  with Roman-Urdu spelling variation.
- No public Roman-Urdu/Urdu smishing benchmark exists (the "Urdu spam" sets on HuggingFace are not phishing data).

**Calibration and operating points**: temperature/Platt scaling fixes over-confidence without changing ranking, so
thresholds chosen for a target FPR survive; report calibration error alongside TPR@FPR.

## 4. URL - step by step

**Root cause found (2026-11-01).** The URL network's benign training data is 19,747 bare Tranco home pages plus an
old URL list, while its phishing data is deep PhishTank links - so it learned "has a path = phishing". That is why
real deep links on popular sites were flagged (31.7%) and why a benign-looking path hides a phishing URL (padding
cut detection from 84% to 38%).

**U1 - done: reputation-aware fusion** (`AIML/url/reputation.py`, `fusion_engine.py`). Exact registered-domain
match (Public Suffix List incl. private section) against the Tranco top 100k plus every Pakistani `.pk` domain in the
top 1M; a reputable domain caps the neural score unless a structural red flag is present (raw IP, `user@host`
trick, odd port, `//` path trick). Three host classes: *collaboration links* (Docs, Drive, SharePoint, OneDrive,
Dropbox) held below WARN for the page check to decide; *free hosting / site builders / buckets / tunnels* (gitbook,
weebly, Google Forms/Sites, Microsoft Forms, S3, ngrok...) get **no** reputation - measured, a plain popularity list
had hidden 11 of 300 of today's phishing URLs on such platforms. Two lexical bugs fixed: `@` only counts in the host
part; a suspicious TLD no longer cancels an exactly listed domain. Hard-case probe: 46/46.

**U2 - attempted, rejected by the gate (kept out): head-only refresh** on PhishTank-2026 + real c4 pages with padding
augmentation. Two variants: the first learned the mirror shortcut ("bare domain = phishing", +5 points false alarms
on the old reference); the second removed it but still lost AUC on both frozen references. The gate refused both,
correctly. Conclusion: the backbone itself has to be retrained - heads cannot undo what it encodes.

**U3 - done in part (2026-11-01): URL v8 trained on Kaggle GPUs and shipped as an ensemble with v7.**
`thenlper/gte-small` fully fine-tuned on the PhreshPhish train split (527k URLs; newest 5% held out for temperature
calibration and thresholds; script `AIML/url/kaggle/train_url_v8.py`, model in `AIML/url/v8/`). On the PhreshPhish
test split: AUC 0.995, 95.3% caught at 1% FPR, 85.8% at 0.1%; benchmark AP 0.636 / 0.725 / 0.864 / 0.902 / 0.956 at
base rates 0.05% / 0.1% / 1% / 2% / 5% - above the paper's fine-tuned GTE-large on URL+HTML (0.605 at 0.05%), with
the URL alone. On our independent sets v8 alone fixes padding (38% -> 100%) and raises OpenPhish recall to 93.7%,
but doubles false alarms on older long-tail pages (15.25%: query-heavy CMS URLs such as `?page_id=`, `.php?id=`,
which PhreshPhish's 2024-25 benign traffic rarely contains). Requiring both networks to agree (geometric mean of the
two calibrated scores, `api/services/model_orchestrator.py`) is better than v7 on every set (table above), so that
ships. **Remaining part of U3:** retrain v8 with long-tail benign negatives (c4 / Common Crawl deep links, Pakistani
sites) and padding augmentation of benign URLs, so v8 can run alone with its full recall. The original plan:

Data: PhreshPhish (CC BY 4.0, 2024-2025, temporal
split, leakage-filtered) + PhishTank / OpenPhish with first-seen dates + benign URLs that mirror real browsing
(deep links, login/OAuth flows, SaaS tenants, CDN and download links, Pakistani sites; never bare domains vs deep
phishing). Split by registered domain AND time. Augment with padding / subdomain injection / brand-in-path
mutations (and test on held-out mutation families). Model: fine-tune a compact embedding model on URL (+ page title
and visible text when the extension provides them) - the best performer in PhreshPhish (fine-tuned GTE) - and keep
a gradient-boosted lexical model as a second opinion. Calibrate, pick WARN/BLOCK at 1% / 0.1% FPR on held-out
benign, ship through the existing hub gate with *refreshed* reference sets (today's c4 + popular deep links +
fresh OpenPhish), because the old v7 references no longer represent real traffic.

**U3b - research-driven redesign (2026-11-01, plan; v9 = v8 + c4 long-tail benign is the baseline it must beat).**

What the newest work says, and the design decision each one drives:

| Finding | Source | Design decision |
|---|---|---|
| Benign sets made of bare homepages let a one-line rule score 99.6%; template-neutral accuracy is ~86% | "Robustness or Artifact?" reproduction (2026) of a PhiUSIIL study; our own v7 root cause | Benign training data must look like real browsing: deep links, subdomains, query strings, login/OAuth pages (c4 + PhreshPhish benign + padded benign). Always report a trivial-rule baseline next to the model |
| Adversarial training helps only the attack family it saw; subdomain injection does not transfer (RDI 0.54-0.57) and drives LR/XGB to the prevalence floor | Frontiers Comp. Sci. 2026 (Ahamed et al., leave-one-family-out protocol) | Give the model the registered domain explicitly instead of hoping it learns it: structured input `[DOMAIN] eTLD+1 [SUB] subdomains [PATH] ...`. Evaluate leave-one-family-out (train on 4 mutation families, test on the 5th) |
| BERT-style models are uniquely weak to homoglyph / Punycode hosts because WordPiece splits them | Same Frontiers study; homoglyphs cut F1 by 10-15% (2025); URLTran adversarial fine-tuning | Normalise before tokenising: decode Punycode, map confusables to a skeleton, add an explicit `[IDN]` / `[CONFUSABLE]` marker; add homoglyph and typo mutations to training |
| Character + sub-word fusion beats either alone | TCURL (KBS 2025), URL2Graph++ (2025) | Add a small character-CNN branch beside gte-small, fused before the classifier (negligible CPU cost) |
| URL + page HTML is what reaches high TPR at 0.1% / 0.01% FPR | PhreshPhish (fine-tuned GTE on URL+HTML best); WebGuard++ (2025, 1.1-7.9x TPR at 0.1%/0.01% FPR); SpecularNet (2026, DOM + domain, 20 ms CPU) | Second model on URL + compact page text (title, form targets, link-host stats, first visible text), run only when the page has a password/payment field or the URL score is borderline |
| ~5% of the HTML carries almost all the signal | Small Language Models for Phishing Websites (arXiv 2511.15434) | The extension sends a ~1-2 kB page summary, never the full page (also better for privacy and latency) |
| LLMs: 0.5-23 s per page; best use is a final judge after a classical pre-filter | arXiv 2511.15434; Least-to-Most prompting (2026); Clouding the Mirror (2026) | Optional LLM judge only for the uncertain band (U5), hardened, never overriding a hard rule |
| Report CIs, seeds, per-class metrics | Robustness-or-Artifact protocol | Bootstrap 95% CIs on every reported number; two seeds per shipped model |

Execution (Kaggle T4 x2, ~27 GPU-hours left):
1. **Data (no GPU).** PhreshPhish URL + `target` brand + HTML reduced on the fly to a page summary; c4 train shards (domain-disjoint from the local test); Tranco deep links incl. Pakistani sites; mutation families: padding, subdomain injection, TLD swap, typo, homoglyph/Punycode, path brand-stuffing.
2. **URL model v10 (~4 h).** gte-small + char-CNN branch, structured input with Punycode/confusable normalisation, mutation training with one family held out. Distil from a gte-base teacher if the student gap is > 1 point at 1% FPR.
3. **Page model P1 (~6 h).** gte-small on URL + page summary (PhreshPhish HTML), thresholds at 1% / 0.1% FPR on held-out benign; extension sends the summary for password/payment pages.
4. **Gate.** Local suite (popular, long-tail c4, fresh OpenPhish, mutations incl. the held-out family, hard probe) with bootstrap CIs; ship only if every set is at least as good as the current ensemble.

**U4 - next (1 week): page evidence for the borderline band.** Reference-based brand check with a brand knowledge
base (global + Pakistani banks, wallets, telcos, government), redirect chain, RDAP domain age (done), form targets.
This is what catches phishing on free-hosting platforms, where the URL alone can never be enough.

**U5 - later: LLM judge in the uncertain band only**, hardened against prompt injection (Clouding the Mirror;
MemoPhishAgent's memory of past verdicts), never overriding a hard rule.

**U6 - continuous: monitoring.** Re-run `python -m AIML.eval.eval_url --mutations` weekly on a fresh OpenPhish pull
(`build_reference_sets.py phish`); alert when recall or false alarms move by more than 2 points.

## 5. E-mail - step by step

**E1 - done (2026-11-01): v2 detector in production.** Frozen `BAAI/bge-small-en-v1.5` sentence embedding (33M
params, CPU) + 30 structured features that describe the *shape* of an attack (link host vs sender, look-alike or
free-mail sender, urgency x credential request, payment x secrecy, reward lures, shared-file lures) + a calibrated
logistic head. Trained on 12 sources (seven public corpora, Nazario and three more, and LLM-written phishing AND
legitimate mail), ~30k e-mails; 10% held out for calibration and thresholds. Thresholds are set on legitimate mail:
WARN = 1% false alarms, BLOCK = 0.1%, mapped onto the product's fixed 51 / 76 cut-offs. The keyword rules now only
explain (they fired on 25% of legitimate LLM-written mail); three or more independent rules set a BLOCK floor (never
seen on legitimate mail). Files: `AIML/embed_head.py`, `AIML/email/features_v2.py`, `AIML/email/v2/`.
Organisation retraining re-fits only the head on verified, redacted messages, with matched false-alarm budgets and
the same gate as the URL heads (`api/services/embed_retrain.py`, tests in `api/tests/test_embed_retrain.py`).

**E2 - next (needs a GPU, ~1 week): fine-tune a modern encoder.** LoRA-fine-tune DeBERTa-v3-base or ModernBERT-base
on the same 12 sources plus PhishFuzzer's LLM variants, selecting by *leave-one-source-out* (BDCC 2026), and keep it
only if it beats E1 on the frozen sets above at 1% / 0.1% FPR. Distil or quantise to stay under ~50 ms per message.

**E3 - next (2-3 days): signals the text cannot see.** SPF / DKIM / DMARC verdicts and Reply-To vs From from the
Gmail / Outlook add-on headers; display-name spoofing of the organisation's own executives (directory lookup);
attachment verdicts from the attachment pipeline; every link already goes through the URL pipeline.

**E4 - later: an LLM second opinion only in the uncertain band** (a local 7-9B model; diverse fine-tuning data per
the 2026 generalization study), behind prompt-injection defences (Clouding the Mirror), never overriding E1-E3.

**Known limits of E1 (measured):** 21% of LLM-written phishing is still below WARN at 1% false alarms; the LLM-written
evaluation set shares a generator with part of the training data, so its numbers are optimistic - the hand-written
set and the real legitimate mail are the honest ones.

## 6. Text / SMS / WhatsApp - step by step

**T1 - done (2026-11-01): v2 multilingual detector in production.** Frozen `intfloat/multilingual-e5-small` (covers
Urdu script and 100 languages; Roman Urdu only partly) + 22 region-aware features (asks for a code / PIN / CNIC /
money, authority claims - PTA, FBR, NADRA, BISP, banks, wallets - "sent by mistake" stories, prize-with-fee, safety
warnings like "never share this code") + calibrated head. Trained on real SMS (UCI), Indian templated SMS, short
modern phishing/legitimate messages, a Pakistani seed set and real-format transactional notifications (OTP, bank,
wallet, courier, utility - both kinds), all written with different wording from the evaluation guard. The old
"short message without a link is safe" shortcut is gone: one-line code-theft scams are short and have no link.

**T2 - next (continuous): real Pakistani data.** Collect verified reports from the WhatsApp guard and the report button
(the retraining loop already stores them redacted), add the PTA / bank-published scam samples, and an active-learning
queue for the uncertain band. This is the single biggest lever: there is no public Roman-Urdu smishing corpus.

**T3 - next (GPU, ~1 week): fine-tune a multilingual encoder** (XLM-R-base / mDeBERTa-v3 / multilingual-e5-base with
LoRA) plus a character-level channel for Roman-Urdu spelling variation (cf. the Bangla BERT + char-CNN result), and
region-aware tags as in the multi-signal smishing model (AUC 0.997 on 84k SMS).

**T4 - later: conversation-level detection for WhatsApp** (multi-turn scams build trust before the ask; see the 2026
conversational smishing datasets) and adversarial robustness tests (2026 smishing robustness study).

**Known limits of T1 (measured):** on the Pakistani guard set it still misses three scam families it has never seen
(a "card suspended, call and confirm your PIN" message, the "Mama, this is my new number, send money" family scam,
and an MPIN + OTP reply request) and flags one legitimate OTP format ("123456 is your verification code for
WhatsApp"). These are documented, not trained away: the evaluation set must stay unseen. Real reports (T2) close them.

## 6b. Message model M1: e-mail and text combined, context-aware (decided 2026-11-02)

**Why combine.** The v2 detectors are two frozen-embedding heads. A scam is the same attack in two shapes (the "CEO
needs gift cards" mail and the "Mama, new number, send money" WhatsApp), the Pakistani training set is tiny (180
messages) while the e-mail side has 98k, and a fine-tuned network shares what it learns about *requests* across both.
Research basis: pooled multi-corpus training transfers best (BDCC 2026); training-data diversity matters more than model
size (Jan 2026 fine-tuned-LLM study); a fine-tuned encoder is the production workhorse, LLMs are a second opinion at most
(DeBERTa vs GPT-4, 2024); multi-signal smishing models that combine semantic, structural and style streams beat any
single one (AUC 0.997, 2025); character-level help for low-resource scripts (Bangla BERT+CharCNN, 2025).

**Design (code: `AIML/message/`, trained by `AIML/message/kaggle/train_message_m1.py`).**
1. *Input is context*: channel, sender kind (organisation / free-mail / display-name that claims a brand / unknown),
   registered domains of every link and how they relate to the sender (link-not-sender-domain, shortener, raw IP,
   punycode, risky TLD), subject, body - plus a slot for the previous turns of a conversation. The history slot is wired
   but **untrained** (no public multi-turn Pakistani/Roman-Urdu data exists); it fills from verified reports (M3).
2. *Fine-tune the encoder end to end* (multilingual-e5-small, 100 languages incl. Urdu), not frozen, with the 54
   structural features concatenated at the head.
3. *Auxiliary intent heads* (9 multi-label targets from the lexicons): the network must say WHAT the message asks for.
   This is the XAI foundation: an explanation becomes a model output with its own measured accuracy
   (`intent_auc[...]` in metrics.json), not a regex run after the fact.
4. *Weights*: the modern LLM-written mail (1.8k rows) and the Pakistani / transactional seeds (700 rows) are repeated 3-8
   times; thresholds are fitted per channel at 1% / 0.1% false alarms.
5. *Two runs*: one on all data (to ship) and one with CEAS-08 held out entirely (the cross-corpus number a pooled
   in-distribution split hides).

**Gate to ship.** M1 replaces v2 only if, on the unchanged local evaluation sets (hand-written modern mail, 500 real
legitimate mails, LLM-written mail, live guard 12/12, UCI SMS, Pakistani SMS), it is at least as good on every one and
better on the weakest (LLM-written mail recall, Pakistani false alarms). Otherwise v2 stays and M1 is kept as the base for
the next data round.

**M2 - data, the real lever (next).** The honest ceiling of every number above is the training data. Three sources, in
order of value: (a) verified reports from real organisations through the retraining loop; (b) LLM-generated *and
human-reviewed* Pakistani scams and ordinary messages in English / Roman Urdu / Urdu, on templates disjoint from the test
set, with a held-out template family; (c) fresh public feeds (PhishTank / OpenPhish mails, Nazario updates).
**M3 - conversation context**: train the history slot on multi-turn data (WhatsApp scam scripts are multi-turn by nature).

**XAI layer (after M1 is gated; research first).** Planned, in the order they will be built and measured: (1) the intent
heads as the *what* of every verdict; (2) token-level evidence by integrated gradients / attention rollout on the
fine-tuned encoder, validated by deletion tests (remove the highlighted tokens: does the score fall?) and by agreement
with the intent heads; (3) counterfactual hints ("without the link to hbl-verify.top the score drops from 0.94 to 0.12");
(4) every explanation carries the measured faithfulness of its method. SHAP/LIME are not used (decision taken earlier;
scope text amended).

## 6c. Message models: what the 2025-26 papers say about hard legitimate mail, and what we do (2026-11-02)

**Findings and the decision each drives**

| Finding | Source | Decision |
|---|---|---|
| Metadata (full URLs, sender, attachment names) cut false alarms on valid mail (an LLM flagged 398 valid mails as phishing with subject+body only, 215 with metadata); spam vs valid is the weakest boundary and is partly subjective | PhishFuzzer benchmark, arXiv 2511.21448 (23,100 e-mails: 3,300 real seeds + 19,800 LLM variants; Phish / Spam / Valid) | Three classes, not two: promotions and newsletters become their own *spam* class (today they are labelled phishing); feed sender and link context to the model (M1 already does) |
| Text semantics is the robust signal: URL-only F1 0.33-0.55 on out-of-distribution mail vs 0.91-0.95 for the text encoder; the best system routes by uncertainty - confident URL verdicts decide, ambiguous mail goes to the fine-tuned encoder with the URL risk injected as input (macro F1 0.986 in-distribution, 0.950 / 0.944 on two real honeypot corpora from a decade of campaigns) | AURA, arXiv 2609.19873 (DistilBERT + LoRA, entropy routing, equal-weight evidential fusion) | Feed the v10 URL model's risk of each link INTO M1 as a feature, and route by uncertainty so the common case stays fast; evaluate on corpora from other decades, not a random split |
| 98% clean accuracy collapses to ~64% under adversarial rewriting for both TF-IDF+LR and fine-tuned DistilBERT; clean accuracy does not predict robustness; the two models fail on partly different e-mails | Ahmed & Pourmoafi 2026, arXiv 2607.18429 (82,255 e-mails, 6 corpora) | Adversarial test set (LLM paraphrase + character perturbation) is a release gate; keep a lexical/structural model beside the encoder (complementary errors) |
| LLM-written phishing in a bureaucratic register evades stylometric detectors; LLM judges can be steered by prompt injection and multilingual attacks | Frontiers 2026; arXiv 2512.10104 | Train on LLM paraphrases of every scam; LLM judge only in the uncertain band and never overriding a rule (U5) |
| Conformal calibration bounds the false-alarm rate but costs detection, and its guarantee breaks when the calibration data is contaminated or unrepresentative | Conformal-detection literature 2025-26 | Fit thresholds on legitimate messages from sources NOT in training (leave-one-source-out), per message type; measure false alarms per 1,000 messages, per legitimate class |
| Roman Urdu has one public labelled smishing set: 1,000 messages, 405 phishing / 595 legitimate, CC BY 4.0, template-aware evaluation | Siddiq 2026, Zenodo 10.5281/zenodo.21810885 | Used now as an independent test; later added to training with its templates held out |

**What we measured on independent sets (not trained on)**

| Set | Scams caught | Legitimate flagged | Note |
|---|---|---|---|
| ScamGuardBench v0.2 (EN/RO, 977 msgs, hard-legitimate by design) - v2 / blend | 91.9% / 99.3% | 40.5% / 65.3% | worst: courier, refunds, receipts, bank alerts |
| Roman Urdu smishing (Pakistan, 1,000 msgs) - v2 / blend | 87.7% / 93.6% | 11.9% / 12.8% | genuine bank OTPs and wallet confirmations 0% flagged; ATM transaction alerts 7% / 60%; "account hack warning" scams caught 3% / 16% |

Conclusion: on Pakistani messages the models are usable but not good enough; on generic look-alike legitimate mail they are not.
The data gap is specific: transaction/ATM alerts, receipts, delivery and utility notices (legitimate) and "your account was
hacked" style scams (missed). Generation targets these categories first.

## 7. Sources
- PhreshPhish: https://arxiv.org/abs/2507.10854 (full text read for the numbers above)
- URL robustness and leakage, Frontiers in Computer Science 2026: https://www.frontiersin.org/journals/computer-science/articles/10.3389/fcomp.2026.1834407/full
- URLTran: https://arxiv.org/pdf/2106.05256
- KnowPhish: https://www.usenix.org/conference/usenixsecurity24/presentation/li-yuexin ; PhishAgent: https://arxiv.org/abs/2408.10738 ; MemoPhishAgent: https://arxiv.org/pdf/2602.21394 ; PhishIntel: https://arxiv.org/pdf/2412.09057
- Clouding the Mirror (prompt injection vs MLLM detectors): https://arxiv.org/abs/2602.05484
- Cross-corpus fragility of phishing email detectors (BDCC 2026): https://mdpi-res.com/d_attachment/BDCC/BDCC-10-00211/article_deploy/BDCC-10-00211.pdf
- PhishFuzzer dataset: https://arxiv.org/abs/2511.21448 (abstract only); LLM-PEA: https://arxiv.org/pdf/2512.10104 (summary only)
- Diagnosing generalization failures in fine-tuned LLMs (phishing): https://arxiv.org/abs/2601.10524 (abstract only)
- Robust detection of conventional, LLM-generated and adversarial phishing email: https://arxiv.org/abs/2510.11915
- DeBERTa vs LLMs for phishing (SecureNet): https://arxiv.org/html/2406.06663v1
- Multi-signal evasive smishing: https://arxiv.org/abs/2505.18233 (abstract only); conversational smishing: https://arxiv.org/pdf/2604.11752 , https://arxiv.org/pdf/2606.06879 ; adversarial smishing robustness: https://arxiv.org/pdf/2608.12889 ; Bangla smishing BERT+char-CNN: https://arxiv.org/pdf/2502.01518
- URL redesign (U3b): Robustness-or-Artifact reproduction https://github.com/mutwassim/Robustness-or-Artifact- ; WebGuard++ https://arxiv.org/abs/2506.19356 (abstract) ; SpecularNet https://arxiv.org/abs/2603.01874 (abstract) ; URL2Graph++ https://arxiv.org/abs/2509.10287 (abstract) ; TCURL (Knowledge-Based Systems 2025) ; Small Language Models for phishing websites https://arxiv.org/html/2511.15434 (read) ; Least-to-Most prompting for URLs https://arxiv.org/abs/2601.20270 (abstract) ; homoglyph impact and NFKC/IDN defence https://injoit.ru/index.php/j1/article/view/2624 (summary)
- Message models 6c: PhishFuzzer https://arxiv.org/html/2511.21448v5 (read) ; AURA https://arxiv.org/abs/2609.19873 (full text read) ; adversarial robustness DistilBERT vs TF-IDF https://arxiv.org/abs/2607.18429 (full text read) ; Roman Urdu smishing set https://zenodo.org/records/21810885 ; ScamGuardBench https://huggingface.co/datasets/flowxai/scamguardbench
- Tranco list: https://tranco-list.eu ; Common Crawl / Internet Archive CDX for real URLs; allenai/c4 (ODC-BY)
- Datasets used here: puyang2025/seven-phishing-email-datasets, Dizzzy0x00/LLMGen-Phishing-Email-Dataset (apache-2.0), ucirvine/sms_spam, CloveAI/india-spam-sms (MIT), OpenPhish community feed
