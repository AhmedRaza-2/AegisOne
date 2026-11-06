"""
Independent test on the Roman Urdu / English smishing set (Siddiq 2026, Zenodo 10.5281/zenodo.21810885, CC BY 4.0):
1,000 Pakistani SMS - 405 phishing (reward, PIN, account lures), 595 legitimate (bank OTPs, alerts, ordinary texts).
Not used for training. Run:  AEGIS_MESSAGE_ENGINE=v2|ensemble python -m AIML.eval.eval_roman_urdu --tag x
"""
import argparse
import json
import sys
from pathlib import Path

import numpy as np
import pandas as pd

ROOT = Path(__file__).resolve().parents[2]
sys.path.insert(0, str(ROOT))
F = ROOT / "AIML/eval/cache/extra/roman_urdu_smish.xlsx"


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--tag", default="x")
    a = ap.parse_args()
    from sklearn.metrics import roc_auc_score
    from api.services import model_orchestrator as mo
    mo.load_v2_heads()
    mo.load_m1()
    d = pd.read_excel(F)
    s = np.array([float(mo._predict_text_sync(t)["phishing_probability"]) for t in d.Raw_text])
    y = d.Labels.values
    out = {"tag": a.tag, "n": len(d), "auc": float(roc_auc_score(y, s)), "phishing_caught": float(np.mean(s[y == 1] >= 0.51)),
           "legit_flagged": float(np.mean(s[y == 0] >= 0.51)), "by_type": {}}
    for k, g in d.assign(s=s).groupby("Source_Type"):
        out["by_type"][k] = {"n": int(len(g)), "flagged": float(np.mean(g.s >= 0.51))}
    (ROOT / f"AIML/eval/results/romanurdu_{a.tag}.json").write_text(json.dumps(out, indent=2))
    print(json.dumps(out, indent=1))


if __name__ == "__main__":
    main()
