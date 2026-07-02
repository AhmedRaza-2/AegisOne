# AegisOne Extension — Changelog

---

## [2026-06-30] v2.0.0 — Scalable Architecture Rewrite

**Status:** Complete. Old monolithic files (`background.js`, `content_script.js`, `popup.html`, `popup.js`) are preserved for reference. Load the new extension from the `Extension/` root using `manifest.json` which now points to `background/sw.js` and `content/main.js`.

### What Changed

#### Architecture
- **BEFORE:** 3 monolithic files (70KB content_script, 26KB background, 6KB popup)
- **AFTER:** 14 focused modules with clear single responsibilities

#### New File Structure
```
Extension/
├── manifest.json              (v2 — updated permissions, module paths)
├── background/
│   ├── sw.js                  (Service Worker — message router only)
│   ├── scanner.js             (All API calls — single entry point)
│   ├── cache.js               (2-layer LRU cache — memory + storage)
│   ├── risk-engine.js         (Weighted explainable risk calculator)
│   ├── event-store.js         (Event-based storage, NOT browsing history)
│   ├── download-guard.js      (Download interception — isolated)
│   ├── xai.js                 (On-demand XAI — only when user asks)
│   └── sync.js                (Dashboard sync + org policy fetch)
├── content/
│   ├── main.js                (Entry point — dynamic module imports)
│   ├── widget.js              (Floating shield widget)
│   ├── search-badges.js       (Google/Bing/DDG risk badges)
│   ├── link-scanner.js        (Hover preview + danger badges)
│   ├── form-guard.js          (Credential protection)
│   └── modals.js              (All modal dialogs)
├── popup/
│   ├── popup.html             (New: breakdown + events + models tabs)
│   └── popup.js               (New: displays per-feature risk bars)
└── utils/
    ├── constants.js           (All config in one place)
    └── trusted-domains.js     (Domain whitelist + URL utilities)
```

---

### Key Improvements

#### 1. Weighted Risk Engine (risk-engine.js)
Every risk score is now explainable. Returns:
```js
{
  score: 87,
  verdict: "danger",
  breakdown: {
    url_model:   { score: 92, label: "AI detected credential harvesting patterns" },
    domain_age:  { score: 95, label: "Domain registered 5 days ago" },
    ssl:         { score: 80, label: "Self-signed TLS certificate" },
    login_form:  { score: 90, label: "Suspicious credential form detected" },
    ...
  },
  top_factors: [...],
  threat_type: "credential_harvesting"
}
```
No more black-box AI numbers.

#### 2. Domain-Level LRU Cache (cache.js)
- Layer 1: In-memory Map (instant, 500 entries)
- Layer 2: chrome.storage.local (persistent, 15min TTL)
- Result: 300 employees visiting google.com → scanned once

#### 3. Event-Based Storage (event-store.js)
- **NEVER** stores browsing history
- **ONLY** stores events: website threats, blocked downloads, credential warnings, threat reports, XAI sessions
- Max 100 events locally, pruned automatically
- Batched sync to dashboard every 30s

#### 4. On-Demand XAI Only (xai.js)
- XAI is **never** called automatically
- Only triggered when user clicks "✨ Explain with AI"
- Sends compact evidence payload (NOT full HTML):
  - URL, domain, risk breakdown, top factors
  - Text summary (300 chars max)
  - Form/iframe/redirect signals
- Falls back to local explanation if LLM is offline

#### 5. Search Result Badges (search-badges.js)
- Scans max 10 results per cycle (rate-limited)
- MutationObserver handles lazy-loaded results
- Works on Google, Bing, DuckDuckGo
- Cache-first — no API call for already-scanned domains

#### 6. Form Guard (form-guard.js)
- Detects password inputs (including dynamically added ones via SPA)
- Intercepts form submission on risky pages (score ≥ 50%)
- Shows credential warning modal before allowing submit
- Provides login_form_found feature to risk engine

#### 7. Popup Redesigned
- **Breakdown tab**: Per-feature risk bars (URL AI, Domain Age, SSL, Login Form, etc.)
- **Events tab**: Recent security events log
- **Models tab**: API model health status

---

### How to Load v2

1. Go to `chrome://extensions/`
2. Enable Developer Mode
3. Click **Load Unpacked**
4. Select `d:\Coding Projects\AegisOne\Extension\`
5. The extension will load using the new `manifest.json`

> **Note:** The old `background.js`, `content_script.js`, `popup.html`, `popup.js` files in the root are v1 artifacts. They are NOT loaded by the new manifest. You can delete them when ready.

---

## [2026-05-25] v1.x — Previous Entries

### [2026-05-25] Performance Tuning & Attention-based Explainable AI (XAI)
- Attention-based XAI mapping from MultiHeadAttentionPool layer
- Staggered Google Search scanning (10 results/cycle)
- Dynamic scrolling support via MutationObserver

### [2024-04-27] Major Update: False Positives, UI/UX & XAI
- Replaced red blocks with security badges
- Trusted domain engine (false positive reduction)
- Widget contradiction fix (synchronized risk scoring)
- Download interception upgrade (full content analysis)
