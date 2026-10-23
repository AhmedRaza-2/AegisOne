"""
AegisOne — Incident back-trace, CSV export and printable report
===============================================================
Everything an admin needs to answer "what exactly happened, who saw it, why did we flag it and what
did we do about it" for one incident, assembled from the stored scan evidence, the employee
reports, credential/download events, the audit trail and the training feedback.

All free text goes through redact_text() first (emails, tokens, long digit runs), the same
enforcement point the incident list uses.
"""
import asyncio
import csv
import html
import io
import json
from datetime import datetime
from typing import Any, Dict, List, Optional
from urllib.parse import urlparse

from sqlalchemy import func, or_, select

from api.database.models import (
    AuditLog, CredentialEvent, Department, DownloadEvent, Incident, IncidentReport, Organization,
    TrainingCandidate, User, WebsiteScan,
)
from api.services.playbooks import classify_incident, get_playbook
from api.services.redaction import redact_obj, redact_text
from api.services.xai_engine import build_grounded_findings


def _iso(dt) -> Optional[str]:
    return dt.isoformat() if isinstance(dt, datetime) else (str(dt) if dt else None)


def _host(url: Optional[str]) -> Optional[str]:
    if not url:
        return None
    try:
        h = urlparse(url if "://" in url else "http://" + url).hostname
        return h.lower() if h else None
    except Exception:
        return None


def _person(u: Optional[User], dept_names: Dict[int, str]) -> Optional[Dict[str, Any]]:
    if not u:
        return None
    return {"id": u.id, "name": u.full_name or u.email, "email": u.email, "role": u.role,
            "department": dept_names.get(u.department_id) or u.department}


async def build_backtrace(db, inc: Incident, *, include_domain_age: bool = True) -> Dict[str, Any]:
    org_id = inc.organization_id or "org_default"
    reports = (await db.execute(
        select(IncidentReport).where(IncidentReport.incident_id == inc.id).order_by(IncidentReport.created_at.asc())
    )).scalars().all()

    user_ids = {r.user_id for r in reports} | {inc.reported_by_id, inc.escalated_by_id, inc.verified_by_id, inc.resolved_by_id}
    user_ids.discard(None)
    users = {u.id: u for u in (await db.execute(select(User).where(User.id.in_(user_ids)))).scalars().all()} if user_ids else {}
    dept_names = {d.id: d.name for d in (await db.execute(
        select(Department).where(Department.organization_id == org_id))).scalars().all()}

    # ── The scans behind the reports ─────────────────────────────────────────
    scan_ids = [r.scan_id for r in reports if r.scan_id]
    scans = (await db.execute(
        select(WebsiteScan).where(WebsiteScan.organization_id == org_id, WebsiteScan.scan_id.in_(scan_ids))
    )).scalars().all() if scan_ids else []
    scans_by_id = {s.scan_id: s for s in scans}
    primary = scans[0] if scans else None

    rich = None
    if primary and primary.xai_explanation:
        try:
            rich = json.loads(primary.xai_explanation)
        except Exception:
            rich = None
    base_ev = inc.evidence if isinstance(inc.evidence, dict) else {}
    findings: List[str] = list(base_ev.get("findings") or [])
    if primary and not findings:
        try:
            findings = build_grounded_findings(
                {"risk_score": primary.risk_score, "domain": primary.domain, "url": primary.url, "scan_type": primary.scan_type},
                rich)["findings"]
        except Exception:
            findings = []

    target_ref = inc.detection_event_ref or (reports[0].target_ref if reports else None)
    target_url = (primary.url if primary else None) or (target_ref if target_ref and target_ref.startswith("http") else None)
    domain = (primary.domain if primary and primary.domain and "." in primary.domain else None) or _host(target_url)

    # ── Domain facts (real registration age) ─────────────────────────────────
    domain_info = None
    if domain and include_domain_age:
        try:
            from api.services.domain_intel import lookup_domain_age
            domain_info = await asyncio.wait_for(lookup_domain_age(domain), timeout=4.0)
        except Exception:
            domain_info = {"domain": domain, "age_label": "Unknown", "status": "unknown"}

    # ── Exposure: who else met this domain, did anyone enter credentials ──────
    exposure: Dict[str, Any] = {"scans": 0, "users": 0, "blocked": 0, "warned": 0, "allowed": 0,
                                "first_seen": None, "last_seen": None, "people": [],
                                "credential_events": 0, "credentials_blocked": 0, "credential_people": []}
    if domain:
        like = f"%{domain}%"
        rows = (await db.execute(
            select(WebsiteScan.user_id, WebsiteScan.decision, WebsiteScan.created_at)
            .where(WebsiteScan.organization_id == org_id, or_(WebsiteScan.domain == domain, WebsiteScan.url.ilike(like)))
        )).all()
        exposure["scans"] = len(rows)
        per_user: Dict[int, Dict[str, Any]] = {}
        stamps: List[datetime] = []
        for uid, decision, ts in rows:
            if decision == "block":
                exposure["blocked"] += 1
            elif decision == "warn":
                exposure["warned"] += 1
            else:
                exposure["allowed"] += 1
            if ts:
                stamps.append(ts)
            if uid is not None:
                p = per_user.setdefault(uid, {"visits": 0, "last_decision": None})
                p["visits"] += 1
                p["last_decision"] = decision
        exposure["users"] = len(per_user)
        if stamps:
            exposure["first_seen"], exposure["last_seen"] = _iso(min(stamps)), _iso(max(stamps))
        missing = [uid for uid in per_user if uid not in users]
        if missing:
            for u in (await db.execute(select(User).where(User.id.in_(missing)))).scalars().all():
                users[u.id] = u
        exposure["people"] = [
            {**(_person(users.get(uid), dept_names) or {"id": uid}), **info}
            for uid, info in sorted(per_user.items(), key=lambda kv: -kv[1]["visits"])[:25]
        ]

        cred_rows = (await db.execute(
            select(CredentialEvent.user_id, CredentialEvent.blocked)
            .where(CredentialEvent.organization_id == org_id, CredentialEvent.domain.ilike(f"%{domain}%"))
        )).all()
        exposure["credential_events"] = len(cred_rows)
        exposure["credentials_blocked"] = sum(1 for _, b in cred_rows if b)
        cred_users = {int(uid) for uid, blocked in cred_rows if uid and str(uid).isdigit() and not blocked}
        if cred_users:
            for u in (await db.execute(select(User).where(User.id.in_(cred_users)))).scalars().all():
                users[u.id] = u
            exposure["credential_people"] = [_person(users[i], dept_names) for i in sorted(cred_users) if i in users]

    # ── Timeline ─────────────────────────────────────────────────────────────
    timeline: List[Dict[str, Any]] = []
    if primary:
        timeline.append({"at": _iso(primary.created_at), "event": "Detected",
                         "detail": f"{(primary.scan_type or 'scan').title()} scan scored {round(primary.risk_score or 0)}% and was "
                                   f"{'blocked' if primary.decision == 'block' else 'flagged with a warning' if primary.decision == 'warn' else 'allowed'}.",
                         "actor": _person(users.get(primary.user_id), dept_names)})
    for r in reports:
        timeline.append({"at": _iso(r.created_at), "event": f"Reported ({r.report_type.replace('_', ' ')})",
                         "detail": redact_text(r.user_notes) or "No note added.", "actor": _person(users.get(r.user_id), dept_names)})
    if inc.escalated_at:
        timeline.append({"at": _iso(inc.escalated_at), "event": "Escalated to admin",
                         "detail": redact_text(inc.manager_notes) or "", "actor": _person(users.get(inc.escalated_by_id), dept_names)})
    if inc.verified_at:
        timeline.append({"at": _iso(inc.verified_at), "event": f"Admin verdict: {(inc.admin_decision or '').replace('_', ' ').title()}",
                         "detail": redact_text(inc.admin_notes) or "", "actor": _person(users.get(inc.verified_by_id), dept_names)})
    audits = (await db.execute(
        select(AuditLog).where(AuditLog.organization_id == org_id,
                               or_(AuditLog.target.ilike(f"%{inc.incident_id or 'INC-' + str(inc.id)}%")))
        .order_by(AuditLog.timestamp.asc()).limit(100)
    )).scalars().all()
    audit_trail = [{"at": _iso(a.timestamp), "actor": a.actor_email, "action": a.action, "target": redact_text(a.target),
                    "result": a.result} for a in audits]
    timeline.sort(key=lambda e: e["at"] or "")

    candidates = (await db.execute(select(TrainingCandidate).where(TrainingCandidate.incident_id == inc.id))).scalars().all()
    first = reports[0] if reports else None
    inc_type = classify_incident(report_type=inc.report_type, target_type=first.target_type if first else None,
                                 evidence={**base_ev, "findings": findings, **({"image_evidence": (rich or {}).get("image_evidence")} if rich else {})})

    return {
        "incident": {
            "id": inc.incident_id or f"INC-{inc.id}", "status": inc.status, "severity": inc.severity,
            "report_type": inc.report_type, "created_at": _iso(inc.created_at), "resolved_at": _iso(inc.resolved_at),
            "organization_id": org_id, "type": inc_type,
        },
        "detection": {
            "target": redact_text(target_url or target_ref), "domain": domain,
            "predicted_class": inc.predicted_class or (primary.threat_type if primary else None),
            "risk_score": inc.risk_score if inc.risk_score is not None else (round(primary.risk_score or 0) if primary else None),
            "model_version": inc.model_version, "decision": primary.decision if primary else None,
            "scan_type": primary.scan_type if primary else (first.target_type if first else None),
            "scan_id": primary.scan_id if primary else (first.scan_id if first else None),
            "scanned_at": _iso(primary.created_at) if primary else None,
            "scan_duration_ms": primary.scan_duration_ms if primary else None,
            "modules_used": _json_list(primary.modules_used) if primary else [],
            "why": [redact_text(f) for f in findings],
            "evidence": redact_obj(base_ev or rich or {}),
        },
        "domain_info": domain_info,
        "redirect_trace": base_ev.get("redirect_trace"),
        "reporters": [{
            "report_id": r.report_id, "at": _iso(r.created_at), "type": r.report_type, "status": r.status,
            "target_type": r.target_type, "note": redact_text(r.user_notes),
            "person": _person(users.get(r.user_id), dept_names),
            "scan_id": r.scan_id,
            "scanned_on_device": getattr(scans_by_id.get(r.scan_id), "device_id", None) if r.scan_id else None,
        } for r in reports],
        "exposure": exposure,
        "timeline": timeline,
        "decision": {
            "admin_decision": inc.admin_decision, "admin_notes": redact_text(inc.admin_notes),
            "verified_by": _person(users.get(inc.verified_by_id), dept_names), "verified_at": _iso(inc.verified_at),
            "training_candidates": [{"id": c.candidate_id, "model": c.model_type, "label": c.label, "status": c.status} for c in candidates],
        },
        "playbook": get_playbook(inc_type),
        "audit_trail": audit_trail,
        "generated_at": datetime.utcnow().isoformat() + "Z",
    }


def _json_list(raw) -> list:
    try:
        v = json.loads(raw) if isinstance(raw, str) else raw
        return v if isinstance(v, list) else []
    except Exception:
        return []


# ─────────────────────────────────────────────────────────────────────────────
# CSV
# ─────────────────────────────────────────────────────────────────────────────
CSV_COLUMNS = ["incident_id", "created_at", "status", "severity", "report_type", "predicted_class", "risk_score",
               "target", "reports", "reporters", "department", "escalated_at", "admin_decision", "verified_at",
               "verified_by", "resolved_at", "model_version"]


def _csv_safe(v: Any) -> str:
    """Neutralize spreadsheet formula injection (=, +, -, @ at the start of a cell)."""
    s = "" if v is None else str(v)
    return "'" + s if s[:1] in ("=", "+", "-", "@", "\t", "\r") else s


async def incidents_csv(db, incidents: List[Incident]) -> str:
    ids = [i.id for i in incidents]
    reps: Dict[int, List[IncidentReport]] = {}
    if ids:
        for r in (await db.execute(select(IncidentReport).where(IncidentReport.incident_id.in_(ids)))).scalars().all():
            reps.setdefault(r.incident_id, []).append(r)
    user_ids = {r.user_id for rs in reps.values() for r in rs} | {i.verified_by_id for i in incidents if i.verified_by_id}
    users = {u.id: u for u in (await db.execute(select(User).where(User.id.in_(user_ids)))).scalars().all()} if user_ids else {}
    depts = {d.id: d.name for d in (await db.execute(select(Department))).scalars().all()}

    buf = io.StringIO()
    w = csv.writer(buf)
    w.writerow(CSV_COLUMNS)
    for i in incidents:
        rs = reps.get(i.id, [])
        names = sorted({(users[r.user_id].full_name or users[r.user_id].email) for r in rs if r.user_id in users})
        dnames = sorted({depts.get(r.department_id, "") for r in rs if r.department_id})
        w.writerow([_csv_safe(x) for x in [
            i.incident_id or f"INC-{i.id}", _iso(i.created_at), i.status, i.severity, i.report_type, i.predicted_class,
            i.risk_score, redact_text(i.detection_event_ref), len(rs), "; ".join(names), "; ".join(dnames),
            _iso(i.escalated_at), i.admin_decision, _iso(i.verified_at),
            (users[i.verified_by_id].full_name or users[i.verified_by_id].email) if i.verified_by_id in users else "",
            _iso(i.resolved_at), i.model_version]])
    return buf.getvalue()


# ─────────────────────────────────────────────────────────────────────────────
# Printable HTML report
# ─────────────────────────────────────────────────────────────────────────────
def _e(v: Any) -> str:
    return html.escape("" if v is None else str(v))


def _kv(rows: List[tuple]) -> str:
    return "<table class='kv'>" + "".join(f"<tr><th>{_e(k)}</th><td>{_e(v) if v not in (None, '') else '&mdash;'}</td></tr>" for k, v in rows) + "</table>"


def _person_line(p: Optional[Dict[str, Any]]) -> str:
    if not p:
        return "Unknown"
    bits = [p.get("name") or p.get("email") or "Unknown"]
    if p.get("email") and p.get("email") != bits[0]:
        bits.append(f"&lt;{_e(p['email'])}&gt;")
    extra = ", ".join(x for x in [p.get("role"), p.get("department")] if x)
    return _e(bits[0]) + (" " + " ".join(bits[1:]) if len(bits) > 1 else "") + (f" <span class='muted'>({_e(extra)})</span>" if extra else "")


def render_report_html(bt: Dict[str, Any], org_name: str, generated_by: str) -> str:
    inc, det, expo = bt["incident"], bt["detection"], bt["exposure"]
    di = bt.get("domain_info") or {}
    rt = bt.get("redirect_trace") or {}
    pb = bt["playbook"]

    why = "".join(f"<li>{_e(w)}</li>" for w in det["why"]) or "<li class='muted'>No stored findings for this incident.</li>"
    tl = "".join(
        f"<tr><td class='nowrap'>{_e(t['at'])}</td><td><b>{_e(t['event'])}</b><br>{_e(t['detail'])}</td><td>{_person_line(t['actor'])}</td></tr>"
        for t in bt["timeline"]) or "<tr><td colspan='3' class='muted'>No timeline entries.</td></tr>"
    reporters = "".join(
        f"<tr><td>{_person_line(r['person'])}</td><td>{_e(r['type'].replace('_', ' '))}</td><td>{_e(r['at'])}</td>"
        f"<td>{_e(r['note']) or '&mdash;'}</td><td>{_e(r['status'])}</td></tr>" for r in bt["reporters"]) \
        or "<tr><td colspan='5' class='muted'>No employee reports.</td></tr>"
    people = "".join(
        f"<tr><td>{_person_line(p)}</td><td>{_e(p.get('visits'))}</td><td>{_e(p.get('last_decision'))}</td></tr>" for p in expo["people"]) \
        or "<tr><td colspan='3' class='muted'>Nobody else in this organization met this address.</td></tr>"
    cred = ("<ul>" + "".join(f"<li>{_person_line(p)}</li>" for p in expo["credential_people"]) + "</ul>") if expo["credential_people"] \
        else "<p class='ok'>No credentials were entered on this domain without being blocked.</p>"
    chain = ""
    if rt.get("chain"):
        chain = "<ol>" + "".join(
            f"<li><code>{_e(h['url'])}</code> &rarr; {_e(h['status'] if h['status'] else 'not followed')}"
            f"{(' <span class=muted>' + _e(h['note']) + '</span>') if h.get('note') else ''}</li>" for h in rt["chain"]) + "</ol>"
        if rt.get("flags"):
            chain += "<p><b>Observations:</b> " + _e("; ".join(rt["flags"])) + "</p>"
    else:
        chain = "<p class='muted'>Redirect chain has not been traced for this incident.</p>"
    steps = "".join(
        f"<h4>{_e(ph['phase'])}</h4><ul>" + "".join(f"<li>{_e(s['text'])}</li>" for s in ph["steps"]) + "</ul>" for ph in pb["phases"])
    audit = "".join(f"<tr><td class='nowrap'>{_e(a['at'])}</td><td>{_e(a['actor'])}</td><td>{_e(a['action'])}</td><td>{_e(a['target'])}</td></tr>"
                    for a in bt["audit_trail"]) or "<tr><td colspan='4' class='muted'>No audit entries.</td></tr>"
    cands = ", ".join(f"{c['id']} ({c['model']}, {c['label']}, {c['status']})" for c in bt["decision"]["training_candidates"]) or "None"

    return f"""<!doctype html><html lang="en"><head><meta charset="utf-8">
<title>Incident report {_e(inc['id'])}</title>
<style>
 body{{font:14px/1.5 -apple-system,Segoe UI,Roboto,Arial,sans-serif;color:#111827;max-width:900px;margin:24px auto;padding:0 20px}}
 h1{{font-size:22px;margin:0}} h2{{font-size:16px;border-bottom:2px solid #111827;padding-bottom:4px;margin:26px 0 10px}} h4{{margin:12px 0 4px}}
 .muted{{color:#6b7280}} .ok{{color:#047857}} .nowrap{{white-space:nowrap}} code{{word-break:break-all;font-size:12px}}
 table{{border-collapse:collapse;width:100%}} th,td{{border:1px solid #d1d5db;padding:6px 8px;text-align:left;vertical-align:top}}
 th{{background:#f3f4f6}} table.kv th{{width:28%}}
 .badge{{display:inline-block;padding:2px 8px;border-radius:99px;background:#fee2e2;color:#991b1b;font-weight:700;font-size:12px}}
 .bar{{display:flex;justify-content:space-between;align-items:flex-start;gap:12px}}
 @media print{{body{{margin:0;max-width:none}} h2{{break-after:avoid}} tr{{break-inside:avoid}} .noprint{{display:none}}}}
</style></head><body>
<div class="bar"><div><h1>Incident report &mdash; {_e(inc['id'])}</h1>
<div class="muted">{_e(org_name)} &middot; generated {_e(bt['generated_at'])} by {_e(generated_by)}</div></div>
<div><span class="badge">{_e(inc['severity']).upper()}</span> <span class="badge" style="background:#e0e7ff;color:#3730a3">{_e(inc['status']).upper()}</span></div></div>
<p class="noprint muted">Use your browser's Print command and choose "Save as PDF" to keep a copy.</p>

<h2>1. Summary</h2>
{_kv([("Incident type", pb['title']), ("Reported as", inc['report_type']), ("Opened", inc['created_at']), ("Resolved", inc['resolved_at']),
      ("Target", det['target']), ("Domain", det['domain']), ("Risk score", f"{det['risk_score']}%" if det['risk_score'] is not None else None),
      ("Model verdict", det['predicted_class']), ("System decision", det['decision'])])}

<h2>2. What was detected and why</h2>
<ul>{why}</ul>
{_kv([("Scan type", det['scan_type']), ("Scan ID", det['scan_id']), ("Scanned at", det['scanned_at']),
      ("Models used", ", ".join(det['modules_used'])), ("Model version", det['model_version']),
      ("Scan duration", f"{round(det['scan_duration_ms'])} ms" if det['scan_duration_ms'] else None)])}

<h2>3. Domain facts</h2>
{_kv([("Registered", di.get('registered_on')), ("Age", di.get('age_label')), ("Source", "RDAP (registry data)" if di.get('status') == 'ok' else "Not available")])}

<h2>4. Redirect chain</h2>{chain}

<h2>5. Who reported it</h2>
<table><tr><th>Person</th><th>Report</th><th>When</th><th>Note</th><th>Status</th></tr>{reporters}</table>

<h2>6. Exposure inside the organization</h2>
{_kv([("Times seen", expo['scans']), ("People who met it", expo['users']), ("Blocked", expo['blocked']), ("Warned", expo['warned']),
      ("Allowed", expo['allowed']), ("First seen", expo['first_seen']), ("Last seen", expo['last_seen']),
      ("Credential submissions", f"{expo['credential_events']} ({expo['credentials_blocked']} blocked)")])}
<h4>People who submitted credentials that were not blocked</h4>{cred}
<h4>People who met this address</h4>
<table><tr><th>Person</th><th>Visits</th><th>Last outcome</th></tr>{people}</table>

<h2>7. Timeline</h2>
<table><tr><th>When</th><th>What happened</th><th>By</th></tr>{tl}</table>

<h2>8. Admin decision</h2>
{_kv([("Decision", (bt['decision']['admin_decision'] or '').replace('_', ' ').title() or None), ("Notes", bt['decision']['admin_notes']),
      ("Verified by", (bt['decision']['verified_by'] or {}).get('name')), ("Verified at", bt['decision']['verified_at']), ("Training samples created", cands)])}

<h2>9. Recommended response &mdash; {_e(pb['title'])}</h2>
<p>{_e(pb['summary'])}</p>{steps}

<h2>10. Audit trail</h2>
<table><tr><th>When</th><th>Who</th><th>Action</th><th>Target</th></tr>{audit}</table>
<p class="muted">Personal data in free-text fields is redacted. Generated by AegisOne.</p>
</body></html>"""
