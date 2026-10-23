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

## 3. Plan (in order)

### Phase 0 - Make it correct and safe (first, ~2-3 days)
- P0.1 Fix cross-tenant leaks (scope every `/user/*` and communication query by org/department) + tests.
- P0.2 Fix URL model sanitize/structuralize mismatch; re-run `url_benchmark_100.csv` before/after.
- P0.3 Replace fake domain age with real RDAP lookup (cached, timeout, "unknown" on failure).
- P0.4 Fix `/policy/allowlist`, WhatsApp backend batch bugs, move HMAC key to DB-generated secret.
- P0.5 Replace `mock-data` on organizations page; real `/user/recommendations`.

### Phase 1 - Scope features the panel will look for (~4-5 days)
- P1.1 **QR code detection**: decode QR in image scan path (server: OpenCV QRCodeDetector; extension: image-guard) -> scan decoded URL with the URL model.
- P1.2 **Alerts + playbooks (8.15, 7.7)**: email admins on escalation / critical scan; static playbooks per incident type (credential entered, malware download, wire-fraud email) shown in incident page.
- P1.3 **Reporting/export (7.5, 7.7, 8.7)**: CSV export for incidents, scans, audit; printable incident report with timeline.
- P1.4 **Enterprise API (7.4)**: per-org API keys, HMAC-signed webhooks for high-risk events, SIEM-friendly JSON/CEF feed, threat-feed import into the blocklist.

### Phase 2 - Hardening (~3 days)
- P2.1 TLS reverse proxy (Caddy) in prod compose; HTTP -> HTTPS redirect; document E2E honestly.
- P2.2 Encrypt extension local storage (AES-GCM via WebCrypto, non-extractable key).
- P2.3 Minimal phishing simulation: admin creates campaign from template, tracked link, "caught/clicked" stats, training nudge on click.
- P2.4 Auto-allowlist from verified false positives; redirect-chain tracer (SSRF-guarded).

### Phase 3 - Performance and polish (~2 days)
- Query/index fixes, quantization (with accuracy check), debounce WhatsApp observer.
- Evaluator #3 UI alignment pass; tests + CI; update scope document wording where the build deliberately differs (SHAP/LIME -> evidence-based XAI, OAuth).

## 4. Decisions needed from the team
1. Google OAuth: build it, or amend the scope document?
2. Phishing simulation depth: minimal (Phase 2.3) or full campaign engine?
3. TLS: Let's Encrypt (needs public domain) or self-signed for on-prem demo?
4. Review/merge or discard `aegisone-updated`?
