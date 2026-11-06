"""Live check of guided incident recovery (module 8.15) against a running API on :8765.

report -> playbook with tracked steps -> contain (block) -> sign out / reset the person who typed a password ->
assign training -> warn everyone -> tick and untick steps -> metrics -> SLA watcher escalates an ignored incident
-> printable report shows the response. Creates a throw-away zz_rec_* organization and removes it afterwards.

    AEGIS_SLA_WATCH=0 python -m uvicorn api.main:app --port 8765     (the test runs the SLA pass itself, for its org only)
    PYTHONPATH=. python api/tests/live/live_incident_recovery.py
"""
import asyncio
import io
import json
import sys
import time
import urllib.request
from datetime import datetime, timedelta

sys.stdout = io.TextIOWrapper(sys.stdout.buffer, encoding="utf-8")
from sqlalchemy import delete, select  # noqa: E402

from api.auth.jwt_handler import create_access_token  # noqa: E402
from api.database.db import async_session, engine  # noqa: E402
from api.database.models import (AuditLog, CredentialEvent, Incident, IncidentReport, Notification, Organization,  # noqa: E402
                                 PasswordResetChallenge, Policy, TrainingAssignment, TrainingCandidate, User, WebsiteScan)
from api.services.secret_store import ensure_jwt_secret  # noqa: E402

BASE = "http://localhost:8765"
ORG = "zz_rec_org"
URL = "http://hbl-secure-login.zzrec-test.top/verify?id=7"
DOMAIN = "zzrec-test.top"
EMAILS = ["zz_rec_admin@x.invalid", "zz_rec_emp@x.invalid", "zz_rec_emp2@x.invalid", "zz_rec_emp3@x.invalid"]


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
        for model in (Notification, Policy, AuditLog, CredentialEvent, WebsiteScan, TrainingAssignment):
            await db.execute(delete(model).where(model.organization_id == ORG))
        await db.execute(delete(PasswordResetChallenge).where(PasswordResetChallenge.email.in_(EMAILS)))
        await db.execute(delete(User).where(User.organization_id == ORG))
        await db.execute(delete(Organization).where(Organization.id == ORG))
        await db.commit()


async def seed():
    await ensure_jwt_secret()
    async with async_session() as db:
        db.add(Organization(id=ORG, name="Recovery Test Org", plan="standard", timezone="UTC"))
        await db.commit()
        out = {}
        for key, email, role in zip(("admin", "emp", "emp2", "emp3"), EMAILS, ("admin", "employee", "employee", "employee")):
            u = User(email=email, password_hash="x", full_name=key.title(), role=role, account_status="approved", is_active=True, organization_id=ORG)
            db.add(u)
            await db.commit()
            await db.refresh(u)
            out[key] = (u.id, create_access_token({"sub": u.email}))
        # emp opened the page (blocked); emp2 opened it AND typed a password that was not blocked; emp3 never saw it
        for uid, sid, dec in ((out["emp"][0], "zzrec_s1", "block"), (out["emp2"][0], "zzrec_s2", "warn")):
            db.add(WebsiteScan(scan_id=sid, organization_id=ORG, user_id=uid, url=URL, domain="hbl-secure-login." + DOMAIN, scan_type="url",
                               risk_score=93, decision=dec, verdict="danger", threat_type="phishing", modules_used='["url"]', top_factors='["x"]'))
        db.add(CredentialEvent(credential_event_id="zzrec_c1", organization_id=ORG, user_id=str(out["emp2"][0]),
                               domain="hbl-secure-login." + DOMAIN, credential_type="password", blocked=False))
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
    res.append(bool(ok))
    print(("PASS " if ok else "FAIL ") + name + (f"  [{str(extra)[:300]}]" if extra and not ok else ""))


run(cleanup())
ids = run(seed())
adm, emp, emp2, emp3 = (ids[k][1] for k in ("admin", "emp", "emp2", "emp3"))

s, rep = call("POST", "/reports", emp, {"report_type": "phishing", "target_type": "url", "target_ref": URL, "scan_id": "zzrec_s1",
                                       "risk_score": 93, "predicted_class": "phishing", "user_notes": "Fake HBL login"})
chk("employee report creates an incident", s == 201, rep)
s, lst = call("GET", "/admin/incidents", adm)
inc = lst[0]["incident_id"] if s == 200 and lst else None
chk("incident list carries an SLA block", s == 200 and lst and "sla" in lst[0] and lst[0]["sla"]["target_minutes"] > 0, lst[:1])

s, bt = call("GET", f"/admin/incidents/{inc}/backtrace", adm)
pbk = bt.get("playbook", {}) if s == 200 else {}
chk("playbook has tracked steps with ids", s == 200 and pbk.get("steps_total", 0) >= 6 and pbk["phases"][0]["steps"][0]["id"] == "1.1", pbk)
chk("response summary present, nothing done yet", s == 200 and bt["response"]["contained_at"] is None and pbk.get("steps_done") == 0, bt.get("response"))

s, m = call("GET", "/admin/incidents/metrics?days=7", adm)
chk("metrics endpoint", s == 200 and m["incidents"] >= 1 and "time_to_contain_min" in m and m["sla"]["targets_min"]["critical"] > 0, m)
chk("employee cannot read metrics", call("GET", "/admin/incidents/metrics", emp)[0] == 403)
chk("employee cannot run response actions", call("POST", f"/admin/incidents/{inc}/actions", emp, {"action": "warn_organization"})[0] == 403)

s, r = call("POST", f"/admin/incidents/{inc}/actions", adm, {"action": "block_domain"})
chk("block domain", s == 200 and r.get("domain"), r)
s, bt = call("GET", f"/admin/incidents/{inc}/backtrace", adm)
first = bt["playbook"]["phases"][0]["steps"][0]
chk("block ticked step 1.1 with who/when", first["done"] and first["done_by"] == EMAILS[0] and first["done_at"], first)
chk("containment time recorded", bt["response"]["contained_at"] and bt["response"]["time_to_contain_min"] is not None, bt["response"])
chk("the action is on the timeline", any(t["event"].startswith("Response: block") for t in bt["timeline"]), bt["timeline"])

# sign out only the person who typed a password (default scope)
chk("emp2 token works before revocation", call("GET", "/notifications", emp2)[0] == 200)
s, r = call("POST", f"/admin/incidents/{inc}/actions", adm, {"action": "revoke_sessions"})
chk("revoke sessions targets the credential victim only", s == 200 and r.get("people") == [EMAILS[2]], r)
chk("emp2's old token is now rejected", call("GET", "/notifications", emp2)[0] == 401)
chk("emp (no password typed) is still signed in", call("GET", "/notifications", emp)[0] == 200)

s, r = call("POST", f"/admin/incidents/{inc}/actions", adm, {"action": "reset_credentials"})
chk("reset credentials signs out and issues a reset code", s == 200 and r.get("signed_out") == 1 and r.get("reset_codes_sent") == 1, r)


async def challenge_exists():
    async with async_session() as db:
        return (await db.execute(select(PasswordResetChallenge).where(PasswordResetChallenge.email == EMAILS[2]))).scalar_one_or_none() is not None
chk("a hashed reset code is stored for emp2", run(challenge_exists()))

s, r = call("POST", f"/admin/incidents/{inc}/actions", adm, {"action": "revoke_sessions", "user_ids": [ids["emp3"][0]]})
chk("explicit people can be chosen", s == 200 and r.get("people") == [EMAILS[3]], r)
chk("the acting admin is never signed out", call("GET", "/admin/incidents/metrics", adm)[0] == 200)

s, r = call("POST", f"/admin/incidents/{inc}/actions", adm, {"action": "assign_training"})
chk("training assigned to the exposed people", s == 200 and r.get("module") == "credential_safety" and r.get("assigned") == 2, r)
s, r = call("POST", f"/admin/incidents/{inc}/actions", adm, {"action": "assign_training"})
chk("assigning twice does not duplicate", s == 200 and r.get("assigned") == 0 and r.get("already_assigned") == 2, r)
s, r = call("POST", f"/admin/incidents/{inc}/actions", adm, {"action": "assign_training", "module": "nope"})
chk("unknown training module rejected", s == 400, r)

s, r = call("POST", f"/admin/incidents/{inc}/actions", adm, {"action": "warn_organization"})
chk("warn everyone reaches the 3 other people", s == 200 and r.get("notified") == 3, r)
s, r = call("POST", f"/admin/incidents/{inc}/actions", adm, {"action": "format_c_drive"})
chk("unknown action rejected", s == 400, r)

s, r = call("POST", f"/admin/incidents/{inc}/playbook/steps/2.1", adm, {"done": True, "note": "2 people opened it, 1 typed a password"})
chk("manual step tick", s == 200 and any(st["id"] == "2.1" and st["done"] and st["note"] for ph in r["playbook"]["phases"] for st in ph["steps"]), r)
done_now = r["playbook"]["steps_done"] if s == 200 else -1
s, r = call("POST", f"/admin/incidents/{inc}/playbook/steps/2.1", adm, {"done": False})
chk("untick", s == 200 and r["playbook"]["steps_done"] == done_now - 1, r)
chk("unknown step 404", call("POST", f"/admin/incidents/{inc}/playbook/steps/9.9", adm, {"done": True})[0] == 404)

s, html = call("GET", f"/admin/incidents/{inc}/report", adm, raw=True)
chk("printable report shows the response record", s == 200 and "Steps completed" in html and "Time to contain" in html and EMAILS[0] in html, str(html)[:200])


# SLA watcher: an ignored high-severity incident opened 3 hours ago is escalated exactly once
async def make_old_incident():
    async with async_session() as db:
        i = Incident(reported_by_id=ids["emp"][0], severity="high", status="open", incident_id="INC-ZZREC-OLD", organization_id=ORG,
                     report_type="phishing", created_at=datetime.utcnow() - timedelta(hours=3), evidence={"findings": ["test"]})
        db.add(i)
        await db.commit()


async def sla_pass():
    from api.services.incident_ops import check_sla_breaches
    n = await check_sla_breaches(ORG)
    async with async_session() as db:
        k = (await db.execute(select(Notification).where(Notification.organization_id == ORG, Notification.kind == "incident_sla_breach"))).scalars().all()
    return n, len(k)

run(make_old_incident())
n1, k1 = run(sla_pass())
chk("SLA watcher escalates the ignored incident to the admin", n1 >= 1 and k1 == 1, (n1, k1))
n2, k2 = run(sla_pass())
chk("...and only once", k2 == 1, (n2, k2))
s, m = call("GET", "/admin/incidents/metrics?days=7", adm)
chk("metrics count the breach", s == 200 and m["sla"]["breached"] >= 1 and m["sla"]["breaching_now"] >= 1, m.get("sla") if s == 200 else m)

print("ALL PASS" if all(res) else "SOME FAILED")
run(cleanup())
