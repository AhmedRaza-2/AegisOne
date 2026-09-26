import re
import numpy as np
import torch
import torch.nn as nn
from transformers import AutoModel
import tldextract
from urllib.parse import urlparse, unquote
import ipaddress

# ═══════════════════════════════════════════════════════
# CONSTANTS
# ═══════════════════════════════════════════════════════

SUSPICIOUS_TLDS = {'.tk', '.ml', '.ga', '.cf', '.gq', '.xyz', '.top', '.cc', '.zip', '.click', '.link'}
SHORTENERS      = {'bit.ly', 't.co', 'goo.gl', 'tinyurl.com', 'ow.ly', 'is.gd'}

# ═══════════════════════════════════════════════════════
# URL STRUCTURAL PARSER (V5)
# ═══════════════════════════════════════════════════════

def structuralize_url(url: str) -> str:
    """
    Parses a URL and injects structural delimiters so the model can learn hierarchy.
    Handles malformed URLs gracefully by returning a placeholder string.
    """
    url_str = str(url).strip()

    if not url_str:
        return "[EMPTY_URL]"

    parsed_url = url_str
    if not re.match(r'^[a-zA-Z]+://', parsed_url):
        parsed_url = 'http://' + parsed_url

    components = []
    try:
        parsed = urlparse(parsed_url)
        ext = tldextract.extract(parsed_url)

        subdomain = ext.subdomain
        domain = ext.domain
        tld = ext.suffix

        # parsed.hostname can raise ValueError on malformed netlocs; caught below
        hostname = parsed.hostname

        if not domain and not tld and hostname:
            domain = hostname

        if subdomain:
            components.append(f"[SUB] {subdomain}")
        if domain:
            components.append(f"[DOM] {domain}")
        if tld:
            components.append(f"[TLD] {tld}")

        path = unquote(parsed.path)
        query = unquote(parsed.query)
        fragment = unquote(parsed.fragment)

        if path and path != '/':
            for seg in path.split('/'):
                if seg:
                    components.append(f"[PATH_SEG] {seg}")

        if query:
            for param in query.split('&'):
                key = param.split('=', 1)[0]
                components.append(f"[QUERY_PARAM] {key}")

        if fragment:
            components.append(f"[FRAGMENT] {fragment}")

        if f".{tld}" in SUSPICIOUS_TLDS:
            components.append("[SUS_TLD]")

        if any(s in url_str for s in SHORTENERS):
            components.append("[SHORTENED]")

        # IP check: use the real hostname, not the tldextract "domain",
        # since tldextract splits "192.168.1.1" incorrectly
        if hostname:
            try:
                ipaddress.ip_address(hostname)
                components.append("[IP_ADDRESS]")
            except ValueError:
                pass  # not an IP, which is the normal case

    except Exception:
        return "[MALFORMED_URL_PARSE_ERROR]"

    if not components:
        return "[UNPARSEABLE_URL]"

    return " ".join(components)

# ═══════════════════════════════════════════════════════
# URL SANITIZER (Used for numerical feature stability)
# ═══════════════════════════════════════════════════════

# ═══════════════════════════════════════════════════════
# UNIFIED CANONICALIZATION FUNCTION
# Shared identically by Dataset Construction, Training, Eval, and Production Inference.
# ═══════════════════════════════════════════════════════

def canonicalize_url(url_str: str) -> str:
    """
    Unified canonicalization function.
    - Lowercases scheme and hostname.
    - Strips default ports (:80, :443).
    - Unquotes unreserved percent-encoded characters.
    - Sorts query parameters.
    - Normalizes trailing slashes on bare hostnames.
    """
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

# ═══════════════════════════════════════════════════════
# NUMERICAL FEATURE EXTRACTOR (10 features, log-normalized)
# Zero brand/domain-specific hacks. Uses unified canonicalization.
# ═══════════════════════════════════════════════════════

def extract_url_numerical_features(url: str) -> torch.Tensor:
    canon_url = canonicalize_url(url)
    url_clean = canon_url.replace("https://", "").replace("http://", "")

    try:
        parsed = urlparse(canon_url)
        domain = parsed.netloc
    except Exception:
        return torch.zeros(10, dtype=torch.float32)

    features = [
        np.log1p(len(url_clean)) / 5.0,                              # [0] URL length (log-scaled)
        np.log1p(len(domain))  / 4.0,                               # [1] Domain length (log-scaled)
        min(url_clean.count('.'), 10) / 10.0,                        # [2] Dot count
        min(url_clean.count('-'), 10) / 10.0,                        # [3] Hyphen count
        min(sum(c in "!@#$%^&*_=+" for c in url_clean), 20) / 20.0, # [4] Special char count
        1.0 if any(s in domain for s in SHORTENERS) else 0.0,       # [5] Shortener flag
        1.0 if any(url_clean.endswith(t) for t in SUSPICIOUS_TLDS) else 0.0, # [6] Suspicious TLD
        1.0 if re.match(r'\d+\.\d+\.\d+\.\d+', domain) else 0.0,   # [7] Raw IP flag
        np.log1p(len(parsed.path))  / 4.0,                          # [8] Path length
        np.log1p(len(parsed.query)) / 5.0,                          # [9] Query length
    ]

    return torch.tensor(features, dtype=torch.float32)


def batch_extract_url_features(urls: list) -> torch.Tensor:
    """Extract numerical feature tensors for a batch of URLs."""
    return torch.stack([extract_url_numerical_features(u) for u in urls])


# ═══════════════════════════════════════════════════════
# HYBRID URL DETECTOR MODEL
# ═══════════════════════════════════════════════════════

class URLDetector(nn.Module):
    def __init__(self, model_name: str = 'distilbert-base-uncased', num_labels: int = 4):
        super().__init__()
        self.bert = AutoModel.from_pretrained(model_name)
        
        # Freeze all layers except the last transformer layer for efficient fine-tuning
        for param in self.bert.parameters():
            param.requires_grad = False
            
        if hasattr(self.bert, "transformer"):
            for param in self.bert.transformer.layer[-1:].parameters():
                param.requires_grad = True
        elif hasattr(self.bert, "encoder"):
            for param in self.bert.encoder.layer[-1:].parameters():
                param.requires_grad = True
                
        self.feature_mlp = nn.Sequential(
            nn.Linear(10, 64),
            nn.ReLU(),
            nn.Linear(64, 32)
        )
        self.classifier = nn.Sequential(
            nn.Linear(self.bert.config.hidden_size + 32, 256),
            nn.ReLU(),
            nn.Dropout(0.3),
            nn.Linear(256, num_labels)
        )
        self.last_attentions = None

    def forward(self, input_ids, attention_mask, numerical_feats):
        outputs = self.bert(
            input_ids=input_ids,
            attention_mask=attention_mask,
            output_attentions=True,
        )
        self.last_attentions = outputs.attentions

        text_feat = outputs.last_hidden_state[:, 0, :]
        num_feat = self.feature_mlp(numerical_feats)

        combined = torch.cat([text_feat, num_feat], dim=1)
        return self.classifier(combined)


def load_url_detector(checkpoint_path: str, device: torch.device = torch.device("cpu")):
    import os
    if not os.path.exists(checkpoint_path):
        raise FileNotFoundError(f"Model checkpoint not found: {checkpoint_path}")

    state = torch.load(checkpoint_path, map_location="cpu", weights_only=False)
    if isinstance(state, dict) and "model_state_dict" in state:
        state = state["model_state_dict"]

    word_embeddings_key = None
    for key in ["bert.embeddings.word_embeddings.weight", "embeddings.word_embeddings.weight"]:
        if key in state:
            word_embeddings_key = key
            break

    model_name = "distilbert-base-uncased"
    if word_embeddings_key:
        hidden_size = state[word_embeddings_key].shape[1]
        if hidden_size == 256:
            model_name = "prajjwal1/bert-mini"
        elif hidden_size == 768:
            model_name = "distilbert-base-uncased"

    clean_state = {}
    for k, v in state.items():
        clean_state[k[7:] if k.startswith("module.") else k] = v

    # Dynamically infer num_labels from checkpoint classifier weight shape
    num_labels = 4
    if "classifier.3.weight" in clean_state:
        num_labels = clean_state["classifier.3.weight"].shape[0]

    model = URLDetector(model_name=model_name, num_labels=num_labels)
    model.load_state_dict(clean_state, strict=True)
    model.to(device)
    model.eval()
    return model, model_name