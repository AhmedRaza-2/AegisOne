"""
AegisOne URL Intelligence Engine — Protected-Brand & Homoglyph Engine
======================================================================
Detects look-alike / typo-squatted brand impersonation attempts.
"""

import re
from urllib.parse import urlparse

PROTECTED_BRANDS = {
    # Search & Productivity
    "google": ["gmail", "googlemail", "goggle"],
    "github": [],
    "microsoft": ["office365", "msoffice", "outlook", "onedrive", "microsoftonline"],
    "apple": ["icloud", "appleid", "itunes"],
    "amazon": [],
    "openai": ["chatgpt"],
    "zoom": [],
    # Financial — Major Banks
    "paypal": ["paypa1", "paypaI", "paypa1l"],
    "wellsfargo": ["wells-fargo", "welsfargo"],
    "bankofamerica": ["bank-of-america"],
    "chase": [],
    "citibank": [],
    "capitalone": ["capital-one"],
    "hsbc": [],
    "barclays": [],
    "americanexpress": ["american-express"],
    "stripe": [],
    # Crypto & Web3
    "metamask": [],
    "trustwallet": ["trust-wallet"],
    "blockchain": [],
    "kraken": [],
    "kucoin": [],
    "binance": [],
    "coinbase": [],
    "opensea": [],
    # Social & Communication
    "facebook": [],
    "instagram": [],
    "linkedin": [],
    "twitter": [],
    "discord": [],
    "slack": [],
    "telegram": [],
    "whatsapp": [],
    "tiktok": ["tik-tok"],
    "snapchat": [],
    "twitch": [],
    "spotify": [],
    # Media & Streaming
    "netflix": [],
    "youtube": [],
    "hulu": [],
    "disneyplus": ["disney-plus"],
    "hbomax": ["hbo-max"],
    # Storage & SaaS (file-share and e-signature lures)
    "dropbox": [],
    "trello": [],
    "asana": [],
    "wetransfer": ["we-transfer"],
    "docusign": ["docu-sign"],
    "adobe": [],
    "sharepoint": [],
    # Pakistan: banks, wallets, government, shopping (names of 4+ letters only - shorter ones such as
    # "hbl"/"ubl" would match inside ordinary words like "public")
    "jazzcash": ["jazz-cash"],
    "easypaisa": ["easy-paisa"],
    "meezanbank": ["meezan"],
    "bankalfalah": ["alfalah"],
    "habibbank": ["habib-bank"],
    "ubldigital": [],
    "nadra": [],
    "daraz": [],
    # Logistics & Delivery
    "dhl": [],
    "fedex": [],
    "ups": [],
    "usps": [],
    # Gaming & Entertainment
    "steam": [],
    "epicgames": ["epic-games"],
    "roblox": [],
    # ISP / Telecom
    "comcast": [],
    "xfinity": [],
    "yahoo": [],
    # short names: matched only as a WHOLE word of the host (hbl-verify.top), never inside another word
    "hbl": [], "ubl": [], "mcb": [], "nbp": [], "fbr": [],
}

# Registrable domains that genuinely BELONG to a protected brand (or to a very widely used,
# legitimate service). The matcher below is substring/similarity based, so without this list the
# real "login.microsoftonline.com", "office.com" or "accounts.google.com" were reported as
# impersonating Microsoft/Google. Subdomains of these are official too, EXCEPT user-content hosts
# where anyone can publish a page (see USER_CONTENT_HOSTS).
OFFICIAL_DOMAINS = {
    "google.com", "gmail.com", "googlemail.com", "gstatic.com", "googleapis.com", "googleusercontent.com", "youtube.com", "youtu.be", "goo.gl",
    "microsoft.com", "microsoftonline.com", "office.com", "office365.com", "live.com", "outlook.com", "onedrive.com",
    "sharepoint.com", "windows.com", "bing.com", "msn.com", "skype.com", "azure.com", "azureedge.net", "microsoft365.com",
    "apple.com", "icloud.com", "amazon.com", "amazon.co.uk", "amazon.de", "amazonaws.com", "aws.amazon.com", "amazon.in", "daraz.pk",
    "paypal.com", "paypal.me", "stripe.com", "github.com", "githubusercontent.com", "openai.com", "chatgpt.com", "zoom.us",
    "facebook.com", "fb.com", "messenger.com", "instagram.com", "whatsapp.com", "whatsapp.net", "linkedin.com", "twitter.com", "x.com",
    "discord.com", "discord.gg", "slack.com", "telegram.org", "t.me", "tiktok.com", "snapchat.com", "twitch.tv", "spotify.com",
    "netflix.com", "hulu.com", "disneyplus.com", "hbomax.com", "dropbox.com", "trello.com", "asana.com",
    "dhl.com", "fedex.com", "ups.com", "usps.com", "steampowered.com", "steamcommunity.com", "epicgames.com", "roblox.com",
    "comcast.com", "xfinity.com", "yahoo.com", "wellsfargo.com", "bankofamerica.com", "chase.com", "citi.com", "citibank.com",
    "capitalone.com", "hsbc.com", "barclays.co.uk", "americanexpress.com", "coinbase.com", "binance.com", "kraken.com", "kucoin.com",
    "opensea.io", "metamask.io", "trustwallet.com", "blockchain.com",
    "wetransfer.com", "we.tl", "docusign.com", "docusign.net", "adobe.com", "adobelogin.com", "ubldigital.com",
    "habibbank.com",
    # Pakistan: banks, telecom, government, universities
    "ubl.com.pk", "hbl.com", "mcb.com.pk", "meezanbank.com", "bankalfalah.com", "allied.com.pk", "abl.com", "nbp.com.pk", "jazzcash.com.pk",
    "easypaisa.com.pk", "jazz.com.pk", "ufone.com", "zong.com.pk", "telenor.com.pk", "nadra.gov.pk", "fbr.gov.pk", "au.edu.pk",
    "wikipedia.org", "wikimedia.org", "mozilla.org", "cloudflare.com", "stackoverflow.com", "reddit.com", "medium.com",
}
# Subdomains of official domains where ANY member of the public can host content - these are
# NOT treated as the brand's own site.
USER_CONTENT_HOSTS = (
    "sites.google.com", "docs.google.com", "forms.gle", "storage.googleapis.com", "firebaseapp.com", "web.app",
    "blogspot.com", "github.io", "githubusercontent.com", "pages.dev", "workers.dev", "s3.amazonaws.com",
    "sharepoint.com", "onedrive.live.com", "1drv.ms", "azurewebsites.net", "windows.net",
    "weebly.com", "wixsite.com", "herokuapp.com", "netlify.app", "vercel.app", "glitch.me",
)


def _is_official_host(host: str) -> bool:
    host = (host or "").lower().strip(".")
    if not host:
        return False
    for u in USER_CONTENT_HOSTS:
        if host == u or host.endswith("." + u):
            return False
    try:  # site builders / forms / buckets on a brand's own domain (forms.office.com) are not the brand's pages
        from AIML.url.reputation import COLLAB_HOSTS, HOSTING_HOSTS
        if any(host == u or host.endswith("." + u) for u in HOSTING_HOSTS + COLLAB_HOSTS):
            return False
    except ImportError:
        pass
    return any(host == d or host.endswith("." + d) for d in OFFICIAL_DOMAINS)


# Homoglyph character mappings
HOMOGLYPH_MAP = {
    '0': 'o', '1': 'l', 'vv': 'w', 'rn': 'm', 'cl': 'd',
    'а': 'a', 'е': 'e', 'о': 'o', 'р': 'p', 'с': 'c', 'у': 'y', 'х': 'x', # Cyrillic lookalikes
    'ѕ': 's', 'і': 'i', 'ј': 'j', 'ԝ': 'w',
}

def clean_homoglyphs(text: str) -> str:
    """Replaces common lookalike unicode and lexical homoglyphs with standard ASCII."""
    cleaned = text.lower()
    for confusable, standard in HOMOGLYPH_MAP.items():
        cleaned = cleaned.replace(confusable, standard)
    return cleaned

def levenshtein_distance(s1: str, s2: str) -> int:
    """Computes the Levenshtein distance between two strings."""
    if len(s1) < len(s2):
        return levenshtein_distance(s2, s1)
    if len(s2) == 0:
        return len(s1)

    previous_row = range(len(s2) + 1)
    for i, c1 in enumerate(s1):
        current_row = [i + 1]
        for j, c2 in enumerate(s2):
            insertions = previous_row[j + 1] + 1
            deletions = current_row[j] + 1
            substitutions = previous_row[j] + (c1 != c2)
            current_row.append(min(insertions, deletions, substitutions))
        previous_row = current_row

    return previous_row[-1]

def jaro_winkler_similarity(s1: str, s2: str) -> float:
    """Computes Jaro-Winkler similarity between two strings."""
    s1, s2 = s1.lower(), s2.lower()
    len1, len2 = len(s1), len(s2)
    if len1 == 0 or len2 == 0:
        return 0.0
    if s1 == s2:
        return 1.0

    match_bound = max(0, max(len1, len2) // 2 - 1)
    s1_matches = [False] * len1
    s2_matches = [False] * len2

    matches = 0
    transpositions = 0

    for i in range(len1):
        start = max(0, i - match_bound)
        end = min(len2, i + match_bound + 1)
        for j in range(start, end):
            if s2_matches[j]:
                continue
            if s1[i] == s2[j]:
                s1_matches[i] = True
                s2_matches[j] = True
                matches += 1
                break

    if matches == 0:
        return 0.0

    k = 0
    for i in range(len1):
        if not s1_matches[i]:
            continue
        while not s2_matches[k]:
            k += 1
        if s1[i] != s2[k]:
            transpositions += 1
        k += 1

    transpositions //= 2
    jaro = (matches / len1 + matches / len2 + (matches - transpositions) / matches) / 3.0

    # Winkler modification for common prefix (up to 4 chars)
    prefix_len = 0
    for i in range(min(4, min(len1, len2))):
        if s1[i] == s2[i]:
            prefix_len += 1
        else:
            break

    return jaro + prefix_len * 0.1 * (1.0 - jaro)

_LURE_WORDS = ("login", "logon", "signin", "sign", "secure", "security", "verify", "verification", "account", "accounts",
               "update", "support", "help", "billing", "payment", "pay", "wallet", "auth", "online", "service", "services",
               "confirm", "unlock", "recovery", "refund", "reward", "gift", "claim", "bonus", "prize", "id", "web", "app",
               "mail", "office", "portal", "center", "team", "official", "customer", "client", "alert", "notice", "check",
               "safe", "access", "trial", "cancel", "case", "report", "ticket", "tickets", "promo", "free", "download")
_TOKEN_SPLIT = re.compile(r"[.\-_]+")
_BRAND_EXT = {}


def _brand_ext(private=True):
    """Offline Public Suffix List parser; private=True also splits platforms (x.vercel.app is x's own domain)."""
    if private not in _BRAND_EXT:
        import tldextract
        _BRAND_EXT[private] = tldextract.TLDExtract(suffix_list_urls=(), include_psl_private_domains=private)
    return _BRAND_EXT[private]


def damerau_levenshtein(a: str, b: str) -> int:
    """Edit distance counting a swap of two neighbouring letters as one edit (paypal -> payapl)."""
    d = {(i, -1): i + 1 for i in range(-1, len(a) + 1)}
    d.update({(-1, j): j + 1 for j in range(-1, len(b) + 1)})
    for i in range(len(a)):
        for j in range(len(b)):
            cost = a[i] != b[j]
            d[i, j] = min(d[i - 1, j] + 1, d[i, j - 1] + 1, d[i - 1, j - 1] + cost)
            if i and j and a[i] == b[j - 1] and a[i - 1] == b[j]:
                d[i, j] = min(d[i, j], d[i - 2, j - 2] + 1)
    return d[len(a) - 1, len(b) - 1]


def _typo_of(token: str, target: str) -> bool:
    """A deliberate misspelling of the whole brand: one edit for names up to 6 letters, two for longer ones."""
    if token == target or abs(len(token) - len(target)) > 2 or len(target) < 5 or len(token) < 5:
        return False
    if token == target + "s":                     # plural of an ordinary word (them-apples), not a typo
        return False
    return damerau_levenshtein(token, target) <= (1 if len(target) <= 7 else 2)


def _affix_match(token: str, target: str) -> bool:
    """Brand glued to lure words: applegiftreward, paypalsecure, securepaypal-login. The rest of the token has to be
    made of lure words (or digits), so ordinary words that merely start with a brand do not count."""
    if len(target) < 5 or target not in token or token == target:
        return False
    rest = token.replace(target, " ", 1)
    rest = re.sub(r"[0-9]+", " ", rest)
    for w in sorted(_LURE_WORDS, key=len, reverse=True):
        rest = rest.replace(w, " ")
    return rest.strip() == ""


def check_brand_impersonation(url: str) -> dict:
    """
    Does the host claim a protected brand it does not own?
      * parsed with the Public Suffix List (private section included), so `x.vercel.app` and `roblox.com.ss` are
        judged by what the owner actually registered, and `manufacturers.com.tw` is not read as "com" ~ "comcast"
      * the brand must be a whole token of the host (netflix-trial, facebook.webmau.vn), a deliberate misspelling of
        a whole token (paypa1, micros0ft), or glued to lure words only (paypalsecure, applegiftreward) - never a
        substring of an ordinary word (livecareer, olx.com, steamsaunabath, telegraph)
      * popular listed domains (Tranco) never match: impersonation needs a domain the attacker controls
    Returns {matched, matched_brand, score, confidence, reason}; score >= 0.92 is treated as a hard signal.
    """
    none = {"matched": False, "matched_brand": None, "score": 0.0, "confidence": 1.0, "reason": "No brand impersonation detected."}
    try:
        u = str(url).strip()
        p = urlparse(u if "://" in u[:12] else "http://" + u)
        host = (p.hostname or "").lower().rstrip(".")
        if not host:
            return none
        if _is_official_host(host):
            return {"matched": False, "matched_brand": None, "score": 0.0, "confidence": 0.0,
                    "reason": "Official domain of a known service"}
        try:
            from AIML.url.reputation import reputation
            rep = reputation(host)
            if rep.get("listed"):
                return dict(none, reason="Popular listed domain - not attacker-registered")
        except Exception:
            pass
        try:
            from AIML.url.urlnet_v10 import decode_host
            host = decode_host(host)            # xn--pypal-4ve.com -> pаypal.com, then the homoglyph map applies
        except Exception:
            pass
        e = _brand_ext()(host)
        labels = [x for x in (e.subdomain.split(".") if e.subdomain else []) + [e.domain] if x and x != "www"]
        raw_tokens = [t for lab in labels for t in _TOKEN_SPLIT.split(lab) if t]
        tokens = [clean_homoglyphs(t) for t in raw_tokens]
        joined = [clean_homoglyphs(lab.replace("-", "")) for lab in labels]          # "wells-fargo" -> "wellsfargo"
        homoglyph = any(clean_homoglyphs(t) != t for t in raw_tokens if not t.isdigit())
        best = (0.0, None, "")
        _o = _brand_ext(private=False)(host)           # the brand's own platform: google.com for sites.google.com
        owner = _o.domain if f"{_o.domain}.{_o.suffix}" in OFFICIAL_DOMAINS else None
        for brand, aliases in PROTECTED_BRANDS.items():
            if owner and owner in [brand] + aliases:
                continue                         # sites.google.com is Google's own hosting, not an impersonation of it
            for target in [brand] + aliases:
                tgt = target.replace("-", "").replace(".", "")
                if not tgt:
                    continue
                if tgt in tokens or tgt in joined:
                    sc, why = 1.0, f"Protected brand '{brand}' used as a name in a domain it does not own."
                elif any(_typo_of(t, tgt) for t in tokens + joined):
                    sc, why = 0.93, f"Domain is a misspelling of protected brand '{brand}'."
                elif any(_affix_match(t, tgt) for t in tokens + joined):
                    sc, why = 0.9, f"Protected brand '{brand}' combined with lure words in an unrelated domain."
                else:
                    continue
                if homoglyph:
                    sc, why = max(sc, 0.95), f"Look-alike characters spelling protected brand '{brand}'."
                if sc > best[0]:
                    best = (sc, brand, why)
        if best[1]:
            return {"matched": True, "matched_brand": best[1], "score": best[0], "confidence": round(best[0] * 0.95, 4),
                    "reason": best[2]}
        return none
    except Exception as e:
        return dict(none, reason=f"Brand check error: {e}")
