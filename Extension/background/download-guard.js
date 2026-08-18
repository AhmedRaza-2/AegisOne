/**
 * AegisOne - Pre-Download Interceptor v4.0 (onDeterminingFilename)
 * ===================================================================
 * Intercepts all file downloads BEFORE they are written to disk
 * using Chrome's native `onDeterminingFilename` async hold API.
 *
 * Flow:
 * 1. User clicks download link on ANY website.
 * 2. Chrome holds filename determination asynchronously (`return true;`).
 * 3. AegisOne scans the URL/attachment heuristic & AI model risk.
 * 4. If SAFE: calls `suggest()`, file downloads normally.
 * 5. If RISKY: cancels & erases download immediately (0 bytes saved),
 *    and prompts user with "Cancel Download" or "Download Anyway".
 */

import { VERDICT } from "../utils/constants.js";
import { isInternalURL } from "../utils/trusted-domains.js";
import { scanDownload } from "./scanner.js";

const _pending = new Map();     // downloadId -> { url, filename, processKey, scanResult }
const _processed = new Map();   // processKey -> timestamp
const _bypassOnce = new Map();  // url -> expiresAt

const PROCESSED_STORAGE_KEY = "processed_downloads";
const PROCESSED_MAX = 1000;
const PROCESSED_TTL_MS = 14 * 24 * 60 * 60 * 1000;

export function initDownloadGuard() {
  chrome.storage.local.get(PROCESSED_STORAGE_KEY, (data) => {
    const saved = data[PROCESSED_STORAGE_KEY] || {};
    const now = Date.now();
    for (const [key, ts] of Object.entries(saved)) {
      if (now - ts < PROCESSED_TTL_MS) {
        _processed.set(key, ts);
      }
    }

    // Pre-seed completed/existing downloads so Chrome restarts never re-trigger old downloads
    chrome.downloads.search({}, (existingDownloads) => {
      const now2 = Date.now();
      for (const dl of existingDownloads || []) {
        const url = dl.finalUrl || dl.url || "";
        const filename = (dl.filename || "").replace(/^.*[\\\/]/, '');
        const key = `${url}|${filename}`;
        if (key && !_processed.has(key)) {
          _processed.set(key, now2);
        }
      }
      _persistProcessed();

      // Register pre-download filename determination interceptor
      if (chrome.downloads.onDeterminingFilename) {
        chrome.downloads.onDeterminingFilename.addListener(_onDeterminingFilename);
      } else {
        chrome.downloads.onCreated.addListener(_onDownloadCreatedFallback);
      }
    });
  });

  // Handle notification button clicks (Allow / Block)
  try {
    chrome.notifications.onButtonClicked.addListener((notifId, buttonIndex) => {
      if (notifId.startsWith("dl_prompt_")) {
        const downloadId = parseInt(notifId.replace("dl_prompt_", ""), 10);
        if (!isNaN(downloadId)) {
          if (buttonIndex === 0) {
            handleDownloadDecision(downloadId, "allow");
          } else {
            handleDownloadDecision(downloadId, "block");
          }
          chrome.notifications.clear(notifId);
        }
      }
    });
  } catch (_) {}
}

// ── Bypass Helpers ────────────────────────────────────────────
function _allowOnce(url, ttlMs = 45000) {
  if (!url) return;
  _bypassOnce.set(url, Date.now() + ttlMs);
}

function _consumeBypass(url) {
  if (!url) return false;
  const expiresAt = _bypassOnce.get(url);
  if (!expiresAt) return false;
  if (Date.now() > expiresAt) {
    _bypassOnce.delete(url);
    return false;
  }
  _bypassOnce.delete(url);
  return true;
}

// ── Persisted processed-download helpers ──────────────────────
function _isProcessed(key) {
  const ts = _processed.get(key);
  if (!ts) return false;
  if (Date.now() - ts > PROCESSED_TTL_MS) {
    _processed.delete(key);
    _persistProcessed();
    return false;
  }
  return true;
}

function _markProcessed(key) {
  if (!key) return;
  _processed.set(key, Date.now());
  if (_processed.size > PROCESSED_MAX) {
    const first = _processed.entries().next().value;
    if (first) _processed.delete(first[0]);
  }
  _persistProcessed();
}

function _persistProcessed() {
  const obj = {};
  _processed.forEach((ts, key) => { obj[key] = ts; });
  chrome.storage.local.set({ [PROCESSED_STORAGE_KEY]: obj });
}

// ── Async Pre-Download Interceptor ─────────────────────────────
function _onDeterminingFilename(item, suggest) {
  const url = item.finalUrl || item.url || "";
  if (!url.startsWith("http") && !url.startsWith("file") && !url.startsWith("blob:") && !url.startsWith("data:")) {
    suggest();
    return false;
  }
  if (isInternalURL(url)) {
    suggest();
    return false;
  }

  // If user explicitly allowed this download ("Download Anyway"), let Chrome proceed immediately
  if (_consumeBypass(url)) {
    suggest();
    return false;
  }

  const rawName = item.filename || url.split("/").pop() || "unknown_file";
  const filename = rawName.replace(/^.*[\\\/]/, '');
  const processKey = `${url}|${filename}`;

  if (_isProcessed(processKey)) {
    suggest();
    return false;
  }

  // Hold filename determination asynchronously while we run deep AI risk scan
  (async () => {
    try {
      console.log(`[AegisOne:DownloadGuard] Pre-download scanning: ${filename}`);

      _pending.set(item.id, { url, filename, processKey, scanResult: null });
      const scanResult = await scanDownload(url, filename);
      _pending.set(item.id, { url, filename, processKey, scanResult });

      if (scanResult.verdict === VERDICT.DANGER || scanResult.verdict === VERDICT.WARNING) {
        console.warn(`[AegisOne:DownloadGuard] Risky download intercepted (${scanResult.risk_score}%): ${filename}`);
        
        // CANCEL & ERASE the download BEFORE it completes or saves to disk
        _cancelDownload(item.id);
        suggest(); // release Chrome hold after cancellation

        await _promptUser(item.id, filename, scanResult);
      } else {
        // Safe file: Mark processed and let Chrome write file
        _markProcessed(processKey);
        suggest();
        _pending.delete(item.id);
        console.log(`[AegisOne:DownloadGuard] Safe file allowed: ${filename}`);
      }
    } catch (err) {
      console.error("[AegisOne:DownloadGuard] Error during scan:", err);
      _markProcessed(processKey);
      suggest();
    }
  })();

  return true; // Tells Chrome: Hold this download asynchronously!
}

// ── Fallback Handler for Legacy Engines ───────────────────────
async function _onDownloadCreatedFallback(item) {
  const url = item.finalUrl || item.url || "";
  if (!url.startsWith("http") && !url.startsWith("file") && !url.startsWith("blob:") && !url.startsWith("data:")) return;
  if (isInternalURL(url) || _consumeBypass(url)) return;

  const rawName = item.filename || url.split("/").pop() || "unknown_file";
  const filename = rawName.replace(/^.*[\\\/]/, '');
  const processKey = `${url}|${filename}`;

  if (_isProcessed(processKey)) return;

  _cancelDownload(item.id);
  const scanResult = await scanDownload(url, filename);
  if (scanResult.verdict === VERDICT.DANGER || scanResult.verdict === VERDICT.WARNING) {
    await _promptUser(item.id, filename, scanResult);
  } else {
    _markProcessed(processKey);
    _allowOnce(url);
    chrome.downloads.download({ url });
  }
}

// ── Decision Handler (Called from Tab Modal or Notification) ────
export function handleDownloadDecision(downloadId, action) {
  const pending = _pending.get(downloadId);
  _pending.delete(downloadId);

  if (action === "allow" && pending?.url) {
    _markProcessed(pending.processKey || pending.url);
    _allowOnce(pending.url);
    // Re-trigger download with temporary bypass
    chrome.downloads.download({ url: pending.url }, () => {
      if (chrome.runtime.lastError) {
        console.warn("[AegisOne:DownloadGuard] Re-download error:", chrome.runtime.lastError.message);
      }
    });
    console.log(`[AegisOne:DownloadGuard] User allowed download: ${pending.filename}`);
  } else if (pending?.url) {
    _markProcessed(pending.processKey || pending.url);
    _cancelDownload(downloadId);
    console.log(`[AegisOne:DownloadGuard] User cancelled download: ${pending.filename}`);
  }
}

function _cancelDownload(id) {
  try {
    chrome.downloads.cancel(id, () => chrome.runtime.lastError);
    chrome.downloads.erase({ id }, () => chrome.runtime.lastError);
  } catch (_) {}
}

// ── User Prompt Helper ─────────────────────────────────────────
async function _promptUser(downloadId, filename, scanResult) {
  const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
  const rawSignals = [
    ...(scanResult.signals || []),
    scanResult.vba_analysis ? `VBA Macro: ${scanResult.vba_analysis}` : null,
    scanResult.file_type ? `Attachment type: .${scanResult.file_type.toUpperCase()}` : null,
  ].filter(Boolean);

  // Clean and deduplicate generic "Heuristic risk" entries
  const signals = [...new Set(
    rawSignals
      .map(s => String(s).replace(/^Heuristic risk:?\s*\d+%/gi, '').trim())
      .filter(Boolean)
  )].slice(0, 5);

  if (signals.length === 0 && scanResult.heuristic_risk != null) {
    signals.push(`Suspicious structural file pattern detected (${Math.round(scanResult.heuristic_risk * 100)}% risk)`);
  }

  const notifId = `dl_prompt_${downloadId}`;

  // 1. Send in-tab modal message if tab exists
  if (tab?.id) {
    chrome.tabs.sendMessage(tab.id, {
      type: "PROMPT_DOWNLOAD_DECISION",
      downloadId,
      filename,
      risk_score: scanResult.risk_score,
      verdict: scanResult.verdict,
      url: scanResult.url,
      signals,
      file_type: scanResult.file_type,
      heuristic_risk: scanResult.heuristic_risk,
      vba_analysis: scanResult.vba_analysis,
    }).catch(() => {});
  }

  // 2. Always show native interactive notification with Allow/Block buttons
  try {
    const icon = chrome.runtime.getURL("icons/icon48.png");
    chrome.notifications.create(notifId, {
      type: "basic",
      iconUrl: icon,
      title: `🚨 AegisOne: Risky File Intercepted (${scanResult.risk_score}% Risk)`,
      message: `"${filename}" was blocked from saving to disk. Click below to allow or keep blocked.`,
      buttons: [
        { title: "Download Anyway" },
        { title: "🛡️ Keep Blocked" }
      ],
      priority: 2,
    }, () => { if (chrome.runtime.lastError) {} });
  } catch (_) {}
}
