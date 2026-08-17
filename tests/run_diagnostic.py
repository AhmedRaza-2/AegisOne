"""
AegisOne — Deterministic L3 Signal Diagnostic (Phase 2 Observability)
========================================================================
Diagnoses L3 signal vectors across the known FP URLs + Credential Guard fixture.
Categorizes telemetry capture into:
  - L3_CAPTURED
  - L3_NOT_CAPTURED
  - NAVIGATION_TIMEOUT
  - NAVIGATION_ERROR
  - EXTENSION_NOT_LOADED
  - SCAN_SKIPPED
  - POLICY_ALLOW

Run:
    python tests/run_diagnostic.py

Requirements: playwright installed, API server running on :8000.
(Mock threat server on :8080 is started automatically by this script).
"""
import os
import sys
import json
import asyncio
import threading
import http.server
import socketserver
import time

import io
sys.stdout = io.TextIOWrapper(sys.stdout.buffer, encoding="utf-8")

PATH_TO_EXTENSION = os.path.abspath("Extension")
MOCK_SERVER_PORT  = 8080
MOCK_SERVER_URL   = f"http://localhost:{MOCK_SERVER_PORT}"

# ── Local Mock Threat Server ──────────────────────────────────────────────────
class MockHandler(http.server.SimpleHTTPRequestHandler):
    def __init__(self, *args, **kwargs):
        super().__init__(*args, directory=os.path.join("tests", "pages"), **kwargs)
    def log_message(self, format, *args):
        pass # Suppress noisy HTTP logs

def ensure_mock_server():
    socketserver.TCPServer.allow_reuse_address = True
    try:
        httpd = socketserver.TCPServer(("", MOCK_SERVER_PORT), MockHandler)
        t = threading.Thread(target=httpd.serve_forever, daemon=True)
        t.start()
        print(f"📡 Local mock threat server auto-started on {MOCK_SERVER_URL}")
    except Exception:
        # Server already running on 8080
        pass

# ── 7 Known False Positive Target URLs + Fixture ─────────────────────────────
FP_URLS = [
    "https://www.netflix.com",
    "https://www.bbc.com/news",
    "https://www.bankofamerica.com",
    "https://trello.com",
    "https://asana.com",
    "https://imgur.com",
    "https://www.forbes.com",
]

FIXTURE_URL = f"{MOCK_SERVER_URL}/brand_impersonation.html"

# Risk Engine Weights (used purely for proxy score reconstruction & verification)
WEIGHTS = {
    "url_model":      0.25,
    "domain_age":     0.10,
    "ssl":            0.10,
    "login_form":     0.10,
    "text_content":   0.15,
    "redirects":      0.05,
    "brand_mismatch": 0.20,
    "hidden_iframe":  0.05,
    "js_behavior":    0.05,
}

# ── Formatting Helpers ────────────────────────────────────────────────────────
def _v(val):
    if val is None:
        return "—"
    if isinstance(val, bool):
        return "true" if val else "false"
    if isinstance(val, float):
        return f"{val:.4f}"
    return str(val)

def _row(label, value, flag=False):
    marker = " ⚠️  " if flag else "     "
    print(f"{marker}{label:<44} {_v(value)}")

def _print_l3_vector(url, capture_state, diag, dom_scan, dom_features, overlay_present):
    print()
    print("=" * 74)
    print(f"  URL:            {url}")
    print(f"  CAPTURE STATE:  {capture_state}")
    print("=" * 74)

    scan_result = (diag or {}).get("scan_result") or dom_scan
    feat        = (diag or {}).get("features") or dom_features or {}
    bd          = (scan_result or {}).get("breakdown", {})
    raw         = (scan_result or {}).get("raw_url_model", {})
    ev          = raw.get("evidence", {})

    score   = (scan_result or {}).get("score")
    verdict = (scan_result or {}).get("verdict")
    reason  = (scan_result or {}).get("reason")
    pol_ov  = (scan_result or {}).get("policy_override")

    if capture_state in ("NAVIGATION_TIMEOUT", "NAVIGATION_ERROR", "EXTENSION_NOT_LOADED"):
        print(f"  ⛔  Scan unable to evaluate due to state: {capture_state}")
        print()
        return

    if capture_state in ("POLICY_ALLOW", "SCAN_SKIPPED"):
        print(f"  ℹ️   Scan skipped by policy layer: reason={reason}, policy_override={pol_ov}")
        print(f"       Features captured: login_form={feat.get('login_form_found')}, brand={feat.get('brand_impersonation')}")
        print()
        return

    if not scan_result:
        print("  ⚠️   L3 features captured, but background scan result payload was null.")
        print(f"       Features: login_form={feat.get('login_form_found')}, brand={feat.get('brand_impersonation')}")
        print()
        return

    is_fp = overlay_present or (verdict in ("danger", "warning"))
    status_str = "🚨  OVERLAY PRESENT" if overlay_present else (f"🔴  verdict={verdict}" if is_fp else f"✅  verdict={verdict}")
    print(f"  {status_str}   score={score}")
    print()

    # ── 1. URL Model ─────────────────────────────────────────────────────────
    print("  ── 1. URL Model ────────────────────────────────────────────────────")
    is_trusted = ev.get("trusted_domain", ev.get("fast_scan_bypass", None))
    url_prob   = raw.get("phishing_probability")
    url_score  = bd.get("url_model", {}).get("score", 0)
    _row("is_trusted (evidence key)",       is_trusted)
    _row("url_model_probability",           url_prob)
    _row("url_model_score (0–100)",         url_score, flag=url_score >= 50)
    _row("url_model_label",                 bd.get("url_model", {}).get("label"))

    # ── 2. Login Form / Credential ───────────────────────────────────────────
    print()
    print("  ── 2. Login Form / Credential ──────────────────────────────────────")
    lf_feat  = feat.get("login_form_found")
    lf_score = bd.get("login_form", {}).get("score", 0)
    _row("login_form_found  (features)",    lf_feat)
    _row("has_password      (features)",    feat.get("has_password"))
    _row("has_email         (features)",    feat.get("has_email"))
    _row("login_form_score  (risk-engine)", lf_score, flag=lf_score >= 50)

    # ── 3. Brand Impersonation ───────────────────────────────────────────────
    print()
    print("  ── 3. Brand Impersonation ──────────────────────────────────────────")
    bi_name  = feat.get("brand_impersonation")
    bi_score = feat.get("brand_impersonation_score")
    bi_role  = feat.get("brand_impersonation_role")
    bm_score = bd.get("brand_mismatch", {}).get("score", 0)
    _row("brand_impersonation (name)",      bi_name,  flag=bool(bi_name))
    _row("brand_impersonation_score",       bi_score, flag=bi_score is not None and bi_score >= 50)
    _row("brand_impersonation_role",        bi_role,  flag=bi_role == "primary_identity_impersonation")
    _row("brand_mismatch_score (risk-eng)", bm_score, flag=bm_score >= 50)
    _row("brand_mismatch_label",            bd.get("brand_mismatch", {}).get("label"))

    # ── 4. DOM / JS Signals ───────────────────────────────────────────────────
    print()
    print("  ── 4. DOM / JS Signals ─────────────────────────────────────────────")
    hif_score = bd.get("hidden_iframe", {}).get("score", 0)
    js_score  = bd.get("js_behavior",   {}).get("score", 0)
    _row("hidden_iframe (features)",        feat.get("hidden_iframe"), flag=bool(feat.get("hidden_iframe")))
    _row("hidden_iframe_score (risk-eng)",  hif_score, flag=hif_score >= 50)
    _row("js_obfuscated (features)",        feat.get("js_obfuscated"), flag=bool(feat.get("js_obfuscated")))
    _row("js_obfuscated_score (risk-eng)",  js_score,  flag=js_score >= 50)

    # ── 5. Score Reconstruction ───────────────────────────────────────────────
    print()
    print("  ── 5. Score Reconstruction ─────────────────────────────────────────")
    ws = 0.0; wu = 0.0
    for key, info in bd.items():
        w = WEIGHTS.get(key, 0.0)
        ws += info.get("score", 0) * w
        wu += w
    recon = round(ws / wu) if wu > 0 else 0
    _row("weighted_sum (proxy)",             round(ws, 2))
    _row("weight_used  (proxy)",             round(wu, 3))
    _row("reconstructed_score",              recon)
    _row("actual_final_score",               score, flag=isinstance(score, int) and score >= 50)

    # ── 6. Rule / Floor Detection ─────────────────────────────────────────────
    if isinstance(score, int) and recon < 50 <= score:
        print()
        print(f"  ⚠️  SCORE FLOOR APPLIED: reconstructed={recon} < 50 but final_score={score} ≥ 50")
        if bi_role == "primary_identity_impersonation":
            print(f"       Rule: brand primary_identity_impersonation score floor (min 85)")
        else:
            print(f"       Rule: custom risk override or score floor")

    # ── 7. Top Contributing Factors ───────────────────────────────────────────
    tf = (scan_result or {}).get("top_factors", [])
    if tf:
        print()
        print("  ── 7. Top Contributing Factors ─────────────────────────────────────")
        for f in tf:
            print(f"       • {f.get('label')}  (score={f.get('score')}, weight={f.get('weight')})")
    print()


async def _read_dom(page):
    scan_data     = None
    page_features = None
    widget_found  = False
    injected      = False

    try:
        injected = await page.evaluate("() => window.__AEGIS_INJECTED__ === true")
        widget_found = await page.evaluate("() => document.getElementById('aegis-widget-v2') !== null || document.getElementById('aegis-widget') !== null || document.getElementById('aegis-status-card') !== null")
    except Exception:
        pass

    el = await page.query_selector("#aegis-scan-data")
    if el:
        try:
            scan_data = json.loads(await el.inner_text())
        except Exception:
            pass

    el = await page.query_selector("#aegis-page-features")
    if el:
        try:
            page_features = json.loads(await el.inner_text())
        except Exception:
            pass

    return scan_data, page_features, (widget_found or injected)


async def run_diagnostic():
    from playwright.async_api import async_playwright
    
    user_data_dir = os.path.join("tests", "scratch", "playwright_diag_user_data")
    import shutil
    if os.path.exists(user_data_dir):
        try:
            shutil.rmtree(user_data_dir)
        except Exception:
            pass
    os.makedirs(user_data_dir, exist_ok=True)

    ensure_mock_server()

    print("\n🔬 AegisOne — L3 Signal Diagnostic (Phase 2 Observability)")
    print(f"   Extension: {PATH_TO_EXTENSION}")
    print(f"   Targets: {len(FP_URLS)} FP URLs + brand_impersonation.html fixture\n")

    async with async_playwright() as pw:
        ctx = await pw.chromium.launch_persistent_context(
            user_data_dir=user_data_dir,
            headless=False,
            args=[
                f"--disable-extensions-except={PATH_TO_EXTENSION}",
                f"--load-extension={PATH_TO_EXTENSION}",
            ],
            ignore_https_errors=True,
        )
        page = ctx.pages[0] if ctx.pages else await ctx.new_page()

        # ── SECTION 1: 7 Known False Positive URLs ────────────────────────────
        print("━" * 74)
        print("  SECTION 1 — Known False Positive Targets")
        print("━" * 74)

        for url in FP_URLS:
            l3_payloads = []

            def _on_console(msg):
                txt = msg.text
                if "[AEGIS:L3]" in txt:
                    try:
                        raw = txt.split("[AEGIS:L3]", 1)[1].strip()
                        l3_payloads.append(json.loads(raw))
                    except Exception:
                        pass

            page.on("console", _on_console)

            nav_ok = True
            nav_err_type = None
            try:
                await page.goto(url, timeout=18000, wait_until="domcontentloaded")
            except Exception as e:
                nav_ok = False
                err_str = str(e).lower()
                if "timeout" in err_str:
                    nav_err_type = "NAVIGATION_TIMEOUT"
                else:
                    nav_err_type = "NAVIGATION_ERROR"

            if not nav_ok:
                page.remove_listener("console", _on_console)
                _print_l3_vector(url, nav_err_type, None, None, None, False)
                continue

            # Wait for AegisOne content script injection & L3 scan result
            try:
                await page.wait_for_function(
                    "() => document.getElementById('aegis-scan-data') !== null || document.getElementById('aegis-page-features') !== null || window.__AEGIS_INJECTED__ === true",
                    timeout=7000
                )
            except Exception:
                pass

            # Give up to 4s for background scan_result payload to arrive if features exist
            try:
                await page.wait_for_selector("#aegis-scan-data", timeout=4000)
            except Exception:
                pass

            page.remove_listener("console", _on_console)

            diag = l3_payloads[-1] if l3_payloads else None
            dom_sd, dom_pf, widget_found = await _read_dom(page)
            warn_overlay = False
            try:
                warn_overlay = await page.is_visible("#aegis-warning-overlay")
            except Exception:
                pass

            scan_res = (diag or {}).get("scan_result") or dom_sd

            # Determine capture state
            if scan_res:
                if scan_res.get("skipped"):
                    if scan_res.get("reason") == "policy_allowlist" or scan_res.get("policy_override") == "allow":
                        capture_state = "POLICY_ALLOW"
                    else:
                        capture_state = "SCAN_SKIPPED"
                else:
                    capture_state = "L3_CAPTURED"
            elif diag or dom_pf:
                capture_state = "L3_NOT_CAPTURED"
            elif widget_found:
                capture_state = "L3_NOT_CAPTURED"
            else:
                capture_state = "EXTENSION_NOT_LOADED"

            _print_l3_vector(url, capture_state, diag, dom_sd, dom_pf, bool(warn_overlay))

        # ── SECTION 2: Credential Guard Fixture ───────────────────────────────
        print("━" * 74)
        print("  SECTION 2 — Credential Guard Fixture (brand_impersonation.html)")
        print("━" * 74)

        l3_payloads = []

        def _on_console_cg(msg):
            txt = msg.text
            if "[AEGIS:L3]" in txt:
                try:
                    raw = txt.split("[AEGIS:L3]", 1)[1].strip()
                    l3_payloads.append(json.loads(raw))
                except Exception:
                    pass

        page.on("console", _on_console_cg)

        cg_nav_ok = True
        try:
            await page.goto(FIXTURE_URL, timeout=12000, wait_until="domcontentloaded")
            await asyncio.sleep(1.5)
        except Exception as e:
            cg_nav_ok = False
            print(f"\n  ⛔  Fixture navigation failed: {e}")

        if cg_nav_ok:
            try:
                await page.wait_for_function(
                    "() => document.getElementById('aegis-scan-data') !== null || document.getElementById('aegis-page-features') !== null || window.__AEGIS_INJECTED__ === true",
                    timeout=7000
                )
            except Exception:
                pass

            page.remove_listener("console", _on_console_cg)

            diag = l3_payloads[-1] if l3_payloads else None
            dom_sd, dom_pf, widget_found = await _read_dom(page)
            warn_overlay = False
            try:
                warn_overlay = await page.is_visible("#aegis-warning-overlay")
            except Exception:
                pass

            scan_res = (diag or {}).get("scan_result") or dom_sd

            if scan_res:
                if scan_res.get("skipped"):
                    capture_state = "POLICY_ALLOW" if scan_res.get("policy_override") == "allow" else "SCAN_SKIPPED"
                else:
                    capture_state = "L3_CAPTURED"
            elif diag or dom_pf:
                capture_state = "L3_NOT_CAPTURED"
            else:
                capture_state = "EXTENSION_NOT_LOADED"

            cg_passed = bool(warn_overlay) or (scan_res and scan_res.get("score", 0) >= 80)
            cg_status = "✅ TRIGGERED / PASSED" if cg_passed else "❌ FAILED"
            print(f"\n  Credential Guard Fixture Status: {cg_status}")

            _print_l3_vector(FIXTURE_URL, capture_state, diag, dom_sd, dom_pf, bool(warn_overlay))

        await ctx.close()

    print("━" * 74)
    print("  Diagnostic complete.")
    print("━" * 74)


if __name__ == "__main__":
    asyncio.run(run_diagnostic())
