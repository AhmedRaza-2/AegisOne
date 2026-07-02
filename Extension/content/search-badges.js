/**
 * AegisOne — Content Script: Search Result Badges
 * =================================================
 * Injects risk score badges next to Google/Bing/DuckDuckGo results.
 *
 * Design:
 * - Only scans up to 10 results per cycle (rate limiting)
 * - Uses MutationObserver to handle infinite scroll / lazy load
 * - Cache-first (results from background cache)
 * - "Verified Safe" for trusted domains — no API call needed
 */

import { isTrusted } from "../../utils/trusted-domains.js";
import { MSG } from "../../utils/constants.js";

const SCAN_BATCH_SIZE = 10;
const _scanned = new Set(); // Track already-scanned hrefs

/**
 * Initialize search badge injection for current search engine.
 */
export function initSearchBadges() {
  const engine = _detectSearchEngine();
  if (!engine) return;

  // Initial pass on already-rendered results
  _scanVisible(engine);

  // Watch for new results (lazy load / infinite scroll)
  const observer = new MutationObserver(() => _scanVisible(engine));
  observer.observe(document.body, { childList: true, subtree: true });
}

// ── Internal ──────────────────────────────────────────────
function _detectSearchEngine() {
  const host = location.hostname;
  if (host.includes("google.")) return "google";
  if (host.includes("bing.com"))  return "bing";
  if (host.includes("duckduckgo.com")) return "ddg";
  return null;
}

function _scanVisible(engine) {
  const entries = _getSearchEntries(engine);
  const unscanned = entries.filter(e => !_scanned.has(e.href));

  if (unscanned.length === 0) return;

  const batch = unscanned.slice(0, SCAN_BATCH_SIZE);
  batch.forEach(e => _scanned.add(e.href));

  // Mark all as "scanning" immediately
  batch.forEach(({ linkEl, href }) => {
    if (isTrusted(href)) {
      _injectBadge(linkEl, { verdict: "verified", score: 0, href });
    } else {
      _injectBadge(linkEl, { verdict: "scanning", score: null, href });
    }
  });

  // Batch scan non-trusted URLs
  const toScan = batch.filter(e => !isTrusted(e.href)).map(e => e.href);
  if (toScan.length === 0) return;

  chrome.runtime.sendMessage({
    type: MSG.SEARCH_SCAN,
    urls: toScan,
  }).then(res => {
    if (!res?.results) return;
    const resultMap = new Map(res.results.map(r => [r.url, r]));

    batch.forEach(({ linkEl, href }) => {
      const r = resultMap.get(href);
      if (r) {
        const score = r.score ?? Math.round((r.phishing_probability || 0) * 100);
        const verdict = score >= 80 ? "danger" : score >= 50 ? "warning" : "safe";
        _injectBadge(linkEl, {
          verdict,
          score,
          top_factor: r.top_factors?.[0]?.label,
          threat_type: r.threat_type || r.category || r.prediction,
          href
        });
      }
    });
  }).catch(() => {});
}

function _getSearchEntries(engine) {
  let links = [];

  if (engine === "google") {
    // Select <a> tags containing <h3> (main titles) to avoid duplicate/flipped site icon sub-links
    document.querySelectorAll("div.g a:has(h3), div[data-hveid] a:has(h3)").forEach(a => {
      if (!a.href.startsWith("http")) return;
      if (a.href.includes("google.com")) return;
      if (a.closest(".ads-ad")) return;
      links.push({ linkEl: a, href: a.href });
    });
  } else if (engine === "bing") {
    document.querySelectorAll("#b_results .b_algo h2 a").forEach(a => {
      if (a.href) links.push({ linkEl: a, href: a.href });
    });
  } else if (engine === "ddg") {
    document.querySelectorAll("[data-result-url] a.eVNpHGjtxRBq_gLOfGDr").forEach(a => {
      if (a.href) links.push({ linkEl: a, href: a.href });
    });
  }

  // Deduplicate by href
  const seen = new Set();
  return links.filter(e => {
    if (seen.has(e.href)) return false;
    seen.add(e.href);
    return true;
  });
}

function _injectBadge(linkEl, { verdict, score, top_factor, threat_type, href }) {
  // Remove existing badge
  linkEl.parentElement?.querySelector(".aegis-search-badge")?.remove();

  const badge = document.createElement("span");
  badge.className = `aegis-search-badge aegis-badge-${verdict}`;
  badge.setAttribute("data-href", href || linkEl.href || "");

  let text, title;
  switch (verdict) {
    case "verified": text = "🛡️ Verified Safe"; title = "Trusted domain"; break;
    case "scanning": text = "🔍 Scanning..."; title = "Checking with AegisOne AI"; break;
    case "safe":    text = `✅ ${score}%`; title = top_factor || "Appears safe"; break;
    case "warning": text = `⚠️ ${score}% (Explain)`; title = top_factor || "Potentially suspicious. Click for AI explanation."; break;
    case "danger":  text = `🚨 ${score}% (Explain)`; title = top_factor || "High phishing risk. Click for AI explanation."; break;
    default:        text = "—"; title = "";
  }

  badge.textContent = text;
  badge.title = title;

  if (verdict === "warning" || verdict === "danger") {
    badge.style.cursor = "pointer";
    badge.addEventListener("click", async (e) => {
      e.preventDefault();
      e.stopPropagation();

      const originalText = badge.textContent;
      badge.textContent = "⏳ Loading...";

      try {
        const res = await chrome.runtime.sendMessage({
          type: MSG.XAI_REQUEST,
          url: href,
        });

        if (res?.xai) {
          const { showXAIModal } = await import(chrome.runtime.getURL("content/modals.js"));
          showXAIModal(res.xai, { score, url: href, threat_type });
        }
      } catch (err) {
        console.error("[AegisOne] XAI error:", err);
      } finally {
        badge.textContent = originalText;
      }
    });
  }

  // Insert after the link
  linkEl.insertAdjacentElement("afterend", badge);
  _ensureSearchStyles();
}

let _stylesInjected = false;
function _ensureSearchStyles() {
  if (_stylesInjected) return;
  _stylesInjected = true;

  const style = document.createElement("style");
  style.textContent = `
    .aegis-search-badge {
      display: inline-flex !important; align-items: center !important;
      font-size: 10px !important; font-weight: 700 !important;
      padding: 2px 7px !important; border-radius: 10px !important;
      margin-left: 6px !important; vertical-align: middle !important;
      font-family: -apple-system, sans-serif !important;
      cursor: default !important; white-space: nowrap !important;
      font-style: normal !important; text-decoration: none !important;
      transform: none !important;
      direction: ltr !important;
      unicode-bidi: normal !important;
      writing-mode: horizontal-tb !important;
    }
    .aegis-badge-verified { background: rgba(59,130,246,0.1) !important; color: #3b82f6 !important; border: 1px solid rgba(59,130,246,0.25) !important; }
    .aegis-badge-scanning { background: rgba(99,102,241,0.07) !important; color: #818cf8 !important; border: 1px solid rgba(99,102,241,0.2) !important; }
    .aegis-badge-safe     { background: rgba(16,185,129,0.1)  !important; color: #10b981 !important; border: 1px solid rgba(16,185,129,0.25) !important; }
    .aegis-badge-warning  { background: rgba(245,158,11,0.1)  !important; color: #f59e0b !important; border: 1px solid rgba(245,158,11,0.25) !important; }
    .aegis-badge-danger   { background: rgba(239,68,68,0.1)   !important; color: #ef4444 !important; border: 1px solid rgba(239,68,68,0.25) !important; animation: aegis-badge-pulse 2s infinite; }
    @keyframes aegis-badge-pulse {
      0%, 100% { box-shadow: 0 0 0 0 rgba(239,68,68,0); }
      50% { box-shadow: 0 0 0 3px rgba(239,68,68,0.2); }
    }
  `;
  document.head.appendChild(style);
}
