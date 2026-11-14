"""
AegisOne — behavioural anomaly detection (scope 7.3 "Behavioral anomaly detection", 4.2 "assessing behavioural
irregularities for early detection")
=====================================================================================================================
Looks at what each person's browser protection RECORDED (never at page content): how many links were warned about or
blocked, how many new sites were visited, sign-in forms on flagged sites, activity at unusual hours. A sudden change
against the person's OWN history - or a day that looks unlike anyone else's in the organisation - is an early sign of a
phishing campaign reaching that person, of a compromised account, or of a machine that is browsing on its own.

Two complementary detectors, both unsupervised (there are no labelled "compromised days" to learn from):
  1. Robust z-score against the person's own baseline (median / MAD over the previous days) - explainable per feature.
  2. Isolation Forest over every person-day in the organisation (scikit-learn) - catches unusual COMBINATIONS.
The final score (0-100) is the stronger of the two; the reasons always come from detector 1 so they can be read.
Needs at least MIN_DAYS of history for a person before it judges them (new users are reported as "learning").
"""
from collections import defaultdict
from datetime import datetime, timedelta
from typing import Any, Dict, List

import numpy as np

FEATURES = ["scans", "warned", "blocked", "new_domains", "cred_on_flagged", "cred_total", "off_hours", "email_flagged"]
LABELS = {
    "scans": "pages and links checked",
    "warned": "warnings shown",
    "blocked": "dangerous pages blocked",
    "new_domains": "sites never visited before",
    "cred_on_flagged": "sign-in details typed on flagged sites",
    "cred_total": "sign-in forms used",
    "off_hours": "activity between 22:00 and 06:00",
    "email_flagged": "suspicious e-mails received",
}
MIN_DAYS = 5
Z_ALERT = 3.5          # robust z above this = unusual for this person
# a change is only worth reporting when it is also large in absolute terms (one extra warning is not news)
MIN_ABS = {"scans": 40, "warned": 3, "blocked": 2, "new_domains": 15, "cred_on_flagged": 1, "cred_total": 5, "off_hours": 10, "email_flagged": 3}


def _robust_z(today: float, history: np.ndarray) -> float:
    med = float(np.median(history))
    mad = float(np.median(np.abs(history - med))) * 1.4826
    scale = max(mad, 1.0)                    # counts: never divide by less than one event
    return (today - med) / scale


def score_users(days: Dict[Any, Dict[str, Dict[str, float]]], today: str) -> List[Dict[str, Any]]:
    """
    days[user_id][YYYY-MM-DD] = {feature: count}. Returns one row per user with activity today, most anomalous first:
    {user_id, score 0-100, level, reasons[], status}.
    """
    all_dates = sorted({d for u in days.values() for d in u})
    hist_dates = [d for d in all_dates if d < today]

    # Isolation Forest over every person-day of the organisation
    iso_scores: Dict[Any, float] = {}
    rows, keys = [], []
    for uid, per in days.items():
        for d, f in per.items():
            rows.append([f.get(k, 0.0) for k in FEATURES])
            keys.append((uid, d))
    if len(rows) >= 30:
        from sklearn.ensemble import IsolationForest
        X = np.log1p(np.array(rows, dtype=float))
        forest = IsolationForest(n_estimators=150, contamination="auto", random_state=0).fit(X)
        raw = -forest.score_samples(X)              # higher = more isolated
        lo, hi = np.percentile(raw, 50), np.percentile(raw, 99.5)
        for (uid, d), r in zip(keys, raw):
            if d == today:
                iso_scores[uid] = float(np.clip((r - lo) / max(hi - lo, 1e-6), 0, 1))

    out = []
    for uid, per in days.items():
        if today not in per:
            continue
        t = per[today]
        hist = np.array([[per.get(d, {}).get(k, 0.0) for k in FEATURES] for d in hist_dates if d in per], dtype=float)
        reasons, zmax = [], 0.0
        if len(hist) >= MIN_DAYS:
            for j, k in enumerate(FEATURES):
                z = _robust_z(t.get(k, 0.0), hist[:, j])
                if z >= Z_ALERT and t.get(k, 0.0) - float(np.median(hist[:, j])) >= MIN_ABS[k]:
                    zmax = max(zmax, z)
                    reasons.append(f"{int(t.get(k, 0))} {LABELS[k]} today (usually about {int(round(float(np.median(hist[:, j]))))})")
            status = "baseline"
        else:
            status = "learning"
        # hard signals that matter on any day, history or not
        if t.get("cred_on_flagged", 0) >= 1:
            reasons.insert(0, f"typed sign-in details on {int(t['cred_on_flagged'])} site(s) AegisOne had flagged")
            zmax = max(zmax, 1.6 * Z_ALERT)      # always at least "high" (80)
        z_part = float(np.clip(zmax / (2 * Z_ALERT), 0, 1))
        iso = iso_scores.get(uid, 0.0) if reasons or zmax else iso_scores.get(uid, 0.0) * 0.6
        score = round(100 * max(z_part, iso))
        if iso >= 0.85 and not reasons:
            reasons.append("today's mix of activity is unlike any other day in the organisation")
        level = "high" if score >= 75 else "medium" if score >= 50 else "low"
        out.append({"user_id": uid, "score": score, "level": level, "reasons": reasons[:4], "status": status,
                    "today": {k: int(t.get(k, 0)) for k in FEATURES}})
    out.sort(key=lambda r: -r["score"])
    return out


async def org_anomalies(db, organization_id: str, history_days: int = 30) -> Dict[str, Any]:
    """Build the per-user per-day counts for one organisation from what was recorded, and score the last 24 hours."""
    from sqlalchemy.future import select
    from api.database.models import WebsiteScan, CredentialEvent, EmailSecurityEvent, User

    now = datetime.utcnow()
    since = now - timedelta(days=history_days + 1)
    today_start = now - timedelta(hours=24)

    def day_of(ts: datetime) -> str:
        return "today" if ts >= today_start else (ts.date().isoformat())

    days: Dict[Any, Dict[str, Dict[str, float]]] = defaultdict(lambda: defaultdict(lambda: defaultdict(float)))
    seen_before: Dict[Any, set] = defaultdict(set)

    scans = (await db.execute(select(WebsiteScan.user_id, WebsiteScan.domain, WebsiteScan.decision, WebsiteScan.created_at)
                              .where(WebsiteScan.organization_id == organization_id, WebsiteScan.created_at >= since,
                                     WebsiteScan.user_id.isnot(None))
                              .order_by(WebsiteScan.created_at.asc()))).all()
    for uid, dom, dec, ts in scans:
        f = days[uid][day_of(ts)]
        f["scans"] += 1
        d = (dec or "").lower()
        if d in ("warn", "warning"):
            f["warned"] += 1
        elif d in ("block", "blocked"):
            f["blocked"] += 1
        if dom and dom not in seen_before[uid]:
            if seen_before[uid]:                 # the very first day just builds the list
                f["new_domains"] += 1
            seen_before[uid].add(dom)
        if ts.hour >= 22 or ts.hour < 6:
            f["off_hours"] += 1

    creds = (await db.execute(select(CredentialEvent.user_id, CredentialEvent.blocked, CredentialEvent.user_action, CredentialEvent.created_at)
                              .where(CredentialEvent.organization_id == organization_id, CredentialEvent.created_at >= since))).all()
    for uid, blocked, action, ts in creds:
        if uid is None:
            continue
        f = days[uid][day_of(ts)]
        f["cred_total"] += 1
        if blocked or (action or "").lower() in ("proceeded", "proceed", "override", "submitted_anyway"):
            f["cred_on_flagged"] += 1

    mails = (await db.execute(select(EmailSecurityEvent.user_id, EmailSecurityEvent.risk_score, EmailSecurityEvent.scanned_at)
                              .where(EmailSecurityEvent.organization_id == organization_id, EmailSecurityEvent.scanned_at >= since))).all()
    for uid, risk, ts in mails:
        if uid is not None and ts is not None and (risk or 0) >= 51:
            days[uid][day_of(ts)]["email_flagged"] += 1

    rows = score_users({u: {d: dict(f) for d, f in per.items()} for u, per in days.items()}, today="today")
    users = {}
    if rows:
        ids = [r["user_id"] for r in rows]
        for u in (await db.execute(select(User.id, User.full_name, User.email, User.department).where(User.id.in_(ids)))).all():
            users[u[0]] = {"name": u[1] or u[2], "email": u[2], "department": u[3]}
    for r in rows:
        r.update(users.get(r["user_id"], {}))
    return {"generated_at": now.isoformat() + "Z", "history_days": history_days, "window": "last 24 hours",
            "users": rows, "method": "robust z-score against each person's own history + Isolation Forest across the organisation"}
