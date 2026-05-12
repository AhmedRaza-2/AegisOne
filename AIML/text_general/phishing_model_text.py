"""
PhishingDetectorText — General Text Adaptation
==============================================
Inherits from Email Architecture: DistilBERT (LoRA) + Bi-LSTM + Multi-Head Attention
Optimized for: SMS, Chat, Social Media, and Web Pop-ups.

This model is designed to be initialized with Email Model weights to 
leverage "Phishing Intelligence" while adapting to short-form text.
"""

import torch
import torch.nn as nn
import torch.nn.functional as F
from transformers import DistilBertModel, DistilBertTokenizer
from peft import get_peft_model, LoraConfig, TaskType
import re
import numpy as np

# ═══════════════════════════════════════════════════════════════════════
# TEXT-SPECIFIC FEATURE EXTRACTION (OPTIMIZED FOR SHORT-FORM)
# ═══════════════════════════════════════════════════════════════════════

TEXT_PHISHING_KEYWORDS = [
    "verify", "suspended", "urgent", "immediately", "act now", "limited",
    "winner", "prize", "cashapp", "zelle", "venmo", "bitcoin", "crypto",
    "login", "signin", "unusual", "activity", "blocked", "payment",
    "action required", "secure your", "last chance", "gift card"
]

SHORT_URL_PATTERN = re.compile(r'(bit\.ly|t\.co|goo\.gl|tinyurl|is\.gd|cli\.re|buff\.ly|ow\.ly)')
GENERIC_URL_PATTERN = re.compile(r'https?://[^\s<>"\')\]}>]+')

def extract_general_text_features(text):
    """
    Extract 10 features optimized for short messages (SMS/Chat).
    """
    text = str(text) if text else ""
    text_lower = text.lower()
    
    # Calculate features
    features = [
        # 1. Has short URL (high risk in SMS)
        1.0 if SHORT_URL_PATTERN.search(text_lower) else 0.0,
        # 2. Total URL count
        len(GENERIC_URL_PATTERN.findall(text_lower)),
        # 3. Urgency keyword count
        sum(1 for kw in TEXT_PHISHING_KEYWORDS if kw in text_lower),
        # 4. Message length (log-scaled) - SMS are shorter than emails
        np.log1p(len(text)),
        # 5. Exclamation/Question mark count (high in scams)
        text.count("!") + text.count("?"),
        # 6. Numeric digit ratio (often used in fake codes/amounts)
        sum(c.isdigit() for c in text) / max(len(text), 1),
        # 7. CAPS ratio (shouting)
        sum(1 for c in text if c.isupper()) / max(len(text), 1),
        # 8. Contains currency symbols
        1.0 if any(c in "$£€¥" for c in text) else 0.0,
        # 9. Starts with "Urgent" or "Alert"
        1.0 if any(text_lower.startswith(w) for w in ["urgent", "alert", "notice", "warning"]) else 0.0,
        # 10. Contains sensitive word "account" or "bank"
        1.0 if "account" in text_lower or "bank" in text_lower else 0.0
    ]
    
    return torch.tensor(features, dtype=torch.float32)

def batch_extract_text_features(texts):
    batch = [extract_general_text_features(t) for t in texts]
    return torch.stack(batch)

# ═══════════════════════════════════════════════════════════════════════
# ARCHITECTURE (Identical to Email for Weight Transfer)
# ═══════════════════════════════════════════════════════════════════════

class MultiHeadAttentionPool(nn.Module):
    def __init__(self, hidden_dim, num_heads=8):
        super().__init__()
        self.num_heads = num_heads
        self.head_dim = hidden_dim // num_heads
        self.query = nn.Linear(hidden_dim, hidden_dim)
        self.key = nn.Linear(hidden_dim, hidden_dim)
        self.value = nn.Linear(hidden_dim, hidden_dim)
        self.out_proj = nn.Linear(hidden_dim, hidden_dim)
        self.attention_weights = None

    def forward(self, x, attention_mask=None):
        batch_size, seq_len, hidden_dim = x.size()
        Q = self.query(x).view(batch_size, seq_len, self.num_heads, self.head_dim).transpose(1, 2)
        K = self.key(x).view(batch_size, seq_len, self.num_heads, self.head_dim).transpose(1, 2)
        V = self.value(x).view(batch_size, seq_len, self.num_heads, self.head_dim).transpose(1, 2)

        scores = torch.matmul(Q, K.transpose(-2, -1)) / (self.head_dim ** 0.5)
        if attention_mask is not None:
            mask = attention_mask.unsqueeze(1).unsqueeze(2)
            scores = scores.masked_fill(mask == 0, float('-inf'))

        attn = F.softmax(scores, dim=-1)
        self.attention_weights = attn.detach()
        context = torch.matmul(attn, V).transpose(1, 2).contiguous().view(batch_size, seq_len, hidden_dim)
        context = self.out_proj(context)

        if attention_mask is not None:
            mask_expanded = attention_mask.unsqueeze(-1).float()
            pooled = (context * mask_expanded).sum(dim=1) / mask_expanded.sum(dim=1).clamp(min=1)
        else:
            pooled = context.mean(dim=1)
        return pooled

class PhishingDetectorText(nn.Module):
    def __init__(self, lora_r=16, lora_alpha=32, lstm_hidden=256, classifier_hidden=128):
        super().__init__()
        
        # 1. DistilBERT + LoRA
        self.distilbert = DistilBertModel.from_pretrained("distilbert-base-uncased")
        lora_config = LoraConfig(
            task_type=TaskType.FEATURE_EXTRACTION,
            r=lora_r, lora_alpha=lora_alpha, lora_dropout=0.1,
            target_modules=["q_lin", "v_lin"]
        )
        self.distilbert = get_peft_model(self.distilbert, lora_config)

        # 2. Bi-LSTM
        self.lstm = nn.LSTM(input_size=768, hidden_size=lstm_hidden, num_layers=1, batch_first=True, bidirectional=True)
        
        # 3. Attention
        self.attention = MultiHeadAttentionPool(hidden_dim=lstm_hidden*2)
        
        # 4. Features
        self.struct_branch = nn.Sequential(
            nn.Linear(10, 64), nn.ReLU(), nn.BatchNorm1d(64), nn.Dropout(0.2),
            nn.Linear(64, 32), nn.ReLU()
        )

        # 5. Classifier
        self.classifier = nn.Sequential(
            nn.Linear(512 + 32, classifier_hidden), nn.ReLU(), nn.Dropout(0.3),
            nn.Linear(classifier_hidden, 1)
        )
        self.layer_norm = nn.LayerNorm(512)

    def forward(self, input_ids, attention_mask, structured_feats):
        bert_output = self.distilbert(input_ids=input_ids, attention_mask=attention_mask)
        sequence_output = bert_output.last_hidden_state
        
        lstm_output, _ = self.lstm(sequence_output)
        lstm_output = self.layer_norm(lstm_output)
        
        text_features = self.attention(lstm_output, attention_mask)
        struct_features = self.struct_branch(structured_feats)
        
        combined = torch.cat([text_features, struct_features], dim=-1)
        return self.classifier(combined)

    def load_from_email_model(self, path, device='cpu'):
        """Crucial: Loads weights from the Email model to start with high intelligence."""
        print(f"🔄 Inheriting Phishing Intelligence from: {path}")
        state_dict = torch.load(path, map_location=device)
        # We use strict=False because some minor architecture names might differ 
        # or we might have added/changed the structured feature branch.
        self.load_state_dict(state_dict, strict=False)
        print("✅ Intelligence Transfer Complete.")
