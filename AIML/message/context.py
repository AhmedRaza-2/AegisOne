"""
Message model M1 - the model input, built identically for training (Kaggle) and serving (API).

One model for every message channel (e-mail, SMS, WhatsApp/chat). What makes it context-aware:
  * the channel, who sent it and what kind of sender that is (free-mail, look-alike display name, unknown SMS sender)
  * the links in it, reduced to registered domains and how they relate to the sender (a link to a host that is not the
    sender's, a shortener, a raw IP, punycode) - the same registered-domain reasoning as the URL model
  * an optional short HISTORY of previous turns of the conversation (WhatsApp/e-mail thread), so a reply such as
    "send it now" is judged in context. The training corpora contain no multi-turn data yet, so this slot is wired
    but UNTRAINED until real conversations flow in through the retraining loop (docs/MODEL_RESEARCH_AND_PLAN.md, M3).

Intent targets (multi-label) come from the structured feature modules and train auxiliary heads: the model learns
to say WHAT the message asks for (credentials, payment, a code, secrecy ...). They are the basis of the explanation
layer (XAI) - an explanation is a model output, not a regex run after the fact.
"""
import re
from urllib.parse import urlparse

import numpy as np

from AIML.email import features_v2 as EF
from AIML.text_general import features_v2 as TF

CHANNELS = ("email", "sms")           # WhatsApp and chat use the "sms" channel (short, sender-less, link-in-text)
INTENTS = ["urgency", "credential_request", "payment_request", "secrecy", "reward_lure", "share_lure",
           "code_request", "authority_claim", "link_mismatch"]
N_DENSE = EF.N_FEATURES + TF.N_FEATURES + len(CHANNELS)
MAX_BODY = 1800        # characters kept (the opening of a message carries the request; the tail is signature and quoting)
MAX_HISTORY = 400
_WS = re.compile(r"\s+")


def _reg(host):
    host = (host or "").lower().strip(".")
    parts = host.split(".")
    return ".".join(parts[-3:]) if len(parts) >= 3 and len(parts[-1]) == 2 and parts[-2] in ("co", "com", "org", "net", "gov", "edu") else ".".join(parts[-2:])


def _links(text):
    out = []
    for u in EF.URL_RE.findall(text or "")[:20]:
        try:
            out.append((urlparse(u).hostname or "").lower())
        except ValueError:
            pass
    if not out:     # bare hosts in SMS: "hbl-verify.top/login"
        for m in TF.URL_RE.findall((text or "").lower())[:20]:
            out.append(m.split("/")[0].replace("http://", "").replace("https://", ""))
    return [h for h in out if h]


def sender_kind(sender):
    d = EF._sender_domain(sender)
    if not sender:
        return "unknown"
    if d in EF.FREEMAIL:
        return "freemail"
    disp = sender.split("<")[0].lower()
    if d and disp and any(b in disp for b in EF.BRANDS) and not any(b in d for b in EF.BRANDS if b in disp):
        return "display-name-brand-mismatch"
    return "organisation" if d else "unknown"


def build_text(channel, sender, subject, body, history=None):
    channel = channel if channel in CHANNELS else "sms"
    sender, subject, body = str(sender or ""), str(subject or ""), str(body or "")
    sdom = EF._sender_domain(sender)
    hosts = _links(body)
    regs = list(dict.fromkeys(_reg(h) for h in hosts))[:3]
    flags = []
    sroot = _reg(sdom) if sdom else ""
    if hosts and sroot and any(not _reg(h) == sroot for h in hosts):
        flags.append("link-not-sender-domain")
    if any(h in EF.SHORTENERS for h in hosts):
        flags.append("shortener")
    if any(re.fullmatch(r"\d{1,3}(\.\d{1,3}){3}", h) for h in hosts):
        flags.append("ip-link")
    if any("xn--" in h for h in hosts):
        flags.append("punycode")
    if any(h.rsplit(".", 1)[-1] in EF.BAD_TLD for h in hosts if "." in h):
        flags.append("risky-tld")
    hist = ""
    if history:
        hist = " [history] " + " | ".join(re.sub(r"\s+", " ", str(h))[:150] for h in history[-3:])[:MAX_HISTORY]
    subj = _WS.sub(" ", subject)[:160] or "-"
    text = _WS.sub(" ", body)[:MAX_BODY]
    return (f"[channel] {channel} [sender] {sdom or '-'} {sender_kind(sender)} "
            f"[links] {len(hosts)} {' '.join(regs) or '-'} {' '.join(flags) or 'no-flags'}{hist} "
            f"[subject] {subj} [body] {text}")


def dense_features(channel, sender, subject, body):
    """[email features | text features | channel one-hot] - the block of the other channel stays zero."""
    e = np.zeros(EF.N_FEATURES, dtype=np.float32)
    t = np.zeros(TF.N_FEATURES, dtype=np.float32)
    if channel == "email":
        e = EF.email_features(sender, subject, body)
    else:
        t = TF.text_features(body)
    return np.concatenate([e, t, np.array([channel == "email", channel != "email"], dtype=np.float32)])


def intent_targets(channel, sender, subject, body):
    """Weak multi-label intent targets from the lexicons (thresholded feature groups)."""
    e = dict(zip(EF.NAMES, EF.email_features(sender, subject, body))) if channel == "email" else {}
    t = dict(zip(TF.NAMES, TF.text_features(body))) if channel != "email" else {}
    g = lambda d, k: float(d.get(k, 0.0)) > 0  # noqa: E731
    y = {"urgency": g(e, "urgency") or g(t, "urgency"),
         "credential_request": g(e, "cred_ask") or g(t, "ask_secret"),
         "payment_request": g(e, "pay_ask") or g(t, "ask_money") and g(t, "has_money"),
         "secrecy": g(e, "secrecy"),
         "reward_lure": g(e, "reward") or g(t, "reward"),
         "share_lure": g(e, "share_lure"),
         "code_request": g(t, "ask_code"),
         "authority_claim": g(t, "authority"),
         "link_mismatch": g(e, "url_host_not_sender") or g(e, "url_ip_host") or g(e, "url_shortener") or g(e, "url_bad_tld")
         or g(t, "url_shortener") or g(t, "url_bad_tld")}
    return np.array([float(y[k]) for k in INTENTS], dtype=np.float32)
