"""
Experiment: frozen embedding + small head for e-mail, judged on out-of-distribution data and leave-one-source-out.

  python -m AIML.eval.email_embed_experiment --backbone en --per-source 3000

Trains several heads on the same cached embeddings and prints, for each, the numbers that matter (see eval_email.py):
AUC and TPR at a fixed pooled FPR on LLM-generated modern mail and on the hand-written modern set, plus the
leave-one-source-out AUC over the legacy corpora (how much a head loses on a corpus it never saw).
Configurations:  legacy        = trained on the seven legacy corpora only
                 legacy+modern = also trained on the part of the LLM-generated set that is NOT used for evaluation
"""
import argparse
import hashlib
import json
import sys
import time
from pathlib import Path

import numpy as np
import pandas as pd

ROOT = Path(__file__).resolve().parents[2]
sys.path.insert(0, str(ROOT))
from AIML.eval.eval_email import HF, OUT, load_sets, parse_llmgen, report  # noqa: E402
from AIML.email.features_v2 import batch_features  # noqa: E402

CACHE = ROOT / "AIML/eval/cache"
CACHE.mkdir(exist_ok=True)


def text_of(subject, body):
    return f"{subject}\n{body}"[:3000]


def embed_cached(texts, kind, tag):
    key = hashlib.md5(("\x00".join(texts) + kind).encode("utf-8", "ignore")).hexdigest()[:16]
    f = CACHE / f"emb_{kind}_{tag}_{key}.npy"
    if f.exists():
        return np.load(f)
    from AIML.embed_backbone import get_backbone
    bb = get_backbone(kind, 256)
    t0 = time.time()
    e = bb.encode(texts, batch=32)
    print(f"  embedded {len(texts)} texts in {time.time() - t0:.0f}s", flush=True)
    np.save(f, e)
    return e


def build_pool(per_source, seed=5):
    tr = pd.read_parquet(HF / "seven-phishing-email-datasets/train.parquet")
    parts = []
    for name, g in tr.groupby("dataset_name"):
        k = per_source // 2
        a, b = g[g.label == 1], g[g.label == 0]
        parts.append(pd.concat([a.sample(min(k, len(a)), random_state=seed), b.sample(min(k, len(b)), random_state=seed)]))
    d = pd.concat(parts)
    return pd.DataFrame({"src": d.dataset_name.values, "sender": d.sender.fillna("").astype(str).values, "subject": d.subject.fillna("").astype(str).values,
                         "body": d.text.fillna("").astype(str).str.slice(0, 4000).values, "label": d.label.values})


def modern_train(eval_df, seed=5, n=2400):
    g = pd.read_csv(HF / "LLMGen-Phishing-Email-Dataset/GPT_Phishing_Email_dataset.csv")
    used = set(eval_df[eval_df.set == "llmgen_gpt"].body.str.slice(0, 80))
    rows = []
    for c, y in zip(g.content, g.label):
        s, subj, b = parse_llmgen(str(c))
        if b[:80] in used:
            continue
        rows.append(("llmgen_train", s, subj, b, int(y)))
    d = pd.DataFrame(rows, columns=["src", "sender", "subject", "body", "label"])
    return pd.concat([d[d.label == 1].sample(min(n // 2, (d.label == 1).sum()), random_state=seed), d[d.label == 0].sample(min(n // 2, (d.label == 0).sum()), random_state=seed)])


def fit_heads(X, y, which):
    from sklearn.linear_model import LogisticRegression
    from sklearn.preprocessing import StandardScaler
    from sklearn.pipeline import make_pipeline
    if which == "lr":
        return make_pipeline(StandardScaler(), LogisticRegression(C=0.3, max_iter=3000, class_weight="balanced")).fit(X, y)
    import xgboost as xgb
    return xgb.XGBClassifier(n_estimators=400, max_depth=4, learning_rate=0.06, subsample=0.8, colsample_bytree=0.5, n_jobs=8, eval_metric="logloss").fit(X, y)


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--backbone", default="en")
    ap.add_argument("--per-source", type=int, default=3000)
    ap.add_argument("--save", default=None, help="save the chosen head under AIML/email/v2/<name>")
    a = ap.parse_args()

    ev = load_sets(500, 500)
    pool = build_pool(a.per_source)
    mod = modern_train(ev)
    print("pool:", pool.groupby("src").size().to_dict(), "| modern train:", len(mod), "| eval:", ev.groupby("set").size().to_dict())

    def design(df, tag):
        e = embed_cached([text_of(s, b) for s, b in zip(df.subject, df.body)], a.backbone, tag)
        f = batch_features(df.sender, df.subject, df.body)
        return np.hstack([e, f])

    Xp, Xm, Xe = design(pool, "pool"), design(mod, "modern"), design(ev, "eval")
    results = {}
    from sklearn.metrics import roc_auc_score
    for cfg in ("legacy", "legacy+modern"):
        X = Xp if cfg == "legacy" else np.vstack([Xp, Xm])
        y = pool.label.values if cfg == "legacy" else np.concatenate([pool.label.values, mod.label.values])
        for which in ("lr", "xgb"):
            t0 = time.time()
            m = fit_heads(X, y, which)
            s = m.predict_proba(Xe)[:, 1]
            r = report(ev, s, f"{a.backbone}_{cfg}_{which}")
            results[f"{cfg}/{which}"] = r
            print(f"[{cfg}/{which}] fit+score {time.time() - t0:.0f}s")
            for name, v in r["sets"].items():
                print(f"   {name:12s} AUC {v.get('auc', float('nan')):.3f}  recall@0.5 {v.get('recall_at_0.5', float('nan')):.3f}  "
                      f"TPR@FPR1% {v.get('tpr_at_pooled_fpr_0.01', float('nan')):.3f}  TPR@0.1% {v.get('tpr_at_pooled_fpr_0.001', float('nan')):.3f}")
    # leave-one-source-out on the legacy pool (head = lr)
    loso = {}
    for src in sorted(pool.src.unique()):
        tr, te = pool.src != src, pool.src == src
        m = fit_heads(Xp[tr.values], pool.label.values[tr.values], "lr")
        loso[src] = float(roc_auc_score(pool.label.values[te.values], m.predict_proba(Xp[te.values])[:, 1]))
    print("LOSO AUC (lr, legacy):", {k: round(v, 3) for k, v in loso.items()}, "mean", round(float(np.mean(list(loso.values()))), 3))
    results["loso_lr_legacy"] = loso
    (OUT / f"email_embed_experiment_{a.backbone}.json").write_text(json.dumps(results, indent=2))


if __name__ == "__main__":
    main()
