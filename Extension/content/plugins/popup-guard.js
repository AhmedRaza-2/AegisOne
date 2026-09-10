/**
 * AegisOne — Content Script Plugin: Pop-up & Ad Guard v1.0
 * =========================================================
 * Detects, scans, and evaluates pop-up dialogs, overlays, ad banners,
 * and newly spawned popup windows.
 *
 * Multi-Modal Scanning Pipeline:
 *  - Images in pop-ups → Pass to AegisOne Neural Image Detector (/scan/image)
 *  - Links in pop-ups  → Pass to AegisOne URL Model (/scan/url)
 *  - Text in pop-ups   → Pass to AegisOne Text Model (/scan/text)
 *  - Risk Aggregation → Merges pop-up risk probability into main page score & widget.
 */

import { isInternalURL, getRootDomain, isExternalLink } from "../../utils/trusted-domains.js";

const _scannedPopups = new WeakSet();
const _scannedImages = new Set();
const _scannedLinks = new Set();
let _popupScanTimer = null;

// Trusted domains where DOM popup scanning should be skipped (e.g., chat/mail web apps with dynamic custom UI)
const EXCLUDED_DOMAINS = [
  "web.whatsapp.com",
  "whatsapp.com",
  "discord.com",
  "slack.com",
  "web.telegram.org",
  "telegram.org",
  "teams.microsoft.com",
  "mail.google.com",
  "outlook.office.com",
  "outlook.live.com",
  "messenger.com"
];

/**
 * Check if an element or its context is an audio player, voice note, or media control
 */
function _isAudioOrMediaElement(el) {
  if (!el || !(el instanceof HTMLElement)) return false;

  // 1. Direct audio/video tag
  const tag = el.tagName ? el.tagName.toLowerCase() : "";
  if (tag === "audio" || tag === "video" || tag === "source") return true;

  // 2. Contains audio/video tags
  if (el.querySelector("audio, video")) return true;

  // 3. Inspect attributes, class names, IDs, data-attributes, aria-labels for voice notes/media signatures
  const contentStr = (
    (el.className || "") + " " +
    (el.id || "") + " " +
    (el.getAttribute("data-icon") || "") + " " +
    (el.getAttribute("data-testid") || "") + " " +
    (el.getAttribute("aria-label") || "")
  ).toLowerCase();

  const MEDIA_KEYWORDS = ["audio", "voice", "ptt", "waveform", "player", "speech", "media-player", "audio-player", "sound", "record"];
  if (MEDIA_KEYWORDS.some(k => contentStr.includes(k))) return true;

  // 4. Check parent hierarchy for audio / voice note / chat message structures
  if (el.closest && el.closest("[data-icon*='ptt'], [data-testid*='audio'], [class*='audio'], [class*='voice'], [class*='msg']")) {
    return true;
  }

  return false;
}

function safeSendMessage(msg) {
  if (typeof chrome === "undefined" || !chrome?.runtime?.id) {
    return Promise.resolve(null);
  }
  try {
    return chrome.runtime.sendMessage(msg).catch(() => null);
  } catch (_) {
    return Promise.resolve(null);
  }
}

/**
 * Initialize Pop-up & Ad Protection
 */
export function initPopupGuard() {
  // 1. Scan existing DOM popups on page load
  _scanDomPopups();

  // 2. Intercept window.open popups
  _interceptWindowOpen();

  // 3. Monitor dynamic popups & ad overlays injected after load
  const observer = new MutationObserver(() => {
    clearTimeout(_popupScanTimer);
    _popupScanTimer = setTimeout(() => _scanDomPopups(), 800);
  });

  if (document.body) {
    observer.observe(document.body, { childList: true, subtree: true });
  } else {
    document.addEventListener("DOMContentLoaded", () => {
      if (document.body) observer.observe(document.body, { childList: true, subtree: true });
    });
  }

  // 4. Intercept clicks inside high-risk popups
  document.addEventListener("click", _onPopupClick, { capture: true });
}

/**
 * Detect pop-up DOM elements, overlays, modals, and ad containers
 */
function _detectPopupElements() {
  // Skip DOM popup scanning on trusted web apps with heavy custom UI (like WhatsApp, Discord, Slack, Gmail)
  const currentHost = location.hostname.toLowerCase();
  if (EXCLUDED_DOMAINS.some(domain => currentHost === domain || currentHost.endsWith("." + domain))) {
    return [];
  }

  const candidates = [];

  // Query selector for explicit popups, modals, dialogs, and ad containers
  const selector = `
    [role="dialog"], [role="alertdialog"],
    .modal, .popup, .overlay, .lightbox, .interstitial,
    .ad-container, .ad-wrapper, .ad-banner, .adbox, .ad-slot, .ad_container, .ad_wrapper,
    iframe[src*="ad"], iframe[src*="banner"], iframe[src*="doubleclick"]
  `;

  document.querySelectorAll(selector).forEach(el => {
    if (el && !_scannedPopups.has(el) && _isVisible(el) && !_isAudioOrMediaElement(el)) {
      candidates.push(el);
    }
  });

  // Check high z-index fixed/absolute overlay elements
  document.querySelectorAll("div, section, aside").forEach(el => {
    if (_scannedPopups.has(el)) return;
    try {
      if (_isAudioOrMediaElement(el)) return;
      const style = window.getComputedStyle(el);
      const zIndex = parseInt(style.zIndex, 10);
      const isFixedOrAbs = style.position === "fixed" || style.position === "absolute";
      if (isFixedOrAbs && zIndex >= 100 && _isVisible(el) && el.offsetWidth > 100 && el.offsetHeight > 80) {
        // Avoid selecting body or full layout wrappers unless they are floating overlays
        if (el !== document.body && !candidates.includes(el)) {
          candidates.push(el);
        }
      }
    } catch (_) {}
  });

  return candidates.slice(0, 10); // Limit to top 10 popups per pass
}

/**
 * Check if an element is visible on screen
 */
function _isVisible(el) {
  if (!el) return false;
  const style = window.getComputedStyle(el);
  return (
    style.display !== "none" &&
    style.visibility !== "hidden" &&
    style.opacity !== "0" &&
    el.offsetWidth > 0 &&
    el.offsetHeight > 0
  );
}

/**
 * Extract content (images, links, text) from pop-up elements and send to AI models
 */
async function _scanDomPopups() {
  const popups = _detectPopupElements();
  if (!popups.length) return;

  for (const popupEl of popups) {
    _scannedPopups.add(popupEl);

    // ── Extract Images in Pop-up ─────────────────────────
    const images = [];
    popupEl.querySelectorAll("img[src], picture img, svg image").forEach(img => {
      const src = img.src || img.getAttribute("src");
      if (src && src.startsWith("http") && !_scannedImages.has(src)) {
        images.push(src);
        _scannedImages.add(src);
      }
    });

    // Also check CSS background-image
    try {
      const bgImg = window.getComputedStyle(popupEl).backgroundImage;
      if (bgImg && bgImg.includes("url(")) {
        const match = bgImg.match(/url\((['"]?)(.*?)\1\)/);
        if (match && match[2] && match[2].startsWith("http") && !_scannedImages.has(match[2])) {
          images.push(match[2]);
          _scannedImages.add(match[2]);
        }
      }
    } catch (_) {}

    // ── Extract Links in Pop-up ──────────────────────────
    const links = [];
    popupEl.querySelectorAll("a[href], button[data-url], [data-href]").forEach(a => {
      const href = a.href || a.getAttribute("data-url") || a.getAttribute("data-href");
      if (href) {
        try {
          const fullUrl = new URL(href, location.href).href;
          if (fullUrl.startsWith("http") && !isInternalURL(fullUrl) && !_scannedLinks.has(fullUrl)) {
            links.push(fullUrl);
            _scannedLinks.add(fullUrl);
          }
        } catch (_) {}
      }
    });

    // ── Extract Text in Pop-up ───────────────────────────
    const popupText = (popupEl.innerText || "").slice(0, 1000).trim();

    if (!images.length && !links.length && popupText.length < 20) continue;

    // ── Execute Parallel AI Scans for Pop-up Components ─
    let popupRiskScore = 0;
    const popupFactors = [];

    // 1. Image Model Scan
    if (images.length > 0) {
      for (const imgSrc of images.slice(0, 3)) {
        try {
          const imgRes = await safeSendMessage({ type: "SCAN_HOVER_IMAGE", src: imgSrc });
          if (imgRes?.result) {
            const prob = imgRes.result.phishing_probability ?? imgRes.result.score ?? 0;
            const imgScore = Math.round(prob <= 1 ? prob * 100 : prob);
            if (imgScore > popupRiskScore) popupRiskScore = imgScore;
            if (imgScore >= 50) {
              popupFactors.push({ label: `Pop-up banner image flagged: ${imgSrc.slice(0, 50)}… (${imgScore}% risk)` });
            }
          }
        } catch (_) {}
      }
    }

    // 2. Link Model Scan
    if (links.length > 0) {
      try {
        const linkRes = await safeSendMessage({ type: "SEARCH_SCAN", urls: links.slice(0, 5) });
        if (linkRes?.results) {
          linkRes.results.forEach(r => {
            const score = r.score ?? Math.round((r.phishing_probability ?? 0) * 100);
            if (score > popupRiskScore) popupRiskScore = score;
            if (score >= 50) {
              popupFactors.push({ label: `Pop-up redirect target flagged: ${r.url.slice(0, 50)}… (${score}% risk)` });
            }
          });
        }
      } catch (_) {}
    }

    // 3. Heuristic Text Scan for Urgency / Ad Lures in Pop-up
    const lowerText = popupText.toLowerCase();
    const URGENT_LURES = ["claim reward", "winner", "account suspended", "verify immediately", "virus detected", "click here", "cash prize", "free download", "urgent action"];
    const matchedLure = URGENT_LURES.find(l => lowerText.includes(l));
    if (matchedLure) {
      const lureScore = 65;
      if (lureScore > popupRiskScore) popupRiskScore = lureScore;
      popupFactors.push({ label: `Deceptive pop-up lure detected: "${matchedLure}"` });
    }

    // ── Apply Risk Results to Pop-up Element & Pipeline ─
    if (popupRiskScore >= 40) {
      popupEl.dataset.aegisPopupRisk = popupRiskScore;
      _attachPopupBadge(popupEl, popupRiskScore);

      // Dispatch event to main content script to update current page risk score & widget
      const event = new CustomEvent("aegis:popup-scanned", {
        detail: {
          score: popupRiskScore,
          verdict: popupRiskScore >= 75 ? "danger" : "warning",
          threat_type: "phishing_popup",
          top_factors: popupFactors,
          popupEl
        }
      });
      document.dispatchEvent(event);
    }
  }
}

/**
 * Attach Aegis Security Badge to Pop-up Overlay
 */
function _attachPopupBadge(el, score) {
  if (el.querySelector(".aegis-popup-badge")) return;

  const badge = document.createElement("div");
  badge.className = "aegis-popup-badge";
  const isDanger = score >= 75;
  
  badge.style.cssText = `
    position: absolute;
    top: 8px;
    right: 8px;
    z-index: 2147483647;
    background: ${isDanger ? "#dc2626" : "#d97706"};
    color: #ffffff;
    font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif;
    font-size: 11px;
    font-weight: 800;
    padding: 4px 10px;
    border-radius: 20px;
    box-shadow: 0 4px 12px rgba(0, 0, 0, 0.3);
    display: flex;
    align-items: center;
    gap: 6px;
    cursor: pointer;
    pointer-events: auto;
  `;

  badge.innerHTML = `
    <span>🛡️ Aegis Security: Pop-up ${score}% Risk</span>
  `;

  if (window.getComputedStyle(el).position === "static") {
    el.style.position = "relative";
  }

  el.appendChild(badge);
}

/**
 * Intercept clicks inside high-risk popups
 */
function _onPopupClick(e) {
  if (_isAudioOrMediaElement(e.target)) return;

  const popupEl = e.target.closest("[data-aegis-popup-risk]");
  if (!popupEl) return;

  const score = parseInt(popupEl.dataset.aegisPopupRisk, 10) || 0;
  if (score < 50) return;

  const targetLink = e.target.closest("a[href], button");
  if (!targetLink) return;

  const href = targetLink.href || targetLink.getAttribute("data-url") || location.href;

  // Do not intercept same-origin or non-external app links
  if (!href || !isExternalLink(href)) {
    return;
  }

  // Intercept click on high-risk popup links
  e.preventDefault();
  e.stopPropagation();

  import(chrome.runtime.getURL("content/modals.js")).then(({ showWarningModal }) => {
    showWarningModal({
      score,
      verdict: score >= 75 ? "danger" : "warning",
      threat_type: "Phishing Pop-up / Ad Vector",
      top_factors: [
        { label: `High-risk pop-up click intercepted (${score}% risk)` },
        { label: `Target: ${href.slice(0, 60)}` }
      ],
      url: href,
      onContinue: () => {
        if (targetLink.target === "_blank") {
          window.open(href, "_blank");
        } else {
          location.href = href;
        }
      }
    });
  }).catch(() => {});
}

/**
 * Intercept window.open calls to detect new pop-up tabs/windows
 */
function _interceptWindowOpen() {
  if (window.__AEGIS_POPUP_INTERCEPTED__) return;
  window.__AEGIS_POPUP_INTERCEPTED__ = true;

  const originalWindowOpen = window.open;
  window.open = function (url, target, features) {
    if (url && typeof url === "string" && url.startsWith("http") && !isInternalURL(url)) {
      safeSendMessage({
        type: "SCAN_HOVER_URL",
        url
      }).then(r => {
        if (r?.result && r.result.score >= 60) {
          safeSendMessage({
            type: "POPUP_WINDOW_FLAGGED",
            url,
            score: r.result.score,
            verdict: r.result.verdict
          });
        }
      }).catch(() => {});
    }
    return originalWindowOpen.apply(this, [url, target, features]);
  };
}
