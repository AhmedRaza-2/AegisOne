/**
 * AegisOne - Download Guard
 * ==========================
 * Intercepts all downloads, cancels immediately,
 * scans, then re-downloads only if safe or user approves.
 */

import { VERDICT } from "../utils/constants.js";
import { isInternalURL } from "../utils/trusted-domains.js";
import { scanDownload } from "./scanner.js";

// Tracks pending downloads awaiting user decision
const _pending = new Map(); // downloadId -> { url, filename, scanResult }
const _bypassOnce = new Map(); // url -> expiresAt

export function initDownloadGuard() {
  chrome.downloads.onCreated.addListener(_onDownloadCreated);
}

async function _onDownloadCreated(item) {
  try {
    const url = item.finalUrl || item.url || "";
    if (!url.startsWith("http") && !url.startsWith("file")) return;
    if (isInternalURL(url)) return;

    if (_consumeBypass(url)) {
      console.log(`[AegisOne:DownloadGuard] Bypassing re-scan for approved download: ${item.filename || url}`);
      return;
    }

    const filename = item.filename || url.split("/").pop() || "unknown_file";
    console.log(`[AegisOne:DownloadGuard] Intercepting: ${filename}`);

    // Cancel first so the file never fully lands before inspection.
    _cancelDownload(item.id);

    // Deep attachment/content scan for every download.
    _pending.set(item.id, { url, filename, scanResult: null });
    const scanResult = await scanDownload(url, filename);
    _pending.set(item.id, { url, filename, scanResult });

    if (scanResult.verdict === VERDICT.DANGER || scanResult.verdict === VERDICT.WARNING) {
      await _promptUser(item.id, filename, scanResult);
    } else {
      _allowOnce(url);
      _reDownload(item.id, url);
      console.log(`[AegisOne:DownloadGuard] Safe file re-downloading: ${filename}`);
    }
  } catch (err) {
    console.error("[AegisOne:DownloadGuard] Error:", err);
    const url = item.finalUrl || item.url;
    if (url) {
      _allowOnce(url);
      chrome.downloads.download({ url }, () => chrome.runtime.lastError);
    }
  }
}

export function handleDownloadDecision(downloadId, action) {
  const pending = _pending.get(downloadId);
  _pending.delete(downloadId);

  if (action === "allow" && pending?.url) {
    _allowOnce(pending.url);
    _reDownload(downloadId, pending.url);
    console.log(`[AegisOne:DownloadGuard] User allowed download: ${pending.filename}`);
  } else {
    console.log(`[AegisOne:DownloadGuard] User blocked download: ${pending?.filename || downloadId}`);
  }
}

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

function _allowOnce(url, ttlMs = 45000) {
  _bypassOnce.set(url, Date.now() + ttlMs);
}

function _consumeBypass(url) {
  const expiresAt = _bypassOnce.get(url);
  if (!expiresAt) return false;
  if (Date.now() > expiresAt) {
    _bypassOnce.delete(url);
    return false;
  }
  _bypassOnce.delete(url);
  return true;
}

async function _promptUser(downloadId, filename, scanResult) {
  const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
  const signals = [
    scanResult.vba_analysis ? "Macro / document analysis found suspicious behavior." : null,
    scanResult.file_type ? `Attachment type: ${scanResult.file_type}` : null,
    scanResult.heuristic_risk != null ? `Heuristic risk: ${Math.round(scanResult.heuristic_risk * 100)}%` : null,
    ...(scanResult.signals || []),
  ].filter(Boolean).slice(0, 5);

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
    }).catch(() => {
      _pending.delete(downloadId);
    });

    chrome.notifications.create({
      type: "basic",
      iconUrl: "icons/icon48.png",
      title: "⚠️ AegisOne: Risky File Intercepted",
      message: `${filename} is under deep attachment analysis.`,
      priority: 2,
    });
  } else {
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
