/**
 * AegisOne — Content Script: Modals
 * ===================================
 * All modal dialogs:
 *  1. Warning Modal (risky page interstitial)
 *  2. XAI Explanation Modal (on-demand AI explanation)
 *  3. Full Page Report Modal (detailed scan results)
 *  4. Download Decision Modal (approve/block download)
 *  5. Right-Click Scan Result Modal
 */

import { MSG, THRESHOLD } from "../../utils/constants.js";
import { shortURL } from "../../utils/trusted-domains.js";

function safeSendMessage(msg) {
  if (typeof chrome === "undefined" || !chrome?.runtime?.id) {
    return Promise.resolve(null);
  }
  try {
    return chrome.runtime.sendMessage(msg).catch(() => null);
  } catch (_) {
    return Promise.resolve(null);
  }
}

export function showWarningModal({ score, verdict, threat_type, top_factors, url, onContinue }) {
  if (window.__AEGIS_WARNING_DISMISSED__) return;
  _removeModal("aegis-warning-overlay");

  const isOffline = score === -1 || verdict === "offline" || threat_type === "backend_offline";
  const isDanger = score >= 80 && !isOffline;
  const isWarn = score >= 50 && score < 80 && !isOffline;

  const scoreColor = isOffline ? "#ef4444" : isDanger ? "#ef4444" : isWarn ? "#f97316" : "#10b981";
  const icon = isOffline ? "🔴" : isDanger ? "🚨" : isWarn ? "⚠️" : "🛡️";
  const titleText = isOffline ? "Backend API Offline" : isDanger ? "High Phishing Risk" : isWarn ? "Suspicious Link Warning" : "Verified Safe Link";
  const scoreDisplay = isOffline ? "OFFLINE" : `${score}% Risk`;
  const threatLabel = isOffline ? "Backend Disconnected" : (_threatLabel(threat_type) || (isDanger ? "Phishing Threat" : isWarn ? "Suspicious Indicator" : "Clean Link"));

  const factorsList = isOffline ? [{ label: "⚠️ AegisOne Security API Server Disconnected — Contact Administrator" }] : (top_factors || []);
  const factorsHtml = factorsList.slice(0, 4).map(f => {
    const text = typeof f === "object" ? (f.label || f.key || JSON.stringify(f)) : String(f);
    return `<li style="margin-bottom:4px; color:#cbd5e1; font-size:10.5px; display:flex; align-items:center; gap:6px; line-height:1.35;"><span>${isOffline ? "⚠️" : isDanger ? "🚨" : isWarn ? "⚠️" : "✓"}</span><span>${text}</span></li>`;
  }).join("");

  const isBlocking = isDanger;

  _createModal("aegis-warning-overlay", `
    <div style="
      width:340px; max-width:92%;
      background:#0b0f19; border:1px solid ${scoreColor}55;
      border-radius:12px; overflow:hidden;
      box-shadow: 0 10px 36px rgba(0,0,0,0.85) !important;
      animation: aegisEntrance 0.25s cubic-bezier(0.16,1,0.3,1);
      font-family: 'Inter', -apple-system, BlinkMacSystemFont, sans-serif !important;
    ">
      <div style="padding:10px 14px; background:${scoreColor}14; border-bottom:1px solid ${scoreColor}28; display:flex; align-items:center; justify-content:space-between;">
        <span style="font-weight:800;font-size:10.5px;color:${scoreColor};text-transform:uppercase;letter-spacing:0.8px;">🛡️ AegisOne Security Scanner</span>
        <button id="aegis-warn-close" style="background:none;border:none;color:#64748b;font-size:16px;cursor:pointer;line-height:1;">✕</button>
      </div>
      <div style="padding:16px 18px; text-align:center;">
        <div style="width:44px;height:44px;margin:0 auto 10px;background:${scoreColor}14;border:1.5px solid ${scoreColor};border-radius:50%;display:flex;align-items:center;justify-content:center;font-size:20px;">${icon}</div>
        <h2 style="font-size:15px;font-weight:800;color:${scoreColor};margin:0 0 4px;line-height:1.2;">${scoreDisplay} — ${titleText}</h2>
        <p style="font-size:11px;color:#94a3b8;margin:0 0 4px;word-break:break-all;line-height:1.3;">${shortURL(url, 45)}</p>
        <p style="font-size:10px;color:#64748b;margin:0 0 12px;">Threat Classification: <strong style="color:${scoreColor};">${threatLabel}</strong></p>
        ${factorsHtml ? `
        <div style="text-align:left;background:rgba(255,255,255,0.025);border:1px solid rgba(255,255,255,0.07);border-radius:6px;padding:8px 12px;margin-bottom:12px;">
          <p style="font-size:8.5px;text-transform:uppercase;color:#64748b;font-weight:700;margin:0 0 6px;letter-spacing:0.4px;">Model Evidence & Status</p>
          <ul style="list-style:none;padding:0;margin:0;">${factorsHtml}</ul>
        </div>` : ""}
      </div>
      <div style="display:flex;gap:8px;padding:10px 14px;background:rgba(15,10,10,0.4);border-top:1px solid rgba(255,255,255,0.06); flex-wrap: wrap;">
        <button id="aegis-warn-explain" style="flex:1;min-width:45%;padding:7px 10px;background:linear-gradient(135deg,#3b82f6,#8b5cf6);color:#fff;border:none;border-radius:6px;font-size:11px;font-weight:700;cursor:pointer;font-family:inherit;" ${isOffline ? "disabled style='opacity:0.5;cursor:not-allowed;'" : ""}>✨ Explain AI</button>
        <button id="aegis-warn-leave" style="flex:1;min-width:45%;padding:7px 10px;background:#ef4444;color:#fff;border:none;border-radius:6px;font-size:11px;font-weight:700;cursor:pointer;font-family:inherit;">← Close Scan</button>
      </div>
    </div>
  `, isBlocking);

  document.getElementById("aegis-warn-close")?.addEventListener("click", () => {
    document.getElementById("aegis-warning-overlay")?.remove();
  });

  document.getElementById("aegis-warn-leave")?.addEventListener("click", () => {
    window.history.back();
    document.getElementById("aegis-warning-overlay")?.remove();
  });

  document.getElementById("aegis-warn-continue")?.addEventListener("click", async () => {
    window.__AEGIS_WARNING_DISMISSED__ = true;
    document.getElementById("aegis-warning-overlay")?.remove();
    await safeSendMessage({ type: "ALLOW_URL_SESSION", url });
    if (onContinue) onContinue();
  });

  document.getElementById("aegis-warn-falsepos")?.addEventListener("click", async () => {
    const btn = document.getElementById("aegis-warn-falsepos");
    if (btn) { btn.textContent = "✓ Reported!"; btn.disabled = true; }
    await safeSendMessage({
      type: "REPORT_FALSE_POSITIVE",
      url: window.location.href,
      score: score,
      note: "User reported False Positive"
    });
    
    // Auto-allow after reporting false positive
    setTimeout(async () => {
      window.__AEGIS_WARNING_DISMISSED__ = true;
      document.getElementById("aegis-warning-overlay")?.remove();
      await safeSendMessage({ type: "ALLOW_URL_SESSION", url });
      if (onContinue) onContinue();
    }, 600);
  });

  document.getElementById("aegis-warn-explain")?.addEventListener("click", async () => {
    const btn = document.getElementById("aegis-warn-explain");
    if (!btn) return;
    btn.textContent = "⏳ Loading...";
    btn.disabled = true;

    const res = await safeSendMessage({
      type: MSG.XAI_REQUEST,
      url,
      score: score,
    });

    document.getElementById("aegis-warning-overlay")?.remove();
    if (res?.xai) showXAIModal(res.xai, { score, url, threat_type });
  });
}

// ── 2. XAI Modal — floating panel, no fullscreen overlay ─
export function showXAIModal(xai, context = {}) {
  // Remove any existing instance
  document.getElementById("aegis-xai-overlay")?.remove();

  const { score, url } = context;
  const rawScore = score != null ? score : (xai.score || 0);
  const r = parseFloat(rawScore) || 0;
  const s = Math.round(r <= 1.0 && r > 0 && r !== 1 ? r * 100 : r);
  const scoreColor = s >= 80 ? "#ef4444" : s >= 50 ? "#f97316" : s >= 20 ? "#fbbf24" : "#10b981";
  const scoreLabel = s >= 80 ? "High Phishing Risk" : s >= 50 ? "Suspicious Activity" : s >= 20 ? "Low Risk" : "Safe";

  const isEmailTarget = context.targetType === "email" || context.threat_type?.includes("email") || (context.url && context.url.includes("Email"));
  const headerIcon = isEmailTarget ? "📧" : "🛡️";
  const headerTitle = isEmailTarget ? "Email Security Report" : "Security Report";

  // Normalize any score mismatch inside summary text
  let summaryText = xai.summary || "";
  if (summaryText) {
    // Replace any score references (e.g. 100%, 82%) in the text with the exact rounded score s
    summaryText = summaryText.replace(/composite risk score of \d+%/gi, `composite risk score of ${s}%`);
    summaryText = summaryText.replace(/score of \d+%/gi, `score of ${s}%`);
    
    // If the visual score is safe (< 20%), ensure the text doesn't claim it was flagged as phishing
    if (s < 20) {
      summaryText = `AegisOne security analysis completed for this target with a composite risk score of ${s}%. No malicious content, phishing indicators, or suspicious heuristics were detected.`;
    } else {
      summaryText = summaryText.replace(/completed for this target with a composite risk score of/gi, "flagged this target as high-risk phishing with a composite risk score of");
    }

    if (isEmailTarget) {
      summaryText = summaryText.replace(/flagged this website as potentially hazardous/gi, "flagged this email & attachment as potentially hazardous");
      summaryText = summaryText.replace(/flagged this website/gi, "flagged this email & attachment");
    }
  }

  const formatItem = (r) => {
    const rawText = typeof r === 'string' ? r : r.label || String(r);
    // Strip leading question marks or junk chars
    const cleanedText = rawText.replace(/^\?+/, '').trim();
    const hasInitialEmoji = /^[\u{1F300}-\u{1FFFF}\u{2600}-\u{27BF}]/u.test(cleanedText);
    const icon = hasInitialEmoji ? "" : (s < 20 ? "✅ " : "⚠️ ");
    return `<li style="margin-bottom:8px;color:#f8fafc;font-size:12px;display:flex;align-items:flex-start;gap:8px;line-height:1.55;text-align:left !important;direction:ltr !important;">
      <span style="flex-shrink:0;">${icon}</span>
      <span style="text-align:left !important;">${cleanedText}</span>
    </li>`;
  };

  const reasonsHtml = (xai.main_reasons || xai.top_factors || []).map(formatItem).join("");
  const recsHtml = (xai.recommendations || []).map(formatItem).join("");

  const aiLabel = xai.generated_locally
    ? `<span style="font-size:9px;font-weight:800;color:#94a3b8;background:rgba(255,255,255,0.08);padding:2px 8px;border-radius:6px;border:1px solid rgba(255,255,255,0.12);">Local Guard</span>`
    : `<span style="font-size:9px;font-weight:800;color:#38bdf8;background:rgba(56,189,248,0.15);padding:2px 8px;border-radius:6px;border:1px solid rgba(56,189,248,0.3);">✨ AI Model</span>`;

  _ensureModalStyles();
  _ensureCompactStyles();

  const panel = document.createElement("div");
  panel.id = "aegis-xai-overlay";
  panel.style.cssText = `
    position: fixed !important;
    bottom: 20px !important;
    right: 20px !important;
    z-index: 2147483647 !important;
    width: 360px !important;
    max-height: 84vh !important;
    display: flex !important;
    flex-direction: column !important;
    background: linear-gradient(165deg, #0b0f19 0%, #111827 60%, #1e1b4b 100%) !important;
    border: 1px solid rgba(99, 102, 241, 0.3) !important;
    border-radius: 18px !important;
    box-shadow: 0 24px 64px rgba(0,0,0,0.85), 0 0 0 1px rgba(255,255,255,0.08) inset !important;
    font-family: 'Inter', -apple-system, sans-serif !important;
    overflow: hidden !important;
    animation: aegisSlideIn 0.25s cubic-bezier(0.16,1,0.3,1) !important;
    backdrop-filter: blur(20px) !important;
    direction: ltr !important;
    text-align: left !important;
  `;

  panel.innerHTML = `
    <!-- Header (drag handle) -->
    <div id="aegis-xai-header" style="
      display:flex;align-items:center;justify-content:space-between;
      padding:14px 18px;
      background:rgba(17,24,39,0.95);
      border-bottom:1px solid rgba(255,255,255,0.08);
      cursor:move;flex-shrink:0;
      direction:ltr !important;text-align:left !important;
    ">
      <div style="display:flex;align-items:center;gap:8px;">
        <span style="font-size:16px;">${headerIcon}</span>
        <span style="font-weight:800;font-size:13px;color:#ffffff;letter-spacing:-0.2px;">${headerTitle}</span>
        ${aiLabel}
      </div>
      <button id="aegis-xai-close" style="
        background:rgba(255,255,255,0.08);border:1px solid rgba(255,255,255,0.12);color:#cbd5e1;font-size:13px;
        cursor:pointer;line-height:1;padding:5px 9px;border-radius:7px;
        transition:all 0.15s;margin-left:auto;
      ">✕</button>
    </div>

    <!-- Score row -->
    ${score != null ? `
    <div style="padding:14px 18px 0;flex-shrink:0;direction:ltr !important;">
      <div style="
        display:flex;align-items:center;gap:14px;
        padding:14px 16px;
        background:rgba(17,24,39,0.65);
        border-radius:12px;
        border:1px solid rgba(255,255,255,0.08);
      ">
        <div style="
          width:56px;height:56px;border-radius:50%;
          border:3px solid ${scoreColor};
          display:flex;flex-direction:column;align-items:center;justify-content:center;
          flex-shrink:0;background:rgba(0,0,0,0.5);
          box-shadow:0 0 16px ${scoreColor}50;
        ">
          <span style="font-size:16px;font-weight:900;color:${scoreColor};">${s}%</span>
          <span style="font-size:7px;color:#cbd5e1;font-weight:800;letter-spacing:0.5px;">RISK</span>
        </div>
        <div style="min-width:0;flex:1;text-align:left !important;">
          <div style="font-size:15px;font-weight:800;color:${scoreColor};margin-bottom:3px;text-align:left !important;">${scoreLabel}</div>
          ${url ? `<div style="font-size:10.5px;color:#cbd5e1;word-break:break-all;line-height:1.35;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;text-align:left !important;">${shortURL(url, 45)}</div>` : ""}
        </div>
      </div>
    </div>` : ""}

    <!-- Scrollable content -->
    <div style="padding:14px 18px;overflow-y:auto;flex:1;min-height:0;direction:ltr !important;text-align:left !important;">

      ${summaryText ? `
      <div style="margin-bottom:16px;text-align:left !important;">
        <div style="font-size:10px;font-weight:800;text-transform:uppercase;color:#38bdf8;letter-spacing:0.7px;margin-bottom:8px;text-align:left !important;display:flex;align-items:center;gap:5px;">
          <span>💬</span> <span>WHAT HAPPENED</span>
        </div>
        <div style="font-size:12px;color:#f8fafc;line-height:1.65;background:rgba(17,24,39,0.7);padding:12px 14px;border-radius:10px;border:1px solid rgba(255,255,255,0.08);text-align:left !important;">${summaryText}</div>
      </div>` : ""}

      ${reasonsHtml ? `
      <div style="margin-bottom:16px;text-align:left !important;">
        <div style="font-size:10px;font-weight:800;text-transform:uppercase;color:${s < 20 ? '#34d399' : '#a78bfa'};letter-spacing:0.7px;margin-bottom:8px;text-align:left !important;display:flex;align-items:center;gap:5px;">
          <span>${s < 20 ? '✅' : '🔎'}</span> <span>${s < 20 ? 'SECURITY ANALYSIS & CHECKS' : 'WHY FLAGGED'}</span>
        </div>
        <ul style="list-style:none;padding:12px 14px;margin:0;background:rgba(17,24,39,0.7);border-radius:10px;border:1px solid rgba(255,255,255,0.08);text-align:left !important;">${reasonsHtml}</ul>
      </div>` : ""}

      ${xai.scoring_methodology && xai.scoring_methodology.length > 0 ? `
      <div style="margin-bottom:16px;text-align:left !important;">
        <div style="font-size:10px;font-weight:800;text-transform:uppercase;color:#facc15;letter-spacing:0.7px;margin-bottom:8px;text-align:left !important;display:flex;align-items:center;gap:5px;">
          <span>⚙️</span> <span>HOW RISK IS CALCULATED</span>
        </div>
        <div style="font-size:11px;color:#cbd5e1;line-height:1.6;background:rgba(17,24,39,0.7);padding:12px 14px;border-radius:10px;border:1px solid rgba(255,255,255,0.08);text-align:left !important;">
          ${xai.scoring_methodology.map(m => `<div style="margin-bottom:6px;">${m}</div>`).join("")}
        </div>
      </div>` : ""}

      ${recsHtml ? `
      <div style="margin-bottom:6px;text-align:left !important;">
        <div style="font-size:10px;font-weight:800;text-transform:uppercase;color:#34d399;letter-spacing:0.7px;margin-bottom:8px;text-align:left !important;display:flex;align-items:center;gap:5px;">
          <span>✅</span> <span>WHAT TO DO</span>
        </div>
        <ul style="list-style:none;padding:12px 14px;margin:0;background:rgba(17,24,39,0.7);border-radius:10px;border:1px solid rgba(255,255,255,0.08);text-align:left !important;">${recsHtml}</ul>
      </div>` : ""}
    </div>

    <!-- Footer -->
    <div style="
      display:flex;justify-content:space-between;align-items:center;
      padding:12px 18px;
      border-top:1px solid rgba(255,255,255,0.08);
      background:rgba(11,15,25,0.9);
      flex-shrink:0;
      direction:ltr !important;
    ">
      <button id="aegis-xai-report" style="
        background:linear-gradient(135deg, #ef4444, #dc2626);color:#ffffff;
        border:none;box-shadow:0 4px 14px rgba(239,68,68,0.4);
        padding:7px 16px;border-radius:8px;
        font-size:11px;font-weight:800;cursor:pointer;font-family:inherit;
        transition:all 0.2s;
      ">📢 Report Threat</button>
      <span style="font-size:10.5px;font-weight:700;color:#cbd5e1;">AegisOne Copilot</span>
    </div>
  `;

  document.body.appendChild(panel);

  panel.querySelector("#aegis-xai-close")?.addEventListener("click", () => panel.remove());

  const _escClose = (e) => { if (e.key === "Escape") { panel.remove(); document.removeEventListener("keydown", _escClose); } };
  document.addEventListener("keydown", _escClose);

  panel.querySelector("#aegis-xai-report")?.addEventListener("click", async () => {
    await safeSendMessage({
      type: MSG.REPORT_THREAT,
      url: window.location.href,
      score: s,
    });
    const btn = panel.querySelector("#aegis-xai-report");
    if (btn) { btn.textContent = "✓ Reported!"; btn.disabled = true; btn.style.background = "#10b981"; }
  });

  _setupPanelDrag(panel, panel.querySelector("#aegis-xai-header"));
}

function _setupPanelDrag(panel, handle) {
  if (!handle) return;
  let dragging = false, ox = 0, oy = 0;
  handle.addEventListener("mousedown", (e) => {
    if (e.target.tagName === "BUTTON") return;
    dragging = true;
    const r = panel.getBoundingClientRect();
    ox = e.clientX - r.left;
    oy = e.clientY - r.top;
    panel.style.setProperty("right", "auto", "important");
    panel.style.setProperty("bottom", "auto", "important");
  });
  document.addEventListener("mousemove", (e) => {
    if (!dragging) return;
    panel.style.setProperty("left", `${e.clientX - ox}px`, "important");
    panel.style.setProperty("top",  `${e.clientY - oy}px`, "important");
  });
  document.addEventListener("mouseup", () => dragging = false);
}

// ── 3. Download Decision Modal ────────────────────────────
export function showDownloadModal({ downloadId, filename, risk_score, verdict, url, signals, file_type, heuristic_risk, vba_analysis }) {
  _removeModal("aegis-download-overlay");

  const score = risk_score || 0;
  const isHigh = score >= 80;
  const scoreColor = isHigh ? "#ef4444" : score >= 50 ? "#f97316" : "#f59e0b";
  const verdictLabel = isHigh ? "High Risk File Intercepted" : score >= 50 ? "Suspicious File Intercepted" : "Caution: Unknown Download";
  const displayName = _compactDownloadName(filename, url);
  const sourceUrl = shortURL(url, 65);

  const signalsHtml = (signals || []).slice(0, 4).map(s =>
    `<li style="font-size:11px;color:#cbd5e1;margin-bottom:5px;display:flex;align-items:flex-start;gap:6px;">
      <span style="color:${scoreColor};flex-shrink:0;">⚠</span>
      <span>${s}</span>
    </li>`
  ).join("");

  _createModal("aegis-download-overlay", `
    <div style="
      width:460px;max-width:92%;
      background:rgba(10, 14, 26, 0.98);
      border:1px solid rgba(239,68,68,0.35);
      border-radius:18px;overflow:hidden;
      box-shadow: 0 20px 60px rgba(0,0,0,0.85), 0 0 0 1px rgba(255,255,255,0.05) inset;
      backdrop-filter: blur(20px);
      animation:aegisEntrance 0.35s cubic-bezier(0.16,1,0.3,1);
      font-family: 'Inter', -apple-system, sans-serif;
    ">
      <!-- Header -->
      <div style="padding:14px 20px;background:rgba(239,68,68,0.12);border-bottom:1px solid rgba(239,68,68,0.2);display:flex;align-items:center;justify-content:space-between;">
        <div style="display:flex;align-items:center;gap:8px;">
          <span style="font-size:16px;">🛡️</span>
          <span style="font-weight:800;font-size:12px;color:#f87171;text-transform:uppercase;letter-spacing:1px;">AegisOne — Download Guard</span>
        </div>
        <span style="font-size:10px;font-weight:700;background:rgba(239,68,68,0.2);color:#f87171;padding:3px 8px;border-radius:12px;border:1px solid rgba(239,68,68,0.3);">INTERCEPTED</span>
      </div>

      <!-- Main Content -->
      <div style="padding:22px 24px;">
        <div style="display:flex;align-items:center;gap:16px;margin-bottom:16px;background:rgba(30,41,59,0.4);padding:14px 16px;border-radius:12px;border:1px solid rgba(255,255,255,0.06);">
          <div style="
            width:56px;height:56px;border-radius:50%;
            border:3px solid ${scoreColor};
            display:flex;flex-direction:column;align-items:center;justify-content:center;
            flex-shrink:0;background:rgba(0,0,0,0.4);
          ">
            <span style="font-size:16px;font-weight:900;color:${scoreColor};">${score}%</span>
            <span style="font-size:7px;color:#64748b;font-weight:700;letter-spacing:0.5px;">RISK</span>
          </div>
          <div style="min-width:0;flex:1;">
            <div style="font-size:15px;font-weight:800;color:${scoreColor};margin-bottom:3px;">${verdictLabel}</div>
            <div style="font-size:12px;font-weight:600;color:#f1f5f9;word-break:break-all;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;">${displayName || "Unknown File"}</div>
            <div style="font-size:10px;color:#64748b;margin-top:2px;">Source: ${sourceUrl || "Web download"}</div>
          </div>
        </div>

        <!-- Risk Bar -->
        <div style="margin-bottom:16px;">
          <div style="height:4px;background:#1e293b;border-radius:2px;overflow:hidden;">
            <div style="height:100%;width:${Math.min(score,100)}%;background:${scoreColor};border-radius:2px;transition:width 0.6s ease;"></div>
          </div>
        </div>

        ${signalsHtml ? `
        <div style="text-align:left;background:rgba(239,68,68,0.05);border:1px solid rgba(239,68,68,0.14);border-radius:10px;padding:12px 14px;margin-bottom:16px;">
          <div style="font-size:9px;font-weight:800;text-transform:uppercase;color:#94a3b8;letter-spacing:0.5px;margin-bottom:8px;">Threat Analysis Signals</div>
          <ul style="list-style:none;padding:0;margin:0;">${signalsHtml}</ul>
        </div>` : ""}
      </div>

      <!-- Action Footer -->
      <div style="display:flex;flex-direction:column;gap:8px;padding:14px 20px;background:rgba(10,15,30,0.6);border-top:1px solid rgba(255,255,255,0.06);">
        <div style="display:flex;gap:10px;">
          <button id="aegis-dl-block" style="flex:1.4;padding:11px;background:#ef4444;color:#fff;border:none;border-radius:9px;font-size:12px;font-weight:800;cursor:pointer;font-family:inherit;box-shadow:0 4px 14px rgba(239,68,68,0.3);transition:all 0.2s;">🛡️ Cancel Download (Recommended)</button>
          <button id="aegis-dl-allow" style="flex:1;padding:11px;background:transparent;color:#64748b;border:1px solid rgba(255,255,255,0.1);border-radius:9px;font-size:11px;font-weight:600;cursor:pointer;font-family:inherit;transition:all 0.2s;">Download Anyway</button>
        </div>
        <button id="aegis-dl-explain" style="width:100%;padding:9px;background:linear-gradient(135deg,rgba(59,130,246,0.15),rgba(139,92,246,0.15));border:1px solid rgba(99,102,241,0.35);border-radius:9px;color:#a5b4fc;font-size:11px;font-weight:700;cursor:pointer;font-family:inherit;transition:all 0.2s;">✨ Explain File Risk with AI</button>
      </div>
    </div>
  `);

  document.getElementById("aegis-dl-block")?.addEventListener("click", () => {
    safeSendMessage({ type: MSG.DOWNLOAD_DECISION, downloadId, action: "block" });
    document.getElementById("aegis-download-overlay")?.remove();
  });

  document.getElementById("aegis-dl-allow")?.addEventListener("click", () => {
    safeSendMessage({ type: MSG.DOWNLOAD_DECISION, downloadId, action: "allow" });
    document.getElementById("aegis-download-overlay")?.remove();
  });

  document.getElementById("aegis-dl-explain")?.addEventListener("click", async () => {
    const btn = document.getElementById("aegis-dl-explain");
    if (!btn) return;
    btn.textContent = "⏳ Analyzing with AI...";
    btn.disabled = true;

    const res = await safeSendMessage({
      type: MSG.XAI_REQUEST,
      url,
      score: score,
      threat_type: "malicious_download"
    });

    if (res?.xai) {
      showXAIModal(res.xai, { score, url, threat_type: "malicious_download" });
    }
  });
}

// ── 4. Right-Click / Image / Text Scan Result (compact inline popup) ────
// Shows a small, compact popup near the bottom-right — NOT a fullscreen overlay.
export function showRightClickResult({ url, result, isImage }) {
  _showCompactResult({
    title: `🛡️ AegisOne ${isImage ? "Image" : "Link"} Scan`,
    subtitle: shortURL(url, 60),
    score: result?.score ?? 0,
    factors: (result?.top_factors || []).slice(0, 3),
    id: "aegis-rightclick-popup",
    contextUrl: url,
  });
}

// ── 5. Text Scan Result (compact inline popup) ───────────────────────────
export function showTextScanResult({ text, result }) {
  const preview = text ? `"${text.slice(0, 55)}${text.length > 55 ? '…' : ''}"` : "Selected text";
  _showCompactResult({
    title: "🛡️ AegisOne Text Scan",
    subtitle: preview,
    score: result?.score ?? 0,
    factors: (result?.top_factors || []).slice(0, 3),
    id: "aegis-text-scan-popup",
    contextUrl: window.location.href,
  });
}

// ── Internal: compact popup (small, bottom-right, not fullscreen) ─────────
function _showCompactResult({ title, subtitle, score, factors, id, contextUrl }) {
  // Remove any existing instance
  document.getElementById(id)?.remove();

  const scoreColor = score >= 80 ? "#ef4444" : score >= 50 ? "#f97316" : score >= 20 ? "#f59e0b" : "#10b981";
  const verdictText = score >= 80 ? "🚨 High Risk" : score >= 50 ? "⚠️ Suspicious" : score >= 20 ? "🔶 Low Risk" : "✅ Safe";
  const factorsHtml = factors.map(f => `<div style="font-size:10px;color:#64748b;margin-top:3px;">→ ${f.label}</div>`).join("");

  // Show XAI button whenever risk is suspicious or higher
  const showXaiBtn = score >= 20;

  const popup = document.createElement("div");
  popup.id = id;
  popup.style.cssText = `
    position: fixed !important;
    bottom: 80px !important;
    right: 20px !important;
    z-index: 2147483647 !important;
    width: 280px !important;
    background: rgba(13, 17, 23, 0.97) !important;
    border: 1px solid rgba(255,255,255,0.1) !important;
    border-left: 3px solid ${scoreColor} !important;
    border-radius: 10px !important;
    box-shadow: 0 8px 32px rgba(0,0,0,0.7) !important;
    font-family: 'Inter', -apple-system, sans-serif !important;
    animation: aegisSlideIn 0.22s cubic-bezier(0.16,1,0.3,1) !important;
    overflow: hidden !important;
  `;

  popup.innerHTML = `
    <div style="display:flex;align-items:center;justify-content:space-between;padding:10px 12px;background:rgba(30,41,59,0.5);border-bottom:1px solid rgba(255,255,255,0.06);">
      <span style="font-size:11px;font-weight:700;color:#e2e8f0;">${title}</span>
      <button id="${id}-close" style="background:none;border:none;color:#64748b;font-size:15px;cursor:pointer;padding:0;line-height:1;">✕</button>
    </div>
    <div style="padding:12px 14px;">
      <div style="font-size:9px;color:#475569;word-break:break-all;margin-bottom:8px;line-height:1.4;">${subtitle}</div>
      <div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:8px;">
        <span style="font-size:12px;font-weight:800;color:${scoreColor};">${verdictText}</span>
        <span style="font-size:16px;font-weight:900;color:${scoreColor};">${score}%</span>
      </div>
      <div style="height:2px;background:#1e293b;border-radius:2px;margin-bottom:8px;">
        <div style="height:100%;width:${Math.min(score,100)}%;background:${scoreColor};border-radius:2px;"></div>
      </div>
      ${factorsHtml}
      ${showXaiBtn ? `
      <button id="${id}-xai" style="
        display:flex;align-items:center;gap:5px;justify-content:center;
        width:100%;margin-top:10px;padding:7px 0;
        background:linear-gradient(135deg,rgba(59,130,246,0.15),rgba(139,92,246,0.15));
        border:1px solid rgba(99,102,241,0.35);
        border-radius:7px;color:#a5b4fc;
        font-size:11px;font-weight:700;cursor:pointer;
        font-family:inherit;transition:all 0.2s;
      ">✨ Why is this phishing?</button>` : ""}
    </div>
  `;

  _ensureCompactStyles();
  document.body.appendChild(popup);

  popup.querySelector(`#${id}-close`)?.addEventListener("click", () => popup.remove());

  // ── XAI button handler ──────────────────────────────────────────────────
  const xaiBtn = popup.querySelector(`#${id}-xai`);
  if (xaiBtn) {
    xaiBtn.addEventListener("click", async () => {
      xaiBtn.textContent = "⏳ Asking AI...";
      xaiBtn.disabled = true;
      xaiBtn.style.opacity = "0.6";

      try {
        // Fire the existing XAI_REQUEST — sw.js handles it via explainWithAI / generateLocalExplanation
        const res = await safeSendMessage({
          type: "XAI_REQUEST",
          url: contextUrl || window.location.href,
          score: score,
        });

        popup.remove();

        if (res?.xai) {
          // Open the existing full XAI modal (already built in the codebase)
          showXAIModal(res.xai, {
            score,
            url: contextUrl || window.location.href,
            threat_type: "phishing",
          });
        } else {
          // Fallback: construct a local summary from the detected factors
          showXAIModal({
            summary: `AegisOne's AI flagged this content as phishing with ${score}% confidence. Suspicious patterns were detected that match known phishing techniques.`,
            main_reasons: factors.length > 0
              ? factors.map(f => f.label)
              : [`${score}% phishing risk detected by NLP model`],
            recommendations: [
              "Do not enter personal or financial information on this page.",
              "Verify the sender/source through a trusted channel.",
              "Report to your IT team if on a corporate network.",
            ],
            generated_locally: true,
          }, {
            score,
            url: contextUrl || window.location.href,
            threat_type: "phishing",
          });
        }
      } catch (_) {
        xaiBtn.textContent = "✨ Why is this phishing?";
        xaiBtn.disabled = false;
        xaiBtn.style.opacity = "1";
      }
    });

    // Hover glow effect
    xaiBtn.addEventListener("mouseenter", () => {
      if (!xaiBtn.disabled) {
        xaiBtn.style.background = "linear-gradient(135deg,rgba(59,130,246,0.28),rgba(139,92,246,0.28))";
        xaiBtn.style.borderColor = "rgba(99,102,241,0.65)";
        xaiBtn.style.color = "#c7d2fe";
      }
    });
    xaiBtn.addEventListener("mouseleave", () => {
      if (!xaiBtn.disabled) {
        xaiBtn.style.background = "linear-gradient(135deg,rgba(59,130,246,0.15),rgba(139,92,246,0.15))";
        xaiBtn.style.borderColor = "rgba(99,102,241,0.35)";
        xaiBtn.style.color = "#a5b4fc";
      }
    });
  }

  // Auto-dismiss: safe results in 8s, suspicious/risky in 15s (user should see the XAI button)
  setTimeout(() => popup?.parentNode && popup.remove(), showXaiBtn ? 15000 : 8000);
}


// ── Internal helpers ──────────────────────────────────────
function _createModal(id, contentHtml, isBlocking = true) {
  _ensureModalStyles();
  const overlay = document.createElement("div");
  overlay.id = id;
  if (isBlocking) {
    overlay.style.cssText = `
      position: fixed !important; inset: 0 !important; z-index: 2147483647 !important;
      background: rgba(10,15,30,0.75) !important; backdrop-filter: blur(12px) !important;
      display: flex !important; align-items: center !important; justify-content: center !important;
      font-family: 'Inter', -apple-system, sans-serif !important;
    `;
  } else {
    overlay.style.cssText = `
      position: fixed !important; bottom: 24px !important; left: 24px !important; z-index: 2147483647 !important;
      display: flex !important; align-items: center !important; justify-content: center !important;
      font-family: 'Inter', -apple-system, sans-serif !important;
      pointer-events: auto !important;
    `;
  }
  overlay.innerHTML = contentHtml;
  document.body.appendChild(overlay);

  if (isBlocking) {
    // Click outside to close
    overlay.addEventListener("click", (e) => {
      if (e.target === overlay) overlay.remove();
    });
  }
}

function _removeModal(id) {
  document.getElementById(id)?.remove();
}

function _compactDownloadName(filename, url) {
  const value = (filename || "").trim();
  if (value && !/^https?:\/\//i.test(value) && !/^file:|^blob:|^data:/i.test(value)) {
    return value.replace(/[\r\n]+/g, " ");
  }

  try {
    const parsed = new URL(url);
    const parts = parsed.pathname.split("/").filter(Boolean);
    const leaf = parts[parts.length - 1] || parsed.hostname;
    return decodeURIComponent(leaf).replace(/[\r\n]+/g, " ");
  } catch {
    return shortURL(url, 72);
  }
}

let _modalStylesReady = false;
function _ensureModalStyles() {
  if (_modalStylesReady) return;
  _modalStylesReady = true;
  const style = document.createElement("style");
  style.textContent = `
    @keyframes aegisEntrance {
      from { opacity: 0; transform: scale(0.95) translateY(12px); }
      to   { opacity: 1; transform: scale(1) translateY(0); }
    }
    @keyframes aegisPulseRing {
      0%   { box-shadow: 0 0 0 0 rgba(239,68,68,0.45); }
      70%  { box-shadow: 0 0 0 12px rgba(239,68,68,0); }
      100% { box-shadow: 0 0 0 0 rgba(239,68,68,0); }
    }
  `;
  document.head.appendChild(style);
}

let _compactStylesReady = false;
function _ensureCompactStyles() {
  if (_compactStylesReady) return;
  _compactStylesReady = true;
  const style = document.createElement("style");
  style.textContent = `
    @keyframes aegisSlideIn {
      from { opacity: 0; transform: translateX(20px) translateY(8px); }
      to   { opacity: 1; transform: translateX(0) translateY(0); }
    }
    #aegis-xai-overlay, #aegis-xai-overlay * {
      direction: ltr !important;
      text-align: left !important;
      unicode-bidi: isolate !important;
    }
    #aegis-xai-overlay ::-webkit-scrollbar {
      width: 5px !important;
      height: 5px !important;
    }
    #aegis-xai-overlay ::-webkit-scrollbar-track {
      background: rgba(15, 23, 42, 0.6) !important;
      border-radius: 4px !important;
    }
    #aegis-xai-overlay ::-webkit-scrollbar-thumb {
      background: rgba(255, 255, 255, 0.25) !important;
      border-radius: 4px !important;
    }
    #aegis-xai-overlay ::-webkit-scrollbar-thumb:hover {
      background: rgba(255, 255, 255, 0.4) !important;
    }
    #aegis-xai-overlay {
      scrollbar-width: thin !important;
      scrollbar-color: rgba(255, 255, 255, 0.25) rgba(15, 23, 42, 0.6) !important;
    }
  `;
  document.head.appendChild(style);
}

function _threatLabel(type) {
  const map = {
    credential_harvesting: "Credential Harvesting",
    brand_impersonation:   "Brand Impersonation",
    malware_delivery:      "Malware Delivery",
    social_engineering:    "Social Engineering",
    clickjacking:          "Clickjacking",
    phishing:              "Phishing",
  };
  return map[type] || type?.replace(/_/g, " ") || "Suspicious Activity";
}
