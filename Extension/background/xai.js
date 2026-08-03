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
export async function explainWithAI(tabData, url, explicitScore) {
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
  const finalScore = explicitScore !== undefined ? explicitScore : scanData.score;
  const evidence = {
    url,
    domain: scanData.domain,
    risk_score: finalScore,
    verdict: finalScore >= 80 ? "danger" : finalScore >= 50 ? "warning" : "safe",
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
export function generateLocalExplanation(tabData, explicitScore) {
  if (!tabData) return null;

  const score   = explicitScore !== undefined ? explicitScore : (tabData.score || 0);
  const factors = (tabData.top_factors || []).filter(f => f.score >= 30);

  // Plain-English summary based on score band
  let summary;
  if (score >= 80) {
    summary = `🚨 Critical Security Alert: AegisOne has analyzed this page and detected a severe phishing threat with ${score}% confidence. This site is actively attempting to deceive you into revealing sensitive information, such as passwords or financial details. Do not interact with any elements on this page.`;
  } else if (score >= 50) {
    summary = `⚠️ Security Warning: This page exhibits multiple suspicious characteristics (Risk Score: ${score}%). While not definitively malicious, it strongly resembles known deceptive sites. Exercise extreme caution and verify the source before proceeding.`;
  } else if (score >= 20) {
    summary = `🔶 Notice: Our AI engines have flagged some unusual patterns on this page (Risk Score: ${score}%). It is likely safe, but you should remain alert for any unexpected requests for information.`;
  } else {
    summary = `✅ AegisOne Security Check: This page has been analyzed and appears completely safe. No phishing signatures, malicious scripts, or deceptive patterns were detected. Risk: ${score}%.`;
  }

  // Translate technical factor labels into plain English
  const friendlyLabel = (label = "") => {
    const l = label.toLowerCase();
    if (l.includes("login") || l.includes("credential"))
      return "🔑 Credential Theft Risk: A suspicious login form is attempting to capture your passwords.";
    if (l.includes("iframe"))
      return "🪄 Clickjacking Risk: Invisible elements are layered over the page to trick your clicks.";
    if (l.includes("redirect"))
      return "↪️ Evasive Behavior: The site performed unauthorized redirects to mask its true destination.";
    if (l.includes("brand") || l.includes("impersonat"))
      return "🎭 Brand Impersonation: This site is spoofing a trusted organization to gain your trust.";
    if (l.includes("phish"))
      return "🎣 Semantic Threat: Our NLP model detected language commonly used in social engineering.";
    if (l.includes("url") || l.includes("domain"))
      return "🌐 Domain Anomaly: The web address contains deceptive characters or mismatches the brand.";
    if (l.includes("script") || l.includes("js"))
      return "⚙️ Malicious Code: Suspicious JavaScript was detected that could compromise your browser.";
    if (l.includes("malicious"))
      return "🚨 Toxic Links: This page contains outbound links to known malware or phishing domains.";
    return `⚠️ ${label}`;
  };

  const main_reasons = factors.length > 0
    ? [...new Set(factors.map(f => friendlyLabel(f.label)))]
    : score === 0
      ? ["✅ Full DOM and URL analysis passed successfully without any red flags."]
      : ["🔍 Heuristic analysis flagged structural anomalies in the page layout or URL."];

  // Simple, actionable advice
  const recommendations = [];
  if (score >= 80) {
    recommendations.push("🚫 CRITICAL: Do NOT enter any credentials, personal data, or payment info.");
    recommendations.push("🚪 Immediately close this tab or navigate away to prevent data exfiltration.");
    recommendations.push("📢 Use the 'Report Threat' button to notify your Security Operations Center (SOC).");
  } else if (score >= 50) {
    recommendations.push("👀 Carefully inspect the URL to ensure it exactly matches the official website.");
    recommendations.push("🔑 Refrain from logging in or downloading files unless you independently verify the sender.");
  } else if (score >= 20) {
    recommendations.push("✔️ You may proceed, but remain vigilant for deceptive prompts.");
    recommendations.push("🔗 Avoid clicking aggressively styled pop-ups or unexpected download links.");
  } else {
    recommendations.push("✅ No action required. You may browse this page safely.");
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

