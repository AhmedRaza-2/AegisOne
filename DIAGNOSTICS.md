# AegisOne QA Diagnostics

Three runs: 2026-10-01 (initial), 2026-10-02 (fix + real UI click-through retest), 2026-10-02 (input validation sweep). Environment: local Docker stack (`docker-compose.yml`, images built from source), Windows, Chromium driven by Playwright with the real extension zip loaded per user.

## What was tested

| Area | How |
|---|---|
| Stack health | `/ready`, container logs, model loading |
| Org setup | 1 QA admin, 2 managers (QA Finance, QA Engineering), 6 employees created through the admin API in the existing `org_default` |
| Extension | Zip downloaded per user from `/public/download/extension?email=...`, extracted, loaded in its own Chromium profile (9 profiles) |
| Browsing | Each of 9 users visited 6 safe sites and 6 live phishing URLs (OpenPhish feed, filtered to pages that responded). Two full runs. |
| Incident flow | "Create Incident" / "False Positive" clicked in the extension warning modal, then manager triage, escalation, admin verification, training sample |
| Analytics | Dashboard numbers compared against the database for admin, department cards, employee threat list |
| Dashboards | Logged in as employee, manager, admin; 19 pages loaded and screenshotted; HTTP and console errors recorded |

## Results

- Safe sites: 108 visits, 0 false alarms (max score 5).
- Live phishing: 108 visits (30 distinct URLs). 15 scored 50 or more, 18 showed the warning modal, 66 scored 10 or less.
- Extension to `/reports`: works. Reports carry the right user, department, risk score and URL.
- Manager scoping: Finance manager saw 3 reports, Engineering manager 2, the unrelated IT manager got 404.
- Escalate to admin, admin verify, training sample: works. The training sample is now labelled `url`.
- Redaction: emails, tokens, account and card numbers removed in manager and admin views.
- Analytics after fixes: admin totals and department cards match the database exactly (2,257 scans, 29 threats, 9 devices).
- Dashboards: 19 pages, 0 HTTP errors, 0 console errors.

## Bugs found and fixed — run 1 (2026-10-01)

| # | Problem | Fix |
|---|---|---|
| 1 | Backend start deleted all website scans, devices, audit logs, messages, threat reports and cleared department managers on every restart (`api/main.py`) | Now only runs when `AEGIS_RESET_TELEMETRY_ON_START=true` |
| 2 | URL phishing model never loaded in a source-built image (`tldextract` missing from `requirements.txt`), so `/ready` stayed 503 forever | Added to `requirements.txt`. Verified "4/4 AI models loaded" and `/ready: true` *before* any of the browsing/incident testing below — this was fixed first, not discovered after the fact |
| 3 | Dashboard container unreachable: your uncommitted `package.json` starts Next on 3002, Docker maps host 3002 to container 3000 | Dockerfile now pins `-p 3000` (your `package.json` left alone) |
| 4 | Landing container crash-looped (`react-is` peer dependency not installed with `--legacy-peer-deps`) | Added `react-is` to landing `package.json` and lockfile |
| 5 | Simultaneous reports on one URL created duplicate incidents, then every later report on that URL returned HTTP 500 | Postgres advisory lock per URL plus a tolerant lookup. 6 concurrent reports now give 6 x 201 and 1 incident |
| 6 | Managers could open the org-wide admin incident queue and verify incidents (manager and office_admin share a role level) | `/admin/incidents*` now requires `admin`; manager gets 403 |
| 7 | Training sample model type came out as `email` for URLs containing `email=` | Type now taken from the report's target type |
| 8 | Admin verification marked an employee's "false positive" report as `verified` when phishing was confirmed; "needs investigation" marked reports `rejected` | Report status now compares the claim with the ruling; needs-investigation gives `under_review` |
| 9 | AI Models page used the wrong localStorage key, so every request was unauthenticated | Fixed; page now loads real data |
| 10 | Incident trend chart rendered as a single dot | Now a bar chart |

## Bugs found and fixed — run 2 (2026-10-02)

Found by reading the actual code paths the first run's findings pointed at, not guesses:

| # | Problem | Root cause | Fix |
|---|---|---|---|
| 11 | **Any employee could see every other employee's flagged URLs** in their own Threat Center, across departments | `/user/threats` accepted an `email` query param and never used it to filter the query | Now resolves the email to a user and filters `WebsiteScan.user_id`. Verified: emp5 gets exactly their own 9 rows, emp1 their own 2, zero overlap |
| 12 (was open #6, #10) | `threat_type` stored for URL scans was a risk-severity label (`"Safe"`/`"Suspicious"`/`"High Risk"`) from the model, not a threat category — broke the admin "Top Threat Types" bucketing (most scans matched neither "phishing" nor the malware list) and made training-sample labels nonsensical | `/analyze/url` was storing the model's `category` field directly as `threat_type` | `threat_type` now derived from `decision` (BLOCK/SUSPICIOUS → phishing or credential_harvesting, else benign). Admin stats bucketing also switched to bucket by `decision` instead of matching fragile strings, so it can't silently drop rows again regardless of what any scan type writes to `threat_type` |
| 13 (was open #9) | `scans_today` added `SecurityEvent` count on top of `WebsiteScan` count, inflating the number against `total_scans` | Two unrelated counts summed under one label | Dropped the addition; `scans_today` is now just scans in range |
| 14 (was open #11) | Employee Threat Center showed "All Clear" regardless of actual blocked threats | The live `/user/threats` handler never returned an `activeAlerts` key at all — a second, dead, unreachable copy of the endpoint (same path registered twice) had the field, but FastAPI only ever dispatches to the first match, so it never ran | Added real `activeAlerts` to the live handler; deleted the ~100-line dead duplicate so it can't confuse the next person editing this file |
| 15 (was open #7) | `/analyze/url` never returned `scan_id`, so every report had a blank one | Field was computed and stored but never put back in the response dict | Added `contextual_result["scan_id"] = target_scan_id` |
| 16 (was open #12) | Manager's incident list showed the org-wide report count (e.g. 6) while opening the same incident showed only their own department's reports (3) | List endpoint's count query had no department filter, detail endpoint did | List now counts only the manager's own department, matching what they can actually see |
| 17 (was open #13) | `manager_notes` was a single field — a second manager's comment or a later escalation note overwrote the previous one | Plain assignment (`inc.manager_notes = payload.notes`) | Now an append-only, timestamped, attributed log. Verified: 3 separate triage calls from the same manager all preserved, not overwritten |
| 18 (was open #14) | A new report on an already-escalated incident's URL opened a second incident instead of joining it | Correlation query only matched `status in (open, investigating)` | Added `escalated` to the matched statuses |

**Full UI click-through retest** (not page loads — actual form fills and button clicks, via Playwright):
- Employee: filled and submitted the "Report a Threat" form → appeared correctly in "My Reports". ✅
- Manager: opened a real incident card, filled the notes box, clicked "Escalate to Admin". ✅
- Admin: opened the now-escalated incident, filled notes, clicked "Confirmed Phishing". ✅
- AI Models page: loads real training-candidate/job data (was broken by the wrong-localStorage-key bug, now fixed). ✅
- 7 more tabs spot-checked (Departments, Audit Logs, Communication, both Analytics pages, Employees): all loaded, 0 API errors, 0 console errors across the whole retest.
- Confirmed in the database afterward: incident went open → escalated → resolved/CONFIRMED_PHISHING, manager notes show all 3 log entries intact, report status `verified`.
- Confirmed data survives a backend restart (the run-1 fix for issue #1 still holds after all run-2 changes).

## Run 3 (2026-10-02): input validation sweep

Tested every form-backed and API input path against missing fields, wrong types, SQL injection, XSS, CRLF/header injection, oversized strings, out-of-range numbers, invalid emails, invalid roles, path traversal, and SSRF — against auth, admin user/department creation, employee reports, manager triage, admin verify, and the scan/analyze endpoints. 48 automated probes plus manual follow-up on anything that returned 200 or 500 when it shouldn't have.

**Critical: found and fixed a real local-file-disclosure + SSRF vulnerability.**

| # | Problem | Severity | Fix |
|---|---|---|---|
| 19 | **`/analyze/download_url` would read arbitrary files off the server's own filesystem.** Any string that happened to be a path that existed on the server (no `file://` prefix even needed — e.g. `/app/.env`, `/etc/passwd`) was opened and run through the attachment-analysis pipeline. Verified live: `/app/requirements.txt` was successfully read and analyzed through the API with nothing but an authenticated request. | **Critical** | Removed the local-path branch entirely — confirmed no legitimate caller needs it (the extension always sends a real `http(s)` download URL it intercepted) |
| 20 | **The same endpoint had no SSRF protection** — it fetches `url` server-side via `httpx`, and the existing `validate_url_for_ssrf()` guard (used elsewhere) only checked the scheme, never resolved the hostname. A request could make the server fetch `http://169.254.169.254/...` (cloud metadata) or internal Docker services. There was already a dead, unused `is_private_ip()` helper sitting in the file — written at some point, never wired in. | **Critical** | Wired it in: the guard now resolves the hostname and rejects private/loopback/link-local targets when the caller is about to fetch live (`resolve=True`). Verified: cloud-metadata IP, localhost, and the internal `aegisone-db` Docker hostname are all rejected; a real `https://` URL still works |
| 21 | A bug in the validation-error handler itself (`api/main.py`) re-read the request body for debug logging after FastAPI had already consumed it — interacting with the metadata middleware, this turned some malformed-body 422s into raw unhandled 500s, leaking a full stack trace. Not route-specific; this could happen on any endpoint given the right malformed body. | Medium (info disclosure) | Removed the redundant body re-read |
| 22 | No email-format validation anywhere (login, register, admin-create-user, password reset) — garbage strings like `not-an-email` or empty strings were accepted and stored as real accounts | Low/data-integrity | Added `EmailStr` validation to account-creation paths (register, admin-create-user). **Deliberately not** added to login/password-reset, since those act on already-existing accounts — see the regression below |
| 23 | No password length requirement anywhere — empty-string passwords were accepted | Low | `min_length=8` on registration and admin-created accounts |
| 24 | Admin's `UserCreate.role` was a plain `str`, not validated against the role enum — garbage roles were stored, silently breaking that account's access | Low | Typed as the `Role` enum |
| 25 | Oversized input (200KB names, URLs, notes) on several endpoints crashed with a raw 500 (Postgres column-length violation) instead of a clean rejection | Low | Added `max_length` constraints matching the actual DB column sizes across register, admin-create-user/department, reports, manager-triage, and admin-verify |
| 26 | Creating a user with a `department_id` that doesn't exist crashed with a raw 500 (FK violation) instead of a clean error | Low | Now returns 400 with a clear message |
| 27 | `risk_score` on a report accepted any integer, including 99999 | Low | Constrained to 0–100 |

**Self-caught regression, fixed before it shipped:** the first pass of the `EmailStr` fix (#22) was applied to `LoginRequest` too, which would have locked out every account whose email trips `email-validator`'s reserved-TLD check (RFC 2606 domains — `.test`, `.example`, `.invalid`) — including every QA account created during run 1/2's testing, and any real customer account that happened to match. Caught by re-testing login against the existing `.test` accounts immediately after the change; fixed by keeping `EmailStr` only on account-*creation* paths and reverting `LoginRequest`/`ForgotPasswordRequest`/`VerifyResetRequest` to plain validated strings, since those only need to match an existing DB row, not pass a format policy introduced after the account existed. Verified `qa.admin@example.test` logs in again post-fix.

**Also fixed in passing:** no `.dockerignore` existed anywhere in the repo, so every single `docker compose build` (for any service) sent the *entire* repo — including the 2.7GB `.git` history — to the Docker daemon as build context, regardless of what actually changed. This was very likely a meaningful contributor to how slow rebuilds felt throughout this whole testing session. Added one.

**Confirmed safe, not fixed (false positives from the first pass):** SQL injection payloads in text fields (full_name, department name, report notes) are stored as inert literal text — SQLAlchemy's ORM parameterizes everything, nothing is ever string-interpolated into a raw query, so there is no SQL injection surface here regardless of what's typed into these fields. Same for XSS payloads (`<script>...`) in stored text — React escapes on render by default, and the CRLF email-header-injection attempt was independently rejected by Python's own `email` library before anything was sent.

## Run 4 (2026-10-02): frontend form validation + auth hardening

You asked specifically whether login/signup/other input areas in the dashboard and landing pages had proper validation. Short answer going in: inconsistent — landing `/register` was already strong (regex, MX record check, password complexity), but there were real gaps elsewhere.

| # | Problem | Fix |
|---|---|---|
| 28 | Landing `/login` form had `noValidate` on the `<form>`, disabling all native browser validation (the `type="email"` input did nothing), and no client-side checks beyond "field isn't empty" | Removed `noValidate`, added `required`/`maxLength` to both fields |
| 29 | Password reset (`/auth/reset-password`) and change-password (`/auth/change-password`) had **no server-side minimum password length at all** — only a client-side check, and that check used 6 characters vs the 8-character minimum enforced everywhere else, so it was both bypassable and inconsistent | Both now enforce `min_length=8` server-side via Pydantic; updated the client-side checks (dashboard login's reset flow, and all three settings pages — admin/employee/supervisor) from 6 to 8 to match, and added native `minLength`/`maxLength` to the password inputs themselves |
| 30 | `UpdateProfileRequest.full_name` (profile editing) had no length limit server-side — same class of oversized-input crash as the others found in run 3 | Added `max_length=255` to match the `full_name` DB column; added matching `maxLength={255}` to the full-name inputs on all three settings pages |
| 31 | Several dashboard forms had no client-side length limits even though the backend now enforces them (admin's "Add Member/Manager" full name/email/password, "Create Department" name, employee's "Report a Threat" title/URL/description, manager's and admin's incident-notes textareas) | Added matching `maxLength`/`minLength` to each, so the UI gives immediate feedback instead of a late 422 |
| 32 | **`/auth/check-role`** — called automatically whenever you type an email on the dashboard login screen — was unauthenticated and revealed, for any email string, whether it belongs to a real account and that account's exact role. No rate limit of any kind applied to it, or to `/auth/login`, `/auth/register`, `/auth/forgot-password`, `/auth/verify-reset-otp` — the only rate limit anywhere was a 60-requests-*per-second* global default, which is not a meaningful brake on brute-forcing or enumeration | Kept the feature (it drives a real UX hint) but added a strict per-IP rate limit: 10/minute on `check-role`, `login`, and `verify-reset-otp`; 5/minute on `register` and `forgot-password`. Verified live: the 11th rapid request to `check-role` from the same IP returns 429, the 10th still succeeds, and normal login is unaffected |

**Verified live after rebuilding all three containers** (backend, dashboard, landing): rate limiting triggers correctly (429 on request 11+), `qa.admin@example.test` still logs in normally, password-reset/change-password reject short passwords with a clean 422, and all 2,263 scan rows survived every rebuild in this run.

**Also fixed in passing:** `Dockerfile.backend` copied `api/` before `AIML/` (1.5GB of model weights), so any backend code change forced Docker to re-copy the weights too. Reordered so `AIML/`/`Extension/` are copied first — now an `api/`-only change only re-copies the ~3MB `api/` folder, cutting rebuild time substantially on top of the earlier `.dockerignore` fix (build context dropped from 1GB+ to under 100KB for a code-only change).

## Open issues (still not fixed)

Security
1. **Anyone who knows a user's email can act as that user.** `get_current_user` falls back to the `X-User-Email` header with no password, and role checks honour it, including admin endpoints. This run used it. The extension relies on it, so it needs a real extension credential before production. This is an architecture change (issuing the extension real per-device JWTs), not a one-line fix — flagging for a decision rather than doing it silently.
2. The same role-level quirk still applies to other `require_role(Role.OFFICE_ADMIN)` endpoints (training candidates, training jobs); managers can reach them.
3. Training samples store the raw URL, including tokens or emails in the query string.
4. `/analyze/url` (the non-fetching lexical URL scan) still doesn't resolve/block private IPs the way `/analyze/download_url` now does — low risk since it never makes a live request either way, but worth the same treatment if it's ever changed to fetch content.
5. `/auth/check-role` still reveals account existence + exact role to an unauthenticated caller, just slower now (10/minute per IP instead of unlimited). If you want this fully closed, the feature itself (auto-detecting role on the login screen before submit) would need to go, or move behind auth.

Detection (model behavior, not a code bug — out of scope for this pass)
6. Recall is low on live phishing: 66 of 108 phishing visits scored 10 or less (for example a Trust Wallet clone scored 3). Only 18 triggered the warning. This is model/threshold tuning, not something a code fix addresses.
7. In run 1 the same URL scored 80 for some users and 45 for others; run 2 gave 80 for everyone. Not reproduced on investigation — plausibly the live phishing page itself serving different content per visit (cloaking), not our code.

Analytics
8. The extension scans every link on every page, not just the page itself: 2,257 scan rows for 108 page visits. This is by design (proactive link scanning), but it means "Total Scans" measures link-scan volume, not pages visited — worth a label/tooltip if that's surprising to you.

## Not tested

- Landing sign-up, Supabase approval at `/admin`, and the on-prem "start setup" flow (skipped on purpose to avoid writing to production Supabase).
- SMTP and welcome emails. QA accounts use `@example.test`.
- Gmail email scanning (needs a logged-in session), extension popup UI, downloads and credential-leak features.
- Other machines on your router or the Vercel-hosted site.

## Docker Hub images you pushed

`ahmedraza2006/aegisone-backend:incident-test` and `ahmedraza2006/aegisone-dashboard:incident-test` predate every fix in both runs above. Rebuild and push them before using them anywhere else.

## Test data left in the local database

Users `qa.admin`, `qa.mgr.fin`, `qa.mgr.eng`, `qa.emp1` to `qa.emp6` (all `@example.test`, password `QaTest#2026`), departments QA Finance and QA Engineering, about 2,257 scans and several incidents. A full backup from before this run is in the session scratchpad (`aegisone_pre_qa_backup.sql`).
