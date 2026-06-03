/**
 * AegisOne — Content Script (Full Edition)
 * ==========================================
 * Features:
 *  ✅ Floating always-visible shield widget (bottom-right)
 *  ✅ Red highlighting on phishing links
 *  ✅ Google Search risk score badges per result
 *  ✅ Image scan on click (colored border feedback)
 *  ✅ Gmail / Outlook email auto-detection
 *  ✅ SPA navigation support (React/Vue/Gmail)
 *  ✅ 30s heartbeat re-scan
 *  ✅ Persistent until user turns off
 */

(function () {
  if (window.self !== window.top) return;
  if (location.protocol === "chrome-extension:") return;
  if (document.getElementById("aegis-widget")) return; // already injected

  // ────────────────────────────────────────────
  // CONFIG
  // ────────────────────────────────────────────
  const PHISHING_THRESHOLD = 0.5;   // For widget verdict
  const HIGHLIGHT_THRESHOLD = 0.80;  // Only highlight links this risky (avoid false positives)
  const GOOGLE_BADGE_THRESHOLD = 0.80; // Google search badge threshold

  // Trusted domains — never flag, never scan links FROM these domains to themselves
  const TRUSTED_DOMAINS = new Set([
    "google.com", "google.com.pk", "googleapis.com", "gstatic.com",
    "youtube.com", "youtu.be",
    "microsoft.com", "office.com", "live.com", "outlook.com", "bing.com",
    "apple.com", "icloud.com",
    "amazon.com", "aws.amazon.com",
    "facebook.com", "instagram.com", "twitter.com", "x.com",
    "linkedin.com", "reddit.com", "wikipedia.org", "pinterest.com",
    "github.com", "stackoverflow.com",
    "cloudflare.com", "akamai.com",
    "paypal.com", "stripe.com",
    "netflix.com", "spotify.com",
    "dawn.com", "geo.tv", "bbc.com", "cnn.com",
    "localhost", "127.0.0.1",
  ]);

  function getRootDomain(url) {
    try {
      const h = new URL(url).hostname.toLowerCase().replace(/^www\./, "");
      // Get last two parts: maps.google.com → google.com
      const parts = h.split(".");
      return parts.slice(-2).join(".");
    } catch { return ""; }
  }

  function isTrusted(url) {
    const root = getRootDomain(url);
    return TRUSTED_DOMAINS.has(root);
  }

  function isExternalLink(url) {
    const currentRoot = getRootDomain(location.href);
    const linkRoot = getRootDomain(url);
    return linkRoot !== currentRoot && linkRoot !== "";
  }

  const WIDGET_ID = "aegis-widget";


  // ────────────────────────────────────────────
  // DEBOUNCE
  // ────────────────────────────────────────────
  function debounce(fn, ms) {
    let t;
    return (...args) => { clearTimeout(t); t = setTimeout(() => fn(...args), ms); };
  }

  // ────────────────────────────────────────────
  // INJECT STYLES
  // ────────────────────────────────────────────
  const style = document.createElement("style");
  style.textContent = `
    /* Floating Widget */
    #aegis-widget {
      position: fixed !important;
      bottom: 20px !important;
      right: 20px !important;
      z-index: 2147483647 !important;
      font-family: 'Inter', -apple-system, sans-serif !important;
      font-size: 12px !important;
      width: 220px !important;
      border-radius: 12px !important;
      overflow: hidden !important;
      box-shadow: 0 8px 32px rgba(0,0,0,0.5) !important;
      border: 1px solid #2d3548 !important;
      background: #0d1117 !important;
      color: #e2e8f0 !important;
      transition: all 0.3s ease !important;
      user-select: none !important;
    }
    #aegis-widget.minimized {
      width: 44px !important;
      height: 44px !important;
      border-radius: 50% !important;
      cursor: pointer !important;
    }
    #aegis-widget-header {
      display: flex !important;
      align-items: center !important;
      justify-content: space-between !important;
      padding: 8px 10px !important;
      background: #161b27 !important;
      border-bottom: 1px solid #2d3548 !important;
      cursor: move !important;
    }
    #aegis-widget-header .brand {
      display: flex !important;
      align-items: center !important;
      gap: 6px !important;
      font-weight: 700 !important;
      font-size: 11px !important;
    }
    #aegis-widget-controls {
      display: flex !important;
      gap: 4px !important;
    }
    #aegis-widget-controls button {
      background: none !important;
      border: none !important;
      color: #64748b !important;
      cursor: pointer !important;
      font-size: 13px !important;
      padding: 0 2px !important;
      line-height: 1 !important;
    }
    #aegis-widget-controls button:hover { color: #e2e8f0 !important; }
    #aegis-widget-body { padding: 10px !important; }
    #aegis-widget-status {
      display: flex !important;
      align-items: center !important;
      gap: 8px !important;
      padding: 8px !important;
      border-radius: 8px !important;
      background: #1a1f2e !important;
      border: 1px solid #2d3548 !important;
      margin-bottom: 8px !important;
    }
    #aegis-widget-status.safe { border-color: rgba(16,185,129,0.4) !important; background: rgba(16,185,129,0.08) !important; }
    #aegis-widget-status.warning { border-color: rgba(245,158,11,0.4) !important; background: rgba(245,158,11,0.08) !important; }
    #aegis-widget-status.danger { border-color: rgba(239,68,68,0.4) !important; background: rgba(239,68,68,0.08) !important; }
    #aegis-widget-status.scanning { border-color: rgba(99,102,241,0.4) !important; background: rgba(99,102,241,0.08) !important; }
    #aegis-status-icon { font-size: 20px !important; }
    #aegis-status-text .title { font-weight: 700 !important; font-size: 11px !important; }
    #aegis-status-text .sub { font-size: 10px !important; color: #64748b !important; margin-top: 1px !important; }
    #aegis-risk-bar-wrap { margin-bottom: 6px !important; }
    #aegis-risk-label { display: flex !important; justify-content: space-between !important; font-size: 10px !important; color: #64748b !important; margin-bottom: 3px !important; }
    #aegis-risk-bar { height: 3px !important; background: #2d3548 !important; border-radius: 2px !important; }
    #aegis-risk-fill { height: 100% !important; border-radius: 2px !important; transition: width 0.5s !important; background: #10b981 !important; }
    #aegis-threat-count { font-size: 10px !important; color: #64748b !important; text-align: center !important; }
    /* Minimized bubble */
    #aegis-mini-bubble {
      display: none !important;
      width: 44px !important;
      height: 44px !important;
      align-items: center !important;
      justify-content: center !important;
      font-size: 22px !important;
      cursor: pointer !important;
    }
    #aegis-widget.minimized #aegis-widget-header,
    #aegis-widget.minimized #aegis-widget-body { display: none !important; }
    #aegis-widget.minimized #aegis-mini-bubble { display: flex !important; }

    /* XAI Tooltip Badge */
    .aegis-score-badge {
      display: inline-flex !important;
      align-items: center !important;
      gap: 4px !important;
      font-size: 10px !important;
      font-weight: 600 !important;
      font-style: normal !important;
      text-decoration: none !important;
      padding: 2px 6px !important;
      border-radius: 12px !important;
      margin-left: 6px !important;
      vertical-align: middle !important;
      font-family: -apple-system, sans-serif !important;
      cursor: help !important;
      position: relative !important;
      transform: none !important;
    }
    .aegis-score-badge.safe { background: rgba(16,185,129,0.1) !important; color: #10b981 !important; border: 1px solid rgba(16,185,129,0.3) !important; }
    .aegis-score-badge.warning { background: rgba(245,158,11,0.1) !important; color: #f59e0b !important; border: 1px solid rgba(245,158,11,0.3) !important; }
    .aegis-score-badge.danger { background: rgba(239,68,68,0.1) !important; color: #ef4444 !important; border: 1px solid rgba(239,68,68,0.3) !important; }

    .aegis-score-badge:hover::after,
    .aegis-google-badge:hover::after {
      content: attr(data-xai) !important;
      position: absolute !important;
      bottom: 120% !important;
      left: 50% !important;
      transform: translateX(-50%) !important;
      background: #0f172a !important;
      color: #e2e8f0 !important;
      padding: 6px 10px !important;
      border-radius: 6px !important;
      font-size: 11px !important;
      white-space: nowrap !important;
      z-index: 9999 !important;
      border: 1px solid #334155 !important;
      box-shadow: 0 4px 12px rgba(0,0,0,0.5) !important;
    }

    /* Google Search Risk Badge */
    .aegis-google-badge {
      display: inline-flex !important;
      align-items: center !important;
      gap: 3px !important;
      font-size: 10px !important;
      font-weight: 600 !important;
      font-style: normal !important;
      text-decoration: none !important;
      padding: 2px 6px !important;
      border-radius: 4px !important;
      margin-left: 6px !important;
      font-family: -apple-system, sans-serif !important;
      vertical-align: middle !important;
      cursor: help !important;
      position: relative !important;
      transform: none !important;
    }
    .aegis-google-badge.safe { background: rgba(16,185,129,0.1) !important; color: #10b981 !important; border: 1px solid rgba(16,185,129,0.2) !important; }
    .aegis-google-badge.warning { background: rgba(245,158,11,0.1) !important; color: #f59e0b !important; border: 1px solid rgba(245,158,11,0.2) !important; }
    .aegis-google-badge.danger { background: rgba(239,68,68,0.1) !important; color: #ef4444 !important; border: 1px solid rgba(239,68,68,0.2) !important; }
    .aegis-google-badge.scanning { background: rgba(99,102,241,0.05) !important; color: #818cf8 !important; border: 1px solid rgba(99,102,241,0.2) !important; }
    .aegis-google-badge.verified { background: rgba(59,130,246,0.1) !important; color: #3b82f6 !important; border: 1px solid rgba(59,130,246,0.2) !important; }

    /* AegisOne XAI Modal Styles */
    #aegis-xai-modal-container {
      position: fixed !important;
      top: 0 !important;
      left: 0 !important;
      width: 100vw !important;
      height: 100vh !important;
      z-index: 2147483647 !important;
      display: flex !important;
      align-items: center !important;
      justify-content: center !important;
      font-family: 'Inter', -apple-system, sans-serif !important;
    }
    .aegis-xai-backdrop {
      position: absolute !important;
      top: 0 !important;
      left: 0 !important;
      width: 100% !important;
      height: 100% !important;
      background: rgba(10, 15, 30, 0.7) !important;
      backdrop-filter: blur(12px) !important;
      transition: all 0.3s ease !important;
    }
    .aegis-xai-modal {
      position: relative !important;
      width: 520px !important;
      max-width: 90% !important;
      background: rgba(15, 23, 42, 0.95) !important;
      border: 1px solid rgba(255, 255, 255, 0.1) !important;
      border-radius: 16px !important;
      box-shadow: 0 24px 64px rgba(0,0,0,0.8), inset 0 1px 0 rgba(255,255,255,0.1) !important;
      color: #e2e8f0 !important;
      overflow: hidden !important;
      animation: aegisModalEntrance 0.3s cubic-bezier(0.16, 1, 0.3, 1) !important;
    }
    #aegis-xai-modal-container.closing .aegis-xai-modal {
      animation: aegisModalExit 0.3s cubic-bezier(0.16, 1, 0.3, 1) !important;
    }
    #aegis-xai-modal-container.closing .aegis-xai-backdrop {
      opacity: 0 !important;
    }
    @keyframes aegisModalEntrance {
      from { opacity: 0; transform: scale(0.95) translateY(10px); }
      to { opacity: 1; transform: scale(1) translateY(0); }
    }
    @keyframes aegisModalExit {
      from { opacity: 1; transform: scale(1) translateY(0); }
      to { opacity: 0; transform: scale(0.95) translateY(10px); }
    }
    .aegis-xai-header {
      display: flex !important;
      align-items: center !important;
      justify-content: space-between !important;
      padding: 16px 20px !important;
      border-bottom: 1px solid rgba(255,255,255,0.08) !important;
      background: rgba(30, 41, 59, 0.4) !important;
    }
    .aegis-xai-logo {
      font-weight: 700 !important;
      font-size: 14px !important;
      color: #3b82f6 !important;
      letter-spacing: 0.5px !important;
    }
    .aegis-xai-close {
      background: none !important;
      border: none !important;
      color: #94a3b8 !important;
      font-size: 24px !important;
      cursor: pointer !important;
      line-height: 1 !important;
      padding: 0 !important;
    }
    .aegis-xai-close:hover { color: #f1f5f9 !important; }
    .aegis-xai-body {
      padding: 20px !important;
      max-height: 70vh !important;
      overflow-y: auto !important;
    }
    .aegis-xai-hero {
      display: flex !important;
      align-items: center !important;
      gap: 20px !important;
      margin-bottom: 24px !important;
      padding: 16px !important;
      background: rgba(30, 41, 59, 0.25) !important;
      border-radius: 12px !important;
      border: 1px solid rgba(255,255,255,0.05) !important;
    }
    .aegis-xai-gauge {
      display: flex !important;
      flex-direction: column !important;
      align-items: center !important;
      justify-content: center !important;
      width: 80px !important;
      height: 80px !important;
      border-radius: 50% !important;
      border: 4px solid !important;
    }
    .aegis-xai-percentage {
      font-size: 18px !important;
      font-weight: 800 !important;
    }
    .aegis-xai-label {
      font-size: 8px !important;
      font-weight: 700 !important;
      color: #94a3b8 !important;
      margin-top: 2px !important;
    }
    .aegis-xai-meta {
      flex: 1 !important;
      display: flex !important;
      flex-direction: column !important;
      gap: 10px !important;
    }
    .aegis-meta-item {
      display: flex !important;
      flex-direction: column !important;
    }
    .aegis-meta-item .meta-lbl {
      font-size: 9px !important;
      text-transform: uppercase !important;
      color: #64748b !important;
      font-weight: 700 !important;
    }
    .aegis-meta-item .meta-val {
      font-size: 12px !important;
      color: #e2e8f0 !important;
      word-break: break-all !important;
    }
    .aegis-meta-item .meta-val.truncate {
      max-width: 320px !important;
      white-space: nowrap !important;
      overflow: hidden !important;
      text-overflow: ellipsis !important;
    }
    .aegis-xai-section {
      margin-bottom: 20px !important;
    }
    .aegis-xai-section .section-title {
      font-size: 11px !important;
      text-transform: uppercase !important;
      color: #64748b !important;
      font-weight: 800 !important;
      margin-bottom: 8px !important;
      letter-spacing: 0.5px !important;
    }
    .aegis-xai-section .section-content {
      font-size: 12px !important;
      line-height: 1.6 !important;
      color: #cbd5e1 !important;
      background: rgba(15, 23, 42, 0.4) !important;
      padding: 12px 16px !important;
      border-radius: 8px !important;
      border: 1px solid rgba(255,255,255,0.03) !important;
    }
    .xai-tokens {
      display: flex !important;
      flex-wrap: wrap !important;
      gap: 8px !important;
      margin-top: 10px !important;
    }
    .xai-token-badge {
      display: inline-flex !important;
      align-items: center !important;
      gap: 6px !important;
      padding: 4px 10px !important;
      border-radius: 6px !important;
      border: 1px solid !important;
      font-size: 11px !important;
      font-weight: 700 !important;
    }
    .xai-weight-tag {
      font-size: 8px !important;
      text-transform: uppercase !important;
      background: rgba(255,255,255,0.15) !important;
      padding: 1px 4px !important;
      border-radius: 3px !important;
    }
    .xai-desc { font-size: 11px !important; color: #94a3b8 !important; margin: 0 0 10px 0 !important; }
    .xai-desc-neutral { font-size: 11px !important; color: #64748b !important; margin: 0 !important; font-style: italic !important; }
    .aegis-xai-footer {
      display: flex !important;
      justify-content: space-between !important;
      padding: 12px 20px !important;
      border-top: 1px solid rgba(255,255,255,0.05) !important;
      font-size: 9px !important;
      color: #475569 !important;
      background: rgba(10, 15, 30, 0.2) !important;
    }
    .capitalize { text-transform: capitalize !important; }

    /* AegisOne Warning Modal Styles */
    #aegis-warning-modal-container {
      position: fixed !important;
      top: 0 !important;
      left: 0 !important;
      width: 100vw !important;
      height: 100vh !important;
      z-index: 2147483647 !important;
      display: flex !important;
      align-items: center !important;
      justify-content: center !important;
      font-family: 'Inter', -apple-system, sans-serif !important;
    }
    .aegis-warning-backdrop {
      position: absolute !important;
      top: 0 !important;
      left: 0 !important;
      width: 100% !important;
      height: 100% !important;
      background: rgba(15, 5, 5, 0.85) !important;
      backdrop-filter: blur(14px) !important;
      transition: all 0.3s ease !important;
    }
    .aegis-warning-modal {
      position: relative !important;
      width: 480px !important;
      max-width: 90% !important;
      background: #0f0a0a !important;
      border: 1px solid rgba(239, 68, 68, 0.3) !important;
      border-radius: 16px !important;
      box-shadow: 0 24px 64px rgba(0,0,0,0.9), inset 0 1px 0 rgba(255,255,255,0.05) !important;
      color: #f1f5f9 !important;
      overflow: hidden !important;
      text-align: center !important;
      animation: aegisWarningEntrance 0.35s cubic-bezier(0.175, 0.885, 0.32, 1.275) !important;
    }
    #aegis-warning-modal-container.closing .aegis-warning-modal {
      animation: aegisModalExit 0.3s ease !important;
    }
    #aegis-warning-modal-container.closing .aegis-warning-backdrop {
      opacity: 0 !important;
    }
    @keyframes aegisWarningEntrance {
      from { opacity: 0; transform: scale(0.9) translateY(20px); }
      to { opacity: 1; transform: scale(1) translateY(0); }
    }
    .aegis-warning-header {
      padding: 16px 20px !important;
      background: rgba(239, 68, 68, 0.15) !important;
      border-bottom: 1px solid rgba(239, 68, 68, 0.25) !important;
    }
    .aegis-warning-logo {
      font-weight: 800 !important;
      font-size: 13px !important;
      color: #f87171 !important;
      text-transform: uppercase !important;
      letter-spacing: 1px !important;
    }
    .aegis-warning-body {
      padding: 24px 30px !important;
    }
    .aegis-warning-icon-wrap {
      display: inline-flex !important;
      align-items: center !important;
      justify-content: center !important;
      width: 64px !important;
      height: 64px !important;
      background: rgba(239, 68, 68, 0.1) !important;
      border-radius: 50% !important;
      border: 2px solid #ef4444 !important;
      margin-bottom: 16px !important;
      animation: aegisPulseWarning 2s infinite !important;
    }
    @keyframes aegisPulseWarning {
      0% { box-shadow: 0 0 0 0 rgba(239, 68, 68, 0.4); }
      70% { box-shadow: 0 0 0 12px rgba(239, 68, 68, 0); }
      100% { box-shadow: 0 0 0 0 rgba(239, 68, 68, 0); }
    }
    .aegis-warning-icon {
      font-size: 32px !important;
    }
    .aegis-warning-title {
      font-size: 20px !important;
      font-weight: 800 !important;
      color: #ef4444 !important;
      margin: 0 0 10px 0 !important;
    }
    .aegis-warning-desc {
      font-size: 12px !important;
      line-height: 1.6 !important;
      color: #94a3b8 !important;
      margin: 0 0 20px 0 !important;
    }
    .aegis-warning-info-card {
      background: rgba(239, 68, 68, 0.05) !important;
      border: 1px solid rgba(239, 68, 68, 0.15) !important;
      border-radius: 8px !important;
      padding: 12px 16px !important;
      margin-bottom: 20px !important;
      text-align: left !important;
    }
    .aegis-warning-info-card .info-row {
      display: flex !important;
      justify-content: space-between !important;
      font-size: 11px !important;
      margin-bottom: 6px !important;
    }
    .aegis-warning-info-card .info-row:last-child {
      margin-bottom: 0 !important;
    }
    .aegis-warning-info-card .info-row .lbl {
      color: #64748b !important;
      font-weight: 600 !important;
    }
    .aegis-warning-info-card .info-row .val {
      color: #e2e8f0 !important;
      max-width: 280px !important;
      font-weight: 500 !important;
      overflow: hidden !important;
      text-overflow: ellipsis !important;
      white-space: nowrap !important;
      display: inline-block !important;
    }
    .aegis-warning-info-card .info-row .val.danger-text {
      color: #f87171 !important;
      font-weight: 700 !important;
    }
    .aegis-warning-caution {
      font-size: 10px !important;
      color: #f87171 !important;
      font-style: italic !important;
      margin: 0 !important;
    }
    .aegis-warning-actions {
      display: flex !important;
      padding: 16px 20px !important;
      background: rgba(15, 10, 10, 0.6) !important;
      border-top: 1px solid rgba(239, 68, 68, 0.15) !important;
      gap: 12px !important;
    }
    .aegis-btn-cancel {
      flex: 1 !important;
      background: #ef4444 !important;
      color: #ffffff !important;
      border: none !important;
      padding: 10px 16px !important;
      border-radius: 8px !important;
      font-size: 12px !important;
      font-weight: 700 !important;
      cursor: pointer !important;
      transition: background 0.2s !important;
    }
    .aegis-btn-cancel:hover {
      background: #dc2626 !important;
    }
    .aegis-btn-proceed {
      background: transparent !important;
      color: #64748b !important;
      border: 1px solid rgba(255,255,255,0.08) !important;
      padding: 10px 16px !important;
      border-radius: 8px !important;
      font-size: 11px !important;
      font-weight: 600 !important;
      cursor: pointer !important;
      transition: all 0.2s !important;
    }
    .aegis-btn-proceed:hover {
      color: #e2e8f0 !important;
      border-color: rgba(255,255,255,0.2) !important;
      background: rgba(255,255,255,0.02) !important;
    }
  `;
  document.head.appendChild(style);

  // ────────────────────────────────────────────
  // FLOATING WIDGET
  // ────────────────────────────────────────────
  const widget = document.createElement("div");
  widget.id = WIDGET_ID;
  widget.innerHTML = `
    <div id="aegis-mini-bubble">🛡️</div>
    <div id="aegis-widget-header">
      <div class="brand">🛡️ AegisOne</div>
      <div id="aegis-widget-controls">
        <button id="aegis-btn-scan" title="Manual scan">🔍</button>
        <button id="aegis-btn-min" title="Minimize">—</button>
        <button id="aegis-btn-off" title="Turn off">✕</button>
      </div>
    </div>
    <div id="aegis-widget-body">
      <div id="aegis-widget-status" class="scanning">
        <div id="aegis-status-icon">🔍</div>
        <div id="aegis-status-text">
          <div class="title">Scanning...</div>
          <div class="sub" id="aegis-status-sub">Analyzing page</div>
        </div>
      </div>
      <div id="aegis-risk-bar-wrap">
        <div id="aegis-risk-label"><span>Phishing Risk</span><span id="aegis-risk-pct">—</span></div>
        <div id="aegis-risk-bar"><div id="aegis-risk-fill" style="width:0%"></div></div>
      </div>
      <div id="aegis-threat-count">Scanning links...</div>
      <div id="aegis-widget-reason" style="display:none;font-size:10px;color:#94a3b8;margin-top:6px;padding:6px 8px;background:rgba(255,255,255,0.04);border-radius:6px;border-left:2px solid #ef4444;line-height:1.5;"></div>
    </div>
  `;
  document.body.appendChild(widget);

  // Minimize/Restore
  document.getElementById("aegis-btn-min").addEventListener("click", () => {
    widget.classList.toggle("minimized");
  });
  document.getElementById("aegis-mini-bubble").addEventListener("click", () => {
    widget.classList.remove("minimized");
  });

  // Manual Scan Now button — always fresh, uses current window URL
  document.getElementById("aegis-btn-scan").addEventListener("click", async () => {
    const btn = document.getElementById("aegis-btn-scan");
    const currentUrl = window.location.href; // capture NOW, not stale closure
    const currentText = document.body?.innerText?.slice(0, 3000) || "";
    btn.textContent = "⏳";
    btn.disabled = true;
    updateWidget(null); // show scanning state
    if (!ctxOk()) { btn.textContent = "🔍"; btn.disabled = false; return; }

    // Force full rescan: URL + text + links
    lastTextLen = 0; // reset so scanPage forces a full re-scan
    await scanPage(true);

    // Also run dedicated manual scan for the modal report
    const res = await chrome.runtime.sendMessage({
      type: "MANUAL_SCAN",
      url: currentUrl,
      text: currentText,
      forceCache: true, // skip background cache
    }).catch(() => null);
    btn.textContent = "🔍";
    btn.disabled = false;
    // Prefer _lastScanData (full page context) if available, else use fresh result
    const modalData = _lastScanData || res?.result;
    if (modalData) showManualScanModal(modalData, currentUrl);
  });

  // Turn off
  document.getElementById("aegis-btn-off").addEventListener("click", () => {
    chrome.runtime.sendMessage({ type: "TOGGLE_SHIELD" });
    widget.remove();
  });

  // Draggable widget
  let dragging = false, dragX = 0, dragY = 0;
  document.getElementById("aegis-widget-header").addEventListener("mousedown", (e) => {
    dragging = true;
    dragX = e.clientX - widget.getBoundingClientRect().left;
    dragY = e.clientY - widget.getBoundingClientRect().top;
  });
  document.addEventListener("mousemove", (e) => {
    if (!dragging) return;
    widget.style.left = `${e.clientX - dragX}px`;
    widget.style.right = "auto";
    widget.style.top = `${e.clientY - dragY}px`;
    widget.style.bottom = "auto";
  });
  document.addEventListener("mouseup", () => dragging = false);

  // ────────────────────────────────────────────
  // UPDATE WIDGET UI
  // ────────────────────────────────────────────
  function updateWidget(prob, threatCount, reasons) {
    const statusEl = document.getElementById("aegis-widget-status");
    const iconEl = document.getElementById("aegis-status-icon");
    const titleEl = document.querySelector("#aegis-status-text .title");
    const subEl = document.getElementById("aegis-status-sub");
    const fillEl = document.getElementById("aegis-risk-fill");
    const pctEl = document.getElementById("aegis-risk-pct");
    const countEl = document.getElementById("aegis-threat-count");
    const reasonEl = document.getElementById("aegis-widget-reason");

    if (prob === null) {
      statusEl.className = "scanning";
      iconEl.textContent = "🔍";
      titleEl.textContent = "Scanning...";
      subEl.textContent = "Analyzing page";
      if (reasonEl) reasonEl.style.display = "none";
      return;
    }

    const pct = Math.round(prob * 100);
    let statusClass = "safe", statusIcon = "✅", statusText = "Page Safe", statusColor = "#10b981";

    if (pct >= 50) {
      statusClass = "danger"; statusIcon = "🚨"; statusText = "Phishing Detected"; statusColor = "#ef4444";
    } else if (pct >= 20) {
      statusClass = "warning"; statusIcon = "⚠️"; statusText = "Suspicious Page"; statusColor = "#f59e0b";
    }

    statusEl.className = statusClass;
    iconEl.textContent = statusIcon;
    titleEl.textContent = statusText;
    titleEl.style.color = statusColor;
    subEl.textContent = `${pct}% Risk`;
    fillEl.style.width = `${pct}%`;
    fillEl.style.background = pct < 20 ? "#10b981" : pct < 50 ? "#f59e0b" : "#ef4444";
    pctEl.textContent = `${pct}%`;

    if (threatCount !== undefined) {
      countEl.textContent = threatCount > 0
        ? `⚠️ ${threatCount} malicious link${threatCount > 1 ? "s" : ""} found`
        : "✓ All links safe";
      countEl.style.color = threatCount > 0 ? "#ef4444" : "#10b981";
    }

    // Show WHY in widget if phishing + reasons available
    if (reasonEl) {
      if (pct >= 20 && reasons && reasons.length > 0) {
        reasonEl.innerHTML = `<b>Why?</b> ${reasons.slice(0, 2).map(r => `• ${r}`).join("<br>")}`;
        reasonEl.style.display = "block";
        reasonEl.style.borderLeftColor = statusColor;
      } else {
        reasonEl.style.display = "none";
      }
    }
  }

  // ────────────────────────────────────────────
  // BADGE STYLING PROTECTION (Anti-Rotation / Anti-Mirror)
  // ────────────────────────────────────────────
  function applyBadgeProtection(badge) {
    badge.style.setProperty("transform", "none", "important");
    badge.style.setProperty("scale", "none", "important");
    badge.style.setProperty("rotate", "none", "important");
    badge.style.setProperty("direction", "ltr", "important");
    badge.style.setProperty("unicode-bidi", "normal", "important");
    badge.style.setProperty("display", "inline-flex", "important");
    badge.style.setProperty("writing-mode", "horizontal-tb", "important");
  }

  // ────────────────────────────────────────────
  // ADD SMALL BADGE NEXT TO PHISHING LINKS (XAI)
  // ────────────────────────────────────────────
  function highlightPhishingLinks(maliciousUrlsInfo) {
    if (!maliciousUrlsInfo || maliciousUrlsInfo.length === 0) return;

    // Map URL to its info
    const malMap = new Map();
    maliciousUrlsInfo.forEach(info => malMap.set(info.url.toLowerCase(), info));

    document.querySelectorAll("a[href]").forEach((el) => {
      try {
        const url = new URL(el.href, location.href).href.toLowerCase();
        if (malMap.has(url) && !el.dataset.aegisMarked) {
          el.dataset.aegisMarked = "1";
          const info = malMap.get(url);
          const risk = Math.round((info.phishing_probability || 0) * 100);

          // Light red tint on the link itself so it's visually obvious
          el.style.setProperty("background", "rgba(239,68,68,0.15)", "important");
          el.style.setProperty("outline", "1px solid rgba(239,68,68,0.5)", "important");
          el.style.setProperty("border-radius", "3px", "important");
          el.style.setProperty("padding", "1px 4px", "important");
          el.style.setProperty("text-decoration", "underline wavy #ef4444", "important");

          // Badge next to link
          const badge = document.createElement("strong");
          badge.className = "aegis-score-badge danger";
          badge.innerHTML = `🚨 ${risk}% Risk`;
          applyBadgeProtection(badge);

          let reason = info.explanation || "AI detected suspicious URL patterns";
          if (!info.explanation) {
            if (info.category === "malware") reason = "AI detected potential malware delivery";
            if (info.category === "defacement") reason = "AI detected possible site defacement";
          }
          badge.setAttribute("data-xai", reason);
          badge.style.cursor = "pointer";
          badge.dataset.url = info.url || el.href;
          badge.dataset.score = risk;
          badge.dataset.category = info.category || "unknown";
          badge.dataset.explanation = reason;
          badge.dataset.xaiWords = JSON.stringify(info.xai_words || []);

          el.insertAdjacentElement("afterend", badge);
        }
      } catch { }
    });
  }

  // ────────────────────────────────────────────
  // GOOGLE SEARCH INTEGRATION
  // ────────────────────────────────────────────
  const IS_GOOGLE_SEARCH = location.hostname.includes("google.") &&
    location.pathname === "/search";

  function injectGoogleBadges() {
    if (!IS_GOOGLE_SEARCH) return;

    // Select all links in the main search results container
    const links = Array.from(document.querySelectorAll("#search a[href]"));

    // Filter unscored ones containing heading elements or within result blocks
    const targets = [];
    const seenUrls = new Set();

    for (const linkEl of links) {
      if (linkEl.dataset.aegisScored) continue;

      const hasHeading = linkEl.querySelector("h3, [role='heading']") !== null || linkEl.closest(".g") !== null;
      if (!hasHeading) continue;

      let url;
      try { url = new URL(linkEl.href).href; } catch { continue; }
      if (!url.startsWith("http")) continue;

      // De-duplicate URLs on the same page load
      const urlKey = url.toLowerCase();
      if (seenUrls.has(urlKey)) continue;
      seenUrls.add(urlKey);

      targets.push({ linkEl, url });
    }

    // Limit scanning to at most 10 results at a time to prevent performance lag
    const limitedTargets = targets.slice(0, 10);

    limitedTargets.forEach(async ({ linkEl, url }) => {
      linkEl.dataset.aegisScored = "1";

      const targetEl = linkEl.querySelector("h3, [role='heading']") || linkEl;

      // If it's a trusted domain, mark as verified safe immediately
      if (isTrusted(url)) {
        const badge = document.createElement("strong");
        badge.className = "aegis-google-badge verified";
        badge.innerHTML = "🛡️ Verified Safe";
        badge.style.cursor = "pointer";
        badge.title = "Known trusted organization";
        applyBadgeProtection(badge);

        badge.dataset.url = url;
        badge.dataset.score = "0";
        badge.dataset.category = "benign";
        badge.dataset.explanation = "AI verified URL matches trusted domain structure";
        badge.dataset.xaiWords = JSON.stringify([]);

        targetEl.appendChild(badge);
        return;
      }

      // Add scanning badge
      const badge = document.createElement("strong");
      badge.className = "aegis-google-badge scanning";
      badge.textContent = "🔍 Scanning";
      applyBadgeProtection(badge);
      targetEl.appendChild(badge);

      // Send to background for scanning
      try {
        const response = await chrome.runtime.sendMessage({
          type: "SCAN_SINGLE_URL",
          url,
        });
        if (!response?.result) {
          badge.remove();
          return;
        }

        const prob = response.result.phishing_probability ?? 0;
        const pct = Math.round(prob * 100);

        let badgeClass = "safe";
        let statusEmoji = "🛡️";
        if (pct >= 50) {
          badgeClass = "danger";
          statusEmoji = "🚨";
        } else if (pct >= 20) {
          badgeClass = "warning";
          statusEmoji = "⚠️";
        }

        badge.className = `aegis-google-badge ${badgeClass}`;
        badge.textContent = `${statusEmoji} ${pct}% Risk`;
        applyBadgeProtection(badge);

        // Add XAI Tooltip dynamically from backend explanation or category fallback
        let reason = response.result.explanation || "AI detected suspicious URL patterns";
        if (!response.result.explanation && response.result.category === "malware") {
          reason = "AI detected potential malware delivery";
        }
        badge.setAttribute("data-xai", reason);
        badge.style.cursor = "pointer";
        badge.title = reason; // fallback tooltip

        // Save metadata for deep XAI report modal
        badge.dataset.url = url;
        badge.dataset.score = pct;
        badge.dataset.category = response.result.category || "unknown";
        badge.dataset.explanation = reason;
        badge.dataset.xaiWords = JSON.stringify(response.result.xai_words || []);
      } catch {
        badge.remove();
      }
    });
  }

  // ────────────────────────────────────────────
  // IMAGE CLICK SCANNING
  // ────────────────────────────────────────────
  function attachImageListeners() {
    document.querySelectorAll("img").forEach((img) => {
      if (img.dataset.aegisRegistered) return;
      img.dataset.aegisRegistered = "1";
      img.style.cursor = "pointer";

      img.addEventListener("click", async (e) => {
        const src = img.src || img.currentSrc;
        if (!src || src.startsWith("data:")) return;

        img.style.outline = "3px solid #6366f1";
        img.title = "⏳ AegisOne: Scanning...";

        try {
          const res = await fetch(src, { mode: "cors" });
          const blob = await res.blob();
          if (!blob.type.startsWith("image/")) return;
          const reader = new FileReader();
          reader.onload = () => {
            chrome.runtime.sendMessage({
              type: "IMAGE_DATA",
              src,
              dataUrl: reader.result,
              mimeType: blob.type,
            }).catch(() => { });
          };
          reader.readAsDataURL(blob);
        } catch {
          chrome.runtime.sendMessage({ type: "IMAGE_URL_FALLBACK", src }).catch(() => { });
        }
      }, { capture: true });
    });
  }

  // Auto-scan all visible images on page (beyond just click)
  const _scannedImgSrcs = new Set();
  function autoScanImages() {
    document.querySelectorAll("img[src]").forEach((img) => {
      const src = img.src || img.currentSrc;
      if (!src || src.startsWith("data:") || _scannedImgSrcs.has(src)) return;
      if (img.naturalWidth < 100 || img.naturalHeight < 30) return; // skip tiny icons/spacers
      _scannedImgSrcs.add(src);
      // Use URL fallback scan (no CORS issues) — covers all images automatically
      chrome.runtime.sendMessage({ type: "IMAGE_URL_FALLBACK", src }).catch(() => {});
    });
  }

  // ────────────────────────────────────────────
  // LISTEN FOR IMAGE RESULTS
  // ────────────────────────────────────────────
  chrome.runtime.onMessage.addListener((msg) => {
    if (msg.type === "IMAGE_RESULT") {
      const img = document.querySelector(`img[src="${msg.src}"]`);
      if (!img) return;
      const isPhish = (msg.result?.phishing_probability ?? 0) > PHISHING_THRESHOLD;
      img.style.outline = `3px solid ${isPhish ? "#ef4444" : "#10b981"}`;
      img.title = isPhish
        ? `🚨 AegisOne: Phishing Image! ${(msg.result.phishing_probability * 100).toFixed(0)}% risk`
        : `✅ AegisOne: Safe image`;
    }
  });

  // ────────────────────────────────────────────
  // TEXT EXTRACTION
  // ────────────────────────────────────────────
  function extractText() {
    const skip = new Set(["SCRIPT", "STYLE", "NOSCRIPT", "HEADER", "NAV", "FOOTER", "ASIDE"]);
    let text = "";
    function walk(node) {
      if (node.nodeType === Node.TEXT_NODE) {
        const t = node.textContent.trim();
        if (t.length > 2) text += t + " ";
      } else if (node.nodeType === Node.ELEMENT_NODE && !skip.has(node.tagName)) {
        node.childNodes.forEach(walk);
      }
    }
    if (document.body) walk(document.body);
    return text.replace(/\s+/g, " ").trim();
  }

  function extractLinks() {
    const links = new Set();
    document.querySelectorAll("a[href]").forEach((el) => {
      try {
        const url = new URL(el.href, location.href).href;
        // ONLY extract HTTP, NOT trusted, and MUST be external link
        if (url.startsWith("http") && !isTrusted(url) && isExternalLink(url)) {
          links.add(url);
        }
      } catch { }
    });
    return [...links];
  }

  // ────────────────────────────────────────────
  // EMAIL EXTRACTION (Gmail / Outlook)
  // ────────────────────────────────────────────
  function extractGmailEmail() {
    const bodyEl = document.querySelector(".a3s.aiL");
    if (!bodyEl || bodyEl.innerText.length < 30) return null;
    return {
      sender: document.querySelector(".gD")?.getAttribute("email") || "",
      subject: document.querySelector(".hP")?.textContent || document.title,
      body: bodyEl.innerText,
    };
  }
  function extractOutlookEmail() {
    const bodyEl = document.querySelector('[aria-label="Message body"]');
    if (!bodyEl || bodyEl.innerText.length < 30) return null;
    return {
      sender: document.querySelector('[class*="sender"]')?.textContent || "",
      subject: document.querySelector('[class*="subject"]')?.textContent || "",
      body: bodyEl.innerText,
    };
  }

  // Guard: stop scanning if extension was reloaded/invalidated
  const ctxOk = () => { try { return !!chrome.runtime.id; } catch { return false; } };

  // ────────────────────────────────────────────
  // MAIN PAGE SCAN
  // ────────────────────────────────────────────
  let lastTextLen = 0;
  let _lastScanData = null; // stores last full scan result for manual scan modal

  async function scanPage(force = false) {
    if (!ctxOk()) return;
    const host = location.hostname;

    let emailData = null;
    if (host.includes("mail.google.com")) emailData = extractGmailEmail();
    else if (host.includes("outlook.") || host.includes("office.com")) emailData = extractOutlookEmail();

    if (emailData?.body?.length > 30) {
      const res = await chrome.runtime.sendMessage({ type: "EMAIL_DATA", ...emailData }).catch(() => null);
      if (res?.result) updateWidget(res.result.phishing_probability, 0);
      attachImageListeners();
      return;
    }

    const text = extractText();
    const urls = extractLinks();
    if ((text.length > 50 || urls.length > 0) && (Math.abs(text.length - lastTextLen) > 80 || force)) {
      lastTextLen = text.length;
      const res = await chrome.runtime.sendMessage({
        type: "PAGE_DATA",
        text: text.slice(0, 3000),
        urls,
        pageUrl: location.href,
        pageTitle: document.title,
      }).catch(() => null);

      if (res?.results) {
          const urlResults = res.results.urls || [];
          let textProb = res.results.text?.phishing_probability ?? 0;
          const textWords = res.results.text?.top_words || res.results.text?.phishing_signals || [];
          if (isTrusted(location.href) || textProb < 0.85) textProb = 0;

          const worstUrl = urlResults.length > 0
            ? Math.max(...urlResults.map(u => u.phishing_probability ?? 0)) : 0;
          const malicious = urlResults.filter(u => (u.phishing_probability ?? 0) >= HIGHLIGHT_THRESHOLD);

          const reasons = [
            ...textWords.slice(0, 2).map(w => `Suspicious keyword: "${w}"`),
            ...malicious.flatMap(u => u.phishing_signals || []).slice(0, 2),
          ].filter(Boolean);

          // Store full scan data for manual scan modal (XAI)
          _lastScanData = {
            phishing_probability: Math.max(textProb, worstUrl),
            prediction: Math.max(textProb, worstUrl) >= 0.5 ? "phishing" : "benign",
            category: malicious[0]?.category || res.results.text?.prediction || "url",
            explanation: malicious[0]?.explanation || res.results.text?.explanation || "",
            xai_words: malicious[0]?.xai_words || [],
            top_words: textWords,
            phishing_signals: reasons,
            url_results: urlResults,
          };

          updateWidget(Math.max(textProb, worstUrl), malicious.length, reasons);
          highlightPhishingLinks(malicious);
        }
    }

    if (IS_GOOGLE_SEARCH) injectGoogleBadges();
    attachImageListeners();
    autoScanImages();
  }

  const debouncedScan = debounce(scanPage, 2000);

  if (document.readyState === "complete") scanPage(true);
  else window.addEventListener("load", () => scanPage(true));

  // Make widget status area clickable — opens full XAI report
  document.getElementById("aegis-widget-status").style.cursor = "pointer";
  document.getElementById("aegis-widget-status").addEventListener("click", () => {
    if (_lastScanData) showManualScanModal(_lastScanData, window.location.href);
  });

  let lastUrl = location.href;
  const observer = new MutationObserver(debounce(() => {
    if (!ctxOk()) { observer.disconnect(); return; }
    if (location.href !== lastUrl) {
      lastUrl = location.href; lastTextLen = 0; _lastScanData = null;
      updateWidget(null);
      setTimeout(() => scanPage(true), 1500);
    } else {
      debouncedScan();
      if (IS_GOOGLE_SEARCH) injectGoogleBadges();
    }
    attachImageListeners();
  }, 1500));
  observer.observe(document.documentElement, { childList: true, subtree: true });

  const hb = setInterval(() => { if (!ctxOk()) { clearInterval(hb); return; } debouncedScan(); }, 30000);


  // ────────────────────────────────────────────
  // MANUAL SCAN RESULT MODAL (XAI)
  // ────────────────────────────────────────────
  function showManualScanModal(result, url) {
    document.getElementById("aegis-manual-scan-modal")?.remove();

    const riskPct = Math.round((result.phishing_probability ?? 0) * 100);
    const isPhish = riskPct >= 50;
    const isSusp = riskPct >= 20;
    const color = isPhish ? "#ef4444" : isSusp ? "#f97316" : "#10b981";
    const icon = isPhish ? "🚨" : isSusp ? "⚠️" : "✅";
    const verdict = isPhish ? "Phishing Detected" : isSusp ? "Suspicious" : "Safe";
    const category = result.category || result.prediction || "unknown";

    // XAI: keywords from model attention
    const xaiWords = result.xai_words || result.top_words || [];
    const signals = result.phishing_signals || result.phishing_signals || [];
    const explanation = result.explanation || (isPhish
      ? "The AI model detected multiple patterns consistent with phishing attacks."
      : isSusp ? "Some suspicious patterns were found. Exercise caution."
      : "No significant phishing indicators were detected on this page.");

    const wordsHtml = xaiWords.length > 0
      ? xaiWords.slice(0, 8).map((w, i) => `
          <span style="display:inline-flex;align-items:center;gap:4px;
            background:${color}18;border:1px solid ${color}44;color:${color};
            border-radius:20px;padding:3px 10px;font-size:11px;font-weight:700;
            opacity:${Math.max(0.4, 1 - i * 0.1)}">
            ${w} <span style="font-size:9px;opacity:0.7">#${i+1}</span>
          </span>`).join("")
      : `<span style="color:#64748b;font-size:11px;">No specific keywords flagged</span>`;

    const signalsHtml = signals.length > 0
      ? signals.map(s => `<li style="margin-bottom:4px;color:#e2e8f0;">⚠ ${s}</li>`).join("")
      : `<li style="color:#10b981;">✓ No threat signals detected</li>`;

    const container = document.createElement("div");
    container.id = "aegis-manual-scan-modal";
    container.innerHTML = `
      <div style="position:fixed;inset:0;z-index:2147483647;display:flex;align-items:center;justify-content:center;font-family:'Inter',sans-serif;">
        <div style="position:absolute;inset:0;background:rgba(0,0,0,0.75);backdrop-filter:blur(10px);" id="aegis-msm-backdrop"></div>
        <div style="position:relative;width:500px;max-width:94vw;max-height:88vh;overflow-y:auto;
          background:#0d0d0d;border:1px solid ${color}44;border-radius:16px;
          box-shadow:0 24px 64px rgba(0,0,0,0.9);">

          <!-- Header -->
          <div style="display:flex;align-items:center;justify-content:space-between;
            padding:14px 18px;background:${color}12;border-bottom:1px solid ${color}25;">
            <span style="font-weight:800;font-size:13px;color:${color};letter-spacing:0.5px;">🛡️ AegisOne — Manual Scan Report</span>
            <button id="aegis-msm-close" style="background:none;border:none;color:#64748b;font-size:20px;cursor:pointer;padding:0;">✕</button>
          </div>

          <!-- Risk Gauge + Verdict -->
          <div style="display:flex;align-items:center;gap:20px;padding:20px 20px 12px;">
            <div style="position:relative;width:84px;height:84px;flex-shrink:0;">
              <svg viewBox="0 0 84 84" style="width:84px;height:84px;position:absolute;top:0;left:0;">
                <circle cx="42" cy="42" r="36" fill="none" stroke="${color}18" stroke-width="8"/>
                <circle cx="42" cy="42" r="36" fill="none" stroke="${color}" stroke-width="8"
                  stroke-dasharray="${Math.round(2*Math.PI*36*riskPct/100)} 999"
                  stroke-linecap="round" transform="rotate(-90 42 42)"/>
              </svg>
              <div style="position:absolute;inset:0;display:flex;flex-direction:column;align-items:center;justify-content:center;">
                <span style="font-size:18px;font-weight:900;color:${color};">${riskPct}%</span>
                <span style="font-size:8px;color:#64748b;letter-spacing:1px;">RISK</span>
              </div>
            </div>
            <div>
              <div style="font-size:22px;font-weight:900;color:${color};">${icon} ${verdict}</div>
              <div style="font-size:11px;color:#64748b;margin-top:2px;">Category: <b style="color:#e2e8f0;">${category}</b></div>
              <div style="font-size:11px;color:#64748b;margin-top:2px;">Source: <span style="color:#94a3b8;">${url.slice(0,55)}${url.length>55?"...":""}</span></div>
            </div>
          </div>

          <!-- AI Explanation -->
          <div style="padding:0 20px 12px;">
            <div style="font-size:10px;font-weight:700;color:#64748b;letter-spacing:1px;margin-bottom:6px;">🔍 AI VERDICT</div>
            <div style="font-size:12px;color:#cbd5e1;line-height:1.6;background:${color}08;border-left:3px solid ${color}55;border-radius:0 6px 6px 0;padding:10px 12px;">
              ${explanation}
            </div>
          </div>

          <!-- Neural Attention Keywords -->
          <div style="padding:0 20px 12px;">
            <div style="font-size:10px;font-weight:700;color:#64748b;letter-spacing:1px;margin-bottom:8px;">🧠 NEURAL ATTENTION — TOP FEATURES (DistilBERT)</div>
            <div style="display:flex;flex-wrap:wrap;gap:6px;">${wordsHtml}</div>
          </div>

          <!-- Threat Signals -->
          <div style="padding:0 20px 16px;">
            <div style="font-size:10px;font-weight:700;color:#64748b;letter-spacing:1px;margin-bottom:6px;">⚡ HEURISTIC SIGNALS</div>
            <ul style="margin:0;padding:0 0 0 4px;list-style:none;font-size:11px;line-height:1.8;">${signalsHtml}</ul>
          </div>

          <!-- Footer -->
          <div style="padding:10px 20px;border-top:1px solid rgba(255,255,255,0.06);
            display:flex;justify-content:space-between;font-size:9px;color:#475569;">
            <span>Model: DistilBERT (LoRA) + Feature MLP</span>
            <span>AegisOne v3.0</span>
          </div>
        </div>
      </div>
    `;
    document.body.appendChild(container);
    const close = () => container.remove();
    container.querySelector("#aegis-msm-close").addEventListener("click", close);
    container.querySelector("#aegis-msm-backdrop").addEventListener("click", close);
    document.addEventListener("keydown", (e) => { if (e.key === "Escape") close(); }, { once: true });
  }

  // ────────────────────────────────────────────
  // INTERACTIVE XAI MODAL REPORT
  // ────────────────────────────────────────────
  function showXaiReportModal(url, score, category, explanation, xaiWords) {
    const existing = document.getElementById("aegis-xai-modal-container");
    if (existing) existing.remove();

    const container = document.createElement("div");
    container.id = "aegis-xai-modal-container";

    // Theme configurations
    let themeColor = "#10b981"; // safe green
    let themeBg = "rgba(16, 185, 129, 0.08)";
    if (score >= 50) {
      themeColor = "#ef4444"; // danger red
      themeBg = "rgba(239, 68, 68, 0.08)";
    } else if (score >= 20) {
      themeColor = "#f59e0b"; // warning yellow
      themeBg = "rgba(245, 158, 11, 0.08)";
    } else if (category === "benign") {
      themeColor = "#3b82f6"; // verified blue
      themeBg = "rgba(59, 130, 246, 0.08)";
    }

    const modalHtml = `
      <div class="aegis-xai-backdrop"></div>
      <div class="aegis-xai-modal">
        <div class="aegis-xai-header">
          <div class="aegis-xai-logo">🛡️ AegisOne Deep XAI Report</div>
          <button class="aegis-xai-close">&times;</button>
        </div>
        <div class="aegis-xai-body">
          <div class="aegis-xai-hero">
            <div class="aegis-xai-gauge" style="border-color: ${themeColor}; background: ${themeBg}">
              <span class="aegis-xai-percentage" style="color: ${themeColor}">${score}%</span>
              <span class="aegis-xai-label">RISK SCORE</span>
            </div>
            <div class="aegis-xai-meta">
              <div class="aegis-meta-item">
                <span class="meta-lbl">Target URL</span>
                <span class="meta-val truncate" title="${url}">${url}</span>
              </div>
              <div class="aegis-meta-item">
                <span class="meta-lbl">Classification Category</span>
                <span class="meta-val capitalize" style="color: ${themeColor}; font-weight: 700;">${category}</span>
              </div>
            </div>
          </div>
          
          <div class="aegis-xai-section">
            <div class="section-title">🔍 Heuristic Analysis Verdict</div>
            <div class="section-content">${explanation.split(" | ")[0]}</div>
          </div>

          <div class="aegis-xai-section">
            <div class="section-title">🧠 Neural Attention Heatmap (DistilBERT Layer 6)</div>
            <div class="section-content">
              ${xaiWords && xaiWords.length > 0
        ? `<p class="xai-desc">The model's classification decision was heavily weighted by the presence of these key semantic features in the URL structure:</p>
                   <div class="xai-tokens">
                     ${xaiWords.map((word, i) => `
                       <span class="xai-token-badge" style="opacity: ${1.0 - (i * 0.15)}; background: ${themeColor}15; border-color: ${themeColor}44; color: ${themeColor}">
                         ${word} <span class="xai-weight-tag">Rank #${i + 1}</span>
                       </span>
                     `).join("")}
                   </div>`
        : `<p class="xai-desc-neutral">No highly anomaly-correlated NLP features triggered this evaluation. The URL classification relies on standard layout verification.</p>`
      }
            </div>
          </div>
        </div>
        <div class="aegis-xai-footer">
          <span>Model Architecture: DistilBERT (LoRA) + Feature MLP Hybrid</span>
          <span>AegisOne Framework v3.0</span>
        </div>
      </div>
    `;

    container.innerHTML = modalHtml;
    document.body.appendChild(container);

    const closeBtn = container.querySelector(".aegis-xai-close");
    const backdrop = container.querySelector(".aegis-xai-backdrop");

    const closeModal = () => {
      container.classList.add("closing");
      setTimeout(() => container.remove(), 300);
    };

    closeBtn.addEventListener("click", closeModal);
    backdrop.addEventListener("click", closeModal);
  }

  // Intercept badge clicks to display XAI details dialog
  document.addEventListener("click", (e) => {
    const badge = e.target.closest(".aegis-google-badge, .aegis-score-badge");
    if (badge && badge.dataset.url) {
      e.preventDefault();
      e.stopPropagation();

      const url = badge.dataset.url;
      const score = parseInt(badge.dataset.score || "0", 10);
      const category = badge.dataset.category || "unknown";
      const explanation = badge.dataset.explanation || "";
      let xaiWords = [];
      try {
        xaiWords = JSON.parse(badge.dataset.xaiWords || "[]");
      } catch { }

      showXaiReportModal(url, score, category, explanation, xaiWords);
    }
  }, { capture: true });

  // ────────────────────────────────────────────
  // INTERACTIVE MALICIOUS ATTACHMENT WARNING
  // ────────────────────────────────────────────
  function showDownloadWarningModal(downloadId, filename, risk, url) {
    const existing = document.getElementById("aegis-warning-modal-container");
    if (existing) existing.remove();

    const container = document.createElement("div");
    container.id = "aegis-warning-modal-container";

    // Truncate long texts for visual aesthetic and responsiveness
    const displayFilename = filename.length > 35 ? filename.slice(0, 32) + "..." : filename;
    const displayUrl = url.length > 50 ? url.slice(0, 47) + "..." : url;

    const modalHtml = `
      <div class="aegis-warning-backdrop"></div>
      <div class="aegis-warning-modal">
        <div class="aegis-warning-header">
          <div class="aegis-warning-logo">🚨 AegisOne Threat Shield Alert</div>
        </div>
        <div class="aegis-warning-body">
          <div class="aegis-warning-icon-wrap">
            <span class="aegis-warning-icon">⚠️</span>
          </div>
          <h2 class="aegis-warning-title">Dangerous File Download Blocked</h2>
          <p class="aegis-warning-desc">
            AegisOne deep analysis has flagged this attachment as containing potential malware macros or credential harvesting vectors.
          </p>
          
          <div class="aegis-warning-info-card">
            <div class="info-row">
              <span class="lbl">File Name:</span>
              <span class="val truncate" title="${filename}">${displayFilename}</span>
            </div>
            <div class="info-row">
              <span class="lbl">Source URL:</span>
              <span class="val truncate" title="${url}">${displayUrl}</span>
            </div>
            <div class="info-row">
              <span class="lbl">Phishing Risk:</span>
              <span class="val danger-text">${Math.round(risk * 100)}% Risk</span>
            </div>
          </div>
          
          <p class="aegis-warning-caution">
            Warning: Proceeding may compromise your system, execute malicious macros, or harvest sensitive credentials.
          </p>
        </div>
        <div class="aegis-warning-actions">
          <button class="aegis-btn-cancel">Secure System (Cancel Download)</button>
          <button class="aegis-btn-proceed">Proceed Anyway (Unsafe)</button>
        </div>
      </div>
    `;

    container.innerHTML = modalHtml;
    document.body.appendChild(container);

    const cancelBtn = container.querySelector(".aegis-btn-cancel");
    const proceedBtn = container.querySelector(".aegis-btn-proceed");

    const closeModal = () => {
      container.classList.add("closing");
      setTimeout(() => container.remove(), 300);
    };

    cancelBtn.addEventListener("click", () => {
      chrome.runtime.sendMessage({ type: "DOWNLOAD_DECISION", downloadId, action: "cancel" });
      closeModal();
    });

    proceedBtn.addEventListener("click", () => {
      chrome.runtime.sendMessage({ type: "DOWNLOAD_DECISION", downloadId, action: "resume" });
      closeModal();
    });
  }

  // ────────────────────────────────────────────
  // HIGHLIGHT THREATS ON PAGE
  // ────────────────────────────────────────────
  function highlightMaliciousLinks(maliciousUrls) {
    if (!maliciousUrls || maliciousUrls.length === 0) return;
    const urlSet = new Set(maliciousUrls);
    document.querySelectorAll("a[href]").forEach((anchor) => {
      try {
        if (!urlSet.has(anchor.href) || anchor.dataset.aegisHighlighted) return;
        anchor.dataset.aegisHighlighted = "1";
        // Soft red tint + wavy underline — visible but not overwhelming
        anchor.style.setProperty("background", "rgba(239,68,68,0.15)", "important");
        anchor.style.setProperty("outline", "1px solid rgba(239,68,68,0.5)", "important");
        anchor.style.setProperty("border-radius", "3px", "important");
        anchor.style.setProperty("padding", "1px 4px", "important");
        anchor.style.setProperty("text-decoration", "underline wavy #ef4444", "important");
        const badge = document.createElement("span");
        badge.textContent = " ⛔";
        badge.title = "AegisOne: Phishing link detected";
        badge.style.cssText = "font-size:12px;pointer-events:none;";
        anchor.appendChild(badge);
      } catch { }
    });
  }

  function showPageThreatBanner(type, risk, signals) {
    const bannerId = `aegis-threat-banner-${type}`;
    if (document.getElementById(bannerId)) return; // already shown

    const riskPct = Math.round((risk || 0) * 100);
    const signalText = signals && signals.length > 0
      ? signals.slice(0, 3).join(" · ")
      : "Suspicious content detected";

    const icon = type === "email" ? "📧" : "📄";
    const label = type === "email" ? "Phishing Email Detected" : "Page Text Flagged as Phishing";
    const color = riskPct >= 80 ? "#ef4444" : "#f97316";

    const banner = document.createElement("div");
    banner.id = bannerId;
    banner.innerHTML = `
      <div style="
        position: fixed !important;
        top: 16px !important;
        right: 16px !important;
        z-index: 2147483647 !important;
        background: #0f0a0a !important;
        border: 1px solid ${color} !important;
        border-left: 4px solid ${color} !important;
        border-radius: 10px !important;
        padding: 12px 16px !important;
        min-width: 280px !important;
        max-width: 360px !important;
        font-family: 'Inter', sans-serif !important;
        box-shadow: 0 8px 32px rgba(0,0,0,0.8) !important;
        animation: aegisBannerIn 0.4s ease !important;
        display: flex !important;
        gap: 12px !important;
        align-items: flex-start !important;
      ">
        <span style="font-size:22px;flex-shrink:0;">${icon}</span>
        <div style="flex:1;">
          <div style="font-weight:800;font-size:12px;color:${color};margin-bottom:3px;">⚠️ AegisOne — ${label}</div>
          <div style="font-size:11px;color:#94a3b8;margin-bottom:6px;">${signalText}</div>
          <div style="font-size:12px;font-weight:700;color:${color};">${riskPct}% Phishing Risk</div>
        </div>
        <button id="${bannerId}-close" style="
          background:none;border:none;color:#64748b;cursor:pointer;
          font-size:16px;padding:0;line-height:1;flex-shrink:0;
        ">✕</button>
      </div>
    `;
    document.body.appendChild(banner);

    banner.querySelector(`#${bannerId}-close`).addEventListener("click", () => {
      banner.remove();
    });

    // Auto-remove after 8 seconds
    setTimeout(() => { if (banner.parentNode) banner.remove(); }, 8000);
  }

  // Unified message listener from background.js
  chrome.runtime.onMessage.addListener((msg) => {
    if (msg.type === "PROMPT_DOWNLOAD_DECISION") {
      showDownloadWarningModal(
        msg.downloadId,
        msg.filename,
        msg.risk,
        msg.url,
        msg.signals || []
      );
    }

    if (msg.type === "HIGHLIGHT_THREATS") {
      // Highlight malicious links on the page
      if (msg.maliciousUrls && msg.maliciousUrls.length > 0) {
        highlightMaliciousLinks(msg.maliciousUrls);
      }
      // Show text phishing banner
      if (msg.textPhishing) {
        showPageThreatBanner("text", msg.textRisk, msg.textSignals);
      }
      // Show email phishing banner
      if (msg.emailPhishing) {
        showPageThreatBanner("email", msg.emailRisk, msg.emailSignals);
      }
    }

    if (msg.type === "DOCUMENT_SCAN_RESULT") {
      const riskPct = Math.round((msg.risk || 0) * 100);
      const color = msg.isPhishing ? "#ef4444" : "#10b981";
      const icon = msg.isPhishing ? "🚨" : "✅";
      const label = msg.isPhishing ? `Phishing Document — ${riskPct}% Risk` : `Document Safe — ${riskPct}% Risk`;
      const signalText = msg.signals?.length > 0 ? msg.signals.slice(0, 3).join(" · ") : (msg.isPhishing ? "Malicious content detected" : "No threats found");

      const bannerId = "aegis-doc-scan-banner";
      document.getElementById(bannerId)?.remove();
      const banner = document.createElement("div");
      banner.id = bannerId;
      banner.innerHTML = `
        <div style="
          position:fixed;top:16px;right:16px;z-index:2147483647;
          background:#0f0a0a;border:1px solid ${color};border-left:4px solid ${color};
          border-radius:10px;padding:14px 18px;min-width:280px;max-width:380px;
          font-family:'Inter',sans-serif;box-shadow:0 8px 32px rgba(0,0,0,0.9);
          display:flex;gap:12px;align-items:flex-start;
        ">
          <span style="font-size:24px;flex-shrink:0;">${icon}</span>
          <div style="flex:1;">
            <div style="font-weight:800;font-size:13px;color:${color};margin-bottom:4px;">AegisOne Document Scan</div>
            <div style="font-size:12px;color:#e2e8f0;font-weight:700;margin-bottom:4px;">${label}</div>
            <div style="font-size:11px;color:#94a3b8;">${signalText}</div>
          </div>
          <button id="aegis-doc-banner-close" style="background:none;border:none;color:#64748b;cursor:pointer;font-size:18px;padding:0;flex-shrink:0;">✕</button>
        </div>
      `;
      document.body.appendChild(banner);
      banner.querySelector("#aegis-doc-banner-close").addEventListener("click", () => banner.remove());
      if (!msg.isPhishing) setTimeout(() => banner?.remove(), 6000);
    }
  });

})();
