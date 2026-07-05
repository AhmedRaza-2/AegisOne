/**
 * AegisOne — Content Script: Search Result Badges (Lazy Viewport Scanner)
 * ========================================================================
 */

import { MSG } from "../../utils/constants.js";

const SCAN_BATCH_SIZE = 12; // Increased batch size for speed
const _observedElements = new Set();
const _scannedHrefs = new Set();
const _scanQueue = [];

let _observer = null;
let _queueTimeout = null;

export function initSearchBadges() {
  const engine = _detectSearchEngine();
  if (!engine) return;

  _ensureSearchStyles();

  _observer = new IntersectionObserver((entries) => {
    const toProcess = [];
    entries.forEach(entry => {
      if (entry.isIntersecting) {
        const linkEl = entry.target;
        _observer.unobserve(linkEl);
        _observedElements.delete(linkEl);

        const href = linkEl.getAttribute("data-aegis-href");
        if (href && !_scannedHrefs.has(href)) {
          toProcess.push({ linkEl, href });
        }
      }
    });

    if (toProcess.length > 0) {
      _queueForScanning(toProcess);
    }
  }, {
    rootMargin: "300px", // Scan even earlier before they come into view
    threshold: 0.01
  });

  _findAndObserveLinks();

  const mutationObserver = new MutationObserver(() => _findAndObserveLinks());
  mutationObserver.observe(document.body, { childList: true, subtree: true });
}

function _detectSearchEngine() {
  const host = location.hostname;
  if (host.includes("google.")) return "google";
  if (host.includes("bing.")) return "bing";
  if (host.includes("duckduckgo.")) return "ddg";
  return null;
}

function _findAndObserveLinks() {
  const links = document.querySelectorAll("a[href]");
  links.forEach(a => {
    try {
      const href = new URL(a.href, location.href).href;
      if (!_isExternalSearchLink(a, href)) return;

      if (_observedElements.has(a) || a.querySelector(".aegis-search-badge")) return;
      if (a.innerText.trim().length === 0 && !a.querySelector("h3, h2, img")) return;

      a.setAttribute("data-aegis-href", href);
      _observedElements.add(a);
      _observer.observe(a);
    } catch (_) {}
  });
}

function _isExternalSearchLink(a, href) {
  if (!href || !href.startsWith("http")) return false;
  try {
    const u = new URL(href);
    const host = location.hostname;
    // Exclude same-host navigation
    if (u.host === host) return false;
    // Exclude Google internal tools, translate, caches etc
    if (u.host.includes("google.") && !href.includes("/url?")) return false;
  } catch (_) { return false; }
  return true;
}

function _queueForScanning(items) {
  items.forEach(({ linkEl, href }) => {
    _injectBadge(linkEl, { verdict: "scanning", score: null, href });
    _scanQueue.push({ linkEl, href });
  });

  if (_scanQueue.length > 0) {
    clearTimeout(_queueTimeout);
    _queueTimeout = setTimeout(_processScanQueue, 100); // Faster debounce
  }
}

function _processScanQueue() {
  if (_scanQueue.length === 0) return;

  const batch = _scanQueue.splice(0, SCAN_BATCH_SIZE);
  const urls = [...new Set(batch.map(item => item.href))]; // Unique URLs for API

  chrome.runtime.sendMessage({
    type: MSG.SEARCH_SCAN,
    urls: urls
  }).then(res => {
    if (res?.ok && res.results) {
      // Map API results
      const resultMap = new Map();
      res.results.forEach(r => resultMap.set(r.url, r));

      // Resolve every link in this batch
      batch.forEach(item => {
        _scannedHrefs.add(item.href);
        const r = resultMap.get(item.href);

        if (r) {
          const score = r.score ?? Math.round((r.phishing_probability || 0) * 100);
          const verdict = score >= 80 ? "danger" : score >= 50 ? "warning" : "safe";
          _injectBadge(item.linkEl, {
            verdict,
            score,
            threat_type: r.threat_type || r.category || r.prediction,
            href: item.href
          });
        } else {
          // If backend didn't return a result for this URL (failed/timeout), mark safe to clear spinner
          _injectBadge(item.linkEl, { verdict: "safe", score: 0, href: item.href });
        }
      });
    } else {
      console.warn("[AegisOne] Batch scan invalid, resetting:", res);
      _resetBatch(batch);
    }

    if (_scanQueue.length > 0) {
      _queueTimeout = setTimeout(_processScanQueue, 150);
    }
  }).catch(err => {
    console.error("[AegisOne] Batch scan error:", err);
    _resetBatch(batch);
  });
}

function _resetBatch(batch) {
  batch.forEach(({ linkEl, href }) => {
    _scannedHrefs.add(href);
    _injectBadge(linkEl, { verdict: "safe", score: 0, href });
  });
}

function _getBadgeContainer(a) {
  const heading = a.querySelector("h3, h2");
  if (heading) return heading;
  return a;
}

const ICONS = {
  safe: `<svg viewBox="0 0 24 24" fill="none"><polyline points="20 6 9 17 4 12"></polyline></svg>`,
  warning: `<svg viewBox="0 0 24 24" fill="none"><line x1="12" y1="8" x2="12" y2="12"></line><line x1="12" y1="16" x2="12.01" y2="16"></line></svg>`,
  danger: `<svg viewBox="0 0 24 24" fill="none"><line x1="15" y1="9" x2="9" y2="15"></line><line x1="9" y1="9" x2="15" y2="15"></line></svg>`,
  scanning: `<svg viewBox="0 0 24 24" fill="none"><path d="M21 12a9 9 0 1 1-6.219-8.56"></path></svg>`
};

function _injectBadge(linkEl, { verdict, score, threat_type, href }) {
  const container = _getBadgeContainer(linkEl);
  container.querySelector(".aegis-search-badge")?.remove();

  const badge = document.createElement("span");
  badge.className = `aegis-search-badge aegis-badge-${verdict}`;
  badge.setAttribute("data-href", href || "");

  let title;
  switch (verdict) {
    case "scanning": title = "AegisOne: Scanning..."; break;
    case "safe":     title = `AegisOne: Safe (${score}% risk)`; break;
    case "warning":  title = `AegisOne: Suspicious (${score}% risk) - Click for XAI`; break;
    case "danger":   title = `AegisOne: Danger (${score}% risk) - Click for XAI`; break;
    default: return;
  }

  badge.innerHTML = ICONS[verdict];
  badge.title = title;

  if (verdict === "warning" || verdict === "danger") {
    badge.addEventListener("click", async (e) => {
      e.preventDefault();
      e.stopPropagation();
      badge.innerHTML = ICONS.scanning; // spinner
      try {
        const res = await chrome.runtime.sendMessage({ type: MSG.XAI_REQUEST, url: href });
        if (res?.xai) {
          const { showXAIModal } = await import(chrome.runtime.getURL("content/modals.js"));
          showXAIModal(res.xai, { score, url: href, threat_type });
        }
      } catch (err) {
        console.error(err);
      } finally {
        badge.innerHTML = ICONS[verdict];
      }
    });
  }

  container.appendChild(badge);
  _ensureSearchStyles();
}

let _stylesInjected = false;
function _ensureSearchStyles() {
  if (_stylesInjected) return;
  _stylesInjected = true;

  const style = document.createElement("style");
  style.textContent = `
    .aegis-search-badge {
      display: inline-flex !important;
      align-items: center !important;
      justify-content: center !important;
      width: 16px !important;
      height: 16px !important;
      margin-left: 8px !important;
      vertical-align: middle !important;
      border-radius: 50% !important;
      box-shadow: 0 2px 4px rgba(0,0,0,0.15), inset 0 1px 1px rgba(255,255,255,0.4) !important;
      transition: transform 0.2s cubic-bezier(0.34, 1.56, 0.64, 1), box-shadow 0.2s ease !important;
      cursor: default !important;
    }
    .aegis-search-badge:hover {
      transform: scale(1.15) !important;
      box-shadow: 0 4px 8px rgba(0,0,0,0.2), inset 0 1px 1px rgba(255,255,255,0.5) !important;
    }
    .aegis-badge-safe     { background: linear-gradient(135deg, #34d399, #059669) !important; }
    .aegis-badge-warning  { background: linear-gradient(135deg, #fbbf24, #d97706) !important; cursor: pointer !important; }
    .aegis-badge-danger   { 
      background: linear-gradient(135deg, #f87171, #dc2626) !important; 
      box-shadow: 0 0 10px rgba(220, 38, 38, 0.5), inset 0 1px 1px rgba(255,255,255,0.4) !important;
      animation: aegis-pulse-danger 2s infinite alternate !important;
      cursor: pointer !important;
    }
    .aegis-badge-scanning { 
      background: linear-gradient(135deg, #94a3b8, #475569) !important; 
    }
    
    .aegis-search-badge svg {
      width: 9px !important;
      height: 9px !important;
      stroke: #ffffff !important;
      stroke-width: 3.5 !important;
      stroke-linecap: round !important;
      stroke-linejoin: round !important;
    }
    .aegis-badge-scanning svg {
      animation: aegis-spin 1s linear infinite !important;
      stroke-width: 2.5 !important;
    }

    @keyframes aegis-pulse-danger {
      0% { box-shadow: 0 0 0 0 rgba(220, 38, 38, 0.6), inset 0 1px 1px rgba(255,255,255,0.4); }
      100% { box-shadow: 0 0 0 6px rgba(220, 38, 38, 0), inset 0 1px 1px rgba(255,255,255,0.4); }
    }
    @keyframes aegis-spin {
      100% { transform: rotate(360deg); }
    }
  `;
  document.head.appendChild(style);
}
