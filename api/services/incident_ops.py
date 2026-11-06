"""
AegisOne — Incident response tracking, SLAs and metrics
=======================================================
The response record of an incident lives in its evidence JSON under "response" (no schema change needed):

  {"steps": {"1.1": {"done": true, "by": "...", "at": "...Z", "note": "..."}, ...},
   "actions": [{"action": "block_domain", "by": "...", "at": "...Z", "count": 1, "detail": "..."}],
   "contained_at": "...Z",            first containment step / action
   "acknowledged_at": "...Z",         first human response of any kind
   "sla_alerted_at": "...Z"}          when the "no response yet" escalation fired

Response-time SLA (time until the first human response) by severity, overridable with AEGIS_SLA_<SEVERITY>_MIN:
  critical 15 min, high 60 min, medium 4 h, low 24 h.
A background watcher raises an alert (bell + e-mail + webhooks, see alerts.py) once per incident whose SLA ran out.
Metrics: mean / median time to acknowledge, contain and resolve, SLA breaches, open incidents by severity.
"""
import asyncio
import logging
import os
import statistics
from datetime import datetime, timedelta
from typing import Any, Dict, List, Optional

from sqlalchemy import select
from sqlalchemy.orm.attributes import flag_modified

from api.database.models import Incident

logger = logging.getLogger("aegisone.incident_ops")

SLA_MINUTES = {
    "critical": int(os.environ.get("AEGIS_SLA_CRITICAL_MIN", "15")),
    "high": int(os.environ.get("AEGIS_SLA_HIGH_MIN", "60")),
    "medium": int(os.environ.get("AEGIS_SLA_MEDIUM_MIN", "240")),
    "low": int(os.environ.get("AEGIS_SLA_LOW_MIN", "1440")),
}
WATCH_INTERVAL_S = int(os.environ.get("AEGIS_SLA_WATCH_INTERVAL_S", "120"))
OPEN_STATES = ("open", "investigating", "escalated")


def _now_iso() -> str:
    return datetime.utcnow().isoformat() + "Z"


def _parse(ts) -> Optional[datetime]:
    if ts is None:
        return None
    if isinstance(ts, datetime):
        return ts.replace(tzinfo=None)
    try:
        return datetime.fromisoformat(str(ts).replace("Z", "")).replace(tzinfo=None)
    except ValueError:
        return None


def response_of(inc: Incident) -> Dict[str, Any]:
    ev = inc.evidence if isinstance(inc.evidence, dict) else {}
    r = ev.get("response")
    return dict(r) if isinstance(r, dict) else {}


def save_response(inc: Incident, response: Dict[str, Any]) -> None:
    ev = dict(inc.evidence) if isinstance(inc.evidence, dict) else {}
    ev["response"] = response
    inc.evidence = ev
    flag_modified(inc, "evidence")


def acknowledge(response: Dict[str, Any]) -> Dict[str, Any]:
    response.setdefault("acknowledged_at", _now_iso())
    return response


def record_action(inc: Incident, action: str, by: str, count: int, detail: str = "", step_id: Optional[str] = None,
                  incident_type: Optional[str] = None, contain: bool = False) -> Dict[str, Any]:
    """Log a response action on the incident, tick its playbook step and stamp acknowledge / contain times."""
    from api.services.playbooks import mark_step
    r = acknowledge(response_of(inc))
    actions = list(r.get("actions") or [])
    actions.append({"action": action, "by": by, "at": _now_iso(), "count": int(count), "detail": detail[:300]})
    r["actions"] = actions[-100:]
    if step_id and incident_type:
        try:
            r = mark_step(r, incident_type, step_id, done=True, by=by, note=f"Done with the '{action.replace('_', ' ')}' button ({count}).")
        except KeyError:
            pass
    if contain and not r.get("contained_at"):
        r["contained_at"] = _now_iso()
    save_response(inc, r)
    return r


def sla_status(inc: Incident, response: Optional[Dict[str, Any]] = None) -> Dict[str, Any]:
    response = response if response is not None else response_of(inc)
    created = _parse(inc.created_at)
    target = SLA_MINUTES.get((inc.severity or "medium").lower(), SLA_MINUTES["medium"])
    ack = _parse(response.get("acknowledged_at")) or _parse(inc.escalated_at) or _parse(inc.verified_at)
    if not ack and (inc.status or "open") not in ("open",):
        ack = _parse(inc.resolved_at) or _parse(inc.verified_at)
    out = {"target_minutes": target, "acknowledged_at": ack.isoformat() + "Z" if ack else None, "due_at": None, "met": None, "breached": False}
    if not created:
        return out
    due = created + timedelta(minutes=target)
    out["due_at"] = due.isoformat() + "Z"
    if ack:
        out["met"] = ack <= due
        out["breached"] = ack > due
    else:
        out["breached"] = datetime.utcnow() > due and (inc.status or "open") in OPEN_STATES
    return out


def _minutes(a: Optional[datetime], b: Optional[datetime]) -> Optional[float]:
    if not a or not b:
        return None
    return round(max(0.0, (b - a).total_seconds() / 60.0), 1)


def timings(inc: Incident, response: Optional[Dict[str, Any]] = None) -> Dict[str, Optional[float]]:
    response = response if response is not None else response_of(inc)
    created = _parse(inc.created_at)
    s = sla_status(inc, response)
    return {
        "time_to_acknowledge_min": _minutes(created, _parse(s["acknowledged_at"])),
        "time_to_contain_min": _minutes(created, _parse(response.get("contained_at"))),
        "time_to_resolve_min": _minutes(created, _parse(inc.resolved_at)),
    }


def _summ(xs: List[float]) -> Dict[str, Optional[float]]:
    xs = [x for x in xs if x is not None]
    if not xs:
        return {"n": 0, "mean": None, "median": None}
    return {"n": len(xs), "mean": round(sum(xs) / len(xs), 1), "median": round(statistics.median(xs), 1)}


async def metrics(db, org_id: Optional[str], days: int = 30) -> Dict[str, Any]:
    q = select(Incident).where(Incident.created_at >= datetime.utcnow() - timedelta(days=days))
    if org_id:
        q = q.where(Incident.organization_id == org_id)
    incs = (await db.execute(q.limit(5000))).scalars().all()
    ack, cont, res = [], [], []
    by_status: Dict[str, int] = {}
    open_by_sev: Dict[str, int] = {}
    breached_total, breaching_now, sla_met = 0, 0, 0
    for i in incs:
        r = response_of(i)
        t = timings(i, r)
        ack.append(t["time_to_acknowledge_min"])
        cont.append(t["time_to_contain_min"])
        res.append(t["time_to_resolve_min"])
        st = (i.status or "open").lower()
        by_status[st] = by_status.get(st, 0) + 1
        s = sla_status(i, r)
        if s["breached"]:
            breached_total += 1
            if not s["acknowledged_at"]:
                breaching_now += 1
        elif s["met"]:
            sla_met += 1
        if st in OPEN_STATES:
            sev = (i.severity or "medium").lower()
            open_by_sev[sev] = open_by_sev.get(sev, 0) + 1
    judged = breached_total + sla_met
    return {
        "window_days": days, "incidents": len(incs), "by_status": by_status, "open_by_severity": open_by_sev,
        "time_to_acknowledge_min": _summ(ack), "time_to_contain_min": _summ(cont), "time_to_resolve_min": _summ(res),
        "sla": {"targets_min": SLA_MINUTES, "met": sla_met, "breached": breached_total, "breaching_now": breaching_now,
                "compliance": round(sla_met / judged, 3) if judged else None},
    }


async def check_sla_breaches(org_id: Optional[str] = None) -> int:
    """One pass of the watcher: alert once per open, un-acknowledged incident whose response SLA ran out.
    `org_id` limits the pass to one organization (tests)."""
    from api.database.db import get_background_db
    from api.services.alerts import raise_alert
    db = await get_background_db()
    fired = []
    try:
        oldest = datetime.utcnow() - timedelta(days=14)
        q = select(Incident).where(Incident.status.in_(OPEN_STATES), Incident.created_at >= oldest)
        if org_id:
            q = q.where(Incident.organization_id == org_id)
        incs = (await db.execute(q.limit(2000))).scalars().all()
        for inc in incs:
            r = response_of(inc)
            if r.get("sla_alerted_at"):
                continue
            s = sla_status(inc, r)
            if s["breached"] and not s["acknowledged_at"]:
                r["sla_alerted_at"] = _now_iso()
                save_response(inc, r)
                fired.append((inc.organization_id or "org_default", inc.incident_id or f"INC-{inc.id}", (inc.severity or "medium"), s["target_minutes"]))
        if fired:
            await db.commit()
    finally:
        await db.close()
    for org_id, iid, sev, target in fired:
        await raise_alert(org_id, kind="incident_sla_breach", severity="critical" if sev == "critical" else "high",
                          title=f"No response yet to {sev} incident {iid}",
                          body=f"Incident {iid} ({sev}) has had no response for more than {target} minutes. Open it, contain it, or assign it.",
                          link="/dashboard/admin/incidents", dedupe_key=f"sla:{iid}",
                          event_payload={"incident_id": iid, "severity": sev, "sla_minutes": target})
    return len(fired)


async def sla_watch_loop() -> None:
    await asyncio.sleep(30)
    while True:
        try:
            n = await check_sla_breaches()
            if n:
                logger.info("SLA watcher: %d incident(s) escalated for no response", n)
        except Exception as e:  # never let the watcher die
            logger.warning("SLA watcher pass failed: %s", e)
        await asyncio.sleep(WATCH_INTERVAL_S)
