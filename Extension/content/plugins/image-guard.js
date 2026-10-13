/**
 * AegisOne — Content Script Plugin: Automatic Image Guard
 * =========================================================
 * Scans images on ordinary web pages without the user having to right-click.
 *
 * This is deliberately hover-triggered, not blanket-automatic: it never sends every
 * <img> on a page to the vision model on load. Instead a scan starts only once the
 * user's cursor rests on an image for a short moment — the same signal a person uses
 * to actually look at an image — which keeps it "automatic" (no click needed) while
 * bounding both server cost and how much image data ever leaves the browser. Tiny
 * icons/avatars/emoji and already-scanned images are skipped outright.
 *
 * Pages with their own specialized image handling (popups via popup-guard.js, email
 * bodies via email-guard.js) are excluded here to avoid double-scanning the same image
 * through two different paths. WhatsApp is deliberately NOT excluded: its own plugin
 * (whatsapp-guard.js) only scans message text/links, not images, so this is the one
 * path that covers WhatsApp images.
 */

const EXCLUDED_DOMAINS = [
  "mail.google.com",
  "outlook.office.com",
  "outlook.live.com",
];

const HOVER_DEBOUNCE_MS = 400;
const MIN_DIMENSION_PX = 60; // skip icons/avatars/emoji
const MAX_TOOLTIP_MS = 2200;

const _scannedSrcs = new Map(); // src -> {score, verdict} | "pending" | "failed"
let _activeTooltip = null;

function safeSendMessage(msg) {
  if (typeof chrome === "undefined" || !chrome?.runtime?.id) return Promise.resolve(null);
  try {
    return chrome.runtime.sendMessage(msg).catch(() => null);
  } catch (_) {
    return Promise.resolve(null);
  }
}

function _isEligible(img) {
  if (!img || !(img instanceof HTMLImageElement)) return false;
  const src = img.currentSrc || img.src;
  if (!src || !/^https?:\/\//i.test(src)) return false; // skip data:/blob: — not worth a round trip
  if (img.naturalWidth && img.naturalWidth < MIN_DIMENSION_PX) return false;
  if (img.naturalHeight && img.naturalHeight < MIN_DIMENSION_PX) return false;
  const rect = img.getBoundingClientRect();
  if (rect.width < MIN_DIMENSION_PX || rect.height < MIN_DIMENSION_PX) return false;
  return true;
}

function _showTooltip(img, html, borderColor, bg) {
  if (_activeTooltip) _activeTooltip.remove();
  const rect = img.getBoundingClientRect();
  const tip = document.createElement("div");
  tip.style.cssText = `
    position: fixed;
    top: ${Math.max(6, rect.top - 30)}px;
    left: ${Math.min(rect.left, window.innerWidth - 190)}px;
    z-index: 2147483647;
    background: ${bg};
    color: #f8fafc;
    border: 1px solid ${borderColor};
    border-radius: 6px;
    padding: 3px 8px;
    font-size: 11px;
    font-weight: 600;
    font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif;
    box-shadow: 0 4px 12px rgba(0,0,0,0.35);
    pointer-events: none;
    max-width: 190px;
  `;
  tip.innerHTML = html;
  document.body.appendChild(tip);
  _activeTooltip = tip;
  setTimeout(() => { if (_activeTooltip === tip) { tip.remove(); _activeTooltip = null; } }, MAX_TOOLTIP_MS);
}

async function _scanOnHover(img) {
  const src = img.currentSrc || img.src;
  const cached = _scannedSrcs.get(src);

  if (cached && cached !== "pending" && cached !== "failed") {
    const isPhish = cached.score >= 50;
    _showTooltip(
      img,
      isPhish ? `🚨 Threat (${cached.score}%)` : `🛡️ Verified safe`,
      isPhish ? "rgba(239,68,68,0.6)" : "rgba(16,185,129,0.6)",
      isPhish ? "rgba(69,10,10,0.95)" : "rgba(6,78,59,0.95)",
    );
    return;
  }
  if (cached === "pending") return;

  _scannedSrcs.set(src, "pending");
  _showTooltip(img, `🛡️ Scanning…`, "rgba(59,130,246,0.5)", "rgba(15,23,42,0.95)");

  const res = await safeSendMessage({ type: "SCAN_HOVER_IMAGE", src });
  const result = res?.ok ? res.result : null;
  if (!result) {
    _scannedSrcs.set(src, "failed");
    if (_activeTooltip) { _activeTooltip.remove(); _activeTooltip = null; }
    return;
  }

  const prob = result.phishing_probability ?? (result.score != null ? result.score / 100 : 0);
  const score = Math.round(prob <= 1 ? prob * 100 : prob);
  _scannedSrcs.set(src, { score, verdict: result.prediction });

  const isPhish = score >= 50;
  _showTooltip(
    img,
    isPhish ? `🚨 Threat (${score}%)` : `🛡️ Verified safe`,
    isPhish ? "rgba(239,68,68,0.6)" : "rgba(16,185,129,0.6)",
    isPhish ? "rgba(69,10,10,0.95)" : "rgba(6,78,59,0.95)",
  );
}

export function initImageGuard() {
  const host = location.hostname.toLowerCase();
  if (EXCLUDED_DOMAINS.some(d => host === d || host.endsWith("." + d))) return;

  let hoverTimer = null;
  let hoveredImg = null;

  document.addEventListener("mouseover", (e) => {
    const img = e.target.closest ? e.target.closest("img") : null;
    if (!img || !_isEligible(img)) return;
    if (img === hoveredImg) return;
    hoveredImg = img;
    clearTimeout(hoverTimer);
    hoverTimer = setTimeout(() => {
      if (hoveredImg === img) _scanOnHover(img);
    }, HOVER_DEBOUNCE_MS);
  }, { passive: true });

  document.addEventListener("mouseout", (e) => {
    const img = e.target.closest ? e.target.closest("img") : null;
    if (img && img === hoveredImg) {
      hoveredImg = null;
      clearTimeout(hoverTimer);
    }
  }, { passive: true });
}
