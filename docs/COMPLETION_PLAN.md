# AegisOne - Completion Status vs the Scope Document

Last updated 2026-10-24. "Verified" means it ran against a live server in this repository (scripts in `api/tests/live/`) or in the unit-test suite (`api/tests`, 48 tests). Anything not verified is said so.

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
| 8.6 Active prevention / extension coverage | Done, not browser-tested | All links, shadow DOM, iframes; automatic image scanning; needs a manual run in Chrome |
| 8.7 Incident reporting | Done | Back-trace, CSV, printable report, SSRF-guarded redirect tracer |
| 8.8 Enterprise deployment | Done (option A) | License key + organization id enforced on every request, seat limit, API keys, webhooks |
| 8.9 Network security | Done | Caddy TLS proxy, HTTP->HTTPS, database not published, `/setup` needs an admin |
| 8.10 Client-side protection | Done, not browser-tested | Extension tokens and event log AES-GCM encrypted (non-extractable key); direct chat end-to-end encrypted |
| 8.11 Retraining | Done for the URL model | Server-side head fine-tuning, vendor Model Hub, automatic benchmark gate and promotion; text/email/image models use the lighter calibration layer only |
| 8.13 Awareness and simulation | Done (option A) | Template library, tracked links, per-employee results, teaching page, training modules with quizzes |
| 8.14 FP / FN management | Done | Verified false positive allow-lists the domain for the whole organization |
| 8.15 Guided recovery | Done | Playbooks per incident type with one-click actions |

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
1. **Extension is not browser-tested.** Syntax-checked and exercised against the server only. Load it unpacked and walk the checklist in `docs/DEPLOYMENT_AND_OPERATIONS.md`.
2. **Text and email neural models are weak on modern phishing wording.** The email model scores 99% on its own test split but ~8% on short credential-phishing mails. Link scoring and rules now compensate (see the regression guard `live_email_components.py`; it is in-sample, not an accuracy figure). Retraining the email model on modern data is the real fix.
3. **Weight training covers the URL model only.** Its gate is deliberately strict (a candidate that added 1 point of false alarms was rejected in testing).
4. **License verification needs the vendor registry.** Run `frontend/landing/supabase/harden_organizations.sql` and `verify_license.sql` in the vendor Supabase project (the portal install command now sets `AEGIS_REGISTRY_URL` / `AEGIS_REGISTRY_KEY`). Until the SQL is run the key is reported as "unverified" and `warn` mode never blocks. The organizations table was readable with the public key before `harden_organizations.sql`; credentials issued earlier must be rotated.
5. **Evaluator comment: "UI alignment / report glitches"** was not visually audited (no browser run). Traceability and non-static XAI are done.
6. No CI pipeline. Teammate branch `aegisone-updated` still unreviewed.
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
