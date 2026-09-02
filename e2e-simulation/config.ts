/**
 * AegisOne E2E Simulation — Environment Configuration
 *
 * All URLs, credentials, and feature flags are driven from environment variables
 * so the same suite runs against both local dev and Docker.
 *
 * Local dev defaults: everything on localhost
 * Docker:            set E2E_API_URL, E2E_WEB_URL, MAILPIT_URL, E2E_DB_HOST
 */

export const Config = (() => {
  // Generate a unique run_id for this specific execution
  const runId = process.env.E2E_RUN_ID || `e2e_run_${Date.now()}`;
  
  return {
  // ── AegisOne API ──────────────────────────────────────────────────────────
  API_URL: process.env.E2E_API_URL || 'http://localhost:8000',

  // ── AegisOne Dashboard (Next.js) ──────────────────────────────────────────
  WEB_URL: process.env.E2E_WEB_URL || 'http://localhost:3002',

  // ── Mailpit ───────────────────────────────────────────────────────────────
  // Web UI:  http://localhost:8025
  // SMTP:    localhost:1025
  MAILPIT_API_URL: process.env.MAILPIT_URL || 'http://localhost:8025',

  // ── PostgreSQL (for direct DB validation) ────────────────────────────────
  DB: {
    host:     process.env.E2E_DB_HOST     || 'localhost',
    port:     parseInt(process.env.E2E_DB_PORT || '5432', 10),
    database: process.env.E2E_DB_NAME     || 'aegisone',
    user:     process.env.E2E_DB_USER     || 'aegis',
    password: process.env.E2E_DB_PASS     || 'aegisone_secret',
  },

  // ── Test Org & Run Isolation ──────────────────────────────────────────────
  RUN_ID: runId,
  ORG_ID: process.env.E2E_ORG_ID || `org_${runId}`,

  // ── Setup Key (matches VITE_SETUP_KEY in API) ────────────────────────────
  SETUP_KEY: process.env.E2E_SETUP_KEY || 'aegis-setup-key-change-me',

  // ── Extension ─────────────────────────────────────────────────────────────
  EXTENSION_PATH: process.env.E2E_EXTENSION_PATH ||
    'D:\\Coding Projects\\AegisOne\\Extension',

  // ── Feature Flags ─────────────────────────────────────────────────────────
  // Load real unpacked extension into real-actor browsers
  USE_REAL_EXTENSION: (process.env.E2E_USE_EXTENSION || 'true') === 'true',

  // When true, don't wipe the org and users after the run (for debugging)
  KEEP_E2E_DATA: (process.env.KEEP_E2E_DATA || 'false') === 'true',

  // ── Simulation Scale ──────────────────────────────────────────────────────
  // DEFAULT_SCALE: 5 employees (prove the pipeline end-to-end)
  // Scale up to 20 with --scale 20 CLI arg or SIMULATION_SCALE env var
  SCALE: parseInt(process.env.SIMULATION_SCALE || '5', 10),

  // ── Deterministic Seed ────────────────────────────────────────────────────
  // Used to make behavior profiles deterministic — same seed → same outcomes
  SIMULATION_SEED: process.env.SIMULATION_SEED || '20260831',

  // ── Timeouts ──────────────────────────────────────────────────────────────
  EMAIL_WAIT_TIMEOUT_MS: 30_000,
  API_TIMEOUT_MS:         10_000,

  // ── Test URLs for browsing simulation ────────────────────────────────────
  SAFE_URLS: [
    'https://github.com',
    'https://docs.python.org',
    'https://stackoverflow.com',
    'https://wikipedia.org',
  ],
  // These will be detected as phishing/suspicious by AegisOne's models
  SUSPICIOUS_URLS: [
    'http://paypal-secure-login.xyz/auth',
    'http://update-apple-id.com/login',
    'http://office-365-secure.com',
  ],
  };
})();

export type E2EConfig = typeof Config;
