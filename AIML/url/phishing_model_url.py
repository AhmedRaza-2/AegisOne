"""
phishing_model_url.py — Model 2: URL Detection Architecture
==========================================================
Architecture: BERT (LoRA) + BiLSTM + GRU + Handcrafted Features
Role: This file is for the Model Architecture only (Inference/API).
"""

import torch
import torch.nn as nn
import torch.nn.functional as F
from transformers import AutoModel, AutoTokenizer
import re
from urllib.parse import urlparse

# ═══════════════════════════════════════════════════════════════════════
# 1. HANDCRAFTED URL FEATURE EXTRACTION (11 Features)
# ═══════════════════════════════════════════════════════════════════════

SUSPICIOUS_TLDS = {'.tk', '.ml', '.ga', '.cf', '.gq', '.top', '.xyz', '.site', '.online', '.bit'}
SHORTENERS = {'bit.ly', 'goo.gl', 't.co', 'tinyurl.com', 'is.gd', 'buff.ly', 'ow.ly'}

def extract_url_numerical_features(url):
    """Extracts 10 handcrafted numerical features from a URL (Protocol-Neutral)."""
    url_str = str(url).lower()
    
    # Clean URL for consistent feature extraction (Strip protocol & www)
    clean_url = url_str.replace("https://", "").replace("http://", "").replace("www.", "")
    
    try:
        # Use a dummy protocol for parsing consistency
        parsed = urlparse('http://' + clean_url)
    except:
        return torch.zeros(10, dtype=torch.float32)

    domain = parsed.netloc if parsed.netloc else clean_url.split('/')[0]
    
    features = [
        # 1. Clean URL Length
        len(clean_url),
        # 2. Domain Length
        len(domain),
        # 3. Path Length
        len(parsed.path),
        # 4. Dot Count (on clean URL)
        clean_url.count('.'),
        # 5. Dash Count
        clean_url.count('-'),
        # 6. Special Char Ratio (on clean URL)
        sum(1 for c in clean_url if not c.isalnum() and c not in '.') / max(len(clean_url), 1),
        # 7. Subdomain Depth
        max(domain.count('.') - 1, 0),
        # 8. Has IP address? (heuristic)
        1.0 if re.match(r'^\d{1,3}\.\d{1,3}\.\d{1,3}\.\d{1,3}$', domain) else 0.0,
        # 9. Shortener used? (binary)
        1.0 if any(s in domain for s in SHORTENERS) else 0.0,
        # 10. Suspicious TLD used? (binary)
        1.0 if any(clean_url.endswith(tld) for tld in SUSPICIOUS_TLDS) else 0.0
    ]
    
    return torch.tensor(features, dtype=torch.float32)

def batch_extract_url_features(urls):
    """Batch processing for URL features."""
    return torch.stack([extract_url_numerical_features(u) for u in urls])


# ═══════════════════════════════════════════════════════════════════════
# 2. MODEL COMPONENTS
# ═══════════════════════════════════════════════════════════════════════

class URLFeatureMLP(nn.Module):
    """Small MLP to process numerical URL features."""
    def __init__(self, input_dim=10, output_dim=32):
        super().__init__()
        self.net = nn.Sequential(
            nn.Linear(input_dim, 64),
            nn.ReLU(),
            nn.BatchNorm1d(64),
            nn.Dropout(0.2),
            nn.Linear(64, output_dim),
            nn.ReLU()
        )
    def forward(self, x):
        return self.net(x)

class URLDetector(nn.Module):
    """
    Hybrid URL Detector: BERT + BiLSTM + GRU + MLP
    """
    def __init__(
        self,
        bert_model_name="bert-base-uncased",
        lstm_hidden=256,
        gru_hidden=128,
        num_classes=4,
        dropout=0.3
    ):
        super().__init__()
        
        # 1. Contextual Branch (BERT)
        self.bert = AutoModel.from_pretrained(bert_model_name)
        
        # Freeze BERT except last layer for efficiency
        for param in self.bert.parameters():
            param.requires_grad = False
        for param in self.bert.encoder.layer[-1:].parameters():
            param.requires_grad = True

        self.bert_hidden = 768
        
        # 2. Sequential Modeling
        self.lstm = nn.LSTM(
            input_size=self.bert_hidden,
            hidden_size=lstm_hidden,
            num_layers=1,
            batch_first=True,
            bidirectional=True
        )
        
        self.gru = nn.GRU(
            input_size=lstm_hidden * 2,
            hidden_size=gru_hidden,
            num_layers=1,
            batch_first=True
        )
        
        # 3. Analytical Branch (MLP)
        self.mlp_branch = URLFeatureMLP(input_dim=10, output_dim=32)
        
        # 4. Final Classification
        combined_dim = gru_hidden + 32 
        self.classifier = nn.Sequential(
            nn.Linear(combined_dim, 64),
            nn.ReLU(),
            nn.Dropout(dropout),
            nn.Linear(64, num_classes)
        )

    def forward(self, input_ids, attention_mask, numerical_feats):
        # 1. Contextual Features
        bert_out = self.bert(input_ids=input_ids, attention_mask=attention_mask)
        seq_out = bert_out.last_hidden_state
        
        # 2. Sequential processing
        lstm_out, _ = self.lstm(seq_out)
        gru_out, _ = self.gru(lstm_out)
        
        # 3. Pooling: Global Max Pool
        pooled_text, _ = torch.max(gru_out, dim=1)
        
        # 4. Analytical Features
        mlp_out = self.mlp_branch(numerical_feats)
        
        # 5. Fusion
        combined = torch.cat([pooled_text, mlp_out], dim=-1)
        
        return self.classifier(combined)

    def count_parameters(self):
        total = sum(p.numel() for p in self.parameters())
        trainable = sum(p.numel() for p in self.parameters() if p.requires_grad)
        return {"total": total, "trainable": trainable}
