/**
 * AegisOne — Popup Script
 * Renders verdict, link results, blocked downloads, model status.
 */

const PHISHING_THRESHOLD = 0.5;

// ── Shield Toggle ──
async function toggleShield() {
  const res = await chrome.runtime.sendMessage({ type: "TOGGLE_SHIELD" });
  const label = document.getElementById("shieldLabel");
  const toggle = document.getElementById("shieldToggle");
  if (label) label.textContent = res.enabled ? "ON" : "OFF";
  if (toggle) toggle.checked = res.enabled;
}

async function loadShieldState() {
  const res = await chrome.runtime.sendMessage({ type: "GET_SHIELD_STATE" });
  const label = document.getElementById("shieldLabel");
  const toggle = document.getElementById("shieldToggle");
  if (label) label.textContent = res.enabled ? "ON" : "OFF";
  if (toggle) toggle.checked = res.enabled;
}

// ── Tab switching ──
function switchTab(name) {
  document.querySelectorAll(".tab-btn").forEach((b) =>
    b.classList.toggle("active", b.dataset.tab === name)
  );
  document.querySelectorAll(".panel").forEach((p) =>
    p.classList.toggle("active", p.id === `panel-${name}`)
  );
}

// ── Render verdict box ──
function renderVerdict(urlResult, pageResult) {
  const box = document.getElementById("verdictBox");
  const icon = document.getElementById("verdictIcon");
  const status = document.getElementById("verdictStatus");
  const detail = document.getElementById("verdictDetail");
  const riskContainer = document.getElementById("riskBarContainer");
  const riskFill = document.getElementById("riskFill");
  const riskPct = document.getElementById("riskPct");

  if (!urlResult) {
    box.className = "verdict-box unknown";
    icon.textContent = "❓";
    status.textContent = "Not Scanned";
    detail.textContent = "Navigate to a webpage to scan";
    return;
  }

  const prob = urlResult.phishing_probability ?? 0;
  const isPhishing = prob > PHISHING_THRESHOLD ||
    urlResult.prediction === "phishing" ||
    urlResult.prediction === "malicious";
  const category = urlResult.category || urlResult.prediction || "";

  box.className = `verdict-box ${isPhishing ? "danger" : "safe"}`;
  icon.textContent = isPhishing ? "🚨" : "✅";
  status.textContent = isPhishing ? "Phishing Detected" : "Legitimate";
  detail.textContent = category
    ? `Category: ${category} · ${(prob * 100).toFixed(0)}% risk`
    : `Confidence: ${((isPhishing ? prob : 1 - prob) * 100).toFixed(0)}%`;

  // Risk bar
  riskContainer.style.display = "block";
  const pct = Math.round(prob * 100);
  riskFill.style.width = `${pct}%`;
  riskFill.className = `risk-fill ${pct < 30 ? "low" : pct < 60 ? "med" : "high"}`;
  riskPct.textContent = `${pct}%`;
}

// ── Render links list ──
function renderLinks(urlResults) {
  const list = document.getElementById("linksList");
  const empty = document.getElementById("linksEmpty");

  if (!urlResults || urlResults.length === 0) {
    empty.style.display = "block";
    return;
  }
  empty.style.display = "none";

  list.innerHTML = urlResults
    .sort((a, b) => (b.phishing_probability ?? 0) - (a.phishing_probability ?? 0))
    .map((u) => {
      const prob = u.phishing_probability ?? 0;
      const bad = prob > PHISHING_THRESHOLD;
      const pct = Math.round(prob * 100);
      const shortUrl = u.url.replace(/^https?:\/\//, "").slice(0, 45);
      return `
        <div class="url-item ${bad ? "danger" : "safe"}">
          <div class="dot ${bad ? "danger" : "safe"}"></div>
          <div class="url-text" title="${u.url}">${shortUrl}</div>
          <div class="pct">${pct}%</div>
        </div>`;
    })
    .join("");
}

// ── Render blocked downloads ──
function renderBlocked(blocked) {
  const list = document.getElementById("blockedList");
  const empty = document.getElementById("blockedEmpty");

  if (!blocked || blocked.length === 0) {
    empty.style.display = "block";
    return;
  }
  empty.style.display = "none";

  list.innerHTML = blocked
    .slice(0, 20)
    .map((b) => {
      const name = b.filename?.split(/[\\/]/).pop() || "unknown file";
      const time = new Date(b.time).toLocaleString();
      return `
        <div class="blocked-item">
          <div class="file">🚫 ${name}</div>
          <div class="threat">${b.threat || "phishing"} · ${(b.risk * 100).toFixed(0)}% risk · ${time}</div>
        </div>`;
    })
    .join("");
}

// ── Render model status ──
function renderModels(health) {
  const ids = ["email", "text", "url", "image"];
  ids.forEach((id) => {
    const el = document.getElementById(`m-${id}`);
    if (!el) return;
    const loaded = health?.models_loaded?.[id];
    el.textContent = loaded ? "Loaded" : loaded === false ? "Missing" : "—";
    el.className = `model-badge ${loaded ? "ok" : "err"}`;
  });
}

// ── Main load ──
async function load() {
  // 1. Get current tab data from background
  const { data, url } = await chrome.runtime.sendMessage({ type: "GET_TAB_DATA" });

  // Update footer URL
  document.getElementById("currentUrl").textContent = url
    ? url.replace(/^https?:\/\//, "").slice(0, 50)
    : "—";

  // Render verdict
  renderVerdict(data?.verdict || null, data?.pageData || null);

  // Render links
  renderLinks(data?.pageData?.urls || []);

  // 2. Get blocked downloads
  const { blocked } = await chrome.runtime.sendMessage({ type: "GET_BLOCKED" });
  renderBlocked(blocked);

  // 3. Check server health
  const health = await chrome.runtime.sendMessage({ type: "CHECK_HEALTH" });
  const dot = document.getElementById("serverDot");
  dot.className = `server-dot ${health.online ? "online" : "offline"}`;
  dot.title = health.online ? "Server online" : "Server offline — start unified_server.py";

  if (health.online) {
    renderModels(health.data);
  }
}

// ── Rescan current tab ──
async function rescan() {
  const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
  if (tab?.id) {
    // Re-inject content script
    chrome.scripting.executeScript({
      target: { tabId: tab.id },
      files: ["content_script.js"],
    });
    window.close();
  }
}

// Run
load();
loadShieldState();
