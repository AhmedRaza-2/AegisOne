# 🛡️ AegisOne — Enterprise Unified Threat Management (UTM)
## Comprehensive Architecture & Technical Blueprint

---

## 📌 1. Project Overview & Core Goals

### **What is AegisOne?**
**AegisOne** is a Next-Generation Hybrid Enterprise Security & Unified Threat Management (UTM) Platform. It provides real-time, zero-latency protection against zero-day phishing, credential theft, malicious file attachments, and typosquatting domain attacks across web browsers, email clients, messaging platforms, and corporate networks.

### **The Core Problem AegisOne Solves**
1. **The Cloud Privacy Dilemma**: Enterprise organizations cannot send sensitive internal emails, employee credentials, or proprietary attachments to public third-party cloud APIs (like OpenAI or VirusTotal) due to compliance regulations (GDPR, HIPAA, SOC2).
2. **Sub-Second Latency Requirement**: Traditional dynamic sandboxes take 2–5 minutes to analyze attachments, blocking corporate workflows. AegisOne inspects files and web requests in **< 30 milliseconds**.
3. **Zero-Day Attack Resiliency**: Static blacklists fail against new domain names registered minutes before an attack. AegisOne leverages **Deep Learning (DistilBERT + LoRA)** and **Character-Level CNN/Bi-LSTM Models** to detect attacks based on intent and structural behavior rather than rigid keyword lists.

---

## 🏗️ 2. High-Level System Architecture

AegisOne is engineered around a **Hybrid Air-Gapped Architecture**, decoupling the public registration and licensing cloud from the private, on-premise security execution engine.

```
┌──────────────────────────────────────────────────────────────────────────────────────────────────┐
│                                   STAGE 1: PUBLIC CLOUD PORTAL                                   │
│                               (Vercel + Supabase Authentication)                                 │
│  - Super Admin Registration                                                                     │
│  - License Key & Deployment Token Provisioning                                                    │
│  - Automated 1-Click Installation Script Generation (PowerShell / Bash)                         │
└────────────────────────────────────────────────┬─────────────────────────────────────────────────┘
                                                 │ 1-Click Script Execution
                                                 ▼
┌──────────────────────────────────────────────────────────────────────────────────────────────────┐
│                               STAGE 2: ON-PREMISE ENTERPRISE SERVER                              │
│                                  (Private Office Network / Docker)                               │
│                                                                                                  │
│  ┌───────────────────────────────┐     ┌──────────────────────────────────────────────────────┐  │
│  │   PostgreSQL Local Database   │ ◄───┤        Unified FastAPI Server (Port 8000)             │  │
│  │ (Telemetry, Auth, Audit Logs) │     │ (Orchestrator, JWT Handler, Local Model Inference)   │  │
│  └───────────────────────────────┘     └──────────────────────────▲───────────────────────────┘  │
│                                                                   │                              │
│  ┌───────────────────────────────┐                                │ REST API Scan Requests       │
│  │ Next.js Admin Setup Dashboard │ ───────────────────────────────┘ (Port 8000)                  │
│  │         (Port 3002)           │                                                               │
│  └───────────────────────────────┘                                                               │
└────────────────────────────────────────────────▲─────────────────────────────────────────────────┘
                                                 │ Local Host Network (HTTP/REST)
                                                 ▼
┌──────────────────────────────────────────────────────────────────────────────────────────────────┐
│                                 STAGE 3: CLIENT ENDPOINT PROTECTION                              │
│                                 (AegisOne Cross-Browser Extension)                              │
│  - Form Guard (Credential Interception & Phishing Form Warning)                                  │
│  - Download Guard (Attachment Malware & Double-Extension Interception)                           │
│  - Webmail & Messaging Scanner (Real-Time DOM Email & WhatsApp Threat Banner)                    │
└──────────────────────────────────────────────────────────────────────────────────────────────────┘
```

---

## 🔄 3. Complete End-to-End User & Data Flow

### **Phase 1: Organization Onboarding (Public Cloud)**
1. **Registration**: The Super Admin registers their enterprise organization on the AegisOne Public Portal hosted on Vercel.
2. **Cloud Database Provisioning**: Supabase generates a unique `ORG_ID`, `LICENSE_KEY`, and `DEPLOYMENT_TOKEN`.
3. **1-Click Script Generation**: The portal bakes these tokens into an automated PowerShell/Bash command:
   ```powershell
   mkdir AegisOne; Set-Location AegisOne; 
   Invoke-WebRequest -Uri "https://raw.../docker-compose.prod.yml" -OutFile "docker-compose.yml"; 
   $env:SERVER_HOST=(Get-NetIPAddress ...); $env:ORG_ID="RGS564"; $env:LICENSE_KEY="..."; 
   docker compose pull; docker compose up -d
   ```

### **Phase 2: Local Server Boot & Self-Healing Handshake**
1. **Script Execution**: The Admin pastes the 1-click script onto their local office server.
2. **Docker Orchestration**: Docker pulls pre-built containers (`aegisone-backend`, `aegisone-dashboard`, `aegisone-db`) and injects the environment variables.
3. **Local DB Initialization**: The local PostgreSQL database boots, creates schemas (`users`, `departments`, `security_events`), and seeds the organization profile.
4. **Auto-Login & Token Injection**: Clicking *"Start Setup Engine Now"* opens `http://<SERVER_HOST>:3002/dashboard/admin/setup?fromLanding=true`. The dashboard extracts credentials from URL params, calls `/auth/send-admin-credentials` to provision the admin user in the local DB, executes `/auth/login`, and stores JWT access tokens in `localStorage` and browser cookies.

### **Phase 3: Employee Onboarding & Extension Rollout**
1. **5-Step Setup Wizard**: The Admin imports department structures and employee rosters via CSV or bulk input.
2. **SMTP Verification**: The Admin tests their enterprise mail server credentials via `/setup/smtp/test`.
3. **Background Dispatch**: Clicking *"Execute Setup"* creates hashed employee accounts in local DB and dispatches welcome emails with auto-generated temporary passwords.
4. **Pre-Configured Extension Download**: Employees download the extension package from `http://<SERVER_HOST>:8000/public/download/extension`. The zip dynamically injects a `config.json` file pre-bound to `http://<SERVER_HOST>:8000`.

### **Phase 4: Real-Time Threat Interception & Local AI Analysis**
1. **DOM Monitoring**: As employees browse the web, open Gmail, or receive WhatsApp messages, the extension monitors DOM changes.
2. **Threat Inspection Payload**: The extension sends background REST requests to the local backend:
   - `POST /public/scan/email`
   - `POST /public/scan/url`
   - `POST /public/scan/attachment`
3. **Local AI Model Forward Pass**: The backend processes payloads through the 4 specialized AI models in **< 30ms**.
4. **Action & Visualization**:
   - **Clean**: Request continues silently.
   - **Malicious**: Extension injects a non-blocking red security alert banner in the user's browser, while the backend logs a `SecurityEvent` to local PostgreSQL for admin analytics.

---

## 🧩 4. Detailed Component Breakdown

### **Part A: Public Cloud Portal (`frontend/landing/`)**
* **Framework**: React + Vite + TailwindCSS (Deployed on Vercel).
* **Database**: Supabase PostgreSQL for enterprise licensing, account authentication, and portal access.
* **Role**: Serves as the public-facing marketing, documentation, and automated deployment script generation hub.

### **Part B: On-Premise Enterprise Core (`api/` & `docker-compose.prod.yml`)**
* **Framework**: FastAPI (Python 3.11) + SQLAlchemy (Asyncio) + PostgreSQL 16.
* **Security & Auth**: JWT (JSON Web Tokens) with 30-day refresh tokens and Argon2/Bcrypt password hashing.
* **Deployment**: Fully containerized using Docker Compose for 1-click air-gapped deployment on Linux/Windows enterprise servers.

### **Part C: The 4 Specialized AI Threat Engines (`AIML/`)**

| Model Engine | Primary Architecture | Input Data | Target Detection Patterns |
| :--- | :--- | :--- | :--- |
| **1. Email Engine** | DistilBERT + LoRA + Bi-LSTM + 8-Head Attention Pool + Struct MLP | Subject, Body, Headers | Psychological urgency lures, sender-domain mismatches, anchor tag link spoofing. |
| **2. URL Engine** | Char-CNN/Bi-LSTM + XGBoost Meta-Classifier (`meta_classifier.pkl`) | Web URLs | Typosquatting, homoglyphs, DGA randomness (Shannon Entropy), suspicious TLDs. |
| **3. Text/SMS Engine** | DistilBERT-LoRA + Bi-LSTM + Short-Form Attention | SMS, WhatsApp, Popups | Smishing, fake delivery tracking, crypto/Zelle scams, shortened URLs (`bit.ly`). |
| **4. Attachment Engine** | Fitz PDF Parser + Oletools Macro Engine + Structural MLP | Files (`.pdf`, `.docx`, `.exe`) | OLE VBA macro streams (`AutoOpen`), PDF JS/Launch actions, Double-extension PE headers. |

#### **Why LoRA (Low-Rank Adaptation) is Used**:
* Freezes 99% of pre-trained DistilBERT transformer weights and attaches trainable rank matrices ($r=16, \alpha=32$) to `q_lin` and `v_lin` attention heads.
* Reduces trainable parameters from 66M down to < 1M (~1.3%), enabling **fast, privacy-preserving local fine-tuning on standard office CPUs** without expensive GPUs.

### **Part D: Browser Protection Suite (`Extension/`)**
* **Manifest**: Chrome Extension Manifest V3.
* **Modules**:
  1. `form-guard.js`: Intercepts HTML form submission events and flags unauthorized credential posting to untrusted domains.
  2. `download-guard.js`: Hooks `chrome.downloads` API to intercept incoming files, verify magic bytes, and block malicious payloads.
  3. `gmail-whatsapp-guard.js`: Monitors webmail and messaging DOMs to render real-time XAI threat badges.

### **Part E: Admin Setup Dashboard (`frontend/dashboard/`)**
* **Framework**: Next.js 14 (App Router) + TailwindCSS + Lucide Icons.
* **Features**: 5-Step Guided Onboarding Wizard, Live Enterprise Telemetry Charts, Employee Access Control Matrix, Local Continual AI Model Trainer Interface (`local_trainer.py`).

---

## 🎓 5. Summary for FYP Defense & Evaluation

> *"AegisOne implements a hybrid air-gapped architecture that pairs a public licensing portal with a high-performance, on-premise FastAPI backend. By combining DistilBERT-LoRA Transformers, Character-Level CNNs, XGBoost Meta-Classifiers, and static heuristic parsers, AegisOne delivers multi-modal threat inspection across emails, URLs, short messages, and attachments in under 30 milliseconds—all executed locally on private enterprise infrastructure without data leakage."*
