/**
 * AegisOne — XAI (Explainable AI) Module
 * ========================================
 * ONLY called when user explicitly clicks "Explain with AI".
 * Never runs automatically — LLMs are expensive.
 *
 * Sends a compact evidence payload to the XAI service.
 * NOT the full webpage — just structured features.
 */

import { requestXAI } from "./scanner.js";
import { storeEvent } from "./event-store.js";
import { EVENT_TYPES } from "../utils/constants.js";
import { getCachedResult } from "./cache.js";

/**
 * Request AI explanation for a scan result.
 *
 * @param {object} tabData - from tab cache
 * @param {string} url
 * @returns {Promise<XAIResult>}
 */
export async function explainWithAI(tabData, url) {
  let scanData = tabData;
  if (url && url !== tabData?.url) {
    const cached = await getCachedResult(url);
    if (cached) {
      scanData = cached;
    }
  }

  if (!scanData) return { error: "No scan data available for this page." };

  // ── Build compact evidence payload ───────────────────
  // We deliberately do NOT send full HTML, all cookies, or full JS.
  const evidence = {
    url,
    domain: scanData.domain,
    risk_score: scanData.score,
    verdict: scanData.verdict,
    threat_type: scanData.threat_type,

    // Risk breakdown — structured features only
    features: scanData.breakdown
      ? Object.fromEntries(
          Object.entries(scanData.breakdown)
            .filter(([, v]) => v.available)
            .map(([k, v]) => [k, { score: v.score, label: v.label }])
        )
      : {},

    // Top risk factors
    top_factors: (scanData.top_factors || []).map(f => ({
      key: f.key,
      score: f.score,
      label: f.label,
    })),

    // Text summary (300 chars max)
    text_summary: scanData.text_snippet?.slice(0, 300) || null,

    // Form/login signals
    login_form_detected: scanData.breakdown?.login_form?.score >= 80 || false,
    suspicious_form_count: scanData.form_count || 0,

    // Technical signals
    redirect_chain: scanData.redirect_chain || [],
    hidden_iframes: scanData.hidden_iframes || [],
    external_scripts: (scanData.external_scripts || []).slice(0, 10),

    // Metadata
    timestamp: new Date().toISOString(),
    page_title: scanData.page_title || null,
  };

  // ── Call XAI service ─────────────────────────────────
  const result = await requestXAI(evidence);

  if (!result) {
    return {
      error: "XAI service unavailable. Make sure the backend is running.",
      evidence,
    };
  }

  // ── Store XAI session ─────────────────────────────────
  const xaiId = await storeEvent({
    type: EVENT_TYPES.XAI_SESSION,
    url,
    domain: evidence.domain,
    risk_score: evidence.risk_score,
    verdict: evidence.verdict,
    threat_type: evidence.threat_type,
    xai_summary: result.summary || null,
    action: "xai_requested",
  });

  return {
    ...result,
    evidence_sent: evidence,
    xai_id: xaiId,
  };
}

/**
 * Generate a fallback explanation from the risk breakdown
 * without calling the LLM (used when XAI service is offline).
 *
 * @param {object} tabData
 * @returns {object}
 */
export function generateLocalExplanation(tabData) {
  if (!tabData || !tabData.breakdown) return null;

  const factors = (tabData.top_factors || []).filter(f => f.score >= 50);

  const summary = factors.length > 0
    ? `This website was flagged because: ${factors.map(f => f.label.toLowerCase()).join("; ")}.`
    : "Risk score is based on URL analysis patterns.";

  const recommendations = [];
  if (tabData.breakdown?.login_form?.score >= 80) {
    recommendations.push("Do not enter any credentials on this page.");
  }
  if (tabData.breakdown?.brand_mismatch?.score >= 70) {
    recommendations.push("The page appears to imitate a known brand. Verify the URL carefully.");
  }
  if (tabData.score >= 80) {
    recommendations.push("Leave this page immediately.");
    recommendations.push("Report this website using the Report button.");
  }

  return {
    summary,
    main_reasons: factors.map(f => f.label),
    threat_likelihood: _threatLabel(tabData.threat_type),
    recommendations,
    generated_locally: true,
  };
}

function _threatLabel(type) {
  const map = {
    credential_harvesting: "Credential Harvesting",
    brand_impersonation:   "Brand Impersonation",
    malware_delivery:      "Malware Delivery",
    social_engineering:    "Social Engineering",
    clickjacking:          "Clickjacking",
    phishing:              "General Phishing",
  };
  return map[type] || "Suspicious Activity";
}
