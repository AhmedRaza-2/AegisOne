/**
 * AegisOne — Dashboard Sync v2.1
 * ==========================
 * Batches unsynced security events and sends them to
 * the AegisOne dashboard API every 30 seconds.
 *
 * v2.1 improvements:
 *  - Exponential backoff on flush failures (30s → 60s → 120s → 300s)
 *  - Resets backoff on success
 *  - No production console.log (DEBUG_MODE guard)
 *  - Heartbeat updates setBackendOnline flag in scanner
 */

import { API_BASE, EVENT_SYNC_INTERVAL_MS, STORE_KEYS, SYNC_BACKOFF_STEPS, DEBUG_MODE } from "../utils/constants.js";
import { getUnsyncedEvents, markSynced } from "./event-store.js";
import { setBackendOnline } from "./scanner.js";

let _syncTimer = null;
let _heartbeatTimer = null;
let _backoffIndex = 0;         // current position in SYNC_BACKOFF_STEPS
let _scheduledRetry = null;    // handle for backoff retry timer
const HEARTBEAT_INTERVAL_MS = 5 * 60 * 1000;

/**
 * Start the periodic sync timer.
 * Call once from service worker initialization.
 */
export function startSync() {
  if (_syncTimer) return;
  _syncTimer = setInterval(_flush, EVENT_SYNC_INTERVAL_MS);

  if (!_heartbeatTimer) {
    _heartbeatTimer = setInterval(() => {
      chrome.storage.local.get(STORE_KEYS.DEVICE_ID).then(({ [STORE_KEYS.DEVICE_ID]: deviceId }) => {
        if (deviceId) {
          _registerOrHeartbeat(deviceId, false)
            .then(() => setBackendOnline(true))
            .catch(() => setBackendOnline(false));
        }
      }).catch(() => {});
    }, HEARTBEAT_INTERVAL_MS);
  }

  if (DEBUG_MODE) console.log("[AegisOne:Sync] Dashboard sync started (every 30s)");
}

/**
 * Immediately flush all unsynced events to the dashboard.
 * Can be called manually (e.g., after a threat report).
 */
export async function flushNow() {
  await _flush();
}

// ── Internal ──────────────────────────────────────────────
async function _flush() {
  // Cancel any pending backoff retry — we're running now
  if (_scheduledRetry) {
    clearTimeout(_scheduledRetry);
    _scheduledRetry = null;
  }

  try {
    const events = await getUnsyncedEvents();
    if (events.length === 0) return;

    const { [STORE_KEYS.ORG_POLICY]: policy, [STORE_KEYS.DEVICE_ID]: deviceId } =
      await chrome.storage.local.get([STORE_KEYS.ORG_POLICY, STORE_KEYS.DEVICE_ID]);

    const enriched = events.map(e => ({
      ...e,
      org_id: policy?.org_id || null,
      device_id: deviceId || null,
    }));

    const res = await fetch(`${API_BASE}/events/ingest`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ events: enriched }),
      signal: AbortSignal.timeout(10_000),
    });

    if (res.ok) {
      const syncedIds = events.map(e => e.id);
      await markSynced(syncedIds);
      await chrome.storage.local.set({ [STORE_KEYS.LAST_SYNC]: new Date().toISOString() });
      // Reset backoff on success
      _backoffIndex = 0;
      setBackendOnline(true);
      if (DEBUG_MODE) console.log(`[AegisOne:Sync] Flushed ${syncedIds.length} events to dashboard.`);
    } else {
      _scheduleRetry();
    }
  } catch (err) {
    // Silent fail — events stay unsynced, will retry with backoff
    if (DEBUG_MODE) console.warn("[AegisOne:Sync] Flush failed (will retry):", err.message);
    setBackendOnline(false);
    _scheduleRetry();
  }
}

/**
 * Schedule a retry with exponential backoff.
 * Steps: 30s → 60s → 120s → 300s (capped).
 */
function _scheduleRetry() {
  const delay = SYNC_BACKOFF_STEPS[_backoffIndex] || SYNC_BACKOFF_STEPS[SYNC_BACKOFF_STEPS.length - 1];
  _backoffIndex = Math.min(_backoffIndex + 1, SYNC_BACKOFF_STEPS.length - 1);
  if (DEBUG_MODE) console.log(`[AegisOne:Sync] Retry scheduled in ${delay / 1000}s`);
  _scheduledRetry = setTimeout(_flush, delay);
}

/**
 * Fetch and store organization security policy from dashboard.
 * Called on service worker startup.
 */
export async function fetchOrgPolicy() {
  try {
    const { [STORE_KEYS.DEVICE_ID]: deviceId } = await chrome.storage.local.get(STORE_KEYS.DEVICE_ID);
    if (!deviceId) return;

    const res = await fetch(`${API_BASE}/policy/current?device_id=${deviceId}`, {
      signal: AbortSignal.timeout(5000),
    });
    if (!res.ok) return;

    const policy = await res.json();
    await chrome.storage.local.set({ [STORE_KEYS.ORG_POLICY]: policy });

    if (Array.isArray(policy.allowlist)) {
      await chrome.storage.local.set({ [STORE_KEYS.ALLOWLIST]: policy.allowlist });
    }
    if (Array.isArray(policy.blocklist)) {
      await chrome.storage.local.set({ [STORE_KEYS.BLOCKLIST]: policy.blocklist });
    }
    if (Array.isArray(policy.warninglist)) {
      await chrome.storage.local.set({ [STORE_KEYS.WARNINGLIST]: policy.warninglist });
    }
    if (policy.risk_thresholds) {
      await chrome.storage.local.set({ [STORE_KEYS.RISK_THRESHOLDS]: policy.risk_thresholds });
    }

    await _registerOrHeartbeat(deviceId, false).catch(() => {});
    setBackendOnline(true);

    if (DEBUG_MODE) console.log("[AegisOne:Sync] Org policy fetched:", policy.org_name || "unknown");
  } catch (_) {
    // Dashboard offline — use last cached policy
  }
}

/**
 * Generate and store a persistent device ID on first install.
 */
export async function ensureDeviceId() {
  const { [STORE_KEYS.DEVICE_ID]: existing } = await chrome.storage.local.get(STORE_KEYS.DEVICE_ID);
  const id = existing || `aegis_${crypto.randomUUID?.() || Date.now()}`;

  if (!existing) {
    await chrome.storage.local.set({ [STORE_KEYS.DEVICE_ID]: id });
    if (DEBUG_MODE) console.log("[AegisOne:Sync] Device ID generated and stored:", id);
  }

  // Best-effort backend registration — silent fail if server is offline
  _registerOrHeartbeat(id, true)
    .then(() => setBackendOnline(true))
    .catch(() => {
      if (DEBUG_MODE) console.log("[AegisOne:Sync] Backend offline — device ID stored locally, will sync later");
    });

  return id;
}

async function _registerOrHeartbeat(deviceId, register = false) {
  let userId = null;
  let orgId = null;
  
  try {
    const configUrl = chrome.runtime.getURL("config.json");
    const response = await fetch(configUrl);
    if (response.ok) {
      const config = await response.json();
      userId = config.user_id || null;
      orgId = config.organization_id || null;
    }
  } catch (e) {
    // config.json not present or could not be loaded, fall back
  }

  const payload = {
    device_id: deviceId,
    browser: _detectBrowser(),
    browser_version: _detectBrowserVersion(),
    os: _detectOS(),
    user_id: userId,
    organization_id: orgId
  };

  const endpoint = register ? "/devices/register" : "/devices/heartbeat";
  const res = await fetch(`${API_BASE}${endpoint}`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
    signal: AbortSignal.timeout(5000),
  });

  if (!res.ok) {
    throw new Error(`device ${register ? "register" : "heartbeat"} failed`);
  }
}

function _detectBrowser() {
  const ua = navigator.userAgent || "";
  if (ua.includes("Edg/")) return "Edge";
  if (ua.includes("Chrome/")) return "Chrome";
  if (ua.includes("Firefox/")) return "Firefox";
  return "Unknown";
}

function _detectBrowserVersion() {
  const ua = navigator.userAgent || "";
  const match = ua.match(/(Chrome|Edg|Firefox)\/([\d.]+)/);
  return match ? match[2] : "unknown";
}

function _detectOS() {
  const ua = navigator.userAgent || "";
  if (ua.includes("Windows")) return "Windows";
  if (ua.includes("Mac OS X")) return "macOS";
  if (ua.includes("Linux")) return "Linux";
  return navigator.platform || "unknown";
}
