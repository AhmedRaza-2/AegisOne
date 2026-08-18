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
export async function explainWithAI(tabData, url, explicitScore, explicitFactors = null, explicitThreatType = null) {
  let scanData = tabData || {};
  if (url && url !== tabData?.url) {
    const cached = await getCachedResult(url);
    if (cached) {
      scanData = cached;
    }
  }

  // ── Build compact evidence payload ───────────────────
  const finalScore = explicitScore !== undefined ? explicitScore : (scanData.score || 0);
  const factors = explicitFactors || scanData.top_factors || [];

  const evidence = {
    url: url || scanData.url,
    domain: scanData.domain || getRootDomain(url || ""),
    risk_score: finalScore,
    verdict: finalScore >= 80 ? "danger" : finalScore >= 50 ? "warning" : "safe",
    threat_type: explicitThreatType || scanData.threat_type || "phishing",

    // Risk breakdown — structured features only
    features: scanData.breakdown
      ? Object.fromEntries(
          Object.entries(scanData.breakdown)
            .filter(([, v]) => v.available)
            .map(([k, v]) => [k, { score: v.score, label: v.label }])
        )
      : {},

    // Top risk factors
    top_factors: factors.map(f => typeof f === 'string' ? { label: f } : { key: f.key, score: f.score, label: f.label || String(f) }),

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
export function generateLocalExplanation(tabData, explicitScore) {
  if (!tabData) return null;

  const score   = explicitScore !== undefined ? explicitScore : (tabData.score || 0);
  const factors = (tabData.top_factors || []).filter(f => f.score >= 30);

  // Plain-English summary based on score band
  let summary;
  if (score >= 80) {
    summary = `⚠️ This page looks like a phishing site. Our AI is ${score}% confident it's trying to steal your information. Don't enter any passwords or personal details here.`;
  } else if (score >= 50) {
    summary = `🔶 Something looks off about this page (${score}% risk). It's not confirmed dangerous, but be careful — especially if you're asked to log in.`;
  } else if (score >= 20) {
    summary = `🔍 This page has a few minor suspicious signals (${score}% risk). It's probably fine, but stay alert.`;
  } else {
    summary = `✅ This page looks safe. Our AI didn't find any phishing signs. Risk: ${score}%.`;
  }

  // Translate technical factor labels into plain English
  const friendlyLabel = (label = "") => {
    const l = label.toLowerCase();
    if (l.includes("login") || l.includes("credential"))
      return "🔑 This page has a login form — a common phishing trick";
    if (l.includes("iframe"))
      return "🪄 Hidden content detected — often used to fake trusted sites";
    if (l.includes("redirect"))
      return "↪️ This page tried to redirect you to another site";
    if (l.includes("brand") || l.includes("impersonat"))
      return "🎭 This page appears to be pretending to be a real, trusted brand";
    if (l.includes("phish"))
      return "🎣 Our AI detected phishing language on this page";
    if (l.includes("url") || l.includes("domain"))
      return "🌐 The web address has suspicious patterns";
    if (l.includes("script") || l.includes("js"))
      return "⚙️ Suspicious code was detected — this can be used to steal data";
    if (l.includes("malicious"))
      return "🚨 One or more links on this page lead to dangerous sites";
    return `⚠️ ${label}`;
  };

  const main_reasons = factors.length > 0
    ? factors.map(f => friendlyLabel(f.label))
    : score === 0
      ? ["✅ No phishing signals were found"]
      : ["🔍 Mild pattern match in URL or page structure"];

  // Simple, actionable advice
  const recommendations = [];
  if (score >= 80) {
    recommendations.push("🚫 Do NOT type your password or personal info here");
    recommendations.push("← Go back or close this tab to stay safe");
    recommendations.push("📢 Hit Report Threat below to help protect others");
  } else if (score >= 50) {
    recommendations.push("👀 Check the URL in your address bar is exactly right");
    recommendations.push("🔑 Don't enter passwords unless you're 100% sure it's legit");
  } else if (score >= 20) {
    recommendations.push("✔️ You can continue, but stay alert");
    recommendations.push("🔗 Avoid clicking links that seem out of place");
  } else {
    recommendations.push("✅ This page appears safe — carry on!");
  }

  return {
    summary,
    main_reasons,
    recommendations,
    generated_locally: true,
  };
}

function _threatLabel(type) {
  const map = {
    credential_harvesting: "Tries to steal your password",
    brand_impersonation:   "Pretending to be a real website",
    malware_delivery:      "May install harmful software",
    social_engineering:    "Tricks you into giving up information",
    clickjacking:          "Hidden buttons that hijack your clicks",
    phishing:              "Designed to steal your data",
  };
  return map[type] || "Suspicious Activity";
}

