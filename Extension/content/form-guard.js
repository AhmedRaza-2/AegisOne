/**
 * AegisOne — Content Script: Form Guard
 * =======================================
 * Monitors password/credential form submissions on risky pages.
 *
 * Flow:
 * 1. Detect password inputs on page
 * 2. On form submit: ask background if page is risky
 * 3. If risky → show warning modal before allowing submit
 * 4. User can proceed or cancel
 *
 * Also detects suspicious login forms for the risk engine.
 */

import { MSG } from "../../utils/constants.js";

let _currentPageRisk = 0;
let _formGuardActive = false;

/**
 * Initialize form guard.
 * @param {function} onFormDetected - callback({ form_count, login_form_found })
 */
export function initFormGuard(onFormDetected) {
  const features = _analyzePageForms();
  if (onFormDetected) onFormDetected(features);

  if (features.login_form_found) {
    _setupSubmitInterceptors();
    _formGuardActive = true;
  }

  // Watch for dynamically added forms (SPAs)
  const observer = new MutationObserver(() => {
    const updated = _analyzePageForms();
    if (updated.login_form_found && !_formGuardActive) {
      if (onFormDetected) onFormDetected(updated);
      _setupSubmitInterceptors();
      _formGuardActive = true;
    }
  });
  observer.observe(document.body, { childList: true, subtree: true });
}

export function setCurrentRisk(score) {
  _currentPageRisk = score || 0;
}

/**
 * Analyze current page for suspicious login forms.
 * Returns features for the risk engine.
 */
function _analyzePageForms() {
  const passwordInputs = document.querySelectorAll('input[type="password"]');
  const forms = document.querySelectorAll("form");
  let login_form_found = false;
  let form_count = 0;

  forms.forEach(form => {
    const hasPassword = form.querySelector('input[type="password"]');
    const hasText = form.querySelector('input[type="text"], input[type="email"]');
    if (hasPassword) {
      login_form_found = true;
      form_count++;
    }
  });

  // Also check standalone password inputs outside forms
  if (passwordInputs.length > 0 && form_count === 0) {
    login_form_found = true;
    form_count = passwordInputs.length;
  }

  return { login_form_found, form_count };
}

/**
 * Set up submit interceptors on all forms with password fields.
 */
function _setupSubmitInterceptors() {
  const intercepted = new WeakSet();

  function attachToForm(form) {
    if (intercepted.has(form)) return;
    if (!form.querySelector('input[type="password"]')) return;
    intercepted.add(form);

    form.addEventListener("submit", async (e) => {
      // Only intercept on risky pages
      if (_currentPageRisk < 50) return;

      e.preventDefault();

      // Double check with background
      const res = await chrome.runtime.sendMessage({
        type: MSG.FORM_INTERCEPT,
        url: window.location.href,
      }).catch(() => null);

      if (res?.block) {
        _showCredentialWarning(form, res.score);
      } else {
        form.submit();
      }
    }, { capture: true });
  }

  document.querySelectorAll("form").forEach(attachToForm);

  // Watch for new forms
  const observer = new MutationObserver(() => {
    document.querySelectorAll("form").forEach(attachToForm);
  });
  observer.observe(document.body, { childList: true, subtree: true });
}

/**
 * Show a credential submission warning modal.
 */
function _showCredentialWarning(form, score) {
  const existing = document.getElementById("aegis-cred-warn");
  if (existing) return;

  const overlay = document.createElement("div");
  overlay.id = "aegis-cred-warn";
  overlay.style.cssText = `
    position: fixed; inset: 0; z-index: 2147483646;
    background: rgba(10,5,5,0.85); backdrop-filter: blur(14px);
    display: flex; align-items: center; justify-content: center;
    font-family: 'Inter', -apple-system, sans-serif;
  `;

  overlay.innerHTML = `
    <div style="
      width: 420px; max-width: 92%;
      background: #0f0a0a; border: 1px solid rgba(239,68,68,0.35);
      border-radius: 16px; overflow: hidden; text-align: center;
      box-shadow: 0 24px 64px rgba(0,0,0,0.9);
      animation: aegisSlideUp 0.3s cubic-bezier(0.16,1,0.3,1);
    ">
      <div style="padding: 14px 20px; background: rgba(239,68,68,0.12); border-bottom: 1px solid rgba(239,68,68,0.2);">
        <span style="font-weight: 800; font-size: 12px; color: #f87171; text-transform: uppercase; letter-spacing: 1px;">⚠️ AegisOne Security Warning</span>
      </div>
      <div style="padding: 24px 28px;">
        <div style="
          width: 60px; height: 60px; margin: 0 auto 16px;
          background: rgba(239,68,68,0.1); border: 2px solid #ef4444;
          border-radius: 50%; display: flex; align-items: center; justify-content: center;
          font-size: 28px;
          animation: aegisPulse 2s infinite;
        ">🔐</div>
        <h2 style="font-size: 18px; font-weight: 800; color: #ef4444; margin: 0 0 10px;">Credential Submission Blocked</h2>
        <p style="font-size: 12px; color: #94a3b8; line-height: 1.6; margin: 0 0 18px;">
          This page has a <strong style="color: #f87171;">${score}% phishing risk</strong>. 
          Submitting your password here may expose your credentials to attackers.
        </p>
        <div style="background: rgba(239,68,68,0.06); border: 1px solid rgba(239,68,68,0.15); border-radius: 8px; padding: 10px 14px; margin-bottom: 18px; text-align: left; font-size: 11px; color: #94a3b8;">
          <div style="margin-bottom: 4px;"><strong style="color: #f1f5f9;">Page:</strong> ${location.hostname}</div>
          <div><strong style="color: #f1f5f9;">Risk Score:</strong> <span style="color: #f87171;">${score}%</span></div>
        </div>
        <p style="font-size: 10px; color: #f87171; font-style: italic; margin: 0;">Never enter passwords on untrusted pages.</p>
      </div>
      <div style="display: flex; gap: 10px; padding: 14px 20px; background: rgba(15,10,10,0.5); border-top: 1px solid rgba(239,68,68,0.12);">
        <button id="aegis-cred-block" style="
          flex: 1.5; background: #ef4444; color: #fff; border: none;
          padding: 10px; border-radius: 8px; font-size: 12px; font-weight: 700;
          cursor: pointer; font-family: inherit;
        ">🛡️ Cancel Submission</button>
        <button id="aegis-cred-allow" style="
          flex: 1; background: transparent; color: #64748b;
          border: 1px solid rgba(255,255,255,0.08); padding: 10px;
          border-radius: 8px; font-size: 11px; font-weight: 600;
          cursor: pointer; font-family: inherit;
        ">Proceed Anyway</button>
      </div>
    </div>
    <style>
      @keyframes aegisSlideUp {
        from { opacity: 0; transform: scale(0.93) translateY(20px); }
        to   { opacity: 1; transform: scale(1) translateY(0); }
      }
      @keyframes aegisPulse {
        0%, 100% { box-shadow: 0 0 0 0 rgba(239,68,68,0.4); }
        70% { box-shadow: 0 0 0 10px rgba(239,68,68,0); }
      }
    </style>
  `;

  document.body.appendChild(overlay);

  document.getElementById("aegis-cred-block")?.addEventListener("click", () => {
    overlay.remove();
  });

  document.getElementById("aegis-cred-allow")?.addEventListener("click", () => {
    overlay.remove();
    form.submit();
  });
}
