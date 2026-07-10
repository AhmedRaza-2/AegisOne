/**
 * AegisOne Extension v2.0 — Shared Constants
 * ============================================
 * Single source of truth for all config values,
 * thresholds, risk weights, and message types.
 */

// ── API Configuration ────────────────────────────────────
export const API_BASE = "http://localhost:9000";
export const API_TIMEOUT_MS = 6000;
export const HEALTH_CHECK_INTERVAL_MS = 30_000;
export const EVENT_SYNC_INTERVAL_MS = 30_000;

// ── Risk Thresholds ──────────────────────────────────────
export const THRESHOLD = {
  SAFE:    0.20,   // 0–20%   → safe
  WARNING: 0.50,   // 20–50%  → suspicious
  DANGER:  0.80,   // ≥50%    → phishing detected
  HIGHLIGHT: 0.85, // Highlight links on page at this level
  GOOGLE_BADGE: 0.80,  // Show warning badge in search results
};

// ── Risk Engine Weights (must sum to 1.0) ────────────────
export const RISK_WEIGHTS = {
  url_model:       0.25,
  domain_age:      0.15,
  ssl_invalid:     0.10,
  login_form:      0.10,
  text_content:    0.10,
  redirect_chain:  0.10,
  brand_mismatch:  0.10,
  hidden_iframe:   0.05,
  js_behavior:     0.05,
};

// ── Cache Config ─────────────────────────────────────────
export const CACHE = {
  DOMAIN_TTL_MS: 15 * 60 * 1000,   // 15 minutes
  DOMAIN_MAX_SIZE: 500,
  TAB_MAX_SIZE: 50,
  HOVER_TTL_MS: 5 * 60 * 1000,     // 5 minutes
};

// ── Event Types (stored in local DB) ────────────────────
export const EVENT_TYPES = {
  WEBSITE_THREAT:   "website_threat",
  DOWNLOAD_BLOCKED: "download_blocked",
  DOWNLOAD_ALLOWED: "download_allowed",
  CREDENTIAL_WARN:  "credential_warning",
  THREAT_REPORT:    "threat_report",
  XAI_SESSION:      "xai_session",
};

// ── Message Types (content ↔ background) ────────────────
export const MSG = {
  // Navigation
  NAVIGATE_SCAN:    "NAVIGATE_SCAN",
  PAGE_FEATURES:    "PAGE_FEATURES",
  SCAN_RESULT:      "SCAN_RESULT",

  // Link hover
  SCAN_HOVER_URL:   "SCAN_HOVER_URL",
  SCAN_HOVER_IMAGE: "SCAN_HOVER_IMAGE",
  HOVER_RESULT:     "HOVER_RESULT",

  // Search
  SEARCH_SCAN:      "SEARCH_SCAN",
  SEARCH_RESULTS:   "SEARCH_RESULTS",

  // Form / credential
  FORM_INTERCEPT:   "FORM_INTERCEPT",
  FORM_DECISION:    "FORM_DECISION",

  // XAI
  XAI_REQUEST:      "XAI_REQUEST",
  XAI_RESULT:       "XAI_RESULT",

  // Downloads
  DOWNLOAD_DECISION: "DOWNLOAD_DECISION",
  PROMPT_DOWNLOAD:   "PROMPT_DOWNLOAD_DECISION",

  // Right-click
  RIGHT_CLICK_SCAN:  "RIGHT_CLICK_SCAN",

  // Control
  GET_TAB_DATA:     "GET_TAB_DATA",
  GET_SHIELD_STATE: "GET_SHIELD_STATE",
  TOGGLE_SHIELD:    "TOGGLE_SHIELD",
  CHECK_HEALTH:     "CHECK_HEALTH",
  GET_EVENTS:       "GET_EVENTS",
  REPORT_THREAT:    "REPORT_THREAT",
  FULL_PAGE_SCAN:   "FULL_PAGE_SCAN",

  // Push to content
  HIGHLIGHT_THREATS: "HIGHLIGHT_THREATS",
  SHOW_WARNING:      "SHOW_WARNING",
};

// ── Verdict Labels ───────────────────────────────────────
export const VERDICT = {
  SAFE:    "safe",
  WARNING: "warning",
  DANGER:  "danger",
  UNKNOWN: "unknown",
  SCANNING: "scanning",
};

// ── Threat Types ─────────────────────────────────────────
export const THREAT_TYPE = {
  CREDENTIAL_HARVESTING: "credential_harvesting",
  MALWARE_DELIVERY:      "malware_delivery",
  BRAND_IMPERSONATION:   "brand_impersonation",
  SOCIAL_ENGINEERING:    "social_engineering",
  PHISHING:              "phishing",
  MALICIOUS_DOWNLOAD:    "malicious_download",
};

// ── Storage Keys ─────────────────────────────────────────
export const STORE_KEYS = {
  SHIELD_ENABLED: "shield_enabled",
  EVENTS:         "security_events",
  ORG_POLICY:     "org_policy",
  DEVICE_ID:      "device_id",
  ALLOWLIST:      "custom_allowlist",
  BLOCKLIST:      "custom_blocklist",
  WARNINGLIST:    "custom_warninglist",
  LAST_SYNC:      "last_sync_timestamp",
};
