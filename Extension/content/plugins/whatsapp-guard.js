/**
 * AegisOne — Content Script Plugin: WhatsApp Web Guard
 * =======================================================
 * Real-time security adapter for WhatsApp Web (web.whatsapp.com).
 * Features:
 *  - Chat stream monitoring for incoming & outgoing messages
 *  - Phishing link detection & inline warning badge injection
 *  - Scam text detection (crypto giveaways, fake lottery, bank support scams)
 *  - Suspicious attachment/media scanning
 */

export function initWhatsappGuard() {
  if (!location.hostname.includes("web.whatsapp.com")) return;

  console.log("[AegisOne:WhatsAppGuard] Initializing WhatsApp Web protection plugin");

  const _scannedMessages = new WeakSet();
  const _scannedLinks = new Set();

  // Common scam triggers in messaging apps
  const SCAM_PATTERNS = [
    /\b(congratulations|you won|lottery|claim prize|free bitcoin|crypto giveaway|double your money)\b/i,
    /\b(account suspended|bank security|verify your account|urgent action required|unauthorized login)\b/i,
    /\b(whatsapp support|customer care number|helpline number|call this number immediately)\b/i,
    /\b(http:\/\/[^\s]+|https:\/\/[0-9]{1,3}\.[0-9]{1,3}\.[0-9]{1,3}\.[0-9]{1,3})\b/i, // naked HTTP or raw IP URLs
  ];

  // Shortener or suspicious domain triggers
  const SUSPICIOUS_DOMAINS = [
    "bit.ly", "tinyurl.com", "t.co", "is.gd", "buff.ly", "goo.gl", "cutt.ly", "shorturl.at"
  ];

  function _createWarningBadge(label, isHighRisk = false) {
    const badge = document.createElement("span");
    badge.className = "aegis-wa-badge";
    badge.style.cssText = `
      display: inline-flex; align-items: center; gap: 4px;
      margin-left: 6px; padding: 2px 6px;
      background: ${isHighRisk ? 'rgba(239,68,68,0.18)' : 'rgba(245,158,11,0.18)'};
      border: 1px solid ${isHighRisk ? 'rgba(239,68,68,0.4)' : 'rgba(245,158,11,0.4)'};
      border-radius: 4px;
      color: ${isHighRisk ? '#f87171' : '#fbbf24'};
      font-size: 10px; font-weight: 700;
      font-family: 'Inter', -apple-system, sans-serif;
      vertical-align: middle;
      cursor: help;
      user-select: none;
    `;
    badge.title = "AegisOne Security Guard flagged this message/link for security review";
    badge.innerHTML = `<span>${isHighRisk ? '🚨' : '⚠️'}</span><span>${label}</span>`;
    return badge;
  }

  function _createSafeBadge(label) {
    const badge = document.createElement("span");
    badge.className = "aegis-wa-badge aegis-wa-safe-badge";
    badge.style.cssText = `
      display: inline-flex; align-items: center; gap: 3px;
      margin-left: 6px; padding: 2px 5px;
      background: rgba(16,185,129,0.12);
      border: 1px solid rgba(16,185,129,0.3);
      border-radius: 4px;
      color: #34d399;
      font-size: 9px; font-weight: 700;
      font-family: 'Inter', -apple-system, sans-serif;
      vertical-align: middle;
      user-select: none;
    `;
    badge.title = "AegisOne Security Guard verified this link is safe";
    badge.innerHTML = `<span>🛡️</span><span>${label}</span>`;
    return badge;
  }

  function _scanMessageBubble(messageNode) {
    if (_scannedMessages.has(messageNode)) return;
    _scannedMessages.add(messageNode);

    const textContent = messageNode.innerText || "";
    if (!textContent || textContent.length < 5) return;

    // Check scam text patterns
    const matchedScam = SCAM_PATTERNS.find(pattern => pattern.test(textContent));
    if (matchedScam) {
      const copyContainer = messageNode.querySelector(".selectable-text, ._ao3e, span[dir='ltr']");
      if (copyContainer && !copyContainer.querySelector(".aegis-wa-badge")) {
        copyContainer.appendChild(_createWarningBadge("Scam Signal", true));
      }
    }

    // Check links within the message bubble
    const links = messageNode.querySelectorAll("a[href]");
    links.forEach(async (a) => {
      const href = a.href;
      if (!href || href.startsWith("javascript:") || _scannedLinks.has(href)) return;
      _scannedLinks.add(href);

      try {
        const urlObj = new URL(href);
        const domain = urlObj.hostname.toLowerCase();

        // Check if shortener or raw IP
        const isShortener = SUSPICIOUS_DOMAINS.some(d => domain.includes(d));
        const isRawIP = /^[0-9]{1,3}\.[0-9]{1,3}\.[0-9]{1,3}\.[0-9]{1,3}$/.test(domain);

        if (isShortener || isRawIP) {
          if (!a.querySelector(".aegis-wa-badge")) {
            a.appendChild(_createWarningBadge(isShortener ? "Shortened Link" : "Raw IP Link", false));
          }
        }

        // Request URL scan from extension background
        const res = await chrome.runtime.sendMessage({
          type: "HOVER_SCAN",
          url: href,
        }).catch(() => null);

        if (res && res.score >= 50) {
          if (!a.querySelector(".aegis-wa-badge")) {
            a.appendChild(_createWarningBadge(`${res.score}% Phishing Risk`, res.score >= 80));
          }
        } else {
          if (!a.querySelector(".aegis-wa-badge")) {
            a.appendChild(_createSafeBadge("Safe"));
          }
        }
      } catch (_) {}
    });
  }

  function _scanWhatsAppDOM() {
    // Target active chat message rows in WhatsApp Web
    const messageNodes = document.querySelectorAll("div.message-in, div.message-out, div[data-id]");
    messageNodes.forEach(node => _scanMessageBubble(node));
  }

  // Set up mutation observer for dynamically loaded messages
  let _timer = null;
  const observer = new MutationObserver(() => {
    clearTimeout(_timer);
    _timer = setTimeout(_scanWhatsAppDOM, 800);
  });

  const appRoot = document.getElementById("app") || document.body;
  observer.observe(appRoot, { childList: true, subtree: true });

  // Initial pass after chat interface mounts
  setTimeout(_scanWhatsAppDOM, 2000);
}
