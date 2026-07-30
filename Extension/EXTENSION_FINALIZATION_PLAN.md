# AegisOne Extension — Finalization Plan

> **Status:** v2.1.0 — Production Finalization Sprint  
> **DB Schema:** Frozen — zero changes. See `DB_FUTURE_CHANGES.md` for future ideas.

---

## Goal

Transform the AegisOne browser extension from a working prototype into a **lightweight, production-quality, enterprise-grade security copilot** with no performance regressions, no lag spikes, and graceful handling of all failure modes.

---

## Architecture Overview

```
Browser Events (tab load, hover, click, form submit, download)
    │
    ▼
content/main.js   ← Event-driven SPA watcher + DOM observer
    │
    ▼ (chrome.runtime.sendMessage)
background/sw.js  ← Message router + per-tab AbortController
    │
    ├─ requestQueue.js     ← Deduplication (same URL = 1 promise)
    ├─ scanner.js          ← API calls + cache + offline detection
    ├─ cache.js            ← 2-layer cache (memory + storage)
    ├─ risk-engine.js      ← Weighted score calculation
    ├─ event-store.js      ← Local security event store
    ├─ sync.js             ← Dashboard flush + exponential backoff
    ├─ xai.js              ← Explainable AI (user-triggered only)
    └─ download-guard.js   ← Download interception
    │
    ▼ (fetch)
Flask API (localhost:8000)
    │
    ▼
PostgreSQL + Dashboard (WebSocket)
```

---

## Scan Pipeline (Multi-Level)

| Level | Latency | What happens |
|-------|---------|-------------|
| **L1** | 0–5 ms | Cache hit → return immediately, skip ALL API calls |
| **L2** | 0–10 ms | Policy check (allowlist/blocklist) → instant return |
| **L3** | 50–200 ms | URL AI model only |
| **L4** | 200–500 ms | Deep scan (text + links) — **only if L3 ≥ WARNING threshold** |

---

## Performance Goals

| Metric | Target | Status |
|--------|--------|--------|
| Time to first result | < 200 ms | ✅ Cache-first |
| Duplicate API calls | 0 | ✅ requestQueue.js |
| CPU when idle / browsing safe sites | ~0% | ✅ Event-driven (no polling) |
| Memory per tab | < 500 KB | ✅ LRU cache caps (500 domain, 50 tab) |
| API calls on hover (cached domain) | 0 | ✅ HOVER_TTL cache |
| API calls on rapid tab switching | 1 per tab | ✅ AbortController |
| Backend offline → scan timeout | 0 ms | ✅ isBackendOnline() fast path |

---

## Feature Checklist

### Navigation Protection
- [x] URL scan on tab load (cache-first)
- [x] Deep scan on page content (text + links)
- [x] Deep scan gated on L3 risk score (no waste on safe pages)
- [x] SPA navigation detection (pushState/popstate/hashchange — no polling)
- [x] Dynamic DOM observer (late-injected phishing forms)

### Link Protection
- [x] Hover URL scan (TTL-cached, deduplicated)
- [x] Batch link scan for page links
- [x] Danger badge on malicious links
- [x] Right-click scan (link, page, image, text)

### Credential Protection
- [x] Password field focus freeze on risky pages
- [x] Pre-submit HTTP action detection
- [x] Pre-submit form action domain mismatch check
- [x] Brand impersonation detection (Facebook, Google, Microsoft, Netflix, PayPal)

### Download Protection
- [x] Download interception
- [x] URL + content scan pipeline
- [x] Macro detection in Office files

### Email Protection (Gmail / Outlook)
- [x] Phishing email body scan
- [x] Attachment filename risk scoring
- [x] Targeted MutationObserver (not full document.body)

### Reliability
- [x] Offline mode (stale cache fallback)
- [x] Exponential backoff (30s → 60s → 120s → 300s)
- [x] Backend health tracking (isBackendOnline flag)
- [x] Graceful degradation (partial failure doesn't kill scan)
- [x] Per-tab AbortController (no stale responses)

### Security
- [x] DEBUG_MODE = false (no production console leaks)
- [x] Response validation (_validateScanResponse)
- [x] HTML sanitization in popup (XSS prevention)
- [x] Device ID for API auth (no hardcoded email)
- [x] HTTPS enforced for all API calls

### UX
- [x] Floating widget with real-time risk score
- [x] Warning modal with explain + allow/block
- [x] Download decision modal
- [x] Right-click scan result modal
- [x] Popup with live scan age countdown
- [x] Context menu (scan link, page, image, text)

---

## Testing Checklist

### Performance Tests
- [ ] Navigate between 10 tabs rapidly — verify no stale API responses
- [ ] Hover same link 10x — verify Network tab shows only 1 API call
- [ ] Kill backend → navigate to new site → verify no 6s freeze
- [ ] Browse on Gmail for 5 min — verify CPU stays low

### Security Tests
- [ ] Submit form on HTTP site → credential warning fires
- [ ] Submit form with action pointing to different domain → credential warning fires
- [ ] Navigate to known phishing URL → danger notification appears
- [ ] Copy phishing URL to clipboard → clipboard warning fires

### Reliability Tests
- [ ] Turn off backend → browse for 1 min → turn on → events sync automatically
- [ ] Navigate SPA (Gmail threads) → widget updates correctly
- [ ] Dynamic phishing form injection test (devtools console: `document.body.innerHTML += '<form><input type="password"></form>'`)

---

## Security Checklist

- [x] No user browsing history sent to backend
- [x] No page HTML content sent to backend
- [x] No cookies or cookie values sent
- [x] Only structured features (metadata) sent
- [x] XAI payload is compact evidence, not raw HTML
- [x] Telemetry is anonymized (device_id only, no PII)
- [x] All backend responses validated before use
- [x] All innerHTML injection uses sanitized strings

---

## Future Work (Post-Stabilization)

See `DB_FUTURE_CHANGES.md` for planned schema additions.

Possible extension enhancements (not yet scheduled):
- WebSocket live push from dashboard to extension
- PDF scanning pipeline
- Manager escalation workflow in popup
- Multi-org support
