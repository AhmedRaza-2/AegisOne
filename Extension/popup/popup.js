/**
 * AegisOne — Popup v2.1
 * ======================
 * Shows: current page risk, top factors, events log,
 *        model status, shield toggle.
 *
 * v2.1 fixes:
 *  - device_id used for stats (no hardcoded email)
 *  - _sanitize() helper prevents XSS from domain names
 *  - Live scan age countdown while popup is open
 */

const THRESHOLD_WARN = 50;
const THRESHOLD_DANGER = 80;
let _ageCountdownTimer = null;

async function init() {
  await loadShieldState();
  await loadControlToggles();
  await loadPopupStats();
  await loadCurrentPage();
  await loadRecentEvents();
  await checkServer();
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

// ── Control Center Toggles ─────────────────────────────────
async function loadControlToggles() {
  const stored = await chrome.storage.local.get(["enableUrlScan", "enableHoverScan", "enableFormGuard"]);

  const tUrl = document.getElementById("toggleUrlScan");
  const tHover = document.getElementById("toggleHoverScan");
  const tForm = document.getElementById("toggleFormGuard");

  if (tUrl) {
    tUrl.checked = stored.enableUrlScan !== false;
    tUrl.addEventListener("change", (e) => chrome.storage.local.set({ enableUrlScan: e.target.checked }));
  }
  if (tHover) {
    tHover.checked = stored.enableHoverScan !== false;
    tHover.addEventListener("change", (e) => chrome.storage.local.set({ enableHoverScan: e.target.checked }));
  }
  if (tForm) {
    tForm.checked = stored.enableFormGuard !== false;
    tForm.addEventListener("change", (e) => chrome.storage.local.set({ enableFormGuard: e.target.checked }));
  }
}

// ── Popup Stats ────────────────────────────────────────────
async function loadPopupStats() {
  try {
    // Use device_id from storage — no hardcoded email
    const { device_id: deviceId } = await chrome.storage.local.get("device_id");
    if (!deviceId) return;
    const res = await fetch(`http://100.104.105.20:8000/user/stats?device_id=${encodeURIComponent(deviceId)}`);
    if (res.ok) {
      const data = await res.json();
      const elScans = document.getElementById("statsScans");
      const elBlocked = document.getElementById("statsBlocked");
      if (elScans) elScans.textContent = data.totalScans || 0;
      if (elBlocked) elBlocked.textContent = data.threatsBlocked || 0;
    }
  } catch (err) {
    // Stats are non-critical — silent fail
  }
}

// ── Current Page ───────────────────────────────────────────
async function loadCurrentPage() {
  const { data, url } = await sendMsg({ type: "GET_TAB_DATA" }) || {};
  const displayData = _mergeDisplayData(data);
  _updateScanMeta(displayData?.scanned_at);

  document.getElementById("currentUrl").textContent =
    url ? url.replace(/^https?:\/\//, "").slice(0, 52) : "—";

  if (!displayData || displayData.score == null) {
    _setVerdict({ score: null });
    _renderSummary(null);
    _requestFreshScan(true);
    return;
  }

  _setVerdict(displayData);
  _renderBreakdown(displayData.breakdown, displayData.top_factors);
  _renderSummary(displayData);
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
    detail.textContent = "Navigate to a page to scan";
    bar.style.display = "none";
    return;
  }

  let cls = "safe", iconText = "✅", statusText = "Safe";
  if (score >= THRESHOLD_DANGER) { cls = "danger"; iconText = "🚨"; statusText = "Phishing Detected"; }
  else if (score >= THRESHOLD_WARN) { cls = "warning"; iconText = "⚠️"; statusText = "Suspicious Page"; }
  else if (score >= 20) { cls = "caution"; iconText = "🔶"; statusText = "Low Risk"; }

  box.className = `verdict-box ${cls}`;
  icon.textContent = iconText;
  status.textContent = statusText;
  detail.textContent = threat_type
    ? threat_type.replace(/_/g, " ").replace(/\b\w/g, c => c.toUpperCase())
    : verdict
      ? verdict.replace(/_/g, " ").replace(/\b\w/g, c => c.toUpperCase())
      : `${score}% Risk`;

  bar.style.display = "block";
  fill.style.width = `${score}%`;
  fill.className = `risk-fill ${score < 30 ? "low" : score < 60 ? "med" : "high"}`;
  pct.textContent = `${score}%`;
}

function _renderBreakdown(breakdown, top_factors) {
  const container = document.getElementById("breakdownList");
  if (!container) return;

  if (!breakdown || Object.keys(breakdown).length === 0) {
    container.innerHTML = '<div class="empty">No breakdown data yet.</div>';
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

function _renderSummary(data) {
  const box = document.getElementById("summaryBox");
  if (!box) return;

  if (!data || data.score == null) {
    box.textContent = "No scan yet. Open a page to see a quick security summary.";
    return;
  }

  const score = data.score || 0;
  const verdict = score >= THRESHOLD_DANGER ? "Phishing Detected" : score >= THRESHOLD_WARN ? "Suspicious" : score >= 20 ? "Low Risk" : "Safe";
  const reason = data.top_factors?.[0]?.label || "No dominant threat signal found.";
  const rec = score >= THRESHOLD_DANGER
    ? "Leave the page and avoid entering credentials."
    : score >= THRESHOLD_WARN
      ? "Review the link carefully before continuing."
      : "Continue normally, but keep an eye on login forms and downloads.";

  box.innerHTML = `
    <div class="summary-title">${verdict} · ${score}%</div>
    <div class="summary-reason">${reason}</div>
    <div class="summary-rec">${rec}</div>
  `;
}

// ── Recent Events ────────────────────────────────────────────
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
    // Sanitize user-derived strings to prevent XSS
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

// ── Server Health ──────────────────────────────────────────
async function checkServer() {
  const health = await sendMsg({ type: "CHECK_HEALTH" });
  const dot = document.getElementById("serverDot");
  if (!dot) return;
  dot.className = `server-dot ${health?.online ? "online" : "offline"}`;
  dot.title = health?.online ? "Server online" : "Server offline — start the AegisOne backend";

  if (health?.online && health.data?.models_loaded) {
    const models = health.data.models_loaded;
    ["email", "text", "url", "image"].forEach(id => {
      const el = document.getElementById(`m-${id}`);
      if (!el) return;
      el.textContent = models[id] ? "Loaded" : "Missing";
      el.className = `model-badge ${models[id] ? "ok" : "err"}`;
    });
  }
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

  if (!force) {
    const current = await sendMsg({ type: "GET_TAB_DATA" }) || {};
    if (_isRecentScan(current?.data?.scanned_at)) {
      return;
    }
  }

  chrome.tabs.sendMessage(tab.id, { type: "TRIGGER_DEEP_PAGE_SCAN" }).catch(() => { });
  setTimeout(async () => {
    const fresh = await sendMsg({ type: "GET_TAB_DATA" }) || {};
    const displayData = _mergeDisplayData(fresh?.data);
    if (displayData?.score != null) {
      _setVerdict(displayData);
      _renderBreakdown(displayData.breakdown, displayData.top_factors);
      _renderSummary(displayData);
      _updateScanMeta(displayData.scanned_at);
    }
  }, 3000);
}

// ── Helpers ────────────────────────────────────────────
async function sendMsg(msg) {
  return chrome.runtime.sendMessage(msg).catch(() => null);
}

/**
 * Escape HTML to prevent XSS from domain names or threat types
 * reflected into the popup innerHTML.
 */
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
    url_model: "URL Analysis",
    domain_age: "Domain Age",
    ssl: "SSL Certificate",
    login_form: "Login Form",
    text_content: "Page Content",
    redirects: "Redirects",
    brand_mismatch: "Brand Match",
    hidden_iframe: "Hidden iFrames",
    js_behavior: "JS Behavior",
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
  const mergedTopFactors = [
    ...(deep.bad_urls || []).slice(0, 2).map(u => ({ label: `Malicious link: ${u.url.slice(0, 40)}…` })),
    ...(deep.text_result?.top_words || []).slice(0, 2).map(word => ({ label: `Phishing keyword: "${word}"` })),
    ...(data.top_factors || []),
  ].slice(0, 5);

  const mergedBreakdown = deepScore > baseScore
    ? {
      ...(data.breakdown || {}),
      deep_page: {
        score: deepScore,
        label: deepScore >= 80 ? "Deep page scan indicates high risk" : "Deep page scan indicates suspicious activity",
        available: true,
      },
    }
    : data.breakdown;

  return {
    ...data,
    score: mergedScore,
    verdict: mergedScore >= THRESHOLD_DANGER ? "danger" : mergedScore >= THRESHOLD_WARN ? "warning" : data.verdict,
    top_factors: mergedTopFactors,
    breakdown: mergedBreakdown,
  };
}


function _updateScanMeta(scannedAt) {
  // Clear any existing countdown
  if (_ageCountdownTimer) {
    clearInterval(_ageCountdownTimer);
    _ageCountdownTimer = null;
  }

  const meta = document.getElementById("scanMeta");
  if (!meta) return;
  if (!scannedAt) {
    meta.textContent = "No recent scan";
    return;
  }

  function _update() {
    const age = Date.now() - new Date(scannedAt).getTime();
    if (Number.isNaN(age)) {
      meta.textContent = "Scan time unavailable";
      return;
    }
    meta.textContent = _isRecentScan(scannedAt)
      ? `Fresh scan · ${_formatAge(age)} ago`
      : `Stale scan · ${_formatAge(age)} ago`;
  }

  _update();
  // Live countdown — update every second while popup is open
  _ageCountdownTimer = setInterval(_update, 1000);
}

function _isRecentScan(scannedAt, thresholdMs = 60000) {
  if (!scannedAt) return false;
  const age = Date.now() - new Date(scannedAt).getTime();
  return Number.isFinite(age) && age >= 0 && age <= thresholdMs;
}

function _formatAge(ageMs) {
  const seconds = Math.max(1, Math.round(ageMs / 1000));
  if (seconds < 60) return `${seconds}s`;
  const minutes = Math.round(seconds / 60);
  return `${minutes}m`;
}

// ── Init ───────────────────────────────────────────────────
document.addEventListener("DOMContentLoaded", () => {
  document.getElementById("shieldToggle")?.addEventListener("change", toggleShield);

  // Tab buttons click handler
  document.querySelectorAll(".tab-btn").forEach(btn => {
    btn.addEventListener("click", () => {
      const tabName = btn.dataset.tab;
      if (tabName) switchTab(tabName);
    });
  });

  // Rescan button handler
  document.querySelector(".rescan-btn")?.addEventListener("click", rescan);

  init();
});
