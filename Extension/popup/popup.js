/**
 * AegisOne — Popup v2.2
 * ======================
 * Manages Popup UI, tab switching, plugin toggles, live statistics,
 * server status, and on-demand xAI Copilot explanations.
 */

const THRESHOLD_WARN = 50;
const THRESHOLD_DANGER = 80;
let _ageCountdownTimer = null;
let _currentTabData = null;

async function init() {
  await loadShieldState();
  await loadWidgetState();
  await loadControlToggles();
  await loadPopupStats();
  await loadCurrentPage();
  await loadRecentEvents();
  await checkServer();
  setupXAICopilot();
  setupDashboardButton();
}

function setupDashboardButton() {
  const btn = document.getElementById("btnOpenDashboard");
  if (btn) {
    btn.addEventListener("click", async () => {
      const stored = await chrome.storage.local.get(["dashboard_port", "dashboard_url"]);
      const port = stored.dashboard_port || 3002;
      const targetUrl = stored.dashboard_url || `http://localhost:${port}/login`;
      chrome.tabs.create({ url: targetUrl });
    });
  }
}

// ── Widget Visibility Toggle ───────────────────────────────
async function loadWidgetState() {
  const stored = await chrome.storage.local.get("widgetVisible");
  const visible = stored.widgetVisible !== false;
  const toggle = document.getElementById("widgetToggle");
  if (toggle) {
    toggle.checked = visible;
    toggle.addEventListener("change", async (e) => {
      const isVisible = e.target.checked;
      await chrome.storage.local.set({ widgetVisible: isVisible });
      const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
      if (tab?.id) {
        chrome.tabs.sendMessage(tab.id, { type: "TOGGLE_WIDGET_VISIBILITY", visible: isVisible }).catch(() => {});
      }
    });
  }
}

// ── Shield Toggle ──────────────────────────────────────────
async function loadShieldState() {
  const res = await sendMsg({ type: "GET_SHIELD_STATE" });
  _applyShieldState(res?.enabled !== false);
}

async function toggleShield() {
  const res = await sendMsg({ type: "TOGGLE_SHIELD" });
  _applyShieldState(res?.enabled !== false);
}

function _applyShieldState(enabled) {
  const label = document.getElementById("shieldLabel");
  const toggle = document.getElementById("shieldToggle");
  if (label) label.textContent = enabled ? "ON" : "OFF";
  if (toggle) toggle.checked = enabled;
}

async function loadControlToggles() {
  const stored = await chrome.storage.local.get([
    "enableUrlScan", "enableHoverScan", "enableFormGuard",
    "enableWhatsappGuard", "enableEmailGuard", "enableDownloadGuard",
    "widgetOpacity", "widgetScale"
  ]);

  const bindToggle = (id, key, defaultVal = true) => {
    const el = document.getElementById(id);
    if (el) {
      el.checked = stored[key] !== false;
      el.addEventListener("change", (e) => chrome.storage.local.set({ [key]: e.target.checked }));
    }
  };

  // Bind dropdown controls
  const opacityEl = document.getElementById("widgetOpacitySelect");
  if (opacityEl) {
    opacityEl.value = stored.widgetOpacity || "0.98";
    opacityEl.addEventListener("change", async (e) => {
      const opacity = e.target.value;
      await chrome.storage.local.set({ widgetOpacity: opacity });
      // Notify active tab to apply change in real time
      const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
      if (tab?.id) {
        chrome.tabs.sendMessage(tab.id, { type: "SET_WIDGET_OPACITY", opacity }).catch(() => { });
      }
    });
  }

  const scaleEl = document.getElementById("widgetScaleSelect");
  if (scaleEl) {
    scaleEl.value = stored.widgetScale || "1.0";
    scaleEl.addEventListener("change", async (e) => {
      const scale = e.target.value;
      await chrome.storage.local.set({ widgetScale: scale });
      // Notify active tab to apply change in real time
      const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
      if (tab?.id) {
        chrome.tabs.sendMessage(tab.id, { type: "SET_WIDGET_SCALE", scale }).catch(() => { });
      }
    });
  }

  bindToggle("toggleUrlScan", "enableUrlScan");
  bindToggle("toggleHoverScan", "enableHoverScan");
  bindToggle("toggleFormGuard", "enableFormGuard");
  bindToggle("toggleWhatsappGuard", "enableWhatsappGuard");
  bindToggle("toggleEmailGuard", "enableEmailGuard");
  bindToggle("toggleDownloadGuard", "enableDownloadGuard");
}

// ── Popup Stats ────────────────────────────────────────────
async function loadPopupStats() {
  try {
    let stored = await chrome.storage.local.get(["sec_events_v2", "device_id", "user_email"]);
    let userEmail = stored.user_email || "";

    // If user_email is not stored yet, query active/open dashboard tabs to retrieve logged in email
    if (!userEmail) {
      try {
        const tabs = await chrome.tabs.query({});
        for (const t of tabs) {
          if (t.url && (t.url.includes("localhost:3002") || t.url.includes("aegisone"))) {
            const tabEmail = await chrome.tabs.sendMessage(t.id, { type: "GET_LOGGED_USER_EMAIL" }).catch(() => null);
            if (tabEmail?.email) {
              userEmail = tabEmail.email;
              await chrome.storage.local.set({ user_email: userEmail });
              break;
            }
          }
        }
      } catch (_) {}
    }

    let scans = 0;
    let blocked = 0;
    let safe = 0;
    let fetchedFromApi = false;

    // Source 1: Try fetching real-time combined user stats from API (matches Dashboard 1:1)
    const deviceId = stored.device_id || "";
    const apiEndpoints = [];
    if (userEmail) apiEndpoints.push(`http://localhost:8000/user/stats?email=${encodeURIComponent(userEmail)}`);
    if (deviceId) apiEndpoints.push(`http://localhost:8000/user/stats?device_id=${encodeURIComponent(deviceId)}`);
    apiEndpoints.push("http://localhost:8000/user/stats");

    for (const url of apiEndpoints) {
      try {
        const res = await fetch(url, { signal: AbortSignal.timeout(1500) });
        if (res.ok) {
          const data = await res.json();
          const scanList = data.scans || data.recentScans || [];
          if (Array.isArray(scanList) && scanList.length > 0) {
            scans = scanList.length;
            blocked = scanList.filter(s => s.decision === "block" || s.riskLevel === "danger" || (s.riskScore || 0) >= 80).length;
            safe = Math.max(0, scans - blocked);
            fetchedFromApi = true;
            break;
          } else if (data.totalScans != null && data.totalScans > 0) {
            scans = data.totalScans;
            blocked = data.threatsBlocked || 0;
            safe = Math.max(0, scans - blocked);
            fetchedFromApi = true;
            break;
          }
        }
      } catch (_) {}
    }

    // Source 2: Fallback to background events if API is offline
    if (!fetchedFromApi) {
      const eventsRes = await sendMsg({ type: "GET_EVENTS", limit: 500 });
      const events = Array.isArray(eventsRes?.events) ? eventsRes.events : (Array.isArray(stored.sec_events_v2) ? stored.sec_events_v2 : []);
      scans = events.length;
      blocked = events.filter(e => (e.risk_score || 0) >= 80 || e.action === "blocked" || e.decision === "block").length;
      if (scans === 0 && _currentTabData?.score != null) {
        scans = 1;
        if (_currentTabData.score >= 80) blocked = 1;
      }
      safe = Math.max(0, scans - blocked);
    }

    const elScans = document.getElementById("statTotalScans");
    const elSafe = document.getElementById("statTotalSafe");
    const elBlocked = document.getElementById("statTotalBlocked");
    const elFooterScans = document.getElementById("statsScans");
    const elFooterBlocked = document.getElementById("statsBlocked");

    if (elScans) elScans.textContent = scans;
    if (elSafe) elSafe.textContent = safe;
    if (elBlocked) elBlocked.textContent = blocked;
    if (elFooterScans) elFooterScans.textContent = scans;
    if (elFooterBlocked) elFooterBlocked.textContent = blocked;
  } catch (err) {
    // Non-critical telemetry statistics
  }
}

// ── Current Page Scan Info & Real-Time Analytics ─────────────
async function loadCurrentPage() {
  const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
  const bgRes = await sendMsg({ type: "GET_TAB_DATA" }) || {};
  let data = bgRes.data;
  const url = bgRes.url || tab?.url || "";

  // Query content script directly for live DOM metrics (links, images, forms)
  if (tab?.id) {
    try {
      const pageState = await chrome.tabs.sendMessage(tab.id, { type: "GET_PAGE_STATE" }).catch(() => null);
      if (pageState?.ok) {
        if (!data) data = pageState.data || { score: 0, verdict: "safe" };
        data.links_count = pageState.links_count ?? data.links_count;
        data.images_count = pageState.images_count ?? data.images_count;
        data.form_count = pageState.form_count ?? data.form_count;
      }
    } catch (_) {}
  }

  _currentTabData = data;
  const displayData = _mergeDisplayData(data);
  _updateScanMeta(displayData?.scanned_at || new Date().toISOString());

  document.getElementById("currentUrl").textContent =
    url ? url.replace(/^https?:\/\//, "").slice(0, 52) : "—";

  if (!displayData || displayData.score == null) {
    _setVerdict({ score: 0, verdict: "safe" });
    _renderBreakdown(null);
    _requestFreshScan(true);
    return;
  }

  _setVerdict(displayData);
  _renderBreakdown(displayData.breakdown, displayData.top_factors);
}

function _renderPageAnalytics(tabData, displayData) {
  const elLinks = document.getElementById("statLinks");
  const elImages = document.getElementById("statImages");
  const elForms = document.getElementById("statForms");
  const elLatency = document.getElementById("statLatency");

  const links = tabData?.links_count ?? tabData?.links?.length ?? displayData?.top_factors?.length ?? 0;
  const images = tabData?.images_count ?? tabData?.images?.length ?? 0;
  const forms = tabData?.form_count ?? (tabData?.breakdown?.login_form?.score >= 50 ? 1 : 0);
  const latency = tabData?.latency ? `${Math.round(tabData.latency)}ms` : "4ms";

  if (elLinks) elLinks.textContent = links;
  if (elImages) elImages.textContent = images;
  if (elForms) elForms.textContent = forms;
  if (elLatency) elLatency.textContent = latency;
}

function _setVerdict({ score, verdict, threat_type }) {
  const box = document.getElementById("verdictBox");
  const icon = document.getElementById("verdictIcon");
  const status = document.getElementById("verdictStatus");
  const detail = document.getElementById("verdictDetail");
  const fill = document.getElementById("riskFill");
  const pct = document.getElementById("riskPct");
  const bar = document.getElementById("riskBarContainer");
  const banner = document.getElementById("backendOfflineBanner");

  if (score === -1 || verdict === "offline" || threat_type === "backend_offline") {
    if (banner) banner.style.display = "flex";
    box.className = "verdict-card danger";
    icon.textContent = "🔴";
    status.textContent = "Backend API Offline";
    detail.textContent = "Contact Security Administrator";
    bar.style.display = "block";
    fill.style.width = "100%";
    fill.className = "risk-fill danger";
    pct.textContent = "OFFLINE";
    pct.style.color = "#ef4444";
    return;
  }

  if (score == null) {
    box.className = "verdict-card unknown";
    icon.textContent = "🔍";
    status.textContent = "Scanning Active Tab...";
    detail.textContent = "Analyzing page risk telemetry";
    bar.style.display = "none";
    return;
  }

  let cls = "safe", iconText = "🛡️", statusText = "Page Verified Safe";
  if (score >= THRESHOLD_DANGER) { cls = "danger"; iconText = "🚨"; statusText = "Phishing Threat Detected"; }
  else if (score >= THRESHOLD_WARN) { cls = "warning"; iconText = "⚠️"; statusText = "Suspicious Page"; }
  else if (score >= 20) { cls = "caution"; iconText = "🔶"; statusText = "Low Risk Page"; }

  box.className = `verdict-card ${cls}`;
  icon.textContent = iconText;
  status.textContent = statusText;
  detail.textContent = threat_type
    ? threat_type.replace(/_/g, " ").replace(/\b\w/g, c => c.toUpperCase())
    : verdict
      ? verdict.replace(/_/g, " ").replace(/\b\w/g, c => c.toUpperCase())
      : `${score}% Risk Score`;

  bar.style.display = "block";
  fill.style.width = `${score}%`;
  fill.className = `risk-fill ${score < 30 ? "low" : score < 60 ? "med" : "high"}`;
  pct.textContent = `${score}%`;
}

function _renderBreakdown(breakdown) {
  const container = document.getElementById("breakdownList");
  if (!container) return;

  if (!breakdown || Object.keys(breakdown).length === 0) {
    container.innerHTML = '<div class="empty">No breakdown data available yet.</div>';
    return;
  }

  const entries = Object.entries(breakdown)
    .filter(([, v]) => v.available)
    .sort(([, a], [, b]) => b.score - a.score)
    .slice(0, 6);

  container.innerHTML = entries.map(([key, v]) => {
    const color = v.score >= 80 ? "var(--red)" : v.score >= 50 ? "var(--amber)" : v.score >= 20 ? "var(--orange)" : "var(--green)";
    return `
      <div class="breakdown-item">
        <div class="breakdown-label">${_featureLabel(key)}</div>
        <div class="breakdown-bar-wrap">
          <div class="breakdown-bar"><div class="breakdown-fill" style="width:${v.score}%;background:${color};"></div></div>
          <span class="breakdown-pct" style="color:${color};">${v.score}%</span>
        </div>
        <div class="breakdown-desc">${v.label}</div>
      </div>
    `;
  }).join("");
}

// ── Recent Security Events Log ─────────────────────────────
async function loadRecentEvents() {
  const list = document.getElementById("eventsList");
  const empty = document.getElementById("eventsEmpty");
  if (!list) return;

  const stored = await chrome.storage.local.get(["user_email", "device_id"]);
  const userEmail = stored.user_email || "";
  const deviceId = stored.device_id || "";

  let combinedEvents = [];

  // Source 1: Try fetching combined activity log from /user/stats API
  let apiUrl = "";
  if (userEmail) apiUrl = `http://localhost:8000/user/stats?email=${encodeURIComponent(userEmail)}`;
  else if (deviceId) apiUrl = `http://localhost:8000/user/stats?device_id=${encodeURIComponent(deviceId)}`;
  else apiUrl = "http://localhost:8000/user/stats";

  try {
    const apiRes = await fetch(apiUrl, { signal: AbortSignal.timeout(1200) });
    if (apiRes.ok) {
      const apiData = await apiRes.json();
      if (Array.isArray(apiData.recentScans) && apiData.recentScans.length > 0) {
        combinedEvents = apiData.recentScans;
      }
    }
  } catch (_) {}

  // Source 2: Fallback to background events
  if (combinedEvents.length === 0) {
    const bgRes = await sendMsg({ type: "GET_EVENTS", limit: 30 });
    if (Array.isArray(bgRes?.events)) {
      combinedEvents = bgRes.events.map(e => ({
        scanType: e.type?.includes("email") ? "email" : e.type?.includes("download") ? "attachment" : "url",
        inputPreview: e.domain || e.url || "Scan Activity",
        domain: e.domain || "Web Activity",
        riskScore: e.risk_score || 0,
        decision: e.action || e.decision || "allow",
        timestamp: e.timestamp || new Date().toISOString()
      }));
    }
  }

  if (!combinedEvents || combinedEvents.length === 0) {
    if (empty) empty.style.display = "block";
    list.innerHTML = "";
    return;
  }

  if (empty) empty.style.display = "none";

  list.innerHTML = combinedEvents.slice(0, 15).map(item => {
    const score = item.riskScore ?? item.risk_score ?? 0;
    const stype = (item.scanType || item.type || "url").toLowerCase();
    
    let icon = "🌐";
    let typeLabel = "Website Scan";

    if (stype === "email" || stype === "text") {
      icon = "📧";
      typeLabel = "Email Security";
    } else if (stype === "image") {
      icon = "🖼️";
      typeLabel = "Image Scan";
    } else if (stype === "attachment" || stype === "download") {
      icon = "📥";
      typeLabel = "File Download";
    } else if (stype === "credential") {
      icon = "🔐";
      typeLabel = "Form Guard";
    }

    const isBlocked = item.decision === "block" || score >= 80;
    const isWarned = item.decision === "warn" || (score >= 50 && score < 80);
    const tagCls = isBlocked ? "danger" : isWarned ? "warning" : "safe";
    const badgeIcon = isBlocked ? "🚨" : isWarned ? "⚠️" : "✅";

    const titleText = _sanitize(item.inputPreview || item.domain || "Scan Telemetry");
    const domainText = _sanitize(item.domain || "AegisOne Guard");
    const timeStr = item.timestamp ? new Date(item.timestamp).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }) : "";

    return `
      <div class="event-card-item">
        <div class="event-icon-badge">${icon}</div>
        <div class="event-main-info">
          <div class="event-title">${titleText}</div>
          <div class="event-sub-meta">${typeLabel} · ${domainText} ${timeStr ? "· " + timeStr : ""}</div>
        </div>
        <div class="event-score-tag ${tagCls}">
          ${badgeIcon} ${score}%
        </div>
      </div>
    `;
  }).join("");
}

// ── Server Health Dot ──────────────────────────────────────
async function checkServer() {
  const health = await sendMsg({ type: "CHECK_HEALTH" });
  const dot = document.getElementById("serverDot");
  const banner = document.getElementById("backendOfflineBanner");
  const isOnline = health?.online !== false;

  if (dot) {
    dot.className = `server-dot ${isOnline ? "online" : "offline"}`;
    dot.title = isOnline ? "Server online — AegisOne Backend Operational" : "Server offline — Backend disconnected";
  }

  if (banner) {
    banner.style.display = isOnline ? "none" : "flex";
  }

  const rawModels = health?.data?.models || health?.data?.models_loaded;

  ["email", "text", "url", "image"].forEach(id => {
    const el = document.getElementById(`m-${id}`);
    if (!el) return;
    let isOk = isOnline;
    if (rawModels && rawModels[id]) {
      const item = rawModels[id];
      isOk = typeof item === "boolean" ? item : Boolean(item.loaded || item.status === "loaded" || item.status === "ok");
    }
    el.textContent = isOk ? "✓ Active" : "Offline";
    el.className = `model-badge ${isOk ? "ok" : "err"}`;
  });
}

// ── xAI Copilot Feature ────────────────────────────────────
function setupXAICopilot() {
  const btn = document.getElementById("btnAskXAI");
  const body = document.getElementById("xaiSummaryText");
  if (!btn) return;

  btn.addEventListener("click", async () => {
    btn.textContent = "⏳ Generating AI Diagnosis...";
    btn.disabled = true;

    const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
    const url = tab?.url || "";

    const res = await sendMsg({
      type: "XAI_REQUEST",
      url,
      score: _currentTabData?.score || 0,
    });

    btn.textContent = "✨ Generate AI Explanation";
    btn.disabled = false;

    if (res?.xai) {
      body.innerHTML = `
        <div style="font-weight:700;color:#3b82f6;margin-bottom:6px;">Summary:</div>
        <div>${res.xai.summary || "No AI explanation available."}</div>
        ${res.xai.main_reasons ? `<div style="margin-top:8px;font-size:9px;color:#94a3b8;"><b>Key Factors:</b> ${res.xai.main_reasons.join(", ")}</div>` : ""}
      `;
    } else {
      body.textContent = "AI Service temporarily unavailable. Verify local backend is running.";
    }
  });
}

// ── Tab Switcher ───────────────────────────────────────────
function switchTab(name) {
  document.querySelectorAll(".tab-btn").forEach(b =>
    b.classList.toggle("active", b.dataset.tab === name)
  );
  document.querySelectorAll(".panel").forEach(p =>
    p.classList.toggle("active", p.id === `panel-${name}`)
  );
}

// ── Rescan ─────────────────────────────────────────────────
async function rescan() {
  const btn = document.querySelector(".rescan-btn");
  if (btn) {
    btn.textContent = "⏳ Scanning...";
    btn.disabled = true;
  }

  const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
  if (tab?.id) {
    chrome.tabs.sendMessage(tab.id, { type: "TRIGGER_DEEP_PAGE_SCAN" }).catch(() => { });
  }

  setTimeout(async () => {
    await loadCurrentPage();
    await loadPopupStats();
    await loadRecentEvents();
    if (btn) {
      btn.textContent = "🔄 Rescan";
      btn.disabled = false;
    }
  }, 1800);
}

async function _requestFreshScan(force = false) {
  const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
  if (!tab?.id) return;

  chrome.tabs.sendMessage(tab.id, { type: "TRIGGER_DEEP_PAGE_SCAN" }).catch(() => { });
  setTimeout(async () => {
    const fresh = await sendMsg({ type: "GET_TAB_DATA" }) || {};
    const displayData = _mergeDisplayData(fresh?.data);
    if (displayData?.score != null) {
      _setVerdict(displayData);
      _renderBreakdown(displayData.breakdown);
      _updateScanMeta(displayData.scanned_at);
    }
  }, 2500);
}

// ── Helpers ────────────────────────────────────────────
async function sendMsg(msg) {
  return chrome.runtime.sendMessage(msg).catch(() => null);
}

function _sanitize(str) {
  if (!str) return "";
  return String(str)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

function _featureLabel(key) {
  const map = {
    url_model: "URL Machine Learning",
    domain_age: "Domain Registration Age",
    ssl: "SSL Certificate",
    login_form: "Credential Form Found",
    text_content: "NLP Text Intent",
    redirects: "HTTP Redirect Chain",
    brand_mismatch: "Brand Impersonation",
    hidden_iframe: "Hidden iFrame",
    js_behavior: "Obfuscated JS Behavior",
  };
  return map[key] || key.replace(/_/g, " ");
}

function _mergeDisplayData(data) {
  if (!data) return data;
  const deep = data.deepReport || data.fullReport;
  if (!deep) return data;

  const deepScore = Math.round((deep.composite_risk ?? 0) || 0);
  const baseScore = data.score ?? 0;
  const mergedScore = Math.max(baseScore, deepScore);

  return {
    ...data,
    score: mergedScore,
    verdict: mergedScore >= THRESHOLD_DANGER ? "danger" : mergedScore >= THRESHOLD_WARN ? "warning" : data.verdict,
  };
}

function _updateScanMeta(scannedAt) {
  if (_ageCountdownTimer) clearInterval(_ageCountdownTimer);
  const meta = document.getElementById("scanMeta");
  if (!meta) return;
  if (!scannedAt) { meta.textContent = "No recent scan"; return; }

  function _update() {
    const age = Date.now() - new Date(scannedAt).getTime();
    if (Number.isNaN(age)) { meta.textContent = "Scan time unavailable"; return; }
    meta.textContent = age <= 60000 ? `Fresh scan · ${Math.max(1, Math.round(age / 1000))}s ago` : `Stale scan · ${Math.round(age / 60000)}m ago`;
  }
  _update();
  _ageCountdownTimer = setInterval(_update, 1000);
}

// ── Event Handlers ──────────────────────────────────────────
document.addEventListener("DOMContentLoaded", () => {
  document.getElementById("shieldToggle")?.addEventListener("change", toggleShield);

  document.querySelectorAll(".tab-btn").forEach(btn => {
    btn.addEventListener("click", () => {
      const tabName = btn.dataset.tab;
      if (tabName) switchTab(tabName);
    });
  });

  document.querySelector(".rescan-btn")?.addEventListener("click", rescan);

  init();
});
