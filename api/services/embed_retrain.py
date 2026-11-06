"""
AegisOne — organisation retraining of the e-mail and text/SMS detectors (module 8.11)
=====================================================================================
The v2 e-mail and text detectors are a frozen sentence-embedding backbone plus a small logistic head
(AIML/embed_head.py). Retraining re-fits ONLY the head, on the server, from the organisation's verified incidents:

  * training data = verified messages (TrainingCandidate.sample_data["message"], personal data already redacted)
    weighted 3x + a replay sample of the shipped training data, so a few dozen examples steer the head without
    making it forget everything else;
  * a proximal penalty keeps the new weights near the shipped ones;
  * the candidate's WARN / BLOCK thresholds are re-matched so it flags the same share of the reference set's
    legitimate messages as the current head (an equal false-alarm budget);
  * it is then judged on the frozen reference sets shipped with the head (never seen in training) against the
    current head with the same tolerances as the URL heads (api/services/weight_trainer.GATE): no AUC drop over
    0.002, no rise in false alarms over 0.5 points, no recall drop over 0.5 points at that budget, and a measurable
    gain on the organisation's own held-out examples (5-fold cross-validation). Otherwise nothing changes.
    Tested in api/tests/test_embed_retrain.py: redundant and label-poisoned updates are refused, an update that
    teaches a new kind of lure is accepted.

The result is a small JSON head (no raw mail) that can be activated, reverted, or submitted to the vendor hub.
"""
import json
import logging
from pathlib import Path
from typing import Any, Dict, List, Optional, Tuple

import numpy as np

logger = logging.getLogger("aegisone.embed_retrain")
BASE_DIR = Path(__file__).resolve().parents[2]
PATHS = {
    "email": BASE_DIR / "AIML" / "email" / "v2",
    "text": BASE_DIR / "AIML" / "text_general" / "v2",
}
MIN_TOTAL, MIN_PER_CLASS = 20, 5
ORG_WEIGHT = 2.0
PROX = 50.0


def _featurizer(kind):
    if kind == "email":
        from AIML.email.features_v2 import email_features
        return email_features
    from AIML.text_general.features_v2 import text_features
    return text_features


def load_base(kind: str):
    from AIML.embed_head import load
    return load(PATHS[kind] / f"{kind}_head.json", _featurizer(kind))


def load_reference(kind: str) -> Dict[str, np.ndarray]:
    z = np.load(PATHS[kind] / f"{kind}_reference.npz")
    return {k: z[k] for k in z.files}


def samples_from_candidates(kind: str, candidates: List[Any]) -> Tuple[List[Tuple[str, str, str]], np.ndarray, int]:
    """(messages as (sender, subject, body), labels, skipped). Candidates without a stored message are skipped."""
    msgs, ys, skipped = [], [], 0
    for c in candidates:
        d = c.sample_data if isinstance(c.sample_data, dict) else {}
        m = d.get("message") or {}
        body = (m.get("body") or "").strip()
        subject = (m.get("subject") or "").strip()
        if c.label not in ("phishing", "benign") or len(body) + len(subject) < 15:
            skipped += 1
            continue
        msgs.append((m.get("sender") or "", subject, body))
        ys.append(1 if c.label == "phishing" else 0)
    return msgs, np.array(ys, dtype=int), skipped


def design(head, kind: str, msgs) -> np.ndarray:
    feat = _featurizer(kind)
    if kind == "email":
        texts = [f"{s}\n{b}"[:3000] for _, s, b in msgs]
        F = np.stack([feat(a, s, b) for a, s, b in msgs])
    else:
        texts = [b for _, _, b in msgs]
        F = np.stack([feat(b) for _, _, b in msgs])
    return head.design(texts, F)


def _metrics(head_like, X: np.ndarray, y: np.ndarray, warn: Optional[float] = None) -> Dict[str, float]:
    """AUC, plus recall / false alarms / F1 at the head's OWN warn threshold (or `warn` when given)."""
    from sklearn.metrics import roc_auc_score
    warn = float(head_like.thresholds.get("warn", 0.5)) if warn is None else warn
    p = head_like.proba_from_design(X)
    pos, neg = p[y == 1], p[y == 0]
    tp, fp = float((pos >= warn).sum()), float((neg >= warn).sum())
    prec = tp / max(tp + fp, 1.0)
    rec = tp / max(len(pos), 1)
    return {"n": int(len(y)), "auc": float(roc_auc_score(y, p)) if len(set(y)) > 1 else float("nan"),
            "recall": rec, "fpr": fp / max(len(neg), 1), "f1": 2 * prec * rec / max(prec + rec, 1e-9)}


def _with_weights(base, coef, b, X_legit: Optional[np.ndarray] = None):
    """A head with new weights. With X_legit (legitimate examples from the TRAINING distribution, e.g. the replay
    sample) its thresholds and risk map are re-derived so that it flags the same share of them as the base head does
    at every operating point: a retrained head keeps the organisation's false-alarm budget instead of drifting."""
    from AIML.embed_head import EmbedHead, threshold_at_fpr
    spec = dict(base.spec)
    spec["coef"], spec["intercept"] = [float(x) for x in coef], float(b)
    h = EmbedHead(spec, base.featurize)
    h._bb = base._bb
    if X_legit is not None and len(X_legit) >= 50 and base.spec.get("risk_map"):
        pb, pc = base.proba_from_design(X_legit), h.proba_from_design(X_legit)
        xs_b, ys = base.spec["risk_map"]
        xs = [0.0]
        for t_b in xs_b[1:-1]:
            share = max(float(np.mean(pb >= t_b)), 1.0 / len(pb))        # what the base flags at this anchor
            xs.append(max(threshold_at_fpr(pc, share), xs[-1] + 1e-4))
        xs.append(1.0)
        spec["risk_map"] = [xs, list(ys)]
        th = dict(base.thresholds)
        th.update({"suspicious": xs[1], "warn": xs[2], "block": xs[3], "rematched_on": int(len(pb))})
        spec["thresholds"] = th
        h = EmbedHead(spec, base.featurize)
        h._bb = base._bb
    return h


def _fit(base, X_org, y_org, X_rep, y_rep):
    from AIML.embed_head import fit_logistic
    X = np.vstack([X_org, X_rep])
    y = np.concatenate([y_org, y_rep]).astype(np.float64)
    w = np.concatenate([np.full(len(y_org), ORG_WEIGHT), np.ones(len(y_rep))])
    Xs = (X - base.mean) / base.std
    return fit_logistic(Xs, y, l2=1.0, w0=base.coef, b0=base.b, prox=PROX * len(y) / 100.0, sample_weight=w, iters=250, lr=0.3)


def train_org_head(kind: str, candidates: List[Any], current=None) -> Dict[str, Any]:
    """Fit, validate and judge an organisation head. Returns a report; report["accepted"] says whether to activate."""
    from api.services.weight_trainer import GATE
    base = current or load_base(kind)
    if base is None:
        return {"accepted": False, "reason": f"No v2 {kind} detector is installed on this server."}
    msgs, y, skipped = samples_from_candidates(kind, candidates)
    n_pos, n_neg = int((y == 1).sum()), int((y == 0).sum())
    if len(y) < MIN_TOTAL or n_pos < MIN_PER_CLASS or n_neg < MIN_PER_CLASS:
        return {"accepted": False, "samples": int(len(y)), "skipped": skipped,
                "reason": f"Needs at least {MIN_TOTAL} verified messages with {MIN_PER_CLASS} of each kind (have {n_pos} phishing, {n_neg} safe)."}
    ref = load_reference(kind)
    X_org = design(base, kind, msgs)
    # Thresholds of every candidate are re-matched on the reference set's LEGITIMATE messages (today's traffic, never
    # trained on): the candidate flags the same share of them as the current head at every operating point, so the
    # comparison below is detection at an equal false-alarm budget, and the shipped thresholds keep that budget.
    X_legit = ref["X_ref"][ref["y_ref"] == 0]

    # organisation hold-out: 5-fold cross-validation, every message is judged by a head that never saw it,
    # each at its OWN warn threshold (re-matched to the base's false-alarm budget)
    rng = np.random.default_rng(7)
    folds = np.array_split(rng.permutation(len(y)), min(5, len(y)))
    flag_cand = np.zeros(len(y), dtype=bool)
    for f in folds:
        tr = np.setdiff1d(np.arange(len(y)), f)
        w, b = _fit(base, X_org[tr], y[tr], ref["X_replay"], ref["y_replay"])
        h = _with_weights(base, w, b, X_legit)
        flag_cand[f] = h.proba_from_design(X_org[f]) >= float(h.thresholds.get("warn", 0.5))
    flag_base = base.proba_from_design(X_org) >= float(base.thresholds.get("warn", 0.5))
    w, b = _fit(base, X_org, y, ref["X_replay"], ref["y_replay"])
    cand = _with_weights(base, w, b, X_legit)

    def org_m(flag):
        tp, fp = float((flag & (y == 1)).sum()), float((flag & (y == 0)).sum())
        prec, rec = tp / max(tp + fp, 1.0), tp / max(n_pos, 1)
        return {"recall": rec, "fpr": fp / max(n_neg, 1), "f1": 2 * prec * rec / max(prec + rec, 1e-9)}

    rep_base = {"reference": _metrics(base, ref["X_ref"], ref["y_ref"])}
    rep_cand = {"reference": _metrics(cand, ref["X_ref"], ref["y_ref"])}
    ob, oc = org_m(flag_base), org_m(flag_cand)
    why, ok = [], True
    rb, rc = rep_base["reference"], rep_cand["reference"]
    if rc["auc"] < rb["auc"] - GATE["max_auc_drop"]:
        ok = False
        why.append(f"reference AUC would fall {rb['auc']:.3f} -> {rc['auc']:.3f}")
    if rc["fpr"] > rb["fpr"] + GATE["max_fpr_rise"]:
        ok = False
        why.append(f"false-positive rate on the reference set would rise {rb['fpr']:.1%} -> {rc['fpr']:.1%}")
    if rc["recall"] < rb["recall"] - GATE["max_recall_drop"]:
        ok = False
        why.append(f"reference recall would fall {rb['recall']:.1%} -> {rc['recall']:.1%}")
    gain = max(oc["f1"] - ob["f1"], oc["recall"] - ob["recall"] if oc["fpr"] <= ob["fpr"] + GATE["max_fpr_rise"] else 0.0)
    if ok and gain < GATE["min_gain"]:
        ok = False
        why.append("no measurable improvement on your organisation's held-out messages")
    if ok:
        why.append(f"organisation F1 {ob['f1']:.0%} -> {oc['f1']:.0%}, recall {ob['recall']:.0%} -> {oc['recall']:.0%}; "
                   f"reference AUC {rb['auc']:.3f} -> {rc['auc']:.3f}, false alarms {rb['fpr']:.1%} -> {rc['fpr']:.1%}")
    return {"accepted": ok, "reason": "; ".join(why), "samples": int(len(y)), "skipped": skipped,
            "org_base": ob, "org_candidate": oc, "reference_base": rb, "reference_candidate": rc,
            "spec": cand.spec if ok else None}


def save_head(spec: Dict[str, Any], target_dir: Path, meta: Dict[str, Any]) -> Path:
    target_dir.mkdir(parents=True, exist_ok=True)
    spec = dict(spec)
    spec["meta"] = {**(spec.get("meta") or {}), **meta}
    p = target_dir / "head.json"
    p.write_text(json.dumps(spec))
    return p
