/**
 * AegisOne — Content Script Main Entry Point v2.2
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
 * 9. Set up SPA navigation watcher
 */

(function () {
  // ── Guard ─────────────────────────────────────────────
  if (window.__AEGIS_INJECTED__) return;
  if (window.self !== window.top) return;
  if (location.protocol === "chrome-extension:") return;
  window.__AEGIS_INJECTED__ = true;

  const _DEBUG = false; // mirrors background DEBUG_MODE — set false for production

  let _widget = null;
  let _currentScanData = null;
  let _deepScanTimer = null;
  let _deepScanInFlight = false;

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

  // Debounce utility
  function debounce(fn, ms) {
    let t;
    return (...args) => { clearTimeout(t); t = setTimeout(() => fn(...args), ms); };
  }

  // Expose telemetry data to DOM to cross JS execution worlds (isolated content script -> page test crawler)
  function _exposeTelemetryToDOM(id, data) {
    if (!document.body) {
      document.addEventListener("DOMContentLoaded", () => _exposeTelemetryToDOM(id, data));
      return;
    }
    let el = document.getElementById(id);
    if (!el) {
      el = document.createElement("div");
      el.id = id;
      el.style.display = "none";
      document.body.appendChild(el);
    }
    el.textContent = JSON.stringify(data);
  }

  // ── Step 1: Create widget immediately ─────────────────
  async function init() {
    try {
      const [
        { STORE_KEYS, API_BASE },
        { createWidget, updateWidget, updateThreatCount },
        { initSearchBadges },
        { initLinkScanner, applyDangerBadges },
        { initFormGuard, setCurrentRisk },
        { showWarningModal, showXAIModal, showDownloadModal, showRightClickResult, showTextScanResult },
        { getRootDomain, isTrusted },
        { initEmailGuard },
        { initWhatsappGuard },
      ] = await Promise.all([
        import(chrome.runtime.getURL("utils/constants.js")),  // imports API_BASE, DEBUG_MODE, etc.
        import(chrome.runtime.getURL("content/widget.js")),
        import(chrome.runtime.getURL("content/search-badges.js")),
        import(chrome.runtime.getURL("content/link-scanner.js")),
        import(chrome.runtime.getURL("content/form-guard.js")),
        import(chrome.runtime.getURL("content/modals.js")),
        import(chrome.runtime.getURL("utils/trusted-domains.js")),
        import(chrome.runtime.getURL("content/plugins/email-guard.js")),
        import(chrome.runtime.getURL("content/plugins/whatsapp-guard.js")),
      ]);

      const policy = await chrome.storage.local.get([STORE_KEYS.ALLOWLIST]);
      const allowlist = Array.isArray(policy[STORE_KEYS.ALLOWLIST]) ? policy[STORE_KEYS.ALLOWLIST] : [];
      const isAllowlistedPage = _matchesDomainList(getRootDomain(location.href), allowlist);

      // ── Sync Dashboard Logged-In User ───────────────
      // One-time sync at page load (catches full-page navigations)
      if (location.hostname === "localhost" || location.hostname === "127.0.0.1" || location.hostname.includes("aegisone")) {
        try {
          const rawUser = localStorage.getItem("user");
          if (rawUser) {
            const userObj = JSON.parse(rawUser);
            if (userObj && userObj.email) {
              chrome.storage.local.set({ user_email: userObj.email });
              safeSendMessage({ type: "AUTH_UPDATED", email: userObj.email });
            }
          } else {
            chrome.storage.local.remove(["user_email"]);
            safeSendMessage({ type: "AUTH_CLEARED" });
          }
        } catch (e) {}

        // ── Live login/logout listeners (SPA client-side navigation) ──
        // Dashboard fires these events so we don't need a full page reload
        window.addEventListener("aegis-user-login", (e) => {
          try {
            const email = e.detail?.email;
            if (email) {
              chrome.storage.local.set({ user_email: email });
              safeSendMessage({ type: "AUTH_UPDATED", email });
            }
          } catch (_) {}
        });

        window.addEventListener("aegis-user-logout", () => {
          try {
            chrome.storage.local.remove(["user_email"]);
            safeSendMessage({ type: "AUTH_CLEARED" });
          } catch (_) {}
        });
      }

      // ── Widget ──────────────────────────────────────
      _widget = createWidget();

      try {
        chrome.storage.local.get(["widgetOpacity", "widgetScale"], (stored) => {
          if (stored.widgetOpacity != null) {
            document.dispatchEvent(new CustomEvent("aegis:widget-opacity", { detail: { opacity: stored.widgetOpacity } }));
          }
          if (stored.widgetScale != null) {
            document.dispatchEvent(new CustomEvent("aegis:widget-scale", { detail: { scale: stored.widgetScale } }));
          }
        });
      } catch (_) {}

      // ── DOM Feature Extraction ──────────────────────
      const features = _extractPageFeatures();
      _exposeTelemetryToDOM("aegis-page-features", features);

      // ── Form Guard ──────────────────────────────────
      initFormGuard((formFeatures) => {
        Object.assign(features, formFeatures);
        _exposeTelemetryToDOM("aegis-page-features", features);
      });

      // ── Send features to background ─────────────────
      const scanResult = await safeSendMessage({
        type: "PAGE_FEATURES",
        url: window.location.href,
        features,
      });

      if (scanResult?.result) {
        _currentScanData = scanResult.result;
        _exposeTelemetryToDOM("aegis-scan-data", scanResult.result);
        setCurrentRisk(scanResult.result.score);
        updateWidget(scanResult.result);
      }

      // ── Diagnostic channel (test harness only — no scoring impact) ───
      // Fires unconditionally so run_diagnostic.py can capture L3 state
      // even when scanResult is null (e.g. background service worker restart).
      console.info("[AEGIS:L3]", JSON.stringify({
        url: window.location.href,
        scan_result: scanResult?.result ?? null,
        features: {
          login_form_found: features.login_form_found,
          brand_impersonation: features.brand_impersonation ?? null,
          brand_impersonation_score: features.brand_impersonation_score ?? null,
          brand_impersonation_role: features.brand_impersonation_role ?? null,
          hidden_iframe: features.hidden_iframe,
          js_obfuscated: features.js_obfuscated,
          has_password: features.has_password,
          has_email: features.has_email,
        },
      }));

      // ── Search Badges ───────────────────────────────
      const host = location.hostname.toLowerCase();
      const isSearchPage = !/mail\.google\.|accounts\.google\.|drive\.google\.|docs\.google\./.test(host) &&
        (/google\.|bing\.com|duckduckgo\.com/.test(host) && (location.pathname.includes("/search") || location.search.includes("q=")));
      if (isSearchPage) initSearchBadges();

      // ── Link Scanner ────────────────────────────────
      initLinkScanner();

      _scheduleDeepPageScan(updateWidget, updateThreatCount, applyDangerBadges, showWarningModal, 2500);
      if (isAllowlistedPage) {
        clearTimeout(_deepScanTimer);
      }


      const TRUSTED_APP_HOSTS = [
        "mail.google.com", "outlook.office.com", "outlook.live.com", "web.whatsapp.com",
        "google.com", "github.com", "microsoft.com", "facebook.com", "instagram.com",
        "twitter.com", "x.com", "linkedin.com", "youtube.com", "reddit.com", "amazon.com",
        "wikipedia.org", "apple.com", "netflix.com", "spotify.com"
      ];
      const isTrustedApp = TRUSTED_APP_HOSTS.some(h => location.hostname.toLowerCase() === h || location.hostname.toLowerCase().endsWith("." + h));

      chrome.runtime.onMessage.addListener((msg) => {
        switch (msg.type) {
          case "SCAN_RESULT":
            _currentScanData = msg;
            _exposeTelemetryToDOM("aegis-scan-data", msg);
            console.info("[AEGIS:L3]", JSON.stringify({
              url: window.location.href,
              scan_result: msg,
              features: _extractPageFeatures(),
            }));
            
            if (window.__AEGIS_LAST_EMAIL_SCORE != null && window.__AEGIS_LAST_EMAIL_SCORE > msg.score) {
              // Keep email score displayed on widget instead of safe URL scan
            } else {
              setCurrentRisk(msg.score);
              updateWidget(msg);
            }

            if (msg.score >= 80 && !isTrustedApp && !isAllowlistedPage) {
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
            _exposeTelemetryToDOM("aegis-scan-data", msg);
            if (msg.score >= 80 && !isTrustedApp && !isAllowlistedPage) {
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

          case "UPDATE_EMAIL_WIDGET":
            window.__AEGIS_LAST_EMAIL_SCORE = msg.score;
            setCurrentRisk(msg.score);
            if (msg.emailXai) {
              window.__AEGIS_ACTIVE_EMAIL_XAI__ = msg.emailXai;
            } else if (msg.subject === "Active Screen Content" && !document.querySelector(".a3s, .nH.hx")) {
              window.__AEGIS_ACTIVE_EMAIL_XAI__ = null;
            }

            let factors = msg.top_factors;
            if (!factors || factors.length === 0) {
              factors = [{ key: "email", label: msg.subject === "Active Screen Content" ? "Active Screen Content" : `Email: ${msg.subject || "Opened Email"}` }];
              if (msg.sender) factors.push({ key: "sender", label: `Sender: "${msg.sender}"` });
            }

            updateWidget({
              score: msg.score,
              verdict: msg.verdict === "phishing" ? "danger" : msg.verdict === "suspicious" ? "warning" : msg.verdict === "safe" ? "safe" : msg.verdict,
              threat_type: msg.score >= 50 ? "phishing_email" : undefined,
              top_factors: factors
            });
            break;

          case "SET_WIDGET_OPACITY":
            document.dispatchEvent(new CustomEvent("aegis:widget-opacity", { detail: { opacity: msg.opacity } }));
            break;

          case "SET_WIDGET_SCALE":
            document.dispatchEvent(new CustomEvent("aegis:widget-scale", { detail: { scale: msg.scale } }));
            break;

          case "TOGGLE_WIDGET_VISIBILITY": {
            const widgetEl = document.getElementById("aegis-widget-v2") || document.getElementById("aegis-widget");
            if (msg.visible) {
              window.__AEGIS_WIDGET_HIDDEN__ = false;
              if (widgetEl) {
                widgetEl.style.setProperty("display", "block", "important");
                widgetEl.classList.remove("minimized");
              } else if (typeof createWidget === "function") {
                _widget = createWidget();
              }
            } else {
              window.__AEGIS_WIDGET_HIDDEN__ = true;
              if (widgetEl) {
                widgetEl.style.setProperty("display", "none", "important");
              }
            }
            break;
          }

          case "GET_PAGE_STATE": {
            const linksCount = document.querySelectorAll("a[href]").length;
            const imagesCount = document.images ? document.images.length : 0;
            const formsCount = document.forms ? document.forms.length : 0;
            return sendResponse({
              ok: true,
              data: _currentScanData,
              links_count: linksCount,
              images_count: imagesCount,
              form_count: formsCount,
              url: window.location.href,
            });
          }

          case "GET_LOGGED_USER_EMAIL": {
            let email = "";
            try {
              const raw = localStorage.getItem("user");
              if (raw) {
                const parsed = JSON.parse(raw);
                email = parsed?.email || "";
              }
            } catch (_) {}
            return sendResponse({ ok: true, email });
          }

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

          case "IMAGE_SCAN_RESULT": {
            const prob = msg.result?.phishing_probability ?? 0;
            const score = Math.round(prob * 100);
            const isPhishing = msg.result?.prediction === "phishing";
            const factors = msg.result?.sub_results?.map(sub => ({
              label: `[${sub.model}] ${sub.prediction} (${Math.round((sub.phishing_probability || 0) * 100)}%)`
            })) || [];
            showRightClickResult({
              url: msg.url,
              result: { score, verdict: isPhishing ? "danger" : "safe", top_factors: factors },
              isImage: true
            });
            break;
          }

          // Compact text scan result from right-click "Scan This Text"
          case "TEXT_SCAN_RESULT":
            showTextScanResult({ text: msg.text, result: msg.result });
            break;

          // Background triggers deep page scan after URL scan completes
          case "TRIGGER_DEEP_PAGE_SCAN":
          case "TRIGGER_FULL_SCAN":
          case "TRIGGER_FULL_PAGE_SCAN":
            _scheduleDeepPageScan(updateWidget, updateThreatCount, applyDangerBadges, showWarningModal, 250);
            break;

          // Background returns deep page scan results — highlight & dialog
          case "DEEP_PAGE_RESULT": {
            const { composite, textProb, textSignals, badUrls, urlCount } = msg;
            
            // On trusted hosts (Facebook, Gmail, etc.), deep scan highlights embedded external links without altering host page safety
            const baseScore = _currentScanData?.score || 0;
            const mergedScore = isTrustedApp ? baseScore : Math.max(baseScore, composite);
            
            const currentResult = {
              score: mergedScore,
              verdict: mergedScore >= 80 ? "danger" : mergedScore >= 50 ? "warning" : mergedScore >= 20 ? "caution" : "safe",
              top_factors: [
                ...(badUrls || []).slice(0, 2).map(u => ({ label: `In-page link flagged: ${u.url.slice(0, 40)}…` })),
                ...(textSignals || []).slice(0, 2).map(w => ({ label: `Phishing keyword: "${w}"` })),
                ...(_currentScanData?.top_factors || []),
              ].slice(0, 4),
              threat_type: mergedScore >= 80 ? "phishing" : (_currentScanData?.threat_type || "safe"),
            };
            _currentScanData = { ...( _currentScanData || {} ), ...currentResult };
            _exposeTelemetryToDOM("aegis-scan-data", _currentScanData);
            updateWidget(currentResult);
            if (badUrls?.length > 0) {
              applyDangerBadges(badUrls.map(u => u.url));
              updateThreatCount(badUrls.length);
            }
            // Show phishing warning dialog ONLY on un-trusted non-allowlisted pages
            if (composite >= 75 && !window.__AEGIS_WARNING_DISMISSED__ && !isTrustedApp && !isAllowlistedPage) {
              const factors = [
                ...badUrls.slice(0, 2).map(u => ({ label: `Malicious link: ${u.url.slice(0,40)}…` })),
                ...(textSignals || []).slice(0, 2).map(w => ({ label: `Phishing keyword: "${w}"` })),
              ];
              showWarningModal({
                score: composite,
                verdict: "danger",
                threat_type: "phishing",
                top_factors: factors,
                url: window.location.href,
              });
            }
            break;
          }
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
        const activeEmailXai = window.__AEGIS_ACTIVE_EMAIL_XAI__;
        const xaiPayload = activeEmailXai || e.detail;
        const widgetEl = document.getElementById("aegis-widget-v2");
        const displayScore = xaiPayload?.score || widgetEl?._aegisData?.score || _currentScanData?.score || 0;
        
        showXAIModal(xaiPayload, {
          score: displayScore,
          url: location.href,
          threat_type: _currentScanData?.threat_type,
          targetType: activeEmailXai ? "email" : "page"
        });
      });

      document.addEventListener("aegis:email-scanned", (e) => {
        const { score, verdict, threat_type, emailXai } = e.detail || {};
        _currentScanData = {
          score,
          verdict,
          threat_type,
          top_factors: emailXai?.main_reasons?.map(r => ({ label: r, score })),
          emailXai
        };
        updateWidget({ score, verdict, threat_type });
      });

      // ── SPA Navigation Watcher (event-driven, zero CPU polling) ─────
      // Replaces setInterval(1500ms) with native browser navigation events.
      // Covers: back/forward, pushState, replaceState, hash changes.
      let _lastUrl = location.href;

      function _extractPageFeatures() {
        try {
          const bodyText = document.body ? document.body.innerText?.slice(0, 4000) : "";
          const h1Text = Array.from(document.querySelectorAll("h1, h2, .hP")).map(h => h.innerText?.trim()).filter(Boolean).join(" ");
          const linksCount = document.querySelectorAll("a[href]").length;
          const imagesCount = document.querySelectorAll("img[src]").length;

          return {
            login_form_found: document.querySelectorAll('form input[type="password"]').length > 0,
            brand_impersonation: null,
            brand_impersonation_score: null,
            brand_impersonation_role: null,
            hidden_iframe: document.querySelectorAll('iframe[style*="display:none"], iframe[style*="visibility:hidden"]').length > 0,
            js_obfuscated: false,
            has_password: document.querySelectorAll('input[type="password"]').length > 0,
            has_email: document.querySelectorAll('input[type="email"]').length > 0,
            visible_text: bodyText,
            headings_text: h1Text,
            links_count: linksCount,
            images_count: imagesCount,
          };
        } catch (_) {
          return {};
        }
      }

      function _onSpaNavigate() {
        if (document.visibilityState !== "visible") return;
        const currentUrl = location.href;
        if (currentUrl === _lastUrl) return;
        _lastUrl = currentUrl;
        const updated = _extractPageFeatures();
        safeSendMessage({
          type: "PAGE_FEATURES",
          url: currentUrl,
          features: updated,
        }).then(r => {
          if (r?.result) {
            _currentScanData = r.result;
            _exposeTelemetryToDOM("aegis-scan-data", r.result);
            setCurrentRisk(r.result.score);
            updateWidget(r.result);
          }
        });

        // Re-trigger deep page scan on SPA navigation (only if not allowlisted)
        if (!_matchesDomainList(getRootDomain(currentUrl), allowlist)) {
          _scheduleDeepPageScan(updateWidget, updateThreatCount, applyDangerBadges, showWarningModal, 2000);
        }
      }

      // Native browser events — covers hash changes and popstate
      window.addEventListener("popstate", _onSpaNavigate, { passive: true });
      window.addEventListener("hashchange", _onSpaNavigate, { passive: true });

      // Intercept pushState/replaceState (used by React, Vue, Gmail, GitHub, etc.)
      (function _interceptHistoryAPI() {
        const _orig_push    = history.pushState.bind(history);
        const _orig_replace = history.replaceState.bind(history);
        history.pushState = function (...args) {
          _orig_push(...args);
          setTimeout(_onSpaNavigate, 50); // tiny delay lets the DOM update
        };
        history.replaceState = function (...args) {
          _orig_replace(...args);
          setTimeout(_onSpaNavigate, 50);
        };
      })();

      // ── Pluggable Platform Adapters (Email & WhatsApp) ─────
      const storedPlugins = await chrome.storage.local.get(["enableEmailGuard", "enableWhatsappGuard"]);
      if (storedPlugins.enableEmailGuard !== false) {
        initEmailGuard();
      }
      if (storedPlugins.enableWhatsappGuard !== false) {
        initWhatsappGuard();
      }

      // ── Clipboard Protection ────────────────────────
      _initClipboardProtection();

      // ── Dynamic DOM Phishing Observer ─────────────────
      // Watches for late-injected login forms, iframes, and scripts
      // that phishing kits inject after page load.
      _initDOMObserver(updateWidget, showWarningModal, setCurrentRisk);

    } catch (err) {
      if (_DEBUG) console.warn("[AegisOne] Initialization error:", err);
    }
  }

  // ── DOM Feature Extraction ────────────────────────────
  function _extractPageFeatures() {
    const hostname = location.hostname.toLowerCase();

    // Known-safe hosts: search engines + major platforms.
    // Their pages legitimately use eval(), fromCharCode(), tiny iframes, and search forms.
    // Suppress behavioural signals on these hosts to avoid false positives.
    const SAFE_HOSTS = [
      "google.", "bing.", "duckduckgo.", "yahoo.", "baidu.",
      "youtube.com", "facebook.com", "instagram.com", "twitter.com", "x.com",
      "linkedin.com", "github.com", "microsoft.com", "apple.com", "amazon.com",
      "reddit.com", "wikipedia.org"
    ];
    const isKnownSafeHost = SAFE_HOSTS.some(h => hostname.includes(h));

    const scripts  = [...document.querySelectorAll("script")];
    const iframes  = [...document.querySelectorAll("iframe")];
    const forms    = [...document.querySelectorAll("form")];
    const links    = [...document.querySelectorAll("a[href]")];
    const images   = [...document.querySelectorAll("img[src]")];
    const buttons  = [...document.querySelectorAll("button, input[type='button'], input[type='submit']")];
    const metas    = [...document.querySelectorAll("meta")];

    // Meta tags
    const metaTags = metas.map(m => ({
      name: m.getAttribute("name") || m.getAttribute("property") || m.getAttribute("http-equiv") || "",
      content: m.getAttribute("content") || ""
    })).filter(m => m.name);

    // External domains
    const currentHost = location.hostname;
    const extDomains = new Set();
    [...links.map(a => a.href), ...scripts.map(s => s.src), ...images.map(i => i.src), ...iframes.map(f => f.src)]
      .forEach(url => {
        if (!url) return;
        try {
          const u = new URL(url);
          if (u.hostname && u.hostname !== currentHost && !u.hostname.endsWith("." + currentHost))
            extDomains.add(u.hostname);
        } catch (_) {}
      });

    // Hidden iframes — Google uses tiny helper iframes legitimately; suppress on safe hosts
    const hiddenIframes = isKnownSafeHost ? [] : iframes.filter(f => {
      const s = window.getComputedStyle(f);
      return (
        s.display === "none" || s.visibility === "hidden" ||
        parseInt(f.width) < 3 || parseInt(f.height) < 3 ||
        f.getAttribute("width") === "0" || f.getAttribute("height") === "0"
      );
    });

    // JS obfuscation heuristic — Google legitimately uses eval/fromCharCode; suppress on safe hosts
    const inlineScripts = isKnownSafeHost ? [] : scripts.filter(s => !s.src).map(s => s.textContent || "");
    const jsObfuscated = !isKnownSafeHost && inlineScripts.some(js =>
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
    const full_text    = (document.body?.innerText || "").slice(0, 3000);

    // Login form
    const passwordInputs   = document.querySelectorAll('input[type="password"]');
    const login_form_found = passwordInputs.length > 0;
    const form_count       = forms.filter(f => f.querySelector('input[type="password"]')).length;

    return {
      text_snippet,
      full_text,
      hidden_iframes:   hiddenIframes.map(f => f.src || "").filter(Boolean),
      hidden_iframe:    hiddenIframes.length > 0,
      js_obfuscated:    jsObfuscated,
      external_scripts: externalScripts,
      login_form_found,
      form_count,
      page_title:       document.title || "",
      image_count:      images.length,
      link_count:       links.length,
      meta_tags:        metaTags,
      button_count:     buttons.length,
      iframe_count:     iframes.length,
      script_count:     scripts.length,
      external_domains: [...extDomains]
    };
  }

  // ── Deep Page Scan (text + links, NO images — images only on right-click) ──
  async function _triggerDeepPageScan(updateWidget, updateThreatCount, applyDangerBadges, showWarningModal) {
    const btn = document.getElementById("aegis-btn-scan");
    if (btn) { btn.textContent = "⏳"; btn.disabled = true; }

    const pageText = document.body?.innerText?.slice(0, 3000) || "";
    const allLinks = [...new Set(
      [...document.querySelectorAll("a[href]")]
        .map(a => { try { return new URL(a.href, location.href).href; } catch { return ""; } })
        .filter(u => u.startsWith("http"))
    )];

    // Send to background — DEEP_PAGE_SCAN skips images intentionally
    await safeSendMessage({
      type: "DEEP_PAGE_SCAN",
      pageText,
      allLinks,
    });

    if (btn) { btn.textContent = "🔍"; btn.disabled = false; }
    // Results come back via DEEP_PAGE_RESULT message handled in the listener above

    // Fire passive telemetry after scan (non-blocking, best-effort)
    const features = _extractPageFeatures();
    _sendScriptTelemetry(features).catch(() => {});
    _sendCookieTelemetry().catch(() => {});
  }

  function _scheduleDeepPageScan(updateWidget, updateThreatCount, applyDangerBadges, showWarningModal, delayMs = 1200) {
    clearTimeout(_deepScanTimer);
    _deepScanTimer = setTimeout(() => {
      if (_deepScanInFlight) return;
      _deepScanInFlight = true;
      _triggerDeepPageScan(updateWidget, updateThreatCount, applyDangerBadges, showWarningModal)
        .finally(() => {
          _deepScanInFlight = false;
        });
    }, delayMs);
  }

  function _matchesDomainList(domain, list = []) {
    if (!domain || !Array.isArray(list)) return false;
    const normalized = domain.toLowerCase();
    return list.some(item => {
      const value = String(item || "").trim().toLowerCase();
      return value && (normalized === value || normalized.endsWith(`.${value}`));
    });
  }

  // ── Module 7: Script Telemetry ───────────────────────────────────────────
  // Sends extracted JS metadata to the backend. No script source code is uploaded.
  async function _sendScriptTelemetry(features) {
    try {
      const inlineScripts = [...document.querySelectorAll("script")].filter(s => !s.src);
      const evalFound     = inlineScripts.some(s => /eval\s*\(/.test(s.textContent));
      const redirectScript = inlineScripts.some(s => /window\.location|location\.replace|location\.href\s*=/.test(s.textContent));
      const clipboardAccess = inlineScripts.some(s => /clipboard|clipboardData|navigator\.clipboard/.test(s.textContent));
      // Score: obfuscated +30, eval +25, redirect +25, clipboard +20
      let score = 0;
      if (features.js_obfuscated) score += 30;
      if (evalFound)              score += 25;
      if (redirectScript)         score += 25;
      if (clipboardAccess)        score += 20;
      score = Math.min(100, score);

      const stored = await chrome.storage.local.get(["device_id", "org_policy"]);
      await fetch(`${API_BASE}/telemetry/scripts`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          script_count:    features.script_count || 0,
          obfuscated:      features.js_obfuscated || false,
          eval_found:      evalFound,
          redirect_script: redirectScript,
          clipboard_access: clipboardAccess,
          risk_score:      score,
          device_id:       stored.device_id || null,
          org_id:          stored.org_policy?.org_id || null,
        }),
        signal: AbortSignal.timeout(5000),
      });
    } catch (_) { /* silent — telemetry is best-effort */ }
  }

  // ── Module 8: Cookie Metadata Telemetry ─────────────────────────────────
  // Only transmits metadata (count, flags). Cookie values are NEVER sent.
  async function _sendCookieTelemetry() {
    try {
      const cookieStr   = document.cookie || "";
      const cookieCount = cookieStr ? cookieStr.split(";").length : 0;

      // Use cookieStore API (Chrome 87+) to inspect Secure/HttpOnly flags
      let secureFlag = true;
      let httponly   = true;
      let thirdParty = 0;
      const currentHost = location.hostname;

      if (typeof cookieStore !== "undefined") {
        const cookies = await cookieStore.getAll();
        if (cookies.length > 0) {
          secureFlag = cookies.every(c => c.secure);
          httponly   = cookies.every(c => c.httpOnly !== false);
          thirdParty = cookies.filter(c => c.domain && !currentHost.includes(c.domain.replace(/^\./, ""))).length;
        }
      }

      // Heuristic risk score
      let score = 0;
      if (!secureFlag) score += 30;
      if (!httponly)   score += 30;
      if (thirdParty > 5) score += 20;
      if (cookieCount > 20) score += 20;
      score = Math.min(100, score);

      const stored = await chrome.storage.local.get(["device_id", "org_policy"]);
      await fetch(`${API_BASE}/telemetry/cookies`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          cookie_count: cookieCount,
          third_party:  thirdParty,
          secure_flag:  secureFlag,
          httponly:     httponly,
          risk_score:   score,
          device_id:    stored.device_id || null,
          org_id:       stored.org_policy?.org_id || null,
        }),
        signal: AbortSignal.timeout(5000),
      });
    } catch (_) { /* silent — telemetry is best-effort */ }
  }



  // ── Clipboard Protection ──────────────────────────────
  function _initClipboardProtection() {
    document.addEventListener("copy", () => {
      const selected = window.getSelection().toString().trim();
      if (selected && selected.startsWith("http")) {
        safeSendMessage({ type: "SCAN_CLIPBOARD_URL", url: selected });
      }
    });

    document.addEventListener("paste", (e) => {
      const pastedText = e.clipboardData?.getData("text")?.trim();
      if (pastedText && pastedText.startsWith("http")) {
        safeSendMessage({ type: "SCAN_CLIPBOARD_URL", url: pastedText });
      }
    });
  }

  // ── Email Detection (Gmail / Outlook) ─────────────────
  function _watchForEmails() {
    const isGmail   = location.hostname.includes("mail.google.com");
    const isOutlook = location.hostname.includes("outlook.") || location.hostname.includes("office.com");
    if (!isGmail && !isOutlook) return;

    const _emailCache = new Set();

    // Suspicious attachment patterns — score filenames locally
    const PHISHING_FILENAME_KEYWORDS = ["phishing", "malicious", "invoice", "urgent", "password", "verify", "account", "suspended", "paypal", "banking", "login", "secure"];
    const DANGEROUS_EXTENSIONS       = [".exe", ".bat", ".cmd", ".vbs", ".ps1", ".js", ".jar", ".scr", ".html", ".htm", ".zip", ".rar"];
    const HIGH_RISK_EXTENSIONS        = [".exe", ".bat", ".cmd", ".vbs", ".ps1", ".scr"];

    function _scoreFilename(name) {
      const lower = name.toLowerCase();
      let score = 0;
      const signals = [];

      // High-risk executable extensions
      if (HIGH_RISK_EXTENSIONS.some(ext => lower.endsWith(ext))) {
        score += 70;
        signals.push(`Dangerous file type: ${lower.split(".").pop().toUpperCase()}`);
      } else if (DANGEROUS_EXTENSIONS.some(ext => lower.endsWith(ext))) {
        score += 40;
        signals.push(`Suspicious file type: ${lower.split(".").pop().toUpperCase()}`);
      }

      // Phishing keywords in filename
      const matchedKeywords = PHISHING_FILENAME_KEYWORDS.filter(k => lower.includes(k));
      if (matchedKeywords.length > 0) {
        score += matchedKeywords.length * 20;
        signals.push(`Suspicious filename keyword: "${matchedKeywords[0]}"`);
      }

      // Double extension (e.g. invoice.pdf.exe)
      if (/\.[a-z]{2,4}\.[a-z]{2,4}$/i.test(name)) {
        score += 30;
        signals.push("Double file extension — common malware trick");
      }

      return { score: Math.min(100, score), signals };
    }

    // Target the specific email content container rather than entire body
    // for much better performance on Gmail/Outlook (heavy DOM)
    const _emailRoot = isGmail
      ? (document.querySelector('.AO') || document.body)
      : (document.querySelector('#app') || document.body);

    // FIX 3: Build a cache key that includes the sorted attachment list.
    // The old key (subject+sender) caused new attachments on the same thread
    // to be silently skipped. Now any change in attachments produces a new key.
    function _emailCacheKey(subj, sndr, names) {
      return subj + '\x00' + sndr + '\x00' + [...names].sort().join(',');
    }

    // FIX 4: Extract DOM-reading + sending logic so it can be called both from
    // the MutationObserver AND from the delayed retry timer.
    let _attachRetryTimer = null;

    function _scanCurrentEmail() {
      let sender = '', subject = '', body = '';
      let attachmentNames = [];

      if (isGmail) {
        const senderEl  = document.querySelector('[email], [data-hovercard-id]');
        const subjectEl = document.querySelector('h2[data-thread-perm-id], .hP');
        const bodyEl    = document.querySelector('.a3s.aiL');
        sender  = senderEl?.getAttribute('email') || senderEl?.getAttribute('data-hovercard-id') || '';
        subject = subjectEl?.textContent?.trim() || '';
        body    = bodyEl?.innerText?.slice(0, 2000) || '';

        // Scrape attachment filenames from Gmail DOM
        // Gmail shows attachment names in .aQA, .aV3 spans or data-tooltip attributes
        const attachEls = [
          ...document.querySelectorAll('.aQA span'),
          ...document.querySelectorAll('.aV3'),
          ...document.querySelectorAll('[data-tooltip]'),
          ...document.querySelectorAll('.bAK span'),
        ];
        attachmentNames = [...new Set(
          attachEls
            .map(el => (el.textContent || el.getAttribute('data-tooltip') || '').trim())
            .filter(n => n && n.includes('.') && n.length < 120)
        )];
      } else if (isOutlook) {
        const senderEl  = document.querySelector('[data-convid] .oG');
        const subjectEl = document.querySelector('.cN');
        const bodyEl    = document.querySelector('.rps');
        sender  = senderEl?.textContent?.trim() || '';
        subject = subjectEl?.textContent?.trim() || '';
        body    = bodyEl?.innerText?.slice(0, 2000) || '';

        attachmentNames = [...document.querySelectorAll(".attachmentTitle, [data-app-section='Attachment'] span")]
          .map(el => el.textContent?.trim())
          .filter(Boolean);
      }

      if (!subject) return { foundAttachments: attachmentNames.length > 0 };

      // FIX 3: key includes attachment list so same thread + new attachment rescans
      const cacheKey = _emailCacheKey(subject, sender, attachmentNames);
      if (_emailCache.has(cacheKey)) return { foundAttachments: attachmentNames.length > 0 };
      _emailCache.add(cacheKey);

      // -- Scan email body
      if (body.length > 50) {
        safeSendMessage({ type: 'EMAIL_DATA', sender, subject, body });
      }

      // -- Scan attachment filenames
      if (attachmentNames.length > 0) {
        let maxScore = 0;
        const allSignals = [];
        for (const name of attachmentNames) {
          const { score, signals } = _scoreFilename(name);
          if (score > maxScore) maxScore = score;
          allSignals.push(...signals.map(s => ({ label: '\u{1F4CE} "' + name + '": ' + s })));
        }
        if (maxScore >= 20) {
          safeSendMessage({
            type: 'ATTACHMENT_RISK',
            score: maxScore,
            signals: allSignals,
            filenames: attachmentNames,
          });
          const filenameText = attachmentNames.join(' ');
          safeSendMessage({
            type: 'EMAIL_DATA',
            sender,
            subject: subject + ' [attachments: ' + filenameText + ']',
            body: filenameText,
          });
        }
      }

      return { foundAttachments: attachmentNames.length > 0 };
    }

    // FIX 4: Call _scanCurrentEmail from the observer.
    // If no attachments were visible on first pass, schedule a 3-second retry
    // to catch Gmail attachments that render after the email body settles.
    const emailObserver = new MutationObserver(debounce(() => {
      const { foundAttachments } = _scanCurrentEmail();
      if (!foundAttachments) {
        clearTimeout(_attachRetryTimer);
        _attachRetryTimer = setTimeout(() => _scanCurrentEmail(), 3000);
      }
    }, 1500));

    emailObserver.observe(_emailRoot, { childList: true, subtree: true });
  }

  // ── Dynamic DOM Observer ─────────────────────────────
  // Detects phishing elements injected after page load:
  //  - New login forms / password fields
  //  - Hidden iframes
  //  - Suspicious new <script> tags
  // Uses throttled MutationObserver — only inspects specific node types.
  function _initDOMObserver(updateWidget, showWarningModal, setCurrentRisk) {
    if (window.__AEGIS_DOM_OBSERVER__) return;
    window.__AEGIS_DOM_OBSERVER__ = true;

    const hostname = location.hostname.toLowerCase();
    // Known-safe hosts don't need DOM mutation scanning
    const SAFE_HOSTS = ["google.", "bing.", "youtube.com", "facebook.com", "github.com", "microsoft.com"];
    if (SAFE_HOSTS.some(h => hostname.includes(h))) return;

    let _domScanTimer = null;
    let _injectedFormCount = document.querySelectorAll('input[type="password"]').length;
    let _injectedIframeCount = document.querySelectorAll('iframe').length;

    const observer = new MutationObserver(debounce(() => {
      const newPasswordFields = document.querySelectorAll('input[type="password"]').length;
      const newIframes = document.querySelectorAll('iframe').length;

      const newFormInjected = newPasswordFields > _injectedFormCount;
      const newIframeInjected = newIframes > _injectedIframeCount;

      _injectedFormCount = newPasswordFields;
      _injectedIframeCount = newIframes;

      // Only act if something new was injected
      if (!newFormInjected && !newIframeInjected) return;

      if (_DEBUG) console.log("[AegisOne] DOM mutation detected — new login/iframe injected");

      // Re-extract features and re-scan if new credential form appears
      clearTimeout(_domScanTimer);
      _domScanTimer = setTimeout(() => {
        const updated = _extractPageFeatures();
        safeSendMessage({
          type: "PAGE_FEATURES",
          url: location.href,
          features: updated,
        }).then(r => {
          if (r?.result && r.result.score > 0) {
            _currentScanData = r.result;
            setCurrentRisk(r.result.score);
            updateWidget(r.result);
            // If newly injected form on a suspicious page — warn immediately
            if (newFormInjected && r.result.score >= 50) {
              showWarningModal({
                score: r.result.score,
                verdict: r.result.verdict,
                threat_type: "credential_harvesting",
                top_factors: [{ label: "Login form injected dynamically after page load" }, ...(r.result.top_factors || [])],
                url: location.href,
              });
            }
          }
        }).catch(() => {});
      }, 800);
    }, 500));

    observer.observe(document.body, {
      childList: true,
      subtree: true,
      // Only watch for added nodes — not attribute changes (too frequent)
    });
  }

  // ── Initialize ────────────────────────────────────────
  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", init);
  } else {
    init();
  }

})();
