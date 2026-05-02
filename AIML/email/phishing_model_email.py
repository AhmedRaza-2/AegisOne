"""
PhishingDetector — Hybrid Model Architecture
==============================================
DistilBERT (LoRA) + Bi-LSTM + Multi-Head Attention + Structured Features

Architecture:
  Input text: "[SUBJECT]: {subject} [BODY]: {body}"
       ↓
  DistilBERT (LoRA fine-tuned, r=16, alpha=32)
       ↓
  Full sequence output (batch × 512 × 768)
       ↓
  Bi-LSTM (hidden=256, bidirectional) → (batch × 512 × 512)
       ↓
  Multi-Head Attention Pooling (8 heads) → (batch × 512)
       ↓
  Concatenate with Structured Features (batch × 10 → batch × 32)
       ↓
  Dense(544 → 128) → ReLU → Dropout(0.3) → Dense(128 → 1) → Sigmoid
       ↓
  Phishing Score [0, 1]
"""

import torch
import torch.nn as nn
import torch.nn.functional as F
from transformers import DistilBertModel, DistilBertTokenizer
from peft import get_peft_model, LoraConfig, TaskType
import re
import numpy as np


# ═══════════════════════════════════════════════════════════════════════
# STRUCTURED FEATURE EXTRACTION
# ═══════════════════════════════════════════════════════════════════════

PHISHING_KEYWORDS = [
    "click here", "verify your account", "update your", "confirm your",
    "suspended", "urgent", "immediately", "act now", "limited time",
    "congratulations", "winner", "won", "prize", "lottery",
    "bank account", "credit card", "social security", "password",
    "login", "sign in", "expire", "unauthorized", "unusual activity",
    "free", "offer", "discount", "wire transfer", "payment",
]

URL_PATTERN = re.compile(r'https?://[^\s<>"\')\]}>]+')


def extract_structured_features(sender, subject, body):
    """
    Extract 10 handcrafted features from email fields.
    Returns a float tensor of shape (10,).
    """
    sender = str(sender) if sender else ""
    subject = str(subject) if subject else ""
    body = str(body) if body else ""
    body_lower = body.lower()

    features = [
        # 1. URL count in body
        len(URL_PATTERN.findall(body)),
        # 2. Has URL (binary)
        1.0 if URL_PATTERN.search(body) else 0.0,
        # 3. CAPS ratio
        sum(1 for c in body if c.isupper()) / max(len(body), 1),
        # 4. Exclamation count
        body.count("!"),
        # 5. Body length (log-scaled)
        np.log1p(len(body)),
        # 6. Subject length (log-scaled)
        np.log1p(len(subject)),
        # 7. Phishing keyword count
        sum(1 for kw in PHISHING_KEYWORDS if kw in body_lower),
        # 8. Sender has angle bracket (display name format)
        1.0 if "<" in sender else 0.0,
        # 9. Is reply
        1.0 if subject.lower().startswith("re:") else 0.0,
        # 10. Has HTML tags
        1.0 if re.search(r'<[a-zA-Z][^>]*>', body) else 0.0,
    ]

    return torch.tensor(features, dtype=torch.float32)


def batch_extract_features(senders, subjects, bodies):
    """Extract features for a batch. Returns (batch_size, 10) tensor."""
    batch = []
    for s, subj, b in zip(senders, subjects, bodies):
        batch.append(extract_structured_features(s, subj, b))
    return torch.stack(batch)


# ═══════════════════════════════════════════════════════════════════════
# MULTI-HEAD ATTENTION POOLING
# ═══════════════════════════════════════════════════════════════════════

class MultiHeadAttentionPool(nn.Module):
    """
    Multi-head attention pooling layer.
    Takes sequence output (batch × seq_len × hidden) and produces
    a fixed-size vector (batch × hidden) using learned attention weights.

    Also stores attention weights for XAI / explainability.
    """

    def __init__(self, hidden_dim, num_heads=8):
        super().__init__()
        self.num_heads = num_heads
        self.head_dim = hidden_dim // num_heads
        assert hidden_dim % num_heads == 0, f"hidden_dim ({hidden_dim}) must be divisible by num_heads ({num_heads})"

        self.query = nn.Linear(hidden_dim, hidden_dim)
        self.key = nn.Linear(hidden_dim, hidden_dim)
        self.value = nn.Linear(hidden_dim, hidden_dim)
        self.out_proj = nn.Linear(hidden_dim, hidden_dim)

        self.attention_weights = None  # Stored for XAI

    def forward(self, x, attention_mask=None):
        """
        Args:
            x: (batch, seq_len, hidden_dim)
            attention_mask: (batch, seq_len) — 1 for real tokens, 0 for padding
        Returns:
            pooled: (batch, hidden_dim)
        """
        batch_size, seq_len, hidden_dim = x.size()

        # Project to Q, K, V
        Q = self.query(x).view(batch_size, seq_len, self.num_heads, self.head_dim).transpose(1, 2)
        K = self.key(x).view(batch_size, seq_len, self.num_heads, self.head_dim).transpose(1, 2)
        V = self.value(x).view(batch_size, seq_len, self.num_heads, self.head_dim).transpose(1, 2)

        # Scaled Dot-Product Attention
        scale = self.head_dim ** 0.5
        scores = torch.matmul(Q, K.transpose(-2, -1)) / scale  # (batch, heads, seq, seq)

        # Mask padding tokens
        if attention_mask is not None:
            mask = attention_mask.unsqueeze(1).unsqueeze(2)  # (batch, 1, 1, seq)
            scores = scores.masked_fill(mask == 0, float('-inf'))

        attn = F.softmax(scores, dim=-1)
        self.attention_weights = attn.detach()  # Store for XAI

        # Apply attention to values
        context = torch.matmul(attn, V)  # (batch, heads, seq, head_dim)
        context = context.transpose(1, 2).contiguous().view(batch_size, seq_len, hidden_dim)
        context = self.out_proj(context)

        # Pool: mean over sequence dimension
        if attention_mask is not None:
            mask_expanded = attention_mask.unsqueeze(-1).float()
            context = context * mask_expanded
            pooled = context.sum(dim=1) / mask_expanded.sum(dim=1).clamp(min=1)
        else:
            pooled = context.mean(dim=1)

        return pooled


# ═══════════════════════════════════════════════════════════════════════
# STRUCTURED FEATURES BRANCH
# ═══════════════════════════════════════════════════════════════════════

class StructuredFeatureBranch(nn.Module):
    """
    Small MLP to process 10 handcrafted features.
    10 → 64 → 32
    """

    def __init__(self, input_dim=10, hidden_dim=64, output_dim=32):
        super().__init__()
        self.net = nn.Sequential(
            nn.Linear(input_dim, hidden_dim),
            nn.ReLU(),
            nn.BatchNorm1d(hidden_dim),
            nn.Dropout(0.2),
            nn.Linear(hidden_dim, output_dim),
            nn.ReLU(),
        )

    def forward(self, x):
        return self.net(x)


# ═══════════════════════════════════════════════════════════════════════
# MAIN MODEL: PhishingDetector
# ═══════════════════════════════════════════════════════════════════════

class PhishingDetector(nn.Module):
    """
    Hybrid phishing detection model.

    Components:
      1. DistilBERT + LoRA → contextual token embeddings
      2. Bi-LSTM → sequential pattern capture
      3. Multi-Head Attention → focus on risky phrases (XAI)
      4. Structured Features → handcrafted signals
      5. Classification head → phishing probability

    Input:
      - input_ids:        (batch, seq_len) — tokenized text
      - attention_mask:   (batch, seq_len) — mask for padding
      - structured_feats: (batch, 10) — handcrafted features

    Output:
      - logits: (batch, 1) — raw logits (pre-sigmoid)
    """

    def __init__(
        self,
        lora_r=16,
        lora_alpha=32,
        lora_dropout=0.1,
        lstm_hidden=256,
        attn_heads=8,
        struct_feat_dim=10,
        struct_output_dim=32,
        classifier_hidden=128,
        dropout=0.3,
    ):
        super().__init__()

        # ── 1. DistilBERT backbone with LoRA ──
        self.distilbert = DistilBertModel.from_pretrained("distilbert-base-uncased")

        lora_config = LoraConfig(
            task_type=TaskType.FEATURE_EXTRACTION,
            r=lora_r,
            lora_alpha=lora_alpha,
            lora_dropout=lora_dropout,
            target_modules=["q_lin", "v_lin"],  # DistilBERT attention layers
        )
        self.distilbert = get_peft_model(self.distilbert, lora_config)

        bert_hidden = 768  # DistilBERT hidden size

        # ── 2. Bi-LSTM ──
        self.lstm = nn.LSTM(
            input_size=bert_hidden,
            hidden_size=lstm_hidden,
            num_layers=1,
            batch_first=True,
            bidirectional=True,
            dropout=0,
        )
        lstm_output_dim = lstm_hidden * 2  # bidirectional

        # ── 3. Multi-Head Attention Pooling ──
        self.attention = MultiHeadAttentionPool(
            hidden_dim=lstm_output_dim,
            num_heads=attn_heads,
        )

        # ── 4. Structured Features Branch ──
        self.struct_branch = StructuredFeatureBranch(
            input_dim=struct_feat_dim,
            output_dim=struct_output_dim,
        )

        # ── 5. Classification Head ──
        combined_dim = lstm_output_dim + struct_output_dim  # 512 + 32 = 544
        self.classifier = nn.Sequential(
            nn.Linear(combined_dim, classifier_hidden),
            nn.ReLU(),
            nn.Dropout(dropout),
            nn.Linear(classifier_hidden, 1),
        )

        # Layer norm for stability
        self.layer_norm = nn.LayerNorm(lstm_output_dim)

    def forward(self, input_ids, attention_mask, structured_feats):
        """
        Forward pass.

        Args:
            input_ids: (batch, seq_len)
            attention_mask: (batch, seq_len)
            structured_feats: (batch, 10)

        Returns:
            logits: (batch, 1)
        """
        # 1. DistilBERT → full sequence output
        bert_output = self.distilbert(
            input_ids=input_ids,
            attention_mask=attention_mask,
        )
        sequence_output = bert_output.last_hidden_state  # (batch, seq_len, 768)

        # 2. Bi-LSTM → sequential patterns
        lstm_output, _ = self.lstm(sequence_output)  # (batch, seq_len, 512)
        lstm_output = self.layer_norm(lstm_output)

        # 3. Multi-Head Attention Pooling → fixed vector
        text_features = self.attention(lstm_output, attention_mask)  # (batch, 512)

        # 4. Structured Features
        struct_features = self.struct_branch(structured_feats)  # (batch, 32)

        # 5. Concatenate & Classify
        combined = torch.cat([text_features, struct_features], dim=-1)  # (batch, 544)
        logits = self.classifier(combined)  # (batch, 1)

        return logits

    def get_attention_weights(self):
        """Return attention weights for XAI / explainability."""
        return self.attention.attention_weights

    def count_parameters(self):
        """Count trainable vs total parameters."""
        total = sum(p.numel() for p in self.parameters())
        trainable = sum(p.numel() for p in self.parameters() if p.requires_grad)
        frozen = total - trainable
        return {
            "total": total,
            "trainable": trainable,
            "frozen": frozen,
            "trainable_pct": trainable / total * 100,
        }

    def print_model_summary(self):
        """Print model architecture summary."""
        params = self.count_parameters()
        print("\n" + "=" * 60)
        print("  PHISHING DETECTOR — MODEL SUMMARY")
        print("=" * 60)
        print(f"  Total parameters:     {params['total']:>12,}")
        print(f"  Trainable parameters: {params['trainable']:>12,}")
        print(f"  Frozen parameters:    {params['frozen']:>12,}")
        print(f"  Trainable %:          {params['trainable_pct']:>11.2f}%")
        print("=" * 60)

        print("\n  Architecture:")
        print("  ┌─────────────────────────────────────────┐")
        print("  │  DistilBERT (LoRA) → 768-dim embeddings │")
        print("  │  Bi-LSTM (256×2=512)                    │")
        print("  │  Multi-Head Attention (8 heads)         │")
        print("  │  Structured Features (10 → 32)          │")
        print("  │  Dense (544 → 128 → 1)                  │")
        print("  └─────────────────────────────────────────┘")
        print()
