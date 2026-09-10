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

let _autoMinimizeTimer = null;

function _startAutoMinimizeTimer(delayMs = 10000) {
  clearTimeout(_autoMinimizeTimer);
  _autoMinimizeTimer = setTimeout(() => {
    const widget = document.getElementById(WIDGET_ID);
    if (widget && !widget.classList.contains("minimized")) {
      widget.classList.add("minimized");
      document.getElementById("aegis-details-panel")?.remove();
    }
  }, delayMs);
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
  const bubble = document.getElementById("aegis-mini-bubble");

  if (!statusCard || !widget) return;

  if (score == null) {
    widget.style.setProperty("display", "none", "important");
    statusCard.className = "aegis-status scanning";
    icon.textContent = "🔍";
    title.textContent = "Scanning...";
    return;
  }

  if (window.__AEGIS_WIDGET_HIDDEN__ === true) {
    widget.style.setProperty("display", "none", "important");
  } else {
    widget.style.setProperty("display", "block", "important");
  }
  widget._aegisData = { score, verdict, top_factors, threat_type };

  const isOffline = score === -1 || verdict === "offline" || threat_type === "backend_offline" || verdict === "scan_incomplete" || threat_type === "scan_incomplete";

  let cls, iconText, titleText, bubbleIcon;
  if (isOffline) {
    cls = "danger";  iconText = "🔴"; titleText = "API Offline"; bubbleIcon = "🔴";
  } else if (score >= 80) {
    cls = "danger";  iconText = "🚨"; titleText = "Phishing Detected"; bubbleIcon = "🚨";
  } else if (score >= 50) {
    cls = "warning"; iconText = "⚠️"; titleText = "Suspicious Page"; bubbleIcon = "⚠️";
  } else if (score >= 20) {
    cls = "caution"; iconText = "🔶"; titleText = "Low Risk"; bubbleIcon = "🔶";
  } else {
    cls = "safe";    iconText = "✅"; titleText = "Page Safe"; bubbleIcon = "🛡️";
  }

  statusCard.className = `aegis-status ${cls}`;
  icon.textContent = iconText;
  title.textContent = titleText;

  if (bubble) {
    bubble.className = cls;
    bubble.textContent = bubbleIcon;
    bubble.title = `AegisOne Protection — ${titleText}. Click to expand.`;
  }

  if (isOffline) {
    fill.style.width = "100%";
    fill.style.background = "#ef4444";
    pct.textContent = "OFFLINE";
    pct.style.color = "#ef4444";
  } else {
    const barColor = score < 20 ? "#10b981" : score < 50 ? "#fbbf24" : score < 80 ? "#f97316" : "#ef4444";
    fill.style.width = `${score}%`;
    fill.style.background = barColor;
    pct.textContent = `${score}%`;
    pct.style.color = barColor;
  }

  actions.classList.remove("hidden");
  _refreshDetailsPanel(score, top_factors, threat_type);

  // Auto-minimize expanded widget after 10 seconds of user idle
  _startAutoMinimizeTimer(10000);
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
  const mainBox = document.getElementById("aegis-widget-main");

  if (mainBox) {
    mainBox.addEventListener("mouseenter", () => clearTimeout(_autoMinimizeTimer));
    mainBox.addEventListener("mouseleave", () => _startAutoMinimizeTimer(8000));
  }

  // Listen for custom scale/opacity change events dispatched from settings or the top-right popup
  document.addEventListener("aegis:widget-opacity", (e) => {
    if (mainBox && e.detail?.opacity != null) {
      mainBox.style.background = `rgba(12, 17, 29, ${e.detail.opacity})`;
    }
  });

  document.addEventListener("aegis:widget-scale", (e) => {
    if (mainBox && e.detail?.scale != null) {
      mainBox.style.transform = `scale(${e.detail.scale})`;
      mainBox.style.transformOrigin = "top right";
    }
  });

  document.getElementById("aegis-btn-min")?.addEventListener("click", () => {
    widget.classList.add("minimized");
    document.getElementById("aegis-details-panel")?.remove();
    clearTimeout(_autoMinimizeTimer);
  });
  document.getElementById("aegis-mini-bubble")?.addEventListener("click", () => {
    widget.classList.remove("minimized");
    _startAutoMinimizeTimer(12000);
  });
  document.getElementById("aegis-btn-off")?.addEventListener("click", () => {
    window.__AEGIS_WIDGET_HIDDEN__ = true;
    document.getElementById("aegis-details-panel")?.remove();
    widget.style.setProperty("display", "none", "important");
    try {
      if (typeof chrome !== "undefined" && chrome?.storage?.local) {
        chrome.storage.local.set({ widgetVisible: false });
      }
    } catch (_) {}
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

  const isOffline = score === -1 || threat_type === "backend_offline" || threat_type === "scan_incomplete";

  if (isOffline) {
    summary = "🔴 AegisOne Backend API Offline. Contact Security Administrator to enable live AI protection.";
    main_reasons = [
      "🔴 AegisOne Backend Security API Server is disconnected or unreachable",
      "⚠️ Real-time model inference and threat scoring are currently unavailable"
    ];
    recommendations = [
      "🔌 Ensure the AegisOne backend server (unified_server.py) is started",
      "Contact your organization's IT Security Administrator for assistance"
    ];
  } else if (score >= 80) {
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
      font-family: 'Inter', -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif !important;
      font-size: 11px !important;
      user-select: none !important;
      pointer-events: none !important;
      -webkit-font-smoothing: antialiased !important;
    }
    #aegis-mini-bubble {
      display: none;
      width: 42px; height: 42px;
      background: rgba(15, 23, 42, 0.94);
      border: 1.5px solid #3b82f6;
      border-radius: 50%;
      align-items: center; justify-content: center;
      font-size: 18px;
      cursor: pointer;
      box-shadow: 0 8px 24px rgba(0,0,0,0.5), inset 0 1px 0 rgba(255,255,255,0.2);
      pointer-events: auto !important;
      backdrop-filter: blur(16px);
      transition: all 0.3s cubic-bezier(0.34, 1.56, 0.64, 1);
    }
    #aegis-mini-bubble:hover {
      transform: scale(1.1);
    }
    #aegis-mini-bubble.safe {
      border-color: #10b981 !important;
      box-shadow: 0 0 14px rgba(16, 185, 129, 0.4), 0 6px 20px rgba(0,0,0,0.5) !important;
    }
    #aegis-mini-bubble.caution {
      border-color: #fbbf24 !important;
      box-shadow: 0 0 14px rgba(251, 191, 36, 0.4), 0 6px 20px rgba(0,0,0,0.5) !important;
    }
    #aegis-mini-bubble.warning {
      border-color: #f97316 !important;
      box-shadow: 0 0 16px rgba(249, 115, 22, 0.5), 0 6px 20px rgba(0,0,0,0.5) !important;
    }
    #aegis-mini-bubble.danger {
      border-color: #ef4444 !important;
      box-shadow: 0 0 20px rgba(239, 68, 68, 0.7), 0 6px 20px rgba(0,0,0,0.5) !important;
      animation: aegis-bubble-pulse 1.5s infinite alternate !important;
    }

    @keyframes aegis-bubble-pulse {
      0% { box-shadow: 0 0 10px rgba(239, 68, 68, 0.5), 0 6px 20px rgba(0,0,0,0.5); transform: scale(1); }
      100% { box-shadow: 0 0 24px rgba(239, 68, 68, 0.8), 0 6px 20px rgba(0,0,0,0.5); transform: scale(1.06); }
    }

    #aegis-widget-v2.minimized #aegis-mini-bubble { display: flex !important; }
    #aegis-widget-v2.minimized #aegis-widget-main { display: none !important; }

    /* Scaling Classes */
    #aegis-widget-main.scale-normal {
      width: 195px !important;
      transform: scale(1.0);
      transform-origin: top right;
    }
    #aegis-widget-main.scale-compact {
      width: 175px !important;
      transform: scale(0.9);
      transform-origin: top right;
    }
    #aegis-widget-main.scale-micro {
      width: 145px !important;
      transform: scale(0.78);
      transform-origin: top right;
    }

    #aegis-widget-main {
      width: 195px !important;
      background: linear-gradient(145deg, rgba(15, 23, 42, 0.96), rgba(11, 15, 26, 0.98)) !important;
      border: 1px solid rgba(255, 255, 255, 0.12) !important;
      border-radius: 14px !important;
      overflow: hidden !important;
      box-shadow: 0 16px 40px rgba(0, 0, 0, 0.65), 0 0 0 1px rgba(255, 255, 255, 0.08) inset !important;
      backdrop-filter: blur(20px) saturate(180%) !important;
      pointer-events: auto !important;
      transition: background 0.25s, transform 0.15s !important;
    }

    #aegis-resize-handle {
      position: absolute !important;
      right: 2px !important;
      bottom: 2px !important;
      width: 8px !important;
      height: 8px !important;
      cursor: se-resize !important;
      z-index: 999999 !important;
      border-right: 2px solid rgba(255, 255, 255, 0.25) !important;
      border-bottom: 2px solid rgba(255, 255, 255, 0.25) !important;
    }

    #aegis-header {
      display: flex !important;
      align-items: center !important;
      justify-content: space-between !important;
      padding: 8px 11px !important;
      background: rgba(255, 255, 255, 0.03) !important;
      border-bottom: 1px solid rgba(255, 255, 255, 0.07) !important;
      cursor: move !important;
    }
    .aegis-brand { display: flex !important; align-items: center !important; gap: 6px !important; }
    .aegis-shield-icon { font-size: 13px !important; filter: drop-shadow(0 0 6px rgba(59, 130, 246, 0.5)); }
    .aegis-brand-name { font-weight: 700 !important; font-size: 12px !important; color: #f8fafc !important; letter-spacing: -0.2px !important; }
    .aegis-header-controls { display: flex !important; gap: 3px !important; }
    .aegis-ctrl-btn {
      background: none !important; border: none !important; color: #64748b !important;
      cursor: pointer !important; font-size: 11px !important; padding: 2px 4px !important;
      border-radius: 4px !important; line-height: 1 !important; transition: all 0.15s !important;
    }
    .aegis-ctrl-btn:hover { color: #f8fafc !important; background: rgba(255,255,255,0.1) !important; }

    #aegis-body { padding: 9px 11px !important; }

    .aegis-status {
      display: flex !important; align-items: center !important; gap: 8px !important;
      padding: 7px 9px !important; border-radius: 9px !important;
      background: rgba(255, 255, 255, 0.04) !important;
      border: 1px solid rgba(255, 255, 255, 0.08) !important;
      margin-bottom: 8px !important; transition: all 0.25s !important;
    }
    .aegis-status.safe    { border-color: rgba(16,185,129,0.3) !important; background: rgba(16,185,129,0.1) !important; }
    .aegis-status.caution { border-color: rgba(251,191,36,0.3) !important; background: rgba(251,191,36,0.1) !important; }
    .aegis-status.warning { border-color: rgba(249,115,22,0.35) !important; background: rgba(249,115,22,0.12) !important; }
    .aegis-status.danger  { border-color: rgba(239,68,68,0.4) !important; background: rgba(239,68,68,0.14) !important; }
    .aegis-status.scanning{ border-color: rgba(99,102,241,0.3) !important; background: rgba(99,102,241,0.1) !important; }

    .aegis-s-icon { font-size: 15px !important; flex-shrink: 0 !important; }
    .aegis-s-title { font-weight: 700 !important; font-size: 11.5px !important; color: #f8fafc !important; letter-spacing: -0.1px !important; }

    #aegis-risk-row {
      display: flex !important; align-items: center !important; gap: 7px !important;
      margin-bottom: 9px !important;
    }
    .aegis-risk-label { font-size: 9px !important; text-transform: uppercase !important; color: #64748b !important; font-weight: 800 !important; letter-spacing: 0.5px !important; flex-shrink: 0 !important; }
    #aegis-risk-bar-track {
      flex: 1 !important; height: 4px !important; background: rgba(255, 255, 255, 0.08) !important; border-radius: 2px !important; overflow: hidden !important;
    }
    #aegis-risk-bar-fill { height: 100% !important; border-radius: 2px !important; width: 0% !important; transition: width 0.6s ease, background 0.3s !important; }
    .aegis-risk-pct { font-size: 10.5px !important; font-weight: 800 !important; flex-shrink: 0 !important; min-width: 26px !important; text-align: right !important; }

    .aegis-actions { display: flex !important; gap: 6px !important; }
    .aegis-actions.hidden { display: none !important; }
    .aegis-btn-primary {
      flex: 1.2 !important; padding: 6px 8px !important; font-size: 10.5px !important; font-weight: 700 !important;
      background: linear-gradient(135deg, #4f46e5, #9333ea) !important;
      color: #ffffff !important; border: none !important; border-radius: 7px !important; cursor: pointer !important;
      transition: all 0.2s !important; font-family: inherit !important;
      box-shadow: 0 3px 10px rgba(124, 58, 237, 0.35) !important;
      text-align: center !important;
    }
    .aegis-btn-primary:hover { opacity: 0.92 !important; transform: translateY(-1px) !important; box-shadow: 0 4px 14px rgba(124, 58, 237, 0.5) !important; }
    .aegis-btn-secondary {
      flex: 1 !important; padding: 6px 8px !important; font-size: 10.5px !important; font-weight: 600 !important;
      background: rgba(255, 255, 255, 0.06) !important; color: #cbd5e1 !important;
      border: 1px solid rgba(255, 255, 255, 0.12) !important; border-radius: 7px !important; cursor: pointer !important;
      transition: all 0.2s !important; font-family: inherit !important;
      text-align: center !important;
    }
    .aegis-btn-secondary:hover { color: #ffffff !important; background: rgba(255, 255, 255, 0.12) !important; border-color: rgba(255, 255, 255, 0.22) !important; }
  `;
  document.head.appendChild(style);
}

if (typeof chrome !== "undefined" && chrome?.runtime?.onMessage) {
  chrome.runtime.onMessage.addListener((msg) => {
    if (msg.type === "TOGGLE_WIDGET_VISIBILITY") {
      const widget = document.getElementById(WIDGET_ID);
      if (msg.visible) {
        if (widget) {
          widget.style.setProperty("display", "block", "important");
          widget.classList.remove("minimized");
          _startAutoMinimizeTimer(10000);
        } else {
          createWidget();
        }
      } else {
        if (widget) {
          widget.style.setProperty("display", "none", "important");
        }
      }
    }
  });
}
