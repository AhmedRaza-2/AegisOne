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

import { MSG } from "../../utils/constants.js";
import { shortURL } from "../../utils/trusted-domains.js";

// ── 1. Warning Modal ─────────────────────────────────────
export function showWarningModal({ score, verdict, threat_type, top_factors, url }) {
  if (window.__AEGIS_WARNING_DISMISSED__) return;
  _removeModal("aegis-warning-overlay");

  const scoreColor = score >= 80 ? "#ef4444" : "#f97316";
  const threatLabel = _threatLabel(threat_type);
  const factorsHtml = (top_factors || []).slice(0, 4).map(f =>
    `<li style="margin-bottom:5px; color:#94a3b8; font-size:11px;">⚠ ${f.label}</li>`
  ).join("");

  _createModal("aegis-warning-overlay", `
    <div style="
      width:460px; max-width:92%;
      background:#0f0a0a; border:1px solid rgba(239,68,68,0.35);
      border-radius:16px; overflow:hidden;
      animation: aegisEntrance 0.35s cubic-bezier(0.16,1,0.3,1);
    ">
      <div style="padding:14px 20px; background:rgba(239,68,68,0.12); border-bottom:1px solid rgba(239,68,68,0.2); display:flex; align-items:center; justify-content:space-between;">
        <span style="font-weight:800;font-size:12px;color:#f87171;text-transform:uppercase;letter-spacing:1px;">🛡️ AegisOne — Security Alert</span>
        <button id="aegis-warn-close" style="background:none;border:none;color:#64748b;font-size:18px;cursor:pointer;">✕</button>
      </div>
      <div style="padding:24px 28px; text-align:center;">
        <div style="width:64px;height:64px;margin:0 auto 16px;background:rgba(239,68,68,0.1);border:2px solid #ef4444;border-radius:50%;display:flex;align-items:center;justify-content:center;font-size:28px;animation:aegisPulseRing 2s infinite;">🚨</div>
        <h2 style="font-size:20px;font-weight:800;color:${scoreColor};margin:0 0 8px;">${score}% Phishing Risk</h2>
        <p style="font-size:13px;color:#94a3b8;margin:0 0 6px;">${shortURL(url, 55)}</p>
        <p style="font-size:11px;color:#64748b;margin:0 0 20px;">Threat Type: <strong style="color:#f87171;">${threatLabel}</strong></p>
        ${factorsHtml ? `
        <div style="text-align:left;background:rgba(239,68,68,0.05);border:1px solid rgba(239,68,68,0.12);border-radius:8px;padding:12px 16px;margin-bottom:20px;">
          <p style="font-size:9px;text-transform:uppercase;color:#64748b;font-weight:700;margin:0 0 8px;letter-spacing:0.5px;">Risk Factors Detected</p>
          <ul style="list-style:none;padding:0;margin:0;">${factorsHtml}</ul>
        </div>` : ""}
      </div>
      <div style="display:flex;gap:10px;padding:14px 20px;background:rgba(15,10,10,0.5);border-top:1px solid rgba(239,68,68,0.12);">
        <button id="aegis-warn-explain" style="flex:1;padding:10px;background:linear-gradient(135deg,#3b82f6,#8b5cf6);color:#fff;border:none;border-radius:8px;font-size:12px;font-weight:700;cursor:pointer;font-family:inherit;">✨ Explain with AI</button>
        <button id="aegis-warn-leave" style="flex:1;padding:10px;background:#ef4444;color:#fff;border:none;border-radius:8px;font-size:12px;font-weight:700;cursor:pointer;font-family:inherit;">← Leave Page</button>
        <button id="aegis-warn-continue" style="flex:1;padding:10px;background:transparent;color:#64748b;border:1px solid rgba(255,255,255,0.08);border-radius:8px;font-size:11px;font-weight:600;cursor:pointer;font-family:inherit;">Proceed at Risk</button>
      </div>
    </div>
  `);

  document.getElementById("aegis-warn-close")?.addEventListener("click", () => {
    document.getElementById("aegis-warning-overlay")?.remove();
  });

  document.getElementById("aegis-warn-leave")?.addEventListener("click", () => {
    window.history.back();
    document.getElementById("aegis-warning-overlay")?.remove();
  });

  document.getElementById("aegis-warn-continue")?.addEventListener("click", () => {
    window.__AEGIS_WARNING_DISMISSED__ = true;
    document.getElementById("aegis-warning-overlay")?.remove();
  });

  document.getElementById("aegis-warn-explain")?.addEventListener("click", async () => {
    const btn = document.getElementById("aegis-warn-explain");
    if (!btn) return;
    btn.textContent = "⏳ Loading...";
    btn.disabled = true;

    const res = await chrome.runtime.sendMessage({
      type: MSG.XAI_REQUEST,
      url: window.location.href,
    }).catch(() => null);

    document.getElementById("aegis-warning-overlay")?.remove();
    if (res?.xai) showXAIModal(res.xai, { score, url, threat_type });
  });
}

// ── 2. XAI Modal ─────────────────────────────────────────
export function showXAIModal(xai, context = {}) {
  _removeModal("aegis-xai-overlay");

  const { score, url, threat_type } = context;
  const scoreColor = (score || 0) >= 80 ? "#ef4444" : (score || 0) >= 50 ? "#f97316" : "#f59e0b";
  const reasonsHtml = (xai.main_reasons || xai.top_factors || []).map(r =>
    `<li style="margin-bottom:6px;color:#cbd5e1;font-size:12px;display:flex;align-items:flex-start;gap:8px;"><span style="color:#10b981;margin-top:1px;">✓</span><span>${r}</span></li>`
  ).join("");

  const mitreHtml = (xai.mitre_mapping || []).map(m =>
    `<span style="display:inline-block;font-size:10px;color:#f87171;background:rgba(239,68,68,0.08);border:1px solid rgba(239,68,68,0.2);padding:4px 8px;border-radius:4px;">${m}</span>`
  ).join("");

  const recsHtml = (xai.recommendations || []).map(r =>
    `<li style="margin-bottom:5px;color:#94a3b8;font-size:11px;">→ ${r}</li>`
  ).join("");

  const generated = xai.generated_locally
    ? '<span style="font-size:9px;color:#475569;background:rgba(255,255,255,0.04);padding:2px 6px;border-radius:4px;">Local Analysis</span>'
    : '<span style="font-size:9px;color:#3b82f6;background:rgba(59,130,246,0.08);padding:2px 6px;border-radius:4px;border:1px solid rgba(59,130,246,0.15);">AI Powered</span>';

  _createModal("aegis-xai-overlay", `
    <div style="
      width:520px;max-width:94%;
      background:rgba(15,23,42,0.97);border:1px solid rgba(255,255,255,0.1);
      border-radius:16px;overflow:hidden;
      box-shadow:0 24px 64px rgba(0,0,0,0.8);
      animation:aegisEntrance 0.3s cubic-bezier(0.16,1,0.3,1);
    ">
      <div style="display:flex;align-items:center;justify-content:space-between;padding:16px 20px;background:rgba(30,41,59,0.4);border-bottom:1px solid rgba(255,255,255,0.07);">
        <div style="display:flex;align-items:center;gap:10px;">
          <span style="font-weight:800;font-size:14px;color:#3b82f6;letter-spacing:0.4px;">🛡️ AegisOne XAI</span>
          ${generated}
        </div>
        <button id="aegis-xai-close" style="background:none;border:none;color:#64748b;font-size:22px;cursor:pointer;">✕</button>
      </div>
      <div style="padding:20px;max-height:72vh;overflow-y:auto;">
        ${score != null ? `
        <div style="display:flex;align-items:center;gap:16px;padding:14px;background:rgba(30,41,59,0.25);border-radius:12px;border:1px solid rgba(255,255,255,0.05);margin-bottom:20px;">
          <div style="width:72px;height:72px;border-radius:50%;border:4px solid ${scoreColor};display:flex;flex-direction:column;align-items:center;justify-content:center;flex-shrink:0;">
            <span style="font-size:18px;font-weight:800;color:${scoreColor};">${score}%</span>
            <span style="font-size:8px;color:#64748b;font-weight:700;margin-top:1px;">RISK</span>
          </div>
          <div>
            <div style="font-size:9px;color:#64748b;text-transform:uppercase;font-weight:700;margin-bottom:3px;">Threat Type</div>
            <div style="font-size:13px;color:#f1f5f9;font-weight:600;">${_threatLabel(threat_type)}</div>
            ${url ? `<div style="font-size:10px;color:#475569;margin-top:4px;word-break:break-all;">${shortURL(url, 50)}</div>` : ""}
          </div>
        </div>` : ""}

        ${xai.summary ? `
        <div style="margin-bottom:18px;">
          <div style="font-size:10px;text-transform:uppercase;color:#64748b;font-weight:800;letter-spacing:0.5px;margin-bottom:8px;">Why is this risky?</div>
          <div style="font-size:12px;color:#cbd5e1;line-height:1.65;background:rgba(15,23,42,0.5);padding:12px 16px;border-radius:8px;border:1px solid rgba(255,255,255,0.03);">${xai.summary}</div>
        </div>` : ""}

        ${reasonsHtml ? `
        <div style="margin-bottom:18px;">
          <div style="font-size:10px;text-transform:uppercase;color:#64748b;font-weight:800;letter-spacing:0.5px;margin-bottom:8px;">Main Risk Factors</div>
          <ul style="list-style:none;padding:0;margin:0;">${reasonsHtml}</ul>
        </div>` : ""}

        ${xai.threat_likelihood ? `
        <div style="margin-bottom:18px;background:rgba(239,68,68,0.05);border:1px solid rgba(239,68,68,0.15);border-radius:8px;padding:12px 16px;">
          <div style="font-size:9px;color:#64748b;text-transform:uppercase;font-weight:700;margin-bottom:6px;">Likely Attack Type</div>
          <div style="font-size:13px;color:#f87171;font-weight:700;">${xai.threat_likelihood}</div>
        </div>` : ""}

        ${mitreHtml ? `
        <div style="margin-bottom:18px;">
          <div style="font-size:10px;text-transform:uppercase;color:#64748b;font-weight:800;letter-spacing:0.5px;margin-bottom:8px;">MITRE ATT&CK Mapping</div>
          <div style="display:flex;flex-wrap:wrap;gap:6px;">${mitreHtml}</div>
        </div>` : ""}

        ${recsHtml ? `
        <div style="margin-bottom:4px;">
          <div style="font-size:10px;text-transform:uppercase;color:#64748b;font-weight:800;letter-spacing:0.5px;margin-bottom:8px;">Recommendations</div>
          <ul style="list-style:none;padding:0;margin:0;">${recsHtml}</ul>
        </div>` : ""}
      </div>
      <div style="display:flex;justify-content:space-between;align-items:center;padding:12px 20px;border-top:1px solid rgba(255,255,255,0.05);background:rgba(10,15,30,0.2);">
        <span style="font-size:9px;color:#334155;">AegisOne Security Copilot</span>
        <button id="aegis-xai-report" style="background:rgba(239,68,68,0.08);color:#f87171;border:1px solid rgba(239,68,68,0.2);padding:5px 12px;border-radius:6px;font-size:10px;font-weight:700;cursor:pointer;font-family:inherit;">Report Threat</button>
      </div>
    </div>
  `);

  document.getElementById("aegis-xai-close")?.addEventListener("click", () => {
    document.getElementById("aegis-xai-overlay")?.remove();
  });

  document.getElementById("aegis-xai-report")?.addEventListener("click", async () => {
    await chrome.runtime.sendMessage({
      type: MSG.REPORT_THREAT,
      url: window.location.href,
      score: score || 0,
    }).catch(() => null);
    const btn = document.getElementById("aegis-xai-report");
    if (btn) { btn.textContent = "✓ Reported"; btn.disabled = true; }
  });
}

// ── 3. Download Decision Modal ────────────────────────────
export function showDownloadModal({ downloadId, filename, risk_score, verdict, url, signals }) {
  _removeModal("aegis-download-overlay");

  const isHigh = risk_score >= 80;
  const scoreColor = isHigh ? "#ef4444" : "#f97316";
  const signalsHtml = (signals || []).slice(0, 4).map(s =>
    `<li style="font-size:11px;color:#94a3b8;margin-bottom:4px;">⚠ ${s}</li>`
  ).join("");

  _createModal("aegis-download-overlay", `
    <div style="
      width:440px;max-width:92%;
      background:#0f0a0a;border:1px solid rgba(239,68,68,0.3);
      border-radius:16px;overflow:hidden;text-align:center;
      animation:aegisEntrance 0.35s cubic-bezier(0.16,1,0.3,1);
    ">
      <div style="padding:14px 20px;background:rgba(239,68,68,0.12);border-bottom:1px solid rgba(239,68,68,0.2);">
        <span style="font-weight:800;font-size:12px;color:#f87171;text-transform:uppercase;letter-spacing:1px;">🛡️ AegisOne — Download Intercepted</span>
      </div>
      <div style="padding:22px 26px;">
        <div style="font-size:28px;margin-bottom:12px;">📎</div>
        <h2 style="font-size:17px;font-weight:800;color:${scoreColor};margin:0 0 6px;">${risk_score}% Risk File Detected</h2>
        <p style="font-size:12px;color:#94a3b8;margin:0 0 16px;word-break:break-all;">${filename || "Unknown file"}</p>
        ${signalsHtml ? `
        <div style="text-align:left;background:rgba(239,68,68,0.05);border:1px solid rgba(239,68,68,0.12);border-radius:8px;padding:10px 14px;margin-bottom:16px;">
          <ul style="list-style:none;padding:0;margin:0;">${signalsHtml}</ul>
        </div>` : ""}
        <p style="font-size:10px;color:#f87171;font-style:italic;margin:0;">Do not download files from untrusted sources.</p>
      </div>
      <div style="display:flex;gap:10px;padding:14px 20px;background:rgba(15,10,10,0.5);border-top:1px solid rgba(239,68,68,0.12);">
        <button id="aegis-dl-block" style="flex:1.5;padding:10px;background:#ef4444;color:#fff;border:none;border-radius:8px;font-size:12px;font-weight:700;cursor:pointer;font-family:inherit;">🛡️ Block Download</button>
        <button id="aegis-dl-allow" style="flex:1;padding:10px;background:transparent;color:#64748b;border:1px solid rgba(255,255,255,0.08);border-radius:8px;font-size:11px;font-weight:600;cursor:pointer;font-family:inherit;">Download Anyway</button>
      </div>
    </div>
  `);

  document.getElementById("aegis-dl-block")?.addEventListener("click", () => {
    chrome.runtime.sendMessage({ type: MSG.DOWNLOAD_DECISION, downloadId, action: "block" });
    document.getElementById("aegis-download-overlay")?.remove();
  });

  document.getElementById("aegis-dl-allow")?.addEventListener("click", () => {
    chrome.runtime.sendMessage({ type: MSG.DOWNLOAD_DECISION, downloadId, action: "allow" });
    document.getElementById("aegis-download-overlay")?.remove();
  });
}

// ── 4. Right-Click Scan Result ────────────────────────────
export function showRightClickResult({ url, result, isImage }) {
  _removeModal("aegis-rightclick-overlay");

  const score = result?.score ?? 0;
  const scoreColor = score >= 80 ? "#ef4444" : score >= 50 ? "#f97316" : score >= 20 ? "#f59e0b" : "#10b981";
  const verdictText = score >= 80 ? "🚨 High Risk" : score >= 50 ? "⚠️ Suspicious" : score >= 20 ? "🔶 Low Risk" : "✅ Safe";
  const factors = (result?.top_factors || []).slice(0, 3);

  _createModal("aegis-rightclick-overlay", `
    <div style="
      width:380px;max-width:92%;
      background:rgba(15,23,42,0.97);border:1px solid rgba(255,255,255,0.1);
      border-radius:14px;overflow:hidden;
      animation:aegisEntrance 0.25s cubic-bezier(0.16,1,0.3,1);
    ">
      <div style="display:flex;align-items:center;justify-content:space-between;padding:14px 18px;background:rgba(30,41,59,0.5);border-bottom:1px solid rgba(255,255,255,0.06);">
        <span style="font-weight:700;font-size:12px;color:#e2e8f0;">🛡️ AegisOne ${isImage ? "Image" : "Link"} Scan</span>
        <button id="aegis-rc-close" style="background:none;border:none;color:#64748b;font-size:18px;cursor:pointer;">✕</button>
      </div>
      <div style="padding:18px;">
        <div style="font-size:10px;color:#475569;word-break:break-all;margin-bottom:10px;">${shortURL(url, 60)}</div>
        <div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:12px;">
          <span style="font-size:14px;font-weight:800;color:${scoreColor};">${verdictText}</span>
          <span style="font-size:18px;font-weight:800;color:${scoreColor};">${score}%</span>
        </div>
        <div style="height:3px;background:#1e293b;border-radius:2px;margin-bottom:12px;">
          <div style="height:100%;width:${score}%;background:${scoreColor};border-radius:2px;transition:width 0.5s;"></div>
        </div>
        ${factors.map(f => `<div style="font-size:11px;color:#64748b;margin-bottom:4px;">→ ${f.label}</div>`).join("")}
      </div>
    </div>
  `);

  document.getElementById("aegis-rc-close")?.addEventListener("click", () => {
    document.getElementById("aegis-rightclick-overlay")?.remove();
  });

  // Auto-close after 8 seconds
  setTimeout(() => document.getElementById("aegis-rightclick-overlay")?.remove(), 8000);
}

// ── Internal helpers ──────────────────────────────────────
function _createModal(id, contentHtml) {
  _ensureModalStyles();
  const overlay = document.createElement("div");
  overlay.id = id;
  overlay.style.cssText = `
    position: fixed !important; inset: 0 !important; z-index: 2147483647 !important;
    background: rgba(10,15,30,0.75) !important; backdrop-filter: blur(12px) !important;
    display: flex !important; align-items: center !important; justify-content: center !important;
    font-family: 'Inter', -apple-system, sans-serif !important;
  `;
  overlay.innerHTML = contentHtml;
  document.body.appendChild(overlay);

  // Click outside to close
  overlay.addEventListener("click", (e) => {
    if (e.target === overlay) overlay.remove();
  });
}

function _removeModal(id) {
  document.getElementById(id)?.remove();
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
