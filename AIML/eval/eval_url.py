"""
URL evaluation harness: the numbers that matter for a phishing detector, on data the model has not seen.

Sets (AIML/eval/data, built by build_reference_sets.py):
  legit_popular.csv  real deep URLs of ~500 popular sites incl. Pakistani ones (Internet Archive)
  legit_web.csv      real URLs of ordinary, mostly NOT popular web pages (allenai/c4) - the long tail
  phish_fresh.csv    today's OpenPhish feed - phishing URLs that cannot be in any training file
Optional: --phishtank adds recent verified PhishTank URLs (may overlap the training data; reported separately).

The pipeline is called exactly as the API serves it (api.services.model_orchestrator._predict_url_sync):
  final  = the risk the user sees (0-1)        neural = the raw neural probability, when the network ran
Reported: false alarms at the product thresholds (WARN >= 0.35, BLOCK >= 0.60) per legitimate set, ROC-AUC,
TPR at FPR 1% / 0.1% (threshold set on the pooled legitimate URLs), average precision at a 1% phishing base rate,
recall at WARN/BLOCK, and the worst false positives.

Run from the repo root:  python -m AIML.eval.eval_url --tag after [--n-pop 2000 --n-web 2000 --phishtank]
Output: AIML/eval/results/url_<tag>.json and .md
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
OUT = ROOT / "AIML/eval/results"
OUT.mkdir(exist_ok=True)
WARN, BLOCK = 0.35, 0.60


def tpr_at_fpr(neg, pos, fpr):
    """Detection rate when the threshold is set so that at most `fpr` of legitimate URLs are flagged."""
    neg = np.sort(neg)
    k = int(np.ceil(len(neg) * (1 - fpr))) - 1
    th = neg[min(max(k, 0), len(neg) - 1)]
    return float(np.mean(pos > th)), float(th)


def avg_precision_at_base_rate(neg, pos, base=0.01):
    """Average precision if phishing were `base` of traffic: negatives are re-weighted, positives kept."""
    scores = np.concatenate([neg, pos])
    y = np.concatenate([np.zeros(len(neg)), np.ones(len(pos))])
    w = np.concatenate([np.full(len(neg), (1 - base) / len(neg)), np.full(len(pos), base / len(pos))])
    order = np.argsort(-scores, kind="stable")
    y, w = y[order], w[order]
    tp, fp = np.cumsum(w * y), np.cumsum(w * (1 - y))
    prec = tp / np.maximum(tp + fp, 1e-12)
    rec = tp / max(w[y == 1].sum(), 1e-12)
    return float(np.sum(prec * np.diff(np.concatenate([[0], rec]))))


def run(urls, mo):
    final, neural = [], []
    t0 = time.time()
    for i, u in enumerate(urls):
        try:
            r = mo._predict_url_sync(u)
            final.append(float(r.get("phishing_probability") or 0.0))
            neural.append(float((r.get("evidence") or {}).get("model_malicious_probability", np.nan)))
        except Exception:
            final.append(np.nan)
            neural.append(np.nan)
        if (i + 1) % 500 == 0:
            print(f"  {i + 1}/{len(urls)}  {time.time() - t0:.0f}s", flush=True)
    return np.array(final), np.array(neural)


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--n-pop", type=int, default=2000)
    ap.add_argument("--n-web", type=int, default=2000)
    ap.add_argument("--tag", default="run")
    ap.add_argument("--phishtank", action="store_true")
    ap.add_argument("--mutations", action="store_true", help="also score evasive variants of the fresh phishing URLs")
    a = ap.parse_args()

    from api.services import model_orchestrator as mo
    from sklearn.metrics import roc_auc_score
    mo.load_all_models()

    legit = {}
    for name, n in (("legit_popular", a.n_pop), ("legit_web", a.n_web)):
        p = DATA / f"{name}.csv"
        if p.exists():
            d = pd.read_csv(p)
            legit[name] = d.sample(min(n, len(d)), random_state=3)["url"].tolist()
    phish = {"openphish_fresh": pd.read_csv(DATA / "phish_fresh.csv")["url"].tolist()}
    if a.mutations:
        # Robustness (Frontiers in Computer Science 2026, "domain leakage / adversarial manipulation"): the same
        # phishing URLs after cheap evasive edits that do not change where they lead.
        from urllib.parse import urlsplit, urlunsplit

        def mutate(u, kind):
            p = urlsplit(u)
            host = p.hostname or ""
            if kind == "subdomain_injection":      # a famous domain in front of the attacker's host
                net = "login.microsoftonline.com." + host + (f":{p.port}" if p.port else "")
                return urlunsplit((p.scheme, net, p.path, p.query, p.fragment))
            if kind == "path_padding":             # benign-looking path and query
                return urlunsplit((p.scheme, p.netloc, (p.path.rstrip("/") or "") + "/docs/2025/annual-report/index.html",
                                   "ref=google.com&lang=en", p.fragment))
            return u
        base = phish["openphish_fresh"]
        phish["mut_subdomain_injection"] = [mutate(u, "subdomain_injection") for u in base]
        phish["mut_path_padding"] = [mutate(u, "path_padding") for u in base]
    if a.phishtank:
        pt = pd.read_csv(ROOT / "AIML/url/verified_online.csv")
        phish["phishtank_2026"] = pt[pt.submission_time >= "2026-03-01"].sample(300, random_state=3)["url"].tolist()

    t0 = time.time()
    res = {"tag": a.tag, "legit": {}, "phish": {}, "worst_false_positives": {}}
    scores = {}
    for name, urls in list(legit.items()) + list(phish.items()):
        print(f"{name}: {len(urls)} URLs", flush=True)
        scores[name] = run(urls, mo)
    pooled_f = np.concatenate([scores[n][0] for n in legit])
    pooled_n = np.concatenate([scores[n][1] for n in legit])
    for name, urls in legit.items():
        f = scores[name][0]
        ok = ~np.isnan(f)
        res["legit"][name] = {"n": int(ok.sum()), "errors": int((~ok).sum()), "warn_rate": float(np.mean(f[ok] >= WARN)), "block_rate": float(np.mean(f[ok] >= BLOCK))}
        order = np.argsort(-np.nan_to_num(f, nan=-1))[:12]
        res["worst_false_positives"][name] = [{"url": urls[i][:140], "score": round(float(f[i]), 3)} for i in order]
    for name in phish:
        f, n = scores[name]
        m = ~np.isnan(f)
        r = {"n": int(m.sum()), "recall_warn": float(np.mean(f[m] >= WARN)), "recall_block": float(np.mean(f[m] >= BLOCK))}
        for label, neg, pos in (("final", pooled_f[~np.isnan(pooled_f)], f[m]), ("neural", pooled_n[~np.isnan(pooled_n)], n[~np.isnan(n)])):
            if len(neg) < 10 or len(pos) < 10:
                continue
            r[label] = {"n_legit": int(len(neg)), "n_phish": int(len(pos)),
                        "auc": float(roc_auc_score([0] * len(neg) + [1] * len(pos), list(neg) + list(pos))),
                        "tpr_at_fpr_1pct": tpr_at_fpr(neg, pos, 0.01)[0], "tpr_at_fpr_0.1pct": tpr_at_fpr(neg, pos, 0.001)[0],
                        "ap_at_1pct_base_rate": avg_precision_at_base_rate(neg, pos, 0.01)}
        res["phish"][name] = r
    res["seconds"] = round(time.time() - t0)
    (OUT / f"url_{a.tag}.json").write_text(json.dumps(res, indent=2))

    md = [f"# URL evaluation - {a.tag}", ""]
    for name, r in res["legit"].items():
        md.append(f"- {name} (n={r['n']}): false alarms WARN(>=35) {r['warn_rate']:.2%}, BLOCK(>=60) {r['block_rate']:.2%}")
    for name, r in res["phish"].items():
        md.append(f"- {name} (n={r['n']}): recall WARN {r['recall_warn']:.1%}, BLOCK {r['recall_block']:.1%}")
        for label in ("final", "neural"):
            if label in r:
                x = r[label]
                md.append(f"  - {label}: AUC {x['auc']:.3f} | TPR@FPR 1% {x['tpr_at_fpr_1pct']:.1%}, 0.1% {x['tpr_at_fpr_0.1pct']:.1%} | AP@1% base rate {x['ap_at_1pct_base_rate']:.3f}")
    for name, w in res["worst_false_positives"].items():
        md += ["", f"Worst false positives ({name}):"] + [f"- {x['score']:.2f}  {x['url']}" for x in w[:8]]
    (OUT / f"url_{a.tag}.md").write_text("\n".join(md), encoding="utf-8")
    print("\n".join(md))


if __name__ == "__main__":
    main()
