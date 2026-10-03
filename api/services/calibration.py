"""
AegisOne API — Local Learning Layer (calibration adapter)
==========================================================
How an organisation's verified feedback changes detection WITHOUT touching the base models.

The base models (URL / email / text / image) are never modified, retrained or overwritten.
What an organisation "learns" is a tiny correction applied AFTER the base model has produced its
score:

        final = squash( a * logit(base_score) + b )          (then clamped to base +/- MAX_SHIFT)

`a` and `b` are two numbers fitted on the organisation's verified incidents (base score at the time
vs. what the admin confirmed it really was). They are strongly regularised toward "no change"
(a=1, b=0), bounded, and the result can never move a score by more than MAX_SHIFT. Switching the
adapter off returns the exact base model behaviour instantly - nothing to restore.

An adapter is only activated when it proves itself on data it was NOT fitted on
(stratified cross-validation) and compares favourably with the base model on the same samples.
"""
import os
import json
import math
import logging
from typing import Dict, Any, List, Tuple, Optional

import numpy as np

logger = logging.getLogger("aegisone.calibration")

MIN_TOTAL = int(os.getenv("AEGIS_MIN_TRAIN_SAMPLES", "20"))
MIN_PER_CLASS = int(os.getenv("AEGIS_MIN_TRAIN_PER_CLASS", "5"))
MAX_SHIFT = 0.25            # a calibrated score may never differ from the base score by more than this
FOLDS = 5
THRESHOLD = 0.5

# model_type -> {"a": float, "b": float, "version": str, "samples": int}
REGISTRY: Dict[str, Dict[str, Any]] = {}


# ── maths ──────────────────────────────────────────────────────────────────────────────
def _logit(p: np.ndarray) -> np.ndarray:
    p = np.clip(p, 1e-4, 1 - 1e-4)
    return np.log(p / (1 - p))


def _sigmoid(z: np.ndarray) -> np.ndarray:
    return 1.0 / (1.0 + np.exp(-np.clip(z, -30, 30)))


def squash(a: float, b: float, p: np.ndarray) -> np.ndarray:
    q = _sigmoid(a * _logit(p) + b)
    return np.clip(q, p - MAX_SHIFT, p + MAX_SHIFT).clip(0.0, 1.0)


def fit_platt(p: np.ndarray, y: np.ndarray, l2: float = 2.0, iters: int = 300) -> Tuple[float, float]:
    """Regularised logistic fit of (a, b), pulled toward (1, 0) and bounded."""
    x = _logit(p)
    a, b = 1.0, 0.0
    lr = 0.05
    for _ in range(iters):
        z = a * x + b
        q = _sigmoid(z)
        n = max(1, len(y))
        ga = float(np.mean((q - y) * x)) + (l2 / n) * (a - 1.0)
        gb = float(np.mean(q - y)) + (l2 / n) * b
        a -= lr * ga
        b -= lr * gb
        a = min(1.5, max(0.5, a))
        b = min(1.5, max(-1.5, b))
    return float(a), float(b)


def _metrics(y: np.ndarray, p: np.ndarray) -> Dict[str, float]:
    pred = (p >= THRESHOLD).astype(int)
    tp = int(((pred == 1) & (y == 1)).sum()); tn = int(((pred == 0) & (y == 0)).sum())
    fp = int(((pred == 1) & (y == 0)).sum()); fn = int(((pred == 0) & (y == 1)).sum())
    acc = (tp + tn) / max(1, len(y))
    prec = tp / (tp + fp) if (tp + fp) else 0.0
    rec = tp / (tp + fn) if (tp + fn) else 0.0
    f1 = 2 * prec * rec / (prec + rec) if (prec + rec) else 0.0
    pc = np.clip(p, 1e-4, 1 - 1e-4)
    ll = float(-np.mean(y * np.log(pc) + (1 - y) * np.log(1 - pc)))
    return {
        "accuracy": round(acc, 4), "precision": round(prec, 4), "recall": round(rec, 4), "f1": round(f1, 4),
        "fpr": round(fp / (fp + tn), 4) if (fp + tn) else 0.0,
        "fnr": round(fn / (fn + tp), 4) if (fn + tp) else 0.0,
        "log_loss": round(ll, 4),
    }


def _folds(y: np.ndarray, k: int) -> List[np.ndarray]:
    """Deterministic stratified folds (no shuffling randomness between runs)."""
    idx_pos = np.where(y == 1)[0]; idx_neg = np.where(y == 0)[0]
    folds: List[List[int]] = [[] for _ in range(k)]
    for group in (idx_pos, idx_neg):
        for i, ix in enumerate(group):
            folds[i % k].append(int(ix))
    return [np.array(f, dtype=int) for f in folds if f]


# ── training / evaluation ───────────────────────────────────────────────────────────────
def extract_samples(candidates: List[Any]) -> Tuple[np.ndarray, np.ndarray, int]:
    """(base_score 0..1, label 1=phishing, skipped_count). A sample needs the base model's score
    at detection time - reports filed before that was recorded are skipped, not guessed."""
    ps, ys, skipped = [], [], 0
    for c in candidates:
        data = c.sample_data if isinstance(c.sample_data, dict) else {}
        rs = data.get("risk_score")
        if rs is None or c.label not in ("phishing", "benign"):
            skipped += 1
            continue
        ps.append(min(1.0, max(0.0, float(rs) / 100.0)))
        ys.append(1 if c.label == "phishing" else 0)
    return np.array(ps, dtype=float), np.array(ys, dtype=int), skipped


def readiness(counts_phishing: int, counts_benign: int) -> Dict[str, Any]:
    total = counts_phishing + counts_benign
    return {
        "usable": total, "phishing": counts_phishing, "benign": counts_benign,
        "needed_total": MIN_TOTAL, "needed_each": MIN_PER_CLASS,
        "ready": total >= MIN_TOTAL and counts_phishing >= MIN_PER_CLASS and counts_benign >= MIN_PER_CLASS,
    }


def train_and_validate(candidates: List[Any]) -> Dict[str, Any]:
    """Fit the adapter and validate it on held-out folds against the unmodified base model."""
    p, y, skipped = extract_samples(candidates)
    n_pos, n_neg = int((y == 1).sum()), int((y == 0).sum())
    rd = readiness(n_pos, n_neg)
    report: Dict[str, Any] = {
        "method": "calibration_adapter",
        "validation": f"stratified {FOLDS}-fold cross-validation (every score is predicted by an adapter that never saw that sample)",
        "samples": int(len(y)), "positives": n_pos, "negatives": n_neg, "skipped_without_score": skipped,
        "readiness": rd, "base_model_modified": False, "max_shift": MAX_SHIFT,
    }
    if not rd["ready"]:
        report["trained"] = False
        return report

    oof = np.zeros(len(y))
    for held in _folds(y, FOLDS):
        train_mask = np.ones(len(y), dtype=bool); train_mask[held] = False
        if len(set(y[train_mask])) < 2:
            oof[held] = p[held]
            continue
        a_k, b_k = fit_platt(p[train_mask], y[train_mask])
        oof[held] = squash(a_k, b_k, p[held])

    a, b = fit_platt(p, y)
    base_m = _metrics(y, p)
    cand_m = _metrics(y, oof)
    report.update({
        "trained": True, "a": round(a, 4), "b": round(b, 4),
        "base": base_m, "candidate": cand_m,
        # top-level numbers (the dashboard's existing fields) describe the CANDIDATE on held-out data
        **{k: cand_m[k] for k in ("accuracy", "precision", "recall", "f1", "fpr", "fnr")},
        "sample_count": int(len(y)), "weights_changed": True,
    })
    return report


def evaluate(report: Dict[str, Any]) -> Tuple[bool, str]:
    """Conservative acceptance: never worse than the base model on held-out data, and clearly better
    somewhere. Small or one-sided data is refused outright."""
    rd = report.get("readiness", {})
    if not rd.get("ready"):
        return False, (f"Not enough verified examples yet: {rd.get('usable', 0)} usable "
                       f"({rd.get('phishing', 0)} phishing, {rd.get('benign', 0)} safe). Need at least "
                       f"{rd.get('needed_total', MIN_TOTAL)} in total with at least {rd.get('needed_each', MIN_PER_CLASS)} of each kind.")
    base, cand = report["base"], report["candidate"]
    if cand["fpr"] > base["fpr"] + 0.02:
        return False, f"Would raise false alarms ({cand['fpr']:.1%} vs {base['fpr']:.1%} for the base model)."
    if cand["fnr"] > base["fnr"] + 0.02:
        return False, f"Would miss more real threats ({cand['fnr']:.1%} vs {base['fnr']:.1%} for the base model)."
    if cand["f1"] < base["f1"] - 0.01:
        return False, f"F1 on held-out data is lower than the base model ({cand['f1']:.1%} vs {base['f1']:.1%})."
    # Merely re-scaling confidence is not a reason to change a security model: the verdicts themselves
    # (accuracy or F1) must get better on held-out data, with probabilities no worse calibrated.
    if cand["log_loss"] > base["log_loss"] * 1.02:
        return False, "Predicted probabilities would become less reliable than the base model's."
    n = int(report.get("samples", 0))
    gained = round((cand["accuracy"] - base["accuracy"]) * n)       # extra correct verdicts on unseen data
    needed = max(3, math.ceil(0.05 * n))                              # a one-off lucky sample is not learning
    if gained < needed:
        return False, (f"Only {max(gained, 0)} more correct verdict(s) than the base model on held-out data "
                       f"(needs at least {needed}), so the base model stays as is.")
    return True, "Better than the base model on data it was not fitted on, with no increase in false alarms or misses."


# ── runtime registry ──────────────────────────────────────────────────────────────────────
def set_adapter(model_type: str, a: float, b: float, version: str, samples: int) -> None:
    REGISTRY[model_type] = {"a": float(a), "b": float(b), "version": version, "samples": int(samples)}
    logger.info("Local learning adapter ACTIVE for %s model: %s (a=%.3f b=%.3f, %d samples)", model_type, version, a, b, samples)


def clear_adapter(model_type: str) -> None:
    if REGISTRY.pop(model_type, None) is not None:
        logger.info("Local learning adapter REMOVED for %s model - base model behaviour restored", model_type)


def calibrate_result(model_type: str, result: Any) -> Any:
    """Apply the active adapter (if any) to a model result dict. Unchanged when none is active."""
    ad = REGISTRY.get(model_type)
    if not ad or not isinstance(result, dict) or "error" in result:
        return result
    prob = result.get("phishing_probability")
    if not isinstance(prob, (int, float)):
        return result
    new = float(squash(ad["a"], ad["b"], np.array([float(prob)]))[0])
    if abs(new - prob) < 1e-6:
        return result
    out = dict(result)
    out["base_phishing_probability"] = round(float(prob), 4)
    out["phishing_probability"] = round(new, 4)
    if "prediction" in out:
        out["prediction"] = "phishing" if new >= THRESHOLD else "legitimate"
    out["local_adapter"] = ad["version"]
    return out


def load_from_artifact(model_type: str, artifact_dir: str, version: str) -> bool:
    path = os.path.join(artifact_dir, "calibration.json")
    if not os.path.exists(path):
        return False
    with open(path, "r", encoding="utf-8") as f:
        c = json.load(f)
    set_adapter(model_type, c["a"], c["b"], version, c.get("samples", 0))
    return True


async def restore_active_calibrations() -> None:
    """On startup, re-apply each organisation's active adapter (it used to be lost on every restart,
    while the dashboard still claimed the version was live). Placeholder versions from the earlier
    stub trainer - which never changed anything - are retired honestly."""
    from sqlalchemy.future import select
    from api.database.db import get_background_db
    from api.database.models import ModelVersion
    db = await get_background_db()
    try:
        res = await db.execute(select(ModelVersion).where(ModelVersion.is_production == True).order_by(ModelVersion.created_at.desc()))  # noqa: E712
        seen = set()
        retired = 0
        for mv in res.scalars().all():
            if mv.is_global_base or mv.model_type in seen:
                continue
            if load_from_artifact(mv.model_type, mv.artifact_path or "", mv.version_tag):
                seen.add(mv.model_type)
            else:
                mv.is_production = False
                mv.is_active = False
                retired += 1
        if retired:
            await db.commit()
            logger.warning("Retired %d placeholder model version(s) that never contained a real adapter", retired)
    except Exception as e:
        logger.warning("Could not restore local learning adapters: %s", e)
    finally:
        await db.close()
