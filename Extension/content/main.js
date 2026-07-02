/**
 * AegisOne — Content Script Main Entry Point v2.0
 * =================================================
 * Orchestrates all content-side modules.
 *
 * Initialization flow:
 * 1. Guard against duplicate injection
 * 2. Create floating widget
 * 3. Extract DOM features (non-blocking)
 * 4. Send features to background for risk calculation
 * 5. Initialize search badges (if on search engine)
 * 6. Initialize link scanner
 * 7. Initialize form guard
 * 8. Set up message listeners from background
 * 9. Set up SPA navigation watcher (30s heartbeat)
 */

(function () {
  // ── Guard ─────────────────────────────────────────────
  if (window.__AEGIS_INJECTED__) return;
  if (window.self !== window.top) return;
  if (location.protocol === "chrome-extension:") return;
  window.__AEGIS_INJECTED__ = true;

  // ── Lazy-load modules (won't slow page load) ──────────
  let _widget = null;
  let _currentScanData = null;

  // Debounce utility
  function debounce(fn, ms) {
    let t;
    return (...args) => { clearTimeout(t); t = setTimeout(() => fn(...args), ms); };
  }

  // ── Step 1: Create widget immediately ─────────────────
  // Dynamic import of widget module
  async function init() {
    try {
      const [
        { createWidget, updateWidget, updateThreatCount },
        { initSearchBadges },
        { initLinkScanner, applyDangerBadges },
        { initFormGuard, setCurrentRisk },
        { showWarningModal, showXAIModal, showDownloadModal, showRightClickResult },
      ] = await Promise.all([
        import(chrome.runtime.getURL("content/widget.js")),
        import(chrome.runtime.getURL("content/search-badges.js")),
        import(chrome.runtime.getURL("content/link-scanner.js")),
        import(chrome.runtime.getURL("content/form-guard.js")),
        import(chrome.runtime.getURL("content/modals.js")),
      ]);

      // ── Widget ──────────────────────────────────────
      _widget = createWidget();

      // ── DOM Feature Extraction ──────────────────────
      const features = _extractPageFeatures();

      // ── Form Guard ──────────────────────────────────
      initFormGuard((formFeatures) => {
        // Merge form features into extracted features
        Object.assign(features, formFeatures);
      });

      // ── Send features to background ─────────────────
      const scanResult = await chrome.runtime.sendMessage({
        type: "PAGE_FEATURES",
        url: window.location.href,
        features,
      }).catch(() => null);

      if (scanResult?.result) {
        _currentScanData = scanResult.result;
        setCurrentRisk(scanResult.result.score);
        updateWidget(scanResult.result);
      }

      // ── Search Badges ───────────────────────────────
      const isSearchPage = /google\.|bing\.com|duckduckgo\.com/.test(location.hostname);
      if (isSearchPage) initSearchBadges();

      // ── Link Scanner ────────────────────────────────
      initLinkScanner();

      // ── Message Handler ─────────────────────────────
      chrome.runtime.onMessage.addListener((msg) => {
        switch (msg.type) {
          case "SCAN_RESULT":
            _currentScanData = msg;
            setCurrentRisk(msg.score);
            updateWidget(msg);
            
            // If the DOM scan pushes the score to High Risk (>= 80), show warning modal
            if (msg.score >= 80) {
              showWarningModal({
                score: msg.score,
                verdict: msg.verdict,
                threat_type: msg.threat_type,
                top_factors: msg.top_factors,
                url: window.location.href,
              });
            }
            break;

          case "SHOW_WARNING":
            if (msg.score >= 80) {
              showWarningModal({
                score: msg.score,
                verdict: msg.verdict,
                threat_type: msg.threat_type,
                top_factors: msg.top_factors,
                url: window.location.href,
              });
            }
            updateWidget(msg);
            break;

          case "HIGHLIGHT_THREATS":
            if (msg.maliciousUrls?.length > 0) {
              applyDangerBadges(msg.maliciousUrls);
              updateThreatCount(msg.maliciousUrls.length);
            }
            break;

          case "PROMPT_DOWNLOAD_DECISION":
            showDownloadModal(msg);
            break;

          case "RIGHT_CLICK_SCAN":
            showRightClickResult(msg);
            break;

          case "TRIGGER_FULL_SCAN":
            _triggerFullPageScan(updateWidget, updateThreatCount);
            break;
        }
      });

      // ── Custom Events (from widget buttons) ─────────
      document.addEventListener("aegis:show-details", () => {
        if (_currentScanData) {
          showXAIModal(
            { main_reasons: (_currentScanData.top_factors || []).map(f => f.label) },
            { score: _currentScanData.score, url: location.href, threat_type: _currentScanData.threat_type }
          );
        }
      });

      document.addEventListener("aegis:show-xai", (e) => {
        showXAIModal(e.detail, {
          score: _currentScanData?.score,
          url: location.href,
          threat_type: _currentScanData?.threat_type,
        });
      });

      // ── SPA Navigation Watcher ───────────────────────
      let _lastUrl = location.href;
      const _navWatcher = setInterval(() => {
        if (location.href !== _lastUrl) {
          _lastUrl = location.href;
          window.__AEGIS_WARNING_DISMISSED__ = false; // Reset warning state on new SPA view
          // Re-scan on SPA navigation
          const updated = _extractPageFeatures();
          chrome.runtime.sendMessage({
            type: "PAGE_FEATURES",
            url: location.href,
            features: updated,
          }).then(r => {
            if (r?.result) {
              _currentScanData = r.result;
              setCurrentRisk(r.result.score);
              updateWidget(r.result);
            }
          }).catch(() => {});
        }
      }, 1500);

      // ── Gmail / Outlook email detection ─────────────
      _watchForEmails();

    } catch (err) {
      console.warn("[AegisOne] Initialization error:", err);
    }
  }

  // ── DOM Feature Extraction ────────────────────────────
  function _extractPageFeatures() {
    const scripts = [...document.querySelectorAll("script")];
    const iframes = [...document.querySelectorAll("iframe")];
    const forms = [...document.querySelectorAll("form")];
    const links = [...document.querySelectorAll("a[href]")];
    const images = [...document.querySelectorAll("img[src]")];

    // Hidden iframe detection
    const hiddenIframes = iframes.filter(f => {
      const s = window.getComputedStyle(f);
      return (
        s.display === "none" ||
        s.visibility === "hidden" ||
        parseInt(f.width) < 3 ||
        parseInt(f.height) < 3 ||
        f.getAttribute("width") === "0" ||
        f.getAttribute("height") === "0"
      );
    });

    // JS obfuscation heuristic (eval + long hex strings)
    const inlineScripts = scripts.filter(s => !s.src).map(s => s.textContent || "");
    const jsObfuscated = inlineScripts.some(js =>
      /eval\s*\(/.test(js) ||
      /\\x[0-9a-f]{2}/i.test(js) ||
      /fromCharCode/.test(js) ||
      /unescape\s*\(/.test(js)
    );

    // External scripts
    const externalScripts = scripts
      .filter(s => s.src && !s.src.includes(location.hostname))
      .map(s => s.src)
      .slice(0, 20);

    // Page text for NLP model
    const text_snippet = (document.body?.innerText || "").slice(0, 300).replace(/\s+/g, " ");
    const full_text = (document.body?.innerText || "").slice(0, 3000);

    // Password inputs
    const passwordInputs = document.querySelectorAll('input[type="password"]');
    const login_form_found = passwordInputs.length > 0;
    const form_count = forms.filter(f => f.querySelector('input[type="password"]')).length;

    // SSL: can't read this from content script — background handles via URL features
    // Redirect count: background tracks via webRequest

    return {
      text_snippet,
      full_text,
      hidden_iframes: hiddenIframes.map(f => f.src || "").filter(Boolean),
      hidden_iframe: hiddenIframes.length > 0,
      js_obfuscated: jsObfuscated,
      external_scripts: externalScripts,
      login_form_found,
      form_count,
      page_title: document.title || "",
      image_count: images.length,
      link_count: links.length,
    };
  }

  // ── Full Page Scan (manual trigger) ──────────────────
  async function _triggerFullPageScan(updateWidget, updateThreatCount) {
    const btn = document.getElementById("aegis-btn-scan");
    if (btn) btn.textContent = "⏳";

    const pageText = document.body?.innerText?.slice(0, 3000) || "";
    const allLinks = [...new Set(
      [...document.querySelectorAll("a[href]")]
        .map(a => { try { return new URL(a.href, location.href).href; } catch { return ""; } })
        .filter(u => u.startsWith("http"))
    )];
    const allImageSrcs = [...new Set(
      [...document.querySelectorAll("img[src]")]
        .map(i => i.src).filter(s => s && !s.startsWith("data:"))
    )].slice(0, 12);

    const res = await chrome.runtime.sendMessage({
      type: "FULL_PAGE_SCAN",
      pageUrl: window.location.href,
      pageText,
      allLinks,
      allImageSrcs,
    }).catch(() => null);

    if (btn) btn.textContent = "🔍";

    if (res?.report) {
      const score = Math.round((res.report.composite_risk || 0) * 100);
      updateWidget({ score, verdict: score >= 80 ? "danger" : score >= 50 ? "warning" : "safe" });
      const badUrls = (res.report.url_results || [])
        .filter(u => (u.phishing_probability || 0) >= 0.85)
        .map(u => u.url);
      updateThreatCount(badUrls.length);
    }
  }

  // ── Email Detection (Gmail / Outlook) ─────────────────
  function _watchForEmails() {
    const isGmail = location.hostname.includes("mail.google.com");
    const isOutlook = location.hostname.includes("outlook.") || location.hostname.includes("office.com");

    if (!isGmail && !isOutlook) return;

    const _emailCache = new Set();

    const emailObserver = new MutationObserver(debounce(() => {
      let sender = "", subject = "", body = "";

      if (isGmail) {
        const senderEl = document.querySelector('[email], [data-hovercard-id]');
        const subjectEl = document.querySelector("h2[data-thread-perm-id], .hP");
        const bodyEl = document.querySelector(".a3s.aiL");
        sender = senderEl?.getAttribute("email") || senderEl?.getAttribute("data-hovercard-id") || "";
        subject = subjectEl?.textContent?.trim() || "";
        body = bodyEl?.innerText?.slice(0, 2000) || "";
      } else if (isOutlook) {
        const senderEl = document.querySelector('[data-convid] .oG');
        const subjectEl = document.querySelector('.cN');
        const bodyEl = document.querySelector('.rps');
        sender = senderEl?.textContent?.trim() || "";
        subject = subjectEl?.textContent?.trim() || "";
        body = bodyEl?.innerText?.slice(0, 2000) || "";
      }

      if (!subject || _emailCache.has(subject + sender)) return;
      _emailCache.add(subject + sender);

      if (body.length > 50) {
        chrome.runtime.sendMessage({
          type: "EMAIL_DATA",
          sender, subject, body,
        }).catch(() => {});
      }
    }, 1500));

    emailObserver.observe(document.body, { childList: true, subtree: true });
  }

  // ── Initialize ────────────────────────────────────────
  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", init);
  } else {
    init();
  }

})();
