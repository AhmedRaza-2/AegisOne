"""
AegisOne — Security alerts
==========================
Real-time notification when something needs a human: a manager escalates an incident, a new
high-severity incident is reported, or a critical (blocked) scan happens. Each alert is

  1. stored as an in-app Notification (dashboard bell),
  2. e-mailed to the recipients through the organization's own SMTP settings (if configured),
  3. forwarded to the organization's webhooks / SIEM feed (see api/services/integrations.py).

Alerts are best-effort and never raise into the request that triggered them. Critical-scan alerts
are throttled so one noisy domain cannot flood an inbox.
"""
import asyncio
import html
import logging
import time
from typing import Iterable, List, Optional

from sqlalchemy import select

from api.database.db import get_background_db
from api.database.models import Notification, Organization, User
from api.services.email_service import send_unified_email

logger = logging.getLogger("aegisone.alerts")

_THROTTLE_S = 3600
_last_sent: dict = {}   # (org, dedupe_key) -> epoch seconds


def _throttled(org_id: str, key: Optional[str]) -> bool:
    if not key:
        return False
    now = time.time()
    k = (org_id, key)
    if now - _last_sent.get(k, 0) < _THROTTLE_S:
        return True
    _last_sent[k] = now
    if len(_last_sent) > 5000:
        for old in sorted(_last_sent, key=_last_sent.get)[:1000]:
            _last_sent.pop(old, None)
    return False


async def _recipients(db, org_id: str, roles: Iterable[str], department_id: Optional[int]) -> List[User]:
    q = select(User).where(User.organization_id == org_id, User.role.in_(list(roles)),
                           User.account_status.in_(["approved", "active"]))
    users = (await db.execute(q)).scalars().all()
    out = []
    for u in users:
        # department managers only get alerts for their own department
        if u.role in ("manager", "office_admin") and department_id is not None and u.department_id != department_id:
            continue
        out.append(u)
    return out


def _email_html(title: str, body: str, link_url: Optional[str]) -> str:
    link = f'<p><a href="{html.escape(link_url)}">Open in AegisOne</a></p>' if link_url else ""
    return (f'<div style="font-family:Arial,sans-serif;max-width:560px">'
            f'<h2 style="color:#b91c1c">{html.escape(title)}</h2>'
            f'<p style="white-space:pre-line">{html.escape(body)}</p>{link}'
            f'<hr><p style="color:#6b7280;font-size:12px">AegisOne security alert</p></div>')


async def raise_alert(org_id: str, *, kind: str, title: str, body: str, severity: str = "high",
                      link: Optional[str] = None, roles: Iterable[str] = ("admin", "super_admin"),
                      department_id: Optional[int] = None, dedupe_key: Optional[str] = None,
                      email: bool = True, event_payload: Optional[dict] = None) -> int:
    """Create notifications (+ e-mail + webhooks). Returns the number of recipients notified."""
    try:
        if _throttled(org_id, dedupe_key):
            return 0
        db = await get_background_db()
        try:
            users = await _recipients(db, org_id, roles, department_id)
            org = (await db.execute(select(Organization).where(Organization.id == org_id))).scalars().first()
            smtp = None
            if org and org.smtp_user and org.smtp_pass:
                smtp = {"smtp_user": org.smtp_user, "smtp_pass": org.smtp_pass,
                        "smtp_host": org.smtp_host, "smtp_port": org.smtp_port}
            base = (getattr(org, "dashboard_url", None) or "").rstrip("/") if org else ""
            link_url = f"{base}{link}" if base and link else None
            sent_to = []
            for u in users:
                db.add(Notification(organization_id=org_id, user_id=u.id, kind=kind, severity=severity,
                                    title=title[:255], body=body, link=link, emailed=False))
                if email and smtp and u.email:
                    sent_to.append(u)
            await db.commit()

            for u in sent_to:
                try:
                    res = await asyncio.to_thread(send_unified_email, u.email, f"[AegisOne] {title}",
                                                  _email_html(title, body, link_url), body, smtp)
                    if not res.get("sent"):
                        logger.info("alert e-mail to %s not sent: %s", u.email, res.get("error"))
                except Exception as e:
                    logger.warning("alert e-mail failed: %s", e)

            # Webhooks / SIEM (best effort, optional module)
            try:
                from api.services.integrations import dispatch_event
                await dispatch_event(org_id, kind, {"title": title, "body": body, "severity": severity,
                                                    "link": link, **(event_payload or {})})
            except ImportError:
                pass
            except Exception as e:
                logger.warning("webhook dispatch failed: %s", e)
            return len(users)
        finally:
            await db.close()
    except Exception as e:
        logger.warning("raise_alert failed (%s): %s", kind, e)
        return 0


def fire_and_forget(coro) -> None:
    """Schedule an alert without making the caller wait for it."""
    try:
        asyncio.get_running_loop().create_task(coro)
    except RuntimeError:
        pass


# ─────────────────────────────────────────────────────────────────────────────
# Critical scans: one hook covers every code path that stores a scan
# ─────────────────────────────────────────────────────────────────────────────
from sqlalchemy import event  # noqa: E402
from api.database.models import WebsiteScan  # noqa: E402

CRITICAL_SCORE = 85


async def _critical_scan_alert(org_id: str, user_id: Optional[int], url: str, domain: str, score: int, scan_type: str, scan_id: str):
    who, dept_id = "a user", None
    if user_id:
        db = await get_background_db()
        try:
            u = (await db.execute(select(User).where(User.id == user_id))).scalars().first()
            if u:
                who, dept_id = (u.full_name or u.email), u.department_id
        finally:
            await db.close()
    await raise_alert(
        org_id, kind="critical_scan", severity="critical",
        title=f"Critical threat blocked ({round(score)}% risk)",
        body=f"{who} met a dangerous {scan_type or 'item'}: {url[:200]}",
        link="/dashboard/admin",
        roles=("admin", "super_admin", "manager", "office_admin"), department_id=dept_id,
        dedupe_key=f"scan:{domain or url[:80]}", event_payload={"scan_id": scan_id, "url": url[:500], "risk_score": score},
    )


@event.listens_for(WebsiteScan, "after_insert")
def _on_scan_inserted(mapper, connection, target):
    try:
        if target.decision == "block" and (target.risk_score or 0) >= CRITICAL_SCORE:
            args = (target.organization_id or "org_default", target.user_id, target.url or "", target.domain or "",
                    int(target.risk_score or 0), target.scan_type or "", target.scan_id)
            loop = asyncio.get_running_loop()
            loop.call_soon(lambda: loop.create_task(_critical_scan_alert(*args)))
    except RuntimeError:
        pass   # no running loop (e.g. a script): skip silently
    except Exception as e:  # never break a scan insert because of an alert
        logger.debug("critical-scan alert hook failed: %s", e)
