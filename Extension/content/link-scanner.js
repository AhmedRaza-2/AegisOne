/**
 * AegisOne — Content Script: Link Scanner & Hover Preview
 * =========================================================
 * Two features in one module:
 *
 * 1. Link Hover Preview — shows risk tooltip when hovering a link
 *    - Cache-first (no API delay for cached URLs)
 *    - Debounced (500ms hover before triggering)
 *
 * 2. Malicious Link Highlighting — marks dangerous links with a badge
 *    - Only applied to links above HIGHLIGHT_THRESHOLD (85%)
 *    - Never highlights trusted domains
 */

import { MSG, THRESHOLD } from "../../utils/constants.js";
import { isTrusted, isInternalURL, shortURL } from "../../utils/trusted-domains.js";

// Track links that have been badged
const _badged = new WeakSet();

// Hover preview state
let _hoverTimeout = null;
let _tooltipEl = null;

/**
 * Initialize link scanner — attach hover listeners and badge existing links.
 */
export function initLinkScanner() {
  _ensureTooltipEl();
  _ensureLinkStyles();

  // Badge visible links immediately (from cache if available)
  _scanVisibleLinks();

  // Attach hover listeners for new links too
  document.addEventListener("mouseover", _onLinkHover);
  document.addEventListener("mouseout", _onLinkOut);

  // Watch for new links (SPAs)
  const observer = new MutationObserver(_scanVisibleLinks);
  observer.observe(document.body, { childList: true, subtree: true });
}

/**
 * Apply danger badges to a set of URLs (called when background sends threat list).
 * @param {string[]} dangerUrls
 */
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

// ── Internal ──────────────────────────────────────────────
function _scanVisibleLinks() {
  // Only scan visible links, capped to 50 per cycle
  const links = [...document.querySelectorAll("a[href]")].slice(0, 50);

  links.forEach(a => {
    if (_badged.has(a)) return;
    try {
      const url = new URL(a.href, location.href).href;
      if (!url.startsWith("http")) return;
      if (isInternalURL(url)) return;
      if (isTrusted(url)) {
        // Trusted — no badge needed
        _badged.add(a);
        return;
      }
    } catch (_) {}
  });
}

function _onLinkHover(e) {
  const a = e.target.closest("a[href]");
  if (!a) return;

  try {
    const url = new URL(a.href, location.href).href;
    if (!url.startsWith("http")) return;
    if (isInternalURL(url) || isTrusted(url)) return;

    clearTimeout(_hoverTimeout);
    _hoverTimeout = setTimeout(() => _showHoverPreview(a, url), 500);
  } catch (_) {}
}

function _onLinkOut() {
  clearTimeout(_hoverTimeout);
  _hideTooltip();
}

async function _showHoverPreview(a, url) {
  // Show loading state immediately
  _showTooltip(a, { loading: true, url });

  const res = await chrome.runtime.sendMessage({
    type: MSG.SCAN_HOVER_URL,
    url,
  }).catch(() => null);

  if (!res?.result) {
    _hideTooltip();
    return;
  }

  const { score, verdict, top_factors } = res.result;
  _showTooltip(a, { url, score, verdict, top_factors });

  // Apply badge if risky
  if (score >= THRESHOLD.HIGHLIGHT * 100) {
    _attachBadge(a, "danger");
  }
}

function _showTooltip(anchor, { loading, url, score, verdict, top_factors }) {
  if (!_tooltipEl) _ensureTooltipEl();

  const rect = anchor.getBoundingClientRect();
  const scrollTop = window.scrollY || document.documentElement.scrollTop;

  if (loading) {
    _tooltipEl.innerHTML = `
      <div class="aegis-tip-url">${shortURL(url, 48)}</div>
      <div class="aegis-tip-scanning">🔍 Checking with AegisOne AI...</div>
    `;
  } else {
    const scoreColor = score >= 80 ? "#ef4444" : score >= 50 ? "#f97316" : score >= 20 ? "#f59e0b" : "#10b981";
    const verdictText = score >= 80 ? "🚨 High Risk" : score >= 50 ? "⚠️ Suspicious" : score >= 20 ? "🔶 Low Risk" : "✅ Safe";
    const reason = top_factors?.[0]?.label || "";

    _tooltipEl.innerHTML = `
      <div class="aegis-tip-url">${shortURL(url, 48)}</div>
      <div class="aegis-tip-score">
        <span style="color:${scoreColor}; font-weight:800;">${verdictText}</span>
        <span class="aegis-tip-pct" style="color:${scoreColor};">${score}%</span>
      </div>
      ${reason ? `<div class="aegis-tip-reason">${reason}</div>` : ""}
    `;
  }

  _tooltipEl.style.display = "block";
  const tipLeft = Math.min(rect.left, window.innerWidth - 280);
  _tooltipEl.style.left = `${Math.max(8, tipLeft)}px`;
  _tooltipEl.style.top = `${rect.top + scrollTop - _tooltipEl.offsetHeight - 8}px`;
}

function _hideTooltip() {
  if (_tooltipEl) _tooltipEl.style.display = "none";
}

function _attachBadge(a, verdict) {
  if (_badged.has(a)) return;
  _badged.add(a);

  const badge = document.createElement("span");
  badge.className = `aegis-link-badge aegis-link-${verdict}`;
  badge.textContent = verdict === "danger" ? "⚠ Risk" : "🔶";
  badge.title = "AegisOne: This link appears suspicious";
  a.insertAdjacentElement("afterend", badge);
}

function _ensureTooltipEl() {
  if (_tooltipEl) return;
  _tooltipEl = document.createElement("div");
  _tooltipEl.id = "aegis-hover-tooltip";
  _tooltipEl.style.display = "none";
  document.body.appendChild(_tooltipEl);
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
      background: rgba(15,23,42,0.97) !important;
      border: 1px solid rgba(255,255,255,0.1) !important;
      border-radius: 10px !important;
      padding: 10px 14px !important;
      min-width: 200px; max-width: 280px;
      box-shadow: 0 12px 40px rgba(0,0,0,0.6) !important;
      font-family: -apple-system, 'Inter', sans-serif !important;
      pointer-events: none !important;
      transition: none !important;
    }
    .aegis-tip-url { font-size: 10px; color: #475569; word-break: break-all; margin-bottom: 6px; }
    .aegis-tip-score { display: flex; justify-content: space-between; align-items: center; font-size: 12px; margin-bottom: 4px; }
    .aegis-tip-pct { font-size: 11px; font-weight: 700; }
    .aegis-tip-reason { font-size: 10px; color: #64748b; font-style: italic; }
    .aegis-tip-scanning { font-size: 11px; color: #818cf8; }

    .aegis-link-badge {
      display: inline !important; font-size: 10px !important; font-weight: 700 !important;
      padding: 1px 5px !important; border-radius: 8px !important; margin-left: 4px !important;
      font-family: -apple-system, sans-serif !important; vertical-align: middle !important;
      cursor: help !important; white-space: nowrap !important;
    }
    .aegis-link-danger {
      background: rgba(239,68,68,0.12) !important; color: #ef4444 !important;
      border: 1px solid rgba(239,68,68,0.25) !important;
    }
  `;
  document.head.appendChild(style);
}
