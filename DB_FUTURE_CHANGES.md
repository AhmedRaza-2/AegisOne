# DB Future Changes

> ⚠️ **DO NOT IMPLEMENT** until the extension is stable in production.
> This file documents future database schema improvements for planning purposes only.
> The current PostgreSQL schema is **frozen** during the extension finalization sprint.

---

## Background

Current architecture: **Extension → Flask API → PostgreSQL → Dashboard (WebSocket/Realtime)**

The existing schema handles:
- Scan events (website threats, downloads, credentials)
- Dashboard real-time updates
- Device registration + heartbeat
- Org policy (allowlist/blocklist/warninglist)

The following additions would increase analytical depth, auditability, and enterprise management capabilities.

---

## Proposed Future Tables

### 1. `threat_categories`

**Purpose:** Structured threat classification (replaces free-text `threat_type` string).

```sql
CREATE TABLE threat_categories (
    id          SERIAL PRIMARY KEY,
    slug        VARCHAR(64) UNIQUE NOT NULL,   -- e.g. 'credential_harvesting'
    label       VARCHAR(128) NOT NULL,         -- e.g. 'Credential Harvesting'
    severity    SMALLINT DEFAULT 2,            -- 1=low, 2=medium, 3=high, 4=critical
    description TEXT,
    created_at  TIMESTAMPTZ DEFAULT NOW()
);
```

**Why:** The current system stores `threat_type` as a raw string (`"phishing"`, `"credential_harvesting"`, etc.) with no foreign key constraint, making reporting inconsistent.

---

### 2. `explainability_logs`

**Purpose:** Store XAI explanations for audit trail and model improvement.

```sql
CREATE TABLE explainability_logs (
    id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    event_id      UUID REFERENCES security_events(id) ON DELETE SET NULL,
    device_id     VARCHAR(64),
    url           TEXT NOT NULL,
    risk_score    SMALLINT,
    summary       TEXT,
    main_reasons  JSONB,           -- array of reason strings
    recommendation TEXT,
    llm_model     VARCHAR(64),     -- which LLM generated this
    latency_ms    INTEGER,
    created_at    TIMESTAMPTZ DEFAULT NOW()
);
```

**Why:** Currently XAI responses are ephemeral — generated on demand and never stored. Logging them enables:
- Model quality audit
- Security investigation replay
- Training data for future model improvements

---

### 3. `extension_versions`

**Purpose:** Track which extension version each device is running.

```sql
CREATE TABLE extension_versions (
    id             SERIAL PRIMARY KEY,
    device_id      VARCHAR(64) NOT NULL,
    extension_ver  VARCHAR(16) NOT NULL,      -- e.g. '2.1.0'
    browser        VARCHAR(32),
    browser_version VARCHAR(16),
    os             VARCHAR(32),
    reported_at    TIMESTAMPTZ DEFAULT NOW()
);
```

**Why:** Enables SOC teams to see if any devices are running outdated extensions with known vulnerabilities.

---

### 4. `device_inventory` (enhanced)

**Purpose:** Enrich the existing device table with health status columns.

```sql
-- Proposed additions to existing devices table:
ALTER TABLE devices ADD COLUMN IF NOT EXISTS last_scan_at     TIMESTAMPTZ;
ALTER TABLE devices ADD COLUMN IF NOT EXISTS total_scans      INTEGER DEFAULT 0;
ALTER TABLE devices ADD COLUMN IF NOT EXISTS threats_detected INTEGER DEFAULT 0;
ALTER TABLE devices ADD COLUMN IF NOT EXISTS extension_ver    VARCHAR(16);
ALTER TABLE devices ADD COLUMN IF NOT EXISTS is_active        BOOLEAN DEFAULT TRUE;
```

**Why:** The current `devices` table only stores registration info. These additions enable a proper device health dashboard without a new table.

---

### 5. `manager_escalations`

**Purpose:** Allow managers to review and act on high-risk events flagged for escalation.

```sql
CREATE TABLE manager_escalations (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    event_id        UUID REFERENCES security_events(id),
    org_id          INTEGER,
    device_id       VARCHAR(64),
    escalated_by    VARCHAR(64),              -- 'auto' or user email
    status          VARCHAR(16) DEFAULT 'pending',  -- pending | reviewed | dismissed | actioned
    manager_note    TEXT,
    reviewed_by     VARCHAR(64),
    reviewed_at     TIMESTAMPTZ,
    created_at      TIMESTAMPTZ DEFAULT NOW()
);
```

**Why:** Currently high-risk events appear in the dashboard but there's no workflow for escalation, review, or resolution tracking.

---

### 6. `audit_event_history`

**Purpose:** Immutable append-only log for all significant security and policy events.

```sql
CREATE TABLE audit_event_history (
    id          BIGSERIAL PRIMARY KEY,
    event_type  VARCHAR(64) NOT NULL,     -- e.g. 'policy_changed', 'device_blocked'
    actor       VARCHAR(128),             -- who triggered it
    target      VARCHAR(256),             -- what was affected
    metadata    JSONB,
    org_id      INTEGER,
    created_at  TIMESTAMPTZ DEFAULT NOW()
);
-- Partitioned by month for performance at scale
```

**Why:** Needed for SOC compliance, incident response, and forensic investigation.

---

## Implementation Notes (When Ready)

1. All new tables should use `gen_random_uuid()` for primary keys where possible.
2. Add `org_id` to every table that stores user/device data.
3. Use `JSONB` for flexible metadata fields — avoid schema migrations for evolving fields.
4. Add appropriate indexes on `device_id`, `org_id`, and `created_at` for dashboard query performance.
5. Consider row-level security (RLS) policies for multi-tenant isolation.

---

## Migration Order (When Implementing)

1. `threat_categories` — standalone, no deps
2. `extension_versions` — standalone
3. `device_inventory` (ALTER TABLE) — low risk
4. `explainability_logs` — depends on `security_events`
5. `manager_escalations` — depends on `security_events` + auth
6. `audit_event_history` — depends on existing tables + partition setup

---

*Last updated: 2026-07-24*  
*Status: Planning only — no implementation pending*
