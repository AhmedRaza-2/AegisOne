/**
 * AegisOne — Service Worker v2.0
 * ================================
 * Central message router and event orchestrator.
 *
 * Key design decisions:
 * - Never calls APIs directly — delegates to scanner.js
 * - Cache-first for all domain lookups
 * - XAI only on explicit user request
 * - Events stored only for high-risk situations
 * - Dashboard sync batched every 30s
 */

import { MSG, STORE_KEYS, VERDICT, THRESHOLD, EVENT_TYPES } from "../utils/constants.js";
import { isInternalURL, isTrusted, getRootDomain } from "../utils/trusted-domains.js";
import { scanURL, scanPageText, scanImage, scanURLBatch, scanEmail, checkHealth } from "./scanner.js";
import { getCachedResult, getTabCache, setTabCache, clearTabCache } from "./cache.js";
import { initDownloadGuard, handleDownloadDecision } from "./download-guard.js";
import { explainWithAI, generateLocalExplanation } from "./xai.js";
import { getEvents, storeEvent } from "./event-store.js";
import { startSync, flushNow, fetchOrgPolicy, ensureDeviceId } from "./sync.js";

// ── Global State ──────────────────────────────────────────
let SHIELD_ENABLED = true;
const _sessionAllowedUrls = new Set();

// ── Startup ───────────────────────────────────────────────
chrome.storage.local.get(STORE_KEYS.SHIELD_ENABLED, (d) => {
  SHIELD_ENABLED = d[STORE_KEYS.SHIELD_ENABLED] !== false;
});

chrome.runtime.onInstalled.addListener(async () => {
  await ensureDeviceId();
  await fetchOrgPolicy();
  startSync();
  // Setup right-click context menu
  _setupContextMenu();
});

chrome.runtime.onStartup.addListener(async () => {
  await fetchOrgPolicy();
  startSync();
});

// ── Download Interception ─────────────────────────────────
initDownloadGuard();

// ── Tab Navigation Scan ───────────────────────────────────
chrome.tabs.onUpdated.addListener(async (tabId, changeInfo, tab) => {
  if (changeInfo.status !== "complete" || !tab.url) return;
  if (!SHIELD_ENABLED) return;
  if (isInternalURL(tab.url)) return;
  if (_sessionAllowedUrls.has(tab.url)) {
    _updateBadge(tabId, 0);
    return;
  }

  // Check tab cache — avoid re-scanning same URL
  const cached = getTabCache(tabId);
  if (cached?.url === tab.url) {
    _updateBadge(tabId, cached.score);
    return;
  }

  // Set scanning badge
  _setBadge(tabId, "scanning");

  // Fast scan (URL model + cache check)
  const result = await scanURL(tab.url);

  if (result) {
    setTabCache(tabId, { url: tab.url, ...result });
    _updateBadge(tabId, result.score);

    if (result.score >= THRESHOLD.WARNING * 100) {
      // Send warning to content script
      chrome.tabs.sendMessage(tabId, {
        type: MSG.SHOW_WARNING,
        score: result.score,
        verdict: result.verdict,
        threat_type: result.threat_type,
        top_factors: result.top_factors,
      }).catch(() => {});

      if (result.score >= THRESHOLD.DANGER * 100) {
        chrome.notifications.create({
          type: "basic",
          iconUrl: "icons/icon48.png",
          title: "🚨 AegisOne: Phishing URL Detected!",
          message: `${tab.url.slice(0, 60)}\nRisk: ${result.score}% — ${result.threat_type || "phishing"}`,
          priority: 2,
        });
      }
    }

    // Trigger deep page content scan for any site (text + links)
    // The content script will handle highlighting and dialog on high scores
    chrome.tabs.sendMessage(tabId, {
      type: "TRIGGER_DEEP_PAGE_SCAN",
      urlScore: result.score,
    }).catch(() => {});
  } else {
    _setBadge(tabId, "unknown");
  }
});

// Clear tab cache when tab closes
chrome.tabs.onRemoved.addListener((tabId) => clearTabCache(tabId));

// ── Context Menu ──────────────────────────────────────────
function _setupContextMenu() {
  chrome.contextMenus.removeAll(() => {
    chrome.contextMenus.create({
      id: "aegis-scan-link",
      title: "🛡️ AegisOne: Scan This Link",
      contexts: ["link"],
    });
    chrome.contextMenus.create({
      id: "aegis-scan-page",
      title: "🛡️ AegisOne: Scan This Page",
      contexts: ["page"],
    });
    chrome.contextMenus.create({
      id: "aegis-scan-image",
      title: "🛡️ AegisOne: Scan This Image",
      contexts: ["image"],
    });
    chrome.contextMenus.create({
      id: "aegis-scan-text",
      title: "🛡️ AegisOne: Scan This Text",
      contexts: ["selection"],
    });
  });
}

chrome.contextMenus.onClicked.addListener(async (info, tab) => {
  const tabId = tab?.id;

  if (info.menuItemId === "aegis-scan-link" && info.linkUrl) {
    const result = await scanURL(info.linkUrl);
    if (tabId) {
      chrome.tabs.sendMessage(tabId, {
        type: MSG.RIGHT_CLICK_SCAN,
        url: info.linkUrl,
        result,
      }).catch(() => {});
    }
  } else if (info.menuItemId === "aegis-scan-page" && tab?.url) {
    if (tabId) {
      chrome.tabs.sendMessage(tabId, { type: "TRIGGER_FULL_SCAN" }).catch(() => {});
    }
  } else if (info.menuItemId === "aegis-scan-image" && info.srcUrl) {
    const result = await scanImage(info.srcUrl);
    if (tabId && result) {
      chrome.tabs.sendMessage(tabId, {
        type: "IMAGE_SCAN_RESULT",
        url: info.srcUrl,
        result,
      }).catch(() => {});
    }
  } else if (info.menuItemId === "aegis-scan-text" && info.selectionText) {
    // Scan selected text through the NLP text model
    const textResult = await scanPageText(info.selectionText);
    const score = textResult ? Math.round((textResult.phishing_probability ?? 0) * 100) : 0;
    const verdict = score >= 80 ? "danger" : score >= 50 ? "warning" : score >= 20 ? "low" : "safe";
    const topFactors = (textResult?.top_words || []).slice(0, 3).map(w => ({ label: `Keyword: "${w}"` }));
    if (tabId) {
      chrome.tabs.sendMessage(tabId, {
        type: "TEXT_SCAN_RESULT",
        text: info.selectionText.slice(0, 100),
        result: { score, verdict, top_factors: topFactors, phishing_probability: textResult?.phishing_probability ?? 0 },
      }).catch(() => {});
    }
  }
});

// ── Message Router ────────────────────────────────────────
chrome.runtime.onMessage.addListener((msg, sender, sendResponse) => {
  (async () => {
    try {
      if (!SHIELD_ENABLED && !["GET_SHIELD_STATE", "TOGGLE_SHIELD", "CHECK_HEALTH", "GET_EVENTS"].includes(msg.type)) {
        sendResponse({ ok: false, reason: "shield_disabled" });
        return;
      }

      switch (msg.type) {

        // ── Navigation / Page Scan ────────────────────────
        case MSG.PAGE_FEATURES: {
          // Content script sends DOM-extracted features for current page
          const { url, features } = msg;
          const tabId = sender.tab?.id;

          if (_sessionAllowedUrls.has(url)) {
            const safeRes = { score: 0, verdict: VERDICT.SAFE, top_factors: [], threat_type: "none" };
            if (tabId) _updateBadge(tabId, 0);
            sendResponse({ ok: true, result: safeRes });
            break;
          }

          const result = await scanURL(url, features);
          if (tabId) {
            const current = getTabCache(tabId) || {};
            setTabCache(tabId, {
              ...current,
              url,
              ...result,
              text_snippet: features.text_snippet,
              form_count: features.form_count,
              redirect_chain: features.redirect_chain,
              hidden_iframes: features.hidden_iframes,
              external_scripts: features.external_scripts,
              page_title: features.page_title,
            });
            _updateBadge(tabId, result.score);

            // Push updated result to content script
            chrome.tabs.sendMessage(tabId, {
              type: MSG.SCAN_RESULT,
              score: result.score,
              verdict: result.verdict,
              top_factors: result.top_factors,
              threat_type: result.threat_type,
            }).catch(() => {});
          }

          sendResponse({ ok: true, result });
          break;
        }

        case "ALLOW_URL_SESSION": {
          _sessionAllowedUrls.add(msg.url);
          sendResponse({ ok: true });
          break;
        }

        // ── Hover URL Scan ────────────────────────────────
        case MSG.SCAN_HOVER_URL: {
          const result = await scanURL(msg.url);
          sendResponse({ ok: true, result });
          break;
        }

        // ── Search Result Batch Scan ──────────────────────
        case MSG.SEARCH_SCAN: {
          const results = await scanURLBatch(msg.urls || [], 5);
          sendResponse({ ok: true, results });
          break;
        }

        // ── Deep Page Scan (text + links — no images) ─────
        case "DEEP_PAGE_SCAN": {
          const { pageText, allLinks = [] } = msg;
          const tabId = sender.tab?.id;

          const [textRes, urlsRes] = await Promise.allSettled([
            pageText ? scanPageText(pageText) : Promise.resolve(null),
            scanURLBatch(allLinks.slice(0, 30), 5),
          ]);

          const textResult = textRes.status === "fulfilled" ? textRes.value : null;
          const urlResults = urlsRes.status === "fulfilled" ? urlsRes.value : [];

          const badUrls = urlResults.filter(u => (u.score || 0) >= THRESHOLD.HIGHLIGHT * 100);
          const worstUrl = badUrls.length > 0 ? Math.max(...badUrls.map(u => u.score || 0)) : 0;
          const textProb = Math.round((textResult?.phishing_probability ?? 0) * 100);
          const composite = Math.max(worstUrl, textProb);

          // Tell content script to highlight suspicious links and show dialog if needed
          if (tabId) {
            if (badUrls.length > 0) {
              chrome.tabs.sendMessage(tabId, {
                type: MSG.HIGHLIGHT_THREATS,
                maliciousUrls: badUrls.map(u => u.url),
              }).catch(() => {});
            }

            // Send composite result back for widget + dialog decisions
            chrome.tabs.sendMessage(tabId, {
              type: "DEEP_PAGE_RESULT",
              composite,
              textProb,
              textSignals: textResult?.top_words || [],
              badUrls: badUrls.map(u => ({ url: u.url, score: u.score, threat_type: u.threat_type })),
              urlCount: allLinks.length,
            }).catch(() => {});
          }

          sendResponse({ ok: true, composite });
          break;
        }

        // ── Full Page Scan (manual button) ───────────────
        case MSG.FULL_PAGE_SCAN: {
          const { pageUrl, pageText, allLinks = [], allImageSrcs = [], attachLinks = [] } = msg;
          const tabId = sender.tab?.id;

          const [textRes, urlsRes] = await Promise.allSettled([
            pageText ? scanPageText(pageText) : Promise.resolve(null),
            scanURLBatch(allLinks.slice(0, 30), 5),
          ]);

          const textResult = textRes.status === "fulfilled" ? textRes.value : null;
          const urlResults = urlsRes.status === "fulfilled" ? urlsRes.value : [];

          const worstUrl = urlResults.reduce((max, u) =>
            Math.max(max, u.phishing_probability || u.score / 100 || 0), 0);
          const textProb = textResult?.phishing_probability ?? 0;
          const composite = Math.max(worstUrl, textProb);

          const report = {
            composite_risk: composite,
            text_result: textResult,
            url_results: urlResults,
            scanned_at: new Date().toISOString(),
          };

          // Update tab cache with full scan data
          if (tabId) {
            const current = getTabCache(tabId) || {};
            setTabCache(tabId, { ...current, fullReport: report });
          }

          sendResponse({ ok: true, report });
          break;
        }

        // ── Email Scan ────────────────────────────────────
        case "EMAIL_DATA": {
          const result = await scanEmail(msg.sender, msg.subject, msg.body);
          if (result?.phishing_probability > THRESHOLD.WARNING) {
            if (sender.tab?.id) {
              chrome.tabs.sendMessage(sender.tab.id, {
                type: MSG.HIGHLIGHT_THREATS,
                emailPhishing: true,
                emailRisk: result.phishing_probability,
                emailSignals: result.top_words || [],
              }).catch(() => {});
            }
          }
          sendResponse({ ok: true, result });
          break;
        }

        // ── XAI Request ───────────────────────────────────
        case MSG.XAI_REQUEST: {
          const tabId = sender.tab?.id;
          const tabData = getTabCache(tabId);
          const url = msg.url || tabData?.url;

          // Try LLM-based XAI first
          let xaiResult = await explainWithAI(tabData, url);

          // Fall back to local explanation if LLM unavailable
          if (xaiResult?.error || !xaiResult?.summary) {
            const local = generateLocalExplanation(tabData);
            if (local) xaiResult = local;
          }

          sendResponse({ ok: true, xai: xaiResult });
          break;
        }

        // ── Download Decision ─────────────────────────────
        case MSG.DOWNLOAD_DECISION: {
          handleDownloadDecision(msg.downloadId, msg.action);
          sendResponse({ ok: true });
          break;
        }

        // ── Clipboard Scan ────────────────────────────────
        case "SCAN_CLIPBOARD_URL": {
          const result = await scanURL(msg.url);
          if (result && result.score >= 50) {
            chrome.notifications.create({
              type: "basic",
              iconUrl: chrome.runtime.getURL("icons/icon128.png"),
              title: "🚨 AegisOne Clipboard Warning",
              message: `The copied link (${getRootDomain(msg.url)}) is flagged as ${result.verdict.toUpperCase()} (${result.score}% risk).`,
              priority: 2
            });
            sendResponse({ ok: true, unsafe: true, result });
          } else {
            sendResponse({ ok: true, unsafe: false });
          }
          break;
        }

        // ── Credential Form Intercept ─────────────────────
        case MSG.FORM_INTERCEPT: {
          const tabData = getTabCache(sender.tab?.id);
          const isRisky = (tabData?.score || 0) >= THRESHOLD.WARNING * 100;

          await storeEvent({
            type: EVENT_TYPES.CREDENTIAL_WARN,
            url: msg.url,
            domain: getRootDomain(msg.url || ""),
            risk_score: tabData?.score || 0,
            verdict: tabData?.verdict || VERDICT.UNKNOWN,
            action: isRisky ? "warned" : "allowed",
          });

          sendResponse({ ok: true, block: isRisky, score: tabData?.score || 0 });
          break;
        }

        // ── Threat Report ─────────────────────────────────
        case MSG.REPORT_THREAT: {
          await storeEvent({
            type: EVENT_TYPES.THREAT_REPORT,
            url: msg.url,
            domain: getRootDomain(msg.url || ""),
            risk_score: msg.score || 0,
            verdict: VERDICT.DANGER,
            action: "reported",
            user_note: msg.note || null,
          });
          // Flush immediately so dashboard gets it fast
          await flushNow();
          sendResponse({ ok: true });
          break;
        }

        // ── Get Tab Data (popup) ──────────────────────────
        case MSG.GET_TAB_DATA: {
          const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
          const data = getTabCache(tab?.id);
          sendResponse({ data, tabId: tab?.id, url: tab?.url });
          break;
        }

        // ── Get Events (popup) ────────────────────────────
        case MSG.GET_EVENTS: {
          const events = await getEvents({ limit: msg.limit || 20, type: msg.eventType });
          sendResponse({ ok: true, events });
          break;
        }

        // ── Shield Controls ───────────────────────────────
        case MSG.TOGGLE_SHIELD: {
          SHIELD_ENABLED = !SHIELD_ENABLED;
          chrome.storage.local.set({ [STORE_KEYS.SHIELD_ENABLED]: SHIELD_ENABLED });
          sendResponse({ enabled: SHIELD_ENABLED });
          break;
        }

        case MSG.GET_SHIELD_STATE: {
          sendResponse({ enabled: SHIELD_ENABLED });
          break;
        }

        // ── Health Check ──────────────────────────────────
        case MSG.CHECK_HEALTH: {
          const health = await checkHealth();
          sendResponse(health);
          break;
        }

        default:
          sendResponse({ ok: false, reason: "unknown_message_type" });
      }
    } catch (err) {
      console.error("[AegisOne:SW] Message handler error:", err);
      sendResponse({ ok: false, error: err.message });
    }
  })();
  return true; // Keep channel open for async
});

// ── Badge Helpers ─────────────────────────────────────────
function _updateBadge(tabId, score) {
  if (score == null) return _setBadge(tabId, "unknown");
  if (score >= THRESHOLD.DANGER * 100) return _setBadge(tabId, "danger", score);
  if (score >= THRESHOLD.WARNING * 100) return _setBadge(tabId, "warning", score);
  _setBadge(tabId, "safe", score);
}

function _setBadge(tabId, state, score = null) {
  const configs = {
    safe:     { text: "✓",   color: "#10b981" },
    warning:  { text: "⚠",   color: "#f59e0b" },
    danger:   { text: "⚠",   color: "#ef4444" },
    scanning: { text: "...", color: "#6366f1" },
    unknown:  { text: "?",   color: "#64748b" },
  };
  const cfg = configs[state] || configs.unknown;
  try {
    chrome.action.setBadgeText({ tabId, text: cfg.text });
    chrome.action.setBadgeBackgroundColor({ tabId, color: cfg.color });
  } catch (_) {}
}
