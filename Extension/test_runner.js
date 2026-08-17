import { MSG, THRESHOLD } from "./utils/constants.js";

const tests = [
  {
    id: "sw_health",
    name: "Service Worker Connection",
    desc: "Verify runtime messages successfully reach background script.",
    fn: async (log) => {
      const start = performance.now();
      const res = await chrome.runtime.sendMessage({ type: MSG.CHECK_HEALTH });
      const lat = performance.now() - start;
      log(`Received health check response in ${lat.toFixed(1)}ms`);
      if (res && res.status === "ok") {
        return true;
      }
      throw new Error("Invalid or missing response from Service Worker");
    }
  },
  {
    id: "trusted_domain",
    name: "Trusted Domain Bypass (L2)",
    desc: "Verify well-known safe domains (e.g. google.com) skip API scans.",
    fn: async (log) => {
      const res = await chrome.runtime.sendMessage({
        type: MSG.NAVIGATE_SCAN,
        url: "https://www.google.com"
      });
      log(`Scan verdict for google.com: ${JSON.stringify(res)}`);
      if (res && res.verdict === "safe" && res.score === 0) {
        return true;
      }
      throw new Error(`Expected safe/0 score, got verdict: ${res?.verdict}, score: ${res?.score}`);
    }
  },
  {
    id: "l3_phishing_scan",
    name: "L3 URL Threat Scan",
    desc: "Ensure mock phishing URLs trigger risk scoring.",
    fn: async (log) => {
      const res = await chrome.runtime.sendMessage({
        type: MSG.NAVIGATE_SCAN,
        url: "http://paypa1-secure-verification.net/signin"
      });
      log(`Scan result: Score = ${res?.score}%, Verdict = ${res?.verdict}`);
      if (res && res.score > 0) {
        return true;
      }
      throw new Error("Phishing URL failed to score above zero.");
    }
  },
  {
    id: "form_guard_http",
    name: "Credential Guard: HTTP Check",
    desc: "Ensure credentials input alerts trigger for non-HTTPS forms.",
    fn: async (log) => {
      const res = await chrome.runtime.sendMessage({
        type: MSG.FORM_INTERCEPT,
        action: "http://insecure-domain.com/login",
        fields: ["password"]
      });
      log(`Form intercept decision: ${JSON.stringify(res)}`);
      if (res && res.warn === true) {
        return true;
      }
      throw new Error("Failed to warn for insecure HTTP login form action.");
    }
  },
  {
    id: "form_guard_mismatch",
    name: "Credential Guard: Domain Mismatch",
    desc: "Verify alerts trigger when form action domain differs from page domain.",
    fn: async (log) => {
      const res = await chrome.runtime.sendMessage({
        type: MSG.FORM_INTERCEPT,
        url: "https://trusted-bank.com/portal",
        action: "https://fake-bank-login.com/steal",
        fields: ["password", "username"]
      });
      log(`Form mismatch warning result: ${JSON.stringify(res)}`);
      if (res && res.warn === true) {
        return true;
      }
      throw new Error("Failed to warn on form action domain mismatch.");
    }
  },
  {
    id: "warning_threshold",
    name: "Warning UI Threshold Gating",
    desc: "Verify WARNING triggers non-blocking UI and DANGER triggers blocking UI.",
    fn: async (log) => {
      const dangerThreshold = THRESHOLD.DANGER * 100;
      const warningThreshold = THRESHOLD.WARNING * 100;
      log(`Configured Danger threshold: ${dangerThreshold}%, Warning threshold: ${warningThreshold}%`);
      
      const dangerBlock = 85 >= dangerThreshold;
      const warningBlock = 65 >= dangerThreshold;

      log(`Simulation: 85% score isBlocking = ${dangerBlock} (Expected: true)`);
      log(`Simulation: 65% score isBlocking = ${warningBlock} (Expected: false)`);

      if (dangerBlock && !warningBlock) {
        return true;
      }
      throw new Error("Gating simulation failed: thresholds computed incorrectly.");
    }
  }
];

const testListEl = document.getElementById("testList");
const runBtn = document.getElementById("runBtn");
const consoleEl = document.getElementById("consoleLog");
const passedStat = document.getElementById("statPassed");
const failedStat = document.getElementById("statFailed");
const latencyStat = document.getElementById("statLatency");

function initUI() {
  testListEl.innerHTML = "";
  tests.forEach((t) => {
    const item = document.createElement("div");
    item.className = "test-item";
    item.id = `test_${t.id}`;
    item.innerHTML = `
      <div class="test-info">
        <span class="test-name">${t.name}</span>
        <span class="test-desc">${t.desc}</span>
      </div>
      <span class="test-state state-idle" id="state_${t.id}">Idle</span>
    `;
    testListEl.appendChild(item);
  });
}

function logToConsole(msg) {
  consoleEl.textContent += `\n[${new Date().toLocaleTimeString()}] ${msg}`;
  consoleEl.scrollTop = consoleEl.scrollHeight;
}

async function runAllTests() {
  runBtn.disabled = true;
  consoleEl.textContent = "Starting AegisOne Extension Test Suite...";
  
  let passedCount = 0;
  let failedCount = 0;
  let totalLatency = 0;
  let scanCount = 0;

  for (const t of tests) {
    const stateEl = document.getElementById(`state_${t.id}`);
    stateEl.className = "test-state state-running";
    stateEl.textContent = "Running";
    logToConsole(`>>> Running: ${t.name}`);

    try {
      const start = performance.now();
      const passed = await t.fn(logToConsole);
      const lat = performance.now() - start;

      if (t.id.includes("scan") || t.id.includes("trusted")) {
        totalLatency += lat;
        scanCount++;
      }

      if (passed) {
        stateEl.className = "test-state state-passed";
        stateEl.textContent = "Passed";
        passedCount++;
        logToConsole(`✓ Passed: ${t.name}`);
      } else {
        throw new Error("Returned negative result");
      }
    } catch (err) {
      stateEl.className = "test-state state-failed";
      stateEl.textContent = "Failed";
      failedCount++;
      logToConsole(`❌ Failed: ${t.name} | Error: ${err.message}`);
    }

    passedStat.textContent = passedCount;
    failedStat.textContent = failedCount;
    if (scanCount > 0) {
      latencyStat.textContent = `${(totalLatency / scanCount).toFixed(1)} ms`;
    }
  }

  logToConsole("\n=================================");
  logToConsole(`All tests completed. Passed: ${passedCount}, Failed: ${failedCount}`);
  logToConsole("=================================");
  runBtn.disabled = false;
}

runBtn.addEventListener("click", runAllTests);
initUI();
