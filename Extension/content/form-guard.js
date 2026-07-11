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

    // Search logo element but exclude footer icons
    hasLogo = brand.selectors.some(sel => {
      try {
        const logo = document.querySelector(sel);
        if (!logo) return false;
        const footer = logo.closest("footer, .footer, #footer, [class*='footer'], [id*='footer']");
        return !footer;
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
      return {
        brand: brand.name,
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
  
  // Instant Brand Impersonation Warning
  const impersonation = checkBrandImpersonation();
  if (impersonation) {
    features.brand_impersonation = impersonation.brand;
    features.brand_impersonation_score = impersonation.score;

    import(chrome.runtime.getURL("content/modals.js")).then(({ showWarningModal }) => {
      showWarningModal({
        score: impersonation.score,
        verdict: "danger",
        threat_type: "credential_harvesting",
        top_factors: [
          { label: `Detected Fake login portal impersonating ${impersonation.brand}` },
          { label: `Suspicious domain and brand asset match (Confidence: ${impersonation.confidence}%)` }
        ],
        url: window.location.href
      });
    });
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

  forms.forEach(form => {
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
    has_otp
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

      // Prevent typing
      e.target.blur();
      
      _showCredentialWarning(form, _currentPageRisk, () => {
        userAllowedTyping = true;
        e.target.focus();
      });
    }, { capture: true });

    form.addEventListener("submit", async (e) => {
      // Only intercept on risky pages if not already allowed
      if (userAllowedTyping || _currentPageRisk < 50) return;
      
      const stored = await chrome.storage.local.get("enableFormGuard");
      if (stored.enableFormGuard === false) return;

      e.preventDefault();

      // Double check with background
      const res = await chrome.runtime.sendMessage({
        type: MSG.FORM_INTERCEPT,
        url: window.location.href,
      }).catch(() => null);

      if (res?.block) {
        _showCredentialWarning(form, res.score, () => {
          userAllowedTyping = true;
          form.submit();
        });
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
function _showCredentialWarning(form, score, onAllow) {
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
        <span style="font-weight: 800; font-size: 12px; color: #f87171; text-transform: uppercase; letter-spacing: 1px;">⚠️ AegisOne Data Loss Prevention</span>
      </div>
      <div style="padding: 24px 28px;">
        <div style="
          width: 60px; height: 60px; margin: 0 auto 16px;
          background: rgba(239,68,68,0.1); border: 2px solid #ef4444;
          border-radius: 50%; display: flex; align-items: center; justify-content: center;
          font-size: 28px;
          animation: aegisPulse 2s infinite;
        ">🔐</div>
        <h2 style="font-size: 18px; font-weight: 800; color: #ef4444; margin: 0 0 10px;">Password Input Frozen</h2>
        <p style="font-size: 12px; color: #94a3b8; line-height: 1.6; margin: 0 0 18px;">
          This page has a <strong style="color: #f87171;">${score}% phishing risk</strong>. 
          AegisOne has frozen your keyboard to prevent accidental credential exposure.
        </p>
        <div style="background: rgba(239,68,68,0.06); border: 1px solid rgba(239,68,68,0.15); border-radius: 8px; padding: 10px 14px; margin-bottom: 18px; text-align: left; font-size: 11px; color: #94a3b8;">
          <div style="margin-bottom: 4px;"><strong style="color: #f1f5f9;">Domain:</strong> ${location.hostname}</div>
          <div><strong style="color: #f1f5f9;">Risk Score:</strong> <span style="color: #f87171;">${score}%</span></div>
        </div>
        <p style="font-size: 10px; color: #f87171; font-style: italic; margin: 0;">If this is a legitimate portal, you may proceed at your own risk.</p>
      </div>
      <div style="display: flex; gap: 10px; padding: 14px 20px; background: rgba(15,10,10,0.5); border-top: 1px solid rgba(239,68,68,0.12);">
        <button id="aegis-cred-block" style="
          flex: 1.5; background: #ef4444; color: #fff; border: none;
          padding: 10px; border-radius: 8px; font-size: 12px; font-weight: 700;
          cursor: pointer; font-family: inherit;
        ">🛡️ Keep Protected (Close)</button>
        <button id="aegis-cred-allow" style="
          flex: 1; background: transparent; color: #64748b;
          border: 1px solid rgba(255,255,255,0.08); padding: 10px;
          border-radius: 8px; font-size: 11px; font-weight: 600;
          cursor: pointer; font-family: inherit;
        ">Unfreeze & Proceed</button>
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
    if (onAllow) onAllow();
  });
}
