/**
 * AegisOne — Content Script Main Entry Point v2.1
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

  let _widget = null;
  let _currentScanData = null;
  let _deepScanTimer = null;
  let _deepScanInFlight = false;

  // Debounce utility
  function debounce(fn, ms) {
    let t;
    return (...args) => { clearTimeout(t); t = setTimeout(() => fn(...args), ms); };
  }

  // ── Step 1: Create widget immediately ─────────────────
  async function init() {
    try {
      const [
        { STORE_KEYS },
        { createWidget, updateWidget, updateThreatCount },
        { initSearchBadges },
        { initLinkScanner, applyDangerBadges },
        { initFormGuard, setCurrentRisk },
        { showWarningModal, showXAIModal, showDownloadModal, showRightClickResult, showTextScanResult },
        { getRootDomain },
      ] = await Promise.all([
        import(chrome.runtime.getURL("utils/constants.js")),
        import(chrome.runtime.getURL("content/widget.js")),
        import(chrome.runtime.getURL("content/search-badges.js")),
        import(chrome.runtime.getURL("content/link-scanner.js")),
        import(chrome.runtime.getURL("content/form-guard.js")),
        import(chrome.runtime.getURL("content/modals.js")),
        import(chrome.runtime.getURL("utils/trusted-domains.js")),
      ]);

      const policy = await chrome.storage.local.get([STORE_KEYS.ALLOWLIST]);
      const allowlist = Array.isArray(policy[STORE_KEYS.ALLOWLIST]) ? policy[STORE_KEYS.ALLOWLIST] : [];
      const isAllowlistedPage = _matchesDomainList(getRootDomain(location.href), allowlist);

      // ── Widget ──────────────────────────────────────
      _widget = createWidget();

      // ── DOM Feature Extraction ──────────────────────
      const features = _extractPageFeatures();

      // ── Form Guard ──────────────────────────────────
      initFormGuard((formFeatures) => {
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

      // ── Auto Deep Page Scan (text + links, images skipped) ──
      // Runs 2.5s after page load to let DOM settle. Images are only scanned on right-click.
      _scheduleDeepPageScan(updateWidget, updateThreatCount, applyDangerBadges, showWarningModal, 2500);
      if (isAllowlistedPage) {
        clearTimeout(_deepScanTimer);
      }


      chrome.runtime.onMessage.addListener((msg) => {
        switch (msg.type) {
          case "SCAN_RESULT":
            _currentScanData = msg;
            setCurrentRisk(msg.score);
            updateWidget(msg);
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
            const currentResult = {
              score: composite,
              verdict: composite >= 80 ? "danger" : composite >= 50 ? "warning" : "safe",
              top_factors: [
                ...(badUrls || []).slice(0, 2).map(u => ({ label: `Malicious link: ${u.url.slice(0, 40)}…` })),
                ...(textSignals || []).slice(0, 2).map(w => ({ label: `Phishing keyword: "${w}"` })),
              ],
              threat_type: composite >= 80 ? "phishing" : "suspicious_activity",
            };
            _currentScanData = { ...( _currentScanData || {} ), ...currentResult };
            updateWidget(currentResult);
            if (badUrls?.length > 0) {
              applyDangerBadges(badUrls.map(u => u.url));
              updateThreatCount(badUrls.length);
            }
            // Show phishing warning dialog only if composite is very high
            if (composite >= 75 && !window.__AEGIS_WARNING_DISMISSED__) {
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
        showXAIModal(e.detail, {
          score: _currentScanData?.score,
          url: location.href,
          threat_type: _currentScanData?.threat_type,
        });
      });

      // ── SPA Navigation Watcher ───────────────────────
      let _lastUrl = location.href;
      setInterval(() => {
        if (document.visibilityState !== "visible") return;
        if (location.href !== _lastUrl) {
          _lastUrl = location.href;
          window.__AEGIS_WARNING_DISMISSED__ = false;
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

          // Re-trigger deep page scan on SPA navigation
          if (!_matchesDomainList(getRootDomain(location.href), allowlist)) {
            _scheduleDeepPageScan(updateWidget, updateThreatCount, applyDangerBadges, showWarningModal, 3000);
          }
        }
      }, 1500);

      // ── Gmail / Outlook email detection ─────────────
      _watchForEmails();

      // ── Clipboard Protection ────────────────────────
      _initClipboardProtection();

    } catch (err) {
      console.warn("[AegisOne] Initialization error:", err);
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

    // Login form — search engines always have a <form> but NEVER a password field for the user
    const passwordInputs   = document.querySelectorAll('input[type="password"]');
    const login_form_found = !isKnownSafeHost && passwordInputs.length > 0;
    const form_count       = isKnownSafeHost ? 0 : forms.filter(f => f.querySelector('input[type="password"]')).length;

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
    await chrome.runtime.sendMessage({
      type: "DEEP_PAGE_SCAN",
      pageText,
      allLinks,
    }).catch(() => null);

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
      await fetch(`http://localhost:9000/telemetry/scripts`, {
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
      await fetch(`http://localhost:9000/telemetry/cookies`, {
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
        chrome.runtime.sendMessage({ type: "SCAN_CLIPBOARD_URL", url: selected }).catch(() => {});
      }
    });

    document.addEventListener("paste", (e) => {
      const pastedText = e.clipboardData?.getData("text")?.trim();
      if (pastedText && pastedText.startsWith("http")) {
        chrome.runtime.sendMessage({ type: "SCAN_CLIPBOARD_URL", url: pastedText }).catch(() => {});
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

    const emailObserver = new MutationObserver(debounce(() => {
      let sender = "", subject = "", body = "";
      let attachmentNames = [];

      if (isGmail) {
        const senderEl  = document.querySelector('[email], [data-hovercard-id]');
        const subjectEl = document.querySelector("h2[data-thread-perm-id], .hP");
        const bodyEl    = document.querySelector(".a3s.aiL");
        sender  = senderEl?.getAttribute("email") || senderEl?.getAttribute("data-hovercard-id") || "";
        subject = subjectEl?.textContent?.trim() || "";
        body    = bodyEl?.innerText?.slice(0, 2000) || "";

        // Scrape attachment filenames from Gmail DOM
        // Gmail shows attachment names in .aQA, .aV3 spans or data-tooltip attributes
        const attachEls = [
          ...document.querySelectorAll(".aQA span"),          // attachment name span
          ...document.querySelectorAll(".aV3"),               // alt format
          ...document.querySelectorAll("[data-tooltip]"),     // tooltip has filename
          ...document.querySelectorAll(".bAK span"),          // another Gmail selector
        ];
        attachmentNames = [...new Set(
          attachEls
            .map(el => (el.textContent || el.getAttribute("data-tooltip") || "").trim())
            .filter(n => n && n.includes(".") && n.length < 120)
        )];
      } else if (isOutlook) {
        const senderEl  = document.querySelector('[data-convid] .oG');
        const subjectEl = document.querySelector('.cN');
        const bodyEl    = document.querySelector('.rps');
        sender  = senderEl?.textContent?.trim() || "";
        subject = subjectEl?.textContent?.trim() || "";
        body    = bodyEl?.innerText?.slice(0, 2000) || "";

        // Outlook attachment names
        attachmentNames = [...document.querySelectorAll(".attachmentTitle, [data-app-section='Attachment'] span")]
          .map(el => el.textContent?.trim())
          .filter(Boolean);
      }

      if (!subject || _emailCache.has(subject + sender)) return;
      _emailCache.add(subject + sender);

      // ── Scan email body ──────────────────────────────
      if (body.length > 50) {
        chrome.runtime.sendMessage({ type: "EMAIL_DATA", sender, subject, body }).catch(() => {});
      }

      // ── Scan attachment filenames ────────────────────
      if (attachmentNames.length > 0) {
        let maxScore = 0;
        const allSignals = [];

        for (const name of attachmentNames) {
          const { score, signals } = _scoreFilename(name);
          if (score > maxScore) maxScore = score;
          allSignals.push(...signals.map(s => ({ label: `📎 "${name}": ${s}` })));
        }

        if (maxScore >= 20) {
          // Update widget immediately with attachment risk
          chrome.runtime.sendMessage({
            type: "ATTACHMENT_RISK",
            score: maxScore,
            signals: allSignals,
            filenames: attachmentNames,
          }).catch(() => {});

          // Also fire text scan on all filenames concatenated
          const filenameText = attachmentNames.join(" ");
          chrome.runtime.sendMessage({
            type: "EMAIL_DATA",
            sender,
            subject: `${subject} [attachments: ${filenameText}]`,
            body: filenameText,
          }).catch(() => {});
        }
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
