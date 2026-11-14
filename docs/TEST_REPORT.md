# AegisOne - Test Report (model quality push)

Run 2026-11-01 / 11-02 on the final code in this repository, against a live API (`uvicorn api.main:app --port 8765`),
CPU serving. Raw output of every run is in `AIML/eval/results/`. Nothing below was used for training, calibration or
choosing thresholds, except where a line says so.

## 1. Result at a glance

| Suite | Result |
|---|---|
| Unit tests (`pytest api/tests`) | **89 passed** |
| Live API: tenant isolation | ALL PASS |
| Live API: incident response (report, back-trace, export, actions, verify) | ALL PASS |
| Live API: guided recovery + SLA | ALL PASS |
| Live API: endpoint smoke (every user/admin endpoint) | SMOKE OK |
| Live API: awareness, training, API keys, webhooks | ALL PASS |
| Live API: e-mail components regression guard | 12/12 phishing caught, 0/12 false alarms |
| Chrome extension in a real browser (Playwright, live API) | **17/17 PASS** |
| URL hard-case probe (Google Docs/Drive, OAuth, typosquats, ...) | 46/46 |

## 2. URL protection (full pipeline as served; WARN = risk >= 35)

| Set (never trained on) | Start of push | **Now** |
|---|---|---|
| 498 real deep links on popular sites, 158 Pakistani - false alarms | 31.7% | **2.4%** |
| 2,000 ordinary web pages (allenai/c4) - false alarms | 9.3% | **0.8%** |
| 300 phishing URLs from the OpenPhish feed of 2026-11-01 - caught | 84.3% | **94.0%** |
| ... with a famous domain injected as a subdomain - caught | 99.7% | **100%** |
| ... with benign-looking path padding - caught | 37.7% | **89.7%** |
| Latency per URL, CPU | 107 ms | **53 ms** |

Model-level (PhreshPhish test split, later in time than all training; 168,060 URLs): AUC 0.994; **93.3%** caught at
1% false alarms (95% CI 93.0-93.5), **80.6%** at 0.1% (77.9-82.1). Held-out attack family never seen in training
(TLD swap): **92.6%** caught. Typosquats 99.95%, homoglyph/Punycode 100%, real brand-domain pages wrongly flagged 0.0%.

**Page model, login pages** (5,000 real PhreshPhish test pages incl. HTML, 1,430 with credential fields):

| | Phishing caught | Legitimate flagged |
|---|---|---|
| URL model only | 88.5% | 2.0% |
| URL + page model (shipped, `mean`) | **93.5%** | **1.4%** |

Page model alone on its 61,010-page test split: AUC 0.997, 97.2% caught at 1% false alarms, 85.9% at 0.1%.

## 3. E-mail (the unified message model M1 blended with the v2 detector; WARN = 51)

| Set | v2 (before) | **Now** |
|---|---|---|
| 176 hand-written modern mails (56 legitimate): AUC | 0.996 | **0.998** |
| ... phishing caught / legitimate flagged | 98.3% / 1.8% (1 mail) | 98.3% / 3.6% (2 mails) |
| ... caught at a fixed 0.1% false-alarm rate | 90.8% | **98.3%** |
| 1,000 LLM-written mails (500 legitimate): AUC | 0.981 | **0.998** |
| ... phishing caught / legitimate flagged | 78.8% / 1.6% | **90.0% / 1.0%** |
| ... caught at a fixed 1% / 0.1% false-alarm rate | 76.8% / 49.8% | **94.8% / 79.0%** |
| 500 real legitimate mails flagged | 0.6% | **0.2%** |

One regression, stated plainly: false alarms on the hand-written set went from 1 to 2 mails of 56 (the sample is
small; the same threshold gives 0.2% on 500 real mails).

## 4. Text / SMS / WhatsApp (M1 blended with the v2 detector)

| Set | v2 (before) | **Now** |
|---|---|---|
| 200 Pakistani messages (110 scams; English, Roman Urdu, Urdu): AUC | 0.977 | **0.999** |
| ... scams caught / legitimate flagged | 81.8% / 5.6% | **99.1% / 3.3%** |
| 1,100 real SMS (UCI): AUC | 0.993 | **0.997** |
| ... scams caught / legitimate flagged | 90.7% / 0.6% | **95.0% / 0.6%** |
| ... caught at a fixed 0.1% false-alarm rate | 75.0% | **92.7%** |
| 600 India SMS (templated): caught / flagged | 99.7% / 0% | **100% / 0%** |

M1 trained *without* one whole corpus (CEAS-08, 11,936 mails) still scored AUC **0.9994** on it with 1.9% false alarms:
the cross-corpus test that in-distribution splits hide.

## 5. Browser extension (real Chromium, unpacked extension, live API) - 17/17

service worker starts; popup sign-in; token stored AES-GCM encrypted and no readable JWT anywhere in storage; widget
appears on an ordinary page with no warning; fake bank page raises the phishing warning; typing a password raises the
credential alert; dangerous link flagged in the normal DOM, in a shadow DOM and in an iframe; safe link not flagged; QR
code decoded and its destination rated risky; click on a risky `.exe` stopped; download guard holds the file and asks;
no visited phishing address readable in extension storage.

## 6. Defects found and fixed during testing

| Defect | Found by | Fix |
|---|---|---|
| Every browser start wiped all extension storage: users signed out, configured server address forgotten | extension browser test | `clearAllCache` removes only scan-result entries |
| Brand rule matched pieces of ordinary words ("comcast" in `manufacturers.com.tw`; "twitter" via the alias `x.com` in `olx.com.pk`) and fired on 12.4% of popular links, and 4.6% of ordinary pages | reading the false alarms of the URL pipeline | whole-token / misspelling / lure-word matching on the registered domain: 0.0% popular, 0.0% ordinary |
| Popularity list hid phishing on `*.blogspot.<country>`, e-mail click-trackers (`sendgrid.net`) and wildcard DNS (`sslip.io`): 240 of 2,347 phishing pages | miss analysis on real test pages | treated as hosting; a very confident network score is no longer capped by domain popularity |
| Punycode look-alike (`xn--pypal-4ve.com`) not matched to its brand | hard probe | host decoded before matching |
| A trained-model feature (typosquat generator) could produce the real brand domain and label it phishing | review of the training-data code before the run | generator rejects results equal to the brand |
| Fine-tuned message model over-confident outside its training corpora (12.5% false alarms on hand-written mail at its own threshold) | held-out evaluation | blended with the v2 detector, e-mail WARN set at its 0.1%-false-alarm point |

## 8. Independent check that exposes a weakness (ScamGuardBench v0.2, added 2026-11-02)

ScamGuardBench (flowxai, Apache-2.0; 631 scams and 346 deliberately scam-like *legitimate* messages, English and Romanian,
SMS and e-mail) was never used for training. Results at WARN = 51 (`AIML/eval/eval_scamguard.py`):

| | Scams caught | Legitimate messages flagged | AUC |
|---|---|---|---|
| v2 detectors | 91.9% | **40.5%** | 0.892 |
| M1 + v2 blend (current default) | 99.3% | **65.3%** | 0.913 |

Legitimate messages flagged by class (blend): courier notices 87%, refund confirmations 87%, subscription receipts 85%,
bank transaction alerts 69%, bank OTPs 70%, utility reminders 62%, government notices 61%, genuine family "send me money"
texts 46%, promotions 96%. Romanian scams are caught (99%) but 87% of legitimate Romanian messages are flagged.

What this means, without softening it:
- **The sets used in sections 3-4 contain few hard legitimate messages** (ordinary SMS, ordinary mail). On messages
  that *look* like scams but are genuine - the ones that make users switch a filter off - the current text/e-mail models
  are not usable: they flag most of them, and the M1 blend flags more than v2 alone.
- The benchmark is synthetic and adversarial by design, Romanian is a language we never trained on, and our training
  treats promotional SMS as positive (UCI "spam"), which this benchmark labels legitimate. So 40-65% overstates what a
  user would see, but the direction is real and consistent across every legitimate class.
- Ranking improved (AUC 0.892 -> 0.913) while the operating point got worse: thresholds fitted on easy legitimate
  traffic are too low for this traffic.
- **The next data round must be hard legitimate messages** (bank OTP and alert formats, courier, receipts, utility,
  government, genuine requests for money between people), in English, Roman Urdu and Urdu, and thresholds must be fitted
  on them. Until then the message models should be described as strong on scams and unproven on look-alike legitimate mail.

## 7. Limits of this evidence

- Test data is public benchmark data plus sets we wrote; **no real organisation traffic** has been measured yet.
- The e-mail WARN setting above was chosen after seeing the first e-mail numbers (one principled choice between two
  considered, not a sweep); treat the e-mail figures as slightly optimistic and re-measure on fresh data.
- LLM-written mail is evaluated with the same generator family that supplies part of the training set; the independent
  check is the hand-written set.
- Hand-written test sets are small (176 mails, 200 messages); differences of one or two messages are noise.
- Image model, attachment analysis and the WhatsApp conversation-context slot were not retrained or evaluated here.
- Docker (2026-11-06): `Dockerfile.backend` builds (a fix was needed: the Hugging Face Xet token endpoint answers 404 for
  older model repos, so the backbone download step now sets `HF_HUB_DISABLE_XET=1`) and the container starts with all
  models loaded (URL v10, page model P1, M1, v2 e-mail and text heads, image, attachments). The image is large (about 6 GB
  of layers; torch 1 GB, backbones 1.2 GB, `AIML/` 2.4 GB); superseded URL generations and the M1 training bundle are now
  excluded by `.dockerignore`. Model weights (URL v10 128 MB, page model 128 MB, M1 225 MB) exceed GitHub's 100 MB file
  limit: `*.safetensors` is now tracked by Git LFS in `.gitattributes`, but nothing has been pushed.

## 9. Head-to-head against other detection services (first look, 2026-11-02)

Harness: `AIML/eval/headtohead.py` (`collect` / `check` / `poll` / `report`). Fresh phishing URLs are collected from the
public feeds (48-hour window), genuine URLs come from the Tranco popular list, and every engine is asked about the
same URLs. 303 fresh phishing URLs, 2,000 genuine URLs.

| Engine | Phishing caught | Genuine flagged |
|---|---|---|
| **AegisOne (URL v10, WARN = 35)** | **89.8%** (272 / 303) | **0.9%** (about 18 / 2,000) |
| Google Safe Browsing (v4 API) | 27.7% (84 / 303) | 0.05% (1 / 2,000) |
| VirusTotal (aggregates 70+ engines) | 100%, **not independent** | 0% on only 147 genuine URLs checked |
| OpenPhish / PhishingDB / PhishTank feeds | not comparable | not comparable |

Read this carefully:
- The phishing URLs were taken from the OpenPhish feed, and VirusTotal pools OpenPhish, so its 100% says nothing about
  how it would do on a site no feed has seen. The feed rows have the same circularity (PhishTank refused our download).
  The only fair rival in this table is Google Safe Browsing, and AegisOne catches about 3.2 times as many of these sites,
  at the price of roughly 16 more false alarms per 2,000 genuine links.
- 31 of the 303 phishing URLs were missed. An earlier, different sample of 300 OpenPhish URLs gave 94.0% (section 2),
  so some of the gap is sample noise.
- **Zero-day lead time is not measured yet.** The first run only compares query times (all engines were asked within a few
  hours of each other). A real figure needs re-checks of the not-yet-flagged URLs at +1 h, +6 h, +24 h and +72 h
  (`headtohead poll`), and about 2,000 phishing URLs, which takes roughly a week of daily collection
  (about 300 fresh URLs appear per 48-hour window).

## 10. User-interface pass (2026-11-06; UI only, no behaviour or structure changes)

Method: the Vercel Web Interface Guidelines review plus screenshots of the landing page, sign-in, the admin, manager
and employee dashboards (light and dark) and the extension popup, before and after. Re-run after the changes:
extension browser test **17/17 PASS**, dashboard `tsc` clean, landing `tsc` clean and production build OK.

| Finding | Change |
|---|---|
| Three competing blues (royal `#0A5ED6` x410, brand `#4A7FA7`, indigo/violet in 97+87 places); off-palette dark navy `#141A29` and `#4F84F8`; indigo/purple in the extension popup | Everything mapped onto the Sovereign Blue tokens of `design.md` (1,086 colour literals in 73 files, plus the extension). Brand blue `#3D6C90` is used wherever white text sits on it (AA contrast) |
| No visible keyboard focus anywhere in the dashboard; the popup removed outlines globally | `:focus-visible` rings on all controls, reduced-motion support, `touch-action`, balanced headings |
| 256 uses of `transition-all` | Limited to the properties that actually change (global rule) |
| Icon-only buttons without names (sidebar toggle, menu, bell, activity, settings, popup toggles) | `aria-label` / `aria-expanded` added; search box labelled |
| Landing hero claimed "99.8% threat prevention", "Zero productivity loss", "< 15 m deploy", "100% privacy", "10K+ threats blocked", "< 50 ms" | Replaced with measured values from this report (93% caught at 1% false alarms on a held-out set, 0.8% false alarms on ordinary pages, < 200 ms per link on CPU, on-prem) and a footnote saying how they were measured |
| Translucent header let page text show through; all-caps hero headline; heavy cookie banner with an emoji and a Decline that did not persist | Solid navy header, sentence-case headline, compact banner, Decline remembered, anchored sections clear the fixed header |
| Contact form sent twice per click and bypassed the browser's required-field check (a click handler on the button's wrapper as well as the form) | Handler removed; fields named, labelled, with autocomplete |
| Testimonials from named companies that do not exist, rainbow avatars | Labelled "Sample feedback written to illustrate typical use - not endorsements"; avatars on palette. **Replace with real quotes before a public launch** |
| Popup used emoji as icons and tab labels | Line icons (inline SVG), text tab labels, brand logo |
| One 1.3 MB script for every landing route | Secondary routes (register, login, portal, admin, docs) load on demand |

Not changed: in-page emoji inside the extension's warning dialog and widget (about 100 strings, some drive logic such as
the "has emoji" check); an icon pass there needs its own test cycle.

## 11. Look-alike genuine messages: second training round (2026-11-06)

What changed: 4,018 new training messages (English and Roman Urdu, SMS and e-mail; 2,054 genuine messages that *look*
like scams - OTPs, bank and card alerts, courier, receipts, utility, government, family money requests, promotions - and
1,964 scams imitating the same formats), written by Qwen2.5-7B-Instruct on Kaggle (`AIML/message/kaggle/gen_hard_messages.py`),
never shown the evaluation sets. The Urdu-script output (1,101 rows) was thrown away after reading samples: it was garbled.
M1 was retrained on 102,567 messages and the v2 e-mail and text heads were refitted; thresholds were refitted on a
hold-out that now contains these hard genuine messages.

Independent benchmark (ScamGuardBench v0.2, never used for training or thresholds; blend = shipped default, WARN = 51):

| | Scams caught | Genuine look-alikes flagged | AUC |
|---|---|---|---|
| Before (blend, section 8) | 99.3% | **65.3%** | 0.913 |
| **After (blend)** | **93.7%** | **19.4%** | **0.950** |
| After, M1 alone | 96.8% | 27.7% | 0.952 |
| After, v2 heads alone | 84.2% | 19.4% | 0.916 |

Genuine messages flagged by class after the change: government notices 3%, subscription receipts 9%, utility reminders 9%,
courier 10%, refunds 17%, family money requests 21%, bank OTPs 24%, promotions 25%, OTP "never share" notices 31%,
bank transaction alerts 48%. Romanian (a language never trained on): scams caught 90%, genuine flagged 22%.

Regression sets (same sets as sections 3, 4 and 6; before -> after, blend at WARN):

| Set | Scams caught | Genuine flagged |
|---|---|---|
| 176 hand-written mails | 98.3% -> 98.3% | 3.6% -> **0.0%** |
| 1,000 LLM-written mails | 90.0% -> 89.8% | 1.0% -> 1.2% |
| 500 real legitimate mails | - | 0.2% -> 0.4% |
| 200 Pakistani messages | 99.1% -> 96.4% | 3.3% -> **0.0%** |
| 600 India SMS | 100% -> 100% | 0% -> 0% |
| 1,100 real SMS (UCI) | 95.0% -> **85.7%** | 0.6% -> 0.1% |
| 1,000 real Pakistani SMS (Roman Urdu) | 93.6% -> 87.9% | 12.8% -> **0.0%** (AUC 0.972 -> 0.992) |

Honest reading:
- The target (under 5% false alarms on the benchmark at 90% or more of scams caught) is **not met**: 19.4% false alarms at
  93.7%. The false-alarm rate fell by two thirds and the ranking improved, but bank transaction alerts (48%), "never share
  this code" notices (31%) and promotions (25%) are still flagged too often, and Romanian is unseen.
- The price: UCI SMS scam recall fell 95.0% -> 85.7% because genuine promotional messages are now labelled safe while UCI
  counts promotions as spam. Real Pakistani "account hack warning" scams are still missed (0 of the family caught).
  A separate "promotion" class (so marketing can be shown as a notice, not a threat) is the right fix, not another threshold.
- The new messages are machine-written, so part of the improvement may be style learned from the generator; the
  benchmark and the Roman Urdu set are independent of it, and both improved.
- Next: a human-written hard-genuine set for the weak classes (transaction alerts, OTP notices), a promotion class, and
  retraining with Romanian-like unseen-language data.

## 12. One English text model (2026-11-07)

Decision: the product supports English only, and there is ONE text model for e-mail, SMS and chat. M1 was retrained on
`BAAI/bge-small-en-v1.5` (33M parameters, was 118M multilingual), on 103,391 English messages including 9,870 cleaned
machine-written hard messages (bank and card alerts, "never share this code" notices, promotions, account-security
notices and the scams that imitate them, written for varied banks, brands and regions; formatting artefacts removed).
M1 alone scores messages by default; an organisation's own retrained v2 head (module 8.11) is blended in only once active
(`AEGIS_MESSAGE_ENGINE=ensemble` restores the old blend). The weights are about 67 MB (was 236 MB).

Independent benchmark (ScamGuardBench v0.2, never used for training or thresholds), English part only (610 messages):

| | Scams caught | Genuine look-alikes flagged | AUC |
|---|---|---|---|
| Blend, start of this work (all 977 messages) | 99.3% | 65.3% | 0.913 |
| Blend after round 2 (all 977) | 93.7% | 19.4% | 0.950 |
| **Single English model, English messages** | **96.5%** | **9.1%** | **0.977** |

Adversarial "hard" scams of the benchmark: 20 of 20 caught. Genuine messages flagged by class (English): bank OTPs 0%,
courier 0%, government 0%, promotions 0%, refunds 0%, "never share" notices 5%, utility 6%, receipts 6%, family money
requests 12%, **bank transaction alerts 41%**, untagged 18%. The 5% target is still **not met** (9.1%); bank transaction alerts
are the one class left that is really weak.

Regression sets (blend after round 2 -> single English model; WARN):

| Set | Scams caught | Genuine flagged |
|---|---|---|
| 176 hand-written modern mails | 98.3% -> 93.3% | 0.0% -> 0.0% |
| 1,000 LLM-written mails (same generator family as part of the training data: optimistic) | 89.8% -> 99.0% | 1.2% -> 0.0% |
| 500 real legitimate mails | - | 0.4% -> 0.0% |
| 600 India SMS | 100% -> 100% | 0% -> 0% |
| 1,100 real SMS (UCI) | 85.7% -> 92.0% | 0.1% -> 0.5% |
| 200 Pakistani hand-written messages, English part (119) | - | **100% caught / 0% flagged** |
| 200 Pakistani hand-written messages, all (81 are Roman Urdu or Urdu) | 96.4% -> 72.7% | 0.0% -> 0.0% |

**Cost of dropping other languages, stated plainly:** Roman Urdu and Urdu scams are no longer reliably caught by the text
model (real Pakistani Roman Urdu SMS: scams caught 87.9% -> 39%, genuine flagged 0%; AUC 0.967). The URL model, the page
model and the rules still protect against the links in such messages. Speed: median **79 ms**, p95 129 ms per message on a CPU.

End-to-end checks on this build: 89 unit tests pass; extension in a real browser 17/17; live API: e-mail guard 12/12 caught
and 0/12 false alarms, endpoint smoke OK, tenant isolation ALL PASS, incident recovery ALL PASS.

## 13. Scope gaps closed (2026-11-14): QR payloads, WhatsApp Web, BEC, behavioural anomalies, adversarial rewrites

**QR codes** (`api/services/qr_payload.py`, `content_router.route_qr_payload`). Nine generated codes through the real pipeline:

| Code contains | Before | After |
|---|---|---|
| `http://paypa1-secure-login.xyz/verify?acct=7` | URL model, 96 | same |
| `https://www.google.com/search?q=weather` | URL model, 0.2 | same |
| `http://xk3-account-update.top?id=9` (no slash before `?`) | text model + URL model | URL model, 99.6 |
| `https://bit.ly/...` | URL model on bit.ly only | link followed (SSRF-guarded), final destination scored too |
| `javascript:alert(1)` | **legitimate, 35.5** | 97 (runs code) |
| `upi://pay?...` | text model, by chance | 62 (payment request) |
| `WIFI:...` | legitimate | 45 (55 for an open network), shown as "Joins Wi-Fi" |
| `mailto:` | text model | text model + 40 floor |
| plain scam text | text model, 98.5 | same |

WhatsApp Web pictures are `blob:` URLs and were skipped by the QR guard; they are now read in the page and decoded.

**WhatsApp Web.** The server analyser (`whatsapp_analyzer.py`) called the models with an argument they do not take and without awaiting them, so every message came back "safe" with no model output; the extension had been scanning in the browser instead and nothing reached the WhatsApp analytics. Rewritten and measured on six inputs: scam text + link -> phishing 99; Roman Urdu/English chat -> safe 3; genuine bank alert -> safe 1; link only in the resolved href -> phishing 96; QR picture with a phishing link -> phishing 96; QR picture with `javascript:` -> phishing 97. The extension now sends batches to `/scan/whatsapp/batch`, unwraps `l.wl.co` links, records the sender, and asks before opening a link in a message flagged dangerous. **Not tested in a real WhatsApp Web session** (the guard only runs on web.whatsapp.com).

**Business e-mail compromise** (`api/services/bec.py`): 6 hand-made cases. CEO title on Gmail asking for gift cards -> high; look-alike domain (`lnara.com` vs `inara.com`) asking to change bank details -> high; display name `"ceo@inara.com"` from Outlook asking for a wire -> high; Reply-To to another domain asking for payroll change -> high; genuine vendor invoice reminder -> no floor; colleague lunch mail -> none. Hand-made only: no labelled BEC corpus was used.

**Behavioural anomalies** (`api/services/behavior_anomaly.py`, `GET /admin/behavior/anomalies`, admin Analytics panel). Unit-tested on synthetic histories (burst of blocks flagged, quiet day low, sign-in on a flagged site always high). **Not validated on real incidents** - unsupervised, thresholds chosen by hand.

**Adversarial rewrites** (`AIML/message/normalize.py`, gate `AIML/eval/adversarial_text.py`): 200 English scams (ScamGuardBench + hand-written), 196 caught in clean form, each evasion applied to every keyword:

| Scams still caught (%) | zero-width | look-alike letters | leetspeak | spaced letters | defanged link | alternating case | all combined | genuine flagged |
|---|---|---|---|---|---|---|---|---|
| without normaliser | 98.5 | 99.0 | 99.0 | 99.5 | 97.4 | 100 | **92.9** | 13.1 |
| with normaliser | 100 | 100 | 98.0 | 100 | 100 | 100 | **100** | 13.1 |

Gate: PASS. The sub-word encoder was already fairly robust to single tricks; the normaliser matters most when they are combined (92.9 -> 100) and costs nothing on genuine messages. Leetspeak is one message worse (99.0 -> 98.0). These are character-level evasions only: LLM paraphrasing (Ahmed & Pourmoafi 2607.18429) is **not** covered. (The 13.1% genuine figure is on the combined ScamGuardBench + hand-written genuine set at a single 0.51 threshold, so it differs from section 12.)

Backend unit tests: 100 passed (11 new in `api/tests/test_scope_gaps.py`). Dashboard type check passes.

## 14. Open-source models on the same data, and the URL second opinion (2026-11-14)

Harness: `AIML/eval/open_baselines.py` (stages `ours` / `open` / `report`). Every model sees the same 2,498 genuine URLs
(popular-site deep links + long-tail web) and 599 fresh OpenPhish URLs (1 Nov and 14 Nov feeds, none in any training
file). "Caught @x%" uses each model's own threshold set so that x% of the genuine URLs are flagged, so different score
scales are compared fairly. Open models were downloaded from Hugging Face with their licences checked.

| Model | Licence | AUC | Caught @1% | Caught @0.1% | AP @1% phishing |
|---|---|---|---|---|---|
| **AegisOne final** | ours | **0.992** | **91.7%** | 32.9% | 0.598 |
| AegisOne neural network only | ours | 0.800 | 58.8% | 24.7% | 0.460 |
| kmack/malicious-url-detection (DistilBERT) | Apache-2.0 | 0.957 | 52.3% | 22.7% | 0.432 |
| ealvaradob/bert-finetuned-phishing (BERT-large) | Apache-2.0 | 0.924 | 46.9% | 3.0% | 0.270 |
| imanoop7/bert-phishing-detector | MIT | 0.587 | 0.0% | 0.0% | 0.013 |
| **AegisOne + kmack (logistic stacker, 5-fold out-of-fold)** | – | **0.994** | **92.3%** | **55.1%** | **0.805** |

- AegisOne alone beats every open model by a wide margin (91.7% vs at best 52.3% caught at 1% false alarms).
- Combining with kmack helped; combining with the other two did not (stacked: -1.2 and -4.3 points at 1%).
- Bootstrap (1,000 resamples) for AegisOne + kmack vs AegisOne alone: AP gain +0.21 (95% CI +0.14 to +0.27, always
  positive); caught @0.1% +22 points (positive in 91% of resamples); caught @1% no clear change.
- Temporal check (fit on the 1 Nov feed + half of the genuine URLs, test on the 14 Nov feed + the other half, 20 splits):
  with kmack allowed only to raise WARN to BLOCK, phishing blocked 90.3% -> 91.0% and genuine URLs wrongly blocked
  0.84% -> 0.88%; warnings unchanged. Letting the combined score decide everything blocked more (92.4%) but varied
  more (false blocks 0.56-1.52%), so it is not used.

Shipped as the **URL second opinion** (`api/services/second_opinion.py`, config `AIML/url/second_opinion/config.json`
written by `AIML/eval/fit_second_opinion.py`): kmack at a pinned revision, baked into the backend image, local files
only. Admin modes: off / show only / can raise to block (default). It never lowers a verdict, never changes SAFE,
and never runs on rule overrides. Extra time about 85-110 ms per URL on CPU after warm-up (first call ~1.2 s while the
model loads). The admin AI Models page shows the table above, the mode switch and live agreement counters.

Limits: 599 phishing URLs from one feed; at 0.1% false alarms only 2-3 genuine URLs decide the threshold, so that
column is noisy. The stacker and threshold should be re-fitted on each new weekly feed before trusting the gain.

Backend unit tests: 107 passed (7 new in `api/tests/test_second_opinion.py`). Dashboard type check passes.
