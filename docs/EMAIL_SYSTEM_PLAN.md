# Implementation Plan: Email System Unification, Anti-Spam & Dynamic On-Prem URL Resolution

## Overview
This document outlines the architecture and changes for unifying email delivery across AegisOne (`auth.py`, `setup.py`, `admin.py`), supporting dynamic on-premise IP/domain resolution, fixing Gmail spam penalties (HTML-only penalty & missing RFC headers), and enhancing temporary password selection UX.

---

## Key Problems Resolved

### 1. Hardcoded Links & On-Prem Deployment Failure
- **Old Behavior**: `auth.py` hardcoded `http://localhost:3002/login` in emails. `setup.py` relied on environment variables defaulting to `localhost`.
- **New Solution**: Dynamic host resolution (`get_dynamic_dashboard_url(request)`). Inspects the incoming request's `Host` header (e.g., `http://192.168.1.50:8000` -> `http://192.168.1.50:3002`), ensuring emails contain correct on-prem server IP or custom domain links.

### 2. Gmail Spam Penalties & Anti-Phishing Protection
- **Multi-Part MIME (HTML + Plain Text)**: Gmail & Outlook penalize single-part HTML emails. All emails now send both `text/plain` and `text/html` parts.
- **Mandatory RFC 2822 Headers**: Every email now includes valid `Date:` (`formatdate(localtime=True)`) and `Message-ID:` (`make_msgid()`) headers to prove authentic origin.
- **DMARC/SPF Alignment**: Sender `From:` display name and address are aligned with `smtp_user` and `Reply-To`.

### 3. Password Copy UX
- **Single-Click Selection**: Styled temporary password blocks with inline CSS `-webkit-user-select: all; user-select: all;` so clicking anywhere on the password string automatically highlights the entire code for fast `Ctrl+C` copying.

---

## Files Modified / Added

- `docs/EMAIL_SYSTEM_PLAN.md` (This file)
- `api/services/email_service.py` (Centralized email & URL resolution service)
- `api/routers/setup.py` (Refactored welcome email dispatch & templates)
- `api/routers/auth.py` (Refactored admin credentials, OTP, and password reset emails)
- `api/routers/admin.py` (Refactored user creation welcome emails)
