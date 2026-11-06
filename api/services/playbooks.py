"""
AegisOne — Incident response playbooks
======================================
Short, concrete containment / recovery checklists per incident type, shown on the incident page and
in the printable report. Where a step can be done from inside AegisOne it carries an `action` key
the dashboard turns into a button (see POST /admin/incidents/{id}/actions):

  block_domain / allow_domain   organization-wide block or allow rule for the incident's domain
  notify_affected               in-app security notice to everyone who met the item
  revoke_sessions               sign the exposed people out of every session (their tokens stop working)
  reset_credentials             sign them out AND e-mail each a one-time code to set a new password
  assign_training               give them the short training module that matches the attack
  warn_organization             security notice to the whole organization

Every step has a stable id ("<phase>.<step>") so the response can be tracked: who ticked it, when, with what
note. Progress is stored with the incident (evidence["response"]["steps"]) and drives the time-to-contain metric.
"""
from datetime import datetime
from typing import Any, Dict, Optional

CREDENTIAL = "credential_phishing"
MALWARE = "malware_download"
EMAIL = "email_phishing"
BEC = "business_email_compromise"
QR = "qr_phishing"
MESSAGING = "messaging_scam"
FALSE_POSITIVE = "false_positive"
GENERIC = "generic_phishing"

ACTIONS = ("block_domain", "allow_domain", "notify_affected", "revoke_sessions", "reset_credentials", "assign_training", "warn_organization")
# a step in one of these phases counts as containment for the time-to-contain metric
CONTAIN_PHASES = ("Contain",)

_PLAYBOOKS: Dict[str, Dict[str, Any]] = {
    CREDENTIAL: {
        "title": "Credential phishing (fake login page)",
        "summary": "Someone may have typed a password into a look-alike site. Treat every account that touched it as exposed until proven otherwise.",
        "training_module": "credential_safety",
        "phases": [
            {"phase": "Contain", "steps": [
                {"text": "Block the domain for the whole organization so no one else can open it.", "action": "block_domain"},
                {"text": "Ask everyone who visited it to stop using the page and not enter anything further.", "action": "notify_affected"},
            ]},
            {"phase": "Assess", "steps": [
                {"text": "Check the Exposure section: which users opened the page, and did anyone submit credentials?"},
                {"text": "Look at the redirect chain to find the real landing page and any intermediate link shorteners."},
            ]},
            {"phase": "Recover", "steps": [
                {"text": "Sign out everyone who entered credentials and e-mail them a code to set a new password.", "action": "reset_credentials"},
                {"text": "If the account is used elsewhere (email, VPN, banking), change those passwords too and enable MFA."},
                {"text": "Review the affected accounts' recent logins and mail-forwarding rules for signs of takeover."},
            ]},
            {"phase": "Close out", "steps": [
                {"text": "Give the people who opened the page the 4-minute 'Protecting your passwords' refresher.", "action": "assign_training"},
                {"text": "Record the verdict (Confirmed phishing) so the detection feeds retraining."},
            ]},
        ],
    },
    MALWARE: {
        "title": "Malicious or suspicious download",
        "summary": "A file flagged as dangerous may have reached a device. Find out whether it was opened.",
        "training_module": "links_and_domains",
        "phases": [
            {"phase": "Contain", "steps": [
                {"text": "Block the download source domain organization-wide.", "action": "block_domain"},
                {"text": "Ask the user not to open the file, and to disconnect the device from the network if it was already run.", "action": "notify_affected"},
            ]},
            {"phase": "Assess", "steps": [
                {"text": "Confirm from the Exposure section whether the download was blocked or allowed, and on which device."},
                {"text": "Run a full antivirus scan on the device; check for new startup items and unknown processes."},
            ]},
            {"phase": "Recover", "steps": [
                {"text": "If the file was executed: sign the user out of every session, then change passwords from a clean device.", "action": "revoke_sessions"},
                {"text": "Isolate and re-image the device if anything was installed."},
            ]},
        ],
    },
    EMAIL: {
        "title": "Phishing email",
        "summary": "A malicious message reached an inbox. Remove it everywhere and find out who clicked.",
        "training_module": "links_and_domains",
        "phases": [
            {"phase": "Contain", "steps": [
                {"text": "Block every link domain found in the email.", "action": "block_domain"},
                {"text": "Delete or quarantine the same message in other mailboxes (search by sender and subject)."},
                {"text": "Warn recipients not to click links or open attachments from this sender.", "action": "notify_affected"},
            ]},
            {"phase": "Assess", "steps": [
                {"text": "Check who opened links or attachments (Exposure) and whether credentials were entered."},
                {"text": "Inspect the sender and reply-to addresses for look-alike or free-mail domains."},
            ]},
            {"phase": "Recover", "steps": [
                {"text": "Sign out anyone who clicked and entered credentials, and e-mail them a password reset code.", "action": "reset_credentials"},
                {"text": "Add the sender domain to your mail gateway block list."},
            ]},
            {"phase": "Close out", "steps": [
                {"text": "Assign the 'Reading links and sender addresses' module to the people who clicked.", "action": "assign_training"},
            ]},
        ],
    },
    BEC: {
        "title": "Business email compromise / payment fraud",
        "summary": "A message impersonates an executive, vendor or colleague to redirect money or data.",
        "training_module": "urgent_requests_bec",
        "phases": [
            {"phase": "Contain", "steps": [
                {"text": "Stop any payment or bank-detail change requested in the message until it is verified by phone."},
                {"text": "Notify finance and the impersonated person immediately.", "action": "notify_affected"},
                {"text": "Warn the whole organization that this impersonation is circulating.", "action": "warn_organization"},
            ]},
            {"phase": "Assess", "steps": [
                {"text": "Verify the request through a second channel (a phone number you already had, not one in the email)."},
                {"text": "Check whether the sender domain is a look-alike of your real domain or of a vendor."},
            ]},
            {"phase": "Recover", "steps": [
                {"text": "If money was sent: contact the bank at once to request a recall and report to the authorities."},
                {"text": "Reset the credentials of the impersonated account if it may itself be compromised."},
            ]},
            {"phase": "Close out", "steps": [
                {"text": "Assign the 'Urgent requests, executives and invoices' module to the people involved.", "action": "assign_training"},
            ]},
        ],
    },
    QR: {
        "title": "Malicious QR code",
        "summary": "A QR code leads to a harmful address. Phone cameras bypass desktop protection, so act on every device.",
        "training_module": "qr_and_mobile",
        "phases": [
            {"phase": "Contain", "steps": [
                {"text": "Block the decoded destination domain.", "action": "block_domain"},
                {"text": "Tell people not to scan the code (posters, emails and chats may carry the same image).", "action": "notify_affected"},
            ]},
            {"phase": "Assess", "steps": [
                {"text": "Find where the image appeared (email, chat, website) and remove it there."},
                {"text": "Ask whether anyone scanned it on a personal phone and entered details."},
            ]},
            {"phase": "Recover", "steps": [
                {"text": "Sign out anyone who submitted credentials on the landing page and e-mail them a reset code.", "action": "reset_credentials"},
                {"text": "Assign the 'QR codes and phones' module to the people who saw it.", "action": "assign_training"},
            ]},
        ],
    },
    MESSAGING: {
        "title": "Scam message in WhatsApp / chat",
        "summary": "A chat message tries to get money, codes or credentials.",
        "training_module": "urgent_requests_bec",
        "phases": [
            {"phase": "Contain", "steps": [
                {"text": "Block any link domain in the message.", "action": "block_domain"},
                {"text": "Remind staff never to share one-time codes or transfer money on a chat request.", "action": "warn_organization"},
            ]},
            {"phase": "Recover", "steps": [
                {"text": "If a one-time code was shared: sign the person out of every session, then change the account password.", "action": "revoke_sessions"},
            ]},
        ],
    },
    FALSE_POSITIVE: {
        "title": "Reported false alarm",
        "summary": "An employee says a safe item was flagged. Verify, then teach the system.",
        "phases": [
            {"phase": "Verify", "steps": [
                {"text": "Open the page or message safely and compare it with the evidence under 'Why it was flagged'."},
                {"text": "Check the domain age and owner in the Domain section."},
            ]},
            {"phase": "Resolve", "steps": [
                {"text": "If it is safe, allow the domain for your organization so no one else is bothered.", "action": "allow_domain"},
                {"text": "Record the verdict (False positive) and tick 'Add to training data' so the model learns from it."},
            ]},
        ],
    },
    GENERIC: {
        "title": "Suspected phishing",
        "summary": "General response when the incident type is not clear.",
        "training_module": "links_and_domains",
        "phases": [
            {"phase": "Contain", "steps": [
                {"text": "Block the destination domain organization-wide.", "action": "block_domain"},
                {"text": "Notify the people who saw it.", "action": "notify_affected"},
            ]},
            {"phase": "Assess", "steps": [
                {"text": "Review the evidence and exposure sections to decide whether anyone interacted with it."},
            ]},
            {"phase": "Recover", "steps": [
                {"text": "Sign out anyone who submitted credentials and e-mail them a reset code.", "action": "reset_credentials"},
                {"text": "Record your verdict to feed retraining."},
            ]},
        ],
    },
}


def classify_incident(*, report_type: Optional[str], target_type: Optional[str],
                      evidence: Optional[Dict[str, Any]]) -> str:
    rt = (report_type or "").lower()
    tt = (target_type or "").lower()
    ev = evidence or {}
    kind = str(ev.get("scan_kind") or "").lower()
    if rt in ("false_positive", "benign"):
        return FALSE_POSITIVE
    if (ev.get("image_evidence") or {}).get("qr_codes"):
        return QR
    if kind == "whatsapp" or "whatsapp" in str(ev.get("source_model", "")).lower():
        return MESSAGING
    if kind == "download" or tt == "file":
        return MALWARE
    text = " ".join(str(x) for x in (ev.get("findings") or [])).lower()
    if tt == "email" or kind == "email":
        if any(w in text for w in ("wire", "invoice", "payment", "bank details", "transfer", "gift card", "ceo", "executive")):
            return BEC
        return EMAIL
    if tt in ("url", "page") or kind in ("page", "url"):
        return CREDENTIAL
    return GENERIC


def get_playbook(incident_type: str, progress: Optional[Dict[str, Any]] = None) -> Dict[str, Any]:
    """The playbook for an incident type with stable step ids; with `progress` (evidence["response"]["steps"])
    every step also says whether it is done, by whom and when, and the playbook carries a completion count."""
    pb = _PLAYBOOKS.get(incident_type) or _PLAYBOOKS[GENERIC]
    progress = progress or {}
    phases, total, done = [], 0, 0
    for pi, ph in enumerate(pb["phases"], start=1):
        steps = []
        for si, st in enumerate(ph["steps"], start=1):
            sid = f"{pi}.{si}"
            p = progress.get(sid) or {}
            item = {"id": sid, **st, "done": bool(p.get("done")), "done_by": p.get("by"), "done_at": p.get("at"), "note": p.get("note")}
            steps.append(item)
            total += 1
            done += 1 if item["done"] else 0
        phases.append({"phase": ph["phase"], "steps": steps, "complete": all(s["done"] for s in steps)})
    out = {k: v for k, v in pb.items() if k != "phases"}
    return {"type": incident_type, **out, "phases": phases, "steps_total": total, "steps_done": done}


def step_exists(incident_type: str, step_id: str) -> Optional[Dict[str, Any]]:
    pb = get_playbook(incident_type)
    for ph in pb["phases"]:
        for st in ph["steps"]:
            if st["id"] == step_id:
                return {"phase": ph["phase"], **st}
    return None


def mark_step(response: Dict[str, Any], incident_type: str, step_id: str, *, done: bool, by: str, note: Optional[str] = None) -> Dict[str, Any]:
    """Update the response record in place: tick / untick a step and stamp the first containment time."""
    st = step_exists(incident_type, step_id)
    if st is None:
        raise KeyError(step_id)
    now = datetime.utcnow().isoformat() + "Z"
    steps = dict(response.get("steps") or {})
    steps[step_id] = {"done": bool(done), "by": by, "at": now, "note": (note or "")[:500] or None}
    response["steps"] = steps
    if done and st["phase"] in CONTAIN_PHASES and not response.get("contained_at"):
        response["contained_at"] = now
    return response


def step_for_action(incident_type: str, action: str) -> Optional[str]:
    """The id of the first playbook step that carries `action`, so running the action ticks its step."""
    for ph in get_playbook(incident_type)["phases"]:
        for st in ph["steps"]:
            if st.get("action") == action:
                return st["id"]
    return None
