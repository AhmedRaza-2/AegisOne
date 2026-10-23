import sys, io, json, asyncio, urllib.request
sys.stdout = io.TextIOWrapper(sys.stdout.buffer, encoding="utf-8")
from sqlalchemy import select, delete
from api.database.db import async_session
from api.database.models import User, Organization, WebsiteScan, Department
from api.services.secret_store import ensure_jwt_secret
from api.auth.jwt_handler import create_access_token
from api.database.db import engine
def run(c):
    async def w():
        try: return await c
        finally: await engine.dispose()
    return asyncio.run(w())
BASE = "http://localhost:8765"
TA, TB = "zz_tenant_a", "zz_tenant_b"

async def seed():
    await ensure_jwt_secret()
    async with async_session() as db:
        for o in (TA, TB):
            if not (await db.execute(select(Organization).where(Organization.id == o))).scalars().first():
                db.add(Organization(id=o, name=o, plan="standard", timezone="UTC"))
        await db.commit()
        out = {}
        for key, email, org, role in (("a_admin","zz_a_admin@x.invalid",TA,"admin"),("b_admin","zz_b_admin@x.invalid",TB,"admin"),("b_emp","zz_b_emp@x.invalid",TB,"employee")):
            u = (await db.execute(select(User).where(User.email == email))).scalars().first()
            if not u:
                u = User(email=email, password_hash="x", full_name=key, role=role, account_status="approved", is_active=True, organization_id=org)
                db.add(u); await db.commit(); await db.refresh(u)
            out[key] = (u.id, create_access_token({"sub": u.email}))
        db.add(WebsiteScan(scan_id="zz_scan_b1", organization_id=TB, user_id=out["b_emp"][0], url="http://evil.test/b", domain="evil.test", decision="block", risk_score=95))
        db.add(Department(organization_id=TB, name="BDept", code="BD"))
        await db.commit()
        return out

def call(method, path, tok=None, js=None):
    h = {"Content-Type": "application/json"}
    if tok: h["Authorization"] = "Bearer " + tok
    r = urllib.request.Request(BASE + path, data=json.dumps(js).encode() if js is not None else None, headers=h, method=method)
    try:
        resp = urllib.request.urlopen(r, timeout=30); return resp.status, json.loads(resp.read() or b"null")
    except urllib.error.HTTPError as e:
        return e.code, e.read().decode()[:150]

async def count_b():
    async with async_session() as db:
        s = len((await db.execute(select(WebsiteScan).where(WebsiteScan.scan_id == "zz_scan_b1"))).scalars().all())
        d = len((await db.execute(select(Department).where(Department.organization_id == TB))).scalars().all())
        u = len((await db.execute(select(User).where(User.organization_id == TB))).scalars().all())
        return s, d, u

async def cleanup():
    async with async_session() as db:
        await db.execute(delete(WebsiteScan).where(WebsiteScan.scan_id == "zz_scan_b1"))
        await db.execute(delete(Department).where(Department.organization_id.in_([TA, TB])))
        await db.execute(delete(User).where(User.organization_id.in_([TA, TB])))
        await db.execute(delete(Organization).where(Organization.id.in_([TA, TB])))
        await db.commit()

run(cleanup())
ids = run(seed())
ta, tb, te = ids["a_admin"][1], ids["b_admin"][1], ids["b_emp"][1]
res = []
def chk(name, ok): res.append(ok); print(("PASS " if ok else "FAIL ") + name)
chk("A admin cannot read B structure", call("GET", f"/setup/structure/{TB}", ta)[0] == 403)
chk("A admin can read own structure", call("GET", f"/setup/structure/{TA}", ta)[0] == 200)
chk("unauthenticated email-status rejected", call("GET", "/setup/email-status/abc")[0] in (401, 403))
chk("unauthenticated dispatch-status rejected", call("GET", "/setup/dispatch-status/abc")[0] in (401, 403))
chk("A cannot save structure into B", call("POST", "/setup/structure/save", ta, {"orgId": TB, "departments": [], "employees": []})[0] == 403)
s, a = call("GET", "/user/alerts", ta); chk("A /user/alerts shows nothing from B", "evil.test" not in json.dumps(a))
s, a = call("GET", "/user/timeline", ta); chk("A /user/timeline shows nothing from B", "evil.test" not in json.dumps(a))
s, a = call("GET", "/user/alerts", te); chk("B employee sees own alert", "evil.test" in json.dumps(a))
chk("A cannot DM B user", call("POST", "/communication/send", ta, {"msg_type":"direct","receiver_id":ids["b_emp"][0],"content":"hi","title":"t"})[0] == 404)
chk("A cannot broadcast to B dept", call("POST", "/communication/send", ta, {"msg_type":"broadcast","department_id":1,"content":"x","title":"t"})[0] in (403,404))
before = run(count_b())
st, _ = call("POST", "/setup/reset-organization", ta)
after = run(count_b())
chk(f"A reset leaves B data intact (status {st}, before {before}, after {after})", st == 200 and before == after)
print("ALL PASS" if all(res) else "SOME FAILED")
run(cleanup())
