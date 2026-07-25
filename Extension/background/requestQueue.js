/**
 * AegisOne — Request Deduplication Queue
 * ========================================
 * Prevents multiple identical concurrent scans for the same URL.
 *
 * Problem: If the user hovers the same link 5 times in quick succession,
 * the old code would fire 5 separate API calls. This module merges them
 * into a single in-flight Promise — callers 2–5 simply await the same result.
 *
 * Usage:
 *   import { enqueue } from "./requestQueue.js";
 *   const result = await enqueue(url, () => scanURL(url));
 *
 * The queue automatically clears entries once the Promise settles.
 * TTL: 30 seconds max per in-flight entry (safety valve against hangs).
 */

const _inFlight = new Map(); // url → { promise, timer }
const IN_FLIGHT_TTL_MS = 30_000;

/**
 * Enqueue a scan request for a URL.
 * If the same URL is already being scanned, returns the existing Promise.
 *
 * @param {string} key       - dedup key (usually the URL)
 * @param {Function} factory - async function that performs the actual work
 * @returns {Promise<any>}
 */
export function enqueue(key, factory) {
  const existing = _inFlight.get(key);
  if (existing) return existing.promise;

  const promise = factory().finally(() => {
    const entry = _inFlight.get(key);
    if (entry) clearTimeout(entry.timer);
    _inFlight.delete(key);
  });

  // Safety valve: clear entry if it hangs beyond TTL
  const timer = setTimeout(() => _inFlight.delete(key), IN_FLIGHT_TTL_MS);

  _inFlight.set(key, { promise, timer });
  return promise;
}

/**
 * Cancel a specific in-flight entry (e.g., when tab navigates away).
 * Callers awaiting the same URL will get undefined.
 * @param {string} key
 */
export function cancelKey(key) {
  const entry = _inFlight.get(key);
  if (entry) {
    clearTimeout(entry.timer);
    _inFlight.delete(key);
  }
}

/**
 * Cancel all in-flight requests for a given tab.
 * Call this when a tab navigates or closes.
 * @param {string[]} keys - array of URL keys to cancel
 */
export function cancelAll(keys = []) {
  for (const key of keys) cancelKey(key);
}

/**
 * Returns the number of currently in-flight requests (for diagnostics).
 */
export function queueSize() {
  return _inFlight.size;
}
