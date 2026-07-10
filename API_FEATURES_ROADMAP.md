# AegisOne: API, Features, and Deployment Roadmap

This document serves as the absolute functional reference and API specification for **AegisOne**. It is structured to provide high-context guidance for AI code generation models (such as GPT-4) to implement the system backend and integrations.

---

## 0. Browser Security Agent Target

The extension should be treated as a core browser security module rather than a passive helper. The intended runtime model is:

```text
Browser event
  -> lightweight local rule check
  -> cached reputation lookup
  -> feature extraction only when needed
  -> backend AI scoring
  -> risk engine + policy decision
  -> UI warning, block, or allow
```

### 0.1. Modules Requested in the Spec

| Module | Target Behavior | Current Repo Status |
| --- | --- | --- |
| Search result protection | Badge each result with risk score before click | Already partially implemented in the extension |
| Navigation-time scan | Scan once on navigation, then warn/allow | Already implemented in the service worker + content script |
| Page inspection | Extract URL, title, text, forms, scripts, iframes, redirects | Already implemented in content scripts |
| Fake login detection | Detect brand impersonation and credential harvesting forms | Already implemented in form guard logic |
| Image protection | Logo, QR, and OCR-based image analysis | Partially implemented in backend; QR/logo workflow still needs build-out |
| Hover protection | Show reputation, risk, redirect info on hover | Already implemented in link scanner |
| Download protection | Scan before file lands on disk | Already implemented in download guard |
| Clipboard protection | Scan copied or pasted URLs | Already implemented in content script + service worker |
| Form submission protection | Block risky credential submissions | Already implemented in form guard |
| Cookie inspection | Metadata-only cookie policy analysis | Still needs to be built |
| JavaScript inspection | Flag obfuscation, eval, redirects, hidden iframes | Partially implemented; needs structured extraction and scoring |
| Local risk cache | Reuse recent verdicts for speed | Already implemented in cache layer |
| Enterprise policies | Allowed, blocked, and warning domains | Needs policy UI and enforcement expansion |
| User reporting | One-click report to SOC dashboard | Needs end-to-end workflow polish |

### 0.2. Build Priorities

1. Keep the client lightweight: no full-page uploads, no continuous screenshot streaming, and no raw cookies or credentials in transit.
2. Push all non-trivial analysis to the server: URL, text, image, OCR, attachment, and risk aggregation remain backend responsibilities.
3. Normalize every client signal through the same tab cache and risk engine so popup, modal, and dashboard views stay consistent.
4. Add the advanced protections in this order: login detection, download blocking, hover protection, image/OCR, QR decoding, then cookie/JS inspection.

---

## 1. System Deployment Architecture: In-House & SaaS

AegisOne is engineered as a privacy-first B2B security platform. Organizations can choose between a fully on-premise self-hosted deployment or a managed SaaS tier.

### 1.1. On-Premise / In-House Architecture
To maintain absolute confidentiality, organizations deploy the entire AegisOne stack locally inside their security perimeter:
* **Database Isolation**: A dedicated PostgreSQL instance is containerized locally. Employee data, scan history, and system audit logs never leave the enterprise intranet.
* **Local Inference Nodes**: PyTorch model servers run inside the company's internal virtualization cluster or private cloud (e.g., AWS VPC or local GPU workstations).
* **Local Cache**: Redis caches whitelisted assets and known safe hashes inside the private network.
* **Server-to-Server API Connections**: Intranet applications (such as mail servers or internal directories) query the API gateway via secure server-to-server HTTP channels using API Key tokens.

### 1.2. SaaS / Multi-Tenant Managed Tier
For organizations using the managed AegisOne cloud, data isolation is enforced logically:
* **Schema-per-Tenant Separation**: PostgreSQL handles multiple client nodes via schema names or strict column filter scopes.
* **Telemetry Anonymization**: Client metadata (e.g., total scan counts, incident resolution times) is synced, but raw scan content (e.g., scanned email body text, URL strings containing session IDs) is hashed or discarded at the gateway level.

```
+-------------------------------------------------------------------------+
|                         ORGANIZATION BOUNDARY                           |
|                                                                         |
|  [Employee Laptop]                                                      |
|   ├── Chrome Extension  ────► Scan Request ────┐                        |
|   └── Outlook/Gmail Add-in                    │                        |
|                                                ▼                        |
|  [Internal Core Server]                [FastAPI Gateway]                |
|   ├── Local Redis Cache  ◄───────────► - JWT Auth                       |
|   │   (Whitelists)                     - Rate Limiter                   |
|   │                                    - Orchestrator ────┐             |
|   └── Tenant PostgreSQL ◄── Celery Worker                 │             |
|       (Private DB)                                        ▼             |
|                                                   [AI Inference]        |
|                                                    - Email (DistilBERT) |
|                                                    - Visual (EffNet-B3) |
|                                                    - URL (BERT)         |
+-------------------------------------------------------------------------+
                                                            │
                                                            │ (Metrics Only)
                                                            ▼
                                                    [Global Panel]
                                                    - Anonymized stats
                                                    - Model accuracy logs
                                                    - Org support tickets
```

---

## 2. Access Control & Strict Privacy Boundaries

AegisOne operates under a strict, non-transparent privacy structure designed to build corporate trust:

1. **Employee Tier (Tier 3)**:
   * Access: Personal scans only.
   * Privacy: Can view their own flagged URLs, reported emails, and safety trends.
2. **Supervisor Tier (Tier 2)**:
   * Access: Team metrics (e.g., overall department risk index, active warning rates, Chrome extension runtime status).
   * Privacy: **Non-Transparent**. Supervisors see *that* a threat was blocked on a team member's workstation, but *cannot* inspect the raw email text, URL query strings, or screenshot assets to protect employee privacy.
3. **Super Admin Tier (Tier 1)**:
   * Access: Company-wide totals, configuration thresholds, whitelist definitions, and account rosters.
   * Privacy: High-level aggregated statistics. Raw content details are masked.
4. **Developer / Platform Head Tier (Tier 0)**:
   * Access: Global analytics dashboards showing overall load (e.g., "1,000,000 URLs scanned platform-wide, 99.4% model inference accuracy").
   * Privacy: **Zero visibility** into tenant names, employee profiles, or scanned content.
   * Communications: Support portals allow tenant admins to report issues or open support threads without sending private telemetry.

---

## 3. Client System Protection Flows

AegisOne intercepts threats across multiple endpoint vectors:

### 3.1. Chrome Extension (Manifest V3)
* **Real-time DOM & Link Shielding**: Hooks all URL clicks and dynamically scans target links before resolving the navigation.
* **Active Visual Analysis**: If the user remains active on a newly loaded page for more than 2 seconds, the extension grabs a visible viewport screenshot via `chrome.tabs.captureVisibleTab` and submits the base64-encoded image to the local backend.
* **Phishing Block Overlays**: If the threat probability returned by the models exceeds the organizational threshold (default: $0.85$), the extension interrupts DOM execution and injects a full-screen crimson alert blocking access.

### 3.2. Desktop Application Agent (Optional Endpoint Agent)
* **Visual Frame Analysis**: Periodically analyzes open browser windows outside Chrome (e.g., Edge, Firefox, internal banking systems) by capturing window handles.
* **Local Proxy Interception**: Intercepts local loopback network calls to capture raw HTTP requests, providing system-wide protection.

### 3.3. Enterprise Mail Add-ins (Gmail & Outlook)
* **Gmail Add-on (Google Apps Script)**: Triggers when an email is opened. Pre-filters structural flags (e.g., domain age, SPF/DKIM flags) and sends the parsed headers/body text to the FastAPI backend.
* **Outlook Add-in (Office JS)**: Launches a contextual taskpane. Directs attachments (PDFs, compressed files) to the backend for content extraction.

---

## 4. API Endpoints & Request/Response Routing Specs

This section serves as a direct code generation specification for FastAPI developers.

### 4.1. Authentication Router
#### `POST /api/v1/auth/login`
Authenticates users and returns signed JWT access tokens.
* **Request Payload**:
  ```json
  {
    "email": "user@ubank.com.pk",
    "password": "SecurePassword123"
  }
  ```
* **Response Payload (Success - 200 OK)**:
  ```json
  {
    "access_token": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...",
    "token_type": "bearer",
    "user": {
      "id": "usr-882",
      "fullName": "Ahmed Raza",
      "email": "user@ubank.com.pk",
      "role": "employee",
      "organization": "org-ubank",
      "department": "Cyber Security"
    }
  }
  ```

---

### 4.2. Scanning Orchestrator Router
#### `POST /api/v1/scan/full`
Performs parallel execution of URL, Text, and Visual models using `asyncio.gather`.
* **Request Payload**:
  ```json
  {
    "scanType": "full",
    "url": "https://secure-login-ubank.net/verify",
    "email": {
      "sender": "accounts-verification@secure-login-ubank.net",
      "subject": "Urgent Action Required: Verify Account details",
      "body": "Dear customer, your card is suspended. Click here to verify: https://secure-login-ubank.net/verify"
    },
    "image": "data:image/png;base64,iVBORw0KGgoAAAANS..."
  }
  ```
* **Response Payload (Success - 200 OK)**:
  ```json
  {
    "scanId": "scn-9912019",
    "riskScore": 0.9450,
    "verdict": "phishing",
    "details": {
      "urlModel": {
        "prediction": "malicious",
        "probability": 0.9820,
        "category": "phishing"
      },
      "emailModel": {
        "prediction": "phishing",
        "probability": 0.9120,
        "xaiExplanation": "Flagged suspicious terms: verify, urgent, suspended"
      },
      "imageModel": {
        "prediction": "phishing",
        "probability": 0.9410,
        "featuresDetected": ["login_form", "ubank_logo_clone"]
      }
    },
    "timestamp": "2026-06-24T17:30:00Z"
  }
  ```

---

### 4.3. Telemetry & Incident Ingestion Router
#### `POST /api/v1/telemetry/log`
Non-blocking endpoint to ingest client-side scan logs and raise incidents when thresholds are crossed.
* **Request Payload**:
  ```json
  {
    "scanId": "scn-9912019",
    "employeeId": "usr-882",
    "organizationId": "org-ubank",
    "scanType": "url",
    "verdict": "phishing",
    "probability": 0.9820,
    "source": "extension",
    "details": "User blocked from visiting secure-login-ubank.net"
  }
  ```
* **Response Payload (202 Accepted)**:
  ```json
  {
    "status": "queued",
    "taskId": "task-abc123xyz"
  }
  ```

---

### 4.4. Support & Ticket Ingestion Router
#### `POST /api/v1/support/report`
Enables Organizations to communicate issues directly to the Developer Operations control center without revealing internal credentials.
* **Request Payload**:
  ```json
  {
    "organizationId": "org-ubank",
    "category": "model_false_positive",
    "title": "False positive on internal domain",
    "description": "Our safe internal portal portal.ubank.local was flagged as phishing by the URL classifier.",
    "payloadSample": "https://portal.ubank.local/auth"
  }
  ```
* **Response Payload (201 Created)**:
  ```json
  {
    "ticketId": "tkt-00129",
    "status": "submitted",
    "message": "Report logged. Platform head notified."
  }
  ```

---

## 5. Model Improvement: Secure Data Donation Protocol

Improving deep learning models requires access to real-world edge cases. Because organizations cannot share raw emails or screens due to privacy constraints, AegisOne establishes a **Secure Data Donation Protocol**:

```
[Employee Workstation]
  ├── Flags Phishing Attempt
  └── Data Donation Triggered
        ▼
[Local Sanitization Engine]
  ├── Hash URL Query Strings (Keep domain & path structure only)
  ├── Extract Key NLP Tokens (Strip PII, names, card numbers, accounts)
  ├── Redact Text in Visual Screenshots (Optical Character Recognition)
  └── Diffuse Image Features (Generate low-res layout templates)
        ▼
[Organization Admin Review Queue]
  └── Admin approves "Anonymous Telemetry Package"
        ▼
[AegisOne Central Brain Portal]
  └── Models retrained securely using anonymized telemetry packages
```

### 5.1. The Anonymized Data Structure
When a false positive or new threat sample is donated, the payload is sanitized locally before transmission:
* **Email Sanitization**: Names, phone numbers, account balances, and credit card numbers are replaced with `<REDACTED_PII>` using local regex masks and Named Entity Recognition (NER) models prior to shipping.
* **URL Sanitization**: Query parameters are removed entirely. `https://phish-site.com/verify?user=ahmed&token=928a` is converted to `https://phish-site.com/verify`.
* **Screenshot Sanitization**: An OCR layer runs locally to identify textual blocks on the image, blacking out text elements while preserving the layout geometry (input boxes, logos, grid structural layouts) necessary to retrain the EfficientNet-B3 model.

---

## 6. One-Month Execution Roadmap (3-Member Team)

The 4-week execution cycle focuses on transition from static mocks to a dynamic SaaS and self-hosted model.

```
+---------------------------------------------------------------------------------+
| Week 1: Core Database & Multi-Tenant API Setup                                  |
|   - M1: Provision multi-tenant PostgreSQL schemas & OAuth2 JWT authenticators.  |
|   - M2: Bind Next.js dynamic theme states & configure state context providers.   |
|   - M3: Scaffold FastAPI backend routers, rate-limiters, & Docker networks.     |
+---------------------------------------------------------------------------------+
                                       │
                                       ▼
+---------------------------------------------------------------------------------+
| Week 2: Browser Extension & Active Threat Interception                          |
|   - M1: Implement Redis whitelists & batch scan processors.                     |
|   - M2: Build Chrome Extension (Manifest V3) background workers & DOM block.    |
|   - M3: Set up Celery asynchronous worker channels & telemetry brokers.         |
+---------------------------------------------------------------------------------+
                                       │
                                       ▼
+---------------------------------------------------------------------------------+
| Week 3: Mail Integration & Pipeline Tuning                                      |
|   - M1: Optimize model weights & wrap PyTorch models in ONNX container runtimes.|
|   - M2: Develop Gmail Add-on and Outlook React Taskpanes.                       |
|   - M3: Wire email endpoints & write background payload parsers.                |
+---------------------------------------------------------------------------------+
                                       │
                                       ▼
+---------------------------------------------------------------------------------+
| Week 4: Cloud Infrastructure & Secure Data Donation                             |
|   - M1: Write local database setup scripts & implement data donation pipeline.  |
|   - M2: Complete UI audits, check responsiveness, & configure proxy routes.    |
|   - M3: Deploy to cloud environments (RDS, AWS EC2), configure SSL/HTTPS.       |
+---------------------------------------------------------------------------------+
```

### 6.1. Work Breakdown Structure (WBS)

#### Week 1: Core Database & Multi-Tenant API Setup
* **M1 (Backend & AI Architect)**:
  * Deploy the database schema to handle tenant isolation (schema-per-tenant architecture).
  * Build the user registration and authorization routes using OAuth2 with JWT validation.
* **M2 (Frontend & Extension Lead)**:
  * Wire the Next.js frontend state to interact with the API endpoints.
  * Connect the dashboard to dynamic light/dark theme CSS variables.
* **M3 (DevOps & Integrations)**:
  * Build the FastAPI boilerplates, routing frameworks, and error handler blocks.
  * Configure Docker Compose networks linking the database, Redis cache, and FastAPI.

#### Week 2: Browser Extension & Active Threat Interception
* **M1 (Backend & AI Architect)**:
  * Configure Redis to cache whitelisted domains and pre-evaluated URL hashes.
  * Construct API endpoints for bulk URL parsing.
* **M2 (Frontend & Extension Lead)**:
  * Build the Manifest V3 browser extension popup, options page, and background scripts.
  * Implement Content Scripts to monitor URL navigation and inject warning screen overlays.
* **M3 (DevOps & Integrations)**:
  * Setup Celery and Redis message brokers to handle asynchronously queued telemetry calls.
  * Implement logging systems using Sentry to capture extension client errors.

#### Week 3: Mail Integration & Pipeline Tuning
* **M1 (Backend & AI Architect)**:
  * Optimize model inference latency by compiling the PyTorch classifiers to ONNX runtimes.
  * Finalize attachment analysis scripts for extraction of links from PDF/Docx payloads.
* **M2 (Frontend & Extension Lead)**:
  * Build the Google Apps Script framework for Gmail Add-ons.
  * Build the Office JS React interface for Outlook Taskpanes.
* **M3 (DevOps & Integrations)**:
  * Setup secure OAuth2 workflows for Gmail/Outlook authorizations.
  * Create email parser APIs to extract headers, body texts, and links.

#### Week 4: Cloud Infrastructure & Secure Data Donation
* **M1 (Backend & AI Architect)**:
  * Build SQL setup scripts to automate private organization server installations.
  * Write the local PII sanitization regex and OCR anonymization pipeline.
* **M2 (Frontend & Extension Lead)**:
  * Conduct cross-browser user-experience tests.
  * Connect dashboard reporting tickets directly to the developer operations command.
* **M3 (DevOps & Integrations)**:
  * Deploy the unified gateway, database instances, and task queues to cloud clusters (AWS/GCP).
  * Configure SSL, domain maps, and Nginx reverse proxies.
