"""
AegisOne — server-side weight training & benchmark gate (URL model)
====================================================================
Runs on the SERVER (the organisation's core, or the vendor hub), never on an admin's laptop.

What is trained
  The URL model is DistilBERT + a numeric-feature MLP + a classifier. Fine-tuning the whole network
  on a few hundred verified URLs would wreck it, so only the two small HEADS (`feature_mlp`,
  `classifier`, ~230k parameters) are trained, on top of the frozen language backbone:
    - the backbone embedding of every URL is computed once, then the heads are trained on those cached
      vectors in seconds on a plain CPU;
    - a proximal penalty keeps the heads close to the shipped base weights, and a replay sample of the
      original training data is mixed in, so the model learns the organisation's corrections without
      forgetting what it knew.
  The result is a ~1 MB "heads package" (`heads.pt`) - small enough to submit to the vendor.

How it is judged (same gate locally and at the vendor)
  The candidate heads and the current heads are both scored on held-out data the candidate never
  trained on. A candidate is accepted only if it does not regress (AUC / recall / false-positive
  rate within tolerance) AND improves at least one headline metric by a minimum margin.
"""
import os
import io
import json
import hashlib
import logging
import random
from copy import deepcopy
from pathlib import Path
from typing import Any, Dict, List, Optional, Sequence, Tuple

import numpy as np

logger = logging.getLogger("aegisone.weight_trainer")

BASE_DIR = Path(__file__).resolve().parents[2]
URL_DIR = BASE_DIR / "AIML" / "url"
HEAD_PREFIXES = ("feature_mlp.", "classifier.")
FORMAT = "aegis-heads-v1"

# ── training hyper-parameters (conservative on purpose) ─────────────────────────────
EPOCHS = int(os.environ.get("AEGIS_HEAD_EPOCHS", "60"))
LR = float(os.environ.get("AEGIS_HEAD_LR", "3e-4"))
PROX = float(os.environ.get("AEGIS_HEAD_PROX", "2.0"))       # pull toward the base head weights
REPLAY_PER_CLASS = int(os.environ.get("AEGIS_HEAD_REPLAY", "300"))
MIN_SAMPLES = int(os.environ.get("AEGIS_MIN_TRAIN_SAMPLES", "20"))
MIN_PER_CLASS = int(os.environ.get("AEGIS_MIN_TRAIN_PER_CLASS", "5"))

# ── acceptance gate ──────────────────────────────────────────────────────────────────
GATE = {
    "max_auc_drop": 0.002,      # reference AUC may not fall by more than this
    "max_fpr_rise": 0.005,      # false-positive rate may not rise by more than this (absolute)
    "max_recall_drop": 0.005,   # reference recall may not fall by more than this
    "min_gain": 0.005,          # ...and something must improve by at least this (F1, or org hold-out recall)
}
# Operators/tests can tune a threshold: AEGIS_GATE_MAX_FPR_RISE=0.01 ...
GATE = {k: float(os.environ.get("AEGIS_GATE_" + k.upper(), v)) for k, v in GATE.items()}


# ═════════════════════════════════════════════════════════════════════════════════════
# Model plumbing
# ═════════════════════════════════════════════════════════════════════════════════════

class Backbone:
    """A float32 copy of the shipped URL model used only for training/evaluation (the served model
    is quantised and is left alone)."""

    def __init__(self):
        import torch
        from api.services import model_orchestrator as mo
        from transformers import AutoTokenizer
        from AIML.url import v7_features as v7

        self.torch = torch
        ckpt = mo.URL_MODEL_PT if Path(mo.URL_MODEL_PT).exists() else mo.URL_MODEL_PT_FALLBACK
        mod = mo._load_module("aegis_url_train", str(mo.URL_MODEL_PY))
        self.model, name = mod.load_url_detector(str(ckpt), "cpu")
        self.model.eval()
        self.tok = AutoTokenizer.from_pretrained(name)
        self.prep = v7.structuralize_url if "v7" in Path(ckpt).name.lower() else (lambda u: u)
        self.feats = v7.extract_url_numerical_features if "v7" in Path(ckpt).name.lower() else mod.extract_url_numerical_features
        self.ckpt = Path(ckpt)
        self.base_heads = {k: v.detach().clone() for k, v in self.model.state_dict().items() if k.startswith(HEAD_PREFIXES)}

    def embed(self, urls: Sequence[str], batch: int = 32) -> Tuple[Any, Any]:
        """(CLS embeddings [N,H], numeric features [N,10]) from the frozen backbone."""
        torch = self.torch
        cls_out, f_out = [], []
        with torch.inference_mode():
            for i in range(0, len(urls), batch):
                chunk = [str(u) for u in urls[i:i + batch]]
                enc = self.tok([self.prep(u) for u in chunk], add_special_tokens=True, max_length=128,
                               padding="max_length", truncation=True, return_tensors="pt")
                h = self.model.bert(input_ids=enc["input_ids"], attention_mask=enc["attention_mask"]).last_hidden_state[:, 0, :]
                cls_out.append(h)
                f_out.append(torch.stack([self.feats(u) for u in chunk]))
        return torch.cat(cls_out), torch.cat(f_out)

    def head_modules(self, heads: Optional[Dict[str, Any]] = None):
        """feature_mlp + classifier with the given head weights (default: the base weights)."""
        m = deepcopy(self.model)
        if heads:
            m.load_state_dict({**m.state_dict(), **heads}, strict=True)
        m.eval()
        return m

    def p_phish(self, heads: Optional[Dict[str, Any]], cls, feats) -> np.ndarray:
        torch = self.torch
        m = self.head_modules(heads)
        with torch.inference_mode():
            z = torch.cat([cls, m.feature_mlp(feats)], dim=1)
            probs = torch.softmax(m.classifier(z), dim=1)
        return (1.0 - probs[:, 0]).cpu().numpy()


_backbone: Optional[Backbone] = None


def get_backbone() -> Backbone:
    global _backbone
    if _backbone is None:
        _backbone = Backbone()
    return _backbone


def release_backbone():
    global _backbone
    _backbone = None


# ═════════════════════════════════════════════════════════════════════════════════════
# Metrics
# ═════════════════════════════════════════════════════════════════════════════════════

def metrics(y: np.ndarray, p: np.ndarray, thr: float = 0.5) -> Dict[str, Any]:
    from sklearn.metrics import roc_auc_score
    y = np.asarray(y).astype(int)
    pred = (p >= thr).astype(int)
    tp = int(((pred == 1) & (y == 1)).sum()); fp = int(((pred == 1) & (y == 0)).sum())
    tn = int(((pred == 0) & (y == 0)).sum()); fn = int(((pred == 0) & (y == 1)).sum())
    prec = tp / (tp + fp) if tp + fp else 0.0
    rec = tp / (tp + fn) if tp + fn else 0.0
    f1 = 2 * prec * rec / (prec + rec) if prec + rec else 0.0
    auc = float(roc_auc_score(y, p)) if len(set(y.tolist())) > 1 else None
    return {"n": int(len(y)), "auc": auc, "f1": round(f1, 4), "precision": round(prec, 4), "recall": round(rec, 4),
            "fpr": round(fp / (fp + tn), 4) if fp + tn else 0.0, "accuracy": round((tp + tn) / max(1, len(y)), 4)}


# ═════════════════════════════════════════════════════════════════════════════════════
# Reference / benchmark data (the original training distribution, never the organisation's)
# ═════════════════════════════════════════════════════════════════════════════════════

def _read_pairs(path: Path, n_per_class: int, seed: int) -> Tuple[List[str], List[int]]:
    import pandas as pd
    if not path.exists():
        return [], []
    df = pd.read_csv(path, usecols=lambda c: c in ("url", "label"))
    df = df.dropna(subset=["url", "label"])
    df["label"] = df["label"].astype(int).clip(0, 1)
    parts = [g.sample(min(n_per_class, len(g)), random_state=seed) for _, g in df.groupby("label")]
    out = pd.concat(parts).sample(frac=1.0, random_state=seed)
    return out["url"].astype(str).tolist(), out["label"].tolist()


def reference_sets(n_per_class: int = 400) -> Dict[str, Tuple[List[str], List[int]]]:
    """Held-out sets used to make sure a candidate has not gotten worse."""
    sets = {}
    for name, fname in (("v7_test", "v7_test.csv"), ("hard_set", "hard_evaluation_dataset.csv")):
        urls, labels = _read_pairs(URL_DIR / fname, n_per_class, seed=7)
        if urls:
            sets[name] = (urls, labels)
    return sets


def replay_sample() -> Tuple[List[str], List[int]]:
    """Original training data mixed into every fine-tune so old knowledge is rehearsed (distinct seed from the references)."""
    return _read_pairs(URL_DIR / "v7_train.csv", REPLAY_PER_CLASS, seed=99)


_bench_cache: Dict[str, Any] = {}


def benchmark_embeddings(bb: Backbone) -> Dict[str, Dict[str, Any]]:
    """Embeddings of the benchmark sets, cached (computing them is the slow part)."""
    key = "bench"
    if key in _bench_cache:
        return _bench_cache[key]
    out = {}
    for name, (urls, labels) in reference_sets().items():
        cache = URL_DIR / f".bench_{name}.pt"
        stamp = [bb.ckpt.stat().st_mtime, len(urls)]
        cls = feats = None
        if cache.exists():
            try:
                blob = bb.torch.load(str(cache), map_location="cpu")
                if blob.get("stamp") == stamp:
                    cls, feats = blob["cls"], blob["feats"]
            except Exception:
                pass
        if cls is None:
            cls, feats = bb.embed(urls)
            try:
                bb.torch.save({"stamp": stamp, "cls": cls, "feats": feats}, str(cache))
            except Exception:
                pass
        out[name] = {"cls": cls, "feats": feats, "y": np.array(labels)}
    _bench_cache[key] = out
    return out


# ═════════════════════════════════════════════════════════════════════════════════════
# Training
# ═════════════════════════════════════════════════════════════════════════════════════

def _train_heads(bb: Backbone, cls, feats, y: np.ndarray, base: Dict[str, Any], seed: int = 1) -> Dict[str, Any]:
    torch = bb.torch
    torch.manual_seed(seed)
    m = bb.head_modules(base)
    params = list(m.feature_mlp.parameters()) + list(m.classifier.parameters())
    anchors = [p.detach().clone() for p in params]
    for p in params:
        p.requires_grad_(True)
    m.train()
    opt = torch.optim.Adam(params, lr=LR)
    yt = torch.tensor(y, dtype=torch.long)
    # balanced class weights over the 3-way output (only classes 0/1 appear in the labels)
    counts = np.bincount(y, minlength=2).astype(float)
    w = torch.zeros(m.classifier[-1].out_features)
    w[:2] = torch.tensor(counts.sum() / (2.0 * np.maximum(counts, 1.0)), dtype=torch.float32)
    w[2:] = 1.0
    loss_fn = torch.nn.CrossEntropyLoss(weight=w)
    n = len(y)
    order = np.arange(n)
    rng = np.random.default_rng(seed)
    for _ in range(EPOCHS):
        rng.shuffle(order)
        for i in range(0, n, 64):
            idx = torch.tensor(order[i:i + 64])
            z = torch.cat([cls[idx], m.feature_mlp(feats[idx])], dim=1)
            loss = loss_fn(m.classifier(z), yt[idx])
            prox = sum(((p - a) ** 2).sum() for p, a in zip(params, anchors))
            (loss + 1e-3 * PROX * prox).backward()
            opt.step(); opt.zero_grad()
    m.eval()
    return {k: v.detach().clone() for k, v in m.state_dict().items() if k.startswith(HEAD_PREFIXES)}


def judge(rep_base: Dict[str, Dict], rep_cand: Dict[str, Dict], org_base: Optional[Dict], org_cand: Optional[Dict]) -> Tuple[bool, List[str]]:
    """Apply GATE. Returns (accepted, reasons)."""
    reasons, improved = [], []
    for name, b in rep_base.items():
        c = rep_cand[name]
        if b["auc"] is not None and c["auc"] is not None and c["auc"] < b["auc"] - GATE["max_auc_drop"]:
            reasons.append(f"{name}: AUC fell {b['auc']:.4f} -> {c['auc']:.4f}")
        if c["fpr"] > b["fpr"] + GATE["max_fpr_rise"]:
            reasons.append(f"{name}: false-positive rate rose {b['fpr']:.1%} -> {c['fpr']:.1%}")
        if c["recall"] < b["recall"] - GATE["max_recall_drop"]:
            reasons.append(f"{name}: recall fell {b['recall']:.1%} -> {c['recall']:.1%}")
        if c["f1"] >= b["f1"] + GATE["min_gain"]:
            improved.append(f"{name} F1 {b['f1']:.3f} -> {c['f1']:.3f}")
        if b["auc"] is not None and c["auc"] is not None and c["auc"] >= b["auc"] + GATE["min_gain"] / 2:
            improved.append(f"{name} AUC {b['auc']:.4f} -> {c['auc']:.4f}")
    if org_base and org_cand:
        if org_cand["f1"] >= org_base["f1"] + GATE["min_gain"] * 4:
            improved.append(f"organisation hold-out F1 {org_base['f1']:.3f} -> {org_cand['f1']:.3f}")
        if org_cand["recall"] < org_base["recall"] - 0.05 or org_cand["fpr"] > org_base["fpr"] + 0.05:
            reasons.append("organisation hold-out got worse")
    if reasons:
        return False, reasons
    if not improved:
        return False, ["no measurable improvement over the current model"]
    return True, improved


def train_org_heads(urls: List[str], labels: List[int], base_heads: Optional[Dict[str, Any]] = None) -> Dict[str, Any]:
    """Train candidate heads from an organisation's verified URLs and gate them. Pure compute: no DB.

    Returns {"trained", "accepted", "reasons", "report", "heads"}."""
    y = np.array(labels, dtype=int)
    n_pos, n_neg = int((y == 1).sum()), int((y == 0).sum())
    report: Dict[str, Any] = {"method": "head_finetune", "samples": int(len(y)), "positives": n_pos, "negatives": n_neg}
    if len(y) < MIN_SAMPLES or n_pos < MIN_PER_CLASS or n_neg < MIN_PER_CLASS:
        report["trained"] = False
        return {"trained": False, "accepted": False, "reasons": [
            f"Need at least {MIN_SAMPLES} verified URLs with {MIN_PER_CLASS} of each kind (have {n_pos} phishing / {n_neg} safe)."],
            "report": report, "heads": None}

    bb = get_backbone()
    base = base_heads or bb.base_heads

    # stratified 70/30 split of the organisation's own data: the 30% is never trained on
    rng = random.Random(5)
    idx_pos = [i for i in range(len(y)) if y[i] == 1]; idx_neg = [i for i in range(len(y)) if y[i] == 0]
    rng.shuffle(idx_pos); rng.shuffle(idx_neg)
    k_pos, k_neg = max(1, int(len(idx_pos) * 0.3)), max(1, int(len(idx_neg) * 0.3))
    hold = idx_pos[:k_pos] + idx_neg[:k_neg]
    train = idx_pos[k_pos:] + idx_neg[k_neg:]

    cls, feats = bb.embed(urls)
    r_urls, r_labels = replay_sample()
    if r_urls:
        r_cls, r_feats = bb.embed(r_urls)
        tr_cls = bb.torch.cat([cls[train], r_cls]); tr_feats = bb.torch.cat([feats[train], r_feats])
        tr_y = np.concatenate([y[train], np.array(r_labels)])
    else:
        tr_cls, tr_feats, tr_y = cls[train], feats[train], y[train]
        report["warning"] = "Reference data not available on this server: trained without replay (stricter hold-out required)."

    heads = _train_heads(bb, tr_cls, tr_feats, tr_y, base)

    org_base = metrics(y[hold], bb.p_phish(base, cls[hold], feats[hold]))
    org_cand = metrics(y[hold], bb.p_phish(heads, cls[hold], feats[hold]))
    bench = benchmark_embeddings(bb)
    rep_base = {n: metrics(d["y"], bb.p_phish(base, d["cls"], d["feats"])) for n, d in bench.items()}
    rep_cand = {n: metrics(d["y"], bb.p_phish(heads, d["cls"], d["feats"])) for n, d in bench.items()}

    accepted, reasons = judge(rep_base, rep_cand, org_base, org_cand)
    if not bench:
        accepted, reasons = False, ["No reference benchmark available on this server, so the update cannot be validated."]
    report.update({"trained": True, "replay_samples": len(r_urls), "holdout": len(hold), "org_holdout": {"base": org_base, "candidate": org_cand},
                   "reference": {"base": rep_base, "candidate": rep_cand}, "gate": GATE,
                   "accepted": accepted, "reasons": reasons})
    return {"trained": True, "accepted": accepted, "reasons": reasons, "report": report, "heads": heads}


def evaluate_submission(cand_heads: Dict[str, Any], current_heads: Optional[Dict[str, Any]]) -> Dict[str, Any]:
    """Vendor-side gate: candidate heads vs the current baseline on the vendor's benchmark."""
    bb = get_backbone()
    base = current_heads or bb.base_heads
    bench = benchmark_embeddings(bb)
    if not bench:
        return {"accepted": False, "reasons": ["Vendor benchmark data is not available on this server."], "base": {}, "candidate": {}}
    rep_base = {n: metrics(d["y"], bb.p_phish(base, d["cls"], d["feats"])) for n, d in bench.items()}
    rep_cand = {n: metrics(d["y"], bb.p_phish(cand_heads, d["cls"], d["feats"])) for n, d in bench.items()}
    accepted, reasons = judge(rep_base, rep_cand, None, None)
    return {"accepted": accepted, "reasons": reasons, "base": rep_base, "candidate": rep_cand, "gate": GATE}


# ═════════════════════════════════════════════════════════════════════════════════════
# Package (de)serialisation
# ═════════════════════════════════════════════════════════════════════════════════════

def save_heads(path: Path, heads: Dict[str, Any], meta: Dict[str, Any]) -> str:
    import torch
    path.parent.mkdir(parents=True, exist_ok=True)
    torch.save({"format": FORMAT, "meta": meta, "heads": {k: v.cpu() for k, v in heads.items()}}, str(path))
    return sha256_file(path)


def load_heads(path_or_bytes) -> Dict[str, Any]:
    """Load and VALIDATE a heads package (shape-checked against the base heads; no pickled code)."""
    import torch
    bb = get_backbone()
    if isinstance(path_or_bytes, (bytes, bytearray)):
        blob = torch.load(io.BytesIO(path_or_bytes), map_location="cpu", weights_only=True)
    else:
        blob = torch.load(str(path_or_bytes), map_location="cpu", weights_only=True)
    if not isinstance(blob, dict) or blob.get("format") != FORMAT or not isinstance(blob.get("heads"), dict):
        raise ValueError("Not an AegisOne heads package")
    heads = blob["heads"]
    if set(heads) != set(bb.base_heads):
        raise ValueError("Heads package does not match the model architecture")
    for k, v in heads.items():
        if tuple(v.shape) != tuple(bb.base_heads[k].shape) or not bb.torch.isfinite(v).all():
            raise ValueError(f"Invalid tensor {k}")
    return {k: v.float() for k, v in heads.items()}


def sha256_file(path: Path) -> str:
    h = hashlib.sha256()
    with open(path, "rb") as f:
        for chunk in iter(lambda: f.read(1 << 20), b""):
            h.update(chunk)
    return h.hexdigest()
