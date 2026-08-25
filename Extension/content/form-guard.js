/**
 * AegisOne — Content Script: Form Guard v2.1
 * ============================================
 * Detects and intercepts credential form submissions on risky pages.
 *
 * v2.1 new checks (before submit):
 *  - HTTP form action (non-HTTPS submission) — always warn
 *  - Form action domain mismatch vs. current domain
 *  - Mismatched/hidden action URL scanning
 */
import { MSG } from "../../utils/constants.js";

let _currentPageRisk = 0;
let _formGuardActive = false;

const BRANDS = [
  {
    name: "Facebook",
    official: ["facebook.com", "fb.com", "messenger.com"],
    keywords: ["facebook", "messenger"],
    selectors: ["[src*='facebook']", "[alt*='facebook']", "[class*='fb-']", "[id*='fb-']"],
    colors: ["#1877f2", "#3b5998", "rgb(24, 119, 242)", "rgb(59, 89, 152)"],
    confidence: 96
  },
  {
    name: "Google",
    official: ["google.com", "youtube.com", "gmail.com"],
    keywords: ["google", "gmail", "sign in with google"],
    selectors: ["[src*='google']", "[alt*='google']", "[id*='google']"],
    colors: ["#4285f4", "#ea4335", "#fbbc05", "#34a853", "rgb(66, 133, 244)"],
    confidence: 95
  },
  {
    name: "Microsoft",
    official: ["microsoft.com", "live.com", "office.com", "outlook.com", "microsoftonline.com"],
    keywords: ["microsoft", "outlook", "office 365", "sharepoint"],
    selectors: ["[src*='microsoft']", "[alt*='microsoft']", "[src*='outlook']"],
    colors: ["#0078d4", "#f25022", "#7fba00", "#ffb900", "#00a4ef", "rgb(0, 120, 212)"],
    confidence: 95
  },
  {
    name: "Netflix",
    official: ["netflix.com"],
    keywords: ["netflix"],
    selectors: ["[src*='netflix']", "[alt*='netflix']"],
    colors: ["#e50914", "rgb(229, 9, 20)"],
    confidence: 97
  },
  {
    name: "PayPal",
    official: ["paypal.com"],
    keywords: ["paypal"],
    selectors: ["[src*='paypal']", "[alt*='paypal']"],
    colors: ["#003087", "#0079c1", "rgb(0, 48, 135)"],
    confidence: 96
  }
];

function _hexMatches(rgbStr, hexList) {
  if (!rgbStr || rgbStr === "transparent" || rgbStr === "rgba(0, 0, 0, 0)") return false;
  const m = rgbStr.match(/\d+/g);
  if (!m || m.length < 3) return false;
  const r = parseInt(m[0]), g = parseInt(m[1]), b = parseInt(m[2]);
  const hex = "#" + ((1 << 24) + (r << 16) + (g << 8) + b).toString(16).slice(1);
  return hexList.includes(hex);
}

export function checkBrandImpersonation() {
  const hostname = window.location.hostname.toLowerCase();
  
  // Skip search engines
  if (hostname.includes("google.") || hostname.includes("bing.") || hostname.includes("duckduckgo.")) {
    return null;
  }

  // Require a real login-like form before we even try brand impersonation.
  const passwordInputs = [...document.querySelectorAll('input[type="password"]')];
  if (passwordInputs.length === 0) return null;

  const loginForms = passwordInputs
    .map(input => input.closest("form"))
    .filter(Boolean);
  if (loginForms.length === 0) return null;

  for (const brand of BRANDS) {
    const isOfficial = brand.official.some(domain => 
      hostname === domain || hostname.endsWith("." + domain)
    );
    if (isOfficial) continue;

    let hasText = false;
    let hasLogo = false;
    let hasColors = false;
    let formSignals = false;

    // Search text in page title and headings/forms only to avoid footer/social links
    const relevantText = [
      document.title,
      ...loginForms.map(el => el.innerText || ""),
      ...[...document.querySelectorAll("h1, h2, h3, h4")].map(el => el.innerText || "")
    ].join(" ").toLowerCase();
    
    hasText = brand.keywords.some(kw => relevantText.includes(kw));

    // Search logo element inside form or its parent container, excluding footer icons
    hasLogo = brand.selectors.some(sel => {
      try {
        return loginForms.some(form => {
          let logo = form.querySelector(sel);
          if (!logo && form.parentElement) {
            logo = form.parentElement.querySelector(sel);
          }
          if (!logo) return false;
          const footer = logo.closest("footer, .footer, #footer, [class*='footer'], [id*='footer']");
          return !footer;
        });
      } catch (_) { return false; }
    });

    // Check color matching only on form-specific action elements
    const elements = loginForms.flatMap(form => [
      ...form.querySelectorAll("button, input[type='submit'], div[role='button']")
    ]);
    for (const el of elements) {
      const bg = window.getComputedStyle(el).backgroundColor;
      if (brand.colors.includes(bg) || _hexMatches(bg, brand.colors)) {
        hasColors = true;
        break;
      }
    }

    formSignals = loginForms.some(form => {
      const txt = (form.innerText || "").toLowerCase();
      return /sign in|log in|login|verify|continue|submit|password|security code|otp/.test(txt);
    });

    const matchesCount = (hasText ? 1 : 0) + (hasLogo ? 1 : 0) + (hasColors ? 1 : 0);
    
    if (formSignals && matchesCount >= 2) {
      // Determine if there is an OAuth-like button for this brand in the forms
      const hasOauthBtn = loginForms.some(form => {
        const buttons = [...form.querySelectorAll("button, input[type='submit'], div[role='button'], a, [class*='btn'], [class*='button']")];
        return buttons.some(btn => {
          const btnText = (btn.textContent || btn.value || "").toLowerCase();
          return brand.keywords.some(kw => {
            const regex = new RegExp(`(continue|sign|log|connect|with|using)\\s+${kw}`, "i");
            return regex.test(btnText) || btnText.trim() === kw;
          });
        });
      });

      if (hasOauthBtn) {
        return {
          brand: brand.name,
          role: "third_party_oauth",
          confidence: 15,
          threat_type: "safe",
          score: 15
        };
      }

      return {
        brand: brand.name,
        role: "primary_identity_impersonation",
        confidence: brand.confidence,
        threat_type: "credential_harvesting",
        score: brand.confidence
      };
    }
  }
  return null;
}

/**
 * Initialize form guard.
 * @param {function} onFormDetected - callback({ form_count, login_form_found })
 */
export function initFormGuard(onFormDetected) {
  const features = _analyzePageForms();
  
  // Store Brand Impersonation features to be sent to Risk Engine via PAGE_FEATURES
  const impersonation = checkBrandImpersonation();
  if (impersonation) {
    features.brand_impersonation = impersonation.brand;
    features.brand_impersonation_score = impersonation.score;
    features.brand_impersonation_role = impersonation.role;
  }

  if (onFormDetected) onFormDetected(features);

  if (features.login_form_found) {
    _setupSubmitInterceptors();
    _formGuardActive = true;
  }

  // Watch for dynamically added forms (SPAs)
  const observer = new MutationObserver(() => {
    const updated = _analyzePageForms();
    const imp = checkBrandImpersonation();
    if (imp) {
      updated.brand_impersonation = imp.brand;
      updated.brand_impersonation_score = imp.score;
      updated.brand_impersonation_role = imp.role;
    }
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
  const emailInputs = document.querySelectorAll('input[type="email"], input[name*="email"], input[name*="user"], input[type="text"]');
  const forms = document.querySelectorAll("form");
  const buttons = document.querySelectorAll("button, input[type='submit'], input[type='button']");

  let login_form_found = false;
  let form_count = forms.length;
  let has_password = passwordInputs.length > 0;
  let has_email = false;
  let has_submit = false;
  let has_otp = false;

  emailInputs.forEach(input => {
    const name = (input.name || "").toLowerCase();
    const id = (input.id || "").toLowerCase();
    const type = (input.type || "").toLowerCase();
    if (type === "email" || name.includes("email") || name.includes("user") || id.includes("email") || id.includes("user")) {
      has_email = true;
    }
  });

  const bodyText = (document.body?.innerText || "").toLowerCase();
  has_otp = bodyText.includes("otp") || bodyText.includes("one-time password") || bodyText.includes("verification code") || bodyText.includes("verify");

  buttons.forEach(btn => {
    const txt = (btn.textContent || btn.value || "").toLowerCase();
    if (txt.includes("sign in") || txt.includes("login") || txt.includes("log in") || txt.includes("continue") || txt.includes("submit") || txt.includes("verify")) {
      has_submit = true;
    }
  });

  let form_actions = [];

  forms.forEach(form => {
    if (form.action) form_actions.push(form.action);
    const hasPassword = form.querySelector('input[type="password"]');
    if (hasPassword) {
      login_form_found = true;
    }
  });

  if (passwordInputs.length > 0) {
    login_form_found = true;
  }

  return {
    login_form_found,
    form_count,
    has_form: forms.length > 0,
    has_password,
    has_email,
    has_submit,
    has_otp,
    form_actions
  };
}

/**
 * Set up submit interceptors on all forms with password fields.
 */
function _setupSubmitInterceptors() {
  const intercepted = new WeakSet();
  let userAllowedTyping = false;

  async function attachToForm(form) {
    if (intercepted.has(form)) return;
    const passwordInput = form.querySelector('input[type="password"]');
    if (!passwordInput) return;
    intercepted.add(form);

    // Freeze typing on password focus
    passwordInput.addEventListener("focus", async (e) => {
      if (userAllowedTyping || _currentPageRisk < 50) return;
      
      const stored = await chrome.storage.local.get("enableFormGuard");
      if (stored.enableFormGuard === false) return; // User disabled it

      // Trigger warning on focus, but don't steal focus
      _showCredentialWarning(form, _currentPageRisk);
      userAllowedTyping = true;
    }, { capture: true });

    form.addEventListener("submit", async (e) => {
      // Run enhanced pre-submission checks regardless of page risk score
      const formAction = (form.action || "").trim();
      const currentHost = window.location.hostname.toLowerCase();

      // ── Check 1: HTTP (non-HTTPS) form action ───────────────
      // Submitting credentials over HTTP is always dangerous
      const isHttpAction = formAction.startsWith("http://") && !formAction.startsWith("https://");

      // ── Check 2: Form action domain mismatch ─────────────────
      let actionDomainMismatch = false;
      if (formAction && formAction.startsWith("http")) {
        try {
          const actionHost = new URL(formAction).hostname.toLowerCase();
          // Allow subdomains of the same root domain
          const actionRoot = actionHost.split(".").slice(-2).join(".");
          const currentRoot = currentHost.split(".").slice(-2).join(".");
          actionDomainMismatch = actionRoot !== currentRoot;
        } catch (_) {}
      }

      // ── Warn on structural form issues ───────────────────────
      if (isHttpAction || actionDomainMismatch) {
        const reasons = [];
        if (isHttpAction) reasons.push("Form submits credentials over unencrypted HTTP");
        if (actionDomainMismatch) reasons.push(`Form action sends data to a different domain: ${new URL(formAction).hostname}`);

        _showCredentialWarning(form, Math.max(_currentPageRisk, 70), reasons);
        return;
      }

      // ── Existing risk-score check ────────────────────────────
      if (userAllowedTyping || _currentPageRisk < 50) return;

      const stored = await chrome.storage.local.get("enableFormGuard");
      if (stored.enableFormGuard === false) return;

      let res = null;
      try {
        if (typeof chrome !== "undefined" && chrome?.runtime?.id) {
          res = await chrome.runtime.sendMessage({
            type: MSG.FORM_INTERCEPT,
            url: window.location.href,
            formAction: formAction
          });
        }
      } catch (_) {}

      if (res?.block) {
        _showCredentialWarning(form, res.score);
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
 * Show a non-blocking credential submission warning toast.
 * @param {HTMLFormElement} form
 * @param {number} score
 * @param {string[]} [extraReasons] - additional reason lines to display
 */
function _showCredentialWarning(form, score, extraReasons = []) {
  const existing = document.getElementById("aegis-cred-warn-toast");
  if (existing) return;

  const toast = document.createElement("div");
  toast.id = "aegis-cred-warn-toast";
  toast.style.cssText = `
    position: fixed; bottom: 24px; right: 24px; z-index: 2147483647;
    width: 380px; max-width: calc(100vw - 48px);
    background: #110808; border: 1px solid rgba(239,68,68,0.4);
    border-radius: 12px; overflow: hidden;
    box-shadow: 0 12px 40px rgba(0,0,0,0.6);
    font-family: 'Inter', -apple-system, sans-serif;
    animation: aegisToastSlideIn 0.4s cubic-bezier(0.16,1,0.3,1);
    pointer-events: auto;
  `;

  toast.innerHTML = `
    <div style="padding: 10px 16px; background: rgba(239,68,68,0.15); border-bottom: 1px solid rgba(239,68,68,0.2); display: flex; justify-content: space-between; align-items: center;">
      <span style="font-weight: 800; font-size: 11px; color: #f87171; text-transform: uppercase; letter-spacing: 0.5px;">⚠️ AegisOne Alert</span>
      <button id="aegis-toast-close" style="background:transparent;border:none;color:#f87171;cursor:pointer;padding:4px;line-height:1;border-radius:4px;">✕</button>
    </div>
    <div style="padding: 16px;">
      <h2 style="font-size: 15px; font-weight: 700; color: #ef4444; margin: 0 0 8px;">Unsafe Login Form Detected</h2>
      <p style="font-size: 12px; color: #cbd5e1; line-height: 1.5; margin: 0 0 12px;">
        This page has a <strong style="color: #f87171;">${score}% phishing risk</strong>. Please double-check the URL before submitting your credentials.
      </p>
      ${extraReasons.length > 0 ? `<div style="background: rgba(239,68,68,0.1); border: 1px solid rgba(239,68,68,0.2); border-radius: 6px; padding: 8px 12px; margin-bottom: 12px; font-size: 11px; color: #f87171; line-height: 1.4;">${extraReasons.map(r => `<div>• ${r}</div>`).join('')}</div>` : ''}
      <div style="font-size: 11px; color: #94a3b8;">
        <strong style="color: #e2e8f0;">Domain:</strong> ${location.hostname}
      </div>
    </div>
    <style>
      @keyframes aegisToastSlideIn {
        from { opacity: 0; transform: translateX(40px) scale(0.95); }
        to   { opacity: 1; transform: translateX(0) scale(1); }
      }
      #aegis-toast-close:hover { background: rgba(239,68,68,0.2); }
    </style>
  `;

  document.body.appendChild(toast);

  document.getElementById("aegis-toast-close")?.addEventListener("click", () => {
    toast.remove();
  });
  
  // Auto-dismiss after 15 seconds
  setTimeout(() => {
    if (document.body.contains(toast)) toast.remove();
  }, 15000);
}
