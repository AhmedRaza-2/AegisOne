/**
 * AegisOne — Content Script: Link Scanner & Hover Preview
 * =========================================================
 * 1. Link Hover Preview — shows risk tooltip when hovering a link
 *    - Cache-first (no API delay for cached URLs)
 *    - Debounced (250ms hover before triggering)
 *
 * 2. Navigation Intercept — blocks clicks on risky links
 *
 * 3. Malicious Link Highlighting — marks dangerous links with a badge
 */

import { MSG, THRESHOLD } from "../../utils/constants.js";
import { isInternalURL, getRootDomain } from "../../utils/trusted-domains.js";

const _badged = new WeakSet();

// Hover preview state
let _hoverTimeout = null;
let _tooltipEl = null;
let _scanVisibleTimeout = null;
let _hoverToken = 0;

// ── Exported entry point ───────────────────────────────
export function initLinkScanner() {
  _ensureTooltipEl();
  _ensureLinkStyles();

  // Badge visible links immediately (from cache if available)
  _scanVisibleLinks();

  // Attach hover and click listeners
  document.addEventListener("mouseover", _onHover);
  document.addEventListener("mouseout", _onOut);
  document.addEventListener("focusin", _onHover);
  document.addEventListener("focusout", _onOut);
  document.addEventListener("click", _onLinkClick, { capture: true });

  // Watch for new links (SPAs)
  const observer = new MutationObserver(() => _scanVisibleLinks());
  observer.observe(document.body, { childList: true, subtree: true });
}

// ── Click intercept ────────────────────────────────────
async function _onLinkClick(e) {
  const a = e.target.closest("a[href]");
  if (!a) return;

  try {
    const url = new URL(a.href, location.href).href;
    if (!url.startsWith("http")) return;
    if (isInternalURL(url)) return;
    if (a.id && a.id.startsWith("aegis-")) return;

    // Only intercept if link is explicitly flagged as dangerous
    const isDangerous = a.dataset.aegisDanger === "true" || a.querySelector(".aegis-badge-danger");
    if (!isDangerous) {
      // Normal click — DO NOT intercept! Let native browser/SPA router handle navigation smoothly.
      return;
    }

    e.preventDefault();
    e.stopPropagation();

    const { showWarningModal } = await import(chrome.runtime.getURL("content/modals.js"));
    showWarningModal({
      score: 85,
      verdict: "danger",
      threat_type: "Phishing Link",
      top_factors: [{ label: "High-risk URL detected" }],
      url,
      onContinue: () => {
        if (a.target === "_blank") {
          window.open(url, "_blank");
        } else {
          location.href = url;
        }
      }
    });
  } catch (_) { }
}

// ── Danger badges (called from background) ─────────────
export function applyDangerBadges(dangerUrls) {
  if (!dangerUrls?.length) return;
  const urlSet = new Set(
    dangerUrls.map(u => (typeof u === "string" ? u : u?.url || "")).filter(Boolean)
  );
  if (!urlSet.size) return;

  document.querySelectorAll("a[href]").forEach(a => {
    try {
      const href = new URL(a.href, location.href).href;
      if (urlSet.has(href)) {
        a.dataset.aegisDanger = "true";
        _attachBadge(a, "danger");
      }
    } catch (_) { }
  });
}

// ── Visible link batch scan (badges from cache) ────────
let _scanTimer = null;
function _scanVisibleLinks() {
  clearTimeout(_scanTimer);
  _scanTimer = setTimeout(async () => {
    const urls = [...new Set(
      [...document.querySelectorAll("a[href]")]
        .filter(a => !_badged.has(a))
        .map(a => { try { return new URL(a.href, location.href).href; } catch { return ""; } })
        .filter(u => u.startsWith("http") && !isInternalURL(u))
    )].slice(0, 40);

    if (!urls.length) return;

    let res = null;
    try {
      res = await chrome.runtime.sendMessage({ type: "SEARCH_SCAN", urls });
    } catch (e) {
      // Catch "Extension context invalidated" silently
      return;
    }
    if (!res?.results) return;

    const riskMap = new Map();
    res.results.forEach(r => { if (r?.url) riskMap.set(r.url, r.score ?? 0); });

    document.querySelectorAll("a[href]").forEach(a => {
      try {
        const href = new URL(a.href, location.href).href;
        const score = riskMap.get(href);
        if (score != null && score >= THRESHOLD.HIGHLIGHT * 100) {
          a.dataset.aegisDanger = "true";
          _attachBadge(a, "danger");
        }
      } catch (_) { }
    });
  }, 600);
}

// ── Hover handlers ────────────────────────────────────
function _onHover(e) {
  // Only trigger hover preview for links (<a>), NOT for images automatically
  const a = e.target.closest("a[href]");
  if (a) {
    try {
      const url = new URL(a.href, location.href).href;
      if (url.startsWith("http") && !isInternalURL(url)) {
        clearTimeout(_hoverTimeout);
        const token = ++_hoverToken;
        _hoverTimeout = setTimeout(() => _showHoverPreview(a, url, token), 400);
      }
    } catch (_) { }
  }
}

function _onOut() {
  clearTimeout(_hoverTimeout);
  _hoverToken += 1;
  _hideTooltip();
}

async function _showImageHoverPreview(img, src, token) {
  _showTooltip(img, { loading: true, url: src });

  let res = null;
  try {
    res = await chrome.runtime.sendMessage({ type: MSG.SCAN_HOVER_IMAGE, src });
  } catch (_) { }

  if (token !== _hoverToken) return;

  let score = 0;
  let verdict = "safe";
  let top_factors = [{ label: "Image Analysis Failed" }];

  if (res?.result) {
    const prob = res.result.phishing_probability ?? 0;
    score = Math.round(prob * 100);
    verdict = res.result.prediction === "phishing" ? "danger" : "safe";

    // Extract factors if available
    if (res.result.sub_results && res.result.sub_results.length > 0) {
      top_factors = res.result.sub_results.map(sub => ({
        label: `[${sub.model}] ${sub.prediction} (${Math.round((sub.phishing_probability || 0) * 100)}%)`
      }));
    } else {
      top_factors = [{ label: "Image Analysis" }];
    }
  } else {
    // If background fetch failed (e.g. CORS or network error), fallback gracefully instead of hiding
    top_factors = [{ label: "Could not fetch image for analysis" }];
  }

  _showTooltip(img, { url: src, score, verdict, top_factors });

  if (score >= THRESHOLD.HIGHLIGHT * 100) {
    img.style.outline = "3px solid #ef4444";
    img.title = "AegisOne: This image appears suspicious";
  }

  if (score >= 20) {
    chrome.storage.local.get(["device_id"]).then(({ device_id }) => {
      fetch("http://localhost:8000/telemetry/hover", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          destination: src,
          risk_score: score,
          cached: false,
          type: "image"
        }),
        signal: AbortSignal.timeout(4000),
      }).catch(() => { });
    }).catch(() => { });
  }
}

// ── Core hover preview logic ───────────────────────────
async function _showHoverPreview(anchor, url, token) {
  // Immediately show "scanning" state
  _showTooltip(anchor, { loading: true, url });

  let res = null;
  try {
    res = await chrome.runtime.sendMessage({ type: MSG.SCAN_HOVER_URL, url });
  } catch (_) { }

  if (token !== _hoverToken) return;

  if (!res?.result) {
    _hideTooltip();
    return;
  }

  const { score, verdict, top_factors } = res.result;
  _showTooltip(anchor, { url, score, verdict, top_factors });

  // Apply badge if risky
  if (score >= THRESHOLD.HIGHLIGHT * 100) {
    _attachBadge(anchor, "danger");
  }

  // Module 11 — persist hover scan (best-effort, only if notable)
  if (score >= 20) {
    chrome.storage.local.get(["device_id"]).then(({ device_id }) => {
      fetch("http://localhost:8000/telemetry/hover", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          destination: url,
          risk_score: score,
          cached: res.result.from_cache || false,
        }),
        signal: AbortSignal.timeout(4000),
      }).catch(() => { });
    }).catch(() => { });
  }
}

// ── Tooltip render ────────────────────────────────────
function _showTooltip(anchor, { loading, url, score, verdict, top_factors }) {
  if (!_tooltipEl) _ensureTooltipEl();

  if (loading) {
    _tooltipEl.innerHTML = `
      <div style="display:flex; align-items:center; gap:5px; font-size:10px; font-weight:700; color:#94a3b8;">
        <span>🛡️</span><span>AI Scanning...</span>
      </div>
    `;
  } else if (score === -1 || verdict === "offline") {
    _tooltipEl.innerHTML = `
      <div style="display:flex; align-items:center; gap:5px; font-size:10px; font-weight:800; color:#ef4444;">
        <span>⚠️</span><span>Backend Offline</span>
      </div>
    `;
  } else {
    const scoreColor = score >= 80 ? "#ef4444" : score >= 50 ? "#f97316" : score >= 20 ? "#f59e0b" : "#10b981";
    const verdictText = score >= 80 ? "🚨 Phishing" : score >= 50 ? "⚠️ Suspicious" : score >= 20 ? "🔶 Warning" : "✅ Safe";

    _tooltipEl.innerHTML = `
      <div style="display:flex; align-items:center; justify-content:space-between; gap:8px; font-size:11px; font-weight:800;">
        <span style="color:${scoreColor};">${verdictText}</span>
        <span style="color:${scoreColor}; font-family:monospace; font-size:10px;">${score}%</span>
      </div>
    `;
  }

  // Position tooltip near the link using fixed positioning (viewport-relative)
  const rect = anchor.getBoundingClientRect();
  const TIP_W = 120;
  const TIP_H = _tooltipEl.offsetHeight || 24;

  let left = Math.max(8, Math.min(rect.left, window.innerWidth - TIP_W - 8));
  let top = rect.top - TIP_H - 6;
  if (top < 8) top = rect.bottom + 6; // flip below if no space above

  _tooltipEl.style.setProperty("left", `${left}px`, "important");
  _tooltipEl.style.setProperty("top", `${top}px`, "important");
  _tooltipEl.style.setProperty("display", "block", "important");
  _tooltipEl.style.setProperty("opacity", "1", "important");
}

function _hideTooltip() {
  if (_tooltipEl) {
    _tooltipEl.style.setProperty("display", "none", "important");
    _tooltipEl.style.setProperty("opacity", "0", "important");
  }
}

// ── Badge helper ─────────────────────────────────────
function _attachBadge(a, verdict) {
  if (_badged.has(a)) return;
  _badged.add(a);
  const badge = document.createElement("span");
  badge.className = `aegis-link-badge aegis-link-${verdict}`;
  badge.textContent = verdict === "danger" ? "⚠ Risk" : "🔶";
  badge.title = "AegisOne: This link appears suspicious";
  a.insertAdjacentElement("afterend", badge);

  // Directly highlight the text link as requested
  if (verdict === "danger") {
    a.style.setProperty("background-color", "rgba(239, 68, 68, 0.15)", "important");
    a.style.setProperty("border-bottom", "2px solid #ef4444", "important");
    a.style.setProperty("color", "#ef4444", "important");
  } else if (verdict === "warning") {
    a.style.setProperty("background-color", "rgba(249, 115, 22, 0.15)", "important");
    a.style.setProperty("border-bottom", "2px solid #f97316", "important");
  }
}

// ── URL shortener ────────────────────────────────────
function _shortURL(url, maxLen = 50) {
  try {
    const u = new URL(url);
    const display = u.hostname + u.pathname.slice(0, 20);
    return display.length > maxLen ? display.slice(0, maxLen) + "…" : display;
  } catch (_) {
    return url.slice(0, maxLen);
  }
}

// ── DOM setup ────────────────────────────────────────
function _ensureTooltipEl() {
  if (_tooltipEl && document.body?.contains(_tooltipEl)) return;
  _tooltipEl = document.createElement("div");
  _tooltipEl.id = "aegis-hover-tooltip";
  // Inline critical styles with !important via setProperty
  _tooltipEl.style.setProperty("display", "none", "important");
  _tooltipEl.style.setProperty("position", "fixed", "important");
  _tooltipEl.style.setProperty("z-index", "2147483647", "important");
  document.body?.appendChild(_tooltipEl);
}

let _stylesReady = false;
function _ensureLinkStyles() {
  if (_stylesReady) return;
  _stylesReady = true;
  const style = document.createElement("style");
  style.textContent = `
    #aegis-hover-tooltip {
      position: fixed !important;
      z-index: 2147483647 !important;
      background: rgba(15, 23, 42, 0.95) !important;
      border: 1px solid rgba(99,102,241,0.3) !important;
      border-radius: 6px !important;
      padding: 3px 8px !important;
      min-width: 80px !important;
      max-width: 130px !important;
      box-shadow: 0 4px 12px rgba(0,0,0,0.4) !important;
      font-family: 'Inter', -apple-system, BlinkMacSystemFont, sans-serif !important;
      pointer-events: none !important;
      transition: opacity 0.12s ease !important;
      backdrop-filter: blur(8px) !important;
      color: #e2e8f0 !important;
    }
    .aegis-tip-url {
      font-size: 9.5px !important;
      color: #64748b !important;
      word-break: break-all !important;
      margin-bottom: 5px !important;
      border-bottom: 1px solid rgba(255,255,255,0.06) !important;
      padding-bottom: 4px !important;
      white-space: nowrap !important;
      overflow: hidden !important;
      text-overflow: ellipsis !important;
    }
    .aegis-tip-score {
      display: flex !important;
      justify-content: space-between !important;
      align-items: center !important;
      font-size: 11px !important;
      margin-bottom: 4px !important;
    }
    .aegis-tip-pct {
      font-size: 12px !important;
      font-weight: 800 !important;
    }
    .aegis-tip-reason {
      font-size: 9.5px !important;
      color: #94a3b8 !important;
      margin-top: 3px !important;
      font-style: italic !important;
      line-height: 1.3 !important;
    }
    .aegis-tip-scanning {
      font-size: 10px !important;
      color: #818cf8 !important;
      display: flex !important;
      align-items: center !important;
      gap: 5px !important;
    }
    .aegis-link-badge {
      display: inline !important;
      font-size: 10px !important;
      font-weight: 700 !important;
      padding: 1px 5px !important;
      border-radius: 8px !important;
      margin-left: 4px !important;
      font-family: -apple-system, sans-serif !important;
      vertical-align: middle !important;
      cursor: help !important;
      white-space: nowrap !important;
    }
    .aegis-link-danger {
      background: rgba(239,68,68,0.12) !important;
      color: #ef4444 !important;
      border: 1px solid rgba(239,68,68,0.25) !important;
    }
  `;
  document.head.appendChild(style);
}

