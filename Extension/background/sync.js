/**
 * AegisOne — Dashboard Sync
 * ==========================
 * Batches unsynced security events and sends them to
 * the AegisOne dashboard API every 30 seconds.
 *
 * Uses the org_id and device_id from storage.
 * Only sends events that haven't been synced yet.
 * On success, marks events as synced.
 */

import { API_BASE, EVENT_SYNC_INTERVAL_MS, STORE_KEYS } from "../utils/constants.js";
import { getUnsyncedEvents, markSynced } from "./event-store.js";

let _syncTimer = null;
let _heartbeatTimer = null;
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
        if (deviceId) _registerOrHeartbeat(deviceId, false).catch(() => {});
      }).catch(() => {});
    }, HEARTBEAT_INTERVAL_MS);
  }
  console.log("[AegisOne:Sync] Dashboard sync started (every 30s)");
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
  try {
    const events = await getUnsyncedEvents();
    if (events.length === 0) return;

    const { [STORE_KEYS.ORG_POLICY]: policy, [STORE_KEYS.DEVICE_ID]: deviceId } =
      await chrome.storage.local.get([STORE_KEYS.ORG_POLICY, STORE_KEYS.DEVICE_ID]);

    // Attach org/device identifiers
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
      console.log(`[AegisOne:Sync] Flushed ${syncedIds.length} events to dashboard.`);
    }
  } catch (err) {
    // Silent fail — events stay unsynced, will retry next interval
    console.warn("[AegisOne:Sync] Flush failed (will retry):", err.message);
  }
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

    // Update allowlist / blocklist from policy
    if (Array.isArray(policy.allowlist)) {
      await chrome.storage.local.set({ [STORE_KEYS.ALLOWLIST]: policy.allowlist });
    }
    if (Array.isArray(policy.blocklist)) {
      await chrome.storage.local.set({ [STORE_KEYS.BLOCKLIST]: policy.blocklist });
    }
    if (Array.isArray(policy.warninglist)) {
      await chrome.storage.local.set({ [STORE_KEYS.WARNINGLIST]: policy.warninglist });
    }

    await _registerOrHeartbeat(deviceId, false).catch(() => {});

    console.log("[AegisOne:Sync] Org policy fetched:", policy.org_name || "unknown");
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

  // ✅ Save locally FIRST — works even when backend is offline
  if (!existing) {
    await chrome.storage.local.set({ [STORE_KEYS.DEVICE_ID]: id });
    console.log("[AegisOne:Sync] Device ID generated and stored:", id);
  }

  // Best-effort backend registration — silent fail if server is offline
  _registerOrHeartbeat(id, true).catch(() => {
    console.log("[AegisOne:Sync] Backend offline — device ID stored locally, will sync later");
  });

  return id;
}


async function _registerOrHeartbeat(deviceId, register = false) {
  const payload = {
    device_id: deviceId,
    browser: _detectBrowser(),
    browser_version: _detectBrowserVersion(),
    os: _detectOS(),
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
