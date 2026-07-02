/**
 * AegisOne — Content Script: Floating Widget
 * ============================================
 * The always-visible shield in the bottom-right corner.
 * Displays: risk score, verdict, top reason, action buttons.
 *
 * Actions available:
 *  - Continue (dismiss warning)
 *  - View Details (show full breakdown)
 *  - Explain with AI (trigger XAI — only on demand)
 *  - Report Threat (one-click reporting)
 */

import { VERDICT, MSG } from "../../utils/constants.js";

const WIDGET_ID = "aegis-widget-v2";

export function createWidget() {
  if (document.getElementById(WIDGET_ID)) return;

  _injectStyles();

  const widget = document.createElement("div");
  widget.id = WIDGET_ID;
  widget.innerHTML = `
    <div id="aegis-mini-bubble" title="AegisOne — Click to expand">🛡️</div>
    <div id="aegis-widget-main">
      <div id="aegis-header">
        <div class="aegis-brand">
          <span class="aegis-shield-icon">🛡️</span>
          <span class="aegis-brand-name">AegisOne</span>
        </div>
        <div class="aegis-header-controls">
          <button id="aegis-btn-scan" title="Full page scan" class="aegis-ctrl-btn aegis-scan-btn">🔍</button>
          <button id="aegis-btn-min" title="Minimize" class="aegis-ctrl-btn">—</button>
          <button id="aegis-btn-off" title="Turn off" class="aegis-ctrl-btn">✕</button>
        </div>
      </div>
      <div id="aegis-body">
        <div id="aegis-status-card" class="aegis-status scanning">
          <div id="aegis-status-icon" class="aegis-s-icon">🔍</div>
          <div class="aegis-s-info">
            <div id="aegis-s-title" class="aegis-s-title">Scanning...</div>
            <div id="aegis-s-sub" class="aegis-s-sub">Analyzing page security</div>
          </div>
        </div>
        <div id="aegis-risk-row">
          <span class="aegis-risk-label">Risk</span>
          <div id="aegis-risk-bar-track">
            <div id="aegis-risk-bar-fill"></div>
          </div>
          <span id="aegis-risk-pct" class="aegis-risk-pct">—</span>
        </div>
        <div id="aegis-actions" class="aegis-actions hidden">
          <button id="aegis-action-details" class="aegis-btn-secondary">📊 Details</button>
          <button id="aegis-action-xai" class="aegis-btn-primary">✨ Explain AI</button>
        </div>
        <div id="aegis-threat-count" class="aegis-footer-note"></div>
      </div>
    </div>
  `;

  document.body.appendChild(widget);
  _setupDrag(widget);
  _setupControls(widget);
  return widget;
}

export function updateWidget(data) {
  const { score, verdict, top_factors, threat_type } = data || {};
  const widget = document.getElementById(WIDGET_ID);

  const statusCard = document.getElementById("aegis-status-card");
  const icon = document.getElementById("aegis-status-icon");
  const title = document.getElementById("aegis-s-title");
  const sub = document.getElementById("aegis-s-sub");
  const fill = document.getElementById("aegis-risk-bar-fill");
  const pct = document.getElementById("aegis-risk-pct");
  const actions = document.getElementById("aegis-actions");
  const note = document.getElementById("aegis-threat-count");

  if (!statusCard || !widget) return;

  if (score == null) {
    widget.style.setProperty("display", "none", "important");
    statusCard.className = "aegis-status scanning";
    icon.textContent = "🔍";
    title.textContent = "Scanning...";
    sub.textContent = "Analyzing page security";
    return;
  }

  // Only display the widget popup if risk is >= 50%
  if (score >= 50) {
    widget.style.setProperty("display", "block", "important");
  } else {
    widget.style.setProperty("display", "none", "important");
  }

  let cls, iconText, titleText;
  if (score >= 80) {
    cls = "danger"; iconText = "🚨"; titleText = "Phishing Detected";
  } else if (score >= 50) {
    cls = "warning"; iconText = "⚠️"; titleText = "Suspicious Page";
  } else if (score >= 20) {
    cls = "caution"; iconText = "🔶"; titleText = "Low Risk";
  } else {
    cls = "safe"; iconText = "✅"; titleText = "Page Safe";
  }

  statusCard.className = `aegis-status ${cls}`;
  icon.textContent = iconText;
  title.textContent = titleText;

  // Show top reason in subtitle
  const topReason = top_factors?.[0]?.label;
  sub.textContent = topReason || `${score}% risk`;

  // Risk bar
  fill.style.width = `${score}%`;
  fill.style.background = score < 20 ? "#10b981" : score < 50 ? "#f59e0b" : score < 80 ? "#f97316" : "#ef4444";
  pct.textContent = `${score}%`;
  pct.style.color = score < 20 ? "#10b981" : score < 50 ? "#f59e0b" : "#ef4444";

  // Show action buttons on suspicious/danger
  if (score >= 50) {
    actions.classList.remove("hidden");
  } else {
    actions.classList.add("hidden");
  }

  note.textContent = "";
}

export function updateThreatCount(count) {
  const widget = document.getElementById(WIDGET_ID);
  const note = document.getElementById("aegis-threat-count");
  if (!note) return;
  note.textContent = count > 0
    ? `⚠️ ${count} malicious link${count > 1 ? "s" : ""} found`
    : count === 0 ? "✓ All links safe" : "";
  note.style.color = count > 0 ? "#ef4444" : "#10b981";

  if (count > 0 && widget) {
    widget.style.setProperty("display", "block", "important");
  }
}

// ── Internal ──────────────────────────────────────────────
function _setupControls(widget) {
  document.getElementById("aegis-btn-min")?.addEventListener("click", () => {
    widget.classList.toggle("minimized");
  });
  document.getElementById("aegis-mini-bubble")?.addEventListener("click", () => {
    widget.classList.remove("minimized");
  });
  document.getElementById("aegis-btn-off")?.addEventListener("click", () => {
    chrome.runtime.sendMessage({ type: MSG.TOGGLE_SHIELD });
    widget.remove();
  });

  document.getElementById("aegis-btn-scan")?.addEventListener("click", () => {
    chrome.runtime.sendMessage({ type: "TRIGGER_FULL_SCAN" });
  });

  document.getElementById("aegis-action-details")?.addEventListener("click", () => {
    const evt = new CustomEvent("aegis:show-details");
    document.dispatchEvent(evt);
  });

  document.getElementById("aegis-action-xai")?.addEventListener("click", async () => {
    const btn = document.getElementById("aegis-action-xai");
    btn.textContent = "⏳ Loading...";
    btn.disabled = true;

    const res = await chrome.runtime.sendMessage({
      type: MSG.XAI_REQUEST,
      url: window.location.href,
    }).catch(() => null);

    btn.textContent = "✨ Explain AI";
    btn.disabled = false;

    if (res?.xai) {
      const evt = new CustomEvent("aegis:show-xai", { detail: res.xai });
      document.dispatchEvent(evt);
    }
  });
}

function _setupDrag(widget) {
  let dragging = false, startX = 0, startY = 0;
  const header = document.getElementById("aegis-header");
  if (!header) return;

  header.addEventListener("mousedown", (e) => {
    if (e.target.tagName === "BUTTON") return;
    dragging = true;
    const rect = widget.getBoundingClientRect();
    startX = e.clientX - rect.left;
    startY = e.clientY - rect.top;
  });
  document.addEventListener("mousemove", (e) => {
    if (!dragging) return;
    widget.style.left = `${e.clientX - startX}px`;
    widget.style.top = `${e.clientY - startY}px`;
    widget.style.right = "auto";
    widget.style.bottom = "auto";
  });
  document.addEventListener("mouseup", () => dragging = false);
}

function _injectStyles() {
  if (document.getElementById("aegis-widget-styles")) return;
  const style = document.createElement("style");
  style.id = "aegis-widget-styles";
  style.textContent = `
    #aegis-widget-v2 {
      display: none !important;
      position: fixed !important;
      bottom: 20px !important;
      right: 20px !important;
      z-index: 2147483647 !important;
      font-family: 'Inter', -apple-system, BlinkMacSystemFont, sans-serif !important;
      font-size: 12px !important;
      user-select: none !important;
    }
    #aegis-mini-bubble {
      display: none;
      width: 44px; height: 44px;
      background: #1e293b;
      border: 1px solid #334155;
      border-radius: 50%;
      align-items: center; justify-content: center;
      font-size: 22px;
      cursor: pointer;
      box-shadow: 0 4px 20px rgba(0,0,0,0.5);
    }
    #aegis-widget-v2.minimized #aegis-mini-bubble { display: flex !important; }
    #aegis-widget-v2.minimized #aegis-widget-main { display: none !important; }

    #aegis-widget-main {
      width: 240px;
      background: rgba(13, 17, 23, 0.97);
      border: 1px solid #2d3548;
      border-radius: 14px;
      overflow: hidden;
      box-shadow: 0 8px 40px rgba(0,0,0,0.6), 0 0 0 1px rgba(255,255,255,0.04) inset;
      backdrop-filter: blur(12px);
    }

    #aegis-header {
      display: flex; align-items: center; justify-content: space-between;
      padding: 9px 12px;
      background: rgba(22, 27, 39, 0.9);
      border-bottom: 1px solid #1e2840;
      cursor: move;
    }
    .aegis-brand { display: flex; align-items: center; gap: 6px; }
    .aegis-shield-icon { font-size: 14px; }
    .aegis-brand-name { font-weight: 700; font-size: 12px; color: #e2e8f0; letter-spacing: 0.3px; }
    .aegis-header-controls { display: flex; gap: 4px; }
    .aegis-ctrl-btn {
      background: none; border: none; color: #475569;
      cursor: pointer; font-size: 11px; padding: 2px 4px;
      border-radius: 4px; line-height: 1; transition: all 0.15s;
    }
    .aegis-ctrl-btn:hover { color: #e2e8f0; background: rgba(255,255,255,0.06); }
    .aegis-scan-btn { color: #3b82f6 !important; font-size: 13px !important; }

    #aegis-body { padding: 10px 12px; }

    .aegis-status {
      display: flex; align-items: center; gap: 10px;
      padding: 8px 10px; border-radius: 10px;
      background: rgba(30,41,59,0.4);
      border: 1px solid rgba(255,255,255,0.04);
      margin-bottom: 8px; transition: all 0.3s;
    }
    .aegis-status.safe    { border-color: rgba(16,185,129,0.25); background: rgba(16,185,129,0.07); }
    .aegis-status.caution { border-color: rgba(251,191,36,0.25); background: rgba(251,191,36,0.07); }
    .aegis-status.warning { border-color: rgba(249,115,22,0.3);  background: rgba(249,115,22,0.08); }
    .aegis-status.danger  { border-color: rgba(239,68,68,0.35);  background: rgba(239,68,68,0.09); }
    .aegis-status.scanning{ border-color: rgba(99,102,241,0.3);  background: rgba(99,102,241,0.07); }

    .aegis-s-icon { font-size: 22px; flex-shrink: 0; }
    .aegis-s-title { font-weight: 700; font-size: 11.5px; color: #f1f5f9; }
    .aegis-s-sub   { font-size: 10px; color: #64748b; margin-top: 1px; max-width: 160px; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }

    #aegis-risk-row {
      display: flex; align-items: center; gap: 6px;
      margin-bottom: 8px;
    }
    .aegis-risk-label { font-size: 9px; text-transform: uppercase; color: #64748b; font-weight: 700; flex-shrink: 0; }
    #aegis-risk-bar-track {
      flex: 1; height: 3px; background: #1e293b; border-radius: 2px; overflow: hidden;
    }
    #aegis-risk-bar-fill { height: 100%; border-radius: 2px; width: 0%; transition: width 0.6s ease, background 0.3s; }
    .aegis-risk-pct { font-size: 10px; font-weight: 700; flex-shrink: 0; min-width: 26px; text-align: right; }

    .aegis-actions { display: flex; gap: 6px; margin-bottom: 6px; }
    .aegis-actions.hidden { display: none; }
    .aegis-btn-primary {
      flex: 1; padding: 5px 8px; font-size: 10px; font-weight: 700;
      background: linear-gradient(135deg, #3b82f6, #8b5cf6);
      color: #fff; border: none; border-radius: 6px; cursor: pointer;
      transition: opacity 0.2s; font-family: inherit;
    }
    .aegis-btn-primary:hover { opacity: 0.85; }
    .aegis-btn-secondary {
      flex: 1; padding: 5px 8px; font-size: 10px; font-weight: 600;
      background: rgba(255,255,255,0.05); color: #94a3b8;
      border: 1px solid rgba(255,255,255,0.08); border-radius: 6px; cursor: pointer;
      transition: all 0.2s; font-family: inherit;
    }
    .aegis-btn-secondary:hover { color: #e2e8f0; background: rgba(255,255,255,0.09); }

    .aegis-footer-note { font-size: 10px; color: #64748b; text-align: center; min-height: 14px; }
  `;
  document.head.appendChild(style);
}
