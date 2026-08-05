"""
AegisOne — URL Phishing Detector: Model Architecture
=====================================================
DistilBERT + 10-feature MLP Hybrid | 4-class classification
Classes: 0=Benign, 1=Phishing, 2=Malware, 3=Defacement

Upload this file to Google Drive at: MyDrive/AegisOne/phishing_model_url.py
"""

import re
import numpy as np
import torch
import torch.nn as nn
from transformers import AutoModel
from urllib.parse import urlparse

# ═══════════════════════════════════════════════════════
# CONSTANTS
# ═══════════════════════════════════════════════════════

SUSPICIOUS_TLDS = {'.tk', '.ml', '.ga', '.cf', '.gq', '.xyz', '.top', '.cc', '.zip', '.click', '.link'}
SHORTENERS      = {'bit.ly', 't.co', 'goo.gl', 'tinyurl.com', 'ow.ly', 'is.gd'}

# ═══════════════════════════════════════════════════════
# URL SANITIZER
# ═══════════════════════════════════════════════════════

def sanitize_url(url: str) -> str:
    """
    Strips tracking parameters from known benign domains to prevent
    long query strings from skewing model predictions.
    """
    try:
        url_str = str(url).strip()
        if not url_str.startswith(('http://', 'https://')):
            parsed = urlparse("http://" + url_str)
        else:
            parsed = urlparse(url_str)

        domain = parsed.netloc.lower()
        # For known safe domains, strip query/fragment to prevent OOD false positives
        safe_domains = ['google.', 'linkedin.com', 'pinterest.com', 'facebook.com',
                        'twitter.com', 'x.com']
        if any(d in domain for d in safe_domains):
            return parsed.scheme + "://" + parsed.netloc + parsed.path

        return url_str
    except Exception:
        return str(url)


# ═══════════════════════════════════════════════════════
# NUMERICAL FEATURE EXTRACTOR (10 features, log-normalized)
# ═══════════════════════════════════════════════════════

def extract_url_numerical_features(url: str) -> torch.Tensor:
    url = sanitize_url(url)
    url_str = str(url).lower().replace("https://", "").replace("http://", "").replace("www.", "")

    try:
        parsed = urlparse("http://" + url_str)
        domain = parsed.netloc
    except ValueError:
        return torch.zeros(10, dtype=torch.float32)

    features = [
        np.log1p(len(url_str)) / 5.0,                               # [0] URL total length (log-scaled)
        np.log1p(len(domain))  / 4.0,                               # [1] Domain length (log-scaled)
        min(url_str.count('.'), 10) / 10.0,                         # [2] Dot count (capped at 10)
        min(url_str.count('-'), 10) / 10.0,                         # [3] Hyphen count (capped at 10)
        min(sum(c in "!@#$%^&*_=+" for c in url_str), 20) / 20.0,  # [4] Special char count (capped)
        1.0 if any(s in domain for s in SHORTENERS) else 0.0,       # [5] URL shortener flag
        1.0 if any(url_str.endswith(t) for t in SUSPICIOUS_TLDS) else 0.0,  # [6] Suspicious TLD
        1.0 if re.match(r'\d+\.\d+\.\d+\.\d+', domain) else 0.0,   # [7] Raw IP address flag
        np.log1p(len(parsed.path))  / 4.0,                          # [8] Path length (log-scaled)
        np.log1p(len(parsed.query)) / 5.0,                          # [9] Query string length (log-scaled)
    ]

    return torch.tensor(features, dtype=torch.float32)


# ═══════════════════════════════════════════════════════
# NUMERICAL FEATURE MLP
# ═══════════════════════════════════════════════════════

class URLFeatureMLP(nn.Module):
    def __init__(self):
        super().__init__()
        self.net = nn.Sequential(
            nn.Linear(10, 64),
            nn.ReLU(),
            nn.Dropout(0.2),
            nn.Linear(64, 32),
            nn.ReLU(),
        )

    def forward(self, x: torch.Tensor) -> torch.Tensor:
        return self.net(x)


# ═══════════════════════════════════════════════════════
# HYBRID URL DETECTOR: DistilBERT [CLS] + Feature MLP
# ═══════════════════════════════════════════════════════

class URLDetector(nn.Module):
    """
    Hybrid model fusing:
      - DistilBERT CLS token (768-dim) for semantic understanding
      - 10-feature MLP (32-dim) for structural/lexical signals
    → concatenated → 4-class softmax classifier
    """

    def __init__(self, model_name: str = "distilbert-base-uncased", num_classes: int = 4):
        super().__init__()

        self.bert = AutoModel.from_pretrained(model_name, attn_implementation="eager")

        # Freeze all layers except the last transformer layer for efficient fine-tuning
        for param in self.bert.parameters():
            param.requires_grad = False
        for param in self.bert.transformer.layer[-1:].parameters():
            param.requires_grad = True

        self.feature_mlp = URLFeatureMLP()

        bert_hidden = self.bert.config.hidden_size  # 768 for distilbert-base

        self.classifier = nn.Sequential(
            nn.Linear(bert_hidden + 32, 128),   # matches checkpoint: classifier.0
            nn.GELU(),
            nn.Dropout(0.3),
            nn.Linear(128, num_classes),          # matches checkpoint: classifier.3
        )

    def forward(
        self,
        input_ids: torch.Tensor,
        attention_mask: torch.Tensor,
        numerical_feats: torch.Tensor,
    ) -> torch.Tensor:

        outputs = self.bert(
            input_ids=input_ids,
            attention_mask=attention_mask,
            output_attentions=True,
        )
        self.last_attentions = outputs.attentions

        # CLS token embedding
        text_feat = outputs.last_hidden_state[:, 0, :]   # (batch, 768)
        num_feat  = self.feature_mlp(numerical_feats)    # (batch, 32)

        combined = torch.cat([text_feat, num_feat], dim=1)  # (batch, 800)
        return self.classifier(combined)                     # (batch, 4)