"""
Structured e-mail features for the v2 detector. Everything here is computable from the sender, subject and body
that the extension / Gmail add-on / API already send; header authentication results (SPF/DKIM/DMARC) are not
available in the training corpora, so they are used by the rule layer when present, not learned here.

The features describe HOW a message asks for something (urgency, credential or payment request, secrecy, a link to
a host that is not the sender's), which is what stays constant when phishing wording changes, instead of which
words appear.
"""
import math
import re
from urllib.parse import urlparse

import numpy as np

URL_RE = re.compile(r"https?://[^\s<>\"')\]}>]+", re.I)
BARE_RE = re.compile(r"\b(?:[a-z0-9-]+\.)+(?:com|net|org|info|top|xyz|click|online|site|cfd|icu|live|pk|co|io|link)\b/?[^\s]*", re.I)
FREEMAIL = {"gmail.com", "yahoo.com", "outlook.com", "hotmail.com", "live.com", "aol.com", "proton.me", "protonmail.com", "icloud.com", "mail.com", "gmx.com"}
SHORTENERS = {"bit.ly", "tinyurl.com", "t.co", "goo.gl", "ow.ly", "is.gd", "buff.ly", "rebrand.ly", "cutt.ly", "shorturl.at", "rb.gy"}
BAD_TLD = {"top", "xyz", "info", "click", "online", "site", "cfd", "icu", "live", "link", "cc", "tk", "ml", "ga", "cf", "gq", "buzz", "monster"}
BRANDS = ["microsoft", "office", "outlook", "google", "apple", "icloud", "amazon", "paypal", "netflix", "linkedin", "dropbox", "docusign", "zoom",
          "dhl", "fedex", "hbl", "ubl", "meezan", "alfalah", "mcb", "allied", "jazzcash", "easypaisa", "nadra", "fbr", "daraz", "careem", "bank"]

URGENCY = ["urgent", "immediately", "asap", "right away", "within 24", "within 48", "today", "expires", "expire", "final notice", "last warning",
           "act now", "action required", "will be suspended", "will be closed", "will be locked", "deactivated", "disconnected", "restricted", "limited"]
CRED = ["password", "verify your", "confirm your", "sign in", "log in", "login", "credentials", "otp", "one-time", "pin", "cnic", "card number",
        "cvv", "security code", "authenticator", "mfa", "2fa", "update your", "revalidate", "re-verify"]
PAY = ["gift card", "gift cards", "wire", "bank account", "bank details", "banking details", "bitcoin", "crypto", "transfer", "payment", "invoice",
       "refund", "deposit", "salary", "payroll", "reimburse", "voucher", "customs fee", "pay now"]
SECRECY = ["confidential", "keep this between", "between us", "don't tell", "do not tell", "cannot talk", "can't talk", "in a meeting", "reply only to me",
           "do not call", "don't call", "quick favour", "quick favor", "are you at your desk", "are you available"]
REWARD = ["congratulations", "winner", "won", "prize", "voucher", "lottery", "selected", "claim"]
SHARE = ["shared a file", "shared with you", "view document", "open the document", "review and sign", "review the document", "recording", "download it"]
ASKS_REPLY = ["reply to this", "reply as soon", "let me know", "get back to me"]

NAMES = ["n_urls", "has_url", "url_host_not_sender", "url_ip_host", "url_shortener", "url_bad_tld", "url_punycode", "url_at_symbol", "url_http_only",
         "url_brand_in_host", "sender_freemail", "sender_display_brand_mismatch", "sender_domain_bad_tld", "reply_chain",
         "urgency", "cred_ask", "pay_ask", "secrecy", "reward", "share_lure", "urgency_and_cred", "pay_and_secrecy",
         "log_len_body", "log_len_subject", "caps_ratio", "excl", "digits_ratio", "short_message", "has_html", "attachment_mention"]
N_FEATURES = len(NAMES)


def _sender_domain(sender: str) -> str:
    m = re.search(r"@([A-Za-z0-9.-]+)", sender or "")
    return m.group(1).lower() if m else ""


def _count(text: str, words) -> int:
    return sum(1 for w in words if w in text)


def email_features(sender: str, subject: str, body: str) -> np.ndarray:
    sender, subject, body = str(sender or ""), str(subject or ""), str(body or "")
    t = (subject + " " + body).lower()
    urls = URL_RE.findall(body)
    hosts = []
    for u in urls:
        try:
            hosts.append((urlparse(u).hostname or "").lower())
        except Exception:
            pass
    sdom = _sender_domain(sender)
    sroot = ".".join(sdom.split(".")[-2:]) if sdom else ""
    f = {n: 0.0 for n in NAMES}
    f["n_urls"] = min(len(urls), 10) / 10.0
    f["has_url"] = 1.0 if urls else 0.0
    f["url_host_not_sender"] = 1.0 if hosts and sroot and any(not h.endswith(sroot) for h in hosts) else 0.0
    f["url_ip_host"] = 1.0 if any(re.fullmatch(r"\d{1,3}(\.\d{1,3}){3}", h) for h in hosts) else 0.0
    f["url_shortener"] = 1.0 if any(h in SHORTENERS for h in hosts) else 0.0
    f["url_bad_tld"] = 1.0 if any(h.rsplit(".", 1)[-1] in BAD_TLD for h in hosts if "." in h) else 0.0
    f["url_punycode"] = 1.0 if any("xn--" in h for h in hosts) else 0.0
    f["url_at_symbol"] = 1.0 if any("@" in u.split("//", 1)[-1].split("/", 1)[0] for u in urls) else 0.0
    f["url_http_only"] = 1.0 if urls and all(u.lower().startswith("http://") for u in urls) else 0.0
    f["url_brand_in_host"] = 1.0 if any(b in h for h in hosts for b in BRANDS) and not any(h.endswith(x) for h in hosts for x in ("microsoft.com", "google.com", "paypal.com", "github.com", "zoom.us", "hbl.com", "daraz.pk", "careem.com")) else 0.0
    f["sender_freemail"] = 1.0 if sdom in FREEMAIL else 0.0
    disp = sender.split("<")[0].lower()
    f["sender_display_brand_mismatch"] = 1.0 if disp and sdom and any(b in disp for b in BRANDS) and not any(b in sdom for b in BRANDS if b in disp) else 0.0
    f["sender_domain_bad_tld"] = 1.0 if sdom and sdom.rsplit(".", 1)[-1] in BAD_TLD else 0.0
    f["reply_chain"] = 1.0 if subject.lower().startswith(("re:", "fw:", "fwd:")) else 0.0
    f["urgency"] = min(_count(t, URGENCY), 4) / 4.0
    f["cred_ask"] = min(_count(t, CRED), 4) / 4.0
    f["pay_ask"] = min(_count(t, PAY), 4) / 4.0
    f["secrecy"] = min(_count(t, SECRECY), 3) / 3.0
    f["reward"] = min(_count(t, REWARD), 3) / 3.0
    f["share_lure"] = min(_count(t, SHARE), 2) / 2.0
    f["urgency_and_cred"] = f["urgency"] * f["cred_ask"]
    f["pay_and_secrecy"] = f["pay_ask"] * f["secrecy"]
    f["log_len_body"] = math.log1p(len(body)) / 10.0
    f["log_len_subject"] = math.log1p(len(subject)) / 6.0
    f["caps_ratio"] = sum(c.isupper() for c in body) / max(len(body), 1)
    f["excl"] = min(body.count("!"), 10) / 10.0
    f["digits_ratio"] = sum(c.isdigit() for c in body) / max(len(body), 1)
    f["short_message"] = 1.0 if len(body) < 400 else 0.0
    f["has_html"] = 1.0 if re.search(r"<(a|div|table|html|body)\b", body, re.I) else 0.0
    f["attachment_mention"] = 1.0 if re.search(r"attach|\.pdf|\.docx|\.xlsx|\.zip|\.html", t) else 0.0
    return np.array([f[n] for n in NAMES], dtype=np.float32)


def batch_features(senders, subjects, bodies) -> np.ndarray:
    return np.stack([email_features(s, j, b) for s, j, b in zip(senders, subjects, bodies)])
