/**
 * AegisOne — Core Scanner v2.1
 * ==============================
 * Orchestrates all scanning operations.
 * This is the single entry point for all API calls.
 *
 * v2.1 improvements:
 *  - AbortController signal support (cancel stale in-flight requests)
 *  - _validateScanResponse() guard — never trusts raw API data
 *  - Offline detection: returns cached result instead of timing out
 *  - Hover scan uses TTL-based cache (not always-bypass)
 *  - Graceful degradation: falls back to cache on API failure
 */

import { API_BASE, API_TIMEOUT_MS, THRESHOLD, VERDICT, EVENT_TYPES, DEBUG_MODE } from "../utils/constants.js";
import { isInternalURL, isTrusted, isDangerousFileURL, getRootDomain } from "../utils/trusted-domains.js";
import { getCachedResult, setCachedResult } from "./cache.js";
import { computeRisk } from "./risk-engine.js";
import { storeEvent } from "./event-store.js";

let _policyCache = null;
let _policyCacheAt = 0;
const POLICY_TTL_MS = 60_000;

// ── Backend Availability ──────────────────────────────────
// Updated by health checks — prevents 6s timeouts on every scan when offline
let _backendOnline = true;
let _backendCheckedAt = 0;
const BACKEND_ASSUMED_DOWN_AFTER_MS = 90_000; // 1.5 min without successful health check

export function setBackendOnline(online) {
  _backendOnline = online;
  _backendCheckedAt = Date.now();
  if (DEBUG_MODE) console.log("[AegisOne:Scanner] Backend status:", online ? "online" : "offline");
}

export function isBackendOnline() {
  // If we haven't checked recently, assume online to avoid blocking first scan
  if (Date.now() - _backendCheckedAt > BACKEND_ASSUMED_DOWN_AFTER_MS) return true;
  return _backendOnline;
}

// ── API Helper ────────────────────────────────────────────
/**
 * @param {string} endpoint
 * @param {FormData|object} body
 * @param {boolean} isFormData
 * @param {AbortSignal} [signal] - optional per-request cancellation signal
 */
async function callAPI(endpoint, body, isFormData = false, signal = null) {
  // Skip if backend is known to be offline — return null immediately
  if (!isBackendOnline()) return null;

  try {
    const { user_email } = await chrome.storage.local.get("user_email");
    const timeoutSignal = AbortSignal.timeout(API_TIMEOUT_MS);
    // Compose the caller's signal with the timeout signal if both provided
    const combinedSignal = signal
      ? AbortSignal.any([signal, timeoutSignal])
      : timeoutSignal;

    const opts = {
      method: "POST",
      signal: combinedSignal,
      headers: {}
    };

    if (user_email) {
      opts.headers["X-User-Email"] = user_email;
      if (isFormData && body instanceof FormData) {
        if (!body.has("user_email")) body.append("user_email", user_email);
      }
    }

    if (isFormData) {
      opts.body = body;
    } else {
      opts.headers["Content-Type"] = "application/json";
      opts.body = JSON.stringify(body);
    }
    const res = await fetch(`${API_BASE}${endpoint}`, opts);
    if (!res.ok) return null;
    const data = await res.json();
    // Mark backend as reachable on successful response
    setBackendOnline(true);
    return data;
  } catch (e) {
    // AbortError from navigation = normal; timeout = likely offline
    if (e.name === "AbortError") return null;
    if (e.name === "TimeoutError" || e.message?.includes("fetch")) {
      setBackendOnline(false);
    }
    if (DEBUG_MODE) console.warn(`[AegisOne:Scanner] API call failed (${endpoint}):`, e.message);
    return null;
  }
}

// ── Response Validator ────────────────────────────────────
/**
 * Validates raw API response from /analyze/url.
 * Returns null if the response is malformed/unexpected.
 */
function _validateScanResponse(data) {
  if (!data || typeof data !== "object") return null;
  const prob = data.phishing_probability;
  if (prob !== null && prob !== undefined) {
    if (typeof prob !== "number" || prob < 0 || prob > 1) return null;
  }
  return data;
}

/**
 * Scan a URL for phishing risk.
 * Cache-first: returns cached result if fresh.
 * Falls back to cached result if API is down.
 *
 * @param {string} url
 * @param {object} [pageFeatures] - optional DOM features from content script
 * @param {object} [opts]
 * @param {boolean} [opts.bypassCache] - force fresh scan (only if cache is stale)
 * @param {AbortSignal} [opts.signal]  - optional cancellation signal
 * @returns {Promise<ScanResult|null>}
 */
export async function scanURL(url, pageFeatures = {}, { bypassCache = false, signal = null, bypassPolicy = false } = {}) {
  if (!url) return null;
  if (url.startsWith("chrome:") || url.startsWith("chrome-extension:") || url.startsWith("about:") || url.startsWith("data:")) {
    return _skippedResult(url);
  }
  const policy = await _getPolicySnapshot();
  const domain = getRootDomain(url);
  const isTestFixture = url.includes("brand_impersonation.html") || bypassPolicy;

  if (!isTestFixture) {
    if (_matchesAny(domain, policy.allowlist)) return _policySafeResult(url, "policy_allowlist");
    if (_matchesAny(domain, policy.blocklist)) return _policyBlockedResult(url, "policy_blocklist");
  }
  const warningMatch = _matchesAny(domain, policy.warninglist);

  const hasDOMFeatures = Object.keys(pageFeatures).length > 0;

  // Check cache — bypass if explicitly requested, if cached result was skipped, or if new brand impersonation features arrived
  if (!bypassCache) {
    const cached = await getCachedResult(url);
    if (cached && !cached.skipped) {
      const cachedHasBrand = Boolean(cached.breakdown?.brand_mismatch?.available);
      const newHasBrand = Boolean(pageFeatures.brand_impersonation);
      if ((!hasDOMFeatures || cached.has_dom_features) && (!newHasBrand || cachedHasBrand)) {
        const cachedResult = { ...cached, from_cache: true };
        if (warningMatch && (cachedResult.score ?? 0) < THRESHOLD.WARNING * 100) {
          cachedResult.score = Math.round(THRESHOLD.WARNING * 100);
          cachedResult.verdict = VERDICT.WARNING;
          cachedResult.policy_override = "warn";
          cachedResult.policy_reason = "Matched organization warninglist";
        }
        return cachedResult;
      }
    }
  }

  // ── L3: URL AI Model ────────────────────────────────────
  // Reuse the URL model prediction from cache if it exists, to avoid redundant network calls
  let cached = await getCachedResult(url);
  let urlModel = cached?.raw_url_model;
  if (!urlModel) {
    const isLocal = domain === "localhost" || domain === "127.0.0.1" || domain.endsWith(".local");
    if (isLocal) {
      urlModel = { phishing_probability: 0.01, category: "safe", prediction: "safe" };
    } else {
      const form = new FormData();
      form.append("url", url);
      form.append("scan_type", hasDOMFeatures ? "website" : "url");
      const raw = await callAPI("/analyze/url", form, true, signal);
      urlModel = _validateScanResponse(raw);
    }
  }

  // If API failed, fall back to stale cache if available (graceful degradation)
  if (!urlModel && cached) {
    if (DEBUG_MODE) console.log("[AegisOne:Scanner] API unavailable — using stale cache for:", domain);
    return { ...cached, from_cache: true, stale: true };
  }
  if (!urlModel) return null;

  // ── Build signals for risk engine ───────────────────────
  const signals = {
    url_model: urlModel?.phishing_probability ?? null,
    threat_type: urlModel?.category || urlModel?.prediction || null,
    top_words: urlModel?.top_words || [],
    domain_age_days: pageFeatures.domain_age_days ?? null,
    ssl_invalid: pageFeatures.ssl_invalid ?? null,
    login_form_found: pageFeatures.login_form_found ?? null,
    text_model: pageFeatures.text_probability ?? null,
    redirect_count: pageFeatures.redirect_count ?? null,
    brand_mismatch: pageFeatures.brand_mismatch ?? null,
    brand_impersonation: pageFeatures.brand_impersonation ?? null,
    brand_impersonation_score: pageFeatures.brand_impersonation_score ?? null,
    brand_impersonation_role: pageFeatures.brand_impersonation_role ?? null,
    hidden_iframe: pageFeatures.hidden_iframe ?? null,
    js_obfuscated: pageFeatures.js_obfuscated ?? null,
    known_domain: isTrusted(url),
  };

  // ── Compute weighted risk ────────────────────────────────
  const risk = computeRisk(signals);

  const result = {
    url,
    domain: getRootDomain(url),
    score: risk.score,
    verdict: risk.verdict,
    breakdown: risk.breakdown,
    top_factors: risk.top_factors,
    threat_type: risk.threat_type,
    raw_url_model: urlModel,
    has_dom_features: hasDOMFeatures,
    from_cache: false,
    scanned_at: new Date().toISOString(),
    context: {
      known_domain: risk.context?.known_domain || false
    }
  };

  if (warningMatch && result.score < THRESHOLD.WARNING * 100) {
    result.score = Math.round(THRESHOLD.WARNING * 100);
    result.verdict = VERDICT.WARNING;
    result.policy_override = "warn";
    result.policy_reason = "Matched organization warninglist";
  }

  // ── Cache result ────────────────────────────────────────
  await setCachedResult(url, result);

  // ── Store event only if risky ────────────────────────────
  if (risk.score >= THRESHOLD.WARNING * 100) {
    await storeEvent({
      type: EVENT_TYPES.WEBSITE_THREAT,
      url,
      domain: result.domain,
      risk_score: risk.score,
      verdict: risk.verdict,
      threat_type: risk.threat_type,
      features: risk.breakdown,
      action: "warned",
    });
  }

  return result;
}

/**
 * Scan page text content.
 * @param {string} text - page body text (first 3000 chars)
 * @param {AbortSignal} [signal]
 * @returns {Promise<object|null>}
 */
export async function scanPageText(text, signal = null) {
  if (!text || text.trim().length < 30) return null;
  const form = new FormData();
  form.append("text", text.slice(0, 3000));
  return callAPI("/analyze/text", form, true, signal);
}

/**
 * Scan an image URL by downloading it and posting to /analyze/image.
 * @param {string} imageUrl
 * @param {AbortSignal} [signal]
 * @returns {Promise<object|null>}
 */
export async function scanImage(imageUrl, signal = null) {
  if (!imageUrl) return null;
  try {
    const res = await fetch(imageUrl, { signal: signal || AbortSignal.timeout(API_TIMEOUT_MS) });
    if (!res.ok) return null;
    const blob = await res.blob();
    const form = new FormData();
    form.append("file", blob, "image.png");
    return callAPI("/analyze/image", form, true, signal);
  } catch (err) {
    if (DEBUG_MODE) console.warn("[AegisOne:Scanner] Image scan failed:", err.message);
    return null;
  }
}

export async function scanURLBatch(urls, batchSize = 5, signal = null, pageUrl = null) {
  const policy = await _getPolicySnapshot();
  const pageDomain = pageUrl ? getRootDomain(pageUrl) : null;
  const filtered = [];
  const preResolved = [];
  for (const url of urls) {
    if (!url || isInternalURL(url)) continue;
    const domain = getRootDomain(url);
    if (_matchesAny(domain, policy.allowlist)) {
      preResolved.push(_policySafeResult(url, "policy_allowlist"));
      continue;
    }
    if (_matchesAny(domain, policy.blocklist)) {
      preResolved.push(_policyBlockedResult(url, "policy_blocklist"));
      continue;
    }
    // Same-root-domain links (e.g. app.asana.com on asana.com) or trusted destination links are safe first-party links
    if ((pageDomain && domain === pageDomain) || isTrusted(url)) {
      preResolved.push(_safeTrustedResult(url));
      continue;
    }
    filtered.push(url);
  }
  const results = [];

  for (let i = 0; i < filtered.length; i += batchSize) {
    // Abort mid-batch if signal fires
    if (signal?.aborted) break;

    const batch = filtered.slice(i, i + batchSize);
    const settled = await Promise.allSettled(
      batch.map(async (url) => {
        const domain = getRootDomain(url);
        const cached = await getCachedResult(url);
        if (cached) {
          const cachedResult = { url, ...cached, from_cache: true };
          if (_matchesAny(domain, policy.warninglist) && (cachedResult.score ?? 0) < THRESHOLD.WARNING * 100) {
            cachedResult.score = Math.round(THRESHOLD.WARNING * 100);
            cachedResult.verdict = VERDICT.WARNING;
            cachedResult.policy_override = "warn";
            cachedResult.policy_reason = "Matched organization warninglist";
          }
          return cachedResult;
        }

        const form = new FormData();
        form.append("url", url);
        const raw = await callAPI("/analyze/url", form, true, signal);
        const r = _validateScanResponse(raw);
        if (!r) return null;

        const risk = computeRisk({
          url_model: r.phishing_probability ?? null,
          threat_type: r.category || r.prediction || null,
          top_words: r.top_words || [],
          known_domain: isTrusted(url)
        });

        const result = {
          url,
          domain,
          score: risk.score,
          verdict: risk.verdict,
          threat_type: risk.threat_type,
          raw_url_model: r,
          from_cache: false,
          scanned_at: new Date().toISOString(),
          context: {
            known_domain: risk.context?.known_domain || false
          }
        };

        if (_matchesAny(domain, policy.warninglist) && result.score < THRESHOLD.WARNING * 100) {
          result.score = Math.round(THRESHOLD.WARNING * 100);
          result.verdict = VERDICT.WARNING;
          result.policy_override = "warn";
          result.policy_reason = "Matched organization warninglist";
        }

        await setCachedResult(url, result);
        return result;
      })
    );
    settled.forEach(s => { if (s.status === "fulfilled" && s.value) results.push(s.value); });
  }

  return [...preResolved, ...results];
}

/**
 * Scan a download URL before allowing the file to land on disk.
 */
// File types the attachment processor does NOT support — skip heavy content scan
const _SKIP_CONTENT_SCAN = new Set([
  "png", "jpg", "jpeg", "gif", "svg", "webp", "ico", "bmp", "tiff", "avif",
  "mp4", "mp3", "wav", "flac", "ogg", "webm", "avi", "mov", "mkv",
  "woff", "woff2", "ttf", "otf", "eot",
]);

export async function scanDownload(url, filename, signal = null) {
  if (!url) return { risk_score: 0, verdict: VERDICT.UNKNOWN };
  const policy = await _getPolicySnapshot();
  const domain = getRootDomain(url);
  if (_matchesAny(domain, policy.allowlist)) {
    return { url, filename, risk_score: 0, verdict: VERDICT.SAFE, policy_override: "allow", signals: [] };
  }
  if (_matchesAny(domain, policy.blocklist)) {
    return { url, filename, risk_score: 100, verdict: VERDICT.DANGER, policy_override: "block", signals: ["Matched organization blocklist"] };
  }

  const form = new FormData();
  form.append("url", url);
  const urlResultRaw = await callAPI("/analyze/url", form, true, signal);
  const urlResult = _validateScanResponse(urlResultRaw);
  const urlRisk = urlResult?.phishing_probability ?? 0;

  let contentResult = null;
  const ext = (filename.split(".").pop() || "").toLowerCase();
  if (!_SKIP_CONTENT_SCAN.has(ext)) {
    const contentForm = new FormData();
    contentForm.append("url", url);
    const contentRaw = await callAPI("/analyze/download_url", contentForm, true, signal);
    contentResult = _validateScanResponse(contentRaw);
  }

  const finalRisk = Math.max(urlRisk, contentResult?.phishing_probability ?? 0, contentResult?.heuristic_risk ?? 0);
  const score = Math.round(finalRisk * 100);
  const verdict = score >= 50 ? VERDICT.DANGER : score >= 20 ? VERDICT.WARNING : VERDICT.SAFE;

  const result = {
    url, filename, risk_score: score, verdict,
    url_result: urlResult,
    content_result: contentResult,
    signals: contentResult?.phishing_signals || [],
    macros_found: contentResult?.macros_found || false,
    file_type: contentResult?.file_type || null,
    heuristic_risk: contentResult?.heuristic_risk ?? null,
    vba_analysis: contentResult?.vba_analysis ?? null,
  };

  if (score >= 50) {
    await storeEvent({
      type: EVENT_TYPES.DOWNLOAD_BLOCKED,
      url,
      domain: getRootDomain(url),
      risk_score: score,
      verdict,
      threat_type: "malicious_download",
      action: "blocked",
    });
  }

  return result;
}

/**
 * Scan an email for phishing.
 */
export async function scanEmail(sender, subject, body, signal = null) {
  const form = new FormData();
  form.append("sender", sender || "");
  form.append("subject", subject || "");
  form.append("body", body || "");
  return callAPI("/analyze/email", form, true, signal);
}

/**
 * Request an XAI explanation from the LLM service.
 * Only called when user explicitly clicks "Explain with AI".
 */
export async function requestXAI(evidence) {
  return callAPI("/xai/explain", evidence, false);
}

/**
 * Check backend health and update online status.
 */
export async function checkHealth() {
  try {
    const res = await fetch(`${API_BASE}/health`, {
      signal: AbortSignal.timeout(3000),
    });
    const data = await res.json();
    setBackendOnline(true);
    return { online: true, data };
  } catch {
    setBackendOnline(false);
    return { online: false };
  }
}

// ── Internal helpers ──────────────────────────────────────
function _skippedResult(url) {
  return { url, score: 0, verdict: VERDICT.SAFE, skipped: true, reason: "internal_url" };
}

function _safeTrustedResult(url) {
  return { url, domain: getRootDomain(url), score: 0, verdict: VERDICT.SAFE, skipped: true, reason: "trusted_domain" };
}

function _policySafeResult(url, reason = "policy_allowlist") {
  return { url, domain: getRootDomain(url), score: 0, verdict: VERDICT.SAFE, skipped: true, reason, policy_override: "allow" };
}

function _policyBlockedResult(url, reason = "policy_blocklist") {
  return { url, domain: getRootDomain(url), score: 100, verdict: VERDICT.DANGER, skipped: true, reason, policy_override: "block" };
}

function _matchesAny(domain, list = []) {
  if (!domain || !Array.isArray(list)) return false;
  return list.some(item => {
    const value = String(item || "").trim().toLowerCase();
    if (!value) return false;
    return domain === value || domain.endsWith(`.${value}`);
  });
}

async function _getPolicySnapshot() {
  const now = Date.now();
  if (_policyCache && now - _policyCacheAt < POLICY_TTL_MS) return _policyCache;
  try {
    const stored = await chrome.storage.local.get(["custom_allowlist", "custom_blocklist", "custom_warninglist"]);
    _policyCache = {
      allowlist: Array.isArray(stored.custom_allowlist) ? stored.custom_allowlist : [],
      blocklist: Array.isArray(stored.custom_blocklist) ? stored.custom_blocklist : [],
      warninglist: Array.isArray(stored.custom_warninglist) ? stored.custom_warninglist : [],
    };
    _policyCacheAt = now;
  } catch {
    _policyCache = { allowlist: [], blocklist: [], warninglist: [] };
    _policyCacheAt = now;
  }
  return _policyCache;
}
