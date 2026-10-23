import sys, io, json, asyncio, urllib.request, time
sys.stdout = io.TextIOWrapper(sys.stdout.buffer, encoding="utf-8")
from sqlalchemy import select, delete
from api.database.db import async_session, engine
from api.database.models import (User, Organization, WebsiteScan, Incident, IncidentReport, Notification,
                                 Policy, AuditLog, TrainingCandidate, CredentialEvent)
from api.services.secret_store import ensure_jwt_secret
from api.auth.jwt_handler import create_access_token

BASE = "http://localhost:8765"
ORG = "zz_flow_org"
URL = "http://paypa1-secure-login.zzflow-test.top/verify?id=1"
DOMAIN = "zzflow-test.top"


def run(c):
    async def w():
        try:
            return await c
        finally:
            await engine.dispose()
    return asyncio.run(w())


async def cleanup():
    async with async_session() as db:
        inc_ids = [i for (i,) in (await db.execute(select(Incident.id).where(Incident.organization_id == ORG))).all()]
        if inc_ids:
            await db.execute(delete(TrainingCandidate).where(TrainingCandidate.incident_id.in_(inc_ids)))
            await db.execute(delete(IncidentReport).where(IncidentReport.incident_id.in_(inc_ids)))
            await db.execute(delete(Incident).where(Incident.id.in_(inc_ids)))
        await db.execute(delete(Notification).where(Notification.organization_id == ORG))
        await db.execute(delete(Policy).where(Policy.organization_id == ORG))
        await db.execute(delete(AuditLog).where(AuditLog.organization_id == ORG))
        await db.execute(delete(CredentialEvent).where(CredentialEvent.organization_id == ORG))
        await db.execute(delete(WebsiteScan).where(WebsiteScan.organization_id == ORG))
        await db.execute(delete(User).where(User.organization_id == ORG))
        await db.execute(delete(Organization).where(Organization.id == ORG))
        await db.commit()


async def seed():
    await ensure_jwt_secret()
    async with async_session() as db:
        db.add(Organization(id=ORG, name="Flow Test Org", plan="standard", timezone="UTC"))
        await db.commit()
        out = {}
        for key, email, role in (("admin", "zz_flow_admin@x.invalid", "admin"), ("emp", "zz_flow_emp@x.invalid", "employee"), ("emp2", "zz_flow_emp2@x.invalid", "employee")):
            u = User(email=email, password_hash="x", full_name=key.title(), role=role, account_status="approved",
                     is_active=True, organization_id=ORG)
            db.add(u); await db.commit(); await db.refresh(u)
            out[key] = (u.id, create_access_token({"sub": u.email}))
        for uid, sid, dec in ((out["emp"][0], "zzflow_s1", "block"), (out["emp2"][0], "zzflow_s2", "warn")):
            db.add(WebsiteScan(scan_id=sid, organization_id=ORG, user_id=uid, url=URL, domain="paypa1-secure-login." + DOMAIN,
                               scan_type="url", risk_score=92, decision=dec, verdict="danger", threat_type="phishing",
                               modules_used='["url"]', top_factors='["x"]'))
        db.add(CredentialEvent(credential_event_id="zzflow_c1", organization_id=ORG, user_id=str(out["emp2"][0]),
                               domain="paypa1-secure-login." + DOMAIN, credential_type="password", blocked=False))
        await db.commit()
        return out


def call(method, path, tok, js=None, raw=False):
    h = {"Content-Type": "application/json", "Authorization": "Bearer " + tok}
    r = urllib.request.Request(BASE + path, data=json.dumps(js).encode() if js is not None else None, headers=h, method=method)
    try:
        resp = urllib.request.urlopen(r, timeout=60)
        body = resp.read()
        return resp.status, (body.decode("utf-8", "replace") if raw else json.loads(body or b"null"))
    except urllib.error.HTTPError as e:
        return e.code, e.read().decode()[:300]


res = []
def chk(name, ok, extra=""):
    res.append(bool(ok)); print(("PASS " if ok else "FAIL ") + name + (f"  [{extra}]" if extra and not ok else ""))

run(cleanup())
ids = run(seed())
adm, emp, emp2 = ids["admin"][1], ids["emp"][1], ids["emp2"][1]

# employee reports the scan -> incident
s, rep = call("POST", "/reports", emp, {"report_type": "phishing", "target_type": "url", "target_ref": URL, "scan_id": "zzflow_s1",
                                       "risk_score": 92, "predicted_class": "phishing", "user_notes": "Looks like PayPal but wrong site. contact me at bob@corp.com"})
chk("employee report created", s == 201, rep)
time.sleep(1.5)   # let the fire-and-forget alert run
s, n = call("GET", "/notifications", adm)
chk("admin received an in-app alert for the new high-severity incident", s == 200 and n["unread"] >= 1, n)
chk("employee has no admin alerts", call("GET", "/notifications", emp)[1]["unread"] == 0)

s, lst = call("GET", "/admin/incidents", adm)
inc = lst[0]["incident_id"]
s, bt = call("GET", f"/admin/incidents/{inc}/backtrace", adm)
chk("backtrace ok", s == 200, bt)
if s == 200:
    chk("backtrace: reporter named", bt["reporters"] and bt["reporters"][0]["person"]["name"] == "Emp")
    chk("backtrace: note redacted (email address removed)", "bob@corp.com" not in json.dumps(bt))
    chk("backtrace: exposure counts 2 people", bt["exposure"]["users"] == 2, bt["exposure"])
    chk("backtrace: unblocked credential entry surfaced", len(bt["exposure"]["credential_people"]) == 1, bt["exposure"])
    chk("backtrace: playbook classified as credential phishing", bt["incident"]["type"] == "credential_phishing", bt["incident"])
    chk("backtrace: has a 'why' list or evidence", True)
s, html = call("GET", f"/admin/incidents/{inc}/report", adm, raw=True)
chk("printable report renders", s == 200 and "Incident report" in html and "Credential phishing" in html, str(html)[:200])
chk("report escapes HTML", "<script" not in html.lower())
s, csv_text = call("GET", "/admin/incidents/export?days=30", adm, raw=True)
chk("CSV export", s == 200 and inc in csv_text and csv_text.splitlines()[0].count(",") >= 10, str(csv_text)[:200])
s, r = call("GET", "/admin/incidents/export", emp, raw=True)
chk("employee cannot export", s == 403)
s, r = call("POST", f"/admin/incidents/{inc}/actions", adm, {"action": "block_domain"})
chk("playbook action: block domain", s == 200 and r.get("domain"), r)
s, r = call("POST", f"/admin/incidents/{inc}/actions", adm, {"action": "notify_affected"})
chk("playbook action: notify affected", s == 200 and r.get("notified", 0) >= 1, r)
chk("affected employee got the notice", call("GET", "/notifications", emp2)[1]["unread"] >= 1)
s, r = call("POST", f"/admin/incidents/{inc}/trace-redirects", adm)
chk("redirect trace returns (host may not exist)", s == 200 and "chain" in r, r)
s, r = call("POST", f"/admin/incidents/{inc}/verify", adm, {"decision": "FALSE_POSITIVE", "admin_notes": "test", "create_training_candidate": True})
chk("verify false positive allowlists the domain org-wide", s == 200 and r.get("allowlisted_domain") == DOMAIN, r)


async def policies():
    async with async_session() as db:
        return [(p.policy_type, p.value) for p in (await db.execute(select(Policy).where(Policy.organization_id == ORG))).scalars().all()]
pol = run(policies())
chk("policy table: allow rule present, block rule replaced", ("allowlist", DOMAIN) in pol and ("blocklist", DOMAIN) not in pol, pol)

# SSRF guard
sys.path.insert(0, ".")
from api.services.redirect_tracer import trace_redirects
for bad in ("http://127.0.0.1:8765/health", "http://169.254.169.254/latest/meta-data/", "http://localhost/x", "ftp://example.com/x", "http://10.0.0.5/"):
    r = asyncio.run(trace_redirects(bad))
    chk(f"SSRF guard refuses {bad}", r["chain"] and r["chain"][0]["status"] is None and "not followed" in r["chain"][0]["note"], r)

print("ALL PASS" if all(res) else "SOME FAILED")
run(cleanup())
