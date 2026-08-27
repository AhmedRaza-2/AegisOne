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
      <div id="aegis-resize-handle" title="Drag to Resize"></div>
    </div>
  `;

  document.body.appendChild(widget);
  _setupDrag(widget);
  _setupControls(widget);
  _setupResize(widget);
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

function _setupControls(widget) {
  // Listen for custom scale/opacity change events dispatched from settings or the top-right popup
  document.addEventListener("aegis:widget-opacity", (e) => {
    const mainBox = document.getElementById("aegis-widget-main");
    if (mainBox && e.detail?.opacity != null) {
      mainBox.style.background = `rgba(12, 17, 29, ${e.detail.opacity})`;
    }
  });

  document.addEventListener("aegis:widget-scale", (e) => {
    const mainBox = document.getElementById("aegis-widget-main");
    if (mainBox && e.detail?.scale != null) {
      mainBox.style.transform = `scale(${e.detail.scale})`;
      mainBox.style.transformOrigin = "top right";
    }
  });

  document.getElementById("aegis-btn-min")?.addEventListener("click", () => {
    widget.classList.toggle("minimized");
    document.getElementById("aegis-details-panel")?.remove();
  });
  document.getElementById("aegis-mini-bubble")?.addEventListener("click", () => {
    widget.classList.remove("minimized");
  });
  document.getElementById("aegis-btn-off")?.addEventListener("click", () => {
    try {
      if (typeof chrome !== "undefined" && chrome?.runtime?.id) {
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

    const d = widget._aegisData || {};
    const activeScore = d.score ?? 0;

    // ─── Priority 1: If an email is open, use its cached XAI directly ──────
    const emailXai = window.__AEGIS_ACTIVE_EMAIL_XAI__;
    if (emailXai) {
      btn.textContent = "✨ Explain AI";
      btn.disabled = false;
      document.dispatchEvent(new CustomEvent("aegis:show-xai", {
        detail: emailXai
      }));
      return;
    }

    // ─── Priority 2: Ask background for cached URL scan XAI ────────────────
    let res = null;
    try {
      if (typeof chrome !== "undefined" && chrome?.runtime?.id) {
        res = await chrome.runtime.sendMessage({
          type: MSG.XAI_REQUEST,
          url: window.location.href,
          score: activeScore,
        }).catch(() => null);
      }
    } catch (_) {}

    btn.textContent = "✨ Explain AI";
    btn.disabled = false;

    if (res?.xai && res.xai.summary) {
      // Validate: backend score must match widget score, otherwise override
      const backendScore = res.xai.score ?? activeScore;
      const scoreMismatch = Math.abs(backendScore - activeScore) > 15;
      let finalXai = res.xai;
      if (scoreMismatch && activeScore >= 50) {
        // Build a locally-generated explanation matching the actual widget score
        finalXai = _buildLocalXai(activeScore, d.top_factors, d.threat_type);
      }
      document.dispatchEvent(new CustomEvent("aegis:show-xai", { detail: finalXai }));
    } else {
      // ─── Priority 3: Build locally matching the widget's displayed score ──
      const localXai = _buildLocalXai(activeScore, d.top_factors, d.threat_type);
      document.dispatchEvent(new CustomEvent("aegis:show-xai", { detail: localXai }));
    }
  });
}

function _buildLocalXai(score, top_factors, threat_type) {
  let summary, main_reasons, recommendations;

  if (score >= 80) {
    summary = `🚨 High-Risk Phishing Detected! AegisOne's neural AI flagged this target (${score}% risk). Do not enter any credentials.`;
    main_reasons = (top_factors || []).map(f => f.label || f).filter(Boolean);
    if (!main_reasons.length) main_reasons = [
      "🚨 Neural network model detected high-confidence phishing patterns",
      "⚠️ Suspicious text, brand mismatch, or unverified sender structure",
      "🔑 Elevated risk of credential harvesting or fraud solicitation"
    ];
    recommendations = [
      "🚫 Do NOT type your password, credentials, or personal info here",
      "← Close this page or return to safety immediately",
      "📢 Hit Report Threat to help protect others"
    ];
  } else if (score >= 50) {
    summary = `⚠️ Suspicious activity detected on this page (${score}% risk). Proceed with caution.`;
    main_reasons = (top_factors || []).map(f => f.label || f).filter(Boolean);
    if (!main_reasons.length) main_reasons = [
      "⚠️ Suspicious heuristics or solicitation text detected",
      "🌐 Unverified domain or non-standard page structure"
    ];
    recommendations = [
      "👀 Verify the URL in your address bar carefully",
      "🔑 Don't enter passwords unless you're 100% certain of this site"
    ];
  } else if (score >= 20) {
    summary = `🔍 This page has minor suspicious signals (${score}% risk). Likely safe, but stay alert.`;
    main_reasons = (top_factors || []).map(f => f.label || f).filter(Boolean);
    if (!main_reasons.length) main_reasons = ["🔍 Minor pattern match in URL or page structure"];
    recommendations = ["✔️ You can continue, but stay alert", "🔗 Avoid clicking unfamiliar links"];
  } else {
    summary = `✅ This page looks safe. AegisOne's AI found no phishing indicators (${score}% risk).`;
    main_reasons = ["✅ All structural, domain, and AI heuristic checks passed cleanly"];
    recommendations = ["✅ Target appears safe — carry on!", "🔗 Always verify links and senders before providing sensitive credentials"];
  }

  const is_email = (threat_type === "phishing_email");
  const scoring_methodology = [
    is_email 
      ? "🛡️ **Floating Widget (Active Screen Risk):** This score is dynamically calculated based on the content you are actively interacting with. Since you are in a webmail client, it scans the sender reputation, subject line, message body content, embedded links, and attachments. If multiple emails are visible, it evaluates the composite risk of all items."
      : "🛡️ **Floating Widget (Active Screen Risk):** This score reflects the active, real-time threat level of the page as you interact with it. It monitors DOM changes, dynamically injected scripts, and visible elements.",
    "🔎 **Action Popup (Deep Page Scan):** This evaluates the structural integrity of the base URL/Domain. It performs deep heuristic checks including DNS reputation, cross-site scripting (XSS) vectors, hidden iframes, redirect chains, and deceptive login forms. It represents the inherent risk of the website hosting the content."
  ];

  return { summary, main_reasons, recommendations, scoring_methodology, generated_locally: true };
}

function _showDetailsPanel(widget, score, top_factors, threat_type) {
  let panel = document.getElementById("aegis-details-panel");
  const isNew = !panel;

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

  if (isNew) {
    panel = document.createElement("div");
    panel.id = "aegis-details-panel";
    panel.style.cssText = `
      width: 100%;
      background: rgba(13, 18, 30, 0.98);
      border-top: 1px solid rgba(255, 255, 255, 0.1);
      padding: 12px 14px;
      animation: aegisDetailsDrop 0.2s ease;
      font-family: 'Inter', -apple-system, sans-serif;
    `;
  }

  panel.innerHTML = `
    <style>
      @keyframes aegisDetailsDrop {
        from { opacity: 0; transform: translateY(-4px); }
        to   { opacity: 1; transform: translateY(0); }
      }
    </style>
    <div style="font-size:9px;text-transform:uppercase;color:#38bdf8;font-weight:800;letter-spacing:0.6px;margin-bottom:6px;">THREAT BREAKDOWN</div>
    <div style="font-size:10px;color:#cbd5e1;margin-bottom:8px;">
      Threat Category: <strong style="color:#ffffff;text-transform:capitalize;">${threatLabel}</strong>
    </div>
    <div style="margin-bottom:6px;">
      ${factorsHtml}
    </div>
    <div style="margin-top:8px;font-size:9px;color:#94a3b8;text-align:center;border-top:1px solid rgba(255,255,255,0.08);padding-top:8px;">
      Click <strong style="color:#a5b4fc;font-weight:800;">✨ Explain AI</strong> for detailed report
    </div>
  `;

  if (isNew) {
    const mainBox = document.getElementById("aegis-widget-main");
    if (mainBox) mainBox.appendChild(panel);

    // Auto-adjust if dragging pushed it near bottom and expansion clips it
    setTimeout(() => {
      const rect = widget.getBoundingClientRect();
      const maxBottom = window.innerHeight - 10;
      if (rect.bottom > maxBottom) {
        const currentTop = parseFloat(widget.style.top);
        if (!isNaN(currentTop)) {
          const shift = rect.bottom - maxBottom;
          widget.style.top = `${Math.max(10, currentTop - shift)}px`;
        }
      }
    }, 10);
  }
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
    let left = e.clientX - startX;
    let top = e.clientY - startY;

    // Boundary limits (10px padding from viewports)
    const maxLeft = window.innerWidth - widget.offsetWidth - 10;
    const maxTop = window.innerHeight - widget.offsetHeight - 10;
    left = Math.max(10, Math.min(left, maxLeft));
    top = Math.max(10, Math.min(top, maxTop));

    widget.style.left = `${left}px`;
    widget.style.top = `${top}px`;
    widget.style.right = "auto";
    widget.style.bottom = "auto";
  });
  document.addEventListener("mouseup", () => dragging = false);
}

function _setupResize(widget) {
  const handle = document.getElementById("aegis-resize-handle");
  const mainBox = document.getElementById("aegis-widget-main");
  if (!handle || !mainBox) return;

  let resizing = false;
  let startX = 0, startY = 0;
  let startScale = 1.0;

  handle.addEventListener("mousedown", (e) => {
    e.stopPropagation();
    e.preventDefault();
    resizing = true;
    startX = e.clientX;
    startY = e.clientY;

    // Get current scale factor from transform style or default to 1.0
    const match = mainBox.style.transform.match(/scale\(([^)]+)\)/);
    startScale = match ? parseFloat(match[1]) : 1.0;
  });

  document.addEventListener("mousemove", (e) => {
    if (!resizing) return;
    const deltaX = e.clientX - startX;
    const deltaY = e.clientY - startY;

    // Calculate a ratio scale factor based on drag distance
    // Moving bottom-right makes it larger, top-left makes it smaller
    const distance = (deltaX + deltaY) / 2;
    const scaleDelta = distance / 220; // 220px is baseline width
    const newScale = Math.max(0.6, Math.min(1.4, startScale + scaleDelta));

    mainBox.style.transform = `scale(${newScale})`;
    mainBox.style.transformOrigin = "bottom right";
  });

  document.addEventListener("mouseup", () => {
    resizing = false;
  });
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

    /* Scaling Classes */
    #aegis-widget-main.scale-normal {
      width: 240px !important;
      transform: scale(1.0);
      transform-origin: top right;
    }
    #aegis-widget-main.scale-compact {
      width: 190px !important;
      transform: scale(0.9);
      transform-origin: top right;
    }
    #aegis-widget-main.scale-micro {
      width: 145px !important;
      transform: scale(0.78);
      transform-origin: top right;
    }

    #aegis-widget-main {
      width: 240px !important;
      background: rgba(12, 17, 29, 0.98);
      border: 1px solid rgba(255, 255, 255, 0.12);
      border-radius: 14px;
      overflow: hidden !important;
      box-shadow: 0 12px 48px rgba(0,0,0,0.7), 0 0 0 1px rgba(255,255,255,0.06) inset;
      backdrop-filter: blur(16px);
      pointer-events: auto !important;
      transition: background 0.25s, transform 0.15s;
    }

    #aegis-resize-handle {
      position: absolute !important;
      right: 2px !important;
      bottom: 2px !important;
      width: 10px !important;
      height: 10px !important;
      cursor: se-resize !important;
      z-index: 999999 !important;
      border-right: 2px solid rgba(255, 255, 255, 0.3) !important;
      border-bottom: 2px solid rgba(255, 255, 255, 0.3) !important;
    }

    #aegis-header {
      display: flex; align-items: center; justify-content: space-between;
      padding: 10px 14px;
      background: rgba(22, 30, 46, 0.95);
      border-bottom: 1px solid rgba(255, 255, 255, 0.08);
      cursor: move;
    }
    .aegis-brand { display: flex; align-items: center; gap: 7px; }
    .aegis-shield-icon { font-size: 15px; }
    .aegis-brand-name { font-weight: 800; font-size: 13px; color: #ffffff; letter-spacing: -0.2px; }
    .aegis-header-controls { display: flex; gap: 4px; }
    .aegis-ctrl-btn {
      background: none; border: none; color: #64748b;
      cursor: pointer; font-size: 12px; padding: 2px 5px;
      border-radius: 4px; line-height: 1; transition: all 0.15s;
    }
    .aegis-ctrl-btn:hover { color: #ffffff; background: rgba(255,255,255,0.1); }

    #aegis-body { padding: 12px 14px; }

    .aegis-status {
      display: flex; align-items: center; gap: 10px;
      padding: 10px 12px; border-radius: 10px;
      background: rgba(30,41,59,0.5);
      border: 1px solid rgba(255,255,255,0.08);
      margin-bottom: 10px; transition: all 0.3s;
    }
    .aegis-status.safe    { border-color: rgba(16,185,129,0.35); background: rgba(16,185,129,0.08); }
    .aegis-status.caution { border-color: rgba(251,191,36,0.35); background: rgba(251,191,36,0.08); }
    .aegis-status.warning { border-color: rgba(249,115,22,0.4);  background: rgba(249,115,22,0.09); }
    .aegis-status.danger  { border-color: rgba(239,68,68,0.45);  background: rgba(239,68,68,0.1); }
    .aegis-status.scanning{ border-color: rgba(99,102,241,0.35); background: rgba(99,102,241,0.08); }

    .aegis-s-icon { font-size: 22px; flex-shrink: 0; }
    .aegis-s-title { font-weight: 800; font-size: 13px; color: #ffffff; }

    #aegis-risk-row {
      display: flex; align-items: center; gap: 8px;
      margin-bottom: 10px;
    }
    .aegis-risk-label { font-size: 9px; text-transform: uppercase; color: #94a3b8; font-weight: 800; letter-spacing: 0.5px; flex-shrink: 0; }
    #aegis-risk-bar-track {
      flex: 1; height: 4px; background: #1e293b; border-radius: 2px; overflow: hidden;
    }
    #aegis-risk-bar-fill { height: 100%; border-radius: 2px; width: 0%; transition: width 0.6s ease, background 0.3s; }
    .aegis-risk-pct { font-size: 11px; font-weight: 900; flex-shrink: 0; min-width: 28px; text-align: right; }

    .aegis-actions { display: flex; gap: 8px; }
    .aegis-actions.hidden { display: none; }
    .aegis-btn-primary {
      flex: 1; padding: 7px 10px; font-size: 11px; font-weight: 800;
      background: linear-gradient(135deg, #3b82f6, #8b5cf6);
      color: #ffffff; border: none; border-radius: 8px; cursor: pointer;
      transition: all 0.2s; font-family: inherit;
      box-shadow: 0 4px 12px rgba(99,102,241,0.3);
    }
    .aegis-btn-primary:hover { opacity: 0.9; transform: translateY(-1px); }
    .aegis-btn-secondary {
      flex: 1; padding: 7px 10px; font-size: 11px; font-weight: 700;
      background: rgba(255,255,255,0.08); color: #f1f5f9;
      border: 1px solid rgba(255,255,255,0.15); border-radius: 8px; cursor: pointer;
      transition: all 0.2s; font-family: inherit;
    }
    .aegis-btn-secondary:hover { color: #ffffff; background: rgba(255,255,255,0.14); border-color: rgba(255,255,255,0.25); }
  `;
  document.head.appendChild(style);
}
