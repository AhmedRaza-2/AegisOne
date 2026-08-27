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
      const targetUrl = stored.dashboard_url || `http://localhost:${port}/dashboard`;
      chrome.tabs.create({ url: targetUrl });
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
        chrome.tabs.sendMessage(tab.id, { type: "SET_WIDGET_OPACITY", opacity }).catch(() => {});
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
        chrome.tabs.sendMessage(tab.id, { type: "SET_WIDGET_SCALE", scale }).catch(() => {});
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
    const stored = await chrome.storage.local.get(["sec_events_v2", "device_id"]);
    const events = Array.isArray(stored.sec_events_v2) ? stored.sec_events_v2 : [];
    const localScans = events.length;
    const localBlocked = events.filter(e => (e.risk_score || 0) >= 80 || e.action === "blocked").length;

    const elScans = document.getElementById("statsScans");
    const elBlocked = document.getElementById("statsBlocked");

    let scans = localScans || (_currentTabData?.score != null ? 1 : 0);
    let blocked = localBlocked || ((_currentTabData?.score || 0) >= 80 ? 1 : 0);

    if (stored.device_id) {
      try {
        const res = await fetch(`http://localhost:8000/user/stats?device_id=${encodeURIComponent(stored.device_id)}`, { signal: AbortSignal.timeout(1500) });
        if (res.ok) {
          const data = await res.json();
          if (data.totalScans) scans = Math.max(scans, data.totalScans);
          if (data.threatsBlocked) blocked = Math.max(blocked, data.threatsBlocked);
        }
      } catch (_) {}
    }

    if (elScans) elScans.textContent = scans;
    if (elBlocked) elBlocked.textContent = blocked;
  } catch (err) {
    // Non-critical telemetry statistics
  }
}

// ── Current Page Scan Info & Real-Time Analytics ─────────────
async function loadCurrentPage() {
  const { data, url } = await sendMsg({ type: "GET_TAB_DATA" }) || {};
  _currentTabData = data;
  const displayData = _mergeDisplayData(data);
  _updateScanMeta(displayData?.scanned_at);
  _renderPageAnalytics(data, displayData);

  document.getElementById("currentUrl").textContent =
    url ? url.replace(/^https?:\/\//, "").slice(0, 52) : "—";

  if (!displayData || displayData.score == null) {
    _setVerdict({ score: null });
    _renderBreakdown(null);
    _requestFreshScan(true);
    return;
  }

  _setVerdict(displayData);
  _renderBreakdown(displayData.breakdown, displayData.top_factors);
}

function _renderPageAnalytics(tabData, displayData) {
  const elLinks   = document.getElementById("statLinks");
  const elImages  = document.getElementById("statImages");
  const elForms   = document.getElementById("statForms");
  const elLatency = document.getElementById("statLatency");

  const links  = tabData?.links_count ?? tabData?.links?.length ?? displayData?.top_factors?.length ?? 0;
  const images = tabData?.images_count ?? tabData?.images?.length ?? 0;
  const forms  = tabData?.form_count ?? (tabData?.breakdown?.login_form?.score >= 50 ? 1 : 0);
  const latency = tabData?.latency ? `${Math.round(tabData.latency)}ms` : "4ms";

  if (elLinks)   elLinks.textContent   = links;
  if (elImages)  elImages.textContent  = images;
  if (elForms)   elForms.textContent   = forms;
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

  if (score == null) {
    box.className = "verdict-box unknown";
    icon.textContent = "🔍";
    status.textContent = "Not Scanned";
    detail.textContent = "Navigate to a website to initiate AI scan";
    bar.style.display = "none";
    return;
  }

  let cls = "safe", iconText = "✅", statusText = "Safe Site";
  if (score >= THRESHOLD_DANGER) { cls = "danger"; iconText = "🚨"; statusText = "Phishing Threat"; }
  else if (score >= THRESHOLD_WARN) { cls = "warning"; iconText = "⚠️"; statusText = "Suspicious Site"; }
  else if (score >= 20) { cls = "caution"; iconText = "🔶"; statusText = "Low Risk"; }

  box.className = `verdict-box ${cls}`;
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
  const res = await sendMsg({ type: "GET_EVENTS", limit: 15 });
  const list = document.getElementById("eventsList");
  const empty = document.getElementById("eventsEmpty");

  if (!res?.events?.length) {
    if (empty) empty.style.display = "block";
    return;
  }

  if (empty) empty.style.display = "none";
  list.innerHTML = res.events.map(e => {
    const time = new Date(e.timestamp).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
    const icon = e.type === "download_blocked" ? "📥" : e.type === "threat_report" ? "🚨" : e.type === "credential_warning" ? "🔐" : "⚠️";
    const color = (e.risk_score || 0) >= 80 ? "var(--red)" : "var(--amber)";
    const domain = _sanitize(e.domain || "unknown");
    const type = _sanitize(e.type.replace(/_/g, " "));
    return `
      <div class="event-item">
        <span class="event-icon">${icon}</span>
        <div class="event-info">
          <div class="event-domain">${domain}</div>
          <div class="event-meta">${type} · ${time}</div>
        </div>
        <div class="event-score" style="color:${color};">${e.risk_score || 0}%</div>
      </div>
    `;
  }).join("");
}

// ── Server Health Dot ──────────────────────────────────────
async function checkServer() {
  const health = await sendMsg({ type: "CHECK_HEALTH" });
  const dot = document.getElementById("serverDot");
  if (dot) {
    dot.className = `server-dot ${health?.online ? "online" : "offline"}`;
    dot.title = health?.online ? "Server online — AegisOne Backend Operational" : "Server offline — Backend disconnected";
  }

  const isOnline = health?.online !== false;
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
  const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
  if (tab?.id) {
    chrome.tabs.sendMessage(tab.id, { type: "TRIGGER_DEEP_PAGE_SCAN" }).catch(() => { });
    window.close();
  }
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
    meta.textContent = age <= 60000 ? `Fresh scan · ${Math.max(1, Math.round(age/1000))}s ago` : `Stale scan · ${Math.round(age/60000)}m ago`;
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
