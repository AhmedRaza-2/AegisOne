/**
 * AegisOne — Frame Guard
 * ======================
 * content/main.js only runs in the top document, so everything inside an <iframe> was invisible to
 * the extension: login forms embedded from another origin, links in framed webmail/ads/widgets,
 * and cross-origin pages shown inside a legitimate-looking shell. This script runs in every
 * sub-frame and covers the same ground:
 *   1. scans the frame's own address (cached by the background worker),
 *   2. protects any password/credential form inside the frame (HTTP action, foreign action domain,
 *      high-risk frame),
 *   3. scans and badges every link inside the frame,
 *   4. reports a high-risk credential frame to the top page so the user is warned where they look.
 */
(function () {
  if (window.self === window.top) return;                 // top document is handled by main.js
  if (window.__AEGIS_FRAME_GUARD__) return;
  if (!/^https?:$/.test(location.protocol)) return;       // about:blank / srcdoc / data frames carry no origin to judge
  window.__AEGIS_FRAME_GUARD__ = true;

  function safeSend(msg) {
    if (typeof chrome === "undefined" || !chrome?.runtime?.id) return Promise.resolve(null);
    try { return chrome.runtime.sendMessage(msg).catch(() => null); } catch (_) { return Promise.resolve(null); }
  }

  async function run() {
    let mods;
    try {
      mods = await Promise.all([
        import(chrome.runtime.getURL("utils/constants.js")),
        import(chrome.runtime.getURL("content/dom-walk.js")),
        import(chrome.runtime.getURL("content/form-guard.js")),
        import(chrome.runtime.getURL("content/link-scanner.js")),
        import(chrome.runtime.getURL("utils/trusted-domains.js")),
      ]);
    } catch (_) { return; }
    const [{ MSG }, { queryAllDeep }, { initFormGuard, setCurrentRisk }, { initLinkScanner }, { isKnownSafeHost }] = mods;

    if (isKnownSafeHost(location.hostname)) return;       // e.g. embedded YouTube / Google widgets

    const hasPassword = () => queryAllDeep('input[type="password"]').length > 0;
    const hasLinks = () => queryAllDeep("a[href]").length > 0;

    // 1. Judge the frame's own address.
    const res = await safeSend({ type: MSG.SCAN_HOVER_URL, url: location.href });
    const score = res?.result?.score;
    if (typeof score === "number" && score >= 0) setCurrentRisk(score);

    // 2. Credential protection inside the frame (re-checks when forms appear later).
    if (document.body) initFormGuard(() => {});

    // 3. Links inside the frame.
    if (document.body && hasLinks()) initLinkScanner();

    // 4. Tell the top page when a risky frame is asking for a password.
    const report = async () => {
      if (!hasPassword()) return;
      await safeSend({
        type: "FRAME_RISK",
        frameUrl: location.href,
        score: typeof score === "number" ? score : 0,
        hasPassword: true,
        threat_type: res?.result?.threat_type,
        top_factors: res?.result?.top_factors,
      });
    };
    await report();
    // Password boxes that appear after load (login popups, lazy widgets).
    let t = null;
    new MutationObserver(() => { clearTimeout(t); t = setTimeout(report, 800); })
      .observe(document.documentElement, { childList: true, subtree: true });
  }

  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", run);
  else run();
})();
