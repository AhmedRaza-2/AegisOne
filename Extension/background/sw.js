/**
 * AegisOne — Service Worker v2.1
 * ================================
 * Central message router and event orchestrator.
 *
 * v2.1 improvements:
 *  - Per-tab AbortController registry: stale requests cancelled on navigation
 *  - Request deduplication via requestQueue.js
 *  - Multi-level scan pipeline: deep scan only fires if L3 score ≥ WARNING
 *  - Hover scan uses TTL-aware cache (no more always-bypassCache)
 *  - Backend online state updated from health check responses
 *  - No console.log in production (DEBUG_MODE guard)
 */

import { MSG, STORE_KEYS, VERDICT, THRESHOLD, EVENT_TYPES, DEBUG_MODE } from "../utils/constants.js";
import { isInternalURL, getRootDomain } from "../utils/trusted-domains.js";
import { scanURL, scanPageText, scanImage, scanURLBatch, scanEmail, checkHealth, setBackendOnline, invalidateAuthCache } from "./scanner.js";
import { getCachedResult, getTabCache, setTabCache, clearTabCache, clearAllCache } from "./cache.js";
import { initDownloadGuard, handleDownloadDecision } from "./download-guard.js";
import { explainWithAI, generateLocalExplanation } from "./xai.js";
import { getEvents, storeEvent } from "./event-store.js";
import { startSync, flushNow, fetchOrgPolicy, ensureDeviceId } from "./sync.js";
import { enqueue, cancelKey } from "./requestQueue.js";

// ── Global State ──────────────────────────────────────────
let SHIELD_ENABLED = true;
const _sessionAllowedUrls = new Set();

// Per-tab AbortController registry — cancel stale requests on navigation
const _tabControllers = new Map(); // tabId → AbortController

// ── Startup ───────────────────────────────────────────────
chrome.storage.local.get(STORE_KEYS.SHIELD_ENABLED, (d) => {
  SHIELD_ENABLED = d[STORE_KEYS.SHIELD_ENABLED] !== false;
});

chrome.runtime.onInstalled.addListener(async () => {
  await clearAllCache();
  await ensureDeviceId();
  await fetchOrgPolicy();
  startSync();
  _setupContextMenu();
});

chrome.runtime.onStartup.addListener(async () => {
  await clearAllCache();
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

  // Cancel any previous in-flight scan for this tab
  const prevController = _tabControllers.get(tabId);
  if (prevController) {
    prevController.abort();
    cancelKey(tab.url);
  }
  const controller = new AbortController();
  _tabControllers.set(tabId, controller);
  const signal = controller.signal;

  if (_sessionAllowedUrls.has(tab.url)) {
    _updateBadge(tabId, 0);
    return;
  }

  // Check tab cache — avoid re-scanning same URL on reload
  const cached = getTabCache(tabId);
  if (cached?.url === tab.url) {
    _updateBadge(tabId, cached.score);
    return;
  }

  // Set scanning badge
  _setBadge(tabId, "scanning");

  // ── L3: URL AI scan (deduplicated) ─────────────────────
  const result = await enqueue(tab.url, () => scanURL(tab.url, {}, { signal }));

  if (signal.aborted) return; // Tab navigated again — discard result

  if (result) {
    setTabCache(tabId, { url: tab.url, ...result });
    _updateBadge(tabId, result.score);

    if (result.score >= THRESHOLD.WARNING * 100) {
      chrome.tabs.sendMessage(tabId, {
        type: MSG.SHOW_WARNING,
        score: result.score,
        verdict: result.verdict,
        threat_type: result.threat_type,
        top_factors: result.top_factors,
      }).catch(() => { });

      if (result.score >= THRESHOLD.DANGER * 100) {
        safeNotify({
          title: "🚨 AegisOne: Phishing URL Detected!",
          message: `${tab.url.slice(0, 60)}\nRisk: ${result.score}% — ${result.threat_type || "phishing"}`,
          iconUrl: "icons/icon48.png",
          priority: 2,
        });
      }
    }

    // ── L4: Gate deep scan on risk level ─────────────────
    // Only trigger deep scan if L3 score is at WARNING or above,
    // OR if the page has not been scanned with DOM features yet.
    // This prevents wasting resources on clearly safe pages.
    const shouldDeepScan = result.score >= THRESHOLD.WARNING * 100 || !result.has_dom_features;
    if (shouldDeepScan && result.policy_override !== "allow") {
      chrome.tabs.sendMessage(tabId, {
        type: "TRIGGER_DEEP_PAGE_SCAN",
        urlScore: result.score,
      }).catch(() => { });
    }
  } else {
    _setBadge(tabId, "unknown");
  }
});

// Clear tab cache and abort controller when tab closes
chrome.tabs.onRemoved.addListener((tabId) => {
  clearTabCache(tabId);
  const ctrl = _tabControllers.get(tabId);
  if (ctrl) ctrl.abort();
  _tabControllers.delete(tabId);
});

// ── Context Menu ──────────────────────────────────────────
function _setupContextMenu() {
  chrome.contextMenus.removeAll(() => {
    chrome.contextMenus.create({ id: "aegis-scan-link", title: "🛡️ AegisOne: Scan This Link", contexts: ["link"] });
    chrome.contextMenus.create({ id: "aegis-scan-page", title: "🛡️ AegisOne: Scan This Page", contexts: ["page"] });
    chrome.contextMenus.create({ id: "aegis-scan-image", title: "🛡️ AegisOne: Scan This Image", contexts: ["image"] });
    chrome.contextMenus.create({ id: "aegis-scan-text", title: "🛡️ AegisOne: Scan This Text", contexts: ["selection"] });
  });
}

chrome.contextMenus.onClicked.addListener(async (info, tab) => {
  const tabId = tab?.id;

  if (info.menuItemId === "aegis-scan-link" && info.linkUrl) {
    const result = await scanURL(info.linkUrl);
    if (tabId) {
      chrome.tabs.sendMessage(tabId, { type: MSG.RIGHT_CLICK_SCAN, url: info.linkUrl, result }).catch(() => { });
    }
  } else if (info.menuItemId === "aegis-scan-page" && tab?.url) {
    if (tabId) {
      chrome.tabs.sendMessage(tabId, { type: "TRIGGER_FULL_SCAN" }).catch(() => { });
    }
  } else if (info.menuItemId === "aegis-scan-image" && info.srcUrl) {
    const result = await scanImage(info.srcUrl);
    if (tabId && result) {
      chrome.tabs.sendMessage(tabId, { type: "IMAGE_SCAN_RESULT", url: info.srcUrl, result }).catch(() => { });
    }
  } else if (info.menuItemId === "aegis-scan-text" && info.selectionText) {
    const textResult = await scanPageText(info.selectionText);
    const score = textResult ? Math.round((textResult.phishing_probability ?? 0) * 100) : 0;
    const verdict = score >= 80 ? "danger" : score >= 50 ? "warning" : score >= 20 ? "low" : "safe";
    const topFactors = (textResult?.top_words || []).slice(0, 3).map(w => ({ label: `Keyword: "${w}"` }));
    if (tabId) {
      chrome.tabs.sendMessage(tabId, {
        type: "TEXT_SCAN_RESULT",
        text: info.selectionText.slice(0, 100),
        result: { score, verdict, top_factors: topFactors, phishing_probability: textResult?.phishing_probability ?? 0 },
      }).catch(() => { });
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

      // ── Auth Sync (always handled, regardless of shield state) ──
      if (msg.type === "AUTH_UPDATED") {
        invalidateAuthCache();
        if (msg.email) await chrome.storage.local.set({ user_email: msg.email });
        sendResponse({ ok: true });
        return;
      }
      if (msg.type === "AUTH_CLEARED") {
        invalidateAuthCache();
        await chrome.storage.local.remove(["user_email"]);
        sendResponse({ ok: true });
        return;
      }

      switch (msg.type) {

        // ── Navigation / Page Scan ─────────────────────────
        case MSG.PAGE_FEATURES: {
          const { url, features } = msg;
          const tabId = sender.tab?.id;

          if (_sessionAllowedUrls.has(url)) {
            const safeRes = { score: 0, verdict: VERDICT.SAFE, top_factors: [], threat_type: "none" };
            if (tabId) _updateBadge(tabId, 0);
            sendResponse({ ok: true, result: safeRes });
            break;
          }

          // Get the tab's current abort signal (may have been refreshed)
          const signal = _tabControllers.get(tabId)?.signal;

          const result = await enqueue(url, () => scanURL(url, features, { signal }));
          if (tabId && result) {
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

            chrome.tabs.sendMessage(tabId, {
              type: MSG.SCAN_RESULT,
              score: result.score,
              verdict: result.verdict,
              top_factors: result.top_factors,
              threat_type: result.threat_type,
            }).catch(() => { });
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
          // Use cache if fresh (within HOVER_TTL). Only go to API if cache is missing/stale.
          let result = await getCachedResult(msg.url);
          if (result) {
            sendResponse({ ok: true, result: { ...result, from_cache: true } });
            break;
          }
          // Cache miss — fetch fresh (deduplicated)
          result = await enqueue(`hover:${msg.url}`, () => scanURL(msg.url, {}, { bypassCache: false }));
          sendResponse({ ok: true, result });
          break;
        }

        // ── Hover Image Scan ──────────────────────────────
        case MSG.SCAN_HOVER_IMAGE: {
          const result = await scanImage(msg.src);
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
          const { pageUrl = sender.tab?.url, pageText, allLinks = [] } = msg;
          const tabId = sender.tab?.id;
          const signal = _tabControllers.get(tabId)?.signal;

          const [textRes, urlsRes] = await Promise.allSettled([
            pageText ? scanPageText(pageText, signal) : Promise.resolve(null),
            scanURLBatch(allLinks.slice(0, 30), 5, signal, pageUrl),
          ]);

          const textResult = textRes.status === "fulfilled" ? textRes.value : null;
          const urlResults = urlsRes.status === "fulfilled" ? urlsRes.value : [];

          const badUrls = urlResults.filter(u => (u.score || 0) >= THRESHOLD.HIGHLIGHT * 100);
          const worstUrl = badUrls.length > 0 ? Math.max(...badUrls.map(u => u.score || 0)) : 0;
          const textProb = Math.round((textResult?.phishing_probability ?? 0) * 100);
          // Semantic text alone cannot force a hard block. Cap text-only risk at 45 (SUSPICIOUS) unless corroborated by bad URLs.
          const effectiveTextRisk = worstUrl >= 50 ? textProb : Math.min(textProb, 45);
          const composite = Math.max(worstUrl, effectiveTextRisk);
          const deepReport = {
            composite_risk: composite,
            text_prob: textProb,
            text_result: textResult,
            url_results: urlResults,
            bad_urls: badUrls.map(u => ({ url: u.url, score: u.score, threat_type: u.threat_type })),
            scanned_at: new Date().toISOString(),
          };

          if (tabId) {
            const current = getTabCache(tabId) || {};
            setTabCache(tabId, _mergeDeepScanData({ ...current, deepReport }));

            if (badUrls.length > 0) {
              chrome.tabs.sendMessage(tabId, {
                type: MSG.HIGHLIGHT_THREATS,
                maliciousUrls: badUrls.map(u => u.url),
              }).catch(() => { });
            }

            chrome.tabs.sendMessage(tabId, {
              type: "DEEP_PAGE_RESULT",
              composite,
              textProb,
              textSignals: textResult?.top_words || [],
              badUrls: badUrls.map(u => ({ url: u.url, score: u.score, threat_type: u.threat_type })),
              urlCount: allLinks.length,
            }).catch(() => { });
          }

          sendResponse({ ok: true, composite });
          break;
        }

        // ── Full Page Scan (manual button) ────────────────
        case MSG.FULL_PAGE_SCAN: {
          const { pageUrl, pageText, allLinks = [], allImageSrcs = [], attachLinks = [] } = msg;
          const tabId = sender.tab?.id;
          const signal = _tabControllers.get(tabId)?.signal;

          const [textRes, urlsRes] = await Promise.allSettled([
            pageText ? scanPageText(pageText, signal) : Promise.resolve(null),
            scanURLBatch(allLinks.slice(0, 30), 5, signal, pageUrl),
          ]);

          const textResult = textRes.status === "fulfilled" ? textRes.value : null;
          const urlResults = urlsRes.status === "fulfilled" ? urlsRes.value : [];

          const worstUrl = urlResults.reduce((max, u) => Math.max(max, u.phishing_probability || u.score / 100 || 0), 0);
          const rawTextProb = Math.round((textResult?.phishing_probability ?? 0) * 100);
          const effectiveTextRisk = worstUrl >= 50 ? rawTextProb : Math.min(rawTextProb, 45);
          const composite = Math.max(worstUrl, effectiveTextRisk);

          const report = {
            composite_risk: composite,
            text_result: textResult,
            url_results: urlResults,
            scanned_at: new Date().toISOString(),
          };

          if (tabId) {
            const current = getTabCache(tabId) || {};
            setTabCache(tabId, _mergeDeepScanData({ ...current, fullReport: report }));
          }

          sendResponse({ ok: true, report });
          break;
        }

        // ── Email Scan ────────────────────────────────────
        case "EMAIL_DATA": {
          const result = await scanEmail(msg.sender, msg.subject, msg.body, null, msg.thread_url || msg.url || "");
          if (!result) {
            sendResponse({ ok: false, error: "backend_offline", result: null });
          } else {
            const prob = result.phishing_probability ?? 0;
            const score = Math.round(prob * 100);
            const verdict = score >= 80 ? "danger" : score >= 50 ? "warning" : score >= 20 ? "caution" : "safe";

            if (sender.tab?.id) {
              const current = getTabCache(sender.tab.id) || {};
              setTabCache(sender.tab.id, {
                ...current,
                url: msg.subject ? `Email: "${msg.subject}"` : current.url,
                domain: "gmail.com",
                score,
                verdict,
                threat_type: score >= 50 ? "phishing_email" : undefined,
                page_title: msg.subject ? `Email: ${msg.subject}` : current.page_title,
                scanned_at: new Date().toISOString(),
                top_factors: (result.top_words || []).map(w => ({ key: "keyword", label: `Flagged keyword: ${w}`, score })),
                breakdown: {
                  email_classifier: { score, label: "Neural Email Classifier", available: true }
                }
              });

              chrome.tabs.sendMessage(sender.tab.id, {
                type: "UPDATE_EMAIL_WIDGET",
                score,
                verdict,
                subject: msg.subject,
                sender: msg.sender,
              }).catch(() => { });
            }

            sendResponse({ ok: true, result });
          }
          break;
        }

        case "SYNC_EMAIL_TAB_STATE": {
          if (sender.tab?.id) {
            const score = msg.score ?? 0;
            const verdict = score >= 80 ? "danger" : score >= 50 ? "warning" : score >= 20 ? "caution" : "safe";

            const current = getTabCache(sender.tab.id) || {};
            setTabCache(sender.tab.id, {
              ...current,
              url: msg.subject ? `Email: "${msg.subject}"` : current.url,
              domain: "gmail.com",
              score,
              verdict,
              threat_type: score >= 50 ? "phishing_email" : undefined,
              page_title: msg.subject ? `Email: ${msg.subject}` : current.page_title,
              scanned_at: new Date().toISOString(),
              top_factors: (msg.modelResult?.xai_words || []).map(w => ({ key: "keyword", label: `Flagged keyword: ${w}`, score })),
              breakdown: {
                email_classifier: { score, label: "Neural Email Classifier", available: true }
              }
            });

            chrome.tabs.sendMessage(sender.tab.id, {
              type: "UPDATE_EMAIL_WIDGET",
              score,
              verdict: msg.verdict,
              subject: msg.subject,
              sender: msg.sender,
              top_factors: msg.top_factors,
              emailXai: msg.emailXai,
            }).catch(() => { });
          }
          sendResponse({ ok: true });
          break;
        }

        // ── XAI Request ───────────────────────────────────
        case MSG.XAI_REQUEST: {
          const tabId = sender.tab?.id;
          const tabData = _mergeDeepScanData(getTabCache(tabId));
          const url = msg.url || tabData?.url;

          let xaiResult = await explainWithAI(tabData, url, msg.score);

          if (xaiResult?.error || !xaiResult?.summary) {
            const local = generateLocalExplanation(tabData, msg.score);
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
            safeNotify({
              title: "🚨 AegisOne Clipboard Warning",
              message: `The copied link (${getRootDomain(msg.url)}) is flagged as ${result.verdict.toUpperCase()} (${result.score}% risk).`,
              iconUrl: "icons/icon128.png",
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

        // ── Attachment Risk ───────────────────────────────
        case "ATTACHMENT_RISK": {
          const tabId = sender.tab?.id;
          if (!tabId) { sendResponse({ ok: true }); break; }

          const current = getTabCache(tabId) || {};
          const existingScore = current.score || 0;
          const attachScore = msg.score || 0;
          const mergedScore = Math.max(existingScore, attachScore);

          const attachFactors = (msg.signals || []).map(s => ({
            key: "attachment",
            score: attachScore,
            label: s.label,
          }));

          const mergedFactors = [
            ...attachFactors,
            ...(current.top_factors || []),
          ].slice(0, 5);

          setTabCache(tabId, {
            ...current,
            score: mergedScore,
            threat_type: mergedScore >= 70 ? "malware_delivery" : (current.threat_type || "suspicious_activity"),
            top_factors: mergedFactors,
          });

          _updateBadge(tabId, mergedScore);

          chrome.tabs.sendMessage(tabId, {
            type: MSG.SCAN_RESULT,
            score: mergedScore,
            verdict: mergedScore >= 80 ? "danger" : mergedScore >= 50 ? "warning" : "caution",
            top_factors: mergedFactors,
            threat_type: mergedScore >= 70 ? "malware_delivery" : "suspicious_activity",
          }).catch(() => { });

          sendResponse({ ok: true });
          break;
        }

        // ── Search Results Batch Scan ─────────────────────
        case MSG.SEARCH_SCAN: {
          if (!isBackendOnline()) {
            sendResponse({ ok: false, error: "backend_offline", results: [] });
            break;
          }
          const urls = Array.isArray(msg.urls) ? msg.urls : [];
          const results = await Promise.all(
            urls.map(async (url) => {
              const res = await scanURL(url).catch(() => null);
              if (!res || res.score === -1 || res.verdict === "offline") {
                return { url, score: -1, verdict: "offline", error: "backend_offline" };
              }
              return {
                url,
                score: res.score ?? 0,
                verdict: res.verdict || "safe",
                threat_type: res.threat_type || "safe",
                phishing_probability: (res.score || 0) / 100
              };
            })
          );
          sendResponse({ ok: true, results });
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
          await flushNow();
          sendResponse({ ok: true });
          break;
        }

        // ── False Positive Report ─────────────────────────
        case "REPORT_FALSE_POSITIVE": {
          const domain = getRootDomain(msg.url || "");
          if (domain) {
            const stored = await chrome.storage.local.get([STORE_KEYS.ALLOWLIST]);
            const currentAllowlist = Array.isArray(stored[STORE_KEYS.ALLOWLIST]) ? stored[STORE_KEYS.ALLOWLIST] : [];
            if (!currentAllowlist.includes(domain)) {
              currentAllowlist.push(domain);
              await chrome.storage.local.set({ [STORE_KEYS.ALLOWLIST]: currentAllowlist });
            }
          }

          await storeEvent({
            type: "false_positive_reported",
            url: msg.url,
            domain: domain,
            risk_score: msg.score || 0,
            verdict: VERDICT.SAFE,
            action: "false_positive",
            user_note: msg.note || "User reported False Positive",
          });

          await flushNow();

          try {
            const { user_email } = await chrome.storage.local.get("user_email");
            await fetch(`${API_BASE}/policy/allowlist`, {
              method: "POST",
              headers: {
                "Content-Type": "application/json",
                ...(user_email ? { "X-User-Email": user_email } : {}),
              },
              body: JSON.stringify({ domain }),
              signal: AbortSignal.timeout(5000),
            });
          } catch (_) { }

          sendResponse({ ok: true });
          break;
        }

        // ── Get Tab Data (popup) ──────────────────────────
        case MSG.GET_TAB_DATA: {
          const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
          let rawData = getTabCache(tab?.id);
          if (!rawData && tab?.url) {
            rawData = getCachedResult(tab.url);
          }
          if (!rawData && tab?.url && (tab.url.startsWith("http://") || tab.url.startsWith("https://"))) {
            rawData = {
              url: tab.url,
              score: 0,
              verdict: "safe",
              domain: getRootDomain(tab.url),
              scanned_at: new Date().toISOString(),
              top_factors: []
            };
            if (tab?.id) setTabCache(tab.id, rawData);
          }
          const data = _mergeDeepScanData(rawData);
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
          // checkHealth() already calls setBackendOnline() internally
          sendResponse(health);
          break;
        }

        default:
          sendResponse({ ok: false, reason: "unknown_message_type" });
      }
    } catch (err) {
      if (DEBUG_MODE) console.error("[AegisOne:SW] Message handler error:", err);
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
    safe: { text: "✓", color: "#10b981" },
    warning: { text: "⚠", color: "#f59e0b" },
    danger: { text: "⚠", color: "#ef4444" },
    scanning: { text: "...", color: "#6366f1" },
    unknown: { text: "?", color: "#64748b" },
  };
  const cfg = configs[state] || configs.unknown;
  try {
    chrome.action.setBadgeText({ tabId, text: cfg.text });
    chrome.action.setBadgeBackgroundColor({ tabId, color: cfg.color });
  } catch (_) { }
}

function _mergeDeepScanData(tabData) {
  if (!tabData) return tabData;

  const deep = tabData.deepReport || tabData.fullReport;
  if (!deep) return tabData;

  const deepScore = Math.round((deep.composite_risk ?? 0) || 0);
  const baseScore = tabData.score ?? 0;
  const mergedScore = Math.max(baseScore, deepScore);

  const deepFactors = [
    ...(deep.bad_urls || []).slice(0, 2).map(u => ({
      key: "deep_link",
      score: u.score || deepScore,
      label: `Malicious link: ${u.url.slice(0, 40)}…`,
    })),
    ...(deep.text_result?.top_words || []).slice(0, 2).map(word => ({
      key: "deep_text",
      score: deep.text_prob || deepScore,
      label: `Phishing keyword: "${word}"`,
    })),
  ];

  const mergedTopFactors = deepFactors.length > 0
    ? [...deepFactors, ...(tabData.top_factors || [])].slice(0, 5)
    : tabData.top_factors;

  const mergedBreakdown = deepScore > baseScore
    ? {
      ...(tabData.breakdown || {}),
      deep_page: {
        score: deepScore,
        weight: 0,
        label: deepScore >= 80 ? "Deep page scan indicates high risk" : "Deep page scan indicates suspicious activity",
        available: true,
      },
    }
    : tabData.breakdown;

  return {
    ...tabData,
    score: mergedScore,
    verdict: mergedScore >= THRESHOLD.DANGER * 100 ? VERDICT.DANGER : mergedScore >= THRESHOLD.WARNING * 100 ? VERDICT.WARNING : tabData.verdict,
    threat_type: deepScore >= 80 ? "phishing" : (tabData.threat_type || "suspicious_activity"),
    top_factors: mergedTopFactors,
    breakdown: mergedBreakdown,
    deepReport: deep,
  };
}

export function safeNotify({ title, message, iconUrl = "icons/icon48.png", type = "basic", priority = 2 }) {
  try {
    const fullIconUrl = chrome.runtime.getURL(iconUrl || "icons/icon48.png");
    chrome.notifications.create(
      {
        type: type || "basic",
        iconUrl: fullIconUrl,
        title: title || "AegisOne Security Alert",
        message: message || "",
        priority: priority || 2,
      },
      () => {
        if (chrome.runtime.lastError) {
          try {
            chrome.notifications.create({
              type: "basic",
              iconUrl: chrome.runtime.getURL("icons/icon128.png"),
              title: title || "AegisOne Security Alert",
              message: message || "",
              priority: priority || 2,
            }, () => { if (chrome.runtime.lastError) { } });
          } catch (_) { }
        }
      }
    );
  } catch (_) { }
}
