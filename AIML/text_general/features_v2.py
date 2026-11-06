"""
Structured features for SMS / WhatsApp / chat text (v2 detector), in English, Roman Urdu and Urdu script.

They describe what the message ASKS for - a code, a PIN, money, a click, a call - and the pressure around it, which is
what scams share across languages; the embedding handles the wording.
"""
import math
import re

import numpy as np

URL_RE = re.compile(r"(https?://\S+|www\.\S+|\b[a-z0-9-]+\.(?:com|net|org|info|top|xyz|click|online|site|pk|in|ly|me|link|live|icu|cfd)(?:/\S*)?)", re.I)
PHONE_RE = re.compile(r"(?:\+?92|0)3\d{2}[-\s]?\d{7}|\b\d{4}[-\s]?\d{7}\b|\+\d{10,13}")
MONEY_RE = re.compile(r"(?:rs\.?|pkr|inr|usd|\$|روپے)\s?\d|\d[\d,]*\s?(?:rs|rupees|lakh|crore|روپے|لاکھ)", re.I)
CODE_RE = re.compile(r"\b\d{4,8}\b")
SHORTENERS = ("bit.ly", "tinyurl", "t.co", "goo.gl", "cutt.ly", "is.gd", "rb.gy", "shorturl")
BAD_TLD = (".top", ".xyz", ".click", ".online", ".site", ".info", ".icu", ".cfd", ".live", ".link")

ASK_CODE = ["send the code", "send me the code", "share the code", "code bhej", "code mujhe", "code de do", "otp bhej", "otp share", "share your otp",
            "6 digit code", "6-digit code", "verification code you", "کوڈ بھیج", "کوڈ مجھے", "واپس بھیج"]
ASK_SECRET = ["pin", "mpin", "password", "cnic", "card number", "cvv", "biometric", "شناختی کارڈ", "پن کوڈ", "پاس ورڈ"]
ASK_MONEY = ["send", "bhej", "transfer", "jama", "fee", "payment", "pay ", "ada karein", "wapas", "بھیج", "فیس", "ادا"]
URGENCY = ["urgent", "immediately", "today", "within 24", "now", "foran", "abhi", "jaldi", "aaj", "band ho", "block", "suspend", "expire", "cancel",
           "فوری", "ابھی", "بند", "آج"]
REWARD = ["mubarak", "congratulations", "won", "winner", "jeet", "inaam", "prize", "lucky draw", "select", "eligible", "refund", "bisp", "ehsaas",
          "مبارک", "انعام", "منتخب", "جیت"]
WARNING_OK = ["do not share", "don't share", "never ask", "never share", "kisi ko na", "share na kar", "کسی کو نہ"]
AUTHORITY = ["pta", "fbr", "nadra", "bisp", "ehsaas", "police", "court", "customs", "bank", "jazzcash", "easypaisa", "whatsapp support", "support team"]
WRONG_SEND = ["ghalti se", "galti se", "by mistake", "wrong number", "wrong transfer", "غلطی سے"]

NAMES = ["has_url", "url_shortener", "url_bad_tld", "has_phone", "has_money", "has_code_number", "ask_code", "ask_secret", "ask_money",
         "urgency", "reward", "authority", "wrong_send_story", "safety_warning", "url_and_urgency", "secret_and_urgency", "reward_and_fee",
         "log_len", "caps_ratio", "digit_ratio", "urdu_script", "exclaim"]
N_FEATURES = len(NAMES)


def _has(t, words):
    return min(sum(1 for w in words if w in t), 3) / 3.0


def text_features(text: str) -> np.ndarray:
    raw = str(text or "")
    t = raw.lower()
    urls = URL_RE.findall(t)
    f = {n: 0.0 for n in NAMES}
    f["has_url"] = 1.0 if urls else 0.0
    f["url_shortener"] = 1.0 if any(s in u for u in urls for s in SHORTENERS) else 0.0
    f["url_bad_tld"] = 1.0 if any(u.split("/")[0].endswith(BAD_TLD) or any(b + "/" in u for b in BAD_TLD) for u in urls) else 0.0
    f["has_phone"] = 1.0 if PHONE_RE.search(raw) else 0.0
    f["has_money"] = 1.0 if MONEY_RE.search(raw) else 0.0
    f["has_code_number"] = 1.0 if CODE_RE.search(raw) else 0.0
    f["ask_code"] = _has(t, ASK_CODE)
    f["ask_secret"] = _has(t, ASK_SECRET)
    f["ask_money"] = _has(t, ASK_MONEY)
    f["urgency"] = _has(t, URGENCY)
    f["reward"] = _has(t, REWARD)
    f["authority"] = _has(t, AUTHORITY)
    f["wrong_send_story"] = _has(t, WRONG_SEND)
    f["safety_warning"] = _has(t, WARNING_OK)
    f["url_and_urgency"] = f["has_url"] * f["urgency"]
    f["secret_and_urgency"] = f["ask_secret"] * f["urgency"]
    f["reward_and_fee"] = f["reward"] * f["ask_money"]
    f["log_len"] = math.log1p(len(raw)) / 7.0
    f["caps_ratio"] = sum(c.isupper() for c in raw) / max(len(raw), 1)
    f["digit_ratio"] = sum(c.isdigit() for c in raw) / max(len(raw), 1)
    f["urdu_script"] = 1.0 if re.search(r"[؀-ۿ]", raw) else 0.0
    f["exclaim"] = min(raw.count("!"), 5) / 5.0
    return np.array([f[n] for n in NAMES], dtype=np.float32)


def batch_features(texts) -> np.ndarray:
    return np.stack([text_features(t) for t in texts])
