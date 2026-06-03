import torch
import torch.nn as nn
from transformers import AutoModel
import re
from urllib.parse import urlparse

# ═══════════════════════════════════════
# FEATURE ENGINE (KEEP - VERY IMPORTANT)
# ═══════════════════════════════════════

SUSPICIOUS_TLDS = {'.tk', '.ml', '.ga', '.cf', '.gq', '.xyz', '.top'}
SHORTENERS = {'bit.ly', 't.co', 'goo.gl', 'tinyurl.com'}

def sanitize_url(url: str) -> str:
    """
    Cleans tracking parameters and irrelevant long query strings from URLs
    to prevent Data Drift/Out-of-Distribution false positives in production.
    """
    try:
        url_str = str(url).strip()
        if not url_str.startswith(('http://', 'https://')):
            parsed = urlparse("http://" + url_str)
        else:
            parsed = urlparse(url_str)
            
        # If it's a known search engine or social media, strip queries
        domain = parsed.netloc.lower()
        if any(d in domain for d in ['google.', 'linkedin.com', 'pinterest.com', 'facebook.com', 'youtube.com', 'twitter.com', 'x.com']):
            # Strip query completely for these to prevent massive anomaly scores
            # unless it's a specific useful query (like youtube ?v=)
            if 'youtube.com' not in domain:
                return parsed.scheme + "://" + parsed.netloc + parsed.path
                
        return url_str
    except:
        return str(url)

def extract_url_numerical_features(url):
    # Apply sanitization to the numerical feature extractor too
    url = sanitize_url(url)
    url_str = str(url).lower().replace("https://", "").replace("http://", "").replace("www.", "")

    try:
        # Prepend 'http://' for urlparse to correctly interpret relative paths and domains
        # This handles cases where only a domain or path is provided without a scheme
        parsed = urlparse("http://" + url_str)
        domain = parsed.netloc
    except ValueError as e:
        # Handle cases where urlparse raises an error (e.g., Invalid IPv6 URL)
        print(f"Warning: Could not parse URL '{url}'. Error: {e}. Returning zeros.")
        # Return a tensor of zeros for all 10 features
        return torch.zeros(10, dtype=torch.float32)

    features = [
        len(url_str),
        len(domain),
        url_str.count('.'),
        url_str.count('-'),
        sum(c in "!@#$%^&*_=+" for c in url_str),
        1.0 if any(s in domain for s in SHORTENERS) else 0.0,
        1.0 if any(url_str.endswith(tld) for tld in SUSPICIOUS_TLDS) else 0.0,
        1.0 if re.match(r'\d+\.\d+\.\d+\.\d+', domain) else 0.0,
        len(parsed.path),
        len(parsed.query)
    ]

    return torch.tensor(features, dtype=torch.float32)

# ═══════════════════════════════════════
# FEATURE MLP
# ═══════════════════════════════════════

class URLFeatureMLP(nn.Module):
    def __init__(self):
        super().__init__()
        self.net = nn.Sequential(
            nn.Linear(10, 64),
            nn.ReLU(),
            nn.Dropout(0.2),
            nn.Linear(64, 32),
            nn.ReLU()
        )

    def forward(self, x):
        return self.net(x)

# ═══════════════════════════════════════
# FINAL MODEL (OPTIMIZED)
# ═══════════════════════════════════════

class URLDetector(nn.Module):
    def __init__(self, model_name="distilbert-base-uncased", num_classes=4):
        super().__init__()

        # ⚡ LIGHTWEIGHT BERT (KEY UPGRADE)
        self.bert = AutoModel.from_pretrained(model_name)

        # freeze most layers (speed boost)
        for param in self.bert.parameters():
            param.requires_grad = False

        # only last layer trainable
        for param in self.bert.transformer.layer[-1:].parameters():
            param.requires_grad = True

        self.feature_mlp = URLFeatureMLP()

        self.classifier = nn.Sequential(
            nn.Linear(768 + 32, 128),
            nn.ReLU(),
            nn.Dropout(0.3),
            nn.Linear(128, num_classes)
        )

    def forward(self, input_ids, attention_mask, numerical_feats):

        outputs = self.bert(
            input_ids=input_ids,
            attention_mask=attention_mask,
            output_attentions=True
        )
        bert_out = outputs.last_hidden_state
        self.last_attentions = outputs.attentions

        # CLS token
        text_feat = bert_out[:, 0, :]

        num_feat = self.feature_mlp(numerical_feats)

        combined = torch.cat([text_feat, num_feat], dim=1)

        return self.classifier(combined)