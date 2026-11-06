"""
Message model M1 network: multilingual sentence encoder (fully fine-tuned) + dense structural features + auxiliary
intent head. Used by the Kaggle training script and by the API.

  logits  = MLP([mean-pooled encoder state | dense(54) -> 64])          phishing / scam vs legitimate
  intents = Linear(mean-pooled encoder state)                           what the message asks for (multi-label)
"""
import json
import os

import torch
import torch.nn as nn

from AIML.message import context as C

MAX_LEN = 320


class MessageNet(nn.Module):
    def __init__(self, encoder):
        super().__init__()
        self.encoder = encoder
        h = encoder.config.hidden_size
        self.dense = nn.Sequential(nn.Linear(C.N_DENSE, 64), nn.GELU())
        self.head = nn.Sequential(nn.Dropout(0.1), nn.Linear(h + 64, 256), nn.GELU(), nn.Dropout(0.1), nn.Linear(256, 2))
        self.intent = nn.Linear(h, len(C.INTENTS))

    def forward(self, input_ids, attention_mask, dense):
        hs = self.encoder(input_ids=input_ids, attention_mask=attention_mask).last_hidden_state
        m = attention_mask.unsqueeze(-1).to(hs.dtype)
        pooled = (hs * m).sum(1) / m.sum(1).clamp(min=1.0)
        return self.head(torch.cat([pooled, self.dense(dense.to(pooled.dtype))], dim=1)), self.intent(pooled)


def encode(tok, rows, device="cpu", prefix="query: "):
    """rows: iterable of (channel, sender, subject, body[, history]) -> model inputs.
    prefix: the backbone's input prefix, stored in calibration.json ("query: " for e5 models, "" for the English BGE backbone)."""
    rows = list(rows)
    texts = [prefix + C.build_text(r[0], r[1], r[2], r[3], r[4] if len(r) > 4 else None) for r in rows] 
    enc = tok(texts, truncation=True, max_length=MAX_LEN, padding=True, return_tensors="pt")
    dense = torch.tensor([C.dense_features(r[0], r[1], r[2], r[3]) for r in rows])
    return {"input_ids": enc["input_ids"].to(device), "attention_mask": enc["attention_mask"].to(device), "dense": dense.to(device)}


def load(model_dir, device="cpu"):
    from safetensors.torch import load_file
    from transformers import AutoConfig, AutoModel, AutoTokenizer
    cal = json.load(open(os.path.join(model_dir, "calibration.json")))
    net = MessageNet(AutoModel.from_config(AutoConfig.from_pretrained(model_dir)))
    net.load_state_dict(load_file(os.path.join(model_dir, "message_m1.safetensors")))
    return net.eval().to(device), AutoTokenizer.from_pretrained(model_dir), cal
