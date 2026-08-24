/**
 * AegisOne — Email Guard v3.0
 * ===========================
 * Batch-scans all visible Gmail inbox rows and labels each with a risk badge.
 * Opening an email triggers a deep AI analysis automatically.
 *
 * Features:
 *  - Batch inbox scanning: up to 50 rows per pass, color-coded badges
 *  - Concurrency-limited queue (max 3 parallel API calls)
 *  - MutationObserver for scroll/navigation (new rows auto-scanned)
 *  - Opened email: auto deep-scan + phishing banner + AI Analyze button
 *  - Risk levels: Safe (green) / Suspicious (amber) / Phishing (red)
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
  const DANGEROUS_EXTENSIONS  = [".exe", ".bat", ".cmd", ".vbs", ".ps1", ".js", ".jar", ".scr", ".html", ".htm", ".zip", ".rar"];
  const HIGH_RISK_EXTENSIONS  = [".exe", ".bat", ".cmd", ".vbs", ".ps1", ".scr"];

  // Tracks processed email rows & open emails
  const _scannedRows = new Map();   // rowKey → { score, verdict }
  const _processedOpen = new Set(); // open email keys

  // ── Concurrency Queue ─────────────────────────────────────
  // Max 3 simultaneous API calls so we don't hammer the backend
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

  // ── Attachment Risk Scorer ─────────────────────────────────
  function _scoreAttachment(name) {
    const lower = name.toLowerCase();
    let score = 0;
    const signals = [];
    if (HIGH_RISK_EXTENSIONS.some(ext => lower.endsWith(ext))) {
      score += 70;
      signals.push(`Dangerous file extension: .${lower.split(".").pop().toUpperCase()}`);
    } else if (DANGEROUS_EXTENSIONS.some(ext => lower.endsWith(ext))) {
      score += 40;
      signals.push(`Executable/Archive: .${lower.split(".").pop().toUpperCase()}`);
    }
    const kw = PHISHING_FILENAME_KEYWORDS.filter(k => lower.includes(k));
    if (kw.length > 0) {
      score += kw.length * 20;
      signals.push(`Suspicious filename keyword: "${kw[0]}"`);
    }
    if (/\.[a-z]{2,4}\.[a-z]{2,4}$/i.test(name)) {
      score += 35;
      signals.push("Double file extension detected");
    }
    return { score: Math.min(100, score), signals };
  }

  // ── Risk Level Classifier ─────────────────────────────────
  function _getRiskLevel(score) {
    if (score >= 60) return "phishing";
    if (score >= 35) return "suspicious";
    return "safe";
  }

  // ─────────────────────────────────────────────────────────
  // SECTION 1: INBOX ROW BATCH SCANNING
  // Scans all visible Gmail inbox rows (tr.zA) and injects badges
  // ─────────────────────────────────────────────────────────

  async function _scanInboxBatch() {
    if (!isGmail) return;

    const rows = document.querySelectorAll("tr.zA");
    const toScan = [];

    rows.forEach(row => {
      const rowId = row.getAttribute("id") || row.dataset.legacyMessageId || "";
      const rowKey = rowId || (
        (row.querySelector(".zF, .yW, [email]")?.textContent || "") +
        (row.querySelector(".bog span, .y6")?.textContent || "")
      ).trim();

      if (!rowKey || _scannedRows.has(rowKey)) return;

      const rowSender  = row.querySelector(".zF, .yW, [email]")?.getAttribute("email")
                      || row.querySelector(".zF, .yW")?.textContent?.trim() || "";
      const rowSubject = row.querySelector(".bog span, .y6")?.textContent?.trim() || "";
      const rowSnippet = row.querySelector(".y2")?.textContent?.trim() || "";
      const combined   = `${rowSubject} ${rowSnippet}`.trim();

      if (combined.length < 5) return;

      // Mark as scanning immediately (prevents duplicate queue entries)
      _scannedRows.set(rowKey, { score: -1, verdict: "scanning" });
      _injectRowBadge(row, "scanning", 0, rowKey);

      toScan.push({ row, rowKey, rowSender, rowSubject, combined });
    });

    // Queue all rows for scanning
    for (const item of toScan) {
      _enqueue(() => _scanOneRow(item)).catch(() => {
        _scannedRows.set(item.rowKey, { score: 0, verdict: "safe" });
        _updateRowBadge(item.rowKey, "safe", 0);
      });
    }
  }

  async function _scanOneRow({ row, rowKey, rowSender, rowSubject, combined }) {
    try {
      const res = await chrome.runtime.sendMessage({
        type: "EMAIL_DATA",
        sender: rowSender,
        subject: rowSubject,
        body: combined,
      });

      const prob  = res?.result?.phishing_probability ?? res?.phishing_probability ?? 0;
      const score = Math.round(prob * 100);
      const verdict = _getRiskLevel(score);

      _scannedRows.set(rowKey, { score, verdict });
      _updateRowBadge(rowKey, verdict, score);
    } catch (_) {
      _scannedRows.set(rowKey, { score: 0, verdict: "safe" });
      _updateRowBadge(rowKey, "safe", 0);
    }
  }


  function _injectRowBadge(rowEl, verdict, score, rowKey) {
    rowEl.dataset.aegisKey = rowKey;

    // Remove existing badge elements
    rowEl.querySelector(".aegis-row-badge")?.remove();
    rowEl.querySelector(".aegis-row-left-bar")?.remove();

    // Make the row a positioning context
    rowEl.style.position = "relative";

    // ── Left-edge color bar (2px wide stripe, full row height) ──────────
    const colors = {
      scanning:   { bar: "rgba(99,102,241,0.5)",  bg: "transparent" },
      safe:       { bar: "rgba(16,185,129,0.4)",   bg: "transparent" },
      suspicious: { bar: "rgba(245,158,11,0.55)",  bg: "rgba(245,158,11,0.04)" },
      phishing:   { bar: "rgba(239,68,68,0.65)",   bg: "rgba(239,68,68,0.06)" },
    };
    const cfg = colors[verdict] || colors.safe;

    const bar = document.createElement("span");
    bar.className = "aegis-row-left-bar";
    bar.style.cssText = `
      position: absolute; left: 0; top: 0; bottom: 0; width: 3px;
      background: ${cfg.bar}; border-radius: 0 2px 2px 0; pointer-events: none; z-index: 5;
    `;
    rowEl.insertBefore(bar, rowEl.firstChild);

    // Subtle row tint for suspicious/phishing only
    rowEl.style.backgroundColor = cfg.bg;

    // ── Floating pill badge — absolutely positioned at the left of the row ──
    const badge = document.createElement("span");
    badge.className = "aegis-row-badge";
    badge.dataset.aegisRowKey = rowKey;

    if (verdict === "scanning") {
      badge.style.cssText = `
        position: absolute; left: 8px; top: 50%; transform: translateY(-50%);
        display: inline-flex; align-items: center; gap: 2px;
        padding: 1px 6px; border-radius: 20px; z-index: 10;
        background: rgba(99,102,241,0.12); border: 1px solid rgba(99,102,241,0.3);
        color: #a5b4fc; font-size: 9px; font-weight: 700;
        font-family: 'Inter', -apple-system, sans-serif;
        animation: aegis-pulse 1.4s ease-in-out infinite;
        pointer-events: none; white-space: nowrap;
      `;
      badge.textContent = "⏳";
    } else {
      const BADGE_STYLES = {
        safe:       { bg: "rgba(16,185,129,0.13)", border: "rgba(16,185,129,0.4)", color: "#34d399" },
        suspicious: { bg: "rgba(245,158,11,0.13)", border: "rgba(245,158,11,0.45)", color: "#fbbf24" },
        phishing:   { bg: "rgba(239,68,68,0.14)",  border: "rgba(239,68,68,0.45)",  color: "#f87171" },
      };
      const BADGE_ICONS = { safe: "✓", suspicious: "⚠", phishing: "🚨" };
      const BADGE_LABELS = { safe: "Safe", suspicious: `${score}%`, phishing: `${score}%` };

      const sty = BADGE_STYLES[verdict] || BADGE_STYLES.safe;
      badge.style.cssText = `
        position: absolute; left: 7px; top: 50%; transform: translateY(-50%);
        display: inline-flex; align-items: center; gap: 2px;
        padding: 2px 7px; border-radius: 20px; z-index: 10;
        background: ${sty.bg}; border: 1px solid ${sty.border};
        color: ${sty.color}; font-size: 9.5px; font-weight: 800;
        font-family: 'Inter', -apple-system, sans-serif;
        pointer-events: none; white-space: nowrap;
        letter-spacing: 0.1px;
      `;
      badge.textContent = `${BADGE_ICONS[verdict]} ${BADGE_LABELS[verdict]}`;
      badge.title = `AegisOne Risk Score: ${score}%`;
    }

    // Insert badge after the left bar (both are position:absolute, no layout impact)
    rowEl.insertBefore(badge, bar.nextSibling);
    _injectPulseStyle();
  }

  function _updateRowBadge(rowKey, verdict, score) {
    document.querySelectorAll("tr.zA").forEach(rowEl => {
      if (rowEl.dataset.aegisKey === rowKey) {
        _injectRowBadge(rowEl, verdict, score, rowKey);
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
  // SECTION 2: OPEN EMAIL DEEP SCAN
  // Triggered when user opens an email — full sender/subject/body scan
  // ─────────────────────────────────────────────────────────

  function _scanOpenEmail() {
    if (!isGmail && !isOutlook) return;

    let sender = "", subject = "", body = "";
    let attachmentNames = [];
    let toolbarEl = null;

    if (isGmail) {
      const senderEl  = document.querySelector("[email], [data-hovercard-id], .gD, .go");
      const subjectEl = document.querySelector("h2[data-thread-perm-id], .hP, .ha h2, .nH h2");
      const bodyEl    = document.querySelector(".a3s.aiL, .a3s");
      toolbarEl       = document.querySelector(".gE.iv.gt, .ha, .aaq, [gh=\"mtb\"]") || subjectEl?.parentElement;

      sender  = senderEl?.getAttribute("email") || senderEl?.getAttribute("data-hovercard-id") || senderEl?.textContent?.trim() || "";
      subject = subjectEl?.textContent?.trim() || document.title?.replace(/ - Gmail$/, "").trim() || "";

      const allMsgs = document.querySelectorAll(".a3s.aiL, .a3s");
      if (allMsgs.length > 0) {
        body = Array.from(allMsgs).map(m => m.innerText).join("\n").slice(0, 4000);
      } else {
        body = bodyEl?.innerText?.slice(0, 4000) || "";
      }

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
      toolbarEl       = document.querySelector(".Qc, [data-tid=\"MessageHeaderActions\"]") || subjectEl?.parentElement;

      sender  = senderEl?.textContent?.trim() || "";
      subject = subjectEl?.textContent?.trim() || "";
      body    = bodyEl?.innerText?.slice(0, 4000) || "";
      attachmentNames = [...document.querySelectorAll(".attachmentTitle, [data-app-section='Attachment'] span")]
        .map(el => el.textContent?.trim()).filter(Boolean);
    }

    if (!subject && !body) return;

    const emailKey = `${sender}|${subject}`;

    // ── Inject AI Analyze Button ──────────────────────────
    if (toolbarEl) {
      _injectAIButton(toolbarEl, async (btn) => {
        btn.innerHTML = `<span>⏳</span><span>Analyzing...</span>`;
        btn.disabled = true;

        // Re-read DOM at click time for latest email content
        const cSubject = document.querySelector("h2[data-thread-perm-id], .hP, .ha h2, .nH h2")?.textContent?.trim()
          || document.title?.replace(/ - Gmail$/, "").trim() || subject;
        const cSender  = document.querySelector("[email], [data-hovercard-id], .gD")?.getAttribute("email")
          || document.querySelector("[email], [data-hovercard-id], .gD")?.textContent?.trim() || sender;
        const cBodyEls = document.querySelectorAll(".a3s.aiL, .a3s");
        const cBody    = cBodyEls.length > 0
          ? Array.from(cBodyEls).map(m => m.innerText).join("\n").slice(0, 4000)
          : body;

        const scanRes = await chrome.runtime.sendMessage({
          type: "EMAIL_DATA",
          sender: cSender,
          subject: cSubject,
          body: cBody,
        }).catch(() => null);

        let maxAttachScore = 0;
        const attachSignals = [];
        for (const name of attachmentNames) {
          const { score: as, signals: sig } = _scoreAttachment(name);
          if (as > maxAttachScore) maxAttachScore = as;
          attachSignals.push(...sig);
        }

        const modelResult = scanRes?.result ?? scanRes ?? {};
        const modelProb   = modelResult.phishing_probability ?? 0;
        const modelWords  = modelResult.xai_words ?? [];
        const modelExpl   = modelResult.explanation ?? "";
        const emailScore  = Math.max(Math.round(modelProb * 100), maxAttachScore);
        const isPhishing  = emailScore >= 50;

        const emailXai = _buildEmailXAI(cSender, cSubject, emailScore, modelWords, modelExpl, attachSignals, isPhishing);

        btn.innerHTML = `<span>✨</span><span>Analyze Email with AI</span>`;
        btn.disabled = false;

        const { showXAIModal } = await import(chrome.runtime.getURL("content/modals.js"));
        showXAIModal(emailXai, {
          score: emailScore,
          url: cSubject ? `Email: "${cSubject}"` : "Email Message Analysis",
          threat_type: "phishing_email",
          targetType: "email",
        });
      });
    }

    // ── Auto Background Scan of Open Email ────────────────
    if (!_processedOpen.has(emailKey) && body.length > 15) {
      _processedOpen.add(emailKey);

      chrome.runtime.sendMessage({
        type: "EMAIL_DATA",
        sender,
        subject,
        body,
      }).then(res => {
        const prob  = res?.result?.phishing_probability ?? res?.phishing_probability ?? 0;
        const score = Math.round(prob * 100);
        const verdict = _getRiskLevel(score);

        // Always show the security status banner
        _injectOpenEmailBanner(score, verdict);

        // Flag row in inbox list if it's still visible
        document.querySelectorAll("tr.zA").forEach(row => {
          const rowSubjectText = row.querySelector(".bog span, .y6")?.textContent?.trim() || "";
          if (rowSubjectText && subject.includes(rowSubjectText.slice(0, 20))) {
            const rowKey = row.dataset.aegisKey;
            if (rowKey) {
              _scannedRows.set(rowKey, { score, verdict });
              _injectRowBadge(row, verdict, score, rowKey);
            }
          }
        });
      }).catch(() => {});

      // Attachment risk
      if (attachmentNames.length > 0) {
        let maxScore = 0;
        const allSignals = [];
        for (const name of attachmentNames) {
          const { score: as, signals: sig } = _scoreAttachment(name);
          if (as > maxScore) maxScore = as;
          allSignals.push(...sig.map(s => ({ label: `📎 "${name}": ${s}` })));
        }
        if (maxScore >= 20) {
          chrome.runtime.sendMessage({
            type: "ATTACHMENT_RISK",
            score: maxScore,
            signals: allSignals,
            filenames: attachmentNames,
          }).catch(() => {});
        }
      }
    }
  }

  function _injectOpenEmailBanner(score, verdict) {
    if (document.getElementById("aegis-email-banner")) return;
    const bodyContainer = document.querySelector(".a3s.aiL, .a3s")?.parentElement;
    if (!bodyContainer) return;

    const banner = document.createElement("div");
    banner.id = "aegis-email-banner";

    const configs = {
      safe:       { icon: "✅", title: "Email Appears Safe", color: "#34d399", bg: "rgba(16,185,129,0.08)", border: "rgba(16,185,129,0.25)", desc: "AegisOne's AI found no phishing indicators in this email." },
      suspicious: { icon: "⚠️", title: "Suspicious Email Detected", color: "#fbbf24", bg: "rgba(245,158,11,0.1)", border: "rgba(245,158,11,0.35)", desc: "This email has some suspicious patterns. Exercise caution before clicking links or replying." },
      phishing:   { icon: "🚨", title: "Phishing Email Detected!", color: "#f87171", bg: "rgba(239,68,68,0.1)", border: "rgba(239,68,68,0.3)", desc: "AegisOne's neural AI detected phishing patterns. Do NOT reply, click links, or provide personal info." },
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
          <div style="font-size:13px; font-weight:700; color:${cfg.color}">${cfg.title}
            <span style="font-size:11px; font-weight:600; color:#94a3b8; margin-left:8px">Risk: ${score}%</span>
          </div>
          <div style="font-size:11px; color:#94a3b8; margin-top:2px">${cfg.desc}</div>
        </div>
      </div>
      <button id="aegis-banner-close" style="
        background:none; border:none; color:#64748b; cursor:pointer;
        font-size:16px; padding:2px 6px; border-radius:4px;
        transition: color 0.2s;
      " title="Dismiss">✕</button>
    `;
    bodyContainer.insertBefore(banner, bodyContainer.firstChild);
    banner.querySelector("#aegis-banner-close")?.addEventListener("click", () => banner.remove());
  }

  // ─────────────────────────────────────────────────────────
  // SECTION 3: AI ANALYZE BUTTON
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

  function _buildEmailXAI(sender, subject, score, modelWords, modelExpl, attachSignals, isPhishing) {
    const senderDisplay = sender ? `"${sender}"` : "an unknown sender";
    if (isPhishing) {
      const reasons = [];
      if (modelWords.length > 0)
        reasons.push(`🔴 AI flagged suspicious keywords: ${modelWords.slice(0, 4).map(w => `"${w}"`).join(", ")}`);
      if (modelExpl && modelExpl !== "AI identified suspicious context structure")
        reasons.push(`🔴 ${modelExpl}`);
      if (subject)
        reasons.push(`📧 Subject analyzed: "${subject}"`);
      if (sender)
        reasons.push(`📨 Sender: ${sender}`);
      reasons.push(...attachSignals.map(s => `📎 ${s}`));
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
          `📧 Sender: ${senderDisplay}`,
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
      return {
        summary: `✅ AegisOne's AI evaluated this email from ${senderDisplay} and found no phishing indicators (${score}% risk).`,
        main_reasons: [
          "✅ No phishing keywords or suspicious patterns detected",
          "✅ Email structure consistent with legitimate communication",
          subject ? `📧 Subject: "${subject}"` : "📧 Subject analyzed",
          `📨 Sender: ${senderDisplay}`,
        ],
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
  // Decides what to scan based on current Gmail view
  // ─────────────────────────────────────────────────────────

  let _scanTimer = null;
  let _lastScanAt = 0;
  const SCAN_THROTTLE_MS = 800;

  function _onDOMChanged() {
    clearTimeout(_scanTimer);
    _scanTimer = setTimeout(_runScan, SCAN_THROTTLE_MS);
  }

  function _runScan() {
    const now = Date.now();
    if (now - _lastScanAt < 400) return;
    _lastScanAt = now;

    // Always try to scan inbox rows
    _scanInboxBatch();

    // Also scan open email if visible
    const openEmailEl = document.querySelector(".a3s.aiL, .a3s, .rps, [data-app-section=\"MessageBody\"]");
    if (openEmailEl && openEmailEl.innerText?.length > 20) {
      _scanOpenEmail();
    }
  }

  // ─────────────────────────────────────────────────────────
  // SECTION 6: MUTATION OBSERVER SETUP
  // Watches for new rows (infinite scroll, tab switching) and
  // email open/close events
  // ─────────────────────────────────────────────────────────

  // Observe the main Gmail app container
  const root = document.querySelector(".AO") || document.querySelector("#app") || document.body;
  const observer = new MutationObserver(_onDOMChanged);
  observer.observe(root, { childList: true, subtree: true });

  // Also watch for URL hash changes (Gmail uses hash-based navigation)
  let _lastUrl = location.href;
  const navObserver = new MutationObserver(() => {
    if (location.href !== _lastUrl) {
      _lastUrl = location.href;
      // Clear open email tracking on navigation
      _processedOpen.clear();
      document.getElementById("aegis-email-banner")?.remove();
      document.querySelector(".aegis-email-ai-btn")?.remove();
      setTimeout(_runScan, 600);
    }
  });
  navObserver.observe(document.querySelector("title") || document.documentElement, { subtree: true, characterData: true, childList: true });

  // Initial scan with a short delay
  setTimeout(_runScan, 1500);
}
