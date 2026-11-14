"""
AegisOne — what is INSIDE a QR code
===================================
A QR code is only a container. Most carry a web link (that goes to the URL model like any other link),
but "quishing" also uses codes that:

  * run code or open local content   javascript:  data:  vbscript:  file:  blob:  intent:
  * ask for money                    upi://pay  bitcoin:  ethereum:  paytm:  phonepe:  ...
  * join an attacker's Wi-Fi         WIFI:T:...;S:...;P:...;;
  * start a call / SMS / e-mail      tel:  sms:  smsto:  mailto:
  * install an app                   market://  itms-apps://  intent://
  * hide the real link behind a shortener (bit.ly ...)

This module classifies a decoded payload and gives it a minimum risk ("floor") when the KIND alone is
dangerous, independently of any model. The caller still sends links to the URL model and wording to the
text model; the floor only makes sure a code that cannot be judged by words or a domain name
(javascript:alert(1), a payment request) is never reported as safe.
"""
import re
from typing import Any, Dict
from urllib.parse import urlparse

_SCHEME = re.compile(r"^\s*([a-zA-Z][a-zA-Z0-9+.\-]{1,20}):", re.S)
_BARE_DOMAIN = re.compile(r"^(?:www\.)?(?:[a-z0-9\-]+\.)+[a-z]{2,}(?:[:/?#]\S*)?$", re.I)

_SCRIPT = {"javascript", "vbscript", "data", "file", "blob", "view-source", "ms-msdt", "search-ms", "ms-officecmd"}
_PAYMENT = {"upi", "bitcoin", "ethereum", "litecoin", "monero", "tez", "paytm", "phonepe", "gpay", "paypal", "venmo", "cash", "raast", "easypaisa", "jazzcash"}
_CONTACT = {"tel", "sms", "smsto", "mms", "mmsto", "mailto", "facetime", "skype", "whatsapp", "tg", "sgnl"}
_APP = {"market", "itms-apps", "itms-services", "intent", "ms-windows-store", "apps"}

# Floors (probability-like, 0-1): below WARN (0.51) = "be careful", above = warn/block.
FLOORS = {"script": 0.97, "app_install": 0.62, "payment": 0.62, "wifi": 0.45, "contact": 0.40}


def classify_qr_payload(payload: str) -> Dict[str, Any]:
    """Return {kind, floor, reason, url?, text?, shortener?}. Never raises."""
    p = (payload or "").strip()
    out: Dict[str, Any] = {"kind": "text", "floor": 0.0, "reason": "", "payload": p[:300]}
    if not p:
        return out

    if p.upper().startswith("WIFI:"):
        open_net = bool(re.search(r"(^|;)T:(nopass|)(;|$)", p, re.I)) or "T:nopass" in p
        out.update(kind="wifi", floor=0.55 if open_net else FLOORS["wifi"],
                   reason="joins a Wi-Fi network" + (" with no password" if open_net else "") + " - an attacker's network can read your traffic")
        return out

    m = _SCHEME.match(p)
    scheme = m.group(1).lower() if m else ""

    if scheme in _SCRIPT:
        out.update(kind="script", floor=FLOORS["script"],
                   reason=f"runs code or opens local content ({scheme}:), which a genuine QR code never needs")
        return out
    if scheme in _PAYMENT:
        out.update(kind="payment", floor=FLOORS["payment"], reason="asks you to send money - confirm who you are paying before approving")
        return out
    if scheme in _APP:
        out.update(kind="app_install", floor=FLOORS["app_install"], reason="installs or opens an app outside the normal store page")
        return out
    if scheme in _CONTACT:
        out.update(kind="contact", floor=FLOORS["contact"], reason=f"starts a {'call' if scheme in ('tel', 'facetime') else 'message or e-mail'} to a number or address chosen by the code's author")
        if scheme in ("mailto", "sms", "smsto", "mms", "mmsto"):
            out["text"] = re.sub(r"^[a-z]+:", "", p, flags=re.I).replace("?body=", " ").replace("&body=", " ").replace("?subject=", " ").replace("&subject=", " ")[:1500]
        return out

    if scheme in ("http", "https"):
        out.update(kind="url", url=p[:2000])
    elif not scheme and _BARE_DOMAIN.match(p):
        out.update(kind="url", url="http://" + p[:2000])
    elif scheme in ("ftp", "ftps", "sftp"):
        out.update(kind="url", url=p[:2000], floor=0.45, reason="an unusual (non-web) link type")
    else:
        # plain text (or a vCard): wording goes to the text model, any link inside to the URL model
        out.update(kind="text", text=p[:3000])

    if out["kind"] == "url":
        try:
            host = (urlparse(out["url"]).hostname or "").lower()
        except ValueError:
            host = ""
        from api.services.redirect_tracer import SHORTENERS
        if host in SHORTENERS:
            out["shortener"] = True
            out["reason"] = "the real destination is hidden behind a link shortener"
    return out
