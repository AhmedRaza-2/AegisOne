/**
 * AegisOne — Popup v2.0
 * ======================
 * Shows: current page risk, top factors, events log,
 *        model status, shield toggle.
 */

const THRESHOLD_WARN = 50;
const THRESHOLD_DANGER = 80;

async function init() {
  await loadShieldState();
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

// ── Current Page ───────────────────────────────────────────
async function loadCurrentPage() {
  const { data, url } = await sendMsg({ type: "GET_TAB_DATA" }) || {};

  document.getElementById("currentUrl").textContent =
    url ? url.replace(/^https?:\/\//, "").slice(0, 52) : "—";

  if (!data || data.score == null) {
    _setVerdict({ score: null });
    _renderSummary(null);
    _requestFreshScan();
    return;
  }

  _setVerdict(data);
  _renderBreakdown(data.breakdown, data.top_factors);
  _renderSummary(data);
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

// ── Recent Events ──────────────────────────────────────────
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
    return `
      <div class="event-item">
        <span class="event-icon">${icon}</span>
        <div class="event-info">
          <div class="event-domain">${e.domain || "unknown"}</div>
          <div class="event-meta">${e.type.replace(/_/g, " ")} · ${time}</div>
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
    chrome.tabs.sendMessage(tab.id, { type: "TRIGGER_DEEP_PAGE_SCAN" }).catch(() => {});
    window.close();
  }
}

async function _requestFreshScan() {
  const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
  if (!tab?.id) return;

  chrome.tabs.sendMessage(tab.id, { type: "TRIGGER_DEEP_PAGE_SCAN" }).catch(() => {});
  setTimeout(async () => {
    const fresh = await sendMsg({ type: "GET_TAB_DATA" }) || {};
    if (fresh?.data?.score != null) {
      _setVerdict(fresh.data);
      _renderBreakdown(fresh.data.breakdown, fresh.data.top_factors);
      _renderSummary(fresh.data);
    }
  }, 3000);
}

// ── Helpers ────────────────────────────────────────────────
async function sendMsg(msg) {
  return chrome.runtime.sendMessage(msg).catch(() => null);
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
