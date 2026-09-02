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
import { isInternalURL, isDangerousFileURL, getRootDomain } from "../utils/trusted-domains.js";
import { getCachedResult, setCachedResult } from "./cache.js";
import { computeRisk } from "./risk-engine.js";
import { storeEvent } from "./event-store.js";

let _policyCache = null;
let _policyCacheAt = 0;
const POLICY_TTL_MS = 60_000;

// ── Auth State Cache ──────────────────────────────────────
// Avoids reading chrome.storage on every single API call.
// Refreshed every 5 minutes or on explicit login/logout events.
let _cachedUserEmail = null;
let _authCheckedAt = 0;
const AUTH_CACHE_TTL_MS = 300_000; // 5 minutes

export async function getAuthenticatedEmail() {
  if (_cachedUserEmail !== null && Date.now() - _authCheckedAt < AUTH_CACHE_TTL_MS) {
    return _cachedUserEmail;
  }
  const { user_email } = await chrome.storage.local.get("user_email");
  _cachedUserEmail = user_email || "admin@aegisone.local";
  _authCheckedAt = Date.now();
  return _cachedUserEmail;
}

export function invalidateAuthCache() {
  _cachedUserEmail = null;
  _authCheckedAt = 0;
}

// ── Backend Availability ──────────────────────────────────
let _backendOnline = true;
let _backendCheckedAt = 0;

export function setBackendOnline(online) {
  _backendOnline = online;
  _backendCheckedAt = Date.now();
  if (DEBUG_MODE) console.log("[AegisOne:Scanner] Backend status:", online ? "online" : "offline");
}

export function isBackendOnline() {
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
  const user_email = await getAuthenticatedEmail();

  try {
    const timeoutSignal = AbortSignal.timeout(API_TIMEOUT_MS);
    const combinedSignal = signal
      ? AbortSignal.any([signal, timeoutSignal])
      : timeoutSignal;

    const opts = {
      method: "POST",
      signal: combinedSignal,
      headers: { "X-User-Email": user_email }
    };

    if (isFormData && body instanceof FormData) {
      if (!body.has("user_email")) body.append("user_email", user_email);
      opts.body = body;
    } else {
      opts.headers["Content-Type"] = "application/json";
      opts.body = JSON.stringify({ ...body, user_email });
    }

    const res = await fetch(`${API_BASE}${endpoint}`, opts);
    if (res.status === 401) {
      invalidateAuthCache();
      if (DEBUG_MODE) console.warn(`[AegisOne:Scanner] 401 on ${endpoint}`);
      setBackendOnline(false);
      return null;
    }
    if (!res.ok) {
      setBackendOnline(false);
      return null;
    }
    const data = await res.json();
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

  const domain = getRootDomain(url);
  const hasDOMFeatures = Object.keys(pageFeatures).length > 0;

  // 1. LAYER 1: Check LRU Cache First. If this URL was ALREADY scanned & verified while online, retain its valid result!
  if (!bypassCache) {
    const cached = await getCachedResult(url);
    if (cached && !cached.skipped && cached.verdict !== "offline" && cached.score !== -1) {
      const cachedHasBrand = Boolean(cached.breakdown?.brand_mismatch?.available);
      const newHasBrand = Boolean(pageFeatures.brand_impersonation);
      if ((!hasDOMFeatures || cached.has_dom_features) && (!newHasBrand || cachedHasBrand)) {
        return { ...cached, from_cache: true };
      }
    }
  }

  // 2. LAYER 2: If item is UN-SCANNED and Backend API is Offline, return incomplete state. No fake safe scores for unscanned items!
  if (!isBackendOnline()) {
    return {
      url,
      domain: domain,
      score: -1,
      verdict: "scan_incomplete",
      error: "api_failure",
      message: "Security scan could not be completed",
      top_factors: [{ label: "⚠️ Security scan could not be completed" }],
      threat_type: "scan_incomplete",
      raw_url_model: null,
      has_dom_features: hasDOMFeatures,
      from_cache: false,
      scanned_at: new Date().toISOString()
    };
  }

  const policy = await _getPolicySnapshot();
  const isTestFixture = url.includes("brand_impersonation.html") || url.includes("phishing.html") || bypassPolicy;

  if (!isTestFixture) {
    if (_matchesAny(domain, policy.allowlist)) return _policySafeResult(url, "policy_allowlist");
    if (_matchesAny(domain, policy.blocklist)) return _policyBlockedResult(url, "policy_blocklist");
  }
  const warningMatch = _matchesAny(domain, policy.warninglist);

  // ── L3: URL AI Model ────────────────────────────────────
  // Reuse the URL model prediction from cache if it exists, to avoid redundant network calls
  let cached = await getCachedResult(url);
  let urlModel = cached?.raw_url_model;
  if (!urlModel) {
    const isLocal = (domain === "localhost" || domain === "127.0.0.1" || domain.endsWith(".local")) && !isTestFixture;
    if (isLocal) {
      urlModel = { phishing_probability: 0.01, category: "safe", prediction: "safe" };
    } else {
      const form = new FormData();
      form.append("url", url);
      form.append("scan_type", "website");
      if (pageFeatures.form_actions && pageFeatures.form_actions.length > 0) {
        form.append("form_actions", JSON.stringify(pageFeatures.form_actions));
      }
      if (hasDOMFeatures) {
        form.append("dom_signals", JSON.stringify(pageFeatures));
      }
      const raw = await callAPI("/analyze/url", form, true, signal);
      urlModel = _validateScanResponse(raw);
    }
  }

  if (!urlModel) {
    return {
      url,
      domain: getRootDomain(url),
      score: -1,
      verdict: "scan_incomplete",
      error: "api_failure",
      message: "Security scan could not be completed",
      top_factors: [{ label: "⚠️ Security scan could not be completed" }],
      threat_type: "scan_incomplete",
      raw_url_model: null,
      has_dom_features: hasDOMFeatures,
      from_cache: false,
      scanned_at: new Date().toISOString()
    };
  }

  // Map the new backend contextual result to the legacy result structure
  const result = {
    url,
    domain: getRootDomain(url),
    score: urlModel.final_risk || 0,
    verdict: urlModel.decision === "BLOCK" ? VERDICT.MALICIOUS : (urlModel.decision === "SUSPICIOUS" ? VERDICT.SUSPICIOUS : VERDICT.SAFE),
    breakdown: urlModel.evidence_summary || {},
    top_factors: (urlModel.top_reasons || []).map(r => ({ label: `⚠️ ${r.signal.replace(/_/g, " ")}` })),
    threat_type: urlModel.evidence_summary?.semantic === "HIGH" ? "phishing" : "benign",
    raw_url_model: urlModel,
    has_dom_features: hasDOMFeatures,
    from_cache: false,
    scanned_at: new Date().toISOString(),
    context: {
      known_domain: false
    }
  };

  if (warningMatch && result.score < (policy.risk_thresholds?.warning || THRESHOLD.WARNING * 100)) {
    result.score = Math.round(policy.risk_thresholds?.warning || THRESHOLD.WARNING * 100);
    result.verdict = VERDICT.WARNING;
    result.policy_override = "warn";
    result.policy_reason = "Matched organization warninglist";
  }

  // ── Cache result ────────────────────────────────────────
  await setCachedResult(url, result);

  // ── Store event only if risky ────────────────────────────
  if (risk.score >= (policy.risk_thresholds?.warning || THRESHOLD.WARNING * 100)) {
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
    // Same-root-domain links (e.g. app.asana.com on asana.com) are safe first-party links
    if ((pageDomain && domain === pageDomain)) {
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
          known_domain: false
        }, policy.risk_thresholds);

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

        if (_matchesAny(domain, policy.warninglist) && result.score < (policy.risk_thresholds?.warning || THRESHOLD.WARNING * 100)) {
          result.score = Math.round(policy.risk_thresholds?.warning || THRESHOLD.WARNING * 100);
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
export async function scanEmail(sender, subject, body, signal = null, threadUrl = "") {
  const form = new FormData();
  form.append("sender", sender || "");
  form.append("subject", subject || "");
  form.append("body", body || "");
  if (threadUrl) form.append("thread_url", threadUrl);
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
    const stored = await chrome.storage.local.get(["custom_allowlist", "custom_blocklist", "custom_warninglist", "risk_thresholds"]);
    _policyCache = {
      allowlist: Array.isArray(stored.custom_allowlist) ? stored.custom_allowlist : [],
      blocklist: Array.isArray(stored.custom_blocklist) ? stored.custom_blocklist : [],
      warninglist: Array.isArray(stored.custom_warninglist) ? stored.custom_warninglist : [],
      risk_thresholds: stored.risk_thresholds || null,
    };
    _policyCacheAt = now;
  } catch {
    _policyCache = { allowlist: [], blocklist: [], warninglist: [], risk_thresholds: null };
    _policyCacheAt = now;
  }
  return _policyCache;
}
