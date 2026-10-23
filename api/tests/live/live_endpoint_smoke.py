import sys, io, json, asyncio, urllib.request
sys.stdout = io.TextIOWrapper(sys.stdout.buffer, encoding="utf-8")
from sqlalchemy import select, delete
from api.database.db import async_session, engine
from api.database.models import User, Organization, Policy, WebsiteScan, Notification
from api.services.secret_store import ensure_jwt_secret
from api.auth.jwt_handler import create_access_token
BASE = "http://localhost:8765"; ORG = "zz_smoke_org"

def run(c):
    async def w():
        try: return await c
        finally: await engine.dispose()
    return asyncio.run(w())

async def cleanup():
    async with async_session() as db:
        await db.execute(delete(Notification).where(Notification.organization_id == ORG))
        await db.execute(delete(Policy).where(Policy.organization_id == ORG))
        await db.execute(delete(WebsiteScan).where(WebsiteScan.organization_id == ORG))
        await db.execute(delete(User).where(User.organization_id == ORG))
        await db.execute(delete(Organization).where(Organization.id == ORG))
        await db.commit()

async def seed():
    await ensure_jwt_secret()
    async with async_session() as db:
        db.add(Organization(id=ORG, name="Smoke", plan="standard", timezone="UTC")); await db.commit()
        out = {}
        for k, e, r in (("adm", "zz_smoke_adm@x.invalid", "admin"), ("emp", "zz_smoke_emp@x.invalid", "employee")):
            u = User(email=e, password_hash="x", full_name=k, role=r, account_status="approved", is_active=True, organization_id=ORG)
            db.add(u); await db.commit(); await db.refresh(u); out[k] = create_access_token({"sub": e})
        return out

def call(method, path, tok, js=None):
    h = {"Content-Type": "application/json", "Authorization": "Bearer " + tok}
    r = urllib.request.Request(BASE + path, data=json.dumps(js).encode() if js is not None else None, headers=h, method=method)
    try:
        resp = urllib.request.urlopen(r, timeout=60); return resp.status, json.loads(resp.read() or b"null")
    except urllib.error.HTTPError as e:
        return e.code, e.read().decode()[:200]

run(cleanup()); t = run(seed()); bad = 0
for method, path, tok, js in (
    ("GET", "/user/credentials", t["emp"], None), ("GET", "/user/recommendations", t["emp"], None),
    ("GET", "/user/downloads", t["emp"], None), ("GET", "/user/media", t["emp"], None),
    ("GET", "/user/url-intelligence", t["emp"], None), ("GET", "/user/analytics", t["emp"], None),
    ("GET", "/user/alerts", t["emp"], None), ("GET", "/user/timeline", t["emp"], None),
    ("GET", "/user/stats", t["emp"], None), ("GET", "/admin/users", t["adm"], None),
    ("POST", "/policy/allowlist", t["emp"], {"domain": "Example-Allow.test"}),
    ("GET", "/notifications", t["adm"], None), ("GET", "/admin/incidents/stats", t["adm"], None),
):
    s, b = call(method, path, tok, js)
    ok = s == 200; bad += not ok
    print(("PASS " if ok else "FAIL ") + f"{method} {path} -> {s}" + ("" if ok else f" {b}"))
async def pol():
    async with async_session() as db:
        return [(p.policy_type, p.value) for p in (await db.execute(select(Policy).where(Policy.organization_id == ORG))).scalars().all()]
print("allowlist rows:", run(pol()))
run(cleanup())
print("SMOKE OK" if not bad else f"{bad} FAILED")
