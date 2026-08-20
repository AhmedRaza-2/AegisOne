/**
 * AegisOne — Content Script: Floating Security Widget v2.3
 * ==========================================================
 * Modern high-contrast floating shield widget.
 * Features:
 *  - High-legibility glassmorphism card
 *  - Seamless integrated threat details breakdown panel
 *  - One-click XAI explanation trigger
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
          <button id="aegis-btn-min" title="Minimize" class="aegis-ctrl-btn">—</button>
          <button id="aegis-btn-off" title="Turn off" class="aegis-ctrl-btn">✕</button>
        </div>
      </div>
      <div id="aegis-body">
        <div id="aegis-status-card" class="aegis-status scanning">
          <div id="aegis-status-icon" class="aegis-s-icon">🔍</div>
          <div class="aegis-s-info">
            <div id="aegis-s-title" class="aegis-s-title">Scanning...</div>
          </div>
        </div>
        <div id="aegis-risk-row">
          <span class="aegis-risk-label">RISK</span>
          <div id="aegis-risk-bar-track">
            <div id="aegis-risk-bar-fill"></div>
          </div>
          <span id="aegis-risk-pct" class="aegis-risk-pct">—</span>
        </div>
        <div id="aegis-actions" class="aegis-actions hidden">
          <button id="aegis-action-details" class="aegis-btn-secondary" title="View Threat Breakdown">Details</button>
          <button id="aegis-action-xai" class="aegis-btn-primary" title="Explain with AI">✨ Explain AI</button>
        </div>
      </div>
    </div>
  `;

  document.body.appendChild(widget);
  _setupDrag(widget);
  _setupControls(widget);
  return widget;
}

export function updateWidget(data) {
  const normalized = _normalizeWidgetData(data);
  const { score, verdict, top_factors, threat_type } = normalized;
  const widget = document.getElementById(WIDGET_ID);

  const statusCard = document.getElementById("aegis-status-card");
  const icon = document.getElementById("aegis-status-icon");
  const title = document.getElementById("aegis-s-title");
  const fill = document.getElementById("aegis-risk-bar-fill");
  const pct = document.getElementById("aegis-risk-pct");
  const actions = document.getElementById("aegis-actions");

  if (!statusCard || !widget) return;

  if (score == null) {
    widget.style.setProperty("display", "none", "important");
    statusCard.className = "aegis-status scanning";
    icon.textContent = "🔍";
    title.textContent = "Scanning...";
    return;
  }

  widget.style.setProperty("display", "block", "important");
  widget._aegisData = { score, verdict, top_factors, threat_type };

  let cls, iconText, titleText;
  if (score >= 80) {
    cls = "danger";  iconText = "🚨"; titleText = "Phishing Detected";
  } else if (score >= 50) {
    cls = "warning"; iconText = "⚠️"; titleText = "Suspicious Page";
  } else if (score >= 20) {
    cls = "caution"; iconText = "🔶"; titleText = "Low Risk";
  } else {
    cls = "safe";    iconText = "✅"; titleText = "Page Safe";
  }

  statusCard.className = `aegis-status ${cls}`;
  icon.textContent = iconText;
  title.textContent = titleText;

  const barColor = score < 20 ? "#10b981" : score < 50 ? "#fbbf24" : score < 80 ? "#f97316" : "#ef4444";
  fill.style.width = `${score}%`;
  fill.style.background = barColor;
  pct.textContent = `${score}%`;
  pct.style.color = barColor;

  actions.classList.remove("hidden");
  _refreshDetailsPanel(score, top_factors, threat_type);
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

// ── Controls ──────────────────────────────────────────────
function _setupControls(widget) {
  document.getElementById("aegis-btn-min")?.addEventListener("click", () => {
    widget.classList.toggle("minimized");
    document.getElementById("aegis-details-panel")?.remove();
  });
  document.getElementById("aegis-mini-bubble")?.addEventListener("click", () => {
    widget.classList.remove("minimized");
  });
  document.getElementById("aegis-btn-off")?.addEventListener("click", () => {
    try {
      if (chrome.runtime?.id) {
        chrome.runtime.sendMessage({ type: MSG.TOGGLE_SHIELD }).catch(() => {});
      }
    } catch (_) {}
    document.getElementById("aegis-details-panel")?.remove();
    widget.remove();
  });

  document.getElementById("aegis-action-details")?.addEventListener("click", () => {
    const existing = document.getElementById("aegis-details-panel");
    if (existing) { existing.remove(); return; }
    const d = widget._aegisData || {};
    _showDetailsPanel(widget, d.score ?? 0, d.top_factors, d.threat_type);
  });

  document.getElementById("aegis-action-xai")?.addEventListener("click", async () => {
    const btn = document.getElementById("aegis-action-xai");
    btn.textContent = "⏳ Loading...";
    btn.disabled = true;

    let res = null;
    try {
      if (chrome.runtime?.id) {
        res = await chrome.runtime.sendMessage({
          type: MSG.XAI_REQUEST,
          url: window.location.href,
        });
      }
    } catch (err) {
      console.warn("[AegisOne] Extension context invalidated. Please refresh the page.", err);
    }

    btn.textContent = "✨ Explain AI";
    btn.disabled = false;

    if (res?.xai) {
      const evt = new CustomEvent("aegis:show-xai", { detail: res.xai });
      document.dispatchEvent(evt);
    } else {
      const d = widget._aegisData || {};
      const evt = new CustomEvent("aegis:show-xai", { detail: {
        summary: `AegisOne evaluated this page with a ${d.score ?? 0}% risk score.`,
        main_reasons: (d.top_factors || []).map(f => f.label || f),
        recommendations: ["Avoid entering passwords or sensitive personal data.", "Verify website URL carefully."],
        generated_locally: true,
      }});
      document.dispatchEvent(evt);
    }
  });
}

// ── Details Panel (integrated into widget) ─────────────────
function _showDetailsPanel(widget, score, top_factors, threat_type) {
  const existing = document.getElementById("aegis-details-panel");
  if (existing) existing.remove();

  const factors = top_factors || [];
  const threatLabel = threat_type ? threat_type.replace(/_/g, " ") : "Suspicious Activity";

  const factorsHtml = factors.length > 0
    ? factors.map(f => {
        const rawLabel = typeof f === 'string' ? f : f.label || f;
        const lower = String(rawLabel).toLowerCase();
        const isPhishing = lower.includes("phish") || lower.includes("malicious") || lower.includes("credential");
        const dotColor = isPhishing ? "#ef4444" : score >= 50 ? "#f97316" : "#fbbf24";
        const tag = isPhishing
          ? `<span style="font-size:8px;font-weight:800;background:rgba(239,68,68,0.25);color:#fca5a5;border:1px solid rgba(239,68,68,0.4);padding:1px 5px;border-radius:4px;margin-left:6px;letter-spacing:0.5px;">PHISHING</span>`
          : "";
        return `<div style="display:flex;align-items:flex-start;gap:8px;padding:6px 0;border-bottom:1px solid rgba(255,255,255,0.06);">
          <span style="width:6px;height:6px;border-radius:50%;background:${dotColor};flex-shrink:0;margin-top:4px;box-shadow:0 0 6px ${dotColor};"></span>
          <span style="font-size:10.5px;font-weight:500;color:#f1f5f9;flex:1;line-height:1.4;word-break:break-word;">${rawLabel}${tag}</span>
        </div>`;
      }).join("")
    : `<div style="font-size:10px;color:#94a3b8;padding:8px 0;">No specific risk factors detected.</div>`;

  const panel = document.createElement("div");
  panel.id = "aegis-details-panel";
  panel.style.cssText = `
    position: absolute;
    bottom: 100%;
    left: 0;
    width: 100%;
    margin-bottom: 8px;
    background: rgba(12, 17, 29, 0.98);
    border: 1px solid rgba(255, 255, 255, 0.12);
    border-radius: 10px;
    padding: 10px 12px;
    box-shadow: 0 8px 32px rgba(0,0,0,0.6);
    backdrop-filter: blur(12px);
    animation: aegisDetailsSlideUp 0.25s cubic-bezier(0.16, 1, 0.3, 1);
    font-family: 'Inter', -apple-system, sans-serif;
    box-sizing: border-box;
  `;

  panel.innerHTML = `
    <style>
      @keyframes aegisDetailsSlideUp {
        from { opacity: 0; transform: translateY(8px); }
        to   { opacity: 1; transform: translateY(0); }
      }
    </style>
    <div style="font-size:9px;text-transform:uppercase;color:#38bdf8;font-weight:800;letter-spacing:0.6px;margin-bottom:6px;">THREAT BREAKDOWN</div>
    <div style="font-size:10px;color:#cbd5e1;margin-bottom:8px;">
      Threat Category: <strong style="color:#ffffff;text-transform:capitalize;">${threatLabel}</strong>
    </div>
    <div style="max-height:140px;overflow-y:auto;margin-bottom:6px;">
      ${factorsHtml}
    </div>
    <div style="margin-top:8px;font-size:9px;color:#94a3b8;text-align:center;border-top:1px solid rgba(255,255,255,0.08);padding-top:8px;">
      Click <strong style="color:#a5b4fc;font-weight:800;">✨ Explain AI</strong> for detailed report
    </div>
  `;

  if (widget) widget.appendChild(panel);
}

function _refreshDetailsPanel(score, top_factors, threat_type) {
  const panel = document.getElementById("aegis-details-panel");
  if (!panel) return;
  const widget = document.getElementById(WIDGET_ID);
  if (widget) _showDetailsPanel(widget, score, top_factors, threat_type);
}

function _normalizeWidgetData(data) {
  if (data == null) {
    return { score: null, verdict: null, top_factors: [], threat_type: null };
  }

  if (typeof data === "number") {
    const score = data > 1 ? Math.round(data) : Math.round(data * 100);
    return {
      score,
      verdict: score >= 80 ? "danger" : score >= 50 ? "warning" : score >= 20 ? "caution" : "safe",
      top_factors: [],
      threat_type: null,
    };
  }

  let score = null;
  if (data.score != null) {
    score = (data.score <= 1 && data.score > 0 && data.score.toString().includes(".")) 
            ? Math.round(data.score * 100) 
            : Math.round(data.score);
  } else if (data.phishing_probability != null) {
    score = data.phishing_probability <= 1 
            ? Math.round(data.phishing_probability * 100) 
            : Math.round(data.phishing_probability);
  }

  return {
    score,
    verdict: data.verdict || (score == null ? null : score >= 80 ? "danger" : score >= 50 ? "warning" : score >= 20 ? "caution" : "safe"),
    top_factors: data.top_factors || [],
    threat_type: data.threat_type || null,
  };
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
      font-family: 'Inter', -apple-system, sans-serif !important;
      font-size: 12px !important;
      user-select: none !important;
      pointer-events: none !important;
    }
    #aegis-mini-bubble {
      display: none;
      width: 44px; height: 44px;
      background: #1e293b;
      border: 1px solid #3b82f6;
      border-radius: 50%;
      align-items: center; justify-content: center;
      font-size: 22px;
      cursor: pointer;
      box-shadow: 0 6px 24px rgba(0,0,0,0.6);
      pointer-events: auto !important;
    }
    #aegis-widget-v2.minimized #aegis-mini-bubble { display: flex !important; }
    #aegis-widget-v2.minimized #aegis-widget-main { display: none !important; }

    #aegis-widget-main {
      width: 240px !important;
      background: rgba(12, 17, 29, 0.96);
      border: 1px solid rgba(255, 255, 255, 0.1);
      border-radius: 10px;
      overflow: hidden;
      box-shadow: 0 8px 32px rgba(0,0,0,0.6), 0 0 0 1px rgba(255,255,255,0.05) inset;
      backdrop-filter: blur(12px);
      pointer-events: auto !important;
    }

    #aegis-header {
      display: flex; align-items: center; justify-content: space-between;
      padding: 6px 10px;
      background: rgba(22, 30, 46, 0.95);
      border-bottom: 1px solid rgba(255, 255, 255, 0.08);
      cursor: move;
    }
    .aegis-brand { display: flex; align-items: center; gap: 5px; }
    .aegis-shield-icon { font-size: 13px; }
    .aegis-brand-name { font-weight: 800; font-size: 11px; color: #ffffff; letter-spacing: -0.2px; }
    .aegis-header-controls { display: flex; gap: 4px; }
    .aegis-ctrl-btn {
      background: none; border: none; color: #64748b;
      cursor: pointer; font-size: 10px; padding: 2px 4px;
      border-radius: 4px; line-height: 1; transition: all 0.15s;
    }
    .aegis-ctrl-btn:hover { color: #ffffff; background: rgba(255,255,255,0.1); }

    #aegis-body { padding: 8px 10px; }

    .aegis-status {
      display: flex; align-items: center; gap: 8px;
      padding: 6px 8px; border-radius: 8px;
      background: rgba(30,41,59,0.5);
      border: 1px solid rgba(255,255,255,0.06);
      margin-bottom: 8px; transition: all 0.3s;
    }
    .aegis-status.safe    { border-color: rgba(16,185,129,0.35); background: rgba(16,185,129,0.08); }
    .aegis-status.caution { border-color: rgba(251,191,36,0.35); background: rgba(251,191,36,0.08); }
    .aegis-status.warning { border-color: rgba(249,115,22,0.4);  background: rgba(249,115,22,0.09); }
    .aegis-status.danger  { border-color: rgba(239,68,68,0.45);  background: rgba(239,68,68,0.1); }
    .aegis-status.scanning{ border-color: rgba(99,102,241,0.35); background: rgba(99,102,241,0.08); }

    .aegis-s-icon { font-size: 16px; flex-shrink: 0; }
    .aegis-s-title { font-weight: 800; font-size: 11px; color: #ffffff; }

    #aegis-risk-row {
      display: flex; align-items: center; gap: 6px;
      margin-bottom: 8px;
    }
    .aegis-risk-label { font-size: 8px; text-transform: uppercase; color: #94a3b8; font-weight: 800; letter-spacing: 0.5px; flex-shrink: 0; }
    #aegis-risk-bar-track {
      flex: 1; height: 3px; background: #1e293b; border-radius: 2px; overflow: hidden;
    }
    #aegis-risk-bar-fill { height: 100%; border-radius: 2px; width: 0%; transition: width 0.6s ease, background 0.3s; }
    .aegis-risk-pct { font-size: 10px; font-weight: 900; flex-shrink: 0; min-width: 24px; text-align: right; }

    .aegis-actions { display: flex; gap: 6px; }
    .aegis-actions.hidden { display: none; }
    .aegis-btn-primary {
      flex: 1; padding: 5px 8px; font-size: 10px; font-weight: 800;
      background: linear-gradient(135deg, #3b82f6, #8b5cf6);
      color: #ffffff; border: none; border-radius: 6px; cursor: pointer;
      transition: all 0.2s; font-family: inherit;
      box-shadow: 0 3px 8px rgba(99,102,241,0.25);
    }
    .aegis-btn-primary:hover { opacity: 0.9; transform: translateY(-0.5px); }
    .aegis-btn-secondary {
      flex: 1; padding: 5px 8px; font-size: 10px; font-weight: 700;
      background: rgba(255,255,255,0.06); color: #f1f5f9;
      border: 1px solid rgba(255,255,255,0.12); border-radius: 6px; cursor: pointer;
      transition: all 0.2s; font-family: inherit;
    }
    .aegis-btn-secondary:hover { color: #ffffff; background: rgba(255,255,255,0.12); border-color: rgba(255,255,255,0.2); }
  `;
  document.head.appendChild(style);
}
