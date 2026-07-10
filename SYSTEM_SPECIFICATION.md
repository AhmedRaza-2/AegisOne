# AegisOne Browser Security Agent - System Specification

This document defines the target system architecture for the browser security extension and its backend services. It is written as an implementation spec for AI coding tools and engineering work.

The repository currently uses a FastAPI backend and a Manifest V3 browser extension. Where this spec describes future target choices such as TypeScript or React for the extension, those are the intended implementation direction, not necessarily the current state of every file.

---

## 1. Project Goal

Build an enterprise browser security agent that protects users from phishing, credential theft, malicious downloads, and deceptive web content while keeping the client lightweight.

### Core Principles

1. The extension performs only lightweight local checks and feature extraction.
2. All AI inference runs on backend services.
3. The system syncs only security events, not raw browsing history.
4. The user must get a fast, explainable decision at the point of risk.
5. Scans must be cached aggressively to avoid repeat network and CPU cost.

---

## 2. System Architecture

```text
Browser Event
  -> Local Cache / Policy Check
  -> Lightweight Feature Extraction
  -> Backend API Gateway
  -> AI Models + Risk Engine
  -> Decision + Explanation
  -> UI Warning / Allow / Block
  -> Security Event Sync to Dashboard / SIEM
```

### Components

#### 2.1 Browser Extension

Responsibilities:

- Search result badges
- Navigation-time URL scanning
- Page feature extraction
- Hover-link inspection
- Form submission protection
- Download interception
- Clipboard URL scanning
- Manual scan actions
- User reporting and explainability UI

Implementation target:

- Manifest V3
- TypeScript preferred for new work
- React preferred for popup and richer UI surfaces
- Minimal runtime footprint in content scripts

#### 2.2 Backend API Gateway

Responsibilities:

- Authentication and organization policy enforcement
- Scan orchestration
- Model routing
- Risk aggregation
- Event persistence
- XAI generation
- Threat intelligence ingestion

Current repo direction:

- FastAPI
- SQLAlchemy ORM
- JWT-based auth
- Redis cache
- async request handling

#### 2.3 AI Services

Model families:

- URL intelligence
- Visible text / page content
- Image / OCR / QR analysis
- Attachment analysis
- XAI explanation generation

These services must remain server-side and should not require the extension to ship model weights.

#### 2.4 Storage and Sync

- PostgreSQL for normalized security data
- Redis for cache and short-lived state
- Dashboard for analyst and admin views
- Optional SIEM / webhook export for enterprise integrations

---

## 3. Functional Modules

### 3.1 Authentication and Organization Management

Purpose:

Authenticate a user, bind the extension to an organization, and register the browser device.

Required features:

- Login
- JWT access and refresh tokens
- Organization verification
- Device registration
- Device heartbeat / last seen updates

Data model:

- `organizations`
- `users`
- `devices`

### 3.2 Search Result Risk Scoring

Purpose:

Show risk scores beside search results before the user clicks.

Supported search engines:

- Google
- Bing
- DuckDuckGo
- Yahoo

Runtime behavior:

- Collect visible result URLs only
- Check local cache first
- Send only unknown URLs to the backend
- Render a color-coded badge per result

Data model:

- `search_scans`

### 3.3 Website Scan

Purpose:

Perform a navigation-time scan when a page starts loading or completes loading.

Runtime behavior:

- Extract URL and lightweight page features
- Run quick local policy checks first
- Send a scan request to the backend only when needed
- Return allow, warn, or block

Data model:

- `website_scans`

### 3.4 URL Intelligence

Purpose:

Analyze the URL itself for reputation and structural indicators.

Checks:

- Domain age
- SSL/TLS state
- WHOIS signals
- Redirect chain
- Typosquatting patterns
- Reputation and blacklist lookups

Data model:

- `url_analysis`

### 3.5 Webpage Content Analysis

Purpose:

Analyze HTML-derived features and visible text.

Checks:

- Page title
- Visible text
- Login forms
- Password fields
- Urgency language
- Phishing keywords
- Suspicious button labels

Data model:

- `content_analysis`

### 3.6 Image Analysis

Purpose:

Analyze selected images, logos, QR codes, and OCR text.

Checks:

- Logo or brand detection
- OCR text extraction
- QR decoding
- Suspicious graphics or impersonation markers

Data model:

- `image_analysis`

### 3.7 JavaScript Analysis

Purpose:

Identify malicious or deceptive script behavior.

Checks:

- `eval()`
- Obfuscated strings
- Hidden redirects
- Clipboard abuse
- Crypto-mining signals
- Hidden iframes

Data model:

- `script_analysis`

### 3.8 Cookie Analysis

Purpose:

Inspect cookie metadata only.

Checks:

- Third-party cookie use
- `Secure` flag
- `HttpOnly` flag
- Suspicious domain patterns

Privacy rule:

- Do not transmit or store cookie values unless a forensic workflow explicitly requires it.

Data model:

- `cookie_analysis`

### 3.9 Credential Protection

Purpose:

Stop credential theft before form submission.

Checks:

- Email fields
- Password fields
- OTP / verification prompts
- Bank PIN / financial credential patterns
- Brand impersonation signals

Data model:

- `credential_events`

### 3.10 Download Protection

Purpose:

Inspect downloads before they land on disk.

Checks:

- File extension
- File hash
- Attachment AI
- Malware and heuristic signals

Data model:

- `download_events`

### 3.11 Link Hover Analysis

Purpose:

Reveal the destination risk before the click happens.

Checks:

- Destination domain
- Reputation
- Redirect count
- Cached score

Data model:

- `hover_scans`

### 3.12 Explainable AI

Purpose:

Generate a human-readable explanation only when the user explicitly asks for it.

Workflow:

```text
User requests explanation
  -> compact evidence payload
  -> LLM explanation
  -> human-readable summary
```

Data model:

- `xai_reports`

### 3.13 Manual AI Scan

Purpose:

Allow the user to manually scan a selected text, image, link, or full page.

Data model:

- `manual_scans`

### 3.14 Dashboard Sync

Purpose:

Sync security events to the dashboard and enterprise telemetry layers.

Privacy rule:

- Never send raw browsing history.
- Send only security events and extracted features.

Data model:

- `security_events`

### 3.15 Threat Reporting

Purpose:

Let users report suspicious websites to the SOC or admin team.

Data model:

- `threat_reports`

### 3.16 Organization Policies

Purpose:

Allow per-organization allow, warn, and block rules.

Data model:

- `policies`

### 3.17 Local Cache

Purpose:

Avoid rescanning already known domains or URLs.

Storage:

- Extension storage or browser storage
- Redis on the backend for shared server-side caching

### 3.18 Threat Intelligence

Purpose:

Persist newly observed malicious domains and enrich future detections.

Data model:

- `threat_intelligence`

### 3.19 Audit Logs

Purpose:

Track all major security and admin actions.

Data model:

- `audit_logs`

---

## 4. Browser Extension Runtime Behavior

### 4.1 Search Page Flow

```text
Search page loads
  -> extract visible results
  -> check cache
  -> send only unknown URLs to backend
  -> render risk badge per result
  -> allow click to open XAI if needed
```

### 4.2 Navigation Flow

```text
User clicks link
  -> quick local check
  -> backend URL scan
  -> if safe, continue
  -> if suspicious, show warning page
  -> user can go back or continue
```

### 4.3 Page Inspection Flow

Collect only lightweight features:

- URL
- Page title
- Meta tags
- Visible text snippets
- Login forms
- Buttons
- Scripts metadata
- External domains
- iFrame count
- Redirect hints

Never upload full pages by default.

### 4.4 Download Flow

```text
download event
  -> cancel or pause early
  -> scan metadata and content
  -> block or allow
  -> re-download only if approved and safe
```

### 4.5 Clipboard Flow

Scan copied or pasted URLs only when the text looks like a URL.

### 4.6 Manual Actions

The extension must support manual scan actions for:

- selected text
- a link
- an image
- the current page

---

## 5. Data Model

The recommended design is a single normalized PostgreSQL database rather than a separate database per module.

### 5.1 Core Tables

- `organizations`
- `users`
- `devices`
- `website_scans`
- `search_scans`
- `url_analysis`
- `content_analysis`
- `image_analysis`
- `script_analysis`
- `cookie_analysis`
- `credential_events`
- `download_events`
- `hover_scans`
- `manual_scans`
- `xai_reports`
- `security_events`
- `threat_reports`
- `policies`
- `threat_intelligence`
- `audit_logs`

### 5.2 Relationship Rules

- Each analysis table should reference a parent scan row where relevant.
- `security_events` should store the final synthesized event, not every raw intermediate artifact.
- Repeated scans should reuse the same domain and URL records where possible.

### 5.3 Retention Strategy

- Keep only security events by default.
- Do not store raw HTML, scripts, cookies, or images unless forensic mode is enabled.
- Archive older events after a configurable retention period.
- Use indexed queries and pagination in the dashboard.

---

## 6. Risk Engine Contract

The backend should combine signals from multiple modules into a single decision.

### Inputs

- URL model score
- Text model score
- Image model score
- Attachment model score
- Form heuristics
- Script heuristics
- Cookie metadata
- Policy matches
- Cache state

### Outputs

- `score`
- `verdict`
- `threat_type`
- `breakdown`
- `top_factors`
- `recommended_action`

### Decision Levels

- Safe
- Warning
- Danger / Block

The score must remain explainable and consistent across popup, content script, and dashboard views.

---

## 7. API Layer

The backend API should expose endpoints for:

- authentication
- device registration
- URL scan
- text scan
- image scan
- attachment scan
- manual page scan
- hover scan
- search batch scan
- download scan
- credential interception
- report submission
- XAI explanation
- policy retrieval
- event retrieval

The exact routing can remain FastAPI-specific in this repository, but the contract should stay stable for the extension.

---

## 8. Security and Privacy Requirements

1. Use TLS for all communication.
2. Use short-lived access tokens and refresh tokens.
3. Never upload passwords, cookies, or full browsing history.
4. Prefer feature extraction over raw content transfer.
5. Separate tenant data cleanly.
6. Log security decisions, not user content, unless forensic mode is explicitly enabled.
7. Cache safe or known outcomes to reduce repeated network calls.

---

## 9. Performance Requirements

1. The extension must stay responsive under normal browsing.
2. Avoid continuous scanning loops.
3. Deduplicate scans for the same URL and page state.
4. Skip expensive work when cached data is still fresh.
5. Batch search result scans and hover scans where possible.
6. Keep background state merges consistent so popup and modal views agree.

---

## 10. Recommended Implementation Order

### Phase 1

- Authentication and device registration
- URL scanning
- Search result badges
- Navigation-time warnings
- Dashboard event sync

### Phase 2

- Login form detection
- Download protection
- Hover risk inspection
- Policy enforcement

### Phase 3

- Image analysis
- OCR and QR handling
- JavaScript inspection
- Cookie metadata analysis

### Phase 4

- Threat intelligence sharing
- Advanced XAI workflows
- Enterprise SIEM integration
- Multi-tenant management at scale

---

## 11. Implementation Note for AI Coding Tools

When generating code from this specification:

- Prefer small, isolated modules.
- Keep extension work lightweight.
- Reuse a shared scan state and cache contract across UI surfaces.
- Do not add duplicate logic in popup, content script, and service worker.
- Treat the backend as the source of truth for final risk scoring.
