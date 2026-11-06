"""
Text / SMS / chat evaluation harness (same metrics as eval_email.py).

Sets:
  uci_sms         real SMS (UCI SMS Spam Collection, Almeida et al. 2011): ham vs spam - spam includes scams and
                  aggressive promotions, so it is a FALSE-ALARM test on real ham more than a phishing benchmark
  handwritten_sms Pakistani SMS / WhatsApp scams and ordinary messages in English, Roman Urdu and Urdu script
                  (AIML/eval/handwritten_sms.csv, a regression guard)
  india_sms       CloveAI/india-spam-sms (MIT): templated Indian SMS incl. bank / courier / KYC lures (synthetic-looking,
                  reported separately)

Run:  python -m AIML.eval.eval_text --scorer prod          (production text path: heuristics, then the neural model)
      python -m AIML.eval.eval_text --scorer prod_neural   (neural model only)
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
from AIML.eval.eval_email import OUT, report  # noqa: E402

HF = ROOT / "AIML/eval/data/hf"


def load_sets(n_uci_ham=800, n_uci_spam=300, n_india=300, seed=13):
    rows = []
    u = pd.read_parquet(HF / "sms_spam/plain_text/train-00000-of-00001.parquet")
    u = pd.concat([u[u.label == 0].sample(n_uci_ham, random_state=seed), u[u.label == 1].sample(n_uci_spam, random_state=seed)])
    rows += [("uci_sms", str(t).strip(), int(y)) for t, y in zip(u.sms, u.label)]
    hw = ROOT / "AIML/eval/handwritten_sms.csv"
    if hw.exists():
        h = pd.read_csv(hw)
        rows += [("handwritten_sms", t, int(y)) for t, y in zip(h.text, h.label)]
    ip = HF / "india-spam-sms/data/train-00000-of-00001.parquet"
    if ip.exists():
        i = pd.read_parquet(ip)
        i = pd.concat([i[i.label == 0].sample(n_india, random_state=seed), i[i.label == 1].sample(n_india, random_state=seed)])
        rows += [("india_sms", t, int(y)) for t, y in zip(i.text, i.label)]
    return pd.DataFrame(rows, columns=["set", "text", "label"])


def scorer_prod(df, neural_only=False):
    import torch
    from api.services import model_orchestrator as mo
    mo.load_all_models()
    if neural_only:
        mo.FAST_SCAN_MODE = False
    out, t0 = [], time.time()
    for i, t in enumerate(df.text):
        out.append(float(mo._predict_text_sync(t).get("phishing_probability") or 0.0))
        if (i + 1) % 250 == 0:
            print(f"  {i + 1}/{len(df)}  {time.time() - t0:.0f}s", flush=True)
    return np.array(out)


def scorer_v2(df, rule_floor=True):
    """The v2 text detector exactly as served; rule_floor=False judges the embedding head alone."""
    from api.services import model_orchestrator as mo
    if not rule_floor:
        mo.TEXT_RULE_FLOOR = 0.0
    mo.load_v2_heads()
    if "text" not in mo.V2_HEADS:
        raise SystemExit("AIML/text_general/v2/text_head.json not found - run python -m AIML.eval.train_v2_heads text")
    out, t0 = [], time.time()
    for i, t in enumerate(df.text):
        out.append(float(mo._predict_text_sync(t)["phishing_probability"]))
        if (i + 1) % 500 == 0:
            print(f"  {i + 1}/{len(df)}  {time.time() - t0:.0f}s", flush=True)
    return np.array(out)


def scorer_m1(df, rule_floor=True):
    from api.services import model_orchestrator as mo
    mo.load_v2_heads()
    mo.load_m1()
    if not mo.M1:
        raise SystemExit("message model M1 not found - set AEGIS_MESSAGE_MODEL_DIR or install AIML/message/m1")
    return scorer_v2(df, rule_floor)


SCORERS = {"prod": lambda d: scorer_prod(d, False), "prod_neural": lambda d: scorer_prod(d, True),
           "v2": lambda d: scorer_v2(d, True), "v2_no_rules": lambda d: scorer_v2(d, False),
           "m1": lambda d: scorer_m1(d, True), "m1_no_rules": lambda d: scorer_m1(d, False)}


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--scorer", default="prod")
    ap.add_argument("--tag", default=None)
    a = ap.parse_args()
    df = load_sets()
    print(df.groupby(["set", "label"]).size().to_string(), flush=True)
    scores = SCORERS[a.scorer](df)
    res = report(df, scores, "text_" + (a.tag or a.scorer))
    (OUT / f"{res['tag']}.json").write_text(json.dumps(res, indent=2))
    pd.DataFrame({"set": df["set"], "label": df.label, "score": scores, "text": df.text.str.slice(0, 160)}).to_csv(OUT / f"{res['tag']}_scores.csv", index=False)
    print(json.dumps(res, indent=2))


if __name__ == "__main__":
    main()
