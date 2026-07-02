/**
 * AegisOne — Event-Based Storage
 * ================================
 * Stores security EVENTS only — not browsing history.
 *
 * Events are stored in chrome.storage.local.
 * Hot events (last 7 days) stay local.
 * Events are batched and flushed to dashboard periodically.
 *
 * Storage budget: ~50 events max locally (each ~1-2KB).
 * Older events are pruned once limit is reached.
 */

import { STORE_KEYS, EVENT_TYPES } from "../utils/constants.js";

const MAX_LOCAL_EVENTS = 100;

/**
 * Store a security event. Only called for high-risk situations.
 *
 * @param {object} event
 * @param {string} event.type        - EVENT_TYPES constant
 * @param {string} event.url
 * @param {string} event.domain
 * @param {number} event.risk_score  - 0–100
 * @param {string} event.verdict
 * @param {string} [event.threat_type]
 * @param {object} [event.features]  - risk breakdown
 * @param {string} [event.action]    - blocked | warned | allowed
 * @param {string} [event.xai_id]    - if XAI was requested
 */
export async function storeEvent(event) {
  try {
    const entry = {
      id: _uuid(),
      timestamp: new Date().toISOString(),
      synced: false,
      ...event,
    };

    const stored = await _getEvents();
    stored.unshift(entry); // newest first

    // Prune to max limit
    const pruned = stored.slice(0, MAX_LOCAL_EVENTS);
    await chrome.storage.local.set({ [STORE_KEYS.EVENTS]: pruned });

    return entry.id;
  } catch (err) {
    console.warn("[AegisOne:EventStore] Failed to store event:", err);
    return null;
  }
}

/**
 * Retrieve all local events (for popup display).
 * @param {object} [opts]
 * @param {number} [opts.limit]       - max events to return
 * @param {string} [opts.type]        - filter by event type
 * @param {number} [opts.minRisk]     - filter by min risk score
 * @returns {Promise<Array>}
 */
export async function getEvents({ limit = 50, type = null, minRisk = 0 } = {}) {
  const events = await _getEvents();
  return events
    .filter(e => (!type || e.type === type) && (e.risk_score || 0) >= minRisk)
    .slice(0, limit);
}

/**
 * Mark events as synced (after dashboard flush).
 * @param {string[]} ids
 */
export async function markSynced(ids) {
  const idSet = new Set(ids);
  const events = await _getEvents();
  const updated = events.map(e => idSet.has(e.id) ? { ...e, synced: true } : e);
  await chrome.storage.local.set({ [STORE_KEYS.EVENTS]: updated });
}

/**
 * Get unsynced events for dashboard flush.
 */
export async function getUnsyncedEvents() {
  const events = await _getEvents();
  return events.filter(e => !e.synced);
}

/**
 * Clear all stored events.
 */
export async function clearEvents() {
  await chrome.storage.local.set({ [STORE_KEYS.EVENTS]: [] });
}

// ── Internal ──────────────────────────────────────────────
async function _getEvents() {
  try {
    const data = await chrome.storage.local.get(STORE_KEYS.EVENTS);
    return Array.isArray(data[STORE_KEYS.EVENTS]) ? data[STORE_KEYS.EVENTS] : [];
  } catch { return []; }
}

function _uuid() {
  return crypto.randomUUID?.() ||
    "xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx".replace(/[xy]/g, c => {
      const r = Math.random() * 16 | 0;
      return (c === "x" ? r : (r & 0x3 | 0x8)).toString(16);
    });
}
