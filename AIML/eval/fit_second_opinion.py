"""
Fit the URL "second opinion" (an open-source model next to AegisOne) and write AIML/url/second_opinion/config.json.

Input: the per-URL caches written by AIML/eval/open_baselines.py (same genuine and phishing URLs for every model).
For the chosen open model it fits a logistic stacker on (logit AegisOne final, logit open score) and picks the
UPGRADE threshold: a URL AegisOne already warns about (>= 0.35) is raised to BLOCK when the stacked score passes it.
The threshold is the lowest one that does not add a single false BLOCK on the genuine URLs, so the rule can only add
blocks AegisOne's own evidence already called suspicious; it never lowers a verdict and never touches rule overrides.

Also stored for the admin panel: every model's same-data results and a temporal check (fit on the 1 Nov feed and half
of the genuine URLs, test on the 14 Nov feed and the other half, averaged over 20 genuine splits).

  python -m AIML.eval.fit_second_opinion --model kmack/malicious-url-detection --revision <sha> --tag 2026-11-14
"""
import argparse
import json
import time

import numpy as np
import pandas as pd
from sklearn.linear_model import LogisticRegression

from AIML.eval import open_baselines as ob

OUT_DIR = ob.ROOT / "AIML/url/second_opinion"
WARN, BLOCK = 0.35, 0.60


def _features(ours, other, urls):
    return np.column_stack([ob._logit(np.array([ours[u]["final"] for u in urls])),
                            ob._logit(np.array([other[u] for u in urls]))])


def _upgrade_threshold(o_neg, s_neg):
    """Lowest stacked threshold that adds no false BLOCK on the genuine URLs."""
    base = int(np.sum(o_neg >= BLOCK))
    t = 1.0
    for c in np.sort(np.unique(s_neg))[::-1]:
        if int(np.sum((o_neg >= BLOCK) | ((o_neg >= WARN) & (s_neg >= c)))) <= base:
            t = float(c)
        else:
            break
    # never closer than the highest genuine stacked score that sits in the WARN band
    return t


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--model", default="kmack/malicious-url-detection")
    ap.add_argument("--revision", required=True)
    ap.add_argument("--tag", default="run")
    a = ap.parse_args()

    legit, phish, _ = ob.all_urls()
    leg = [u for v in legit.values() for u in v]
    ours = ob._load(ob.CACHE / "ours_url.json")
    other = ob._load(ob.CACHE / ("open_url_" + a.model.replace("/", "__") + ".json"))
    leg = [u for u in leg if u in ours and u in other and not np.isnan(ours[u]["final"])]
    phish = [u for u in phish if u in ours and u in other and not np.isnan(ours[u]["final"])]

    # ── final stacker on everything ─────────────────────────────────────────────────────────────────────────
    X = np.vstack([_features(ours, other, leg), _features(ours, other, phish)])
    y = np.r_[np.zeros(len(leg)), np.ones(len(phish))]
    m = LogisticRegression(C=1.0, max_iter=1000).fit(X, y)
    s = m.predict_proba(X)[:, 1]
    o = np.array([ours[u]["final"] for u in leg + phish])
    t = _upgrade_threshold(o[y == 0], s[y == 0])

    # ── temporal check: fit on the older feed, test on the newer one ────────────────────────────────────────
    old = [u for u in pd.read_csv(ob.DATA / "phish_fresh.csv")["url"] if u in set(phish)]
    new = [u for u in pd.read_csv(ob.DATA / "phish_fresh_2026-11-14.csv")["url"] if u in set(phish) and u not in set(old)]
    rows = []
    for seed in range(20):
        idx = np.random.default_rng(seed).permutation(len(leg))
        A, B = [leg[i] for i in idx[: len(leg) // 2]], [leg[i] for i in idx[len(leg) // 2:]]
        mt = LogisticRegression(C=1.0, max_iter=1000).fit(np.vstack([_features(ours, other, A), _features(ours, other, old)]),
                                                          np.r_[np.zeros(len(A)), np.ones(len(old))])
        oA = np.array([ours[u]["final"] for u in A])
        tt = _upgrade_threshold(oA, mt.predict_proba(_features(ours, other, A))[:, 1])
        oB, oN = np.array([ours[u]["final"] for u in B]), np.array([ours[u]["final"] for u in new])
        sB, sN = mt.predict_proba(_features(ours, other, B))[:, 1], mt.predict_proba(_features(ours, other, new))[:, 1]
        up = lambda oo, ss: (oo >= BLOCK) | ((oo >= WARN) & (ss >= tt))
        rows.append([np.mean(oN >= BLOCK), np.mean(oB >= BLOCK), np.mean(up(oN, sN)), np.mean(up(oB, sB)),
                     np.mean(oN >= WARN), np.mean(oB >= WARN)])
    r = np.array(rows) * 100
    temporal = {
        "fit": f"1 Nov OpenPhish feed ({len(old)}) + half of the genuine URLs", "test": f"14 Nov feed ({len(new)}) + the other half",
        "splits": 20,
        "aegisone_block_caught_pct": round(float(r[:, 0].mean()), 2), "aegisone_block_false_pct": round(float(r[:, 1].mean()), 2),
        "with_second_opinion_block_caught_pct": round(float(r[:, 2].mean()), 2),
        "with_second_opinion_block_false_pct": round(float(r[:, 3].mean()), 2),
        "warn_caught_pct_unchanged": round(float(r[:, 4].mean()), 2), "warn_false_pct_unchanged": round(float(r[:, 5].mean()), 2),
    }

    same_data = json.loads((ob.OUT / f"open_baselines_{a.tag}.json").read_text())
    lic, bad, note = ob.REGISTRY[a.model]
    cfg = {
        "version": a.tag, "created": time.strftime("%Y-%m-%d"),
        "default_mode": "upgrade",
        "modes": {"off": "not run", "shadow": "run and shown to admins, never changes a verdict",
                  "upgrade": "may raise a WARN to BLOCK when both models agree; never lowers a verdict"},
        "models": [{
            "id": a.model.split("/")[-1], "repo": a.model, "revision": a.revision, "licence": lic, "bad_label_index": bad,
            "description": note, "max_length": 128,
            "stacker": {"coef_aegisone": float(m.coef_[0][0]), "coef_open": float(m.coef_[0][1]), "intercept": float(m.intercept_[0])},
            "upgrade_threshold": round(t, 6), "warn": WARN, "block": BLOCK,
        }],
        "evaluation": {"same_data": same_data, "temporal_check": temporal},
    }
    OUT_DIR.mkdir(parents=True, exist_ok=True)
    (OUT_DIR / "config.json").write_text(json.dumps(cfg, indent=2))
    print(json.dumps({k: cfg["models"][0][k] for k in ("stacker", "upgrade_threshold")}, indent=2))
    print(json.dumps(temporal, indent=2))


if __name__ == "__main__":
    main()
