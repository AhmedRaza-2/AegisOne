"""
AegisOne — Business E-mail Compromise (BEC) detection (scope 7.2 "Business Email Compromise pattern recognition")
=================================================================================================================
BEC mail usually has NO link and NO attachment, so link scoring and attachment analysis cannot see it, and its wording
("Are you at your desk? I need a quick favour") is ordinary office English. What gives it away is the combination of

  IDENTITY   the message pretends to come from someone it does not:
             - an executive title or a colleague-looking name on a free-mail account (gmail, outlook ...)
             - a display name that contains a DIFFERENT e-mail address ("CEO <ceo@company.com>" <x@gmail.com>)
             - a sender domain that is a near-copy of the organisation's own domain (cornpany.com, company-pk.com)
             - a Reply-To that sends the answer somewhere else
  REQUEST    it asks for money or money-like things: a wire / bank-detail change / invoice payment / payroll change /
             gift cards
  PRESSURE   urgency, secrecy, "I'm in a meeting, can't talk"

A verdict-level floor is applied ONLY when an identity signal AND a money request appear together (each alone is common in
genuine mail, e.g. a real vendor asking for an overdue invoice). Everything else is reported as explanation only.
"""
import re
from typing import Any, Dict, List, Optional

FREEMAIL = {"gmail.com", "googlemail.com", "yahoo.com", "outlook.com", "hotmail.com", "live.com", "aol.com", "icloud.com",
            "proton.me", "protonmail.com", "gmx.com", "mail.com", "yandex.com", "zoho.com", "msn.com"}
_EXEC = re.compile(r"\b(ceo|cfo|coo|cto|chief\s+\w+\s+officer|managing\s+director|md|chairman|chairperson|president|founder|"
                   r"director|head\s+of\s+finance|finance\s+(?:manager|director)|general\s+manager|gm)\b", re.I)
_ADDR = re.compile(r"[\w.+\-]+@([\w\-]+(?:\.[\w\-]+)+)")

_GIFT = re.compile(r"\b(gift\s*cards?|itunes|google\s*play\s*(?:cards?)?|steam\s*cards?|amazon\s*cards?|scratch\s+(?:off\s+)?the\s+back|"
                   r"card\s+codes?|vouchers?\s+codes?)\b", re.I)
_BANK_CHANGE = re.compile(r"\b(change|update|new|different|updated)\b[^.\n]{0,40}\b(bank|banking|account|iban|swift|payment)\s*"
                          r"(details|information|info|number|account)?\b", re.I)
_WIRE = re.compile(r"\b(wire\s+transfer|wire\s+the|bank\s+transfer|transfer\s+(?:the\s+)?(?:funds|amount|payment|money)|"
                   r"process\s+(?:a|the|this)\s+payment|make\s+(?:a|the)\s+payment|settle\s+(?:the|this)\s+invoice|"
                   r"overdue\s+invoice|outstanding\s+invoice|remit|remittance|iban|swift\s+code)\b", re.I)
_PAYROLL = re.compile(r"\b(payroll|salary|direct\s+deposit)\b[^.\n]{0,40}\b(change|update|new|switch)\b|"
                      r"\b(change|update|switch)\b[^.\n]{0,40}\b(payroll|salary|direct\s+deposit)\b", re.I)
_SECRECY = re.compile(r"\b(confidential|discreet|keep\s+(?:this|it)\s+(?:between\s+us|quiet|private)|don'?t\s+(?:tell|mention|discuss)|"
                      r"do\s+not\s+(?:tell|mention|discuss|call)|between\s+(?:you\s+and\s+me|us))\b", re.I)
_UNAVAILABLE = re.compile(r"\b(in\s+a\s+meeting|can'?t\s+(?:talk|call|take\s+calls)|cannot\s+(?:talk|call)|on\s+a\s+flight|"
                          r"travell?ing|reply\s+(?:by|via)\s+(?:e-?mail|text)\s+only|are\s+you\s+(?:at\s+your\s+desk|available)|"
                          r"quick\s+(?:favou?r|task)|need\s+(?:a|your)\s+(?:favou?r|help)\s+(?:urgently|asap|now))\b", re.I)
_URGENT = re.compile(r"\b(urgent(?:ly)?|asap|immediately|right\s+away|today|within\s+the\s+hour|end\s+of\s+day|eod|before\s+\d)\b", re.I)


def _domain(addr: str) -> str:
    m = _ADDR.search(addr or "")
    return m.group(1).lower() if m else ""


def _lev(a: str, b: str) -> int:
    if a == b:
        return 0
    prev = list(range(len(b) + 1))
    for i, ca in enumerate(a, 1):
        cur = [i]
        for j, cb in enumerate(b, 1):
            cur.append(min(prev[j] + 1, cur[j - 1] + 1, prev[j - 1] + (ca != cb)))
        prev = cur
    return prev[-1]


def _lookalike(dom: str, org: str) -> bool:
    if not dom or not org or dom == org or dom.endswith("." + org):
        return False
    a, b = dom.split(".")[0], org.split(".")[0]
    if len(b) < 4:
        return False
    skel = lambda s: s.replace("rn", "m").replace("vv", "w").replace("0", "o").replace("1", "l").replace("-", "")
    return _lev(a, b) <= 2 or skel(a) == skel(b) or (b in a and a != b)


def detect_bec(sender: str, subject: str, body: str, org_domain: Optional[str] = None,
               reply_to: Optional[str] = None) -> Dict[str, Any]:
    """Return {score 0-1, level none|low|medium|high, identity, request, signals[], floor}."""
    sender = sender or ""
    text = f"{subject or ''}\n{body or ''}"
    real = sender.rsplit("<", 1)[-1] if "<" in sender else sender      # the address inside <...> is the real sender
    sdom = _domain(real)
    disp = sender.split("<")[0].strip().strip('"') if "<" in sender else ""
    org = (org_domain or "").lower().strip() or None
    if org in FREEMAIL:
        org = None

    signals: List[str] = []
    identity = 0.0
    if disp and _EXEC.search(disp) and (sdom in FREEMAIL or (org and sdom and not sdom.endswith(org))):
        identity = max(identity, 0.6)
        signals.append(f"an executive title ('{_EXEC.search(disp).group(0)}') sent from {'a free e-mail account' if sdom in FREEMAIL else 'an outside domain'}")
    inner = _domain(disp)
    if inner and sdom and inner != sdom:
        identity = max(identity, 0.7)
        signals.append(f"the display name shows {inner} but the mail really comes from {sdom}")
    if org and _lookalike(sdom, org):
        identity = max(identity, 0.8)
        signals.append(f"the sender domain {sdom} imitates your organisation's domain {org}")
    rdom = _domain(reply_to or "")
    if rdom and sdom and rdom != sdom:
        identity = max(identity, 0.5)
        signals.append(f"replies would go to {rdom}, not to the sender's domain {sdom}")
    if not identity and sdom in FREEMAIL and _UNAVAILABLE.search(text):
        identity = 0.35
        signals.append("a personal e-mail account asking for an urgent favour")

    request = 0.0
    if _GIFT.search(text):
        request = max(request, 0.8); signals.append("asks for gift cards or card codes")
    if _BANK_CHANGE.search(text):
        request = max(request, 0.7); signals.append("asks to change bank or payment details")
    if _PAYROLL.search(text):
        request = max(request, 0.7); signals.append("asks to change payroll / salary deposit details")
    if _WIRE.search(text):
        request = max(request, 0.55); signals.append("asks for a transfer or invoice payment")

    pressure = 0.0
    if _SECRECY.search(text):
        pressure += 0.15; signals.append("asks you to keep it secret")
    if _UNAVAILABLE.search(text):
        pressure += 0.1; signals.append("says the sender cannot be reached by phone")
    if _URGENT.search(text):
        pressure += 0.05

    score = min(1.0, identity * 0.5 + request * 0.4 + min(pressure, 0.25) + (0.15 if identity and request else 0.0))
    if identity >= 0.5 and request >= 0.55:
        level, floor = "high", 0.80
    elif identity and request:
        level, floor = "medium", 0.60
    elif request and pressure >= 0.15:
        level, floor = "low", 0.0
    else:
        level, floor = ("low" if signals else "none"), 0.0
    return {"score": round(score, 3), "level": level, "identity": round(identity, 2), "request": round(request, 2),
            "signals": signals[:6], "floor": floor}
