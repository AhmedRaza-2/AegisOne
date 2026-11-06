"""
Email / text evaluation harness: out-of-distribution, modern, and at fixed false-positive rates.

Why this exists: the production email model scores 99% on a random split of its own training sources but
collapses on short modern credential-phishing mail (the cross-corpus failure documented in the literature).
So models are judged here on data they never saw and that is written the way phishing is written today.

Sets (all under AIML/eval/data/hf, downloaded by fetch_email_sets.py):
  llmgen_gpt   LLM-generated phishing AND legitimate corporate e-mails (Dizzzy0x00/LLMGen-Phishing-Email-Dataset,
               apache-2.0). Both classes come from the same generator, so "sounds like an LLM" cannot be the shortcut.
  legacy_ham   real legitimate mail from Enron / SpamAssassin / Ling (negatives only), to price false alarms on
               ordinary mail
  handwritten  AIML/eval/handwritten_modern.csv - short credential, payroll, shared-file, bank, MFA and CEO-fraud
               mail in the style seen in Pakistan, plus ordinary business mail (a regression guard, not a benchmark)

Reported per scorer: ROC-AUC on llmgen_gpt and handwritten, TPR at FPR 1% / 0.1% where the threshold is set on ALL
legitimate mail pooled (llmgen + legacy + handwritten ham), and the recall on handwritten phishing at the
production threshold 0.5.

Run:  python -m AIML.eval.eval_email --scorer prod            (production model, neural + rules as served)
      python -m AIML.eval.eval_email --scorer prod_neural     (neural score only)
"""
import argparse
import json
import re
import sys
import time
from pathlib import Path

import numpy as np
import pandas as pd

ROOT = Path(__file__).resolve().parents[2]
sys.path.insert(0, str(ROOT))
HF = ROOT / "AIML/eval/data/hf"
OUT = ROOT / "AIML/eval/results"
OUT.mkdir(exist_ok=True)


def parse_llmgen(content: str):
    m = re.match(r"^\s*Subject:\s*(.*?)\s+From:\s*(\S+@\S+)\s+(.*)$", content, re.S)
    if m:
        return m.group(2).strip(), m.group(1).strip(), m.group(3).strip()
    return "", "", content.strip()


def load_sets(n_llm=500, n_legacy=500, seed=11):
    rows = []
    g = pd.read_csv(HF / "LLMGen-Phishing-Email-Dataset/GPT_Phishing_Email_dataset.csv")
    g = pd.concat([g[g.label == 1].sample(n_llm, random_state=seed), g[g.label == 0].sample(n_llm, random_state=seed)])
    for c, y in zip(g.content, g.label):
        s, subj, b = parse_llmgen(str(c))
        rows.append(("llmgen_gpt", s, subj, b, int(y)))
    t = pd.read_parquet(HF / "seven-phishing-email-datasets/test.parquet")
    ham = t[(t.label == 0) & t.dataset_name.isin(["Enron", "Assassin", "Ling"])].sample(n_legacy, random_state=seed)
    for s, subj, b in zip(ham.sender.fillna(""), ham.subject.fillna(""), ham.text.fillna("")):
        rows.append(("legacy_ham", str(s), str(subj), str(b)[:4000], 0))
    hw = ROOT / "AIML/eval/handwritten_modern.csv"
    if hw.exists():
        for r in pd.read_csv(hw).itertuples():
            rows.append(("handwritten", r.sender, r.subject, r.body, int(r.label)))
    return pd.DataFrame(rows, columns=["set", "sender", "subject", "body", "label"])


# ── scorers ────────────────────────────────────────────────────────────────────────────────────────
def scorer_prod(df, neural_only=False):
    import torch
    from api.services import model_orchestrator as mo
    mo.load_all_models()
    out = []
    t0 = time.time()
    for i, r in enumerate(df.itertuples()):
        if neural_only:
            m = mo.MODELS["email"]
            text = f"[SUBJECT]: {r.subject} [BODY]: {r.body}"
            enc = mo.TOKENIZER(text, add_special_tokens=True, max_length=512, padding="max_length", truncation=True, return_tensors="pt").to(mo.DEVICE)
            feats = m["extract_features"](r.sender, r.subject, r.body).unsqueeze(0).to(mo.DEVICE)
            with torch.inference_mode():
                out.append(torch.sigmoid(m["model"](enc["input_ids"], enc["attention_mask"], feats)).item())
        else:
            out.append(float(mo._predict_email_sync(r.sender, r.subject, r.body).get("phishing_probability") or 0.0))
        if (i + 1) % 250 == 0:
            print(f"  {i + 1}/{len(df)}  {time.time() - t0:.0f}s", flush=True)
    return np.array(out)


def scorer_v2(df):
    """The v2 detector exactly as served (embedding head + rule floor), without loading the legacy networks."""
    from api.services import model_orchestrator as mo
    mo.load_v2_heads()
    if "email" not in mo.V2_HEADS:
        raise SystemExit("AIML/email/v2/email_head.json not found - run python -m AIML.eval.train_v2_heads email")
    t0 = time.time()
    out = []
    for i, r in enumerate(df.itertuples()):
        out.append(float(mo._predict_email_sync(r.sender, r.subject, r.body)["phishing_probability"]))
        if (i + 1) % 500 == 0:
            print(f"  {i + 1}/{len(df)}  {time.time() - t0:.0f}s", flush=True)
    return np.array(out)


def scorer_m1(df):
    """The unified message model M1 exactly as served (AEGIS_MESSAGE_MODEL_DIR points at a downloaded run)."""
    from api.services import model_orchestrator as mo
    mo.load_v2_heads()
    mo.load_m1()
    if not mo.M1:
        raise SystemExit("message model M1 not found - set AEGIS_MESSAGE_MODEL_DIR or install AIML/message/m1")
    return scorer_v2(df)


SCORERS = {"prod": lambda d: scorer_prod(d, False), "prod_neural": lambda d: scorer_prod(d, True), "v2": scorer_v2, "m1": scorer_m1}


def register_scorer(name, fn):
    SCORERS[name] = fn


# ── metrics ────────────────────────────────────────────────────────────────────────────────────────
def tpr_at_fpr(neg, pos, fpr):
    neg = np.sort(neg)
    k = int(np.ceil(len(neg) * (1 - fpr))) - 1
    th = neg[min(max(k, 0), len(neg) - 1)]
    return float(np.mean(pos > th)), float(th)


def report(df, scores, tag):
    from sklearn.metrics import roc_auc_score
    df = df.assign(score=scores)
    neg_all = df[df.label == 0].score.values
    res = {"tag": tag, "n": int(len(df)), "sets": {}}
    for name, g in df.groupby("set"):
        r = {"n": int(len(g)), "phish": int((g.label == 1).sum()), "legit": int((g.label == 0).sum())}
        if r["phish"] and r["legit"]:
            r["auc"] = float(roc_auc_score(g.label, g.score))
        if r["phish"]:
            r["recall_at_0.5"] = float(np.mean(g[g.label == 1].score >= 0.5))
        if r["legit"]:
            r["false_alarm_at_0.5"] = float(np.mean(g[g.label == 0].score >= 0.5))
        for f in (0.01, 0.001):
            if r["phish"]:
                tp, th = tpr_at_fpr(neg_all, g[g.label == 1].score.values, f)
                r[f"tpr_at_pooled_fpr_{f}"] = tp
                r[f"threshold_{f}"] = th
        res["sets"][name] = r
    res["pooled_legit_n"] = int(len(neg_all))
    return res


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--scorer", default="prod")
    ap.add_argument("--n-llm", type=int, default=500)
    ap.add_argument("--n-legacy", type=int, default=500)
    ap.add_argument("--tag", default=None)
    a = ap.parse_args()
    df = load_sets(a.n_llm, a.n_legacy)
    print(df.groupby(["set", "label"]).size().to_string())
    scores = SCORERS[a.scorer](df)
    res = report(df, scores, a.tag or a.scorer)
    (OUT / f"email_{res['tag']}.json").write_text(json.dumps(res, indent=2))
    pd.DataFrame({"set": df["set"], "label": df.label, "score": scores}).to_csv(OUT / f"email_{res['tag']}_scores.csv", index=False)
    print(json.dumps(res, indent=2))


if __name__ == "__main__":
    main()
