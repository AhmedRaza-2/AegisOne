"""
URL model v10 - shared by training (AIML/url/kaggle/v10, merged into one Kaggle script) and serving
(api/services/model_orchestrator.py). Keep this file dependency-light: torch, transformers, tldextract.

Design (docs/MODEL_RESEARCH_AND_PLAN.md, U3b):
  * Registered domain given explicitly. Subdomain injection does not transfer between attack families
    (Frontiers Comp. Sci. 2026), so the model is told which part of the host is actually owned:
    "<flags> [domain] reg [sub] subdomains [path] path?query".
  * Punycode decoded and confusable characters mapped to a Latin skeleton before tokenising: WordPiece models are
    uniquely weak to homoglyph hosts (same study). Flags `idn` / `confusable` keep that evidence visible.
  * Sub-word encoder (gte-small) + character-CNN branch over the raw URL, fused before the classifier
    (char + sub-word fusion: TCURL 2025, URL2Graph++ 2025).
"""
import ipaddress
import re
import unicodedata
from urllib.parse import urlsplit

import torch
import torch.nn as nn

MAX_LEN = 128
CHAR_LEN = 200

# The common Cyrillic / Greek / fullwidth look-alikes of Latin letters (Unicode confusables, Latin targets only)
_CONFUSABLE = str.maketrans({
    "а": "a", "е": "e", "о": "o", "р": "p", "с": "c", "у": "y", "х": "x", "і": "i", "ј": "j", "ѕ": "s", "һ": "h",
    "ԁ": "d", "ԛ": "q", "ԝ": "w", "ӏ": "l", "ɡ": "g", "α": "a", "ο": "o", "ν": "v", "τ": "t", "ι": "i", "κ": "k",
    "ρ": "p", "υ": "u", "ε": "e", "ɑ": "a", "ı": "i", "ł": "l", "ø": "o", "đ": "d", "ħ": "h",
})
_HAS_DIGIT_SUB = re.compile(r"[a-z][0-9][a-z]|[0-9][a-z]{2,}")

_extract = None


def _tld():
    global _extract
    if _extract is None:
        import tldextract
        # bundled Public Suffix List snapshot (no network at serving time); private suffixes (github.io, ...) count
        _extract = tldextract.TLDExtract(suffix_list_urls=(), include_psl_private_domains=True)
    return _extract


def skeleton(s: str) -> str:
    s = unicodedata.normalize("NFKC", s).lower().translate(_CONFUSABLE)
    return "".join(c for c in unicodedata.normalize("NFKD", s) if not unicodedata.combining(c))


def decode_host(host: str) -> str:
    out = []
    for label in host.split("."):
        if label.startswith("xn--"):
            try:
                label = label.encode("ascii").decode("idna")
            except Exception:
                pass
        out.append(label)
    return ".".join(out)


def structure(url: str) -> dict:
    u = url.strip()
    if "://" not in u[:12]:
        u = "http://" + u
    try:
        p = urlsplit(u)
        host = (p.hostname or "").lower().rstrip(".")
        port = p.port
    except ValueError:
        p, host, port = urlsplit("http://invalid"), "invalid", None
    flags = []
    if p.scheme == "http":
        flags.append("http")
    if port and port not in (80, 443):
        flags.append("port")
    if "@" in (p.netloc or ""):
        flags.append("userinfo")
    is_ip = False
    try:
        ipaddress.ip_address(host.strip("[]"))
        is_ip = True
        flags.append("ip")
    except ValueError:
        pass
    uni = decode_host(host)
    if uni != host or any(ord(c) > 127 for c in host):
        flags.append("idn")
    nf = unicodedata.normalize("NFKC", uni).lower()
    if nf.translate(_CONFUSABLE) != nf:          # look-alike letters from another script; plain accents are only `idn`
        flags.append("confusable")
    skel = skeleton(uni)
    if is_ip:
        reg, sub = host, ""
    else:
        ex = _tld()(skel)
        reg = ".".join(x for x in (ex.domain, ex.suffix) if x) or skel
        sub = ex.subdomain
    path = (p.path or "/") + (("?" + p.query) if p.query else "")
    return {"flags": flags, "reg": reg, "sub": sub, "path": path[:300]}


def model_text(url: str) -> str:
    s = structure(url)
    return f"{' '.join(s['flags']) or 'plain'} [domain] {s['reg']} [sub] {s['sub'] or '-'} [path] {s['path']}"


def char_ids(urls, length=CHAR_LEN):
    t = torch.zeros((len(urls), length), dtype=torch.long)
    for i, u in enumerate(urls):
        b = u.encode("utf-8", "ignore")[:length]
        if b:
            t[i, :len(b)] = torch.tensor(list(b), dtype=torch.long) + 1   # 0 = padding
    return t


class CharCNN(nn.Module):
    def __init__(self, dim=32, filters=64, kernels=(3, 5, 7)):
        super().__init__()
        self.emb = nn.Embedding(257, dim, padding_idx=0)
        self.convs = nn.ModuleList([nn.Conv1d(dim, filters, k, padding=k // 2) for k in kernels])
        self.out_dim = filters * len(kernels)

    def forward(self, ids):
        x = self.emb(ids).transpose(1, 2)
        mask = (ids > 0).unsqueeze(1)
        return torch.cat([torch.relu(c(x)).masked_fill(~mask, -1e4).max(dim=2).values for c in self.convs], dim=1)


class UrlNetV10(nn.Module):
    """gte-small sub-word encoder (mean-pooled) + character CNN -> 2 logits."""

    def __init__(self, encoder):
        super().__init__()
        self.encoder = encoder
        self.char = CharCNN()
        h = encoder.config.hidden_size
        self.head = nn.Sequential(nn.Dropout(0.1), nn.Linear(h + self.char.out_dim, 256), nn.GELU(),
                                  nn.Dropout(0.1), nn.Linear(256, 2))

    def forward(self, input_ids, attention_mask, char_ids, token_type_ids=None):
        hs = self.encoder(input_ids=input_ids, attention_mask=attention_mask).last_hidden_state
        m = attention_mask.unsqueeze(-1).to(hs.dtype)
        pooled = (hs * m).sum(1) / m.sum(1).clamp(min=1.0)
        return self.head(torch.cat([pooled, self.char(char_ids).to(pooled.dtype)], dim=1))


def encode(tok, urls, device="cpu"):
    enc = tok([model_text(u) for u in urls], truncation=True, max_length=MAX_LEN, padding=True, return_tensors="pt")
    return {"input_ids": enc["input_ids"].to(device), "attention_mask": enc["attention_mask"].to(device),
            "char_ids": char_ids(urls).to(device)}


def load(model_dir: str, device="cpu"):
    """Serving: returns (model, tokenizer, calibration dict)."""
    import json
    import os
    from transformers import AutoConfig, AutoModel, AutoTokenizer
    cfg = AutoConfig.from_pretrained(model_dir)
    net = UrlNetV10(AutoModel.from_config(cfg))
    from safetensors.torch import load_file
    net.load_state_dict(load_file(os.path.join(model_dir, "urlnet_v10.safetensors")))
    net.eval().to(device)
    cal = json.load(open(os.path.join(model_dir, "calibration.json")))
    return net, AutoTokenizer.from_pretrained(model_dir), cal
