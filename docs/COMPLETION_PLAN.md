# AegisOne - Gap Analysis vs Scope Document and Plan to 100%

Checked against the code on 2026-10-20 (not the 4 Oct audit snapshot). "Verified" = I grepped or ran the code today.

## 1. Scope item status

| Scope item | Status | Evidence |
|---|---|---|
| 7.1 URL scan, fake login, credential interception, JS inspection, brand impersonation | Done | Extension form-guard, scanner, risk-engine |
| **7.1 QR code link validation** | **Missing** | No QR decoder anywhere in `api/` or `Extension/` (no pyzbar/jsQR/cv2 QR) |
| 7.2 Email link/attachment/impersonation/BEC | Done (BEC = rules only) | email-guard.js, model_orchestrator |
| 7.3 ML classification, heuristics, risk 0-100, XAI | Done | 4 models, XAI v2 |
| **7.3 Domain reputation / domain age** | **Fake** | `compatibility.py` ~L1883 derives "domainAge" from the risk score ("3 Days" if risk > 80). No WHOIS/RDAP lookup |
| 7.3 Behavioral anomaly detection | Partial | Extension signals only; no per-user baseline |
| **7.4 Webhook alerts** | **Missing** | No webhook code |
| **7.4 SIEM compatibility** | **Missing** | No syslog/CEF/JSON export feed |
| **7.4 Enterprise API keys / custom threat feeds** | **Missing** | Only user JWT auth; org policy blocklist exists but no feed import |
| 7.5 Dashboard, RBAC, policy, audit | Done | 3 role dashboards, policy lists |
| **7.5 / 7.7 Reporting and export** | **Missing** | No export/CSV/PDF route |
| **7.7 Real-time alert notifications** | **Missing** | No email/push on escalation or high-risk (`manager_incidents.py` sends nothing) |
| 7.7 Multi-tenant | Done | organization_id scoping |
| **7.7 Subscription access mgmt** | **Missing** | No plan/limit model |
| 7.6 Docker / on-prem | Done | compose + prod compose + backup |
| 7.6 Cloud/private-cloud scaling | Partial | No k8s/Helm |
| 8.1 Google OAuth | Not built | Team said in-house only. Scope still says it |
| **8.9 Encrypted transport** | **Partial** | `docker-compose.prod.yml` has no TLS proxy (plain HTTP ports) |
| **8.10 Encrypted local logs** | **Missing** | No WebCrypto/AES anywhere in `Extension/` |
| 8.11 Retraining | Partial | Calibration-adapter pipeline + endpoints exist (`training.py`, `global_learning.py`); base-weight retraining not |
| **8.13 Awareness + simulation** | **Missing** | `/user/recommendations` is hard-coded text; no simulation engine |
| **8.15 Guided recovery / playbooks** | **Missing** | No playbook content; no escalation alerts |
| 8.7 Redirect-chain in reports | Partial | Chain captured client-side only; no server-side tracer |
| 8.14 FP/FN management | Mostly done | Missing: auto-allowlist from verified FP |

## 2. Known defects still open (from earlier reviews)
1. **Cross-tenant data leaks** in `/user/*` endpoints and `communication.py` broadcast (security).
2. **URL model train/serve mismatch**: `sanitize_url` vs training-time `structuralize_url` (accuracy).
3. WhatsApp backend `/scan/whatsapp/batch` bugs; hard-coded HMAC key `ORG_HMAC_SECRET` in `whatsapp_analyzer.py`.
4. `/policy/allowlist` broken `Policy()` call.
5. CPU quantization never runs (speed; needs accuracy check first).
6. Slow N+1 / index-defeating dashboard queries.
7. `admin/organizations` page still on `mock-data`.
8. Evaluator comment #3: UI alignment / report glitches not done.
9. Only 4 test files, no CI.
10. Teammate branch `aegisone-updated` unmerged (review before deciding).

## 3. Decisions taken (2026-10-23)
- Google OAuth: dropped (in-house accounts only). Scope wording amended.
- SHAP/LIME: replaced by evidence-grounded XAI (already built). Scope wording amended.
- 8.4 Real-time monitoring: accepted as implemented.
- Retraining runs on the server, never the admin's laptop. Org weights are submitted to the vendor (landing-page admin UI), auto-compared with the current baseline, and promoted if better.
- Alerts/playbooks (8.15): vendor decides based on scope utility (see Phase 2).

## 4. Plan

### Phase 0 - Correct and safe
| # | Item | Status |
|---|---|---|
| 0.1 | Cross-tenant leaks: /setup (structure, merge, bulk-reassign, reset, session, status, execute), /communication, /user/* | **Done** (verified with a two-tenant live test) |
| 0.2 | /setup API requires an authenticated admin (status endpoints included) | **Done** |
| 0.3 | WhatsApp sender HMAC key per deployment, not in source | **Done** |
| 0.4 | /policy/allowlist is org-scoped, no process-wide mutation | **Done** |
| 0.5 | Real domain age (RDAP, cached, "unknown" on failure) | **Done** |
| 0.6 | Remove mock data: hard-coded "Compliance 100%", fabricated /user/recommendations, "mock" fallbacks | **Done** (admin/organizations page moves to 2.1 with licensing) |
| 0.7 | URL model train/serve mismatch + neural pipeline off by default (benchmarked, see docs/URL_MODEL_EVALUATION.md) | **Done** |
| 0.8 | Extension: scan all links, shadow DOM and iframes; exact-domain safe-host checks (substring bypass fixed) | **Done** (needs a manual browser test) |

### Phase 1 - Scope features
| # | Item |
|---|---|
| 1.1 | **Done** - QR decoding everywhere (web images, WhatsApp, email images): decode before the user opens it, scan the decoded URL/text, show verdict |
| 1.2 | **Done** - Incident backtrace + exports (8.7): who reported, what was scanned, which model/evidence, redirect chain (server-side SSRF-guarded tracer), timeline; CSV export and printable end-to-end report |
| 1.3 | **Done** - Alerts + playbooks (8.15): email/webhook on escalation and critical scans, built-in playbooks per incident type |
| 1.4 | **Done** - Org-wide auto-allowlist from verified false positives (8.14) |

### Phase 2 - Platform
| # | Item |
|---|---|
| 2.1 | License key + organization id enforced on every API call (not only setup) |
| 2.2 | Org API keys, HMAC-signed webhooks, SIEM (JSON/CEF) feed, threat-feed import |
| 2.3 | TLS reverse proxy in the prod compose; HTTP redirects to HTTPS (8.9) |
| 2.4 | Extension local storage encrypted with AES-GCM; chat messages end-to-end encrypted (8.10) |
| 2.5 | Server-side retraining job, base-weight submission to the vendor, automated baseline comparison and promotion (8.11) |
| 2.6 | Phishing simulation + real recommendations (8.13) |
| 2.7 | Deployment options: Compose profiles, Helm chart (8.8) |

### Phase 3 - Polish
UI alignment pass from the evaluator feedback, query/index performance, tests + CI, scope wording amendments.

## 5. Options (need a pick before building)
**8.8 Deployment**
- A. Docker Compose + license server in the vendor cloud (recommended for FYP: small, demonstrable).
- B. A + Helm chart for Kubernetes.
- C. B + multi-tenant SaaS mode with plan limits.

**8.13 Simulation**
- A. Template library + tracked links + per-employee click stats + training nudge (recommended).
- B. A + scheduled campaigns and difficulty levels.
- C. B + simulated emails actually sent through the org SMTP.

**8.15 Recovery (my decision):** playbooks per incident type + email alerts to admins/managers on escalation and critical scans + webhook. Anything heavier (SOAR integrations) is out of scope.
