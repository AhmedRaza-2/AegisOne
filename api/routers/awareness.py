"""
AegisOne API — security awareness: phishing simulation + training
==================================================================
  Admin   /admin/awareness/*   templates, campaigns, tracked links, results, organisation score, assign training
  Staff   /awareness/*         my training, take a module (lesson + quiz), my simulation record
  Public  /sim/{token}         the tracked link. Records the click, then teaches (never collects anything)

How a simulation works
  1. The admin picks a template and an audience. Every employee gets their OWN unguessable link.
  2. The message is delivered either by AegisOne through the organisation's own SMTP (optional) or by
     exporting the links as a mail-merge CSV.
  3. Clicking the link records the click and immediately shows what to look for (the red flags of THAT
     message), assigns a matching training module and tells the employee in the dashboard.
  4. Reporting the message through AegisOne marks it "reported" (the behaviour we want) and it is
     answered with a thank-you instead of opening an incident.
Nothing typed by the employee is ever captured: the landing page has no form.
"""
import csv
import html
import io
import logging
import re
import secrets
import uuid
from collections import defaultdict
from datetime import datetime
from typing import List, Optional

from fastapi import APIRouter, Depends, HTTPException, Query, Request, BackgroundTasks, Response
from fastapi.responses import HTMLResponse
from pydantic import BaseModel, Field
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.future import select
from sqlalchemy import func

from api.database.db import get_db
from api.database.models import (
    User, Organization, Department, SimulationCampaign, SimulationTarget, TrainingAssignment, Notification, AuditLog,
)
from api.dependencies import get_current_user
from api.auth.roles import Role, require_role
from api.services import awareness_content as content

logger = logging.getLogger("aegisone.awareness")

admin_router = APIRouter(prefix="/admin/awareness", tags=["Awareness"])
staff_router = APIRouter(prefix="/awareness", tags=["Awareness"])
public_router = APIRouter(tags=["Awareness (public)"])

_BOT_UA = re.compile(r"bot|crawl|spider|preview|safelinks|proofpoint|mimecast|barracuda|curl|python|wget|scanner|slurp|facebookexternalhit|headless", re.I)


def _org(u: User) -> str:
    return u.organization_id or "org_default"


def _csv_safe(v) -> str:
    s = "" if v is None else str(v)
    return "'" + s if s[:1] in ("=", "+", "-", "@", "\t", "\r") else s


def _public_api_base(request: Request) -> str:
    import os
    return (os.environ.get("AEGIS_PUBLIC_API_URL") or str(request.base_url)).rstrip("/")


def _org_domain_word(org: Optional[Organization]) -> str:
    name = (org.domain or org.name or "company") if org else "company"
    return re.sub(r"[^a-z0-9]+", "", name.lower().split(".")[0]) or "company"


# ═════════════════════════════════════════════════════════════════════════════════════
# Admin
# ═════════════════════════════════════════════════════════════════════════════════════

@admin_router.get("/templates")
async def templates(_: User = Depends(require_role(Role.OFFICE_ADMIN))):
    return [{"key": t["key"], "name": t["name"], "category": t["category"], "difficulty": content.DIFFICULTY[t["difficulty"]],
             "difficulty_level": t["difficulty"], "subject": t["subject"], "red_flags": t["red_flags"], "module": t["module"]}
            for t in content.TEMPLATES]


class CampaignCreate(BaseModel):
    name: str = Field(..., min_length=3, max_length=160)
    template_key: str
    department_id: Optional[int] = None     # None = everyone


@admin_router.post("/campaigns", status_code=201)
async def create_campaign(body: CampaignCreate, user: User = Depends(require_role(Role.ADMIN)), db: AsyncSession = Depends(get_db)):
    org = _org(user)
    if not content.get_template(body.template_key):
        raise HTTPException(status_code=400, detail="Unknown template.")
    q = select(User).where(User.organization_id == org, User.is_active == True, User.account_status.in_(["approved", "active"]),  # noqa: E712
                           User.role.in_(["employee", "manager", "office_admin", "department_admin"]), User.id != user.id)
    if body.department_id is not None:
        dep = (await db.execute(select(Department).where(Department.id == body.department_id, Department.organization_id == org))).scalar_one_or_none()
        if not dep:
            raise HTTPException(status_code=404, detail="Department not found.")
        q = q.where(User.department_id == body.department_id)
    targets = (await db.execute(q)).scalars().all()
    if not targets:
        raise HTTPException(status_code=400, detail="That audience has no active employees.")
    cid = f"SIM-{uuid.uuid4().hex[:8].upper()}"
    db.add(SimulationCampaign(campaign_id=cid, organization_id=org, name=body.name.strip(), template_key=body.template_key,
                              audience={"type": "department" if body.department_id is not None else "all", "department_id": body.department_id},
                              status="draft", created_by=user.email))
    for t in targets:
        db.add(SimulationTarget(campaign_id=cid, organization_id=org, user_id=t.id, token=secrets.token_urlsafe(24)))
    db.add(AuditLog(organization_id=org, actor_email=user.email, action="SIMULATION_CREATED", module="awareness",
                    target=f"{cid} '{body.name}' ({body.template_key}) for {len(targets)} people", result="success", ip_address="127.0.0.1"))
    await db.commit()
    return {"campaign_id": cid, "targets": len(targets), "status": "draft"}


def _stats(targets) -> dict:
    n = len(targets)
    clicked = sum(1 for t in targets if t.clicked_at)
    reported = sum(1 for t in targets if t.reported_at)
    return {"targets": n, "sent": sum(1 for t in targets if t.sent_at), "clicked": clicked, "reported": reported,
            "click_rate": round(clicked / n, 3) if n else 0.0, "report_rate": round(reported / n, 3) if n else 0.0}


@admin_router.get("/campaigns")
async def campaigns(user: User = Depends(require_role(Role.OFFICE_ADMIN)), db: AsyncSession = Depends(get_db)):
    org = _org(user)
    camps = (await db.execute(select(SimulationCampaign).where(SimulationCampaign.organization_id == org)
                              .order_by(SimulationCampaign.created_at.desc()))).scalars().all()
    by: dict = defaultdict(list)
    for t in (await db.execute(select(SimulationTarget).where(SimulationTarget.organization_id == org))).scalars().all():
        by[t.campaign_id].append(t)
    out = []
    for c in camps:
        tpl = content.get_template(c.template_key) or {}
        out.append({"campaign_id": c.campaign_id, "name": c.name, "template": tpl.get("name", c.template_key), "category": tpl.get("category"),
                    "difficulty": content.DIFFICULTY.get(tpl.get("difficulty", 1)), "status": c.status, "audience": c.audience,
                    "created_at": c.created_at, "launched_at": c.launched_at, **_stats(by.get(c.campaign_id, []))})
    return out


@admin_router.get("/campaigns/{campaign_id}")
async def campaign_detail(campaign_id: str, user: User = Depends(require_role(Role.OFFICE_ADMIN)), db: AsyncSession = Depends(get_db)):
    org = _org(user)
    c = (await db.execute(select(SimulationCampaign).where(SimulationCampaign.campaign_id == campaign_id, SimulationCampaign.organization_id == org))).scalar_one_or_none()
    if not c:
        raise HTTPException(status_code=404, detail="Campaign not found.")
    targets = (await db.execute(select(SimulationTarget).where(SimulationTarget.campaign_id == campaign_id))).scalars().all()
    users = {u.id: u for u in (await db.execute(select(User).where(User.id.in_([t.user_id for t in targets])))).scalars().all()}
    tpl = content.get_template(c.template_key) or {}
    training = {a.user_id: a for a in (await db.execute(select(TrainingAssignment).where(
        TrainingAssignment.organization_id == org, TrainingAssignment.source == f"simulation:{campaign_id}"))).scalars().all()}
    people = []
    for t in targets:
        u = users.get(t.user_id)
        a = training.get(t.user_id)
        people.append({"user_id": t.user_id, "name": u.full_name if u else "?", "email": u.email if u else "", "department": u.department if u else None,
                       "sent_at": t.sent_at, "clicked_at": t.clicked_at, "reported_at": t.reported_at,
                       "outcome": "reported" if t.reported_at else "clicked" if t.clicked_at else "no action",
                       "training_status": a.status if a else None})
    people.sort(key=lambda p: (0 if p["outcome"] == "clicked" else 1 if p["outcome"] == "no action" else 2, p["name"]))
    return {"campaign_id": c.campaign_id, "name": c.name, "status": c.status, "template": {"key": c.template_key, **{k: tpl.get(k) for k in ("name", "category", "subject", "red_flags")}},
            "audience": c.audience, "launched_at": c.launched_at, **_stats(targets), "people": people}


@admin_router.post("/campaigns/{campaign_id}/launch")
async def launch_campaign(campaign_id: str, request: Request, bg: BackgroundTasks, send_email: bool = False,
                          user: User = Depends(require_role(Role.ADMIN)), db: AsyncSession = Depends(get_db)):
    """Activate a campaign. With send_email=true AegisOne sends each message through the organisation's SMTP."""
    org_id = _org(user)
    c = (await db.execute(select(SimulationCampaign).where(SimulationCampaign.campaign_id == campaign_id, SimulationCampaign.organization_id == org_id))).scalar_one_or_none()
    if not c:
        raise HTTPException(status_code=404, detail="Campaign not found.")
    if c.status == "closed":
        raise HTTPException(status_code=409, detail="This campaign is closed.")
    org = (await db.execute(select(Organization).where(Organization.id == org_id))).scalar_one_or_none()
    if send_email and not (org and org.smtp_user and org.smtp_pass):
        raise HTTPException(status_code=400, detail="Set up the organisation's SMTP account first (Organization Setup), or export the links instead.")
    if c.status == "draft":
        c.status = "active"; c.launched_at = datetime.utcnow()
    db.add(AuditLog(organization_id=org_id, actor_email=user.email, action="SIMULATION_LAUNCHED", module="awareness",
                    target=f"{campaign_id} '{c.name}' send_email={send_email}", result="success", ip_address="127.0.0.1"))
    await db.commit()
    if send_email:
        bg.add_task(_send_campaign_emails, campaign_id, org_id, _public_api_base(request))
    return {"status": "active", "emailing": bool(send_email)}


async def _send_campaign_emails(campaign_id: str, org_id: str, api_base: str):
    import asyncio
    from api.database.db import get_background_db
    from api.services.email_service import send_unified_email
    db = await get_background_db()
    try:
        c = (await db.execute(select(SimulationCampaign).where(SimulationCampaign.campaign_id == campaign_id))).scalar_one()
        org = (await db.execute(select(Organization).where(Organization.id == org_id))).scalar_one_or_none()
        tpl = content.get_template(c.template_key)
        smtp = {"smtp_user": org.smtp_user, "smtp_pass": org.smtp_pass, "smtp_host": org.smtp_host, "smtp_port": org.smtp_port}
        targets = (await db.execute(select(SimulationTarget).where(SimulationTarget.campaign_id == campaign_id, SimulationTarget.sent_at.is_(None)))).scalars().all()
        users = {u.id: u for u in (await db.execute(select(User).where(User.id.in_([t.user_id for t in targets])))).scalars().all()}
        for t in targets:
            u = users.get(t.user_id)
            if not u:
                continue
            link = f"{api_base}/sim/{t.token}"
            msg = content.render_template(tpl, (u.full_name or "").split(" ")[0], org.name if org else "", link, _org_domain_word(org))
            body_html = "<div style='font-family:Arial,sans-serif;white-space:pre-line'>" + html.escape(msg["body"]).replace(html.escape(link), f'<a href="{html.escape(link)}">{html.escape(link)}</a>') + "</div>"
            res = await asyncio.to_thread(send_unified_email, u.email, msg["subject"], body_html, msg["body"], smtp, msg["from_name"])
            if res.get("sent"):
                t.sent_at = datetime.utcnow(); t.send_error = None
            else:
                t.send_error = str(res.get("error"))[:300]
            await db.commit()
    except Exception:
        logger.exception("sending simulation emails failed")
    finally:
        await db.close()


@admin_router.get("/campaigns/{campaign_id}/links.csv")
async def links_csv(campaign_id: str, request: Request, user: User = Depends(require_role(Role.ADMIN)), db: AsyncSession = Depends(get_db)):
    """Mail-merge file: one row per employee with their unique link and the rendered message."""
    org_id = _org(user)
    c = (await db.execute(select(SimulationCampaign).where(SimulationCampaign.campaign_id == campaign_id, SimulationCampaign.organization_id == org_id))).scalar_one_or_none()
    if not c:
        raise HTTPException(status_code=404, detail="Campaign not found.")
    org = (await db.execute(select(Organization).where(Organization.id == org_id))).scalar_one_or_none()
    tpl = content.get_template(c.template_key)
    targets = (await db.execute(select(SimulationTarget).where(SimulationTarget.campaign_id == campaign_id))).scalars().all()
    users = {u.id: u for u in (await db.execute(select(User).where(User.id.in_([t.user_id for t in targets])))).scalars().all()}
    base = _public_api_base(request)
    buf = io.StringIO()
    w = csv.writer(buf)
    w.writerow(["email", "name", "from_name", "from_address", "subject", "body", "tracked_link"])
    for t in targets:
        u = users.get(t.user_id)
        if not u:
            continue
        link = f"{base}/sim/{t.token}"
        m = content.render_template(tpl, (u.full_name or "").split(" ")[0], org.name if org else "", link, _org_domain_word(org))
        w.writerow([_csv_safe(x) for x in (u.email, u.full_name, m["from_name"], m["from_address"], m["subject"], m["body"], link)])
        if not t.sent_at:
            t.sent_at = datetime.utcnow()
    await db.commit()
    return Response(buf.getvalue(), media_type="text/csv", headers={"Content-Disposition": f'attachment; filename="{campaign_id}-links.csv"'})


@admin_router.post("/campaigns/{campaign_id}/close")
async def close_campaign(campaign_id: str, user: User = Depends(require_role(Role.ADMIN)), db: AsyncSession = Depends(get_db)):
    c = (await db.execute(select(SimulationCampaign).where(SimulationCampaign.campaign_id == campaign_id, SimulationCampaign.organization_id == _org(user)))).scalar_one_or_none()
    if not c:
        raise HTTPException(status_code=404, detail="Campaign not found.")
    c.status = "closed"; c.closed_at = datetime.utcnow()
    await db.commit()
    return {"status": "closed"}


@admin_router.get("/overview")
async def overview(user: User = Depends(require_role(Role.OFFICE_ADMIN)), db: AsyncSession = Depends(get_db)):
    """Organisation-wide awareness picture: simulations by department and over time, plus training completion."""
    org = _org(user)
    camps = (await db.execute(select(SimulationCampaign).where(SimulationCampaign.organization_id == org, SimulationCampaign.status != "draft")
                              .order_by(SimulationCampaign.launched_at.asc()))).scalars().all()
    targets = (await db.execute(select(SimulationTarget).where(SimulationTarget.organization_id == org,
                                                                SimulationTarget.campaign_id.in_([c.campaign_id for c in camps] or ["-"])))).scalars().all()
    users = {u.id: u for u in (await db.execute(select(User).where(User.organization_id == org))).scalars().all()}
    dept_stats: dict = defaultdict(lambda: {"targets": 0, "clicked": 0, "reported": 0})
    for t in targets:
        d = (users.get(t.user_id).department if users.get(t.user_id) else None) or "General"
        s = dept_stats[d]; s["targets"] += 1; s["clicked"] += 1 if t.clicked_at else 0; s["reported"] += 1 if t.reported_at else 0
    by_camp: dict = defaultdict(list)
    for t in targets:
        by_camp[t.campaign_id].append(t)
    trend = [{"campaign_id": c.campaign_id, "name": c.name, "launched_at": c.launched_at, **_stats(by_camp.get(c.campaign_id, []))} for c in camps]
    assigned = (await db.execute(select(TrainingAssignment).where(TrainingAssignment.organization_id == org))).scalars().all()
    overall = _stats(targets)
    repeat = defaultdict(int)
    for t in targets:
        if t.clicked_at:
            repeat[t.user_id] += 1
    return {
        "campaigns": len(camps), **overall,
        "departments": sorted(({"department": d, **s, "click_rate": round(s["clicked"] / s["targets"], 3) if s["targets"] else 0.0} for d, s in dept_stats.items()),
                              key=lambda x: -x["click_rate"]),
        "trend": trend,
        "training": {"assigned": len(assigned), "completed": sum(1 for a in assigned if a.status == "completed"),
                     "completion_rate": round(sum(1 for a in assigned if a.status == "completed") / len(assigned), 3) if assigned else None},
        "repeat_clickers": sum(1 for n in repeat.values() if n >= 2),
        # 0-100: rewards reporting, penalises clicking. None until at least one campaign ran.
        "awareness_score": None if not overall["targets"] else max(0, min(100, round(100 - overall["click_rate"] * 100 + overall["report_rate"] * 30))),
    }


class AssignIn(BaseModel):
    module_key: str
    user_ids: Optional[List[int]] = None
    department_id: Optional[int] = None


@admin_router.post("/assign")
async def assign(body: AssignIn, user: User = Depends(require_role(Role.ADMIN)), db: AsyncSession = Depends(get_db)):
    org = _org(user)
    if not content.get_module(body.module_key):
        raise HTTPException(status_code=400, detail="Unknown training module.")
    q = select(User).where(User.organization_id == org, User.is_active == True)  # noqa: E712
    if body.user_ids:
        q = q.where(User.id.in_(body.user_ids))
    elif body.department_id is not None:
        q = q.where(User.department_id == body.department_id)
    else:
        raise HTTPException(status_code=400, detail="Pick people or a department.")
    n = 0
    for u in (await db.execute(q)).scalars().all():
        if await _assign_module(db, org, u.id, body.module_key, "manual"):
            n += 1
    await db.commit()
    return {"assigned": n}


async def _assign_module(db, org: str, user_id: int, module_key: str, source: str) -> bool:
    exists = (await db.execute(select(TrainingAssignment).where(
        TrainingAssignment.user_id == user_id, TrainingAssignment.module_key == module_key, TrainingAssignment.status == "assigned"))).scalars().first()
    if exists:
        return False
    db.add(TrainingAssignment(organization_id=org, user_id=user_id, module_key=module_key, source=source, status="assigned"))
    db.add(Notification(organization_id=org, user_id=user_id, kind="training_assigned", severity="low",
                        title="New short training for you", body=f"{content.get_module(module_key)['title']} ({content.get_module(module_key)['minutes']} min)",
                        link="/dashboard/employee/training"))
    return True


# ═════════════════════════════════════════════════════════════════════════════════════
# Staff: training
# ═════════════════════════════════════════════════════════════════════════════════════

@staff_router.get("/my")
async def my_training(user: User = Depends(get_current_user), db: AsyncSession = Depends(get_db)):
    org = _org(user)
    rows = (await db.execute(select(TrainingAssignment).where(TrainingAssignment.user_id == user.id).order_by(TrainingAssignment.assigned_at.desc()))).scalars().all()
    done = {r.module_key for r in rows if r.status == "completed"}
    assigned = {r.module_key: r for r in rows if r.status == "assigned"}
    targets = (await db.execute(select(SimulationTarget).where(SimulationTarget.user_id == user.id, SimulationTarget.organization_id == org))).scalars().all()
    return {
        "modules": [{"key": m["key"], "title": m["title"], "minutes": m["minutes"], "summary": m["summary"],
                     "status": "completed" if m["key"] in done and m["key"] not in assigned else "assigned" if m["key"] in assigned else "available",
                     "reason": ("Assigned after a phishing exercise" if assigned.get(m["key"]) and str(assigned[m["key"]].source).startswith("simulation") else
                                "Assigned by your administrator" if assigned.get(m["key"]) else None),
                     "best_score": max([r.score for r in rows if r.module_key == m["key"] and r.score is not None], default=None)}
                    for m in content.MODULES],
        "exercises": {"received": len(targets), "clicked": sum(1 for t in targets if t.clicked_at), "reported": sum(1 for t in targets if t.reported_at)},
        "pass_mark": content.PASS_MARK,
    }


@staff_router.get("/modules/{key}")
async def module(key: str, user: User = Depends(get_current_user)):
    m = content.get_module(key)
    if not m:
        raise HTTPException(status_code=404, detail="Module not found.")
    return content.public_module(m)


class SubmitIn(BaseModel):
    answers: List[int]


@staff_router.post("/modules/{key}/submit")
async def submit_module(key: str, body: SubmitIn, user: User = Depends(get_current_user), db: AsyncSession = Depends(get_db)):
    m = content.get_module(key)
    if not m:
        raise HTTPException(status_code=404, detail="Module not found.")
    res = content.grade(m, body.answers)
    org = _org(user)
    row = (await db.execute(select(TrainingAssignment).where(TrainingAssignment.user_id == user.id, TrainingAssignment.module_key == key,
                                                             TrainingAssignment.status == "assigned"))).scalars().first()
    if not row:
        row = TrainingAssignment(organization_id=org, user_id=user.id, module_key=key, source="self", status="assigned")
        db.add(row)
    row.attempts = (row.attempts or 0) + 1
    row.score = max(row.score or 0, res["score"])
    if res["passed"]:
        row.status = "completed"; row.completed_at = datetime.utcnow()
    await db.commit()
    return res


# ═════════════════════════════════════════════════════════════════════════════════════
# Public tracked link
# ═════════════════════════════════════════════════════════════════════════════════════

def _page(title: str, inner: str) -> str:
    return ("<!doctype html><html lang='en'><head><meta charset='utf-8'><meta name='viewport' content='width=device-width,initial-scale=1'>"
            "<meta name='robots' content='noindex'><title>" + html.escape(title) + "</title><style>"
            ":root{--bg:#f6f8fb;--card:#fff;--fg:#0f172a;--mut:#475569;--acc:#2563eb;--ok:#047857;--warn:#b45309;--bd:#e2e8f0}"
            "@media(prefers-color-scheme:dark){:root{--bg:#0b1220;--card:#111a2e;--fg:#e5ecf6;--mut:#9fb0c8;--acc:#7aa7ff;--ok:#34d399;--warn:#fbbf24;--bd:#223049}}"
            "body{margin:0;background:var(--bg);color:var(--fg);font:16px/1.55 system-ui,Segoe UI,Roboto,sans-serif;padding:24px 16px}"
            "main{max-width:640px;margin:0 auto;background:var(--card);border:1px solid var(--bd);border-radius:16px;padding:28px}"
            "h1{font-size:1.4rem;margin:.2rem 0 .6rem}h2{font-size:1rem;margin:1.4rem 0 .4rem;text-transform:uppercase;letter-spacing:.06em;color:var(--mut)}"
            "li{margin:.45rem 0}.tag{display:inline-block;background:rgba(37,99,235,.12);color:var(--acc);font-weight:700;font-size:.75rem;padding:.2rem .6rem;border-radius:99px}"
            ".ok{color:var(--ok)}a.btn{display:inline-block;margin-top:1rem;background:var(--acc);color:#fff;padding:.7rem 1.2rem;border-radius:10px;text-decoration:none;font-weight:600}"
            "p.m{color:var(--mut);font-size:.9rem}</style></head><body><main>" + inner + "</main></body></html>")


@public_router.get("/sim/{token}", response_class=HTMLResponse)
async def sim_click(token: str, request: Request, db: AsyncSession = Depends(get_db)):
    t = None
    if re.fullmatch(r"[A-Za-z0-9_-]{20,64}", token):
        t = (await db.execute(select(SimulationTarget).where(SimulationTarget.token == token))).scalar_one_or_none()
    if not t:
        return HTMLResponse(_page("Link not found", "<h1>This link is no longer available</h1><p class='m'>It may have expired.</p>"), status_code=404)
    c = (await db.execute(select(SimulationCampaign).where(SimulationCampaign.campaign_id == t.campaign_id))).scalar_one_or_none()
    tpl = content.get_template(c.template_key) if c else None
    if not c or not tpl:
        return HTMLResponse(_page("Link not found", "<h1>This link is no longer available</h1>"), status_code=404)

    ua = request.headers.get("user-agent", "")
    human = bool(ua) and not _BOT_UA.search(ua)       # mail scanners pre-fetch links; those must not count as clicks
    if human and c.status == "active":
        first = t.clicked_at is None
        t.click_count = (t.click_count or 0) + 1
        if first:
            t.clicked_at = datetime.utcnow()
            module_key = tpl["module"]
            await _assign_module(db, t.organization_id, t.user_id, module_key, f"simulation:{c.campaign_id}")
            db.add(Notification(organization_id=t.organization_id, user_id=t.user_id, kind="simulation_click", severity="low",
                                title="That was a phishing exercise", body="You opened a simulated phishing message. A short lesson is waiting for you.",
                                link="/dashboard/employee/training"))
        await db.commit()
        if first:
            try:
                from api.services.integrations import dispatch_event
                await dispatch_event(t.organization_id, "simulation_click", {"campaign_id": c.campaign_id, "template": tpl["key"], "user_id": t.user_id})
            except Exception:
                pass

    module = content.get_module(tpl["module"])
    flags = "".join(f"<li>{html.escape(f)}</li>" for f in tpl["red_flags"])
    inner = (
        "<span class='tag'>SECURITY AWARENESS EXERCISE</span>"
        "<h1>This was a phishing simulation</h1>"
        "<p>You are safe: nothing was collected and no harm was done. Your organisation sent this message to practise spotting phishing, and you opened the link, which real attackers count on.</p>"
        f"<h2>What gave it away</h2><ul>{flags}</ul>"
        "<h2>What to do next time</h2><ul><li>Do not click. Report the message in AegisOne (<b>Report a threat</b>).</li>"
        "<li>If you are unsure whether a message is real, ask IT through a channel you already trust.</li></ul>"
        + (f"<p class='ok'><b>A {module['minutes']}-minute lesson has been added to your dashboard:</b> {html.escape(module['title'])}.</p>" if module else "")
        + (f"<a class='btn' href='{html.escape(__import__('os').environ.get('AEGIS_DASHBOARD_URL', ''), quote=True)}/dashboard/employee/training'>Open my training</a>" if __import__('os').environ.get('AEGIS_DASHBOARD_URL') else "")
        + "<p class='m'>Being fooled by a good phish is normal. Reporting quickly is what matters.</p>"
    )
    return HTMLResponse(_page("Phishing simulation", inner), headers={"Cache-Control": "no-store", "Referrer-Policy": "no-referrer"})
