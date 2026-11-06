"""
Frozen sentence-embedding backbones for the e-mail and text/SMS detectors (v2).

Why frozen: a full fine-tune of a 70M-parameter encoder on one corpus memorises that corpus (99% on its own split,
single digits on modern credential mail). A frozen general-purpose embedding plus a small trained head
  * generalises across sources at least as well on our tests (see AIML/eval/results),
  * trains in seconds on a CPU, so organisations can retrain the HEAD on their own verified reports on their own
    server (module 8.11) and ship only the ~100 KB head to the vendor hub, never raw mail,
  * is easy to swap: a better backbone is a one-line change and a re-fit of the head.

Backbones
  en  : BAAI/bge-small-en-v1.5                       (MIT, 33M, 384-d, CLS pooling)
  multi: intfloat/multilingual-e5-small              (MIT, 118M, 384-d, mean pooling, needs the "query: " prefix)
         handles Urdu script and 100 languages; Roman-Urdu is only partly covered (documented limitation).
"""
import os
import threading
from typing import List, Sequence

import numpy as np
import torch
from transformers import AutoModel, AutoTokenizer

SPECS = {
    "en": {"repo": "BAAI/bge-small-en-v1.5", "pool": "cls", "prefix": "", "dim": 384},
    "multi": {"repo": "intfloat/multilingual-e5-small", "pool": "mean", "prefix": "query: ", "dim": 384},
}


class SentenceBackbone:
    def __init__(self, kind: str = "en", max_len: int = 256, device: str | None = None):
        spec = SPECS[kind]
        self.kind, self.spec, self.max_len = kind, spec, max_len
        self.device = device or ("cuda" if torch.cuda.is_available() else "cpu")
        local = os.environ.get("AEGIS_EMBED_DIR")
        src = os.path.join(local, kind) if local and os.path.isdir(os.path.join(local, kind)) else spec["repo"]
        self.tok = AutoTokenizer.from_pretrained(src)
        self.model = AutoModel.from_pretrained(src).to(self.device).eval()
        self._lock = threading.Lock()

    @property
    def dim(self) -> int:
        return self.spec["dim"]

    @torch.inference_mode()
    def encode(self, texts: Sequence[str], batch: int = 32) -> np.ndarray:
        out: List[np.ndarray] = []
        texts = [self.spec["prefix"] + (t or "") for t in texts]
        # sort by length so batches pad little (3-4x faster on CPU), then restore the order
        order = np.argsort([len(t) for t in texts])
        for i in range(0, len(texts), batch):
            idx = order[i:i + batch]
            enc = self.tok([texts[j] for j in idx], padding=True, truncation=True, max_length=self.max_len, return_tensors="pt").to(self.device)
            with self._lock:
                h = self.model(**enc).last_hidden_state
            if self.spec["pool"] == "cls":
                v = h[:, 0]
            else:
                m = enc["attention_mask"].unsqueeze(-1).to(h.dtype)
                v = (h * m).sum(1) / m.sum(1).clamp(min=1)
            v = torch.nn.functional.normalize(v, dim=-1)
            out.append(v.cpu().numpy().astype(np.float32))
        arr = np.concatenate(out) if out else np.zeros((0, self.dim), np.float32)
        res = np.empty_like(arr)
        res[order] = arr
        return res


_CACHE: dict = {}


def get_backbone(kind: str = "en", max_len: int = 256) -> SentenceBackbone:
    key = (kind, max_len)
    if key not in _CACHE:
        _CACHE[key] = SentenceBackbone(kind, max_len)
    return _CACHE[key]
