# AegisOne - Deployment and Operations

## 1. Customer deployment (on-prem, Docker Compose)

`docker-compose.prod.yml` runs: PostgreSQL (not published), backend (loopback only), dashboard, **Caddy TLS proxy**, daily DB backup.

```
SERVER_HOST=aegis.company.local   # DNS name -> Let's Encrypt; an IP/internal name -> Caddy's internal CA
ORG_ID=...  LICENSE_KEY=...  DEPLOYMENT_TOKEN=...      # from the vendor portal
AEGIS_REGISTRY_URL=https://<project>.supabase.co  AEGIS_REGISTRY_KEY=<anon key>
AEGIS_LICENSE_ENFORCE=warn        # off | warn | strict
DB_PASSWORD=...  AEGIS_JWT_SECRET=...  ACME_EMAIL=...
docker compose -f docker-compose.prod.yml up -d
```

| URL | What |
|---|---|
| `https://SERVER_HOST` | Dashboard (HTTP on :80 redirects here) |
| `https://SERVER_HOST:8443` | API (dashboard and browser extension) |

If Caddy uses its internal CA, install its root certificate on employee devices (`caddy-data` volume, `caddy/pki/authorities/local/root.crt`).

### License and organization binding (every request, not just setup)
- The deployment verifies `ORG_ID` + `LICENSE_KEY` + `DEPLOYMENT_TOKEN` with the vendor registry at start and every 6 h (`api/services/license.py`). If the registry is unreachable the last good answer is trusted for 7 days.
- Accounts of any other organization are refused (403) except `global_admin`.
- No account can be created or approved beyond the licensed seat limit (402).
- `strict` mode answers 402 for everything except health, sign-in, license status and setup when the license is expired/revoked/suspended. `warn` only reports it (`GET /license/status`).
- Vendor side: run `frontend/landing/supabase/verify_license.sql` once in the Supabase SQL editor.

## 2. Vendor Model Hub (improved weights)

Run one extra backend with `AEGIS_VENDOR_MODE=1`, `VENDOR_ADMIN_KEY=<secret>` and the registry variables. It exposes `/vendor/*`. Customers set `AEGIS_VENDOR_URL=https://hub.example.com:8443`.

Flow: organization verifies incidents -> **Train improved weights** (runs on its own server) -> local safety gate -> **Share with AegisOne** (needs Global Learning sharing ON) -> hub benchmarks it against the current baseline on data no organization sees -> automatic promotion or rejection -> every organization sees the release, validates it on its own data and deploys, or reverts to the shipped weights.

Vendor staff review it under **Platform Control -> Model Hub** in the landing portal (hub URL + `VENDOR_ADMIN_KEY`, kept only in the browser tab). They can override either automatic decision, re-evaluate, or withdraw a release.

Tuning (environment): `AEGIS_GATE_MAX_AUC_DROP`, `AEGIS_GATE_MAX_FPR_RISE`, `AEGIS_GATE_MAX_RECALL_DROP`, `AEGIS_GATE_MIN_GAIN`, `AEGIS_VENDOR_AUTO_PROMOTE=0` (hold approvals for a human), `AEGIS_DATA_DIR` (persist weights on a volume).

## 3. Integrations
- **API keys** (Dashboard -> Integrations): `X-API-Key` against `/api/v1/incidents`, `/events` (`?format=cef` for SIEMs, cursor `after_id`), `/threat-feed`, `/scan/url`. 120 requests/min per key; keys are stored hashed and shown once.
- **Webhooks**: JSON POST, header `X-Aegis-Signature: t=<unix>,v1=<hex HMAC-SHA256 of "t.body">`. Reject deliveries older than 5 minutes. Events: `critical_scan`, `new_incident`, `incident_escalated`, `incident_verified`, `simulation_click`, `test`. Targets must be public addresses; a webhook failing 20 times in a row is disabled.

## 4. Security awareness
Dashboard -> Awareness: pick a template and audience, then **Launch & email** (through the organization's SMTP) or **Launch & export links** (mail-merge CSV). Each employee gets a unique tracked link. A click records the event, shows what gave the message away, assigns a lesson and tells the employee. Reporting the message through AegisOne counts as "reported". Nothing typed is collected (the landing page has no form). Mail-scanner pre-fetches are ignored.

## 5. Manual browser checklist for the extension (not yet run)
1. `chrome://extensions` -> Developer mode -> Load unpacked -> `Extension/`.
2. Sign in from the dashboard; confirm the token is not readable in `chrome.storage.local` (value is `{"__aegis_enc":1,...}`).
3. Open a page with many links, one inside a web component and one in an iframe: all should receive badges.
4. Open a page with a QR code image: the decoded destination and verdict appear under it.
5. Scroll a page with images: a flagged image gets a red outline; hover shows the verdict.
6. Open a Gmail message with links: the banner shows Wording / Links / Images chips.
7. Visit `http://microsoft.com.evil.xyz`: protections must NOT be skipped.

## 6. Tests
```
pytest api/tests -q                                   # unit tests
uvicorn api.main:app --port 8765                      # then, with the API running:
python api/tests/live/live_tenant_isolation.py        # also live_incident_response / live_endpoint_smoke /
python api/tests/live/live_awareness_integrations.py  #      live_email_components / live_model_hub (see its header)
```
