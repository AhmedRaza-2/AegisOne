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

    // Target & Context signals
    scan_type: scanData.scan_type || scanData.file_type || (url?.match(/\.(png|jpg|jpeg|gif|webp|svg)/i) ? "image" : "page"),
    file_type: scanData.file_type || null,
    is_image: scanData.scan_type === "image" || !!url?.match(/\.(png|jpg|jpeg|gif|webp|svg)/i),

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
  if (!tabData && explicitScore === undefined) return null;

  const score     = explicitScore !== undefined ? explicitScore : (tabData?.score || 0);
  const threatType = tabData?.threat_type || "";
  const isDownload = threatType === "malicious_download" || threatType === "download" || (tabData?.url && tabData.url.includes("attachment"));

  if (isDownload) {
    let summary;
    if (score >= 70) {
      summary = `🚨 Malicious File Intercepted! AegisOne's AI flagged this download (${score}% risk). It may contain executable malware, macros, or dangerous scripts.`;
    } else if (score >= 40) {
      summary = `⚠️ Caution: Unknown or Suspicious File Download (${score}% risk). Verify file source before opening.`;
    } else {
      summary = `✅ Clean File: AegisOne's AI evaluated this download (${score}% risk) and found no malicious macros or executable code.`;
    }

    const main_reasons = (tabData?.top_factors || []).length > 0
      ? tabData.top_factors.map(f => `📁 ${f.label || f.key || f}`)
      : score >= 40
        ? ["⚠️ File extension or download location has elevated risk factors", "📁 Download source is an unverified attachment server"]
        : ["✅ File extension is clean", "✅ No suspicious macros or scripts found"];

    const recommendations = score >= 40
      ? [
          "🚫 Do NOT open or execute this file unless you trust the sender",
          "🔍 Run a local antivirus scan on downloaded attachments",
          "🛡️ Click Cancel Download to safely block the file",
        ]
      : ["✅ This file appears safe to download."];

    return { summary, main_reasons, recommendations, generated_locally: true };
  }

  const factors = (tabData?.top_factors || []).filter(f => f.score >= 30 || f.score == null);

  const friendlyLabel = (label = "") => {
    const l = String(label).toLowerCase();
    if (l.includes("login") || l.includes("credential"))
      return "🔑 This page has a login form — a common phishing trick";
    if (l.includes("iframe"))
      return "🪄 Hidden content detected — often used to fake trusted sites";
    if (l.includes("redirect"))
      return "↪️ This page tried to redirect you to another site";
    if (l.includes("brand") || l.includes("impersonat"))
      return "🎭 This page appears to be pretending to be a real, trusted brand";
    if (l.includes("phish") || l.includes("keyword") || l.includes("email"))
      return "🎣 Our AI detected phishing patterns or solicitation keywords on this page";
    if (l.includes("url") || l.includes("domain"))
      return "🌐 The web address has suspicious patterns";
    if (l.includes("script") || l.includes("js"))
      return "⚙️ Suspicious code was detected — this can be used to steal data";
    if (l.includes("malicious"))
      return "🚨 One or more links on this page lead to dangerous sites";
    return `⚠️ ${label}`;
  };

  let summary;
  let main_reasons = [];
  let recommendations = [];

  if (score >= 80) {
    summary = `🚨 Phishing Threat Identified! AegisOne's neural AI detected high-confidence phishing patterns (${score}% risk).`;
    main_reasons = factors.length > 0
      ? factors.map(f => friendlyLabel(f.label || f.key || f))
      : [
          "🚨 Neural network model identified high-risk phishing solicitation patterns",
          "⚠️ Suspicious text, brand mismatch, or unverified sender detected",
          "🔑 Elevated risk of password or credential theft"
        ];
    recommendations = [
      "🚫 Do NOT type your password, credentials, or personal info here",
      "← Close this page or return to safety immediately",
      "📢 Hit Report Threat below to help protect others"
    ];
  } else if (score >= 50) {
    summary = `🔶 Something looks off about this page (${score}% risk). It's not confirmed dangerous, but exercise caution.`;
    main_reasons = factors.length > 0
      ? factors.map(f => friendlyLabel(f.label || f.key || f))
      : [
          "⚠️ Suspicious heuristics or solicitation text detected by Aegis AI",
          "🌐 Unverified domain or non-standard page structure"
        ];
    recommendations = [
      "👀 Check the URL in your address bar is exactly right",
      "🔑 Don't enter passwords unless you're 100% sure it's legit"
    ];
  } else if (score >= 20) {
    summary = `🔍 This page has minor suspicious signals (${score}% risk). It's probably fine, but stay alert.`;
    main_reasons = factors.length > 0
      ? factors.map(f => friendlyLabel(f.label || f.key || f))
      : ["🔍 Mild pattern match in URL or page structure"];
    recommendations = [
      "✔️ You can continue, but stay alert",
      "🔗 Avoid clicking links that seem out of place"
    ];
  } else {
    summary = `✅ This page looks safe. Our AI didn't find any phishing signs. Risk: ${score}%.`;
    main_reasons = ["✅ All structural, domain, and AI heuristic checks passed cleanly"];
    recommendations = [
      "✅ Target appears safe — carry on!",
      "🔗 Always verify links and senders before providing sensitive credentials"
    ];
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

