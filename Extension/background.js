/**
 * AegisOne — Background Service Worker (Always-On Edition)
 * =========================================================
 * Handles:
 *  1. URL scanning on every tab navigation
 *  2. Download interception (cancel if malicious)
 *  3. Message routing from content scripts
 *  4. Badge updates (🟢 / 🔴)
 *  5. Notification alerts
 *  6. Image scanning on click
 *  7. Always-on persistent state
 */

// ── Persist "enabled" state across browser restarts ──
let SHIELD_ENABLED = true;
chrome.storage.local.get("shield_enabled", (d) => {
  SHIELD_ENABLED = d.shield_enabled !== false; // default ON
});

// ──────────────────────────────────────────────
// CONFIG — Change API_BASE to your server URL
// ──────────────────────────────────────────────
const CONFIG = {
  // LOCAL (default): run unified_server.py on your machine
  API_BASE: "http://localhost:9000",
  // NGROK (free cloud): replace with your ngrok URL when running remotely
  // API_BASE: "https://xxxx-xx-xx.ngrok-free.app",

  URL_SCAN_TIMEOUT_MS: 5000,
  PHISHING_THRESHOLD: 0.5,
  SCAN_PAGE_CONTENT: true,
  INTERCEPT_DOWNLOADS: true,
};

// ──────────────────────────────────────────────
// Tab Result Cache (avoid re-scanning same URL)
// ──────────────────────────────────────────────
const tabCache = new Map(); // tabId → { url, verdict, details }

// ──────────────────────────────────────────────
// Helpers
// ──────────────────────────────────────────────
async function callAPI(endpoint, body, isFormData = false) {
  try {
    const opts = {
      method: "POST",
      signal: AbortSignal.timeout(CONFIG.URL_SCAN_TIMEOUT_MS),
    };
    if (isFormData) {
      opts.body = body; // FormData
    } else {
      opts.headers = { "Content-Type": "application/json" };
      opts.body = JSON.stringify(body);
    }
    const res = await fetch(`${CONFIG.API_BASE}${endpoint}`, opts);
    if (!res.ok) return null;
    return await res.json();
  } catch (e) {
    console.warn(`[AegisOne] API call failed (${endpoint}):`, e.message);
    return null;
  }
}

function isInternalURL(url) {
  try {
    const u = new URL(url);
    return (
      u.protocol === "chrome:" ||
      u.protocol === "chrome-extension:" ||
      u.protocol === "about:" ||
      u.hostname === "localhost" ||
      u.hostname === "127.0.0.1" ||
      u.hostname.endsWith(".local")
    );
  } catch {
    return true;
  }
}

function setBadge(tabId, verdict, probability) {
  const isPhishing = verdict === "phishing" || verdict === "malicious" ||
    (probability != null && probability > CONFIG.PHISHING_THRESHOLD);

  chrome.action.setBadgeText({
    tabId,
    text: isPhishing ? "⚠" : "✓",
  });
  chrome.action.setBadgeBackgroundColor({
    tabId,
    color: isPhishing ? "#ef4444" : "#10b981",
  });
}

function sendNotification(title, message) {
  chrome.notifications.create({
    type: "basic",
    iconUrl: "icons/icon48.png",
    title,
    message,
    priority: 2,
  });
}

// ──────────────────────────────────────────────
// 1. URL SCANNING — on every tab navigation
// ──────────────────────────────────────────────
chrome.tabs.onUpdated.addListener(async (tabId, changeInfo, tab) => {
  if (changeInfo.status !== "complete" || !tab.url) return;
  if (isInternalURL(tab.url)) return;

  // Check cache — don't re-scan same URL
  const cached = tabCache.get(tabId);
  if (cached && cached.url === tab.url) return;

  // Set scanning badge
  chrome.action.setBadgeText({ tabId, text: "..." });
  chrome.action.setBadgeBackgroundColor({ tabId, color: "#6366f1" });

  // ── Detect if tab is a directly-opened document ──
  const DOC_EXTS = /\.(pdf|html|htm|txt|docx?|xlsx?|pptx?|zip|rar|csv|xml|json|js|php)(\?.*)?$/i;
  const isFileTab = tab.url.startsWith("file://") || DOC_EXTS.test(tab.url.split("?")[0]);

  if (isFileTab) {
    // Scan as attachment via the content analysis endpoint
    const form = new FormData();
    form.append("url", tab.url);
    const result = await callAPI("/analyze/download_url", form, true);

    if (result) {
      const risk = result.phishing_probability ?? 0;
      const isPhishing = risk > CONFIG.PHISHING_THRESHOLD || result.prediction === "phishing" || result.macros_found;
      tabCache.set(tabId, { url: tab.url, verdict: result, isPhishing, isDocument: true });
      setBadge(tabId, isPhishing ? "phishing" : "benign", risk);

      if (isPhishing) {
        sendNotification(
          "🚨 AegisOne: Malicious Document Detected!",
          `File: ${tab.url.split("/").pop()}\nRisk: ${(risk * 100).toFixed(0)}%\nSignals: ${(result.phishing_signals || []).slice(0, 2).join(", ")}`
        );
      }
      // Tell content script to show document scan result banner
      chrome.tabs.sendMessage(tabId, {
        type: "DOCUMENT_SCAN_RESULT",
        risk,
        isPhishing,
        signals: result.phishing_signals || [],
        fileType: result.file_type || "document",
      }).catch(() => {});
    } else {
      chrome.action.setBadgeText({ tabId, text: "?" });
      chrome.action.setBadgeBackgroundColor({ tabId, color: "#64748b" });
    }
    return; // Skip URL scan for document tabs
  }

  // ── Standard web page URL scan ──
  const form = new FormData();
  form.append("url", tab.url);
  const result = await callAPI("/analyze/url", form, true);

  if (result) {
    const isPhishing = result.phishing_probability > CONFIG.PHISHING_THRESHOLD;
    tabCache.set(tabId, { url: tab.url, verdict: result, isPhishing });
    setBadge(tabId, result.prediction, result.phishing_probability);

    if (isPhishing) {
      sendNotification(
        "🚨 AegisOne: Phishing URL Detected!",
        `${tab.url.slice(0, 60)}...\nCategory: ${result.category || result.prediction}\nRisk: ${(result.phishing_probability * 100).toFixed(0)}%`
      );
    }
    chrome.runtime.sendMessage({ type: "URL_RESULT", tabId, result }).catch(() => {});
  } else {
    chrome.action.setBadgeText({ tabId, text: "?" });
    chrome.action.setBadgeBackgroundColor({ tabId, color: "#64748b" });
  }
});

// Clear cache when tab closes
chrome.tabs.onRemoved.addListener((tabId) => tabCache.delete(tabId));

// ──────────────────────────────────────────────
// 2. DOWNLOAD INTERCEPTION — Pre-Check, Cancel-First
// ──────────────────────────────────────────────
// pendingDownloads tracks {url, filename} for re-download after user approves
const pendingDownloads = new Map(); // downloadId → { url, filename, originalMime }

if (CONFIG.INTERCEPT_DOWNLOADS) {
  chrome.downloads.onCreated.addListener(async (downloadItem) => {
    try {
      const url = downloadItem.finalUrl || downloadItem.url || "";
      if (!url) return;

      // Skip internal / data / extension URLs
      if (!url.startsWith("http") && !url.startsWith("file")) return;
      if (isInternalURL(url)) return;

      const filename = downloadItem.filename || url.split("/").pop() || "unknown_file";
      console.log(`[AegisOne] 📥 Download started — scanning BEFORE saving: ${url}`);

      // ── STEP 1: Immediately cancel the download so nothing lands on disk ──
      try {
        chrome.downloads.cancel(downloadItem.id, () => {
          const err = chrome.runtime.lastError; // absorb error if already done
        });
        chrome.downloads.erase({ id: downloadItem.id }, () => {
          const err = chrome.runtime.lastError;
        });
      } catch (e) { console.warn("[AegisOne] Cancel failed:", e.message); }

      // Store for potential re-download if user approves
      pendingDownloads.set(downloadItem.id, { url, filename });

      // ── STEP 2: Quick URL scan ──
      const urlForm = new FormData();
      urlForm.append("url", url);
      const urlResult = await callAPI("/analyze/url", urlForm, true);
      const quickRisk = urlResult?.phishing_probability ?? 0;

      // ── STEP 3: Full content scan (AI reads file from URL) ──
      const contentForm = new FormData();
      contentForm.append("url", url);
      const contentResult = await callAPI("/analyze/download_url", contentForm, true);

      const finalRisk = Math.max(
        quickRisk,
        contentResult?.phishing_probability ?? 0
      );
      const isPhishing = finalRisk > CONFIG.PHISHING_THRESHOLD ||
        contentResult?.prediction === "phishing" ||
        contentResult?.macros_found ||
        urlResult?.prediction === "malicious" ||
        urlResult?.prediction === "phishing";

      if (isPhishing) {
        const signals = contentResult?.phishing_signals ||
          (quickRisk > CONFIG.PHISHING_THRESHOLD ? ["URL flagged as malicious"] : ["Attachment contents flagged"]);
        // Show modal — user decides whether to re-download or not
        await promptUserForDownload(
          downloadItem.id,
          filename,
          finalRisk,
          url,
          contentResult?.file_type || urlResult?.category || "phishing",
          signals
        );
      } else {
        // ✅ Scan passed — re-initiate the download
        pendingDownloads.delete(downloadItem.id);
        chrome.downloads.download({ url }, () => {
          const err = chrome.runtime.lastError;
          if (err) console.warn("[AegisOne] Re-download failed:", err.message);
          else console.log(`[AegisOne] ✅ Safe file — re-downloading: ${filename}`);
        });
      }
    } catch (err) {
      console.error("[AegisOne] Error in download interceptor:", err);
      // Fail-safe: if scan errors, re-download anyway to not block the user
      chrome.downloads.download({ url: downloadItem.finalUrl || downloadItem.url }, () => {
        const err2 = chrome.runtime.lastError;
      });
    }
  });
}

// Dynamic state-based cancel or deletion utility
function cancelOrDeleteDownload(downloadId) {
  try {
    chrome.downloads.search({ id: downloadId }, (items) => {
      const item = items && items[0];
      if (!item) return;

      if (item.state === "complete") {
        // If completed, delete file from disk and erase history
        try {
          chrome.downloads.removeFile(downloadId, () => {
            const err = chrome.runtime.lastError;
            try {
              chrome.downloads.erase({ id: downloadId }, () => {
                const err2 = chrome.runtime.lastError;
                console.log(`[AegisOne] Deleted completed download from disk and history: ${downloadId}`);
              });
            } catch (e) { }
          });
        } catch (e) { }
      } else {
        // If in progress or paused, cancel and erase
        try {
          chrome.downloads.cancel(downloadId, () => {
            const err = chrome.runtime.lastError;
            try {
              chrome.downloads.erase({ id: downloadId }, () => {
                const err2 = chrome.runtime.lastError;
                console.log(`[AegisOne] Cancelled active download: ${downloadId}`);
              });
            } catch (e) { }
          });
        } catch (e) { }
      }
    });
  } catch (e) {
    console.error("[AegisOne] cancelOrDeleteDownload failed:", e);
  }
}

async function promptUserForDownload(downloadId, filename, risk, url, threatType, signals) {
  const tabs = await chrome.tabs.query({ active: true, currentWindow: true });
  const activeTab = tabs[0];
  if (activeTab?.id) {
    chrome.tabs.sendMessage(activeTab.id, {
      type: "PROMPT_DOWNLOAD_DECISION",
      downloadId,
      filename,
      risk,
      url
    }).catch(() => {
      // Fallback if content script fails, block immediately
      cancelOrDeleteDownload(downloadId);
    });

    sendNotification(
      "⚠️ AegisOne: Risky File Intercepted",
      `Please check the active browser page to confirm download for: ${filename}`
    );
  } else {
    // If no active window is available to prompt, auto-cancel/delete for security
    cancelOrDeleteDownload(downloadId);
    sendNotification(
      "🚨 AegisOne: Malicious Download Blocked!",
      `Auto-blocked ${filename} (no active browser tab available to prompt).`
    );
  }
  _storeBlocked({ url, filename, threat: threatType, risk, signals, time: new Date().toISOString() });
}

async function _storeBlocked(entry) {
  const hist = (await chrome.storage.local.get("blocked_downloads")).blocked_downloads || [];
  hist.unshift(entry);
  chrome.storage.local.set({ blocked_downloads: hist.slice(0, 50) });
}


// ──────────────────────────────────────────────
// 3. MESSAGE HANDLER (from content_script)
// ──────────────────────────────────────────────
chrome.runtime.onMessage.addListener((msg, sender, sendResponse) => {
  (async () => {
    switch (msg.type) {

      // Content script sending page data
      case "PAGE_DATA": {
        const results = {};

        // Scan page text
        if (msg.text && msg.text.trim().length > 20) {
          const form = new FormData();
          form.append("text", msg.text.slice(0, 2000));
          results.text = await callAPI("/analyze/text", form, true);
        }

        // Scan all URLs in parallel batches of 5 — covers every link on the page
        if (msg.urls && msg.urls.length > 0) {
          const urlResults = [];
          const BATCH = 5;
          for (let i = 0; i < msg.urls.length; i += BATCH) {
            const batch = msg.urls.slice(i, i + BATCH).filter(u => !isInternalURL(u));
            const settled = await Promise.allSettled(batch.map(async (url) => {
              const form = new FormData();
              form.append("url", url);
              const r = await callAPI("/analyze/url", form, true);
              return r ? { url, ...r } : null;
            }));
            settled.forEach(s => { if (s.status === "fulfilled" && s.value) urlResults.push(s.value); });
          }
          results.urls = urlResults;
        }

        // Check if any link is phishing
        const maliciousLinks = (results.urls || []).filter(
          (u) => u.phishing_probability > CONFIG.PHISHING_THRESHOLD
        );
        if (maliciousLinks.length > 0) {
          sendNotification(
            `🚨 AegisOne: ${maliciousLinks.length} Malicious Link(s) on Page!`,
            maliciousLinks.map((u) => `• ${u.url.slice(0, 50)}`).join("\n")
          );
          // Tell content script to highlight these malicious links on page
          if (sender.tab?.id) {
            chrome.tabs.sendMessage(sender.tab.id, {
              type: "HIGHLIGHT_THREATS",
              maliciousUrls: maliciousLinks.map(u => u.url),
              textPhishing: false,
            }).catch(() => {});
          }
        }

        // If page text itself is phishing, tell content script to show text warning
        if (results.text?.prediction === "phishing") {
          if (sender.tab?.id) {
            chrome.tabs.sendMessage(sender.tab.id, {
              type: "HIGHLIGHT_THREATS",
              maliciousUrls: [],
              textPhishing: true,
              textRisk: results.text?.phishing_probability ?? 0,
              textSignals: results.text?.top_words || [],
            }).catch(() => {});
          }
        }

        // Store page scan result
        if (sender.tab?.id) {
          const cached = tabCache.get(sender.tab.id) || {};
          cached.pageData = results;
          tabCache.set(sender.tab.id, cached);
        }

        sendResponse({ ok: true, results });
        break;
      }

      // Content script sending email data
      case "EMAIL_DATA": {
        const form = new FormData();
        form.append("sender", msg.sender || "");
        form.append("subject", msg.subject || "");
        form.append("body", msg.body || "");
        const result = await callAPI("/analyze/email", form, true);

        if (result) {
          if (result.phishing_probability > CONFIG.PHISHING_THRESHOLD) {
            sendNotification(
              "🚨 AegisOne: Phishing Email Detected!",
              `Subject: ${msg.subject || "(no subject)"}\nRisk: ${(result.phishing_probability * 100).toFixed(0)}%`
            );
            // Tell content script to show email phishing highlight
            if (sender.tab?.id) {
              chrome.tabs.sendMessage(sender.tab.id, {
                type: "HIGHLIGHT_THREATS",
                maliciousUrls: [],
                textPhishing: false,
                emailPhishing: true,
                emailRisk: result.phishing_probability,
                emailSignals: result.top_words || [],
              }).catch(() => {});
            }
          }
          if (sender.tab?.id) {
            const cached = tabCache.get(sender.tab.id) || {};
            cached.emailResult = result;
            tabCache.set(sender.tab.id, cached);
          }
        }
        sendResponse({ ok: true, result });
        break;
      }

      // ── Single URL scan (for Google Search badges) ──
      case "SCAN_SINGLE_URL": {
        if (!SHIELD_ENABLED) { sendResponse({ ok: false }); break; }
        const form = new FormData();
        form.append("url", msg.url);
        const result = await callAPI("/analyze/url", form, true);
        sendResponse({ ok: !!result, result });
        break;
      }

      // ── Manual scan triggered by user from widget ──
      case "MANUAL_SCAN": {
        const urlForm = new FormData();
        urlForm.append("url", msg.url);
        const urlResult = await callAPI("/analyze/url", urlForm, true);

        let textResult = null;
        if (msg.text && msg.text.trim().length > 20) {
          const textForm = new FormData();
          textForm.append("text", msg.text);
          textResult = await callAPI("/analyze/text", textForm, true);
        }

        // Merge results — take the higher risk score, combine XAI signals
        const urlRisk = urlResult?.phishing_probability ?? 0;
        const textRisk = textResult?.phishing_probability ?? 0;
        const merged = {
          phishing_probability: Math.max(urlRisk, textRisk),
          prediction: urlRisk >= textRisk ? (urlResult?.prediction || "benign") : (textResult?.prediction || "benign"),
          category: urlResult?.category || "url",
          explanation: urlResult?.explanation || textResult?.explanation || "",
          xai_words: urlResult?.xai_words || [],
          top_words: textResult?.top_words || [],
          phishing_signals: [
            ...(urlResult?.phishing_signals || []),
            ...(textResult?.phishing_signals || []),
          ].filter(Boolean),
        };
        sendResponse({ ok: true, result: merged });
        break;
      }

      // ── User confirmation decision for suspicious downloads ──
      case "DOWNLOAD_DECISION": {
        const { downloadId, action } = msg;
        if (action === "resume") {
          // User approved — re-download the file
          const pending = pendingDownloads.get(downloadId);
          if (pending?.url) {
            chrome.downloads.download({ url: pending.url }, () => {
              const err = chrome.runtime.lastError;
              if (err) console.warn("[AegisOne] Re-download after approval failed:", err.message);
              else console.log(`[AegisOne] ✅ User approved re-download of: ${pending.filename}`);
            });
            pendingDownloads.delete(downloadId);
          } else {
            // Fallback: try resume if we still have a download reference
            chrome.downloads.resume(downloadId, () => {
              const err = chrome.runtime.lastError;
            });
          }
          console.log(`[AegisOne] User chose to proceed with download: ${downloadId}`);
        } else {
          // User chose to block — clean up any pending entries, nothing to remove from disk
          // (the download was cancelled before it landed on disk)
          pendingDownloads.delete(downloadId);
          // Also try to cancel/erase if somehow still in downloads list
          chrome.downloads.cancel(downloadId, () => { const e = chrome.runtime.lastError; });
          chrome.downloads.erase({ id: downloadId }, () => { const e = chrome.runtime.lastError; });
          console.log(`[AegisOne] User blocked download: ${downloadId}`);
        }
        sendResponse({ success: true });
        break;
      }

      // ── Image data from content script (on click) ──
      case "IMAGE_DATA": {
        if (!SHIELD_ENABLED) { sendResponse({ ok: false }); break; }
        try {
          // Convert base64 dataUrl to blob
          const res = await fetch(msg.dataUrl);
          const blob = await res.blob();
          const formData = new FormData();
          formData.append("file", blob, "image." + (msg.mimeType?.split("/")[1] || "jpg"));
          const result = await callAPI("/analyze/image", formData, true);
          // Send result back to content script
          if (result && sender.tab?.id) {
            chrome.tabs.sendMessage(sender.tab.id, {
              type: "IMAGE_RESULT",
              src: msg.src,
              result,
            }).catch(() => { });
            if (result.phishing_probability > CONFIG.PHISHING_THRESHOLD) {
              sendNotification(
                "🚨 AegisOne: Phishing Image Detected!",
                `Risk: ${(result.phishing_probability * 100).toFixed(0)}% · ${msg.src.slice(0, 60)}`
              );
            }
          }
          sendResponse({ ok: true, result });
        } catch (e) {
          sendResponse({ ok: false, error: e.message });
        }
        break;
      }

      // ── Image URL fallback (when CORS blocks blob fetch) ──
      case "IMAGE_URL_FALLBACK": {
        // Scan just the image URL through URL model as a fallback
        const form = new FormData();
        form.append("url", msg.src);
        const result = await callAPI("/analyze/url", form, true);
        if (result && sender.tab?.id) {
          chrome.tabs.sendMessage(sender.tab.id, {
            type: "IMAGE_RESULT",
            src: msg.src,
            result,
          }).catch(() => { });
        }
        sendResponse({ ok: true, result });
        break;
      }

      // ── Toggle shield on/off ──
      case "TOGGLE_SHIELD": {
        SHIELD_ENABLED = !SHIELD_ENABLED;
        chrome.storage.local.set({ shield_enabled: SHIELD_ENABLED });
        sendResponse({ enabled: SHIELD_ENABLED });
        break;
      }

      case "GET_SHIELD_STATE": {
        sendResponse({ enabled: SHIELD_ENABLED });
        break;
      }

      // Popup asking for current tab's data
      case "GET_TAB_DATA": {
        const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
        const data = tabCache.get(tab?.id) || null;
        sendResponse({ data, tabId: tab?.id, url: tab?.url });
        break;
      }

      // Popup asking for server health
      case "CHECK_HEALTH": {
        try {
          const res = await fetch(`${CONFIG.API_BASE}/health`, {
            signal: AbortSignal.timeout(3000),
          });
          const data = await res.json();
          sendResponse({ online: true, data });
        } catch {
          sendResponse({ online: false });
        }
        break;
      }

      // Popup asking for blocked downloads history
      case "GET_BLOCKED": {
        const { blocked_downloads } = await chrome.storage.local.get("blocked_downloads");
        sendResponse({ blocked: blocked_downloads || [] });
        break;
      }
    }
  })();
  return true; // Keep channel open for async response
});
