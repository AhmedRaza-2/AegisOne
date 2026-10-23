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
    "microsoft": ["office365", "msoffice", "outlook", "live", "onedrive"],
    "apple": ["icloud", "appleid", "itunes"],
    "amazon": ["aws"],
    "openai": ["chatgpt"],
    "zoom": [],
    # Financial — Major Banks
    "paypal": ["paypa1", "paypaI", "paypa1l"],
    "wellsfargo": ["wells-fargo", "welsfargo"],
    "bankofamerica": ["bank-of-america"],
    "chase": [],
    "citibank": ["citi"],
    "capitalone": ["capital-one"],
    "hsbc": [],
    "barclays": [],
    "americanexpress": ["american-express", "amex"],
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
    "facebook": ["fb"],
    "instagram": ["insta"],
    "linkedin": [],
    "twitter": ["x.com"],
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
    "disneyplus": ["disney-plus", "disney"],
    "hbomax": ["hbo-max", "hbo"],
    # Storage & SaaS
    "dropbox": [],
    "trello": [],
    "asana": [],
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

def check_brand_impersonation(url: str) -> dict:
    """
    Scans a domain for homoglyphs or typo similarity against protected brands.
    Returns details on matched brand, similarity score, and confidence.
    """
    try:
        url_lower = str(url).lower().strip()
        if not url_lower.startswith(('http://', 'https://')):
            parsed = urlparse("http://" + url_lower)
        else:
            parsed = urlparse(url_lower)
            
        domain = parsed.netloc
        if domain.startswith("www."):
            domain = domain[4:]

        # The brand's own site (or another widely used legitimate service) is not an impersonation.
        _host_only = domain.split("@")[-1].split(":")[0]
        if _is_official_host(_host_only):
            return {"matched": False, "matched_brand": None, "score": 0.0, "confidence": 0.0,
                    "reason": "Official domain of a known service"}

        # Strip TLD and ports
        domain_parts = domain.split(':')[0].split('.')
        if len(domain_parts) > 1:
            sld = domain_parts[-2] # e.g. 'paypal' in 'paypal.com' or 'g00gle' in 'g00gle.co.uk'
            full_sld = ".".join(domain_parts[:-1])
        else:
            sld = domain_parts[0]
            full_sld = sld

        # Normalize homoglyphs
        cleaned_sld = clean_homoglyphs(sld)
        cleaned_full_sld = clean_homoglyphs(full_sld)

        # Normalize hyphenated brand tokens: "wells-fargo" → "wellsfargo" for matching
        dehyphenated_sld = cleaned_sld.replace("-", "")
        dehyphenated_full_sld = cleaned_full_sld.replace("-", "")

        best_brand = None
        highest_similarity = 0.0
        reason = "No impersonation detected"

        # Check against protected brands
        for brand, aliases in PROTECTED_BRANDS.items():
            targets = [brand] + aliases
            
            # If the exact SLD matches the brand, it is likely the official brand domain
            # or a direct registration. It is NOT a typo or subdomain impersonation.
            if sld in targets:
                continue
                
            for target in targets:
                # Dehyphenate target for matching against dehyphenated domain
                dehyphenated_target = target.replace("-", "")

                # 1. Exact match in subdomains or SLD (e.g. paypal.verification-update.com)
                # Also check dehyphenated forms: "wells-fargo" matches "wellsfargo" brand token
                sld_match = (target in cleaned_full_sld or
                             (len(dehyphenated_target) >= 4 and dehyphenated_target in dehyphenated_full_sld))
                if sld_match and domain != target and not domain.endswith("." + target):
                    # Brand keyword found in domain, but domain is not the brand!
                    # Verify it's not a false positive for sites like 'pc.ign.com' (checking 'ig')
                    if len(target) >= 4 or len(dehyphenated_target) >= 4:
                        highest_similarity = 1.0
                        best_brand = brand
                        reason = f"Protected brand '{brand}' keyword detected in untrusted domain structure."
                        break

                # 2. Similarity match (Typo-squatting / Homoglyphs)
                sim_sld = jaro_winkler_similarity(cleaned_sld, target)
                sim_full = jaro_winkler_similarity(cleaned_full_sld, target)
                # Also compare dehyphenated forms
                sim_dehyph = jaro_winkler_similarity(dehyphenated_sld, dehyphenated_target)
                max_sim = max(sim_sld, sim_full, sim_dehyph)

                # Flag high Jaro-Winkler similarity (typically > 0.82)
                if max_sim > 0.85 and max_sim > highest_similarity:
                    # Exclude exact legitimate domain match if it matched via subdomain checks
                    highest_similarity = max_sim
                    best_brand = brand
                    reason = f"Domain SLD has high typographic similarity ({round(max_sim*100)}%) to protected brand '{brand}'."

            if highest_similarity == 1.0:
                break

        # Additional homoglyph check: if sld changes after cleaning confusable characters
        is_homoglyph_attack = (sld != clean_homoglyphs(sld))
        if is_homoglyph_attack and highest_similarity > 0.70:
            highest_similarity = max(highest_similarity, 0.90)
            reason = f"Unicode confusable/homoglyph characters detected targeting brand '{best_brand}'."

        if highest_similarity > 0.80:
            return {
                "matched": True,
                "matched_brand": best_brand,
                "score": round(highest_similarity, 4),
                "confidence": round(highest_similarity * 0.95, 4),
                "reason": reason
            }
            
        return {
            "matched": False,
            "matched_brand": None,
            "score": 0.0,
            "confidence": 1.0,
            "reason": "No brand impersonation detected."
        }
    except Exception as e:
        return {
            "matched": False,
            "matched_brand": None,
            "score": 0.0,
            "confidence": 1.0,
            "reason": f"Brand check error: {e}"
        }
