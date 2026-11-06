"""
End-to-end test of the AegisOne browser extension in a real Chromium (modules 8.6 active prevention, 8.10 client-side
data protection, 8.12 web risk scoring).

It loads the unpacked extension, signs it in through the real popup against a running API, then browses local test
pages that the browser believes are on real domains (host-resolver rules), and checks what the user would see:

  sign-in through the popup                       tokens stored ENCRYPTED (AES-GCM, no JWT readable on disk)
  ordinary page on a reputable domain             widget shown, no warning
  fake bank login page                            phishing warning; typing a password raises the credential alert
  page with links (normal, shadow DOM, iframe)    dangerous links get a risk badge, safe links do not
  QR code that leads to a phishing address        the decoded destination is shown under the code
  .exe download from a suspicious host            held and the user is asked before it is saved
  security event log                              stored encrypted

Run (API first):
    AEGIS_SLA_WATCH=0 python -m uvicorn api.main:app --port 8765
    PYTHONPATH=. python Extension/tests/e2e_extension.py            [--headed]
"""
import asyncio
import io
import json
import shutil
import socket
import sys
import tempfile
import threading
import time
from functools import partial
from http.server import SimpleHTTPRequestHandler, ThreadingHTTPServer
from pathlib import Path

sys.stdout = io.TextIOWrapper(sys.stdout.buffer, encoding="utf-8")
ROOT = Path(__file__).resolve().parents[2]
sys.path.insert(0, str(ROOT))
EXT = str(ROOT / "Extension")
API = "http://localhost:8765"
ORG = "zz_ext_org"
EMAIL, PW = "zz_ext_emp@x.invalid", "ZzExt#2026-pass"
PHISH_HOST = "hbl-corp-verify.info"
SAFE_HOST = "docs.python.org"            # Tranco-listed domain served locally: must stay quiet
BAD_HOST = "paypa1-secure-login.zzext-test.top"
FILES_HOST = "files.zzext-test.top"
SITE = ROOT / "presentation/demo-video/record/site"

res = []


def chk(name, ok, extra=""):
    res.append(bool(ok))
    print(("PASS " if ok else "FAIL ") + name + (f"  [{str(extra)[:300]}]" if extra and not ok else ""), flush=True)


# ── test data in the API's database ──────────────────────────────────────────────────────────────
async def _db(action):
    from sqlalchemy import delete
    from api.auth.password import hash_password
    from api.database.db import async_session, engine
    from api.database.models import (CredentialEvent, Device, Notification, Organization, Policy, ScanLog, User,  # noqa: F401
                                     WebsiteScan)
    try:
        async with async_session() as db:
            for model in (Notification, Policy, CredentialEvent, WebsiteScan, Device):
                await db.execute(delete(model).where(model.organization_id == ORG))
            await db.execute(delete(User).where(User.organization_id == ORG))
            await db.execute(delete(Organization).where(Organization.id == ORG))
            await db.commit()
            if action == "seed":
                db.add(Organization(id=ORG, name="Extension Test Org", plan="standard", timezone="UTC"))
                await db.commit()
                db.add(User(email=EMAIL, password_hash=hash_password(PW), full_name="Ext Tester", role="employee",
                            account_status="approved", is_active=True, organization_id=ORG))
                await db.commit()
    finally:
        await engine.dispose()


# ── local pages served under real-looking host names ─────────────────────────────────────────────
def build_site(d: Path, port: int):
    shutil.copy(SITE / "login.html", d / "login.html")
    shutil.copy(SITE / "docs.html", d / "docs.html")
    bad = f"http://{BAD_HOST}:{port}/verify?acct=7"
    (d / "links.html").write_text(f"""<!doctype html><html><head><meta charset="utf-8"><title>Team links</title></head><body>
<h1>Useful links</h1>
<p><a id="good" href="https://github.com/python/cpython/issues/1">CPython issue tracker</a></p>
<p><a id="bad" href="{bad}">Update your PayPal billing</a></p>
<div id="host"></div>
<iframe id="frame" srcdoc='<a id="frame_bad" href="{bad}&f=1">PayPal security check</a>' width="400" height="80"></iframe>
<script>
  const root = document.getElementById("host").attachShadow({{mode: "open"}});
  root.innerHTML = '<a id="shadow_bad" href="{bad}&s=1">PayPal account review</a>';
</script></body></html>""", encoding="utf-8")
    import qrcode
    qrcode.make(f"http://hbl-verify-account.zzext-test.top:{port}/login").save(d / "qr.png")
    (d / "qr.html").write_text("""<!doctype html><html><head><meta charset="utf-8"><title>Scan to pay</title></head><body>
<h1>Pay your bill</h1><p>Scan the code with your phone:</p><img id="qr" src="qr.png" width="240" height="240" alt="QR"></body></html>""", encoding="utf-8")
    (d / "Invoice_2026.exe").write_bytes(b"MZ" + b"\0" * 2048)
    (d / "download.html").write_text(f"""<!doctype html><html><head><meta charset="utf-8"><title>Invoice</title></head><body>
<h1>Your invoice is ready</h1><a id="dl" href="http://{FILES_HOST}:{port}/Invoice_2026.exe">Download invoice</a></body></html>""", encoding="utf-8")


def free_port():
    s = socket.socket()
    s.bind(("127.0.0.1", 0))
    p = s.getsockname()[1]
    s.close()
    return p


def main(headed=False):
    import urllib.request
    try:
        urllib.request.urlopen(API + "/health", timeout=5)
    except Exception as e:
        print(f"API not reachable at {API}: {e}")
        sys.exit(2)
    asyncio.run(_db("seed"))
    port = free_port()
    site = Path(tempfile.mkdtemp(prefix="aegis_ext_site_"))
    build_site(site, port)
    httpd = ThreadingHTTPServer(("127.0.0.1", port), partial(SimpleHTTPRequestHandler, directory=str(site)))
    threading.Thread(target=httpd.serve_forever, daemon=True).start()
    rules = ", ".join(f"MAP {h} 127.0.0.1:{port}" for h in (PHISH_HOST, SAFE_HOST, BAD_HOST, FILES_HOST, "hbl-verify-account.zzext-test.top"))
    profile = tempfile.mkdtemp(prefix="aegis_ext_profile_")

    from playwright.sync_api import sync_playwright
    try:
        with sync_playwright() as p:
            ctx = p.chromium.launch_persistent_context(
                profile, channel="chromium", headless=not headed, viewport={"width": 1366, "height": 860}, accept_downloads=True,
                args=[f"--disable-extensions-except={EXT}", f"--load-extension={EXT}", f"--host-resolver-rules={rules}"])
            sw = ctx.service_workers[0] if ctx.service_workers else ctx.wait_for_event("serviceworker", timeout=30000)
            ext_id = sw.url.split("/")[2]
            chk("extension service worker started", bool(ext_id))
            sw.evaluate(f"async () => {{ await chrome.storage.local.set({{server_url: '{API}'}}); }}")

            # 1. sign in through the real popup
            pop = ctx.new_page()
            pop.goto(f"chrome-extension://{ext_id}/popup/popup.html")
            pop.locator("#authEmail").wait_for(timeout=20000)
            pop.fill("#authEmail", EMAIL)
            pop.fill("#authPassword", PW)
            pop.click("#authSubmit")
            try:
                pop.get_by_text("Signed in as").wait_for(timeout=25000)
                chk("popup sign-in", True)
            except Exception as e:
                chk("popup sign-in", False, e)
            raw = sw.evaluate("async () => JSON.stringify(await chrome.storage.local.get(null))")
            store = json.loads(raw)
            tok = store.get("auth_access_token")
            chk("access token stored encrypted (AES-GCM envelope)", isinstance(tok, dict) and "__aegis_enc" in json.dumps(tok), str(tok)[:120])
            chk("no readable JWT anywhere in extension storage", "eyJ" not in raw, [k for k, v in store.items() if "eyJ" in json.dumps(v)])
            pop.close()

            # 2. ordinary page on a reputable domain: widget, no warning
            pg = ctx.new_page()
            pg.goto(f"http://{SAFE_HOST}:{port}/docs.html", wait_until="domcontentloaded")
            try:
                pg.locator("#aegis-widget-v2").wait_for(timeout=20000)
                chk("risk widget shown on an ordinary page", True)
            except Exception as e:
                chk("risk widget shown on an ordinary page", False, e)
            pg.wait_for_timeout(5000)
            warned = pg.locator("#aegis-s-title").count() and "Phishing" in (pg.locator("#aegis-s-title").first.inner_text() or "")
            chk("no phishing warning on the ordinary page", not warned)

            # 3. fake bank login: warning, then credential alert while typing
            pg.goto(f"http://{PHISH_HOST}:{port}/login.html", wait_until="domcontentloaded")
            try:
                pg.locator("#aegis-s-title", has_text="Phishing").wait_for(timeout=40000)
                chk("phishing warning on the fake bank page", True)
            except Exception as e:
                chk("phishing warning on the fake bank page", False, e)
            for sel in ("#aegis-xai-close", "#aegis-s-close", "#aegis-action-dismiss"):
                if pg.locator(sel).count():
                    try:
                        pg.locator(sel).first.click(timeout=2000)
                    except Exception:
                        pass
            try:
                pg.locator("input[name=pass]").click(timeout=5000, force=True)
                pg.keyboard.type("NotMyRealPass#1", delay=40)
                pg.get_by_text("Unsafe Login Form Detected").wait_for(timeout=20000)
                chk("credential alert while typing a password on the fake page", True)
            except Exception as e:
                chk("credential alert while typing a password on the fake page", False, e)

            # 4. links: normal, shadow DOM, iframe
            pg2 = ctx.new_page()
            pg2.goto(f"http://{SAFE_HOST}:{port}/links.html", wait_until="domcontentloaded")
            pg2.wait_for_timeout(15000)
            badges = pg2.evaluate("""() => {
                const after = (el) => el && el.nextElementSibling && el.nextElementSibling.classList.contains('aegis-link-badge') ? el.nextElementSibling.className : '';
                const sh = document.getElementById('host').shadowRoot.getElementById('shadow_bad');
                return {good: after(document.getElementById('good')), bad: after(document.getElementById('bad')), shadow: after(sh),
                        badStyle: document.getElementById('bad').style.borderBottom || ''};
            }""")
            frame_badge = ""
            for fr in pg2.frames:
                if fr != pg2.main_frame:
                    try:
                        frame_badge = fr.evaluate("() => { const a = document.getElementById('frame_bad'); const n = a && a.nextElementSibling; return n && n.classList.contains('aegis-link-badge') ? n.className : (a ? a.style.borderBottom : ''); }")
                    except Exception:
                        pass
            chk("dangerous link flagged", "danger" in badges["bad"] or "warning" in badges["bad"] or "solid" in badges["badStyle"], badges)
            chk("safe link not flagged", badges["good"] == "", badges)
            chk("dangerous link inside shadow DOM flagged", "aegis-link" in badges["shadow"], badges)
            chk("dangerous link inside an iframe flagged", bool(frame_badge), frame_badge)

            # 5. QR code
            pg3 = ctx.new_page()
            pg3.goto(f"http://{SAFE_HOST}:{port}/qr.html", wait_until="domcontentloaded")
            try:
                lab = pg3.locator("[data-aegis-qr-label]").first
                lab.wait_for(timeout=40000)
                txt = lab.inner_text()
                chk("QR code decoded and its destination shown", "hbl-verify-account.zzext-test.top" in txt, txt)
                chk("QR destination rated risky", "Dangerous" in txt or "Suspicious" in txt, txt)
            except Exception as e:
                chk("QR code decoded and its destination shown", False, e)

            # 6. download guard
            pg4 = ctx.new_page()
            pg4.goto(f"http://{SAFE_HOST}:{port}/download.html", wait_until="domcontentloaded")
            pg4.wait_for_timeout(15000)   # same settle time as the links page: the scanner scores links after load
            print("  #dl before click:", pg4.evaluate("() => { const a = document.getElementById('dl'); const n = a.nextElementSibling; "
                                                      "return JSON.stringify({danger: a.dataset.aegisDanger || null, badge: n ? n.className : null, style: a.style.borderBottom}); }"), flush=True)
            try:
                pg4.click("#dl")
            except Exception:
                pass
            # the link scanner may stop the click on a flagged link before any download exists (warning modal), or the
            # download guard may hold the file and ask: either protects the user
            try:
                pg4.locator("#aegis-dl-block, #aegis-warning-overlay").first.wait_for(timeout=40000)
                which = "download prompt" if pg4.locator("#aegis-dl-block").count() else "link warning"
                chk(f"click on a risky .exe link is stopped ({which})", True)
            except Exception as e:
                chk("click on a risky .exe link is stopped", False, e)
            # the download guard on its own: a download the page did not start through a link (e.g. a script)
            pg5 = ctx.new_page()
            pg5.goto(f"http://{SAFE_HOST}:{port}/docs.html", wait_until="domcontentloaded")
            pg5.bring_to_front()
            pg5.wait_for_timeout(2500)
            sw.evaluate(f"async () => {{ chrome.downloads.download({{url: 'http://{FILES_HOST}:{port}/Invoice_2026.exe'}}); }}")
            try:
                pg5.locator("#aegis-dl-block").wait_for(timeout=40000)
                chk("download guard holds a risky .exe and asks the user", True)
            except Exception as e:
                state = sw.evaluate("async () => JSON.stringify((await chrome.downloads.search({})).map(d => [d.url.slice(0, 60), d.state, d.error]))")
                chk("download guard holds a risky .exe and asks the user", False, f"{e} | downloads: {state}")

            # 7. local security-event log is encrypted
            raw = sw.evaluate("async () => JSON.stringify(await chrome.storage.local.get(null))")
            store = json.loads(raw)
            leaking = sorted(k for k, v in store.items() if any(h in json.dumps(v) for h in (PHISH_HOST, BAD_HOST)))
            chk("no visited phishing address readable in extension storage", not leaking, f"plain-text keys: {leaking}")
            downloads = sw.evaluate("async () => JSON.stringify(await chrome.downloads.search({}))")
            print("  downloads seen by the browser:", downloads[:600], flush=True)
            ctx.close()
    finally:
        httpd.shutdown()
        asyncio.run(_db("cleanup"))
        shutil.rmtree(site, ignore_errors=True)
        shutil.rmtree(profile, ignore_errors=True)
    print("ALL PASS" if all(res) else f"SOME FAILED ({res.count(False)} of {len(res)})")
    return all(res)


if __name__ == "__main__":
    ok = main(headed="--headed" in sys.argv)
    sys.exit(0 if ok else 1)
