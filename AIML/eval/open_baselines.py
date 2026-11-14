"""
Open-source baselines on the SAME URLs as AegisOne, plus "what if we add it" fusion tests.

Why: our own numbers say little without rivals scored on identical data with an identical rule. Every model here sees
  - the same genuine URLs (popular-site deep links + ordinary long-tail web pages, AIML/eval/data/legit_*.csv), and
  - the same phishing URLs (OpenPhish feeds fetched after every training file was frozen; see eval_url.py),
and is judged the same way: ROC-AUC, share caught when only 1% / 0.1% of genuine URLs may be flagged (threshold set per
model on the pooled genuine URLs, so a model with a different score scale is not punished), and AP at a 1% base rate.

Fusion: for each open model we also ask "does AegisOne + this model beat AegisOne alone?" using a logistic stacker on
(AegisOne final score, open-model score) evaluated with 5-fold cross-validation (out-of-fold only), plus the plain
max / mean of the two. A model is only worth adding if the fused result is better at the same false-alarm budget.

Stages (so the offline AegisOne weights and the online Hugging Face download never share one process):
  python -m AIML.eval.open_baselines ours                      # AegisOne scores -> cache  (set HF_HUB_OFFLINE=1)
  python -m AIML.eval.open_baselines open [--models a,b]       # open-model scores -> cache (needs network)
  python -m AIML.eval.open_baselines report --tag <name>       # tables, fusion, JSON + markdown in AIML/eval/results

Licences are checked per model (see REGISTRY). Hugging Face is always called with token=False: a stale token in the
environment turns public repositories into 401 errors.
"""
import argparse
import json
import sys
import time
from pathlib import Path

import numpy as np
import pandas as pd

ROOT = Path(__file__).resolve().parents[2]
sys.path.insert(0, str(ROOT))
DATA = ROOT / "AIML/eval/data"
CACHE = ROOT / "AIML/eval/cache"
OUT = ROOT / "AIML/eval/results"
CACHE.mkdir(exist_ok=True)
OUT.mkdir(exist_ok=True)

# repo id -> (licence, index of the "bad" class, what it was trained to find)
REGISTRY = {
    "ealvaradob/bert-finetuned-phishing": ("apache-2.0", 1, "BERT-large; phishing URLs, e-mails, SMS and sites"),
    "kmack/malicious-url-detection": ("apache-2.0", 1, "DistilBERT; malicious URLs (label MALWARE)"),
    "imanoop7/bert-phishing-detector": ("mit", 1, "BERT-base; URLs (label Not Safe)"),
}
PHISH_FILES = ["phish_fresh.csv", "phish_fresh_2026-11-14.csv"]


def load_sets(n_pop=2000, n_web=2000):
    legit = {}
    for name, n in (("legit_popular", n_pop), ("legit_web", n_web)):
        d = pd.read_csv(DATA / f"{name}.csv")
        legit[name] = d.sample(min(n, len(d)), random_state=3)["url"].tolist()   # same sample as eval_url.py
    phish = []
    for f in PHISH_FILES:
        p = DATA / f
        if p.exists():
            phish += pd.read_csv(p)["url"].tolist()
    phish = list(dict.fromkeys(phish))
    return legit, phish


def all_urls():
    legit, phish = load_sets()
    return legit, phish, [u for v in legit.values() for u in v] + phish


def _load(path):
    return json.loads(path.read_text()) if path.exists() else {}


# ── stage 1: AegisOne ───────────────────────────────────────────────────────────────────────────────────────
def stage_ours():
    from api.services import model_orchestrator as mo
    mo.load_all_models()
    path = CACHE / "ours_url.json"
    cache = _load(path)
    _, _, urls = all_urls()
    t0 = time.time()
    for i, u in enumerate(urls):
        if u in cache:
            continue
        try:
            r = mo._predict_url_sync(u)
            cache[u] = {"final": float(r.get("phishing_probability") or 0.0),
                        "neural": float((r.get("evidence") or {}).get("model_malicious_probability", float("nan")))}
        except Exception:
            cache[u] = {"final": float("nan"), "neural": float("nan")}
        if (i + 1) % 500 == 0:
            print(f"  ours {i + 1}/{len(urls)} {time.time() - t0:.0f}s", flush=True)
            path.write_text(json.dumps(cache))
    path.write_text(json.dumps(cache))
    print("ours done:", len(cache))


# ── stage 2: open-source models ─────────────────────────────────────────────────────────────────────────────
def stage_open(models):
    import torch
    from transformers import AutoModelForSequenceClassification, AutoTokenizer
    _, _, urls = all_urls()
    torch.set_num_threads(max(1, (torch.get_num_threads() or 4)))
    for rid in models:
        lic, bad, note = REGISTRY[rid]
        path = CACHE / ("open_url_" + rid.replace("/", "__") + ".json")
        cache = _load(path)
        todo = [u for u in urls if u not in cache]
        if not todo:
            print(rid, "cached")
            continue
        print(f"{rid} ({lic}) - {note}: scoring {len(todo)} URLs", flush=True)
        tok = AutoTokenizer.from_pretrained(rid, token=False)
        model = AutoModelForSequenceClassification.from_pretrained(rid, token=False).eval()
        t0 = time.time()
        for i in range(0, len(todo), 32):
            batch = todo[i:i + 32]
            enc = tok(batch, truncation=True, max_length=128, padding=True, return_tensors="pt")
            with torch.no_grad():
                p = torch.softmax(model(**enc).logits, dim=-1)[:, bad].tolist()
            for u, s in zip(batch, p):
                cache[u] = float(s)
            if (i // 32) % 20 == 0:
                print(f"  {i + len(batch)}/{len(todo)} {time.time() - t0:.0f}s", flush=True)
                path.write_text(json.dumps(cache))
        path.write_text(json.dumps(cache))
        del model


# ── stage 3: report ─────────────────────────────────────────────────────────────────────────────────────────
def tpr_at_fpr(neg, pos, fpr):
    neg = np.sort(neg)
    k = int(np.ceil(len(neg) * (1 - fpr))) - 1
    th = neg[min(max(k, 0), len(neg) - 1)]
    return float(np.mean(pos > th)), float(th)


def ap_at_base_rate(neg, pos, base=0.01):
    scores = np.concatenate([neg, pos])
    y = np.concatenate([np.zeros(len(neg)), np.ones(len(pos))])
    w = np.concatenate([np.full(len(neg), (1 - base) / len(neg)), np.full(len(pos), base / len(pos))])
    o = np.argsort(-scores, kind="stable")
    y, w = y[o], w[o]
    tp, fp = np.cumsum(w * y), np.cumsum(w * (1 - y))
    prec = tp / np.maximum(tp + fp, 1e-12)
    rec = tp / max(w[y == 1].sum(), 1e-12)
    return float(np.sum(prec * np.diff(np.concatenate([[0], rec]))))


def metrics(neg, pos):
    from sklearn.metrics import roc_auc_score
    return {"auc": float(roc_auc_score([0] * len(neg) + [1] * len(pos), list(neg) + list(pos))),
            "tpr_1pct": tpr_at_fpr(neg, pos, 0.01)[0], "tpr_0.1pct": tpr_at_fpr(neg, pos, 0.001)[0],
            "ap_1pct_base": ap_at_base_rate(neg, pos, 0.01)}


def _logit(p):
    p = np.clip(p, 1e-4, 1 - 1e-4)
    return np.log(p / (1 - p))


def stacked_oof(x, y, seed=0):
    """Out-of-fold logistic stacking probabilities (5 folds, stratified)."""
    from sklearn.linear_model import LogisticRegression
    from sklearn.model_selection import StratifiedKFold
    oof = np.zeros(len(y))
    for tr, te in StratifiedKFold(5, shuffle=True, random_state=seed).split(x, y):
        m = LogisticRegression(C=1.0, max_iter=1000).fit(x[tr], y[tr])
        oof[te] = m.predict_proba(x[te])[:, 1]
    return oof


def rank01(v):
    return pd.Series(v).rank(pct=True).to_numpy()


def stage_report(tag):
    legit, phish, urls = all_urls()
    ours = _load(CACHE / "ours_url.json")
    n_leg = sum(len(v) for v in legit.values())
    leg_urls = [u for v in legit.values() for u in v]
    y = np.array([0] * n_leg + [1] * len(phish))
    allu = leg_urls + phish
    cols = {"AegisOne final": np.array([ours.get(u, {}).get("final", np.nan) for u in allu]),
            "AegisOne neural only": np.array([ours.get(u, {}).get("neural", np.nan) for u in allu])}
    for rid in REGISTRY:
        c = _load(CACHE / ("open_url_" + rid.replace("/", "__") + ".json"))
        if c:
            cols[rid] = np.array([c.get(u, np.nan) for u in allu])
    # keep rows where every column has a score
    ok = np.all([~np.isnan(v) for v in cols.values()], axis=0)
    y_ok = y[ok]
    cols = {k: v[ok] for k, v in cols.items()}
    n_neg, n_pos = int((y_ok == 0).sum()), int((y_ok == 1).sum())

    res = {"tag": tag, "n_genuine": n_neg, "n_phishing": n_pos, "models": {}, "fusion": {}, "licences": {k: v[0] for k, v in REGISTRY.items()}}
    for name, s in cols.items():
        res["models"][name] = metrics(s[y_ok == 0], s[y_ok == 1])

    ours_final = cols["AegisOne final"]
    for rid in REGISTRY:
        if rid not in cols:
            continue
        o = cols[rid]
        x = np.column_stack([_logit(ours_final), _logit(o)])
        fused = {"stacked (logistic, 5-fold out-of-fold)": stacked_oof(x, y_ok),
                 "max of the two": np.maximum(ours_final, o),
                 "mean of the two ranks": (rank01(ours_final) + rank01(o)) / 2}
        res["fusion"][rid] = {k: metrics(v[y_ok == 0], v[y_ok == 1]) for k, v in fused.items()}

    (OUT / f"open_baselines_{tag}.json").write_text(json.dumps(res, indent=2))
    f = lambda m: f"AUC {m['auc']:.3f} | caught @1% FPR {m['tpr_1pct']:.1%} | @0.1% {m['tpr_0.1pct']:.1%} | AP@1% {m['ap_1pct_base']:.3f}"
    md = [f"# Open-source baselines vs AegisOne - {tag}", "",
          f"Same data for every model: {n_neg} genuine URLs (popular-site deep links + long-tail web) and {n_pos} fresh OpenPhish URLs. "
          "Thresholds are set per model at the stated false-alarm budget on the pooled genuine URLs.", "",
          "## Each model alone", ""]
    md += [f"- **{k}** ({REGISTRY[k][0] if k in REGISTRY else 'ours'}): {f(m)}" for k, m in res["models"].items()]
    md += ["", "## Does adding the open model to AegisOne help?", ""]
    base = res["models"]["AegisOne final"]
    md.append(f"Baseline - AegisOne final alone: {f(base)}")
    for rid, d in res["fusion"].items():
        md += ["", f"**+ {rid}**"]
        for k, m in d.items():
            delta = (m["tpr_1pct"] - base["tpr_1pct"]) * 100
            md.append(f"- {k}: {f(m)}  (caught @1% FPR {delta:+.1f} points)")
    (OUT / f"open_baselines_{tag}.md").write_text("\n".join(md), encoding="utf-8")
    print("\n".join(md))


if __name__ == "__main__":
    ap = argparse.ArgumentParser()
    ap.add_argument("stage", choices=["ours", "open", "report"])
    ap.add_argument("--models", default=",".join(REGISTRY))
    ap.add_argument("--tag", default="run")
    a = ap.parse_args()
    if a.stage == "ours":
        stage_ours()
    elif a.stage == "open":
        stage_open([m for m in a.models.split(",") if m])
    else:
        stage_report(a.tag)
