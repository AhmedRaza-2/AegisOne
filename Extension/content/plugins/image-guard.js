/**
 * AegisOne — Content Script Plugin: Automatic Image Guard
 * =========================================================
 * Scans images on ordinary web pages without the user having to right-click.
 *
 * Two triggers, no clicking needed:
 *   1. AUTOMATIC  - images that scroll into view are queued and scanned in the background
 *      (substantial images only, a bounded number per page, two at a time). A flagged image is
 *      outlined in red the moment the verdict arrives; safe images are left untouched.
 *   2. HOVER      - resting the cursor on any eligible image shows its verdict (instant when the
 *      automatic scan already covered it) and scans it if it has not been seen yet.
 * Tiny icons/avatars/emoji, data: images and already-scanned images are skipped. The per-page
 * cap and concurrency keep server cost and data leaving the browser bounded.
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

const AUTO_MIN_DIMENSION_PX = 120;   // automatic scanning skips anything smaller than this
const AUTO_MAX_PER_PAGE = 12;
const AUTO_CONCURRENCY = 2;
const FLAG_SCORE = 50;

const _scannedSrcs = new Map(); // src -> {score, verdict} | "pending" | "failed"
let _activeTooltip = null;
let _autoCount = 0;
let _autoRunning = 0;
const _autoQueue = [];

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

function _flag(img, score) {
  try {
    img.style.outline = "3px solid #ef4444";
    img.style.outlineOffset = "-3px";
    img.setAttribute("title", `AegisOne: this image looks like part of a phishing attempt (${score}%)`);
    img.setAttribute("data-aegis-flagged", "1");
  } catch (_) { /* never break the page */ }
}

async function _autoScan(img) {
  const src = img.currentSrc || img.src;
  if (!src || _scannedSrcs.has(src)) return;
  _scannedSrcs.set(src, "pending");
  const res = await safeSendMessage({ type: "SCAN_HOVER_IMAGE", src });
  const result = res?.ok ? res.result : null;
  if (!result) { _scannedSrcs.set(src, "failed"); return; }
  const prob = result.phishing_probability ?? (result.score != null ? result.score / 100 : 0);
  const score = Math.round(prob <= 1 ? prob * 100 : prob);
  _scannedSrcs.set(src, { score, verdict: result.prediction });
  if (score >= FLAG_SCORE) _flag(img, score);
}

function _pump() {
  while (_autoRunning < AUTO_CONCURRENCY && _autoQueue.length) {
    const img = _autoQueue.shift();
    _autoRunning++;
    _autoScan(img).finally(() => { _autoRunning--; _pump(); });
  }
}

function _autoEligible(img) {
  if (!_isEligible(img)) return false;
  const rect = img.getBoundingClientRect();
  return rect.width >= AUTO_MIN_DIMENSION_PX && rect.height >= AUTO_MIN_DIMENSION_PX;
}

function _startAutoScan() {
  if (typeof IntersectionObserver === "undefined") return;
  const seen = new WeakSet();
  const io = new IntersectionObserver((entries) => {
    for (const e of entries) {
      if (!e.isIntersecting) continue;
      const img = e.target;
      io.unobserve(img);
      if (_autoCount >= AUTO_MAX_PER_PAGE || !_autoEligible(img)) continue;
      const src = img.currentSrc || img.src;
      if (_scannedSrcs.has(src)) continue;
      _autoCount++;
      _autoQueue.push(img);
    }
    _pump();
  }, { threshold: 0.4 });

  const watch = (img) => {
    if (!(img instanceof HTMLImageElement) || seen.has(img)) return;
    seen.add(img);
    if (img.complete) io.observe(img);
    else img.addEventListener("load", () => io.observe(img), { once: true });   // lazy-loaded images
  };
  document.querySelectorAll("img").forEach(watch);
  new MutationObserver((muts) => {
    for (const m of muts) for (const n of m.addedNodes) {
      if (n instanceof HTMLImageElement) watch(n);
      else if (n.querySelectorAll) n.querySelectorAll("img").forEach(watch);
    }
  }).observe(document.documentElement, { childList: true, subtree: true });
}

export function initImageGuard() {
  const host = location.hostname.toLowerCase();
  if (EXCLUDED_DOMAINS.some(d => host === d || host.endsWith("." + d))) return;

  _startAutoScan();

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
