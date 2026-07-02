/**
 * AegisOne — Download Guard
 * ==========================
 * Intercepts all downloads, cancels immediately,
 * scans, then re-downloads only if safe or user approves.
 */

import { VERDICT, EVENT_TYPES } from "../utils/constants.js";
import { isInternalURL } from "../utils/trusted-domains.js";
import { scanDownload } from "./scanner.js";

// Tracks pending downloads awaiting user decision
const _pending = new Map(); // downloadId → { url, filename, scanResult }

/**
 * Initialize download interception listener.
 * Call once from service worker.
 */
export function initDownloadGuard() {
  chrome.downloads.onCreated.addListener(_onDownloadCreated);
}

async function _onDownloadCreated(item) {
  try {
    const url = item.finalUrl || item.url || "";
    if (!url.startsWith("http") && !url.startsWith("file")) return;
    if (isInternalURL(url)) return;

    const filename = item.filename || url.split("/").pop() || "unknown_file";
    console.log(`[AegisOne:DownloadGuard] Intercepting: ${filename}`);

    // ── Step 1: Cancel immediately ────────────────────────
    _cancelDownload(item.id);

    // ── Step 2: Scan ──────────────────────────────────────
    const scanResult = await scanDownload(url, filename);
    _pending.set(item.id, { url, filename, scanResult });

    // ── Step 3: Decision ──────────────────────────────────
    if (scanResult.verdict === VERDICT.DANGER) {
      // Prompt user in active tab
      await _promptUser(item.id, filename, scanResult);
    } else if (scanResult.verdict === VERDICT.WARNING) {
      // Also prompt for warnings
      await _promptUser(item.id, filename, scanResult);
    } else {
      // Safe — re-download transparently
      _reDownload(item.id, url);
      console.log(`[AegisOne:DownloadGuard] ✅ Safe file — re-downloading: ${filename}`);
    }
  } catch (err) {
    console.error("[AegisOne:DownloadGuard] Error:", err);
    // Fail-safe: re-download on error to not block user
    const url = item.finalUrl || item.url;
    if (url) chrome.downloads.download({ url }, () => chrome.runtime.lastError);
  }
}

/**
 * Handle user's decision (called from message handler in sw.js).
 * @param {number} downloadId
 * @param {"allow"|"block"} action
 */
export function handleDownloadDecision(downloadId, action) {
  const pending = _pending.get(downloadId);
  _pending.delete(downloadId);

  if (action === "allow" && pending?.url) {
    _reDownload(downloadId, pending.url);
    console.log(`[AegisOne:DownloadGuard] User allowed download: ${pending.filename}`);
  } else {
    console.log(`[AegisOne:DownloadGuard] User blocked download: ${pending.filename || downloadId}`);
  }
}

// ── Internal helpers ──────────────────────────────────────
function _cancelDownload(id) {
  try {
    chrome.downloads.cancel(id, () => chrome.runtime.lastError);
    chrome.downloads.erase({ id }, () => chrome.runtime.lastError);
  } catch (_) {}
}

function _reDownload(id, url) {
  chrome.downloads.download({ url }, () => {
    if (chrome.runtime.lastError) {
      console.warn("[AegisOne:DownloadGuard] Re-download failed:", chrome.runtime.lastError.message);
    }
    _pending.delete(id);
  });
}

async function _promptUser(downloadId, filename, scanResult) {
  const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
  if (tab?.id) {
    chrome.tabs.sendMessage(tab.id, {
      type: "PROMPT_DOWNLOAD_DECISION",
      downloadId,
      filename,
      risk_score: scanResult.risk_score,
      verdict: scanResult.verdict,
      url: scanResult.url,
      signals: scanResult.signals || [],
    }).catch(() => {
      // No content script available — auto-block for safety
      _pending.delete(downloadId);
    });

    chrome.notifications.create({
      type: "basic",
      iconUrl: "icons/icon48.png",
      title: "⚠️ AegisOne: Risky File Intercepted",
      message: `Check the browser tab for download decision: ${filename}`,
      priority: 2,
    });
  } else {
    // No active tab — auto-block
    _pending.delete(downloadId);
    chrome.notifications.create({
      type: "basic",
      iconUrl: "icons/icon48.png",
      title: "🚨 AegisOne: Download Blocked",
      message: `Auto-blocked ${filename} (${scanResult.risk_score}% risk, no active tab)`,
      priority: 2,
    });
  }
}
