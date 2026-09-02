/**
 * AegisOne — Domain-Level LRU Cache
 * ===================================
 * Prevents re-scanning the same domain repeatedly.
 *
 * Layer 1: In-memory Map (fastest — survives service worker restart if warm)
 * Layer 2: chrome.storage.local (persists across restarts, slower)
 *
 * Key: root domain string (e.g. "paypal-login.xyz")
 * Value: { score, verdict, breakdown, threat_type, cached_at, url }
 */

import { CACHE, STORE_KEYS } from "../utils/constants.js";

// ── In-memory store ───────────────────────────────────────
const _memCache = new Map();

/**
 * Generate a normalized cache key from a URL (path-specific, ignoring query/hash).
 */
function getCacheKey(url) {
  if (!url) return "";
  try {
    const u = new URL(url);
    return `${u.host.toLowerCase()}${u.pathname.toLowerCase()}`.replace(/\/$/, "");
  } catch (_) {
    return url.toLowerCase().trim();
  }
}

/**
 * Get a cached result for a URL.
 * Returns null if not found or expired.
 */
export async function getCachedResult(url) {
  const key = getCacheKey(url);
  if (!key) return null;

  // Check memory first
  const mem = _memCache.get(key);
  if (mem && !_isExpired(mem)) return mem;
  if (mem) { _memCache.delete(key); }

  // Fall back to storage
  try {
    const data = await chrome.storage.local.get(`cache_${key}`);
    const entry = data[`cache_${key}`];
    if (entry && !_isExpired(entry)) {
      _memCache.set(key, entry); // Warm memory cache
      return entry;
    }
  } catch (_) { /* storage unavailable */ }

  return null;
}

/**
 * Store a scan result for a URL.
 */
export async function setCachedResult(url, result) {
  const key = getCacheKey(url);
  if (!key) return;

  const entry = { ...result, cached_at: Date.now() };

  // Evict oldest if over limit
  if (_memCache.size >= CACHE.DOMAIN_MAX_SIZE) {
    const firstKey = _memCache.keys().next().value;
    _memCache.delete(firstKey);
  }

  _memCache.set(key, entry);

  // Persist to storage (fire-and-forget)
  try {
    await chrome.storage.local.set({ [`cache_${key}`]: entry });
  } catch (_) { /* quota may be full */ }
}

/**
 * Invalidate a specific domain's cache entry.
 */
export function invalidateDomain(url) {
  const key = getCacheKey(url);
  if (!key) return;
  _memCache.delete(key);
  chrome.storage.local.remove(`cache_${key}`).catch(() => {});
}

/**
 * Tab-level cache: stores per-tab scan state in memory only.
 */
const _tabCache = new Map();

export function getTabCache(tabId) {
  return _tabCache.get(tabId) || null;
}

export function setTabCache(tabId, data) {
  if (_tabCache.size >= CACHE.TAB_MAX_SIZE) {
    const first = _tabCache.keys().next().value;
    _tabCache.delete(first);
  }
  _tabCache.set(tabId, { ...data, updated_at: Date.now() });
}

export function clearTabCache(tabId) {
  _tabCache.delete(tabId);
}

export async function clearAllCache() {
  _memCache.clear();
  _tabCache.clear();
  try {
    await chrome.storage.local.clear();
  } catch (_) {}
}

// ── Internal helpers ──────────────────────────────────────
function _isExpired(entry) {
  return Date.now() - (entry.cached_at || 0) > CACHE.DOMAIN_TTL_MS;
}
