/**
 * AegisOne — Content Script Plugin: WhatsApp Web Guard
 * ======================================================
 * Watches incoming WhatsApp Web messages, extracts text + any URLs, and scans them
 * through AegisOne's real models (same scanPageText/scanURL pipeline as everywhere
 * else) via the SCAN_WHATSAPP_BATCH message to the background worker.
 *
 * Image hover-scanning on WhatsApp is handled generically by image-guard.js (it no
 * longer excludes web.whatsapp.com) rather than duplicated here.
 *
 * initWhatsappGuard() is only ever called when the "WhatsApp Guard" toggle in the
 * popup is on (main.js checks storedPlugins.enableWhatsappGuard before calling this),
 * so turning that toggle off genuinely stops this from running at all - not just
 * silencing a log line, which is what the previous stub version of this file did.
 */

export function initWhatsappGuard() {
  if (location.hostname !== "web.whatsapp.com") return;
  if (window.__aegis_whatsapp_initialized) return;
  window.__aegis_whatsapp_initialized = true;

  const processedFingerprints = new Set();
  const messageQueue = [];
  let queueTimer = null;

  function safeSendMessage(msg) {
    if (typeof chrome === "undefined" || !chrome.runtime?.id) return Promise.resolve(null);
    try {
      return chrome.runtime.sendMessage(msg).catch(() => null);
    } catch (_) {
      return Promise.resolve(null);
    }
  }

  // Simple string hash for per-message dedup (not security-sensitive - only used to
  // avoid re-scanning the same bubble twice, same as elsewhere in the codebase).
  function simpleHash(str) {
    let hash = 0;
    for (let i = 0; i < str.length; i++) {
      hash = (hash << 5) - hash + str.charCodeAt(i);
      hash |= 0;
    }
    return "wsp_" + Math.abs(hash).toString(36);
  }

  function getActiveChatTitle() {
    const headerEl = document.querySelector("header div[title], header span[title], #main header span[dir]");
    return headerEl ? headerEl.getAttribute("title") || headerEl.innerText || "WhatsApp Chat" : "WhatsApp Chat";
  }

  // WhatsApp Web sometimes wraps outside links as https://l.wl.co/l?u=<real link>; the real destination is what must be scanned.
  function unwrapRedirector(href) {
    try {
      const u = new URL(href);
      if (u.hostname === "l.wl.co" || u.hostname === "l.facebook.com") {
        const real = u.searchParams.get("u");
        if (real && /^https?:\/\//i.test(real)) return real;
      }
    } catch (_) { /* keep as is */ }
    return href;
  }

  function getSender(bubble) {
    // WhatsApp stores "[10:45, 7/11/2026] Name: " on the message's text container.
    const holder = bubble.querySelector("[data-pre-plain-text]") || bubble.closest("[data-pre-plain-text]");
    const m = holder && /\]\s*(.*?):\s*$/.exec(holder.getAttribute("data-pre-plain-text") || "");
    return m ? m[1].slice(0, 80) : "";
  }

  function extractUrlsFromBubble(el, text) {
    const urls = new Set();
    el.querySelectorAll("a[href]").forEach(a => {
      const href = unwrapRedirector(a.getAttribute("href") || "");
      if (href && (href.startsWith("http://") || href.startsWith("https://")) && !href.includes("web.whatsapp.com")) {
        urls.add(href);
      }
    });
    if (text) {
      const urlRegex = /https?:\/\/[^\s<>"]+|www\.[^\s<>"]+/gi;
      (text.match(urlRegex) || []).forEach(m => {
        let u = m.replace(/[.,;!?)]+$/, "");
        if (!u.startsWith("http")) u = "http://" + u;
        urls.add(u);
      });
    }
    return Array.from(urls).slice(0, 6);
  }

  function injectBadge(bubbleEl, verdict, riskScore, reason) {
    if (!bubbleEl || verdict === "offline" || verdict === "scan_incomplete" || riskScore === -1 || bubbleEl.querySelector(".aegis-wsp-badge")) return;

    const isPhish = verdict === "phishing" || riskScore >= 76;
    const isWarn = !isPhish && (verdict === "suspicious" || riskScore >= 51);
    if (isPhish) bubbleEl.dataset.aegisDanger = "1";

    const badge = document.createElement("div");
    badge.className = "aegis-wsp-badge";
    badge.setAttribute("role", "status");
    if (reason) badge.title = String(reason).slice(0, 200);
    badge.style.cssText = `
      display: inline-flex; align-items: center; gap: 5px; margin-top: 4px;
      padding: 3px 8px; border-radius: 6px; font-size: 11px; font-weight: 700;
      font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif;
      z-index: 10;
      ${isPhish ? "background: rgba(239,68,68,0.15); border: 1px solid rgba(239,68,68,0.4); color: #ef4444;"
        : isWarn ? "background: rgba(245,158,11,0.15); border: 1px solid rgba(245,158,11,0.4); color: #f59e0b;"
        : "background: rgba(16,185,129,0.15); border: 1px solid rgba(16,185,129,0.4); color: #10b981;"}
    `;
    const icon = isPhish ? "🚨" : isWarn ? "⚠️" : "🛡️";
    const label = isPhish ? `AegisOne Threat (${riskScore}%)` : isWarn ? `AegisOne Warning (${riskScore}%)` : "Checked: no threat found";
    badge.textContent = `${icon} ${label}`;          // text only: never build markup from page or server strings

    const textContainer = bubbleEl.querySelector(".selectable-text, .copyable-text") || bubbleEl;
    textContainer.appendChild(badge);
  }

  // A link inside a message that was judged dangerous is not opened without an explicit, informed choice.
  document.addEventListener("click", (ev) => {
    const a = ev.target instanceof Element ? ev.target.closest("a[href]") : null;
    if (!a || !a.closest("[data-aegis-danger='1']")) return;
    const href = unwrapRedirector(a.getAttribute("href") || "");
    ev.preventDefault();
    ev.stopImmediatePropagation();
    const go = window.confirm(`AegisOne blocked this link: it was flagged as dangerous.

${href.slice(0, 160)}

Open it anyway? (not recommended)`);
    if (go) window.open(href, "_blank", "noopener,noreferrer");
  }, true);

  function scanIncomingMessages() {
    const bubbles = document.querySelectorAll("div.message-in, div[data-id*='false'], div.copyable-text:not(.message-out)");

    bubbles.forEach(bubble => {
      if (bubble.dataset.aegisProcessed) return;

      const textEl = bubble.querySelector("span.selectable-text, div.selectable-text, span._ao3e");
      const rawText = textEl ? textEl.innerText.trim() : bubble.innerText.trim();
      if (!rawText || rawText.length < 2) return;

      const chatTitle = getActiveChatTitle();
      const urls = extractUrlsFromBubble(bubble, rawText);
      const fp = simpleHash(chatTitle + ":" + rawText);

      if (processedFingerprints.has(fp)) return;
      processedFingerprints.add(fp);
      bubble.dataset.aegisProcessed = "true";

      messageQueue.push({ text: rawText, urls, sender: getSender(bubble), chat_title: chatTitle, fingerprint: fp, bubbleEl: bubble });
    });

    if (messageQueue.length > 0 && !queueTimer) {
      queueTimer = setTimeout(flushBatchQueue, 1200);
    }
  }

  async function flushBatchQueue() {
    queueTimer = null;
    if (messageQueue.length === 0) return;

    const health = await safeSendMessage({ type: "CHECK_HEALTH" });
    if (!health || health.online === false) {
      messageQueue.length = 0;
      return;
    }

    const currentBatch = messageQueue.splice(0, 15);
    const payloadMessages = currentBatch.map(item => ({
      text: item.text, urls: item.urls, sender: item.sender, chat_title: item.chat_title, fingerprint: item.fingerprint,
    }));

    const res = await safeSendMessage({ type: "SCAN_WHATSAPP_BATCH", payload: { messages: payloadMessages } });
    if (res?.ok && res.results) {
      res.results.forEach(r => {
        const matched = currentBatch.find(b => b.fingerprint === r.fingerprint);
        if (matched?.bubbleEl) injectBadge(matched.bubbleEl, r.verdict, r.risk_score, r.reason);
      });
    }
  }

  let scanTimer = null;
  const observer = new MutationObserver(() => { clearTimeout(scanTimer); scanTimer = setTimeout(scanIncomingMessages, 400); });

  function startObserver() {
    if (!document.body) { setTimeout(startObserver, 1000); return; }
    observer.observe(document.body, { childList: true, subtree: true });
    scanIncomingMessages();
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", startObserver);
  } else {
    startObserver();
  }

  console.log("[AegisOne:WhatsAppGuard] Active — scanning incoming messages.");
}
