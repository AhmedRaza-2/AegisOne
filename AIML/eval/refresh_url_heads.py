"""
Refresh the URL model's heads (feature_mlp + classifier) on fresh, real data - the language backbone is unchanged.

Why: the shipped heads were fitted on a benign set dominated by bare domains and an old URL feed, so ordinary deep
links on long-tail sites look "phishing-like" to them. This re-fits only the heads (seconds on a CPU) on
  positives  recent verified PhishTank URLs (AIML/url/verified_online.csv)
  negatives  real web-page URLs from a DIFFERENT allenai/c4 shard than the evaluation set
             + the original training data as replay (weight_trainer.replay_sample)
and accepts the result only through the same gate as organisation retraining (weight_trainer.judge on the frozen
v7_test / hard_set references). The output is evaluated end to end with AIML/eval/eval_url.py.

Run:  python -m AIML.eval.refresh_url_heads [--n 2500]        -> AIML/url/heads_refresh_candidate.pt (+ report)
Promote by copying the candidate to AIML/url/heads_shipped.pt (loaded at startup by the orchestrator).
"""
import argparse
import gzip
import json
import random
import sys
from pathlib import Path

import numpy as np
import pandas as pd

ROOT = Path(__file__).resolve().parents[2]
sys.path.insert(0, str(ROOT))
OUT = ROOT / "AIML/eval/results"


def c4_urls(n, shard="en/c4-validation.00001-of-00008.json.gz"):
    from huggingface_hub import hf_hub_download
    from AIML.eval.build_reference_sets import plausible
    p = hf_hub_download("allenai/c4", shard, repo_type="dataset", local_dir=str(ROOT / "AIML/eval/data/c4"))
    seen, out = {}, []
    with gzip.open(p, "rt", encoding="utf-8") as f:
        for line in f:
            u = json.loads(line).get("url", "")
            if not plausible(u):
                continue
            h = u.split("/")[2]
            if seen.get(h, 0) >= 2:
                continue
            seen[h] = seen.get(h, 0) + 1
            out.append(u)
    random.Random(5).shuffle(out)
    return out[:n]


# Benign-looking padding an attacker appends so a phishing URL "reads" like a blog or document link. Measured: such
# padding cut detection of today's OpenPhish URLs from 84% to 38%. Training on padded copies is adversarial training
# for this family only (it does not transfer to other evasion families - Frontiers in Computer Science 2026). The
# evaluation uses a padding that is deliberately NOT in this list.
PADS = ["/blog/2024/07/how-to-reset-your-router/", "/wp-content/uploads/2023/11/quarterly-report.pdf", "/en-us/help/article/12345",
        "/news/world/2025/03/15/story.html", "/products/category/home-kitchen?page=2&sort=popular", "?utm_source=newsletter&utm_medium=email&utm_campaign=nov",
        "/index.php?option=com_content&view=article&id=42", "/static/docs/guide/getting-started.html", "/user/profile/settings?tab=security",
        "/forum/thread/88213-best-practices", "/careers/jobs/software-engineer?location=remote", "/assets/media/2024/brochure-final.pdf"]


def pad(u: str, rng: random.Random) -> str:
    from urllib.parse import urlsplit, urlunsplit
    p = urlsplit(u)
    extra = rng.choice(PADS)
    if extra.startswith("?"):
        return urlunsplit((p.scheme, p.netloc, p.path, (p.query + "&" if p.query else "") + extra[1:], p.fragment))
    path, _, query = extra.partition("?")
    return urlunsplit((p.scheme, p.netloc, (p.path.rstrip("/") or "") + path, query or p.query, p.fragment))


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--n", type=int, default=2500)
    ap.add_argument("--pad-share", type=float, default=0.5, help="share of phishing URLs also added as a padded copy")
    a = ap.parse_args()
    from api.services import weight_trainer as wt
    pt = pd.read_csv(ROOT / "AIML/url/verified_online.csv")
    pos = pt[pt.submission_time >= "2026-01-01"].sample(a.n, random_state=5)["url"].tolist()
    rng = random.Random(9)
    pos += [pad(u, rng) for u in rng.sample(pos, int(len(pos) * a.pad_share))]
    # Path presence must not be a shortcut in EITHER direction: the shipped heads learned "deep link = phishing"
    # (benign side was bare domains), a first refresh learned "bare domain = phishing" (benign side was page URLs).
    # So half the legitimate examples are the bare home page of a real site, half a real page on it.
    from urllib.parse import urlsplit
    pages = c4_urls(len(pos))
    half = len(pages) // 2
    neg = pages[:half] + [f"{urlsplit(u).scheme}://{urlsplit(u).netloc}/" for u in pages[half:]]
    urls, labels = pos + neg, [1] * len(pos) + [0] * len(neg)
    print(f"training on {len(pos)} PhishTank-2026 + {len(neg)} c4 shard-1 URLs (+ replay)", flush=True)
    bb = wt.get_backbone()
    cls, feats = bb.embed(urls)
    r_urls, r_labels = wt.replay_sample()
    r_cls, r_feats = bb.embed(r_urls)
    y = np.array(labels)
    tr_cls = bb.torch.cat([cls, r_cls])
    tr_feats = bb.torch.cat([feats, r_feats])
    tr_y = np.concatenate([y, np.array(r_labels)])
    heads = wt._train_heads(bb, tr_cls, tr_feats, tr_y, bb.base_heads)
    bench = wt.benchmark_embeddings(bb)
    rep_base = {n: wt.metrics(d["y"], bb.p_phish(bb.base_heads, d["cls"], d["feats"])) for n, d in bench.items()}
    rep_cand = {n: wt.metrics(d["y"], bb.p_phish(heads, d["cls"], d["feats"])) for n, d in bench.items()}
    ok, reasons = wt.judge(rep_base, rep_cand, None, None)
    path = ROOT / "AIML/url/heads_refresh_candidate.pt"
    wt.save_heads(path, heads, {"source": "refresh_url_heads", "positives": len(pos), "negatives": len(neg), "gate": ok, "reasons": reasons})
    rep = {"accepted_by_gate": ok, "reasons": reasons, "reference_base": rep_base, "reference_candidate": rep_cand,
           "train": {"phishtank_2026": len(pos), "c4_shard1": len(neg), "replay": len(r_urls)}}
    (OUT / "url_heads_refresh.json").write_text(json.dumps(rep, indent=2, default=float))
    print(json.dumps(rep, indent=2, default=float))


if __name__ == "__main__":
    main()
