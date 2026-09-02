"""
AegisOne URL Intelligence Engine — Expanded Lexical Feature Extractor
====================================================================
Extracts 64 structured numeric features from a URL for model input.
"""

import math
import re
from urllib.parse import urlparse
import numpy as np
import torch

SUSPICIOUS_TLDS = {
    # Free / widely-abused TLDs
    '.tk', '.ml', '.ga', '.cf', '.gq',
    # Generic abused TLDs
    '.xyz', '.top', '.cc', '.zip', '.click', '.link',
    # Country-code abused
    '.ru', '.cn', '.info',
    # Newly abused generic TLDs commonly used in phishing campaigns
    '.online', '.site', '.live', '.today', '.world', '.fun',
    '.shop', '.store', '.web', '.tech',
}
SHORTENERS      = {'bit.ly', 't.co', 'goo.gl', 'tinyurl.com', 'ow.ly', 'is.gd'}

PHISHING_KEYWORDS = [
    # Classic credential/auth lures
    "login", "signin", "verify", "verification", "account", "secure", "security", "update", "upgrade",
    "banking", "billing", "paypal", "credential", "auth", "confirm", "portal", "access",
    "ebayisapi", "webscr", "submit", "recover", "wp-admin", "wp-content", "plugins",
    "admin", "support", "service", "office", "microsoft", "google", "apple", "netflix",
    # Action-lure keywords (urgency / access)
    "unlock", "reset", "restore", "reactivate", "validate", "suspend", "suspended",
    "restricted", "blocked", "resolution", "resolve", "identity", "password", "apply", "interview",
    # Crypto & Web3 credential theft
    "wallet", "seed", "mnemonic", "phrase", "backup", "recovery", "privatekey",
    "secretkey", "exchange", "defi", "nft", "airdrop",
    # Reward-scam & social engineering
    "claim", "redeem", "reward", "prize", "gift", "free", "winner", "giveaway",
    "nitro", "skins", "vbucks", "robux", "gems", "coins",
    # Delivery / logistics phishing
    "tracking", "delivery", "shipment", "package", "parcel",
    # Verification / identity
    "badge", "invite", "enrollment", "enroll", "member", "cardmember",
]

def shannon_entropy(s: str) -> float:
    """Computes the Shannon Entropy of a string to detect randomness/DGA."""
    if not s:
        return 0.0
    probabilities = [float(s.count(c)) / len(s) for c in set(s)]
    entropy = -sum(p * math.log2(p) for p in probabilities)
    return entropy / 8.0  # normalize by max potential byte-entropy (8 bits)

def extract_expanded_features(url: str) -> torch.Tensor:
    """
    Extracts exactly 64 lexical, structural, statistical, and linguistic features
    from the URL, returning a normalized float32 tensor of shape (64,).
    """
    url_str = str(url).strip()
    url_lower = url_str.lower()
    
    # 1. Parsing
    try:
        if not url_lower.startswith(('http://', 'https://')):
            parsed = urlparse("http://" + url_str)
        else:
            parsed = urlparse(url_str)
        domain = parsed.netloc.split(':')[0] # strip port
        path = parsed.path
        query = parsed.query
    except Exception:
        domain = ""
        path = ""
        query = ""
        parsed = None

    features = []

    # --- Group A: Lengths & Ratios (10 features) ---
    features.append(min(len(url_str), 500) / 500.0)                         # [0] Total URL length
    features.append(min(len(domain), 100) / 100.0)                         # [1] Domain length
    features.append(min(len(path), 200) / 200.0)                           # [2] Path length
    features.append(min(len(query), 300) / 300.0)                          # [3] Query length
    features.append(min(len(parsed.fragment) if parsed else 0, 100) / 100.0)# [4] Fragment length
    features.append(len(domain.split('.')) / 10.0)                         # [5] Subdomain count
    features.append(math.log1p(len(url_str)) / 6.0)                        # [6] Log URL length
    features.append(math.log1p(len(domain)) / 5.0)                         # [7] Log Domain length
    features.append(math.log1p(len(path)) / 5.0)                           # [8] Log Path length
    features.append(math.log1p(len(query)) / 6.0)                          # [9] Log Query length

    # --- Group B: Character Counting & Ratios (15 features) ---
    features.append(min(url_lower.count('.'), 15) / 15.0)                  # [10] Dot count
    features.append(min(url_lower.count('-'), 15) / 15.0)                  # [11] Hyphen count
    features.append(min(url_lower.count('_'), 10) / 10.0)                  # [12] Underline count
    features.append(min(url_lower.count('/'), 15) / 15.0)                  # [13] Slash count
    features.append(min(url_lower.count('?'), 5) / 5.0)                    # [14] Question mark count
    features.append(min(url_lower.count('='), 15) / 15.0)                  # [15] Equal sign count
    features.append(min(url_lower.count('&'), 15) / 15.0)                  # [16] Ampersand count
    features.append(1.0 if '@' in url_lower else 0.0)                      # [17] Presence of '@' (auth spoofing)
    features.append(min(url_lower.count('%'), 20) / 20.0)                  # [18] Percentage sign (URL encoding)
    features.append(min(sum(c.isdigit() for c in domain), 20) / 20.0)      # [19] Digits in domain
    features.append(min(sum(c.isdigit() for c in url_str), 50) / 50.0)     # [20] Digits in URL
    features.append((sum(c.isdigit() for c in domain) / (len(domain) + 1))) # [21] Digit ratio in domain
    features.append((sum(c.isdigit() for c in url_str) / (len(url_str) + 1)))# [22] Digit ratio in URL
    features.append(min(sum(c.isupper() for c in url_str), 20) / 20.0)     # [23] Uppercase count
    features.append(1.0 if '//' in path else 0.0)                          # [24] Double slash in path

    # --- Group C: Linguistic, Entropy, and Heuristics (10 features) ---
    features.append(shannon_entropy(domain))                               # [25] Domain entropy
    features.append(shannon_entropy(path))                                 # [26] Path entropy
    features.append(shannon_entropy(url_str))                              # [27] Full URL entropy
    features.append(1.0 if any(domain.endswith(t) for t in SUSPICIOUS_TLDS) else 0.0)  # [28] Suspicious TLD
    features.append(1.0 if any(s in domain for s in SHORTENERS) else 0.0)  # [29] Shortener domain
    features.append(1.0 if re.match(r'\d+\.\d+\.\d+\.\d+', domain) else 0.0)# [30] Raw IP domain
    has_port = 0.0
    if parsed:
        try:
            if parsed.port is not None:
                has_port = 1.0
        except ValueError:
            has_port = 1.0
    features.append(has_port)                                              # [31] Custom port usage
    features.append(1.0 if parsed and parsed.scheme == 'https' else 0.0)   # [32] HTTPS usage
    vowels = set("aeiou")
    features.append(sum(c in vowels for c in domain) / (len(domain) + 1))  # [33] Vowel ratio in domain
    # Max consecutive repeating character
    max_repeat = 0
    if url_lower:
        curr_repeat = 1
        for idx in range(1, len(url_lower)):
            if url_lower[idx] == url_lower[idx-1]:
                curr_repeat += 1
            else:
                max_repeat = max(max_repeat, curr_repeat)
                curr_repeat = 1
        max_repeat = max(max_repeat, curr_repeat)
    features.append(min(max_repeat, 10) / 10.0)                            # [34] Max repeat count

    # --- Group D: Lexical Phishing Keywords (29 features, mapping to 64) ---
    # We map the presence of the 29 PHISHING_KEYWORDS as binary features [35] to [63]
    for kw in PHISHING_KEYWORDS:
        features.append(1.0 if kw in url_lower else 0.0)

    # Ensure we have EXACTLY 64 features
    while len(features) < 64:
        features.append(0.0)
    features = features[:64]

    return torch.tensor(features, dtype=torch.float32)
