"""
Live end-to-end test of the improved-weights pipeline, with ONE server acting as both the
organisation core and the vendor hub. Start it like this (relaxed FPR gate so synthetic data passes):

  AEGIS_VENDOR_MODE=1 AEGIS_VENDOR_URL=http://localhost:8765 AEGIS_VENDOR_DEV_ALLOW=1 \
  VENDOR_ADMIN_KEY=hubkey ORG_ID=zz_hub_org LICENSE_KEY=K DEPLOYMENT_TOKEN=T \
  AEGIS_GATE_MAX_FPR_RISE=0.03 AEGIS_DATA_DIR=/tmp/aegis_hub_data \
  python -m uvicorn api.main:app --port 8765

then:  python api/tests/live/live_model_hub.py
Takes several minutes the first time (benchmark embeddings are computed once and cached).
"""
import sys, io, json, time, asyncio, urllib.request, uuid
sys.stdout = io.TextIOWrapper(sys.stdout.buffer, encoding="utf-8")
import pandas as pd
from sqlalchemy import delete
from api.database.db import async_session, engine
from api.database.models import (User, Organization, TrainingCandidate, TrainingJob, ModelVersion, OrgLearningPolicy,
                                 WeightPackage, VendorSubmission, GlobalModelRelease, AuditLog)
from api.services.secret_store import ensure_jwt_secret
from api.auth.jwt_handler import create_access_token

BASE = "http://localhost:8765"
ORG = "zz_hub_org"
ADM_KEY = "hubkey"


def run(c):
    async def w():
        try:
            return await c
        finally:
            await engine.dispose()
    return asyncio.run(w())


async def cleanup():
    async with async_session() as db:
        for m in (TrainingCandidate, TrainingJob, ModelVersion, OrgLearningPolicy, WeightPackage, AuditLog):
            await db.execute(delete(m).where(m.organization_id == ORG))
        await db.execute(delete(VendorSubmission).where(VendorSubmission.organization_id == ORG))
        await db.execute(delete(GlobalModelRelease).where(GlobalModelRelease.source_org_id == ORG))
        await db.execute(delete(User).where(User.organization_id == ORG))
        await db.execute(delete(Organization).where(Organization.id == ORG))
        await db.commit()


async def seed():
    await ensure_jwt_secret()
    ph = pd.read_csv("AIML/url/verified_online.csv").sort_values("submission_time").tail(120)["url"].astype(str).tolist()
    be = pd.read_csv("AIML/url/v7_val.csv", usecols=["url", "label"]).query("label == 0").sample(120, random_state=3)["url"].astype(str).tolist()
    async with async_session() as db:
        db.add(Organization(id=ORG, name="Hub Test Org", plan="standard", timezone="UTC"))
        await db.commit()
        u = User(email="zz_hub_admin@x.invalid", password_hash="x", full_name="Hub Admin", role="admin",
                 account_status="approved", is_active=True, organization_id=ORG)
        db.add(u)
        db.add(OrgLearningPolicy(organization_id=ORG, allow_global_contribution=True))
        for i, (url, lab) in enumerate([(x, "phishing") for x in ph] + [(x, "benign") for x in be]):
            db.add(TrainingCandidate(candidate_id=f"zzhub_{i}", organization_id=ORG, model_type="url", label=lab,
                                     content_fingerprint=f"zzhub_fp_{i}", status="pending",
                                     sample_data={"target_ref": url, "risk_score": 80 if lab == "phishing" else 10}))
        await db.commit()
        return create_access_token({"sub": u.email})


def call(method, path, tok=None, js=None, headers=None, raw=False):
    h = {"Content-Type": "application/json"}
    if tok:
        h["Authorization"] = "Bearer " + tok
    h.update(headers or {})
    r = urllib.request.Request(BASE + path, data=json.dumps(js).encode() if js is not None else None, headers=h, method=method)
    try:
        resp = urllib.request.urlopen(r, timeout=120)
        body = resp.read()
        return resp.status, (body if raw else json.loads(body or b"null"))
    except urllib.error.HTTPError as e:
        return e.code, e.read().decode()[:300]


res = []
def chk(name, ok, extra=""):
    res.append(bool(ok)); print(("PASS " if ok else "FAIL ") + name + (f"  [{extra}]" if extra and not ok else ""))


def wait(fn, timeout=1800, every=10):
    t0 = time.time()
    while time.time() - t0 < timeout:
        v = fn()
        if v:
            return v
        time.sleep(every)
    return None


run(cleanup())
tok = run(seed())
ORGH = {"X-Org-Id": ORG, "X-License-Key": "K", "X-Deployment-Token": "T"}
ADMH = {"X-Vendor-Admin-Key": ADM_KEY}

s, st = call("GET", "/admin/model-updates/status", tok)
chk("status endpoint", s == 200 and st["verified_url_samples"] == 240 and st["vendor_configured"], st)

s, j = call("POST", "/admin/model-updates/train", tok)
chk("training job accepted", s == 202, j)
job_id = j["job_id"]

def job_done():
    s, jobs = call("GET", "/admin/training-jobs", tok)
    for x in jobs if isinstance(jobs, list) else []:
        if x["job_id"] == job_id and x["status"] in ("completed", "rejected", "failed"):
            return x
job = wait(job_done)
chk("training job finished", job is not None)
print("   job:", job["status"], (job.get("error_message") or "")[:200])
chk("job completed (candidate beat the base within the gate)", job and job["status"] == "completed", job and job.get("error_message"))

if job and job["status"] == "completed":
    s, pk = call("GET", "/admin/model-updates/packages", tok)
    chk("package created", s == 200 and len(pk) == 1 and pk[0]["status"] == "validated", pk)
    pid = pk[0]["package_id"]

    s, sub = call("POST", f"/admin/model-updates/packages/{pid}/submit", tok)
    chk("package submitted to the vendor hub", s == 200 and sub["status"] == "submitted", sub)

    def verdict():
        s, v = call("GET", f"/admin/model-updates/packages/{pid}/vendor-status", tok)
        if s == 200 and v["vendor_verdict"] and v["vendor_verdict"]["status"] in ("approved", "rejected", "failed"):
            return v
    v = wait(verdict)
    chk("vendor evaluated the submission", v is not None)
    print("   vendor verdict:", v and v["vendor_verdict"]["status"], v and (v["vendor_verdict"].get("reason") or ""))
    chk("vendor promoted it to a release", v and v["vendor_verdict"]["status"] == "approved" and v["vendor_verdict"]["release_id"], v and v["vendor_verdict"])

    s, ov = call("GET", "/vendor/admin/overview", headers=ADMH)
    chk("vendor admin overview works", s == 200 and ov["active_releases"] >= 1, ov)
    s, _ = call("GET", "/vendor/admin/overview", headers={"X-Vendor-Admin-Key": "nope"})
    chk("vendor admin rejects a wrong key", s == 403)
    s, _ = call("GET", "/vendor/releases", headers={"X-Org-Id": ORG, "X-License-Key": "", "X-Deployment-Token": ""})
    chk("hub rejects missing org credentials", s == 401)

    # The org is running the heads it trained itself, which ARE the release. Same thing -> "already active".
    s, rl = call("GET", "/admin/model-updates/releases", tok)
    chk("org sees the release", s == 200 and len(rl["releases"]) >= 1, rl)
    s, rv = call("POST", "/admin/model-updates/revert", tok)       # now run the shipped base, so the release is a real upgrade
    chk("revert to shipped base before adopting the release", s == 200, rv)
    rid = rl["releases"][0]["release_id"]
    s, d = call("POST", f"/admin/model-updates/releases/{rid}/deploy", tok)
    chk("deploy job accepted", s == 202, d)
    djob = d["job_id"]

    def deploy_done():
        s, jobs = call("GET", "/admin/training-jobs", tok)
        for x in jobs if isinstance(jobs, list) else []:
            if x["job_id"] == djob and x["status"] in ("completed", "rejected", "failed"):
                return x
    dj = wait(deploy_done)
    print("   deploy:", dj and dj["status"], dj and (dj.get("error_message") or ""))
    chk("release validated on local data and deployed", dj and dj["status"] == "completed", dj and dj.get("error_message"))

    s, rv = call("POST", "/admin/model-updates/revert", tok)
    chk("revert to shipped base", s == 200, rv)

    # tampered package is refused by the hub
    s, _ = call("POST", "/vendor/submissions", headers=ORGH)
    chk("hub refuses an empty submission", s in (400, 422))

print("ALL PASS" if all(res) else "SOME FAILED")
run(cleanup())
