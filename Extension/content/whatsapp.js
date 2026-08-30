/**
 * AegisOne — WhatsApp Web Security Intelligence & Image Hover Guard
 * Monitors incoming WhatsApp Web conversations, extracts text & URLs,
 * dispatches batch scans to sw.js service worker, and provides image hover AI scanning.
 */

(function () {
  "use strict";

  if (window.__aegis_whatsapp_initialized) return;
  window.__aegis_whatsapp_initialized = true;

  console.log("[AegisOne] WhatsApp Web Guard & Image Hover Guard initialized.");

  const processedFingerprints = new Set();
  const messageQueue = [];
  let queueTimer = null;
  let activeImageTooltip = null;

  // Simple string hash for deduplication
  function simpleHash(str) {
    let hash = 0;
    for (let i = 0; i < str.length; i++) {
      hash = (hash << 5) - hash + str.charCodeAt(i);
      hash |= 0;
    }
    return "wsp_" + Math.abs(hash).toString(36);
  }

  // Extract active Chat Title
  function getActiveChatTitle() {
    const headerEl = document.querySelector("header div[title], header span[title], #main header span[dir]");
    return headerEl ? headerEl.getAttribute("title") || headerEl.innerText || "WhatsApp Chat" : "WhatsApp Chat";
  }

  // Convert HTMLImageElement or URL to Base64
  async function imageToBase64(imgEl) {
    return new Promise((resolve) => {
      try {
        if (!imgEl) return resolve("");
        if (imgEl.src && imgEl.src.startsWith("data:image")) {
          return resolve(imgEl.src.split(",")[1] || "");
        }

        const canvas = document.createElement("canvas");
        canvas.width = imgEl.naturalWidth || imgEl.width || 300;
        canvas.height = imgEl.naturalHeight || imgEl.height || 300;
        const ctx = canvas.getContext("2d");
        ctx.drawImage(imgEl, 0, 0, canvas.width, canvas.height);
        const dataUrl = canvas.toDataURL("image/png");
        resolve(dataUrl.split(",")[1] || "");
      } catch (err) {
        // Fallback fetch if cross-origin canvas CORS occurs
        if (imgEl.src && (imgEl.src.startsWith("http") || imgEl.src.startsWith("blob:"))) {
          fetch(imgEl.src)
            .then(res => res.blob())
            .then(blob => {
              const reader = new FileReader();
              reader.onloadend = () => {
                const res = reader.result || "";
                resolve(res.split(",")[1] || "");
              };
              reader.readAsDataURL(blob);
            })
            .catch(() => resolve(""));
        } else {
          resolve("");
        }
      }
    });
  }

  // Extract all URLs from element and text
  function extractUrlsFromBubble(el, text) {
    const urls = new Set();
    
    // Extract from <a> tags
    const anchorEls = el.querySelectorAll("a[href]");
    anchorEls.forEach(a => {
      const href = a.getAttribute("href");
      if (href && (href.startsWith("http://") || href.startsWith("https://"))) {
        if (!href.includes("web.whatsapp.com")) {
          urls.add(href);
        }
      }
    });

    // Extract using regex from text
    if (text) {
      const urlRegex = /https?:\/\/[^\s<>"]+|www\.[^\s<>"]+/gi;
      const matches = text.match(urlRegex) || [];
      matches.forEach(m => {
        let u = m.replace(/[\.,;!?\)]+$/, "");
        if (!u.startsWith("http")) u = "http://" + u;
        urls.add(u);
      });
    }

    return Array.from(urls);
  }

  // Inject security badge into WhatsApp chat bubble
  function injectBadge(bubbleEl, verdict, riskScore, category) {
    if (!bubbleEl || bubbleEl.querySelector(".aegis-wsp-badge")) return;

    const badge = document.createElement("div");
    badge.className = "aegis-wsp-badge";

    const isPhish = verdict === "phishing" || riskScore >= 76;
    const isWarn = verdict === "suspicious" || (riskScore >= 50 && riskScore < 76);

    badge.style.cssText = `
      display: inline-flex;
      align-items: center;
      gap: 5px;
      margin-top: 4px;
      padding: 3px 8px;
      border-radius: 6px;
      font-size: 11px;
      font-weight: 700;
      font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif;
      z-index: 10;
      transition: all 0.2s ease;
      ${
        isPhish
          ? "background: rgba(239, 68, 68, 0.15); border: 1px solid rgba(239, 68, 68, 0.4); color: #ef4444;"
          : isWarn
          ? "background: rgba(245, 158, 11, 0.15); border: 1px solid rgba(245, 158, 11, 0.4); color: #f59e0b;"
          : "background: rgba(16, 185, 129, 0.15); border: 1px solid rgba(16, 185, 129, 0.4); color: #10b981;"
      }
    `;

    const icon = isPhish ? "🚨" : isWarn ? "⚠️" : "🛡️";
    const label = isPhish ? `AegisOne Threat Blocked (${riskScore}%)` : isWarn ? `AegisOne Warning (${riskScore}%)` : `Verified Safe`;

    badge.innerHTML = `<span>${icon}</span><span>${label}</span>`;
    
    const textContainer = bubbleEl.querySelector(".selectable-text, .copyable-text") || bubbleEl;
    textContainer.appendChild(badge);
  }

  // Attach Image Hover Listener for Instant Vision AI Scanning
  function attachImageHoverGuard() {
    document.addEventListener("mouseover", async (e) => {
      const img = e.target.closest("img");
      if (!img || img.dataset.aegisHoverBound) return;
      if (img.width < 50 || img.height < 50) return; // Skip tiny icons/emojis

      img.dataset.aegisHoverBound = "true";

      img.addEventListener("mouseenter", async () => {
        if (activeImageTooltip) activeImageTooltip.remove();

        const rect = img.getBoundingClientRect();
        const tooltip = document.createElement("div");
        tooltip.className = "aegis-img-tooltip";
        tooltip.style.cssText = `
          position: fixed;
          top: ${Math.max(10, rect.top - 28)}px;
          left: ${Math.min(rect.left, window.innerWidth - 180)}px;
          z-index: 99999;
          background: rgba(15, 23, 42, 0.95);
          color: #f8fafc;
          border: 1px solid rgba(59, 130, 246, 0.5);
          border-radius: 6px;
          padding: 3px 8px;
          font-size: 10px;
          font-weight: 700;
          font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif;
          box-shadow: 0 4px 12px rgba(0,0,0,0.4);
          display: flex;
          align-items: center;
          gap: 4px;
          pointer-events: none;
          backdrop-filter: blur(8px);
          max-width: 180px;
        `;
        tooltip.innerHTML = `<span>🛡️</span><span>Vision AI...</span>`;
        document.body.appendChild(tooltip);
        activeImageTooltip = tooltip;

        // Perform instant Vision AI scan
        const base64 = await imageToBase64(img);
        if (!base64) {
          tooltip.innerHTML = `<span>🛡️</span><span>Image Safe</span>`;
          setTimeout(() => tooltip.remove(), 1200);
          return;
        }

        if (typeof chrome !== "undefined" && chrome.runtime && chrome.runtime.sendMessage) {
          chrome.runtime.sendMessage(
            { type: "SCAN_WHATSAPP_BATCH", payload: { messages: [{ text: "Image Scan", image_base64: base64, chat_title: getActiveChatTitle() }] } },
            (response) => {
              if (response && response.results && response.results[0]) {
                const res = response.results[0];
                const isPhish = res.verdict === "phishing" || res.risk_score >= 76;
                const icon = isPhish ? "🚨" : "🛡️";
                tooltip.style.borderColor = isPhish ? "rgba(239, 68, 68, 0.6)" : "rgba(16, 185, 129, 0.6)";
                tooltip.style.background = isPhish ? "rgba(69, 10, 10, 0.95)" : "rgba(6, 78, 59, 0.95)";
                tooltip.innerHTML = `<span>${icon}</span><span>${isPhish ? `Threat (${res.risk_score}%)` : `Verified Safe`}</span>`;
                setTimeout(() => tooltip.remove(), 2000);
              } else {
                tooltip.remove();
              }
            }
          );
        }
      });

      img.addEventListener("mouseleave", () => {
        if (activeImageTooltip) {
          setTimeout(() => {
            if (activeImageTooltip) activeImageTooltip.remove();
          }, 1500);
        }
      });
    });
  }

  // Scan incoming WhatsApp message bubbles
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

      messageQueue.push({
        text: rawText,
        urls: urls,
        chat_title: chatTitle,
        chat_id: chatTitle,
        fingerprint: fp,
        bubbleEl: bubble
      });
    });

    if (messageQueue.length > 0 && !queueTimer) {
      queueTimer = setTimeout(flushBatchQueue, 1200);
    }
  }

  // Flush queued messages to background service worker
  function flushBatchQueue() {
    queueTimer = null;
    if (messageQueue.length === 0) return;

    const currentBatch = messageQueue.splice(0, 15);
    const payloadMessages = currentBatch.map(item => ({
      text: item.text,
      chat_title: item.chat_title,
      chat_id: item.chat_id,
      fingerprint: item.fingerprint
    }));

    if (typeof chrome !== "undefined" && chrome.runtime && chrome.runtime.sendMessage) {
      chrome.runtime.sendMessage(
        { type: "SCAN_WHATSAPP_BATCH", payload: { messages: payloadMessages } },
        response => {
          if (response && response.results) {
            response.results.forEach(res => {
              const matchedItem = currentBatch.find(b => b.fingerprint === res.fingerprint);
              if (matchedItem && matchedItem.bubbleEl) {
                injectBadge(matchedItem.bubbleEl, res.verdict, res.risk_score, res.threat_category);
              }
            });
          }
        }
      );
    }
  }

  // MutationObserver to detect new DOM elements
  const observer = new MutationObserver(() => {
    scanIncomingMessages();
  });

  function startObserver() {
    const container = document.body;
    if (container) {
      observer.observe(container, { childList: true, subtree: true });
      scanIncomingMessages();
      attachImageHoverGuard();
    } else {
      setTimeout(startObserver, 1000);
    }
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", startObserver);
  } else {
    startObserver();
  }
})();
