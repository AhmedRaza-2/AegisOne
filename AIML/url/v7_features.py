"""
URL model v7 - serving-side preprocessing, copied VERBATIM from train_v7_colab.py.

best_v7.pt was trained on structuralize_url(url) token text and these 10 numeric features.
Serving must feed it exactly the same inputs; tokenizing the raw URL (or using the older
phishing_model_url feature function) is a train/serve mismatch that measurably hurts accuracy.
Do not edit these functions without retraining.
"""
import urllib.parse

import numpy as np
import torch

SUSPICIOUS_TLDS = {'.tk', '.ml', '.ga', '.cf', '.gq', '.xyz', '.top', '.cc', '.zip', '.click', '.link'}
SHORTENERS      = {'bit.ly', 't.co', 'goo.gl', 'tinyurl.com', 'ow.ly', 'is.gd'}

def canonicalize_url(url_str: str) -> str:
    if not isinstance(url_str, str):
        url_str = str(url_str)
    url_str = url_str.strip()
    if not url_str:
        return ""
    
    has_scheme = url_str.startswith(('http://', 'https://'))
    raw = url_str if has_scheme else 'http://' + url_str
    
    try:
        parsed = urllib.parse.urlparse(raw)
        scheme = parsed.scheme.lower() if parsed.scheme else 'http'
        netloc = parsed.netloc.lower()
        if netloc.endswith(':80') and scheme == 'http':
            netloc = netloc[:-3]
        elif netloc.endswith(':443') and scheme == 'https':
            netloc = netloc[:-4]
            
        path = parsed.path
        if path:
            path = urllib.parse.unquote(path)
            if path == '/':
                path = ''
        else:
            path = ''
            
        query_str = ''
        if parsed.query:
            query_params = urllib.parse.parse_qsl(parsed.query, keep_blank_values=True)
            query_params.sort(key=lambda x: (x[0], x[1]))
            query_str = '?' + urllib.parse.urlencode(query_params)
            
        return f"{scheme}://{netloc}{path}{query_str}"
    except Exception:
        u = url_str.lower().strip()
        for prefix in ['https://', 'http://']:
            if u.startswith(prefix):
                u = u[len(prefix):]
        return u.rstrip('/')

def structuralize_url(url: str) -> str:
    import tldextract
    url_str = str(url).strip()
    if not url_str:
        return "[EMPTY_URL]"

    parsed_url = url_str
    if not parsed_url.startswith(('http://', 'https://')):
        parsed_url = 'http://' + parsed_url

    components = []
    try:
        parsed = urllib.parse.urlparse(parsed_url)
        ext = tldextract.extract(parsed_url)

        subdomain = ext.subdomain
        domain = ext.domain
        tld = ext.suffix
        hostname = parsed.hostname

        if not domain and not tld and hostname:
            domain = hostname

        if subdomain:
            components.append(f"[SUB] {subdomain}")
        if domain:
            components.append(f"[DOM] {domain}")
        if tld:
            components.append(f"[TLD] {tld}")

        path = urllib.parse.unquote(parsed.path)
        query = urllib.parse.unquote(parsed.query)

        if path and path != '/':
            for seg in path.split('/'):
                if seg:
                    components.append(f"[PATH_SEG] {seg}")

        if query:
            for param in query.split('&'):
                key = param.split('=', 1)[0]
                components.append(f"[QUERY_PARAM] {key}")

        if f".{tld}" in SUSPICIOUS_TLDS:
            components.append("[SUS_TLD]")

        if any(s in url_str for s in SHORTENERS):
            components.append("[SHORTENED]")

    except Exception:
        return "[MALFORMED_URL]"

    return " ".join(components) if components else "[UNPARSEABLE_URL]"

def extract_url_numerical_features(url: str) -> torch.Tensor:
    import re
    canon_url = canonicalize_url(url)
    url_clean = canon_url.replace("https://", "").replace("http://", "")

    try:
        parsed = urllib.parse.urlparse(canon_url)
        domain = parsed.netloc
    except Exception:
        return torch.zeros(10, dtype=torch.float32)

    features = [
        np.log1p(len(url_clean)) / 5.0,
        np.log1p(len(domain))  / 4.0,
        min(url_clean.count('.'), 10) / 10.0,
        min(url_clean.count('-'), 10) / 10.0,
        min(sum(c in "!@#$%^&*_=+" for c in url_clean), 20) / 20.0,
        1.0 if any(s in domain for s in SHORTENERS) else 0.0,
        1.0 if any(url_clean.endswith(t) for t in SUSPICIOUS_TLDS) else 0.0,
        1.0 if re.match(r'\d+\.\d+\.\d+\.\d+', domain) else 0.0,
        np.log1p(len(parsed.path))  / 4.0,
        np.log1p(len(parsed.query)) / 5.0,
    ]
    return torch.tensor(features, dtype=torch.float32)
