"""
Live test: phishing simulation + training, and the enterprise API / webhooks.
Needs the API running on :8765 (see README). Creates and removes its own organization.
"""
import sys, io, json, re, time, asyncio, urllib.request, urllib.error
sys.stdout = io.TextIOWrapper(sys.stdout.buffer, encoding="utf-8")
from sqlalchemy import select, delete
from api.database.db import async_session, engine
from api.database.models import (User, Organization, Department, SimulationCampaign, SimulationTarget, TrainingAssignment,
                                 Notification, AuditLog, ApiKey, Webhook, WebhookDelivery, WebsiteScan, Policy, IncidentReport, Incident)
from api.services.secret_store import ensure_jwt_secret
from api.auth.jwt_handler import create_access_token
from api.services import integrations as integ

BASE = "http://localhost:8765"
ORG = "zz_aw_org"
BROWSER = {"User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/126.0 Safari/537.36"}


def run(c):
    async def w():
        try:
            return await c
        finally:
            await engine.dispose()
    return asyncio.run(w())


async def cleanup():
    async with async_session() as db:
        for m in (SimulationTarget, SimulationCampaign, TrainingAssignment, Notification, AuditLog, ApiKey, Webhook, WebhookDelivery, WebsiteScan, Policy):
            await db.execute(delete(m).where(m.organization_id == ORG))
        await db.execute(delete(User).where(User.organization_id == ORG))
        await db.execute(delete(Department).where(Department.organization_id == ORG))
        await db.execute(delete(Organization).where(Organization.id == ORG))
        await db.commit()


async def seed():
    await ensure_jwt_secret()
    async with async_session() as db:
        db.add(Organization(id=ORG, name="Awareness Test Org", plan="standard", timezone="UTC"))
        await db.commit()
        dep = Department(organization_id=ORG, name="Finance", code="FIN")
        db.add(dep); await db.commit(); await db.refresh(dep)
        out = {}
        for key, role in (("adm", "admin"), ("a", "employee"), ("b", "employee"), ("c", "employee")):
            u = User(email=f"zz_aw_{key}@x.invalid", password_hash="x", full_name=f"Person {key.upper()}", role=role,
                     account_status="approved", is_active=True, organization_id=ORG, department_id=dep.id, department="Finance")
            db.add(u); await db.commit(); await db.refresh(u)
            out[key] = (u.id, create_access_token({"sub": u.email}))
        db.add(WebsiteScan(scan_id="zz_aw_s1", organization_id=ORG, user_id=out["a"][0], url="http://evil.zz-aw.top/x", domain="evil.zz-aw.top",
                           scan_type="url", risk_score=95, decision="block", verdict="danger", threat_type="phishing", modules_used="[]", top_factors="[]"))
        db.add(Policy(organization_id=ORG, policy_type="blocklist", value="evil.zz-aw.top", action="block", enabled=True, priority=10))
        await db.commit()
        return out


def call(method, path, tok=None, js=None, headers=None, raw=False):
    h = {"Content-Type": "application/json"}
    if tok:
        h["Authorization"] = "Bearer " + tok
    h.update(headers or {})
    r = urllib.request.Request(BASE + path, data=json.dumps(js).encode() if js is not None else None, headers=h, method=method)
    try:
        resp = urllib.request.urlopen(r, timeout=60)
        body = resp.read()
        if raw:
            return resp.status, body.decode("utf-8", "replace"), dict(resp.headers)
        return resp.status, json.loads(body or b"null")
    except urllib.error.HTTPError as e:
        txt = e.read().decode()[:300]
        return (e.code, txt, dict(e.headers)) if raw else (e.code, txt)


res = []
def chk(name, ok, extra=""):
    res.append(bool(ok)); print(("PASS " if ok else "FAIL ") + name + (f"  [{extra}]" if extra and not ok else ""))


run(cleanup())
ids = run(seed())
adm, A, B, C = ids["adm"][1], ids["a"][1], ids["b"][1], ids["c"][1]

# ───────────────────────── awareness ─────────────────────────
s, tpls = call("GET", "/admin/awareness/templates", adm)
chk("template library available", s == 200 and len(tpls) >= 6 and all(t["red_flags"] for t in tpls), tpls)
s, _ = call("GET", "/admin/awareness/templates", A)
chk("employee cannot use admin awareness API", s == 403)

s, camp = call("POST", "/admin/awareness/campaigns", adm, {"name": "Test exercise", "template_key": "it_password_expiry"})
chk("campaign created for the audience (admin excluded)", s == 201 and camp["targets"] == 3, camp)
cid = camp["campaign_id"]
s, _ = call("POST", "/admin/awareness/campaigns", adm, {"name": "Bad", "template_key": "nope"})
chk("unknown template refused", s == 400)

s, lr = call("POST", f"/admin/awareness/campaigns/{cid}/launch", adm)
chk("launch (export mode)", s == 200 and lr["status"] == "active", lr)
s, lr2 = call("POST", f"/admin/awareness/campaigns/{cid}/launch?send_email=true", adm)
chk("e-mail launch refused without SMTP", s == 400, lr2)

s, csv_text, _h = call("GET", f"/admin/awareness/campaigns/{cid}/links.csv", adm, raw=True)
tokens = re.findall(r"/sim/([A-Za-z0-9_-]{20,64})", csv_text)
chk("mail-merge CSV has one unique link per person", s == 200 and len(set(tokens)) == 3, csv_text[:200])
chk("CSV rendering did not leave placeholders", "{first_name}" not in csv_text and "{link}" not in csv_text)

# who is who
async def owners():
    async with async_session() as db:
        rows = (await db.execute(select(SimulationTarget).where(SimulationTarget.campaign_id == cid))).scalars().all()
        return {t.user_id: t.token for t in rows}
own = run(owners())
tokA, tokB, tokC = own[ids["a"][0]], own[ids["b"][0]], own[ids["c"][0]]

s, page, _h = call("GET", f"/sim/{tokA}", headers=BROWSER, raw=True)
chk("tracked link shows the teaching page", s == 200 and "phishing simulation" in page.lower() and "What gave it away" in page, page[:200])
chk("teaching page escapes/has no form or script", "<form" not in page.lower() and "<script" not in page.lower())
s, _p, _h = call("GET", f"/sim/{tokA}", headers=BROWSER, raw=True)
s, _p, _h = call("GET", f"/sim/{tokB}", headers={"User-Agent": "Mozilla/5.0 (compatible; Proofpoint Link Scanner)"}, raw=True)
chk("mail-scanner prefetch is not counted as a click", s == 200)
s, bad, _h = call("GET", "/sim/not-a-real-token-123456789012", raw=True)
chk("unknown token -> 404", s == 404)

s, mine = call("GET", "/awareness/my", A)
assigned = [m for m in mine["modules"] if m["status"] == "assigned"]
chk("clicker got exactly one training module assigned", s == 200 and len(assigned) == 1 and mine["exercises"]["clicked"] == 1, mine)
s, mineB = call("GET", "/awareness/my", B)
chk("scanner-fetched person has nothing assigned", all(m["status"] != "assigned" for m in mineB["modules"]) and mineB["exercises"]["clicked"] == 0)
s, nA = call("GET", "/notifications", A)
chk("clicker is told in the dashboard", s == 200 and any(n["kind"] in ("simulation_click", "training_assigned") for n in nA["notifications"]), nA)

key = assigned[0]["key"]
s, m = call("GET", f"/awareness/modules/{key}", A)
chk("module served without answers", s == 200 and "answer" not in json.dumps(m["quiz"]) and len(m["lessons"]) >= 2, m)
s, r1 = call("POST", f"/awareness/modules/{key}/submit", A, {"answers": [0] * len(m["quiz"])})
chk("wrong answers do not complete it", s == 200 and not r1["passed"] or r1["score"] >= 70, r1)
from api.services import awareness_content as ac
good = [q["answer"] for q in ac.get_module(key)["quiz"]]
s, r2 = call("POST", f"/awareness/modules/{key}/submit", A, {"answers": good})
chk("right answers complete the module", s == 200 and r2["passed"] and r2["score"] == 100, r2)
s, mine2 = call("GET", "/awareness/my", A)
chk("module shows completed", [x for x in mine2["modules"] if x["key"] == key][0]["status"] == "completed", mine2)

s, rep = call("POST", "/reports", C, {"report_type": "phishing", "target_type": "url", "target_ref": f"https://x.invalid/sim/{tokC}", "risk_score": 80})
chk("reporting a simulation thanks the employee (no incident)", s == 200 and rep.get("simulation") is True, rep)
s, d = call("GET", f"/admin/awareness/campaigns/{cid}", adm)
outs = {p["name"]: p["outcome"] for p in d["people"]}
chk("results: A clicked, C reported, B no action", outs.get("Person A") == "clicked" and outs.get("Person C") == "reported" and outs.get("Person B") == "no action", outs)
s, ov = call("GET", "/admin/awareness/overview", adm)
chk("organisation overview", s == 200 and ov["targets"] == 3 and ov["clicked"] == 1 and ov["reported"] == 1 and isinstance(ov["awareness_score"], int), ov)
s, cl = call("POST", f"/admin/awareness/campaigns/{cid}/close", adm)
s, p2, _h = call("GET", f"/sim/{tokB}", headers=BROWSER, raw=True)
s, d2 = call("GET", f"/admin/awareness/campaigns/{cid}", adm)
chk("clicks after closing are not recorded", {p["name"]: p["outcome"] for p in d2["people"]}.get("Person B") == "no action")

# ───────────────────────── integrations ─────────────────────────
s, k = call("POST", "/admin/integrations/keys", adm, {"name": "SIEM", "scopes": ["incidents:read", "events:read"]})
chk("API key created and shown once", s == 201 and k["api_key"].startswith("aegis_"), k)
KEY = {"X-API-Key": k["api_key"]}
s, lst = call("GET", "/admin/integrations/keys", adm)
chk("listing never reveals the key", s == 200 and k["api_key"] not in json.dumps(lst))
s, inc = call("GET", "/api/v1/incidents", headers=KEY)
chk("API: incidents with a valid key", s == 200 and "incidents" in inc, inc)
s, _ = call("GET", "/api/v1/incidents", headers={"X-API-Key": "aegis_wrong"})
chk("API: bad key -> 401", s == 401)
s, _ = call("GET", "/api/v1/threat-feed", headers=KEY)
chk("API: missing scope -> 403", s == 403)
s, ev = call("GET", "/api/v1/events", headers=KEY)
chk("API: events feed (SIEM) is scoped to the org", s == 200 and len(ev["events"]) == 1 and ev["events"][0]["domain"] == "evil.zz-aw.top", ev)
s, cef, _h = call("GET", "/api/v1/events?format=cef", headers=KEY, raw=True)
chk("API: CEF output", s == 200 and cef.startswith("CEF:0|AegisOne|"), cef[:150])
s, k2 = call("POST", "/admin/integrations/keys", adm, {"name": "Intel", "scopes": ["intel:read"]})
s, tf = call("GET", "/api/v1/threat-feed", headers={"X-API-Key": k2["api_key"]})
chk("API: threat feed lists the org block list", s == 200 and "evil.zz-aw.top" in tf["blocklist"], tf)
s, _ = call("DELETE", f"/admin/integrations/keys/{k['key_id']}", adm)
s, _ = call("GET", "/api/v1/incidents", headers=KEY)
chk("revoked key stops working", s == 401)
s, _ = call("GET", "/admin/integrations/keys", A)
chk("employee cannot manage keys", s == 403)

s, w = call("POST", "/admin/integrations/webhooks", adm, {"url": "http://127.0.0.1:9/hook", "events": ["*"]})
chk("webhook to a private address refused (SSRF)", s == 400, w)
s, w = call("POST", "/admin/integrations/webhooks", adm, {"url": "http://169.254.169.254/latest", "events": ["*"]})
chk("webhook to cloud metadata address refused", s == 400, w)
s, w = call("POST", "/admin/integrations/webhooks", adm, {"url": "https://example.com/aegis", "events": ["critical_scan", "bogus"]})
chk("unknown event type refused", s == 400, w)
s, w = call("POST", "/admin/integrations/webhooks", adm, {"url": "https://example.com/aegis", "events": ["critical_scan"]})
chk("public webhook accepted, secret shown once", s == 201 and w["secret"].startswith("whsec_"), w)
s, lw = call("GET", "/admin/integrations/webhooks", adm)
chk("listing never reveals the secret", s == 200 and w["secret"] not in json.dumps(lw))

body = b'{"event":"x"}'
hdr = integ.sign("whsec_test", int(time.time()), body)
chk("signature verifies", integ.verify_signature("whsec_test", hdr, body))
chk("tampered body fails", not integ.verify_signature("whsec_test", hdr, b'{"event":"y"}'))
chk("wrong secret fails", not integ.verify_signature("other", hdr, body))
chk("old timestamp is rejected (replay)", not integ.verify_signature("whsec_test", integ.sign("whsec_test", int(time.time()) - 3600, body), body))
s, t = call("POST", f"/admin/integrations/webhooks/{w['webhook_id']}/test", adm)
chk("test delivery attempted and logged", s == 200 and "ok" in t, t)
s, dl = call("GET", "/admin/integrations/deliveries", adm)
chk("delivery log recorded", s == 200 and len(dl) >= 1, dl)

print("ALL PASS" if all(res) else "SOME FAILED")
run(cleanup())
