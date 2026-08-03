/**
 * AegisOne - Download Guard
 * ==========================
 * Intercepts all downloads, cancels immediately,
 * scans, then re-downloads only if safe or user approves.
 */

import { VERDICT } from "../utils/constants.js";
import { isInternalURL } from "../utils/trusted-domains.js";
import { scanDownload } from "./scanner.js";

const _pending = new Map();     // downloadId -> { url, filename, scanResult }
const _bypassOnce = new Map();  // url -> expiresAt

// Persisted record of already-processed downloads (URL|filename -> timestamp).
// Survives service-worker restarts so downloads are never re-scanned
// after a browser restart.
const _processed = new Map();
const PROCESSED_STORAGE_KEY = "processed_downloads";
const PROCESSED_MAX = 500;
const PROCESSED_TTL_MS = 7 * 24 * 60 * 60 * 1000;

export function initDownloadGuard() {
  chrome.storage.local.get(PROCESSED_STORAGE_KEY, (data) => {
    const saved = data[PROCESSED_STORAGE_KEY] || {};
    const now = Date.now();
    for (const [key, ts] of Object.entries(saved)) {
      if (now - ts < PROCESSED_TTL_MS) {
        _processed.set(key, ts);
      }
    }

    // ── BUG FIX: Pre-seed _processed with ALL downloads currently
    // known to Chrome (recent history + in-shelf items).
    //
    // Problem: The Manifest V3 service worker is NOT persistent. Chrome
    // terminates it after ~30s of inactivity and restarts it on demand.
    // On every restart, _processed starts empty. Chrome replays onCreated
    // for downloads still on the download shelf (in-progress or recent),
    // which pass the _isProcessed() check and get re-intercepted.
    //
    // Fix: Query chrome.downloads.search() before registering the listener.
    // This gives us every URL Chrome already knows about, so we mark them
    // all as processed. Legitimate NEW downloads will have IDs not in this
    // pre-existing set, so they will still be intercepted correctly.
    chrome.downloads.search({}, (existingDownloads) => {
      const now2 = Date.now();
      for (const dl of existingDownloads || []) {
        const url = dl.finalUrl || dl.url || "";
        if (url && !_processed.has(url)) {
          _processed.set(url, now2);
        }
      }
      _persistProcessed();

      // Register AFTER both storage AND existing-download pre-seed are done.
      chrome.downloads.onCreated.addListener(_onDownloadCreated);
    });
  });
}

// ── Persisted processed-download helpers ──────────────────────
// Keyed by URL only (not URL+filename) because re-downloads may
// get a different filename suffix from Chrome.
function _isProcessed(url) {
  const ts = _processed.get(url);
  if (!ts) return false;
  if (Date.now() - ts > PROCESSED_TTL_MS) {
    _processed.delete(url);
    _persistProcessed();
    return false;
  }
  return true;
}

function _markProcessed(url) {
  _processed.set(url, Date.now());
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

async function _onDownloadCreated(item) {
  try {
    const url = item.finalUrl || item.url || "";
    if (!url.startsWith("http") && !url.startsWith("file")) return;
    if (isInternalURL(url)) return;

    // Short-term bypass: re-download initiated by this extension
    if (_consumeBypass(url)) {
      return;
    }

    // Long-term persistence: already scanned in a previous session
    const filename = item.filename || url.split("/").pop() || "unknown_file";
    if (_isProcessed(url)) {
      console.log(`[AegisOne:DownloadGuard] Already processed, letting through: ${filename}`);
      return;
    }

    console.log(`[AegisOne:DownloadGuard] Intercepting: ${filename}`);

    _cancelDownload(item.id);

    _pending.set(item.id, { url, filename, scanResult: null });
    const scanResult = await scanDownload(url, filename);
    _pending.set(item.id, { url, filename, scanResult });

    if (scanResult.verdict === VERDICT.DANGER || scanResult.verdict === VERDICT.WARNING) {
      await _promptUser(item.id, filename, scanResult);
    } else {
      _markProcessed(url);
      _allowOnce(url);
      _reDownload(item.id, url);
      console.log(`[AegisOne:DownloadGuard] Safe file re-downloading: ${filename}`);
    }
  } catch (err) {
    console.error("[AegisOne:DownloadGuard] Error:", err);
    const fallbackUrl = item.finalUrl || item.url;
    if (fallbackUrl) {
      _markProcessed(fallbackUrl);
      _allowOnce(fallbackUrl);
      chrome.downloads.download({ url: fallbackUrl }, () => chrome.runtime.lastError);
    }
  }
}

export function handleDownloadDecision(downloadId, action) {
  const pending = _pending.get(downloadId);
  _pending.delete(downloadId);

  if (action === "allow" && pending?.url) {
    _markProcessed(pending.url);
    _allowOnce(pending.url);
    _reDownload(downloadId, pending.url);
    console.log(`[AegisOne:DownloadGuard] User allowed download: ${pending.filename}`);
  } else if (pending?.url) {
    _markProcessed(pending.url);
    console.log(`[AegisOne:DownloadGuard] User blocked download: ${pending.filename}`);
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
    _markProcessed(scanResult.url);
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
