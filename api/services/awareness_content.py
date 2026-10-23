"""
AegisOne — security-awareness content: simulation templates and training modules.

Templates are what a simulated phishing e-mail looks like and, just as important, WHICH red flags it
contains: the landing page shown to an employee who clicks teaches exactly those. Placeholders:
{first_name}, {org}, {link}. All text is escaped when rendered; templates are plain data.
"""
from typing import Any, Dict, List, Optional

DIFFICULTY = {1: "Easy", 2: "Medium", 3: "Hard"}

TEMPLATES: List[Dict[str, Any]] = [
    {
        "key": "it_password_expiry", "name": "Password expiry notice", "category": "Credential harvesting", "difficulty": 1,
        "module": "credential_safety",
        "from_name": "IT Helpdesk", "from_address": "it-helpdesk@{org_domain}-support.com",
        "subject": "Your password expires in 24 hours",
        "body": "Hi {first_name},\n\nYour {org} network password will expire in 24 hours. To avoid being locked out of your account, confirm your password now:\n\n{link}\n\nThank you,\nIT Helpdesk",
        "red_flags": [
            "The sender's address uses a look-alike domain (…-support.com), not your company's real domain.",
            "It creates urgency (\"24 hours\") and threatens a lock-out so you act without thinking.",
            "Real IT teams never ask you to confirm a password through an e-mailed link.",
        ],
    },
    {
        "key": "hr_payroll_update", "name": "Payroll details update", "category": "Credential harvesting", "difficulty": 2,
        "module": "credential_safety",
        "from_name": "HR Payroll", "from_address": "payroll@hr-{org_domain}-portal.com",
        "subject": "Action required: confirm your payroll details before Friday",
        "body": "Dear {first_name},\n\nWe are migrating to a new payroll system. To make sure your salary is paid on time, please review and confirm your bank details:\n\n{link}\n\nEmployees who have not confirmed by Friday may see a delay in payment.\n\nHR Payroll Team",
        "red_flags": [
            "Money and deadlines are classic pressure points; attackers use them to rush you.",
            "The link goes to a portal that is not your company's HR system.",
            "Genuine payroll changes are announced inside the HR system, not through an e-mail asking for bank details.",
        ],
    },
    {
        "key": "shared_document", "name": "Shared document", "category": "Credential harvesting", "difficulty": 2,
        "module": "links_and_domains",
        "from_name": "Microsoft 365", "from_address": "no-reply@sharepoint-docs-notify.com",
        "subject": "{first_name}, \"Q3 Budget Review.xlsx\" was shared with you",
        "body": "{first_name}, a colleague shared a file with you.\n\nQ3 Budget Review.xlsx\n\nOpen the document: {link}\n\nThis link works only for {first_name}.",
        "red_flags": [
            "The sender domain is not microsoft.com or your company's own domain.",
            "You were not expecting this file, and the e-mail doesn't say who shared it.",
            "Hover over the link before clicking: it does not go to your company's real document site.",
        ],
    },
    {
        "key": "ceo_request", "name": "Urgent request from the CEO", "category": "Business e-mail compromise", "difficulty": 3,
        "module": "urgent_requests_bec",
        "from_name": "CEO Office", "from_address": "ceo.office@{org_domain}-mail.com",
        "subject": "Quick favour - are you at your desk?",
        "body": "{first_name},\n\nI'm in a meeting and can't talk. I need you to handle something confidential for me right now. Please review the request here and reply only to me:\n\n{link}\n\nSent from my phone",
        "red_flags": [
            "Executives rarely ask staff for \"confidential favours\" by e-mail; this is a well-known scam called CEO fraud.",
            "It asks you to keep quiet and move fast, which stops you from checking with anyone.",
            "The display name looks right but the address behind it is not the company's.",
        ],
    },
    {
        "key": "parcel_delivery", "name": "Parcel delivery problem", "category": "Malware / link", "difficulty": 1,
        "module": "links_and_domains",
        "from_name": "Express Delivery", "from_address": "tracking@parcel-update-center.com",
        "subject": "Your parcel could not be delivered - reschedule now",
        "body": "Hello {first_name},\n\nWe tried to deliver your parcel today but nobody was available. Your package will be returned unless you reschedule within 24 hours:\n\n{link}\n\nExpress Delivery",
        "red_flags": [
            "You may not even be expecting a parcel: unsolicited delivery notices are a common lure.",
            "It does not name the courier, the sender or a tracking number you recognise.",
            "The link and sender belong to a generic domain, not a real courier company.",
        ],
    },
    {
        "key": "unusual_signin", "name": "Unusual sign-in alert", "category": "Credential harvesting", "difficulty": 3,
        "module": "credential_safety",
        "from_name": "Account Security", "from_address": "security-alert@accounts-{org_domain}.net",
        "subject": "Unusual sign-in attempt blocked - review activity",
        "body": "Hi {first_name},\n\nWe blocked a sign-in to your {org} account from a new device (Lagos, Nigeria). If this was not you, secure your account immediately:\n\n{link}\n\nAccount Security Team",
        "red_flags": [
            "Fear is the hook: a foreign location and a \"blocked\" attack make you want to click to fix it.",
            "Do not use the e-mail's link. Open the real site yourself, or ask IT, to check your account.",
            "The sender domain is a look-alike of your company's.",
        ],
    },
    {
        "key": "qr_mfa", "name": "QR code: re-enrol MFA", "category": "QR phishing (quishing)", "difficulty": 3,
        "module": "qr_and_mobile",
        "from_name": "IT Security", "from_address": "mfa-enrolment@secure-{org_domain}-it.com",
        "subject": "Scan to re-enrol your multi-factor authentication",
        "body": "Hi {first_name},\n\nOur MFA system is being upgraded. Scan the QR code in the attached notice with your phone (or open the link below) to re-enrol before Monday:\n\n{link}\n\nIT Security",
        "red_flags": [
            "QR codes hide the destination, so scanners can't see where they lead; attackers use them to slip past e-mail filters.",
            "MFA re-enrolment is something IT does with you in person or through the real portal, not through an unexpected e-mail.",
            "Scanning a QR on your phone moves you onto a device that usually has fewer protections.",
        ],
    },
    {
        "key": "invoice_overdue", "name": "Overdue invoice", "category": "Payment fraud", "difficulty": 2,
        "module": "urgent_requests_bec",
        "from_name": "Accounts Receivable", "from_address": "billing@invoice-{org_domain}-accounts.com",
        "subject": "FINAL NOTICE: invoice #48213 is overdue",
        "body": "Dear {first_name},\n\nOur records show invoice #48213 is 30 days overdue. Services may be suspended unless payment is made today. View and pay the invoice:\n\n{link}\n\nAccounts Receivable",
        "red_flags": [
            "\"FINAL NOTICE\" and the threat of suspension are pressure tactics.",
            "You may not deal with invoices at all: check with Finance before doing anything.",
            "The sender domain doesn't match any vendor you know.",
        ],
    },
]

_TEMPLATE_BY_KEY = {t["key"]: t for t in TEMPLATES}


def get_template(key: str) -> Optional[Dict[str, Any]]:
    return _TEMPLATE_BY_KEY.get(key)


def render_template(tpl: Dict[str, Any], first_name: str, org: str, link: str, org_domain: str = "company") -> Dict[str, str]:
    """Plain-text rendering (callers escape for HTML)."""
    ctx = {"first_name": first_name or "there", "org": org or "your company", "link": link, "org_domain": org_domain}
    return {
        "from_name": tpl["from_name"], "from_address": tpl["from_address"].format(**ctx),
        "subject": tpl["subject"].format(**ctx), "body": tpl["body"].format(**ctx),
    }


# ═════════════════════════════════════════════════════════════════════════════════════
# Training modules (short: a few minutes each, then a quiz)
# ═════════════════════════════════════════════════════════════════════════════════════

MODULES: List[Dict[str, Any]] = [
    {
        "key": "links_and_domains", "title": "Reading links and sender addresses", "minutes": 4,
        "summary": "How to tell a real link or sender from a convincing fake.",
        "lessons": [
            {"heading": "Read the domain from the right", "body": "The part that matters is the domain just before the first single slash. In 'login.company.com.secure-check.net/verify' the real domain is secure-check.net, not company.com. Everything to its left is decoration the attacker controls."},
            {"heading": "Look-alikes", "body": "Attackers register domains that look right at a glance: paypa1.com, company-support.com, company.co. Display names are free text, so 'IT Helpdesk' proves nothing. Always check the address behind the name."},
            {"heading": "Hover before you click", "body": "On a computer, hover over a link to see where it really goes. On a phone, press and hold. If the destination does not match what the message claims, do not open it."},
        ],
        "quiz": [
            {"q": "Which is the real domain in https://login.mycompany.com.account-verify.net/reset ?", "options": ["mycompany.com", "account-verify.net", "login.mycompany.com", "reset"], "answer": 1,
             "why": "Read from the right: the domain ends at the first single slash. Here that is account-verify.net."},
            {"q": "An email shows the sender name 'IT Helpdesk'. What proves it is genuine?", "options": ["The name says IT Helpdesk", "It has the company logo", "The address behind the name is the company's real domain", "It is marked urgent"], "answer": 2,
             "why": "Names and logos are easy to copy. Only the real sending domain counts, and even that should be checked against how you normally contact IT."},
            {"q": "You are unsure about a link in an email. What is the safest move?", "options": ["Click it once to see", "Forward it to colleagues", "Open the site by typing the address yourself, or ask IT", "Reply and ask the sender"], "answer": 2,
             "why": "Never use the suspicious message itself as the way to verify it."},
        ],
    },
    {
        "key": "credential_safety", "title": "Protecting your passwords", "minutes": 4,
        "summary": "When it is safe to type a password, and what to do if you slipped.",
        "lessons": [
            {"heading": "Pages that ask for your password", "body": "Only enter a password on a page you opened yourself from a bookmark or by typing the address. A link in an email or message can lead to a perfect copy of the real sign-in page that simply records what you type."},
            {"heading": "Nobody legitimate asks for it", "body": "IT teams, banks and HR never ask you to confirm a password by email or phone. 'Your password expires today' messages are a standard trick."},
            {"heading": "If you entered it by mistake", "body": "Act immediately: change the password from the real site, tell IT or report the message in AegisOne, and check for unusual activity. Speed limits the damage, and reporting quickly is always the right call. Nobody is punished for it."},
        ],
        "quiz": [
            {"q": "A message says your password expires in 24 hours and gives a link. You should:", "options": ["Click and update quickly", "Ignore the link and go to the real site yourself, or ask IT", "Reply with your password", "Forward to a friend"], "answer": 1,
             "why": "Expiry notices that push you through a link are a classic lure. Go to the real site yourself."},
            {"q": "You typed your password into a page and now suspect it was fake. What is the first thing to do?", "options": ["Hope it was fine", "Change the password on the real site and report it straight away", "Wait to see if anything happens", "Delete the email"], "answer": 1,
             "why": "Fast reporting limits harm. It is always better to report than to stay quiet."},
            {"q": "Which request is a legitimate use of your password?", "options": ["Signing in on a page you opened from your bookmarks", "A call from 'IT' asking you to read it out", "An email asking you to confirm it", "A chat message asking for it to fix your account"], "answer": 0,
             "why": "Only type your password on sites you reached yourself."},
        ],
    },
    {
        "key": "urgent_requests_bec", "title": "Urgent requests, executives and invoices", "minutes": 4,
        "summary": "Business e-mail compromise: how fraudsters use authority and urgency.",
        "lessons": [
            {"heading": "Authority and urgency", "body": "Fraudsters pretend to be a senior person or a supplier and ask for something quickly and quietly: gift cards, a payment, a change of bank details. The pressure is the signal."},
            {"heading": "Verify out of band", "body": "Confirm any unusual money or data request using a channel you already trust: call the person on a known number, message them in the company chat, or ask your manager. Never use the contact details inside the request."},
            {"heading": "Slow down on money", "body": "No real executive needs a secret favour through email. A bank-detail change should always be checked with the supplier through the number you already have on file."},
        ],
        "quiz": [
            {"q": "The 'CEO' emails asking you to quietly buy gift cards and send the codes. You should:", "options": ["Do it and keep it quiet", "Reply asking for details", "Verify through a number or chat you already trust, and report it", "Ask a colleague to do it"], "answer": 2,
             "why": "Secrecy and urgency are the tell. Verify out of band and report."},
            {"q": "A supplier emails new bank details for the next payment. The safest step is:", "options": ["Update the details", "Call the supplier on the number already on file to confirm", "Reply to the email to confirm", "Pay half to be safe"], "answer": 1,
             "why": "Use contact details you already trust, never the ones in the request."},
            {"q": "Which detail should make you suspicious of an executive's email?", "options": ["Polite tone", "It asks for secrecy and speed and comes from an unusual address", "It has a signature", "It is short"], "answer": 1,
             "why": "Secrecy plus speed plus an unfamiliar address are the classic pattern."},
        ],
    },
    {
        "key": "qr_and_mobile", "title": "QR codes and phones", "minutes": 3,
        "summary": "Why a QR code deserves the same suspicion as a link.",
        "lessons": [
            {"heading": "A QR code is just a link", "body": "You cannot read where a QR code goes by looking at it. Attackers print or email codes precisely because filters and people can't see the address behind them."},
            {"heading": "Check before you open", "body": "After scanning, look at the address your phone shows before you tap Open. AegisOne can also scan the destination of QR codes it finds on pages and in images. Wait for its verdict."},
            {"heading": "Be wary of 'scan to log in'", "body": "Unexpected codes asking you to log in, re-enrol MFA or pay should be treated like any suspicious message: do not scan, and report it."},
        ],
        "quiz": [
            {"q": "Why do attackers like QR codes?", "options": ["They are colourful", "People and filters can't see the destination", "They load faster", "They are encrypted"], "answer": 1,
             "why": "The hidden destination lets malicious links slip through."},
            {"q": "An email says 'scan this QR code to re-enrol your MFA before Monday'. You should:", "options": ["Scan it right away", "Not scan it, and report it", "Scan on your personal phone instead", "Forward it to colleagues"], "answer": 1,
             "why": "Unexpected 'scan to log in' requests are a known phishing pattern."},
        ],
    },
    {
        "key": "safe_reporting", "title": "How and why to report", "minutes": 2,
        "summary": "Reporting quickly protects everyone, and nobody gets in trouble for it.",
        "lessons": [
            {"heading": "Report, don't just delete", "body": "If you delete a phishing email, the next person still receives it. When you report, security can block the sender and warn colleagues within minutes."},
            {"heading": "How", "body": "Use the 'Report a threat' page in your AegisOne dashboard, or the report button on the warning shown by the browser extension. Include what you saw; you do not need to be sure."},
            {"heading": "Clicked something?", "body": "Tell IT immediately. Early reports are valued; the real damage comes from silence."},
        ],
        "quiz": [
            {"q": "You received a suspicious email and didn't click. What is best?", "options": ["Delete it", "Report it so others are protected", "Forward it to everyone", "Reply to the sender"], "answer": 1,
             "why": "Reporting lets security block it for everybody."},
            {"q": "You clicked a link and now feel unsure. You should:", "options": ["Stay quiet to avoid trouble", "Report it straight away", "Restart your computer", "Wait a week"], "answer": 1,
             "why": "Early reporting limits harm and is always welcomed."},
        ],
    },
]

_MODULE_BY_KEY = {m["key"]: m for m in MODULES}
PASS_MARK = 70


def get_module(key: str) -> Optional[Dict[str, Any]]:
    return _MODULE_BY_KEY.get(key)


def public_module(m: Dict[str, Any]) -> Dict[str, Any]:
    """The module without the answers (sent to the learner before they submit)."""
    return {"key": m["key"], "title": m["title"], "minutes": m["minutes"], "summary": m["summary"], "lessons": m["lessons"],
            "quiz": [{"q": q["q"], "options": q["options"]} for q in m["quiz"]]}


def grade(m: Dict[str, Any], answers: List[int]) -> Dict[str, Any]:
    results, correct = [], 0
    for i, q in enumerate(m["quiz"]):
        given = answers[i] if i < len(answers) else -1
        ok = given == q["answer"]
        correct += ok
        results.append({"correct": ok, "answer": q["answer"], "why": q["why"]})
    score = round(100 * correct / max(1, len(m["quiz"])))
    return {"score": score, "passed": score >= PASS_MARK, "results": results}
