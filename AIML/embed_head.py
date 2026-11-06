"""
Embedding + head detectors (v2) for e-mail and text/SMS: serving, training and the retraining gate.

A detector is   frozen sentence backbone (AIML/embed_backbone.py)  ->  [embedding | structured features]
                ->  standardise  ->  logistic head  ->  calibrated probability
and is stored as ONE JSON file (no pickle, so loading a model can never execute code):

  {"format": "aegis-embed-head-v1", "kind": "email"|"text", "backbone": "en"|"multi", "max_len": 256,
   "feature_names": [...], "mean": [...], "std": [...], "coef": [...], "intercept": b,
   "platt": [a, c], "thresholds": {"warn": t1, "block": t2}, "meta": {...}}

Retraining (module 8.11) re-fits only the head on the organisation's verified reports plus a replay sample of the
original training embeddings, with a proximal penalty that keeps the weights near the shipped ones, so a few dozen
corrections cannot wreck the model. A candidate is accepted only if it does not regress on the frozen reference
sets (AUC, recall at the WARN threshold, false-alarm rate) - the same rule as the URL heads (weight_trainer.judge).
"""
import json
import math
import os
from pathlib import Path
from typing import Any, Callable, Dict, List, Optional, Sequence

import numpy as np

FORMAT = "aegis-embed-head-v1"


def _sigmoid(z):
    return 1.0 / (1.0 + np.exp(-np.clip(z, -40, 40)))


class EmbedHead:
    def __init__(self, spec: Dict[str, Any], featurize: Callable[..., np.ndarray]):
        if spec.get("format") != FORMAT:
            raise ValueError("not an AegisOne embed-head file")
        self.spec = spec
        self.kind = spec["kind"]
        self.featurize = featurize
        self.mean = np.asarray(spec["mean"], np.float32)
        self.std = np.asarray(spec["std"], np.float32)
        self.coef = np.asarray(spec["coef"], np.float32)
        self.b = float(spec["intercept"])
        self.platt = spec.get("platt") or [1.0, 0.0]
        self.thresholds = spec.get("thresholds") or {"warn": 0.5, "block": 0.8}
        self._bb = None

    @property
    def backbone(self):
        if self._bb is None:
            from AIML.embed_backbone import get_backbone
            self._bb = get_backbone(self.spec["backbone"], int(self.spec.get("max_len", 256)))
        return self._bb

    def design(self, texts: Sequence[str], feats: np.ndarray) -> np.ndarray:
        emb = self.backbone.encode(list(texts))
        return np.hstack([emb, feats.astype(np.float32)])

    def logits(self, X: np.ndarray) -> np.ndarray:
        return ((X - self.mean) / self.std) @ self.coef + self.b

    def proba_from_design(self, X: np.ndarray) -> np.ndarray:
        a, c = self.platt
        return _sigmoid(a * self.logits(X) + c)

    def risk_from_design(self, X: np.ndarray) -> np.ndarray:
        """Calibrated probability mapped onto the product's risk scale (35 suspicious / 51 WARN / 76 BLOCK) so that
        those fixed cut-offs mean "5% / 1% / 0.1% of legitimate messages", whatever the model. Monotone: ranking
        and every TPR-at-FPR figure are unchanged."""
        p = self.proba_from_design(X)
        rm = self.spec.get("risk_map")
        return np.interp(p, rm[0], rm[1]) if rm else p

    def contributions(self, x: np.ndarray, top: int = 4) -> List[Dict[str, Any]]:
        """Which structured features pushed this one score up the most (for the explanation shown to users)."""
        names = self.spec.get("feature_names") or []
        k = len(names)
        if not k:
            return []
        z = ((x - self.mean) / self.std)[-k:] * self.coef[-k:]
        order = np.argsort(-z)[:top]
        return [{"feature": names[i], "weight": round(float(z[i]), 3)} for i in order if z[i] > 0.15]

    def to_json(self) -> str:
        return json.dumps(self.spec)


def load(path: os.PathLike, featurize) -> Optional[EmbedHead]:
    p = Path(path)
    if not p.exists():
        return None
    return EmbedHead(json.loads(p.read_text()), featurize)


# ── training ───────────────────────────────────────────────────────────────────────────────────────
def fit_logistic(X: np.ndarray, y: np.ndarray, *, l2: float = 1.0, w0: Optional[np.ndarray] = None, b0: float = 0.0,
                 prox: float = 0.0, sample_weight: Optional[np.ndarray] = None, iters: int = 300, lr: float = 0.5) -> tuple:
    """Logistic regression on standardised X by full-batch gradient descent (Nesterov momentum).
    l2 shrinks toward 0; prox (with w0/b0) shrinks toward a previous head - used for organisation retraining."""
    n, d = X.shape
    w = np.zeros(d) if w0 is None else w0.astype(np.float64).copy()
    b = float(b0)
    sw = np.ones(n) if sample_weight is None else sample_weight.astype(np.float64)
    sw = sw / sw.mean()
    vw, vb = np.zeros(d), 0.0
    anchor = np.zeros(d) if w0 is None else w0.astype(np.float64)
    for _ in range(iters):
        p = _sigmoid(X @ w + b)
        g = sw * (p - y)
        gw = X.T @ g / n + l2 * w / n + prox * (w - anchor) / n
        gb = g.mean() + prox * (b - b0) / n
        vw = 0.9 * vw - lr * gw
        vb = 0.9 * vb - lr * gb
        w += vw
        b += vb
    return w.astype(np.float32), float(b)


def fit_platt(logit: np.ndarray, y: np.ndarray) -> List[float]:
    """Temperature/Platt scaling on held-out logits: keeps the ranking, fixes over-confidence."""
    a, c = 1.0, 0.0
    for _ in range(500):
        p = _sigmoid(a * logit + c)
        ga, gc = np.mean((p - y) * logit), np.mean(p - y)
        a -= 0.5 * ga
        c -= 0.5 * gc
    return [float(a), float(c)]


def threshold_at_fpr(neg_scores: np.ndarray, fpr: float) -> float:
    s = np.sort(neg_scores)
    k = int(math.ceil(len(s) * (1 - fpr))) - 1
    return float(s[min(max(k, 0), len(s) - 1)])


def build_spec(kind: str, backbone: str, X: np.ndarray, y: np.ndarray, feature_names: List[str], *, l2: float = 2.0,
               holdout: Optional[tuple] = None, legit_for_thresholds: Optional[np.ndarray] = None,
               warn_fpr: float = 0.01, block_fpr: float = 0.001, meta: Optional[Dict[str, Any]] = None, max_len: int = 256) -> Dict[str, Any]:
    mean = X.mean(0)
    std = X.std(0) + 1e-6
    w, b = fit_logistic((X - mean) / std, y.astype(np.float64), l2=l2 * len(y) / 1000.0, iters=400)
    spec = {"format": FORMAT, "kind": kind, "backbone": backbone, "max_len": max_len, "feature_names": feature_names,
            "mean": mean.tolist(), "std": std.tolist(), "coef": w.tolist(), "intercept": b, "platt": [1.0, 0.0],
            "thresholds": {"warn": 0.5, "block": 0.85}, "meta": meta or {}}
    head = EmbedHead(spec, lambda *a: None)
    if holdout is not None:
        Xh, yh = holdout
        spec["platt"] = fit_platt(head.logits(Xh), yh.astype(np.float64))
        head.platt = spec["platt"]
    if legit_for_thresholds is not None and len(legit_for_thresholds) >= 200:
        s = head.proba_from_design(legit_for_thresholds)
        t_s, t_w, t_b = threshold_at_fpr(s, 0.05), threshold_at_fpr(s, warn_fpr), threshold_at_fpr(s, block_fpr)
        spec["thresholds"] = {"suspicious": t_s, "warn": t_w, "block": t_b,
                              "fpr_targets": {"suspicious": 0.05, "warn": warn_fpr, "block": block_fpr}, "calibrated_on": int(len(s))}
        # anchors for the product scale; kept strictly increasing so the map stays monotone
        xs = [0.0, max(t_s, 1e-4)]
        xs.append(max(t_w, xs[-1] + 1e-4))
        xs.append(min(max(t_b, xs[-1] + 1e-4), 1.0 - 1e-6))
        xs.append(1.0)
        spec["risk_map"] = [xs, [0.0, 0.35, 0.51, 0.76, 1.0]]
    return spec
