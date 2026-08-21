/**
 * AegisOne — Content Script Plugin: Email Guard (Gmail & Outlook)
 * =================================================================
 * Real-time email threat protection adapter for webmail clients.
 * Features:
 *  - Subject, sender, body text, and link scanning
 *  - Attachment risk evaluation (executable extensions, double extensions, phishing keywords)
 *  - Interactive "✨ Analyze with Aegis AI" toolbar button injection
 */

export function initEmailGuard() {
  const isGmail = location.hostname.includes("mail.google.com");
  const isOutlook = location.hostname.includes("outlook.") || location.hostname.includes("office.com");
  if (!isGmail && !isOutlook) return;

  console.log(`[AegisOne:EmailGuard] Initializing email protection for ${isGmail ? "Gmail" : "Outlook"}`);

  const _processedEmails = new Set();
  const PHISHING_FILENAME_KEYWORDS = [
    "phishing", "malicious", "invoice", "urgent", "password", "verify",
    "account", "suspended", "paypal", "banking", "login", "secure", "remittance", "payment"
  ];
  const DANGEROUS_EXTENSIONS = [".exe", ".bat", ".cmd", ".vbs", ".ps1", ".js", ".jar", ".scr", ".html", ".htm", ".zip", ".rar"];
  const HIGH_RISK_EXTENSIONS  = [".exe", ".bat", ".cmd", ".vbs", ".ps1", ".scr"];

  function _scoreAttachment(name) {
    const lower = name.toLowerCase();
    let score = 0;
    const signals = [];

    if (HIGH_RISK_EXTENSIONS.some(ext => lower.endsWith(ext))) {
      score += 70;
      signals.push(`Dangerous file extension: .${lower.split(".").pop().toUpperCase()}`);
    } else if (DANGEROUS_EXTENSIONS.some(ext => lower.endsWith(ext))) {
      score += 40;
      signals.push(`Executable/Archive file type: .${lower.split(".").pop().toUpperCase()}`);
    }

    const matchedKeywords = PHISHING_FILENAME_KEYWORDS.filter(k => lower.includes(k));
    if (matchedKeywords.length > 0) {
      score += matchedKeywords.length * 20;
      signals.push(`Suspicious attachment keyword: "${matchedKeywords[0]}"`);
    }

    if (/\.[a-z]{2,4}\.[a-z]{2,4}$/i.test(name)) {
      score += 35;
      signals.push("Double file extension detected");
    }

    return { score: Math.min(100, score), signals };
  }

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
      transition: all 0.2s ease;
      z-index: 100;
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

  function _scanEmailDOM() {
    let sender = "", subject = "", body = "";
    let attachmentNames = [];
    let toolbarEl = null;

    if (isGmail) {
      const senderEl  = document.querySelector('[email], [data-hovercard-id]');
      const subjectEl = document.querySelector('h2[data-thread-perm-id], .hP');
      const bodyEl    = document.querySelector('.a3s.aiL');
      toolbarEl       = document.querySelector('.gE.iv.gt, .ha') || subjectEl?.parentElement;

      sender  = senderEl?.getAttribute('email') || senderEl?.getAttribute('data-hovercard-id') || senderEl?.textContent || '';
      subject = subjectEl?.textContent?.trim() || '';
      body    = bodyEl?.innerText?.slice(0, 2500) || '';

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
      const senderEl  = document.querySelector('[data-convid] .oG, [data-tid="EmailHeaderSender"]');
      const subjectEl = document.querySelector('.cN, [data-tid="SubjectHeader"]');
      const bodyEl    = document.querySelector('.rps, [data-app-section="MessageBody"]');
      toolbarEl       = document.querySelector('.Qc, [data-tid="MessageHeaderActions"]') || subjectEl?.parentElement;

      sender  = senderEl?.textContent?.trim() || '';
      subject = subjectEl?.textContent?.trim() || '';
      body    = bodyEl?.innerText?.slice(0, 2500) || '';

      attachmentNames = [...document.querySelectorAll(".attachmentTitle, [data-app-section='Attachment'] span")]
        .map(el => el.textContent?.trim())
        .filter(Boolean);
    }

    if (!subject && !body) return;

    const emailKey = `${sender}|${subject}|${attachmentNames.join(",")}`;

    // Inject AI analysis button into toolbar
    if (toolbarEl) {
      _injectAIButton(toolbarEl, async (btn) => {
        btn.textContent = "⏳ Analyzing Email...";
        btn.disabled = true;

        const scanRes = await chrome.runtime.sendMessage({
          type: "EMAIL_DATA",
          sender,
          subject,
          body,
        }).catch(() => null);

        // Calculate attachment risk signals
        let maxAttachScore = 0;
        const attachSignals = [];
        for (const name of attachmentNames) {
          const { score, signals } = _scoreAttachment(name);
          if (score > maxAttachScore) maxAttachScore = score;
          attachSignals.push(...signals);
        }

        const emailScore = Math.max(
          scanRes?.result?.risk_score || scanRes?.risk_score || 0,
          maxAttachScore
        );

        // Request XAI explanation
        const xaiRes = await chrome.runtime.sendMessage({
          type: "XAI_REQUEST",
          url: location.href,
          score: emailScore,
          threat_type: "phishing_email",
        }).catch(() => null);

        btn.textContent = "✨ Analyze Email with AI";
        btn.disabled = false;

        const { showXAIModal } = await import(chrome.runtime.getURL("content/modals.js"));
        const targetLabel = attachmentNames[0] ? `Email Attachment: ${attachmentNames[0]}` : (subject ? `Email: "${subject}"` : "Email Message Analysis");
        showXAIModal(xaiRes?.xai || {
          summary: `AegisOne evaluated this email from "${sender || 'Sender'}" (${emailScore}% risk).`,
          main_reasons: [
            subject ? `Subject: "${subject}"` : "Email header analysis",
            ...attachSignals,
          ],
          recommendations: [
            "Verify the sender address before replying or downloading attachments.",
            "Do not execute attachments from unverified senders.",
          ],
          generated_locally: true,
        }, {
          score: emailScore,
          url: targetLabel,
          threat_type: "phishing_email",
          targetType: "email",
        });
      });
    }

    if (_processedEmails.has(emailKey)) return;
    _processedEmails.add(emailKey);

    // Send email data for background scanning
    if (body.length > 30) {
      chrome.runtime.sendMessage({ type: "EMAIL_DATA", sender, subject, body }).catch(() => {});
    }

    if (attachmentNames.length > 0) {
      let maxScore = 0;
      const allSignals = [];
      for (const name of attachmentNames) {
        const { score, signals } = _scoreAttachment(name);
        if (score > maxScore) maxScore = score;
        allSignals.push(...signals.map(s => ({ label: `📎 "${name}": ${s}` })));
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

  // Throttle DOM observations
  let _timer = null;
  const observer = new MutationObserver(() => {
    clearTimeout(_timer);
    _timer = setTimeout(_scanEmailDOM, 1000);
  });

  const root = document.querySelector('.AO') || document.querySelector('#app') || document.body;
  observer.observe(root, { childList: true, subtree: true });

  // Initial check
  setTimeout(_scanEmailDOM, 1500);
}
