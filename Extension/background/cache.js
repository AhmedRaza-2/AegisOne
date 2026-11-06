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
import "../utils/secure-store.js";   // persisted scan results reveal browsing history: stored AES-GCM encrypted

// ── In-memory store ───────────────────────────────────────
const _memCache = new Map();

// Persisted entries are named by a keyed hash of host+path, never the address itself (a storage key is readable
// on disk even when its value is encrypted). The salt is random per install and kept in the encrypted store, so
// the names cannot be reversed by hashing a list of guessed URLs.
let _saltPromise = null;
function _salt() {
  if (!_saltPromise) {
    _saltPromise = (async () => {
      const { cache_salt } = await globalThis.AegisSecure.get("cache_salt");
      if (cache_salt) return cache_salt;
      const s = Array.from(crypto.getRandomValues(new Uint8Array(16)), (b) => b.toString(16).padStart(2, "0")).join("");
      await globalThis.AegisSecure.set({ cache_salt: s });
      return s;
    })().catch((e) => { _saltPromise = null; throw e; });
  }
  return _saltPromise;
}

async function _storageKey(key) {
  const d = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(`${await _salt()}|${key}`));
  return "cache_" + Array.from(new Uint8Array(d).slice(0, 16), (b) => b.toString(16).padStart(2, "0")).join("");
}

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
    const sk = await _storageKey(key);
    const entry = (await globalThis.AegisSecure.get(sk))[sk];
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
    await globalThis.AegisSecure.set({ [await _storageKey(key)]: entry });
  } catch (_) { /* quota may be full */ }
}

/**
 * Invalidate a specific domain's cache entry.
 */
export function invalidateDomain(url) {
  const key = getCacheKey(url);
  if (!key) return;
  _memCache.delete(key);
  _storageKey(key).then((sk) => chrome.storage.local.remove(sk)).catch(() => {});
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
  // Only the scan-result entries. chrome.storage.local also holds the server address, the (encrypted)
  // sign-in tokens, the device id and the user's settings - clearing everything here signed users out and
  // forgot a configured server on every browser start.
  try {
    const all = await chrome.storage.local.get(null);
    const keys = Object.keys(all).filter((k) => k.startsWith("cache_") && k !== "cache_salt");
    if (keys.length) await chrome.storage.local.remove(keys);
  } catch (_) {}
}

// ── Internal helpers ──────────────────────────────────────
function _isExpired(entry) {
  return Date.now() - (entry.cached_at || 0) > CACHE.DOMAIN_TTL_MS;
}
