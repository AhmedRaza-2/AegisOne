# AegisOne - Completion Status vs the Scope Document

Last updated 2026-11-06. "Verified" means it ran against a live server in this repository (scripts in `api/tests/live/`) or in the unit-test suite (`api/tests`, 48 tests). Anything not verified is said so.

## 1. Scope items

| Scope item | Status | Notes |
|---|---|---|
| 7.1 URL scan, fake login, credential interception, brand impersonation | Done | URL neural pipeline on by default, measured in `URL_MODEL_EVALUATION.md` |
| 7.1 QR code validation | Done | Server decode (OpenCV) for images, WhatsApp and email; extension QR guard shows the decoded destination under the code |
| 7.2 Email link / text / image components | Done | `/analyze/email` returns wording, link and image components and which one drove the verdict; links are scored by the URL pipeline |
| 7.3 ML classification, risk 0-100, XAI | Done | Evidence-grounded XAI replaces SHAP/LIME (scope text amended) |
| 7.3 Domain age | Done | Real RDAP lookup, cached, "unknown" when it can't be determined |
| 7.4 Webhooks, SIEM, enterprise API, threat feed | Done | Signed webhooks, `/api/v1/*` with scoped keys, CEF output, org block/allow list feed |
| 7.5 / 7.7 Reporting and export | Done | Incident CSV, printable report, full back-trace |
| 7.7 Real-time alerts | Done | In-app bell, SMTP email, webhooks on escalation, new high-severity incidents, critical blocks |
| 7.7 Multi-tenant | Done | Verified with a two-tenant live test |
| 7.7 Subscription access | Partial | License with seat limit, plan and expiry enforced; per-plan feature limits (usage metering) are not built (option C was not chosen) |
| 7.6 Docker / on-prem | Done | Prod compose with TLS proxy, backups; Kubernetes/Helm not built (option B was not chosen) |
| 8.1 Authentication | Done | In-house accounts; Google OAuth dropped on purpose and the scope text amended |
| 8.5 Dashboard | Done | Mock data removed; admin Organizations page now real |
| 8.6 Active prevention / extension coverage | Done, browser-tested (2026-11-01) | All links, shadow DOM, iframes, QR codes, downloads; `Extension/tests/e2e_extension.py` drives the real extension in Chromium against a live API: 17/17 |
| 8.7 Incident reporting | Done | Back-trace, CSV, printable report, SSRF-guarded redirect tracer |
| 8.8 Enterprise deployment | Done (option A) | License key + organization id enforced on every request, seat limit, API keys, webhooks |
| 8.9 Network security | Done | Caddy TLS proxy, HTTP->HTTPS, database not published, `/setup` needs an admin |
| 8.10 Client-side protection | Done, browser-tested (2026-11-01) | Tokens, event log, scan cache (keyed-hash names) and download list AES-GCM encrypted; e-mail verdict cache in memory-only session storage; verified that no JWT or visited phishing address is readable in extension storage |
| 8.11 Retraining | Done for URL, e-mail and text | URL: server-side head fine-tuning + vendor Model Hub. E-mail and text (v2 detectors, 2026-11-01): the head is re-fitted on verified, redacted messages with an equal false-alarm budget and the same regression gate (`api/services/embed_retrain.py`, tests reject redundant and poisoned updates, accept a new lure). Image: calibration layer only |
| 8.13 Awareness and simulation | Done (option A) | Template library, tracked links, per-employee results, teaching page, training modules with quizzes |
| 8.14 FP / FN management | Done | Verified false positive allow-lists the domain for the whole organization |
| 8.15 Guided recovery | Done (2026-11-01) | Playbooks per incident type with tracked steps (who ticked what, when, with notes); one-click containment and recovery: block / allow domain, notify exposed people, sign them out of every session, sign out + e-mail a password-reset code, assign the matching training module, warn the whole organization; response-time SLA per severity (15 min critical ... 24 h low) with automatic escalation (bell + e-mail + webhook) when nobody responds; time to acknowledge / contain / resolve and SLA compliance on the incident page and in the printable report. Verified by `api/tests/test_incident_recovery.py` and `api/tests/live/live_incident_recovery.py` |

## 2. Defects found and fixed in this push
- Cross-tenant leaks in `/setup`, `/communication`, `/user/*`; ingest endpoints trusted a client-supplied organization (now the token's).
- `/setup/reset-organization` wiped the whole database; now only the caller's organization.
- WhatsApp sender-hash key was a constant in source; now per deployment.
- `/policy/allowlist` always crashed (invalid model arguments).
- Password-reset e-mail could be sent through another tenant's SMTP account.
- A device id registered to one organization could be claimed from another.
- Substring checks treated `microsoft.com.evil.xyz` as the real Microsoft site, switching protections off.
- On Windows with redirected output, an emoji `print` made the first URL scan crash.
- The seeded "global releases" had made-up metrics and a hard-coded "evaluation passed"; removed.
- Fabricated dashboard values (compliance 100%, employee count 50, license "AEGIS-<id>") removed.

## 3. Open items (honest list)
1. **URL model.** v10 (gte-small + character CNN, PhreshPhish + 209k long-tail web URLs + mutation families, Kaggle T4 x2) is the default, with a page model for login pages: popular-site false alarms 31.7% -> 2.4%, long-tail 9.3% -> 0.8%, today's OpenPhish caught 84.3% -> 94.0%, padded phishing 38% -> 90%. Remaining: phishing on compromised popular domains, image-only pages, data ends Dec 2025 (weekly refresh). Details in docs/MODEL_CARDS.md.
2. **E-mail and text: v2 + the unified message model M1 (blend, shipped 2026-11-02; docs/TEST_REPORT.md).** LLM-written mail caught 79% -> 90%, Pakistani scams 82% -> 99%, false alarms equal or lower except one 1-mail difference on a 56-mail set. Remaining: more real Pakistani data, conversation context, human-labelled intents. v2 limits (measured, before M1): 21% of LLM-written phishing still below WARN; three Pakistani SMS scam families unseen in training are missed and one OTP format is flagged. Real verified reports through the retraining loop close these.
3. **Image model** still uses the calibration layer only (no head retraining).
4. **License verification needs the vendor registry.** Run `frontend/landing/supabase/harden_organizations.sql` and `verify_license.sql` in the vendor Supabase project (the portal install command now sets `AEGIS_REGISTRY_URL` / `AEGIS_REGISTRY_KEY`). Until the SQL is run the key is reported as "unverified" and `warn` mode never blocks. The organizations table was readable with the public key before `harden_organizations.sql`; credentials issued earlier must be rotated.
5. **Evaluator comment: "UI alignment / report glitches"**: audited visually on 2026-11-06 (landing, sign-in, three dashboards in light and dark, extension popup); consistency, accessibility and honesty fixes are listed in docs/TEST_REPORT.md section 10. Traceability and non-static XAI are done.
6. CI added (`.github/workflows/ci.yml`: type check and build of both frontends, backend unit tests; the backend job needs Git LFS weights, so run `git lfs track` / push the models first). Teammate branch `aegisone-updated` still unreviewed.
8. **Look-alike genuine messages.** Second training round done 2026-11-06 (docs/TEST_REPORT.md section 11): false alarms on genuine look-alikes 65.3% -> 19.4% (scams caught 99.3% -> 93.7%), real Pakistani SMS false alarms 12.8% -> 0.0%. The release gate (under 5% false alarms at 90% of scams caught) is **not yet met**. Round 3 (2026-11-07, docs/TEST_REPORT.md section 12): one English-only text model; English benchmark false alarms 9.1% at 96.5% of scams caught; only bank transaction alerts (41%) remain weak. Roman Urdu and Urdu are no longer supported by the text model (decision: English only).
9. **Head-to-head and zero-day lead time.** First comparison done (docs/TEST_REPORT.md section 9: AegisOne 89.8% / 0.9% vs Google Safe Browsing 27.7% / 0.05%); lead time needs the scheduled re-checks and about a week of daily URL collection.
10. **Model weights exceed GitHub's 100 MB limit** (URL v10 and page model 128 MB each, M1 225 MB). `*.safetensors` is now tracked by Git LFS in `.gitattributes`; the files must be added through LFS before pushing. The backend image copies `AIML/` as-is.
7. Helm chart and per-plan usage limits not built (options B and C not selected).

## 4. Verification evidence
| Check | Result |
|---|---|
| `pytest api/tests` | 48 passed |
| `live_tenant_isolation.py` | ALL PASS |
| `live_incident_response.py` | ALL PASS |
| `live_endpoint_smoke.py` | SMOKE OK |
| `live_awareness_integrations.py` | ALL PASS (49 checks) |
| `live_model_hub.py` | ALL PASS: train -> submit -> vendor benchmark -> promote -> org validates and deploys -> revert |
| `live_email_components.py` | regression guard OK |

## 5. Decisions taken
- Google OAuth dropped; SHAP/LIME replaced by evidence-grounded XAI; both documented in the scope document.
- 8.4 accepted as implemented.
- Retraining runs on servers only. Organizations share a ~1 MB heads package (never raw data) with the vendor hub, which benchmarks it against the current baseline and promotes it automatically if it is better and regresses nothing.
- 8.8 = option A (Compose + TLS + license/seat enforcement). 8.13 = option A (templates, tracked links, results, training). 8.15 = playbooks + alerts + webhooks.
