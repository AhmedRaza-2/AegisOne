/**
 * AegisOne — Content Script Plugin: QR Guard
 * ==========================================
 * A QR code hides its destination, so people scan it with a phone without seeing where it leads.
 * This plugin finds QR-shaped images/canvases on the page, has the AegisOne server decode them,
 * scans whatever address or text is inside, and prints the real destination and verdict right
 * under the code - BEFORE anyone scans or opens it.
 *
 * Bounded on purpose: only square-ish pictures of QR size (or ones that say "qr"), only when they
 * come into view, at most MAX_PER_PAGE per page, two at a time. Decoding itself happens on the
 * organization's own server (OpenCV), the same place every other image is analysed.
 */

const MIN_PX = 80;
const MAX_PX = 1100;
const MAX_PER_PAGE = 12;
const CONCURRENCY = 2;

const _seen = new Set();          // identities already handled
let _active = 0;
let _count = 0;
const _queue = [];

function safeSend(msg) {
  if (typeof chrome === "undefined" || !chrome?.runtime?.id) return Promise.resolve(null);
  try { return chrome.runtime.sendMessage(msg).catch(() => null); } catch (_) { return Promise.resolve(null); }
}

function _identity(src) {
  return src.length > 200 ? `${src.length}:${src.slice(0, 80)}:${src.slice(-80)}` : src;
}

function _qrHinted(el) {
  const s = `${el.id || ""} ${el.className && el.className.baseVal !== undefined ? el.className.baseVal : el.className || ""} ${el.getAttribute?.("alt") || ""} ${el.getAttribute?.("src") || ""} ${el.getAttribute?.("aria-label") || ""}`;
  return /\bqr|qr[-_ ]?code|qrcode/i.test(s);
}

function _eligible(el) {
  const r = el.getBoundingClientRect();
  if (r.width < MIN_PX || r.height < MIN_PX || r.width > MAX_PX || r.height > MAX_PX) return false;
  const ratio = r.width / r.height;
  return (ratio > 0.85 && ratio < 1.18) || _qrHinted(el);
}

function _srcOf(el) {
  if (el instanceof HTMLImageElement) {
    const src = el.currentSrc || el.src || "";
    return /^(https?:|data:image\/)/i.test(src) ? src : "";
  }
  if (el instanceof HTMLCanvasElement) {
    try { return el.toDataURL("image/png"); } catch (_) { return ""; } // tainted canvas: skip
  }
  return "";
}

function _short(payload) {
  const t = String(payload || "").trim();
  try { const u = new URL(t); return u.hostname + (u.pathname !== "/" ? u.pathname : ""); } catch (_) { return t; }
}

function _label(el, qr) {
  // Remove any previous label for this element, then add a fresh one. Text only (textContent):
  // the QR payload is attacker-controlled and must never be parsed as HTML.
  if (el.__aegisQrLabel) el.__aegisQrLabel.remove();
  const risk = Math.round(qr.risk || 0);
  const level = risk >= 70 ? "danger" : risk >= 40 ? "warn" : "safe";
  const palette = {
    danger: ["#450a0a", "#ef4444", "🚨 Dangerous QR code"],
    warn:   ["#451a03", "#f59e0b", "⚠ Suspicious QR code"],
    safe:   ["#022c22", "#10b981", "🛡️ QR code checked"],
  }[level];
  const box = document.createElement("div");
  box.setAttribute("data-aegis-qr-label", "1");
  box.style.cssText = `display:block;margin:4px 0;padding:6px 8px;max-width:320px;border-radius:8px;` +
    `background:${palette[0]};border:1px solid ${palette[1]};color:#f8fafc;font:600 11px/1.35 -apple-system,Segoe UI,Roboto,sans-serif;` +
    `word-break:break-all;z-index:2147483646;position:relative;`;
  const head = document.createElement("div");
  head.textContent = `${palette[2]} (${risk}% risk)`;
  head.style.cssText = `color:${palette[1]};font-weight:800;`;
  const dest = document.createElement("div");
  dest.textContent = `Leads to: ${_short(qr.payload)}`;
  dest.style.cssText = "font-weight:500;opacity:.92;";
  box.append(head, dest);
  if (level !== "safe") {
    const tip = document.createElement("div");
    tip.textContent = "Do not scan this code or open the address.";
    tip.style.cssText = "margin-top:2px;font-weight:700;";
    box.append(tip);
    el.style.setProperty("outline", `3px solid ${palette[1]}`, "important");
  }
  el.insertAdjacentElement("afterend", box);
  el.__aegisQrLabel = box;
}

async function _process(el) {
  const src = _srcOf(el);
  if (!src) return;
  const id = _identity(src);
  if (_seen.has(id)) return;
  _seen.add(id);

  const res = await safeSend({ type: "SCAN_HOVER_IMAGE", src });
  const result = res?.ok ? res.result : null;
  const codes = result?.image_evidence?.qr_codes;
  if (!Array.isArray(codes) || !codes.length) return;   // not a QR code: stay silent
  // Worst code first
  const worst = [...codes].sort((a, b) => (b.risk || 0) - (a.risk || 0))[0];
  _label(el, worst);
}

function _pump() {
  while (_active < CONCURRENCY && _queue.length) {
    const el = _queue.shift();
    _active++;
    _process(el).catch(() => { }).finally(() => { _active--; _pump(); });
  }
}

function _enqueue(el) {
  if (_count >= MAX_PER_PAGE || el.__aegisQrQueued) return;
  if (!_eligible(el)) return;
  el.__aegisQrQueued = true;
  _count++;
  _queue.push(el);
  _pump();
}

export function initQrGuard() {
  if (window.__AEGIS_QR_GUARD__) return;
  window.__AEGIS_QR_GUARD__ = true;

  const io = ("IntersectionObserver" in window)
    ? new IntersectionObserver((entries) => {
        for (const e of entries) if (e.isIntersecting) { io.unobserve(e.target); _enqueue(e.target); }
      }, { rootMargin: "200px" })
    : null;

  const consider = (el) => {
    if (!(el instanceof HTMLImageElement || el instanceof HTMLCanvasElement) || el.__aegisQrSeen) return;
    el.__aegisQrSeen = true;
    const run = () => (io ? io.observe(el) : _enqueue(el));
    if (el instanceof HTMLImageElement && !el.complete) el.addEventListener("load", run, { once: true });
    else run();
  };

  const sweep = (root) => {
    if (!root.querySelectorAll) return;
    root.querySelectorAll("img, canvas").forEach(consider);
  };

  sweep(document);
  let t = null;
  new MutationObserver((muts) => {
    clearTimeout(t);
    t = setTimeout(() => {
      for (const m of muts) m.addedNodes.forEach(n => {
        if (n.nodeType !== 1) return;
        consider(n);
        sweep(n);
      });
    }, 500);
  }).observe(document.body, { childList: true, subtree: true });
}
