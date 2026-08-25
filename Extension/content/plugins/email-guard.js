/**
 * AegisOne — Email Guard v3.5
 * ===========================
 * Comprehensive multi-modal email protection for webmail clients (Gmail & Outlook).
 *
 * Features in v3.5:
 *  - Persistent Storage Caching: Scan results are saved in chrome.storage.local across page reloads.
 *    Reloading Gmail loads badges instantly with 0 backend API calls!
 *  - Right-Aligned Date Badges: Badges are placed directly next to the date column on the right side of each email row.
 *  - Strict 1 Email = 1 Scan Ever: Inbox row scan score (e.g. 96%) matches open email score.
 *    Opening an email or re-navigating reuses cached state without re-scanning.
 */

export function initEmailGuard() {
  const isGmail = location.hostname.includes("mail.google.com");
  const isOutlook = location.hostname.includes("outlook.") || location.hostname.includes("office.com");
  if (!isGmail && !isOutlook) return;

  // ── Constants ─────────────────────────────────────────────
  const PHISHING_FILENAME_KEYWORDS = [
    "phishing", "malicious", "invoice", "urgent", "password", "verify",
    "account", "suspended", "paypal", "banking", "login", "secure", "remittance", "payment"
  ];
  const DANGEROUS_EXTENSIONS = [".exe", ".bat", ".cmd", ".vbs", ".ps1", ".js", ".jar", ".scr", ".html", ".htm", ".zip", ".rar"];
  const HIGH_RISK_EXTENSIONS  = [".exe", ".bat", ".cmd", ".vbs", ".ps1", ".scr"];

  // Global Unified Cache
  const _scannedEmailsMap = new Map();
  const _failedRetriesMap = new Map();
  const _processedOpenKeys = new Set();
  const STORAGE_CACHE_KEY = "aegis_email_cache_v1";

  // Load persistent cache from chrome.storage.local on initialization
  try {
    chrome.storage.local.get([STORAGE_CACHE_KEY]).then((data) => {
      const stored = data[STORAGE_CACHE_KEY] || {};
      Object.entries(stored).forEach(([k, v]) => {
        if (v && typeof v === "object") {
          _scannedEmailsMap.set(k, v);
        }
      });
      // Re-trigger badge injection for rows already rendered
      _scanInboxBatch();
    }).catch(() => {});
  } catch (_) {}

  function _saveToStorage() {
    try {
      const obj = {};
      _scannedEmailsMap.forEach((v, k) => {
        if (v && v.verdict !== "offline" && v.verdict !== "scanning") {
          obj[k] = v;
        }
      });
      chrome.storage.local.set({ [STORAGE_CACHE_KEY]: obj }).catch(() => {});
    } catch (_) {}
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

  // ── Concurrency Queue ─────────────────────────────────────
  let _activeCount = 0;
  const _queue = [];
  const MAX_CONCURRENT = 3;

  function _enqueue(task) {
    return new Promise((resolve, reject) => {
      _queue.push({ task, resolve, reject });
      _flush();
    });
  }

  function _flush() {
    while (_activeCount < MAX_CONCURRENT && _queue.length > 0) {
      const { task, resolve, reject } = _queue.shift();
      _activeCount++;
      task()
        .then(resolve)
        .catch(reject)
        .finally(() => {
          _activeCount--;
          _flush();
        });
    }
  }

  // ── 1. Attachment Risk Evaluator ──────────────────────────
  function _scoreAttachment(name) {
    const lower = name.toLowerCase();
    let score = 0;
    const signals = [];
    if (HIGH_RISK_EXTENSIONS.some(ext => lower.endsWith(ext))) {
      score += 70;
      signals.push(`Dangerous executable extension: .${lower.split(".").pop().toUpperCase()}`);
    } else if (DANGEROUS_EXTENSIONS.some(ext => lower.endsWith(ext))) {
      score += 40;
      signals.push(`Archive/Script file extension: .${lower.split(".").pop().toUpperCase()}`);
    }
    const kw = PHISHING_FILENAME_KEYWORDS.filter(k => lower.includes(k));
    if (kw.length > 0) {
      score += kw.length * 20;
      signals.push(`Suspicious attachment keyword: "${kw[0]}"`);
    }
    if (/\.[a-z]{2,4}\.[a-z]{2,4}$/i.test(name)) {
      score += 35;
      signals.push("Double file extension detected");
    }
    return { score: Math.min(100, score), signals };
  }

  // ── 2. Embedded Link Extractor & Evaluator ───────────────
  function _extractLinks(text, domContainer) {
    const urls = new Set();
    const matches = text.match(/https?:\/\/[^\s"'<>]+/gi) || [];
    matches.forEach(u => urls.add(u));
    if (domContainer) {
      domContainer.querySelectorAll("a[href]").forEach(a => {
        const href = a.getAttribute("href");
        if (href && href.startsWith("http")) urls.add(href);
      });
    }
    return Array.from(urls).slice(0, 10);
  }

  function _scoreLinks(links) {
    let score = 0;
    const signals = [];
    for (const url of links) {
      try {
        const parsed = new URL(url);
        const host = parsed.hostname.toLowerCase();
        if (host.includes("google.com") || host.includes("gmail.com") || host.includes("googleusercontent.com") || host.includes("gstatic.com") || host.includes("github.com") || host.includes("linkedin.com")) {
          continue;
        }
        if (/^\d{1,3}\.\d{1,3}\.\d{1,3}\.\d{1,3}$/.test(host)) {
          score += 60;
          signals.push(`🚨 Direct IP URL in body: ${url.slice(0, 45)}`);
        } else if (/\.(xyz|top|work|click|gq|cf|ml|ga|tk|zip|mov)$/i.test(host)) {
          score += 40;
          signals.push(`⚠️ Link with high-risk TLD (.${host.split(".").pop()}): ${host}`);
        }
      } catch (_) {}
    }
    return { score: Math.min(100, score), signals };
  }

  // ── 3. Embedded Image Extractor ───────────────────────────
  function _extractImages(domContainer) {
    if (!domContainer) return [];
    const imgs = [];
    domContainer.querySelectorAll("img[src]").forEach(img => {
      const src = img.getAttribute("src");
      if (src && !src.startsWith("data:image/svg") && !src.includes("cleardot.gif")) {
        imgs.push(src);
      }
    });
    return imgs.slice(0, 5);
  }

  // ── 4. Risk Level Classifier ──────────────────────────────
  function _getRiskLevel(score) {
    if (score === null || score === undefined) return "offline";
    if (score >= 60) return "phishing";
    if (score >= 31) return "suspicious";
    return "safe";
  }

  function _makeEmailKey(sender, subject) {
    const cleanSender  = (sender || "").toLowerCase().trim();
    let cleanSubject = (subject || "").toLowerCase().trim();
    cleanSubject = cleanSubject.replace(/⏳\s*scanning\.*/gi, "")
                               .replace(/[⚠✓🚨]\s*\d+%/gi, "")
                               .replace(/[⚠✓🚨]\s*(safe|phishing)/gi, "")
                               .trim();
    if (!cleanSender && !cleanSubject) return "";
    return `${cleanSender}|${cleanSubject}`;
  }

  // ─────────────────────────────────────────────────────────
  // SECTION 1: INBOX ROW BATCH SCANNING
  // ─────────────────────────────────────────────────────────

  async function _scanInboxBatch() {
    if (!isGmail) return;

    const rows = document.querySelectorAll("tr.zA");
    const toScan = [];

    rows.forEach(row => {
      const rowId = row.getAttribute("id") || row.dataset.legacyMessageId || "";

      const senderEl = row.querySelector("[email], .zF, .yW, .bA4, .b5, .yX");
      let rowSender = "";
      if (senderEl) {
        const clone = senderEl.cloneNode(true);
        clone.querySelectorAll(".aegis-row-badge").forEach(b => b.remove());
        rowSender = clone.getAttribute("email") || clone.getAttribute("data-hovercard-id") || clone.textContent?.trim() || "";
      }

      const subjectEl = row.querySelector(".bog span, .bog, .y6 span, .y6, .bkH");
      let rowSubject = "";
      if (subjectEl) {
        const clone = subjectEl.cloneNode(true);
        clone.querySelectorAll(".aegis-row-badge").forEach(b => b.remove());
        rowSubject = clone.textContent?.trim() || "";
      }

      const snippetEl = row.querySelector(".y2, .Zt");
      let rowSnippet = "";
      if (snippetEl) {
        const clone = snippetEl.cloneNode(true);
        clone.querySelectorAll(".aegis-row-badge").forEach(b => b.remove());
        rowSnippet = clone.textContent?.trim() || "";
      }

      const combined = `${rowSubject} ${rowSnippet}`.trim();

      if (!rowSender && !rowSubject) return;

      const emailKey = _makeEmailKey(rowSender, rowSubject) || rowId;
      row.dataset.aegisKey = emailKey;

      if (_scannedEmailsMap.has(emailKey)) {
        const cached = _scannedEmailsMap.get(emailKey);
        if (cached.verdict !== "offline") {
          _injectRowBadge(row, cached.verdict, cached.score, emailKey);
          return;
        }
        // Retry offline emails only after 30s cooldown
        const lastFailed = _failedRetriesMap.get(emailKey) || 0;
        if (Date.now() - lastFailed < 30_000) {
          _injectRowBadge(row, "offline", null, emailKey);
          return;
        }
      }

      // Mark as scanning
      _scannedEmailsMap.set(emailKey, { score: -1, verdict: "scanning" });
      _injectRowBadge(row, "scanning", 0, emailKey);

      toScan.push({ row, emailKey, rowSender, rowSubject, combined });
    });

    for (const item of toScan) {
      _enqueue(() => _scanOneRow(item)).catch(() => {
        _scannedEmailsMap.set(item.emailKey, { score: null, verdict: "offline" });
        _failedRetriesMap.set(item.emailKey, Date.now());
        _updateRowBadge(item.emailKey, "offline", null);
      });
    }
  }

  async function _scanOneRow({ row, emailKey, rowSender, rowSubject, combined }) {
    try {
      const res = await safeSendMessage({
        type: "EMAIL_DATA",
        sender: rowSender,
        subject: rowSubject,
        body: combined,
      });

      if (!res || res.ok !== true || !res.result) {
        _scannedEmailsMap.set(emailKey, { score: null, verdict: "offline" });
        _failedRetriesMap.set(emailKey, Date.now());
        _updateRowBadge(emailKey, "offline", null);
        return;
      }

      const modelResult = res?.result ?? res ?? {};
      const modelProb   = modelResult.phishing_probability ?? 0;
      const baseScore   = Math.round(modelProb * 100);

      const links = _extractLinks(combined, null);
      const linkEval = _scoreLinks(links);

      const unifiedScore = Math.min(100, Math.max(baseScore, linkEval.score));
      const verdict = _getRiskLevel(unifiedScore);

      const record = {
        score: unifiedScore,
        verdict,
        modelResult,
        linkSignals: linkEval.signals,
        attachSignals: [],
        links,
        attachmentNames: [],
      };

      _scannedEmailsMap.set(emailKey, record);
      _saveToStorage();
      _updateRowBadge(emailKey, verdict, unifiedScore);
    } catch (_) {
      _scannedEmailsMap.set(emailKey, { score: null, verdict: "offline" });
      _failedRetriesMap.set(emailKey, Date.now());
      _updateRowBadge(emailKey, "offline", null);
    }
  }

  function _injectRowBadge(rowEl, verdict, score, emailKey) {
    rowEl.dataset.aegisKey = emailKey;

    rowEl.querySelector(".aegis-row-badge")?.remove();
    rowEl.querySelector(".aegis-row-left-bar")?.remove();

    rowEl.style.position = "relative";

    const colors = {
      scanning:   { bar: "rgba(99,102,241,0.5)",  bg: "transparent" },
      safe:       { bar: "rgba(16,185,129,0.4)",   bg: "transparent" },
      suspicious: { bar: "rgba(245,158,11,0.55)",  bg: "rgba(245,158,11,0.04)" },
      phishing:   { bar: "rgba(239,68,68,0.65)",   bg: "rgba(239,68,68,0.06)" },
      offline:    { bar: "rgba(148,163,184,0.4)",  bg: "transparent" },
    };
    const cfg = colors[verdict] || colors.safe;

    const bar = document.createElement("span");
    bar.className = "aegis-row-left-bar";
    bar.style.cssText = `
      position: absolute; left: 0; top: 0; bottom: 0; width: 3px;
      background: ${cfg.bar}; border-radius: 0 2px 2px 0; pointer-events: none; z-index: 2;
    `;
    rowEl.insertBefore(bar, rowEl.firstChild);
    rowEl.style.backgroundColor = cfg.bg;

    // Target the Date container cell (.xW, td.xW) so badge is neatly placed on the RIGHT side near the date
    const dateTarget = rowEl.querySelector(".xW, td.xW, .bq9");
    const subjectTarget = rowEl.querySelector(".bog") || rowEl.querySelector(".xY.a4W");

    const badge = document.createElement("span");
    badge.className = "aegis-row-badge";
    badge.dataset.aegisRowKey = emailKey;

    if (verdict === "scanning") {
      badge.style.cssText = `
        display: inline-flex; align-items: center; gap: 3px;
        padding: 1px 6px; margin-right: 6px; border-radius: 12px;
        background: rgba(99,102,241,0.12); border: 1px solid rgba(99,102,241,0.3);
        color: #a5b4fc; font-size: 9px; font-weight: 700;
        font-family: 'Inter', -apple-system, sans-serif;
        animation: aegis-pulse 1.4s ease-in-out infinite;
        vertical-align: middle; white-space: nowrap; pointer-events: none;
        flex-shrink: 0;
      `;
      badge.textContent = "⏳ Scanning...";
    } else if (verdict === "offline") {
      badge.style.cssText = `
        display: inline-flex; align-items: center; gap: 3px;
        padding: 1px 6px; margin-right: 6px; border-radius: 12px;
        background: rgba(148,163,184,0.15); border: 1px solid rgba(148,163,184,0.3);
        color: #94a3b8; font-size: 9px; font-weight: 700;
        font-family: 'Inter', -apple-system, sans-serif;
        vertical-align: middle; white-space: nowrap; pointer-events: none;
        flex-shrink: 0;
      `;
      badge.textContent = "🔌 Offline";
      badge.title = "AegisOne service offline";
    } else {
      const BADGE_STYLES = {
        safe:       { bg: "rgba(16,185,129,0.13)", border: "rgba(16,185,129,0.4)", color: "#34d399" },
        suspicious: { bg: "rgba(245,158,11,0.13)", border: "rgba(245,158,11,0.45)", color: "#fbbf24" },
        phishing:   { bg: "rgba(239,68,68,0.14)",  border: "rgba(239,68,68,0.45)",  color: "#f87171" },
      };
      const BADGE_ICONS = { safe: "✓", suspicious: "⚠", phishing: "🚨" };
      const BADGE_LABELS = { safe: "Safe", suspicious: `${score}%`, phishing: `Phishing (${score}%)` };

      const sty = BADGE_STYLES[verdict] || BADGE_STYLES.safe;
      badge.style.cssText = `
        display: inline-flex; align-items: center; gap: 3px;
        padding: 2px 7px; margin-right: 6px; border-radius: 12px;
        background: ${sty.bg}; border: 1px solid ${sty.border};
        color: ${sty.color}; font-size: 9.5px; font-weight: 800;
        font-family: 'Inter', -apple-system, sans-serif;
        vertical-align: middle; white-space: nowrap; pointer-events: none;
        letter-spacing: 0.1px; flex-shrink: 0;
      `;
      badge.textContent = `${BADGE_ICONS[verdict]} ${BADGE_LABELS[verdict]}`;
      badge.title = `AegisOne Risk Score: ${score}%`;
    }

    if (dateTarget) {
      dateTarget.style.display = "inline-flex";
      dateTarget.style.alignItems = "center";
      dateTarget.style.justifyContent = "flex-end";
      dateTarget.insertBefore(badge, dateTarget.firstChild);
    } else if (subjectTarget) {
      if (subjectTarget.nextSibling) {
        subjectTarget.parentNode.insertBefore(badge, subjectTarget.nextSibling);
      } else {
        subjectTarget.parentNode.appendChild(badge);
      }
    }
    _injectPulseStyle();
  }

  function _updateRowBadge(emailKey, verdict, score) {
    document.querySelectorAll("tr.zA").forEach(rowEl => {
      if (rowEl.dataset.aegisKey === emailKey) {
        _injectRowBadge(rowEl, verdict, score, emailKey);
      }
    });
  }

  function _injectPulseStyle() {
    if (document.getElementById("aegis-pulse-style")) return;
    const s = document.createElement("style");
    s.id = "aegis-pulse-style";
    s.textContent = `
      @keyframes aegis-pulse {
        0%, 100% { opacity: 1; }
        50% { opacity: 0.35; }
      }
      tr.zA { transition: background-color 0.3s ease; }
      .aegis-row-badge { transition: opacity 0.2s ease; }
    `;
    document.head.appendChild(s);
  }

  // ─────────────────────────────────────────────────────────
  // SECTION 2: OPEN EMAIL DOM EXTRACTION & DEEP SCAN
  // ─────────────────────────────────────────────────────────

  function _extractOpenSubject() {
    const el = document.querySelector("h2.hP, .hP, h2[data-thread-perm-id], .ha h2");
    const text = el?.textContent?.trim();
    if (text && text !== "Search" && !text.includes(" - Gmail")) {
      return text;
    }
    const rawTitle = document.title || "";
    const parts = rawTitle.split(" - ");
    if (parts.length >= 2 && parts[0].trim() !== "Search" && parts[0].trim() !== "Gmail") {
      return parts[0].trim();
    }
    return text || "";
  }

  function _extractOpenSender() {
    const containers = Array.from(document.querySelectorAll(".adn, .gE, .gs, .nH")).filter(el => {
      return el.querySelector(".a3s") && (el.offsetWidth > 0 || el.offsetHeight > 0);
    });
    const activeContainer = containers[containers.length - 1] || document;
    const senderEl = activeContainer.querySelector(".gD[email], .gD, [email]") || document.querySelector(".gD[email], .gD");
    return senderEl?.getAttribute("email")
        || senderEl?.getAttribute("data-hovercard-id")
        || senderEl?.textContent?.trim()
        || "";
  }

  function _extractOpenBody() {
    const msgs = document.querySelectorAll(".a3s.aiL, .a3s");
    if (msgs.length > 0) {
      const visibleTexts = Array.from(msgs)
        .filter(m => m.offsetWidth > 0 || m.offsetHeight > 0)
        .map(m => m.innerText?.trim())
        .filter(Boolean);
      if (visibleTexts.length > 0) {
        return visibleTexts.join("\n\n").slice(0, 4000);
      }
      return Array.from(msgs).map(m => m.innerText).join("\n").slice(0, 4000);
    }
    const fallbackEl = document.querySelector(".rps, [data-app-section='MessageBody']");
    return fallbackEl?.innerText?.slice(0, 4000) || "";
  }

  async function _scanOpenEmail() {
    if (!isGmail && !isOutlook) return;

    let sender = "", subject = "", body = "";
    let attachmentNames = [];
    let toolbarEl = null;
    let bodyContainer = null;

    if (isGmail) {
      sender  = _extractOpenSender();
      subject = _extractOpenSubject();
      body    = _extractOpenBody();

      const bodyEl  = document.querySelector(".a3s.aiL, .a3s");
      bodyContainer = bodyEl?.parentElement || bodyEl;
      toolbarEl     = document.querySelector(".gE.iv.gt, .ha, .aaq, [gh=\"mtb\"]") || document.querySelector(".hP")?.parentElement;

      const attachEls = [
        ...document.querySelectorAll(".aQA span"),
        ...document.querySelectorAll(".aV3"),
        ...document.querySelectorAll("[data-tooltip]"),
        ...document.querySelectorAll(".bAK span"),
      ];
      attachmentNames = [...new Set(
        attachEls
          .map(el => (el.textContent || el.getAttribute("data-tooltip") || "").trim())
          .filter(n => n && n.includes(".") && n.length < 120)
      )];
    } else if (isOutlook) {
      const senderEl  = document.querySelector("[data-convid] .oG, [data-tid=\"EmailHeaderSender\"]");
      const subjectEl = document.querySelector(".cN, [data-tid=\"SubjectHeader\"]");
      const bodyEl    = document.querySelector(".rps, [data-app-section=\"MessageBody\"]");
      bodyContainer   = bodyEl?.parentElement || bodyEl;
      toolbarEl       = document.querySelector(".Qc, [data-tid=\"MessageHeaderActions\"]") || subjectEl?.parentElement;

      sender  = senderEl?.textContent?.trim() || "";
      subject = subjectEl?.textContent?.trim() || "";
      body    = bodyEl?.innerText?.slice(0, 4000) || "";
      attachmentNames = [...document.querySelectorAll(".attachmentTitle, [data-app-section='Attachment'] span")]
        .map(el => el.textContent?.trim()).filter(Boolean);
    }

    if (!subject && !body) return;

    const emailKey = _makeEmailKey(sender, subject);

    const links  = _extractLinks(body, bodyContainer);
    const images = _extractImages(bodyContainer);

    let maxAttachScore = 0;
    const attachSignals = [];
    for (const name of attachmentNames) {
      const { score: as, signals: sig } = _scoreAttachment(name);
      if (as > maxAttachScore) maxAttachScore = as;
      attachSignals.push(...sig);
    }

    const linkEval = _scoreLinks(links);

    let record = _scannedEmailsMap.get(emailKey);

    if (!record || record.score === -1 || record.verdict === "offline") {
      const scanRes = await safeSendMessage({
        type: "EMAIL_DATA",
        sender,
        subject,
        body,
      });

      if (!scanRes || scanRes.ok !== true || !scanRes.result) {
        _scannedEmailsMap.set(emailKey, { score: null, verdict: "offline" });
        _injectOpenEmailBanner(null, "offline", bodyContainer);
        return;
      }

      const modelResult = scanRes?.result ?? scanRes ?? {};
      const modelProb   = modelResult.phishing_probability ?? 0;
      const baseScore   = Math.round(modelProb * 100);

      const unifiedScore = Math.min(100, Math.max(baseScore, linkEval.score, maxAttachScore));
      const verdict = _getRiskLevel(unifiedScore);

      record = {
        score: unifiedScore,
        verdict,
        modelResult,
        attachSignals,
        linkSignals: linkEval.signals,
        links,
        images,
        attachmentNames,
      };

      _scannedEmailsMap.set(emailKey, record);
      _saveToStorage();
      _updateRowBadge(emailKey, verdict, unifiedScore);
    } else {
      // Preserve exact inbox score — ZERO RE-SCAN & ZERO SCORE CHANGE on open!
      record.attachSignals = [...new Set([...record.attachSignals, ...attachSignals])];
      record.linkSignals   = [...new Set([...record.linkSignals, ...linkEval.signals])];
      record.links         = links;
      record.images        = images;
      _scannedEmailsMap.set(emailKey, record);
    }

    // Inject AI Analyze Button ONLY in Opened Email Toolbar
    if (toolbarEl) {
      _injectAIButton(toolbarEl, async (btn) => {
        btn.innerHTML = `<span>⏳</span><span>Analyzing...</span>`;
        btn.disabled = true;

        const emailXai = _buildEmailXAI(
          sender,
          subject,
          record.score ?? 0,
          record.modelResult?.xai_words || [],
          record.modelResult?.explanation || "",
          record.attachSignals,
          record.linkSignals,
          record.links,
          record.images,
          (record.score ?? 0) >= 50
        );

        btn.innerHTML = `<span>✨</span><span>Analyze Email with AI</span>`;
        btn.disabled = false;

        const { showXAIModal } = await import(chrome.runtime.getURL("content/modals.js"));
        showXAIModal(emailXai, {
          score: record.score ?? 0,
          url: subject ? `Email: "${subject}"` : "Email Message Analysis",
          threat_type: "phishing_email",
          targetType: "email",
        });
      });
    }

    // Render Open Email Status Banner
    if (!_processedOpenKeys.has(emailKey)) {
      _processedOpenKeys.add(emailKey);
      _injectOpenEmailBanner(record.score, record.verdict, bodyContainer);
    }
  }

  function _injectOpenEmailBanner(score, verdict, bodyContainer) {
    if (document.getElementById("aegis-email-banner")) return;
    const target = bodyContainer || document.querySelector(".a3s.aiL, .a3s")?.parentElement;
    if (!target) return;

    const banner = document.createElement("div");
    banner.id = "aegis-email-banner";

    const configs = {
      safe:       { icon: "✅", title: score > 0 ? `Email Appears Safe (Low Risk: ${score}%)` : "Email Appears Safe", color: "#34d399", bg: "rgba(16,185,129,0.08)", border: "rgba(16,185,129,0.25)", desc: `AegisOne's AI evaluated this email and found low phishing indicators (${score}% risk).` },
      suspicious: { icon: "⚠️", title: `Medium Risk Email Detected (${score}%)`, color: "#fbbf24", bg: "rgba(245,158,11,0.1)", border: "rgba(245,158,11,0.35)", desc: "This email has suspicious patterns or links. Exercise caution before replying." },
      phishing:   { icon: "🚨", title: `Phishing Email Detected! (High Risk: ${score}%)`, color: "#f87171", bg: "rgba(239,68,68,0.1)", border: "rgba(239,68,68,0.3)", desc: "AegisOne's neural AI detected phishing patterns. Do NOT reply or click links." },
      offline:    { icon: "🔌", title: "AegisOne Offline", color: "#94a3b8", bg: "rgba(148,163,184,0.1)", border: "rgba(148,163,184,0.3)", desc: "Security service unavailable. Connect to backend to enable AI email scanning." },
    };
    const cfg = configs[verdict] || configs.safe;

    banner.style.cssText = `
      padding: 10px 16px; margin: 8px 0 12px; border-radius: 10px;
      background: ${cfg.bg}; border: 1px solid ${cfg.border};
      font-family: 'Inter', -apple-system, sans-serif;
      display: flex; align-items: center; justify-content: space-between; gap: 12px;
    `;
    banner.innerHTML = `
      <div style="display:flex; align-items:center; gap:10px; flex:1">
        <span style="font-size:20px; line-height:1">${cfg.icon}</span>
        <div>
          <div style="font-size:13px; font-weight:700; color:${cfg.color}">${cfg.title}</div>
          <div style="font-size:11px; color:#94a3b8; margin-top:2px">${cfg.desc}</div>
        </div>
      </div>
      <button id="aegis-banner-close" style="
        background:none; border:none; color:#64748b; cursor:pointer;
        font-size:16px; padding:2px 6px; border-radius:4px;
        transition: color 0.2s;
      " title="Dismiss">✕</button>
    `;
    target.insertBefore(banner, target.firstChild);
    banner.querySelector("#aegis-banner-close")?.addEventListener("click", () => banner.remove());
  }

  // ─────────────────────────────────────────────────────────
  // SECTION 3: AI ANALYZE BUTTON INJECTOR
  // ─────────────────────────────────────────────────────────

  function _injectAIButton(container, onClick) {
    if (!container || container.querySelector(".aegis-email-ai-btn")) return;

    const btn = document.createElement("button");
    btn.className = "aegis-email-ai-btn";
    btn.style.cssText = `
      display: inline-flex; align-items: center; gap: 6px;
      padding: 5px 12px; margin-left: 10px;
      background: linear-gradient(135deg, rgba(59,130,246,0.18), rgba(139,92,246,0.18));
      border: 1px solid rgba(99,102,241,0.4);
      border-radius: 8px; color: #a5b4fc;
      font-size: 11px; font-weight: 700; cursor: pointer;
      font-family: 'Inter', -apple-system, sans-serif;
      transition: all 0.2s ease; z-index: 100;
    `;
    btn.innerHTML = `<span>✨</span><span>Analyze Email with AI</span>`;

    btn.addEventListener("mouseenter", () => {
      btn.style.background = "linear-gradient(135deg, rgba(59,130,246,0.3), rgba(139,92,246,0.3))";
      btn.style.borderColor = "rgba(99,102,241,0.7)";
      btn.style.color = "#ffffff";
    });
    btn.addEventListener("mouseleave", () => {
      btn.style.background = "linear-gradient(135deg, rgba(59,130,246,0.18), rgba(139,92,246,0.18))";
      btn.style.borderColor = "rgba(99,102,241,0.4)";
      btn.style.color = "#a5b4fc";
    });
    btn.addEventListener("click", (e) => {
      e.preventDefault();
      e.stopPropagation();
      onClick(btn);
    });

    container.appendChild(btn);
  }

  // ─────────────────────────────────────────────────────────
  // SECTION 4: XAI EXPLANATION BUILDER
  // ─────────────────────────────────────────────────────────

  function _buildEmailXAI(sender, subject, score, modelWords, modelExpl, attachSignals, linkSignals, links, images, isPhishing) {
    const senderDisplay = sender ? `"${sender}"` : "an unknown sender";
    const subjectDisplay = subject ? `"${subject}"` : "No Subject";

    if (isPhishing) {
      const reasons = [];
      if (modelWords.length > 0)
        reasons.push(`🔴 AI flagged suspicious keywords: ${modelWords.slice(0, 4).map(w => `"${w}"`).join(", ")}`);
      if (modelExpl && modelExpl !== "AI identified suspicious context structure")
        reasons.push(`🔴 ${modelExpl}`);

      reasons.push(`📧 Subject: ${subjectDisplay}`);
      reasons.push(`📨 Sender: ${senderDisplay}`);

      reasons.push(...linkSignals);
      reasons.push(...attachSignals);

      if (images && images.length > 0) {
        reasons.push(`🖼️ Embedded images detected (${images.length} images evaluated)`);
      }

      const bodyLower = (modelExpl + " " + (subject || "")).toLowerCase();
      if (bodyLower.includes("inheritance") || bodyLower.includes("terminal"))
        reasons.push("🚨 Inheritance/terminal illness narrative — classic advance-fee scam");
      if (bodyLower.includes("million") || bodyLower.includes("usd"))
        reasons.push("🚨 Large financial sum — typical 419/advance-fee scam");
      if (bodyLower.includes("30%") || bodyLower.includes("percentage"))
        reasons.push("🚨 Percentage reward offer — hallmark of advance-fee fraud");

      return {
        summary: `⚠️ AegisOne's AI detected this email from ${senderDisplay} as likely phishing (${score}% risk). Do NOT reply.`,
        main_reasons: reasons.length > 0 ? reasons : [
          "🔴 Neural email AI detected phishing patterns in content structure",
          `📧 Subject: ${subjectDisplay}`,
          `📨 Sender: ${senderDisplay}`,
        ],
        recommendations: [
          "🚫 Do NOT reply or provide personal/financial information.",
          "🚫 Do NOT click any links or download attachments.",
          "📣 Report as phishing using Gmail's \"Report phishing\" option.",
          "🔍 Verify the sender's identity through official channels.",
        ],
        generated_locally: false,
      };
    } else {
      const reasons = [
        "✅ No phishing keywords or suspicious patterns detected",
        "✅ Email structure consistent with legitimate communication",
        `📧 Subject: ${subjectDisplay}`,
        `📨 Sender: ${senderDisplay}`,
      ];
      if (links && links.length > 0) {
        reasons.push(`🔗 Links evaluated: ${links.length} link(s) checked and clean`);
      }
      if (images && images.length > 0) {
        reasons.push(`🖼️ Embedded images evaluated (${images.length} image(s) clean)`);
      }

      return {
        summary: score > 0
          ? `✅ AegisOne's AI evaluated this email from ${senderDisplay} and found low phishing indicators (${score}% risk).`
          : `✅ AegisOne's AI evaluated this email from ${senderDisplay} and found no phishing indicators (0% risk).`,
        main_reasons: reasons,
        recommendations: [
          "✅ This email appears safe — carry on!",
          "🔍 Always verify sender identity for financial or sensitive requests.",
        ],
        generated_locally: false,
      };
    }
  }

  // ─────────────────────────────────────────────────────────
  // SECTION 5: MAIN SCAN ORCHESTRATOR
  // ─────────────────────────────────────────────────────────

  let _scanTimer = null;
  let _lastScanAt = 0;
  const SCAN_THROTTLE_MS = 600;

  function _onDOMChanged() {
    clearTimeout(_scanTimer);
    _scanTimer = setTimeout(_runScan, SCAN_THROTTLE_MS);
  }

  function _runScan() {
    const now = Date.now();
    if (now - _lastScanAt < 300) return;
    _lastScanAt = now;

    _scanInboxBatch();

    const openEmailEl = document.querySelector(".a3s.aiL, .a3s, .rps, [data-app-section=\"MessageBody\"]");
    if (openEmailEl && openEmailEl.innerText?.length > 20) {
      _scanOpenEmail();
    }
  }

  // ─────────────────────────────────────────────────────────
  // SECTION 6: MUTATION OBSERVER & NAVIGATION WATCHDOG
  // ─────────────────────────────────────────────────────────

  const root = document.querySelector(".AO") || document.querySelector("#app") || document.body;
  const observer = new MutationObserver(_onDOMChanged);
  observer.observe(root, { childList: true, subtree: true });

  let _lastUrl = location.href;
  const navObserver = new MutationObserver(() => {
    if (location.href !== _lastUrl) {
      _lastUrl = location.href;
      document.getElementById("aegis-email-banner")?.remove();
      document.querySelector(".aegis-email-ai-btn")?.remove();
      setTimeout(_runScan, 500);
    }
  });
  navObserver.observe(document.querySelector("title") || document.documentElement, { subtree: true, characterData: true, childList: true });

  setTimeout(_runScan, 1000);
}
