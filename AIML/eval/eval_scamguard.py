"""
Independent test: ScamGuardBench v0.2 (flowxai/scamguardbench, Apache-2.0; 598 standard + 33 adversarial 'hard' scams,
346 hard-legitimate messages tagged by confusable class - bank OTPs, transaction alerts, courier notices, real family
'send me money' texts - in English and Romanian, SMS and e-mail). NEVER used for training.

It is the check the other sets cannot give: Romanian is a language the models never saw, and the legitimate half is
built to look like scams. Run per engine:

  AEGIS_MESSAGE_ENGINE=v2        python -m AIML.eval.eval_scamguard --tag v2
  AEGIS_MESSAGE_ENGINE=ensemble  python -m AIML.eval.eval_scamguard --tag ensemble

WARN = 51 on the product scale.
"""
import argparse
import json
import sys
from collections import defaultdict
from pathlib import Path

import numpy as np

ROOT = Path(__file__).resolve().parents[2]
sys.path.insert(0, str(ROOT))


def load():
    from huggingface_hub import hf_hub_download
    rows = []
    for sub in ("standard", "hard", "legit_confusable"):
        p = hf_hub_download("flowxai/scamguardbench", f"v0.2/{sub}.jsonl", repo_type="dataset")
        for line in open(p, encoding="utf-8"):
            r = json.loads(line)
            r["label"] = 1 if r["verdict"] == "scam_likely" else 0
            rows.append(r)
    return rows


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--tag", default="scamguard")
    a = ap.parse_args()
    from api.services import model_orchestrator as mo
    mo.load_v2_heads()
    mo.load_m1()
    rows = load()
    for r in rows:
        if r["channel"] == "email":
            t = r["text"]
            subj, _, body = t.partition("\n")
            res = mo._predict_email_sync("", subj[:150] if len(subj) < 150 else "", body if len(subj) < 150 else t)
        else:
            res = mo._predict_text_sync(r["text"])
        r["score"] = float(res["phishing_probability"])
    from sklearn.metrics import roc_auc_score
    y = np.array([r["label"] for r in rows])
    s = np.array([r["score"] for r in rows])
    out = {"tag": a.tag, "n": len(rows), "auc": float(roc_auc_score(y, s)),
           "scam_recall": float(np.mean(s[y == 1] >= 0.51)), "legit_false_alarm": float(np.mean(s[y == 0] >= 0.51)),
           "by_subset": {}, "by_language": {}, "legit_by_class": {}}
    for key, field in (("by_subset", "subset"), ("by_language", "language")):
        g = defaultdict(list)
        for r in rows:
            g[r[field]].append(r)
        for k, v in g.items():
            ys = np.array([x["label"] for x in v]); ss = np.array([x["score"] for x in v])
            out[key][k] = {"n": len(v), "scam_recall": float(np.mean(ss[ys == 1] >= 0.51)) if (ys == 1).any() else None,
                           "false_alarm": float(np.mean(ss[ys == 0] >= 0.51)) if (ys == 0).any() else None}
    g = defaultdict(list)
    for r in rows:
        if r["label"] == 0:
            g[r["confusable_class"] or "untagged"].append(r["score"] >= 0.51)
    out["legit_by_class"] = {k: {"n": len(v), "false_alarm": float(np.mean(v))} for k, v in sorted(g.items(), key=lambda kv: str(kv[0]))}
    (ROOT / "AIML/eval/results").mkdir(exist_ok=True)
    json.dump(out, open(ROOT / f"AIML/eval/results/scamguard_{a.tag}.json", "w"), indent=2)
    print(json.dumps(out, indent=1))


if __name__ == "__main__":
    main()
