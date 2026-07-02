/**
 * AegisOne — Core Scanner
 * ========================
 * Orchestrates all scanning operations.
 * This is the single entry point for all API calls.
 *
 * Responsibilities:
 *  - Call API endpoints with timeout + retry
 *  - Run risk engine on returned signals
 *  - Check/write cache
 *  - Return normalized ScanResult objects
 */

import { API_BASE, API_TIMEOUT_MS, THRESHOLD, VERDICT, EVENT_TYPES } from "../utils/constants.js";
import { isInternalURL, isTrusted, isDangerousFileURL, getRootDomain } from "../utils/trusted-domains.js";
import { getCachedResult, setCachedResult } from "./cache.js";
import { computeRisk } from "./risk-engine.js";
import { storeEvent } from "./event-store.js";

// ── API Helper ────────────────────────────────────────────
async function callAPI(endpoint, body, isFormData = false) {
  try {
    const opts = {
      method: "POST",
      signal: AbortSignal.timeout(API_TIMEOUT_MS),
    };
    if (isFormData) {
      opts.body = body;
    } else {
      opts.headers = { "Content-Type": "application/json" };
      opts.body = JSON.stringify(body);
    }
    const res = await fetch(`${API_BASE}${endpoint}`, opts);
    if (!res.ok) return null;
    return await res.json();
  } catch (e) {
    console.warn(`[AegisOne:Scanner] API call failed (${endpoint}):`, e.message);
    return null;
  }
}

/**
 * Scan a URL for phishing risk.
 * Cache-first: returns cached result if fresh.
 *
 * @param {string} url
 * @param {object} [pageFeatures] - optional DOM features from content script
 * @returns {Promise<ScanResult>}
 */
export async function scanURL(url, pageFeatures = {}) {
  if (!url || isInternalURL(url)) return _skippedResult(url);
  if (isTrusted(url)) return _trustedResult(url);

  const cached = await getCachedResult(url);
  const hasDOMFeatures = Object.keys(pageFeatures).length > 0;

  if (cached) {
    // If we don't have new DOM features, or the cache already has DOM-level results, return cache directly
    if (!hasDOMFeatures || cached.has_dom_features) {
      return { ...cached, from_cache: true };
    }
  }

  // ── Step 1: URL AI Model ──────────────────────────────
  // Reuse the URL model prediction from cache if it exists, to avoid redundant network calls
  let urlModel = cached?.raw_url_model;
  if (!urlModel) {
    const form = new FormData();
    form.append("url", url);
    urlModel = await callAPI("/analyze/url", form, true);
  }

  // ── Step 2: Build signals for risk engine ─────────────
  const signals = {
    url_model: urlModel?.phishing_probability ?? null,
    threat_type: urlModel?.category || urlModel?.prediction || null,
    top_words: urlModel?.top_words || [],
    // DOM features from content script
    domain_age_days: pageFeatures.domain_age_days ?? null,
    ssl_invalid: pageFeatures.ssl_invalid ?? null,
    login_form_found: pageFeatures.login_form_found ?? null,
    text_model: pageFeatures.text_probability ?? null,
    redirect_count: pageFeatures.redirect_count ?? null,
    brand_mismatch: pageFeatures.brand_mismatch ?? null,
    hidden_iframe: pageFeatures.hidden_iframe ?? null,
    js_obfuscated: pageFeatures.js_obfuscated ?? null,
  };

  // ── Step 3: Compute weighted risk ─────────────────────
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
  };

  // ── Step 4: Cache result ───────────────────────────────
  await setCachedResult(url, result);

  // ── Step 5: Store event only if risky ─────────────────
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
 * @returns {Promise<object|null>}
 */
export async function scanPageText(text) {
  if (!text || text.trim().length < 30) return null;
  const form = new FormData();
  form.append("text", text.slice(0, 3000));
  return callAPI("/analyze/text", form, true);
}

/**
 * Scan multiple URLs in parallel (batched to avoid flooding).
 * @param {string[]} urls
 * @param {number} batchSize
 * @returns {Promise<Array>}
 */
export async function scanURLBatch(urls, batchSize = 5) {
  const filtered = urls.filter(u => u && !isInternalURL(u) && !isTrusted(u));
  const results = [];

  for (let i = 0; i < filtered.length; i += batchSize) {
    const batch = filtered.slice(i, i + batchSize);
    const settled = await Promise.allSettled(
      batch.map(async (url) => {
        const cached = await getCachedResult(url);
        if (cached) return { url, ...cached, from_cache: true };
        const form = new FormData();
        form.append("url", url);
        const r = await callAPI("/analyze/url", form, true);
        return r ? { url, score: Math.round((r.phishing_probability || 0) * 100), ...r } : null;
      })
    );
    settled.forEach(s => { if (s.status === "fulfilled" && s.value) results.push(s.value); });
  }

  return results;
}

/**
 * Scan a download URL before allowing the file to land on disk.
 * @param {string} url
 * @param {string} filename
 * @returns {Promise<object>} - { risk_score, verdict, signals, ... }
 */
export async function scanDownload(url, filename) {
  if (!url) return { risk_score: 0, verdict: VERDICT.UNKNOWN };

  // 1. Quick URL scan
  const form = new FormData();
  form.append("url", url);
  const urlResult = await callAPI("/analyze/url", form, true);
  const urlRisk = urlResult?.phishing_probability ?? 0;

  // 2. Deep content scan (server fetches file)
  let contentResult = null;
  if (isDangerousFileURL(url)) {
    const contentForm = new FormData();
    contentForm.append("url", url);
    contentResult = await callAPI("/analyze/download_url", contentForm, true);
  }

  const finalRisk = Math.max(
    urlRisk,
    contentResult?.phishing_probability ?? 0
  );
  const score = Math.round(finalRisk * 100);
  const verdict = score >= 50 ? VERDICT.DANGER : score >= 20 ? VERDICT.WARNING : VERDICT.SAFE;

  const result = {
    url,
    filename,
    risk_score: score,
    verdict,
    url_result: urlResult,
    content_result: contentResult,
    signals: contentResult?.phishing_signals || [],
    macros_found: contentResult?.macros_found || false,
    file_type: contentResult?.file_type || null,
  };

  // Store event only for warnings/blocks
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
export async function scanEmail(sender, subject, body) {
  const form = new FormData();
  form.append("sender", sender || "");
  form.append("subject", subject || "");
  form.append("body", body || "");
  return callAPI("/analyze/email", form, true);
}

/**
 * Request an XAI explanation from the LLM service.
 * Only called when user explicitly clicks "Explain with AI".
 *
 * @param {object} evidence - compact evidence payload (NOT full HTML)
 * @returns {Promise<object|null>}
 */
export async function requestXAI(evidence) {
  return callAPI("/xai/explain", evidence, false);
}

/**
 * Check backend health.
 */
export async function checkHealth() {
  try {
    const res = await fetch(`${API_BASE}/health`, {
      signal: AbortSignal.timeout(3000),
    });
    const data = await res.json();
    return { online: true, data };
  } catch {
    return { online: false };
  }
}

// ── Internal helpers ──────────────────────────────────────
function _skippedResult(url) {
  return { url, score: 0, verdict: VERDICT.SAFE, skipped: true, reason: "internal_url" };
}

function _trustedResult(url) {
  return { url, domain: getRootDomain(url), score: 0, verdict: VERDICT.SAFE, trusted: true, from_cache: false };
}
