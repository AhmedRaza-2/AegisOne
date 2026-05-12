# 🛡️ Aegis-One: Final Year Project Roadmap & Execution Plan

This document outlines the remaining engineering phases for **Aegis-One**. With the core AI Research (Email, URL, and Image Models) now completed, we are moving from **Model Development** to **System Integration**.

---

## 📍 Current Status
- **📧 Email Detector**: Hybrid DistilBERT + Bi-LSTM (**COMPLETE**)
- **🔗 URL Detector**: Protocol-Neutral BERT + Numerical Fusion (**COMPLETE**)
- **🖼️ Image Detector**: EfficientNet-B3 + SE Attention (**COMPLETE**)

---

## 🚀 Phase 3: The Unified Backend (FastAPI Integration)
The goal is to create a single "Aegis-Brain" that communicates with all models simultaneously.

### 3.1. Centralized API Development
- **Framework**: FastAPI (Asynchronous Python).
- **Endpoint Structure**:
    - `POST /scan/url`: Analyzes URL string + pulls metadata.
    - `POST /scan/email`: Processes raw text content.
    - `POST /scan/image`: Receives screenshot/attachment for visual analysis.
    - `POST /scan/full`: The "Aegis-Scan" which runs all three in parallel.
- **Model Orchestration**: Use `asyncio.gather` to trigger all model inferences at once to keep latency under 100ms.

### 3.2. Explainable AI (XAI) Integration
- Create a "Highlighting" logic that returns not just a score, but the **Reasoning**.
- Mapping BERT attention weights to the most risky words in the UI.

---

## 📊 Phase 4: Database & User Management (Supabase)
We need to store the history and provide a way for users to track their safety.

- **Storage**: Supabase (PostgreSQL).
- **Tables**:
    - `users`: Auth and profile.
    - `scan_history`: Stores the URL/Email scanned, the Aegis Score, and the timestamp.
    - `threat_map`: A global log of detected phishing sites to help other Aegis users.
- **Integration**: Connect the FastAPI backend to Supabase using the Python SDK.

---

## 🎨 Phase 5: The "Elite" Frontend (React Dashboard)
A premium management portal for the user.

- **Tech Stack**: React + Tailwind CSS + Framer Motion (for smooth animations).
- **Features**:
    - **Live Risk Meter**: A dynamic gauge showing the current "Shield Status."
    - **Recent Threats**: A list of recently blocked sites/emails with "Why it was blocked."
    - **Report Phish**: A community-driven button to submit new threats.

---

## 🌐 Phase 6: The Browser Extension (Real-time Protection)
This is where the user actually interacts with Aegis-One.

- **Tech Stack**: Chrome Extension Manifest v3 + JavaScript.
- **Real-time Interception**:
    - **URL Scanning**: Every time a user clicks a link, the extension sends the URL to our `POST /scan/url` endpoint.
    - **Visual Check**: If the user stays on a page for >2 seconds, the extension captures a `captureVisibleTab` screenshot and sends it to `POST /scan/image`.
    - **Alert Overlay**: If phishing is detected, the extension "Red-Outs" the screen with a "WARNING: AEGIS-ONE DETECTED A THREAT" message.

---

## ☁️ Phase 7: Deployment & Optimization (The "Final Boss")
- **Containerization**: Wrap the FastAPI app, models, and dependencies into a **Docker Image**.
- **Quantization**: Convert the PyTorch models (.pt) to **ONNX** or **TensorRT** format to make them run 5x faster on standard servers.
- **Hosting**: Deploy the backend on AWS (EC2/Lambda) or Render.

---

## 📅 Immediate Next Steps (Priority List)
1. `[ ]` **Create `phishing_api.py`**: Start the FastAPI skeleton.
2. `[ ]` **Model Quantization**: Convert the 3 models to a unified format for the backend.
3. `[ ]` **Supabase Connection**: Initialize the DB schema.
4. `[ ]` **Extension Prototype**: Build a simple Chrome extension that can "talk" to our local API.

---
**Aegis-One: Shielding the Digital Frontier.**
