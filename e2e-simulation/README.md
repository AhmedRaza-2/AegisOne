# AegisOne E2E Organization Simulation

Multi-actor workflow simulation that tests the **complete AegisOne security pipeline** end-to-end:

```
Admin Bot → Creates org → Sends campaign → Mailpit captures email → Employee Bots read it
    → Full-browser bots navigate URLs (real AegisOne extension fires) → API events recorded
    → Synthetic bots inject /events/ingest → DB reflects all actions
    → Admin validates dashboard counts match expected outcomes
```

## Architecture

| Layer | What it tests |
|---|---|
| **Phase 1: Seed** | `/setup/execute` + `/auth/login` — real API provisioning |
| **Phase 2: Campaign** | Admin login UI (Playwright) + `/communication/send` |
| **Phase 3: Email** | Mailpit SMTP capture + REST API email polling |
| **Phase 4: Simulation** | `full_browser` actors: real Chromium + AegisOne extension. `api_synthetic` actors: `/events/ingest` |
| **Phase 5: Validation** | Direct PostgreSQL queries + `/admin/stats` + `/admin/reports` + Dashboard UI |

## Quick Start

### 1. Prerequisites

```bash
# Install dependencies
cd e2e-simulation
npm install
npx playwright install chromium
```

### 2. Start AegisOne + Mailpit

```bash
# From repo root — adds Mailpit without touching prod docker-compose.yml
docker compose -f docker-compose.yml -f docker-compose.e2e.yml up -d
```

> Mailpit web UI: **http://localhost:8025**

### 3. Run the flagship simulation (5 employees)

```bash
cd e2e-simulation
npm run simulate
```

### 4. Scale to 20 employees

```bash
npm run simulate -- --scale 20
```

### 5. Run negative test (no false positives)

```bash
npm run simulate:safe
```

## Environment Variables

| Variable | Default | Purpose |
|---|---|---|
| `E2E_API_URL` | `http://localhost:8000` | AegisOne API |
| `E2E_WEB_URL` | `http://localhost:3002` | Dashboard |
| `MAILPIT_URL` | `http://localhost:8025` | Mailpit web UI |
| `E2E_DB_HOST` | `localhost` | PostgreSQL host |
| `E2E_DB_PORT` | `5432` | PostgreSQL port |
| `E2E_DB_NAME` | `aegisone` | Database name |
| `E2E_DB_USER` | `aegis` | DB username |
| `E2E_DB_PASS` | `aegisone_secret` | DB password |
| `E2E_SETUP_KEY` | `aegis-setup-key-change-me` | Setup wizard key |
| `SIMULATION_SCALE` | `5` | Number of employees |
| `SIMULATION_SEED` | `20260831` | Deterministic behavior seed |
| `E2E_USE_EXTENSION` | `true` | Load real extension for full-browser actors |
| `KEEP_E2E_DATA` | `false` | Don't delete test data after run |

## File Structure

```
e2e-simulation/
├── config.ts                          # All env vars + defaults
├── playwright.config.ts               # Playwright configuration
├── package.json
│
├── orchestrator/
│   ├── run.ts                         # CLI entrypoint
│   ├── scenario-state.ts              # Source of truth (expected vs actual)
│   └── reporter.ts                    # Rich terminal + JSON reports
│
├── fixtures/
│   ├── profiles.ts                    # Seeded employee behavior profiles
│   └── seed.ts                        # API-based org provisioning
│
├── email/
│   └── mailpit.client.ts              # Mailpit REST API client
│
├── actors/
│   ├── admin.actor.ts                 # Admin: UI login + campaign dispatch
│   └── employee.actor.ts             # Employee: full-browser + synthetic
│
├── scenarios/
│   ├── phishing-campaign.ts          # 🚩 Flagship 5-phase scenario
│   └── safe-browsing.ts              # Negative test (no false positives)
│
├── validators/
│   ├── database.validator.ts          # Direct PostgreSQL assertions
│   └── api.validator.ts               # /admin/stats assertions
│
└── results/
    └── *.json                         # Machine-readable run reports
```

## Simulation Behavior Profiles

Each employee is seeded with a **deterministic profile** from the `SIMULATION_SEED`.

| Profile | Click Phishing | Report Email | Ignore |
|---|---|---|---|
| `risky` | 70% | 10% | 20% |
| `average` | 30% | 40% | 30% |
| `security_aware` | 10% | 80% | 10% |

For 5 employees: 2 risky, 2 average, 1 security_aware.

## Actor Types

| Type | How | Count |
|---|---|---|
| `full_browser` | Real Chromium + AegisOne extension loaded | First 3 employees |
| `api_synthetic` | POST `/events/ingest` directly | Remaining N employees |

## Validation Layers

1. **Database** — Direct `pg` queries on `website_scans`, `security_events`, `threat_reports`
2. **API** — `GET /admin/stats`, `GET /admin/reports` via admin token
3. **Dashboard UI** — Playwright screenshot + text verification that stats render

## Output

```
═══════════════════════════════════════════════════════════
  AEGISONE E2E PHISHING CAMPAIGN SIMULATION — RESULTS
═══════════════════════════════════════════════════════════

  Scenario:  phishing-campaign
  Seed:      20260831
  Scale:     5 employees
  Duration:  47.2s

  Phases:
    ✓ Phase 1 — Seed                             [3.1s]
    ✓ Phase 2 — Admin Campaign                   [8.4s]
    ✓ Phase 3 — Email Delivery                   [12.6s]
    ✓ Phase 4 — Employee Simulation              [18.9s]
    ✓ Phase 5 — Validation                       [4.2s]

  Simulation Outcomes (Expected → Actual):
    ✓ Emails delivered                 expected = 5, got 5
    ✓ Website scans (DB)               expected ≥ 12, got 14
    ✓ Threat reports (DB)              expected ≥ 1, got 1
    ✓ API total scans                  expected ≥ 15, got 17

  Employee Behavior Distribution:
    Clicked phishing link:  2
    Reported email:         1
    Ignored email:          2

═══════════════════════════════════════════════════════════
  RESULT: ✅ PASS  |  Total: 47.2s
═══════════════════════════════════════════════════════════
```

JSON report written to `results/simulation-result-phishing-campaign-{ts}.json`

## Docker (Fully Containerized Run)

```bash
# Full stack + Mailpit
docker compose -f docker-compose.yml -f docker-compose.e2e.yml up -d

# Wait for ready
sleep 10

# Run simulation inside container or from host
E2E_API_URL=http://localhost:8000 \
E2E_WEB_URL=http://localhost:3002 \
MAILPIT_URL=http://localhost:8025 \
E2E_DB_HOST=localhost \
npm run simulate
```
