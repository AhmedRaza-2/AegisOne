/**
 * AegisOne — Weighted Risk Engine
 * ================================
 * Converts raw AI model scores + DOM features into a
 * single explainable composite risk score.
 *
 * NEVER returns a black-box number.
 * Every score comes with a human-readable breakdown.
 */

import { RISK_WEIGHTS, VERDICT, THRESHOLD } from "../utils/constants.js";

/**
 * Compute composite risk from all available signals.
 *
 * @param {object} signals
 * @param {number}  signals.url_model        0–1, from URL AI classifier
 * @param {number}  signals.domain_age_days  days since registration (-1 = unknown)
 * @param {boolean} signals.ssl_invalid      true if cert is bad/self-signed
 * @param {boolean} signals.login_form_found true if suspicious login form detected
 * @param {number}  signals.text_model       0–1, from text AI classifier
 * @param {number}  signals.redirect_count   number of redirects in chain
 * @param {boolean} signals.brand_mismatch   true if logo domain ≠ current domain
 * @param {boolean} signals.hidden_iframe    true if hidden iframes found
 * @param {boolean} signals.js_obfuscated    true if obfuscated JS detected
 * @param {string}  signals.threat_type      from URL model category field
 *
 * @returns {{ score: number, verdict: string, breakdown: object, threat_type: string }}
 */
export function computeRisk(signals = {}) {
  const breakdown = {};
  let weighted_sum = 0;
  let weight_used = 0;

  // ── 1. URL Model ──────────────────────────────────────
  if (signals.url_model != null) {
    const s = clamp(signals.url_model * 100);
    breakdown.url_model = {
      score: s,
      weight: RISK_WEIGHTS.url_model,
      label: _urlModelLabel(signals.url_model, signals.threat_type),
      available: true,
    };
    weighted_sum += s * RISK_WEIGHTS.url_model;
    weight_used += RISK_WEIGHTS.url_model;
  }

  // ── 2. Domain Age ─────────────────────────────────────
  if (signals.domain_age_days != null && signals.domain_age_days >= 0) {
    const s = _domainAgeScore(signals.domain_age_days);
    breakdown.domain_age = {
      score: s,
      weight: RISK_WEIGHTS.domain_age,
      label: _domainAgeLabel(signals.domain_age_days),
      available: true,
    };
    weighted_sum += s * RISK_WEIGHTS.domain_age;
    weight_used += RISK_WEIGHTS.domain_age;
  }

  // ── 3. SSL / TLS ──────────────────────────────────────
  if (signals.ssl_invalid != null) {
    const s = signals.ssl_invalid ? 90 : 0;
    breakdown.ssl = {
      score: s,
      weight: RISK_WEIGHTS.ssl_invalid,
      label: signals.ssl_invalid ? "Invalid or self-signed TLS certificate" : "Valid TLS certificate",
      available: true,
    };
    weighted_sum += s * RISK_WEIGHTS.ssl_invalid;
    weight_used += RISK_WEIGHTS.ssl_invalid;
  }

  // ── 4. Login Form ─────────────────────────────────────
  if (signals.login_form_found != null) {
    const s = signals.login_form_found ? 85 : 0;
    breakdown.login_form = {
      score: s,
      weight: RISK_WEIGHTS.login_form,
      label: signals.login_form_found ? "Suspicious credential form detected" : "No suspicious forms",
      available: true,
    };
    weighted_sum += s * RISK_WEIGHTS.login_form;
    weight_used += RISK_WEIGHTS.login_form;
  }

  // ── 5. Text Content AI ────────────────────────────────
  if (signals.text_model != null) {
    const s = clamp(signals.text_model * 100);
    breakdown.text_content = {
      score: s,
      weight: RISK_WEIGHTS.text_content,
      label: _textModelLabel(signals.text_model, signals.top_words),
      available: true,
    };
    weighted_sum += s * RISK_WEIGHTS.text_content;
    weight_used += RISK_WEIGHTS.text_content;
  }

  // ── 6. Redirect Chain ─────────────────────────────────
  if (signals.redirect_count != null) {
    const s = _redirectScore(signals.redirect_count);
    breakdown.redirects = {
      score: s,
      weight: RISK_WEIGHTS.redirect_chain,
      label: _redirectLabel(signals.redirect_count),
      available: true,
    };
    weighted_sum += s * RISK_WEIGHTS.redirect_chain;
    weight_used += RISK_WEIGHTS.redirect_chain;
  }

  // ── 7. Brand Mismatch ─────────────────────────────────
  if (signals.brand_mismatch != null) {
    const s = signals.brand_mismatch ? 88 : 0;
    breakdown.brand_mismatch = {
      score: s,
      weight: RISK_WEIGHTS.brand_mismatch,
      label: signals.brand_mismatch ? "Brand/logo does not match domain" : "Brand matches domain",
      available: true,
    };
    weighted_sum += s * RISK_WEIGHTS.brand_mismatch;
    weight_used += RISK_WEIGHTS.brand_mismatch;
  }

  // ── 8. Hidden iFrames ─────────────────────────────────
  if (signals.hidden_iframe != null) {
    const s = signals.hidden_iframe ? 80 : 0;
    breakdown.hidden_iframe = {
      score: s,
      weight: RISK_WEIGHTS.hidden_iframe,
      label: signals.hidden_iframe ? "Hidden iFrame detected (possible clickjacking)" : "No hidden iFrames",
      available: true,
    };
    weighted_sum += s * RISK_WEIGHTS.hidden_iframe;
    weight_used += RISK_WEIGHTS.hidden_iframe;
  }

  // ── 9. JS Behavior ────────────────────────────────────
  if (signals.js_obfuscated != null) {
    const s = signals.js_obfuscated ? 75 : 0;
    breakdown.js_behavior = {
      score: s,
      weight: RISK_WEIGHTS.js_behavior,
      label: signals.js_obfuscated ? "Obfuscated JavaScript detected" : "JavaScript appears normal",
      available: true,
    };
    weighted_sum += s * RISK_WEIGHTS.js_behavior;
    weight_used += RISK_WEIGHTS.js_behavior;
  }

  // ── Composite Score ───────────────────────────────────
  // Normalize by actual weight used (handles missing features gracefully)
  const normalizer = weight_used > 0 ? (1 / weight_used) : 1;
  const score = Math.min(100, Math.round(weighted_sum * normalizer));

  // ── Verdict ───────────────────────────────────────────
  let verdict = VERDICT.SAFE;
  if (score >= THRESHOLD.DANGER * 100) verdict = VERDICT.DANGER;
  else if (score >= THRESHOLD.WARNING * 100) verdict = VERDICT.WARNING;

  // ── Top Contributing Factors ──────────────────────────
  const top_factors = Object.entries(breakdown)
    .filter(([, v]) => v.score >= 50)
    .sort(([, a], [, b]) => b.score * b.weight - a.score * a.weight)
    .slice(0, 5)
    .map(([key, v]) => ({ key, ...v }));

  return {
    score,
    verdict,
    breakdown,
    top_factors,
    threat_type: signals.threat_type || _inferThreatType(breakdown, score),
    computed_at: Date.now(),
  };
}

// ── Label Generators ──────────────────────────────────────
function _urlModelLabel(prob, category) {
  if (prob < 0.3) return "URL appears legitimate";
  if (category) return `AI detected ${category.replace(/_/g, " ")} patterns in URL`;
  if (prob >= 0.8) return "URL strongly matches phishing patterns";
  return "URL contains suspicious patterns";
}

function _domainAgeLabel(days) {
  if (days <= 7)  return `Domain registered only ${days} day${days === 1 ? "" : "s"} ago`;
  if (days <= 30) return `Domain is very new (${days} days old)`;
  if (days <= 90) return `Domain is recent (${days} days old)`;
  return `Domain established (${Math.round(days / 365)} year${days > 730 ? "s" : ""} old)`;
}

function _textModelLabel(prob, words) {
  if (prob < 0.3) return "Page content appears normal";
  const wordStr = words?.length > 0 ? `: "${words.slice(0, 3).join('", "')}"` : "";
  if (prob >= 0.8) return `Page uses high-urgency phishing language${wordStr}`;
  return `Page contains social engineering language${wordStr}`;
}

function _redirectLabel(count) {
  if (count === 0) return "No redirects detected";
  if (count === 1) return "Single redirect (possibly tracking)";
  if (count <= 3) return `${count} redirects in chain (suspicious)`;
  return `${count} redirects detected (obfuscated destination)`;
}

// ── Score Calculators ─────────────────────────────────────
function _domainAgeScore(days) {
  if (days <= 1)  return 98;
  if (days <= 7)  return 90;
  if (days <= 30) return 75;
  if (days <= 90) return 50;
  if (days <= 365) return 20;
  return 0;
}

function _redirectScore(count) {
  if (count === 0) return 0;
  if (count === 1) return 20;
  if (count === 2) return 50;
  if (count === 3) return 70;
  return 90;
}

function _inferThreatType(breakdown, score) {
  if (score < 50) return null;
  if (breakdown.login_form?.score >= 80) return "credential_harvesting";
  if (breakdown.brand_mismatch?.score >= 80) return "brand_impersonation";
  if (breakdown.hidden_iframe?.score >= 70) return "clickjacking";
  return "phishing";
}

function clamp(v) { return Math.min(100, Math.max(0, Math.round(v))); }
