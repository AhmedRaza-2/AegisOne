"""
AegisOne — Incident response playbooks
======================================
Short, concrete containment / recovery checklists per incident type, shown on the incident page and
in the printable report. Where a step can be done from inside AegisOne it carries an `action` key
the dashboard turns into a button (see POST /admin/incidents/{id}/actions).

Kept deliberately small and static: the value is that an admin who has never handled this kind of
incident sees the right first steps, not that the platform tries to be a SOAR product.
"""
from typing import Any, Dict, Optional

CREDENTIAL = "credential_phishing"
MALWARE = "malware_download"
EMAIL = "email_phishing"
BEC = "business_email_compromise"
QR = "qr_phishing"
MESSAGING = "messaging_scam"
FALSE_POSITIVE = "false_positive"
GENERIC = "generic_phishing"

_PLAYBOOKS: Dict[str, Dict[str, Any]] = {
    CREDENTIAL: {
        "title": "Credential phishing (fake login page)",
        "summary": "Someone may have typed a password into a look-alike site. Treat every account that touched it as exposed until proven otherwise.",
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
                {"text": "Reset the password of every user who entered credentials and sign them out of all sessions."},
                {"text": "If the account is used elsewhere (email, VPN, banking), change those passwords too and enable MFA."},
                {"text": "Review the affected accounts' recent logins and mail-forwarding rules for signs of takeover."},
            ]},
            {"phase": "Close out", "steps": [
                {"text": "Record the verdict (Confirmed phishing) so the detection feeds retraining."},
                {"text": "Share a short note with the department explaining what the page looked like."},
            ]},
        ],
    },
    MALWARE: {
        "title": "Malicious or suspicious download",
        "summary": "A file flagged as dangerous may have reached a device. Find out whether it was opened.",
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
                {"text": "If the file was executed: isolate the device, change the user's passwords from a clean device, and re-image if needed."},
            ]},
        ],
    },
    EMAIL: {
        "title": "Phishing email",
        "summary": "A malicious message reached an inbox. Remove it everywhere and find out who clicked.",
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
                {"text": "Reset passwords for anyone who clicked and entered credentials."},
                {"text": "Add the sender domain to your mail gateway block list."},
            ]},
        ],
    },
    BEC: {
        "title": "Business email compromise / payment fraud",
        "summary": "A message impersonates an executive, vendor or colleague to redirect money or data.",
        "phases": [
            {"phase": "Contain", "steps": [
                {"text": "Stop any payment or bank-detail change requested in the message until it is verified by phone."},
                {"text": "Notify finance and the impersonated person immediately.", "action": "notify_affected"},
            ]},
            {"phase": "Assess", "steps": [
                {"text": "Verify the request through a second channel (a phone number you already had, not one in the email)."},
                {"text": "Check whether the sender domain is a look-alike of your real domain or of a vendor."},
            ]},
            {"phase": "Recover", "steps": [
                {"text": "If money was sent: contact the bank at once to request a recall and report to the authorities."},
                {"text": "Reset the credentials of the impersonated account if it may itself be compromised."},
            ]},
        ],
    },
    QR: {
        "title": "Malicious QR code",
        "summary": "A QR code leads to a harmful address. Phone cameras bypass desktop protection, so act on every device.",
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
                {"text": "Reset passwords for anyone who submitted credentials on the landing page."},
            ]},
        ],
    },
    MESSAGING: {
        "title": "Scam message in WhatsApp / chat",
        "summary": "A chat message tries to get money, codes or credentials.",
        "phases": [
            {"phase": "Contain", "steps": [
                {"text": "Block any link domain in the message.", "action": "block_domain"},
                {"text": "Remind staff never to share one-time codes or transfer money on a chat request.", "action": "notify_affected"},
            ]},
            {"phase": "Recover", "steps": [
                {"text": "If a one-time code was shared: change the account password and sign out other sessions immediately."},
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
        "phases": [
            {"phase": "Contain", "steps": [
                {"text": "Block the destination domain organization-wide.", "action": "block_domain"},
                {"text": "Notify the people who saw it.", "action": "notify_affected"},
            ]},
            {"phase": "Assess", "steps": [
                {"text": "Review the evidence and exposure sections to decide whether anyone interacted with it."},
            ]},
            {"phase": "Recover", "steps": [
                {"text": "Reset passwords for anyone who submitted credentials; record your verdict to feed retraining."},
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


def get_playbook(incident_type: str) -> Dict[str, Any]:
    pb = _PLAYBOOKS.get(incident_type) or _PLAYBOOKS[GENERIC]
    return {"type": incident_type, **pb}
