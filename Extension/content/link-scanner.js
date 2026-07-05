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
let _tooltipEl    = null;

// ── Exported entry point ───────────────────────────────
export function initLinkScanner() {
  _ensureTooltipEl();
  _ensureLinkStyles();

  // Badge visible links immediately (from cache if available)
  _scanVisibleLinks();

  // Attach hover and click listeners
  document.addEventListener("mouseover", _onLinkHover);
  document.addEventListener("mouseout",  _onLinkOut);
  document.addEventListener("click",     _onLinkClick, { capture: true });

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

    e.preventDefault();
    e.stopPropagation();

    const originalCursor = document.body.style.cursor;
    document.body.style.cursor = "wait";

    const res = await chrome.runtime.sendMessage({
      type: MSG.SCAN_HOVER_URL,
      url,
    }).catch(() => null);

    document.body.style.cursor = originalCursor;

    if (!res?.result || res.result.score < 50) {
      // Safe — navigate normally
      if (a.target === "_blank") {
        window.open(url, "_blank");
      } else {
        location.href = url;
      }
      return;
    }

    const { score, verdict, threat_type, top_factors } = res.result;
    const { showWarningModal } = await import(chrome.runtime.getURL("content/modals.js"));
    showWarningModal({
      score, verdict, threat_type, top_factors, url,
      onContinue: () => {
        if (a.target === "_blank") {
          window.open(url, "_blank");
        } else {
          location.href = url;
        }
      }
    });
  } catch (_) {}
}

// ── Danger badges (called from background) ─────────────
export function applyDangerBadges(dangerUrls) {
  if (!dangerUrls?.length) return;
  const urlSet = new Set(dangerUrls);
  document.querySelectorAll("a[href]").forEach(a => {
    try {
      const href = new URL(a.href, location.href).href;
      if (urlSet.has(href)) _attachBadge(a, "danger");
    } catch (_) {}
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

    const res = await chrome.runtime.sendMessage({ type: "SEARCH_SCAN", urls }).catch(() => null);
    if (!res?.results) return;

    const riskMap = new Map();
    res.results.forEach(r => { if (r?.url) riskMap.set(r.url, r.score ?? 0); });

    document.querySelectorAll("a[href]").forEach(a => {
      try {
        const href = new URL(a.href, location.href).href;
        const score = riskMap.get(href);
        if (score != null && score >= THRESHOLD.HIGHLIGHT * 100) {
          _attachBadge(a, "danger");
        }
      } catch (_) {}
    });
  }, 600);
}

// ── Hover handlers ────────────────────────────────────
function _onLinkHover(e) {
  const a = e.target.closest("a[href]");
  if (!a) return;

  try {
    const url = new URL(a.href, location.href).href;
    if (!url.startsWith("http")) return;
    if (isInternalURL(url)) return;

    clearTimeout(_hoverTimeout);
    _hoverTimeout = setTimeout(() => _showHoverPreview(a, url), 250);
  } catch (_) {}
}

function _onLinkOut() {
  clearTimeout(_hoverTimeout);
  _hideTooltip();
}

// ── Core hover preview logic ───────────────────────────
async function _showHoverPreview(anchor, url) {
  // Immediately show "scanning" state
  _showTooltip(anchor, { loading: true, url });

  let res = null;
  try {
    res = await chrome.runtime.sendMessage({ type: MSG.SCAN_HOVER_URL, url });
  } catch (_) {}

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
}

// ── Tooltip render ────────────────────────────────────
function _showTooltip(anchor, { loading, url, score, verdict, top_factors }) {
  if (!_tooltipEl) _ensureTooltipEl();

  if (loading) {
    _tooltipEl.innerHTML = `
      <div class="aegis-tip-url">${_shortURL(url, 48)}</div>
      <div class="aegis-tip-scanning">🔍 Checking with AegisOne AI...</div>
    `;
  } else {
    const scoreColor  = score >= 80 ? "#ef4444" : score >= 50 ? "#f97316" : score >= 20 ? "#f59e0b" : "#10b981";
    const verdictText = score >= 80 ? "🚨 High Risk" : score >= 50 ? "⚠️ Suspicious" : score >= 20 ? "🔶 Low Risk" : "✅ Safe";
    const reason      = top_factors?.[0]?.label || "";

    _tooltipEl.innerHTML = `
      <div class="aegis-tip-url">${_shortURL(url, 48)}</div>
      <div class="aegis-tip-score">
        <span style="color:${scoreColor}; font-weight:800;">${verdictText}</span>
        <span class="aegis-tip-pct" style="color:${scoreColor};">${score}%</span>
      </div>
      ${reason ? `<div class="aegis-tip-reason">${reason}</div>` : ""}
    `;
  }

  // Make visible first so offsetHeight is correct
  _tooltipEl.style.display = "block";

  // Position relative to viewport + scroll
  const rect      = anchor.getBoundingClientRect();
  const scrollTop = window.scrollY || document.documentElement.scrollTop;
  const scrollLeft = window.scrollX || document.documentElement.scrollLeft;
  const tipH      = _tooltipEl.offsetHeight || 60;
  const tipLeft   = Math.max(8, Math.min(rect.left + scrollLeft, window.innerWidth - 290));
  const tipTop    = rect.top + scrollTop - tipH - 10;

  _tooltipEl.style.left = `${tipLeft}px`;
  _tooltipEl.style.top  = `${Math.max(scrollTop + 8, tipTop)}px`;
  _tooltipEl.style.display = "block";
  _tooltipEl.style.opacity = "1";
}

function _hideTooltip() {
  if (_tooltipEl) {
    _tooltipEl.style.display = "none";
    _tooltipEl.style.opacity = "0";
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
  if (_tooltipEl) return;
  _tooltipEl = document.createElement("div");
  _tooltipEl.id = "aegis-hover-tooltip";
  _tooltipEl.style.cssText = "display:none; position:absolute; z-index:2147483646;";
  document.documentElement.appendChild(_tooltipEl);
}

let _stylesReady = false;
function _ensureLinkStyles() {
  if (_stylesReady) return;
  _stylesReady = true;
  const style = document.createElement("style");
  style.textContent = `
    #aegis-hover-tooltip {
      position: absolute !important;
      z-index: 2147483646 !important;
      background: rgba(10, 18, 35, 0.97) !important;
      border: 1px solid rgba(99,102,241,0.3) !important;
      border-radius: 12px !important;
      padding: 11px 15px !important;
      min-width: 210px !important;
      max-width: 300px !important;
      box-shadow: 0 16px 48px rgba(0,0,0,0.7), 0 0 0 1px rgba(99,102,241,0.1) !important;
      font-family: -apple-system, 'Inter', BlinkMacSystemFont, sans-serif !important;
      pointer-events: none !important;
      transition: opacity 0.15s ease !important;
      backdrop-filter: blur(8px) !important;
    }
    .aegis-tip-url {
      font-size: 10px !important;
      color: #64748b !important;
      word-break: break-all !important;
      margin-bottom: 7px !important;
      border-bottom: 1px solid rgba(255,255,255,0.06) !important;
      padding-bottom: 6px !important;
    }
    .aegis-tip-score {
      display: flex !important;
      justify-content: space-between !important;
      align-items: center !important;
      font-size: 12px !important;
      margin-bottom: 5px !important;
    }
    .aegis-tip-pct {
      font-size: 13px !important;
      font-weight: 800 !important;
    }
    .aegis-tip-reason {
      font-size: 10px !important;
      color: #94a3b8 !important;
      margin-top: 4px !important;
      font-style: italic !important;
    }
    .aegis-tip-scanning {
      font-size: 11px !important;
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
