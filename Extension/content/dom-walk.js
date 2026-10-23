/**
 * AegisOne — Deep DOM helpers
 * ===========================
 * document.querySelectorAll() cannot see inside open shadow roots or same-origin iframes, so
 * links/forms rendered by web components (very common in modern sites and webmail) were never
 * scanned. These helpers walk those boundaries too. Cross-origin iframes are covered separately by
 * content/frame-guard.js, which runs inside each frame.
 */

const MAX_DEPTH = 6;
const MAX_NODES = 40000; // hard stop so a pathological page cannot stall the tab

export function queryAllDeep(selector, root = document, out = [], state = { seen: 0 }, depth = 0) {
  if (!root || depth > MAX_DEPTH) return out;
  try {
    root.querySelectorAll(selector).forEach(el => out.push(el));
  } catch (_) { return out; }

  let all;
  try { all = root.querySelectorAll("*"); } catch (_) { return out; }
  for (const el of all) {
    if (++state.seen > MAX_NODES) break;
    if (el.shadowRoot) queryAllDeep(selector, el.shadowRoot, out, state, depth + 1);
    if (el.tagName === "IFRAME" || el.tagName === "FRAME") {
      try {
        const doc = el.contentDocument; // null / throws for cross-origin
        if (doc) queryAllDeep(selector, doc, out, state, depth + 1);
      } catch (_) { /* cross-origin: frame-guard handles it */ }
    }
  }
  return out;
}

/** Every http(s) anchor on the page (deep), with its resolved absolute href. */
export function collectLinks() {
  const out = [];
  for (const a of queryAllDeep("a[href], area[href]")) {
    try {
      const href = new URL(a.getAttribute("href"), a.ownerDocument?.baseURI || location.href).href;
      if (href.startsWith("http")) out.push({ el: a, href });
    } catch (_) { }
  }
  return out;
}

export function isInViewport(el) {
  try {
    const r = el.getBoundingClientRect();
    return r.bottom > 0 && r.right > 0 &&
      r.top < (window.innerHeight || 0) && r.left < (window.innerWidth || 0) &&
      r.width > 0 && r.height > 0;
  } catch (_) { return false; }
}
