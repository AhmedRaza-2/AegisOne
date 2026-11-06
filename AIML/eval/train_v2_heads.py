"""
Train the shipped v2 e-mail and text/SMS detectors (frozen sentence embedding + calibrated logistic head) and write
everything the server needs:

  AIML/email/v2/email_head.json             AIML/text_general/v2/text_head.json      (the detectors, JSON only)
  AIML/email/v2/email_reference.npz         AIML/text_general/v2/text_reference.npz  (frozen reference + replay sets
                                                                                      for organisation retraining)
  AIML/eval/results/<kind>_v2_training.json  (data, split sizes, calibration, thresholds)

Data (nothing from the evaluation sets in AIML/eval is used for training, calibration or thresholds):
  email: seven public corpora (TREC-05/06/07, CEAS-08, Enron, SpamAssassin, Ling; puyang2025/seven-phishing-email-datasets)
         + Nazario phishing and the other sources of AIML/email/final_phishing_dataset_email.csv
         + LLM-generated modern phishing AND legitimate mail not used for evaluation (Dizzzy0x00/LLMGen-Phishing-Email-Dataset)
  text:  UCI SMS Spam Collection (rows not used for evaluation) + CloveAI/india-spam-sms (rows not used for evaluation)
         + short modern phishing / legitimate messages (first lines of the LLM-generated mail above)
         + AIML/eval/pk_sms_train.csv (Pakistani seed messages written with DIFFERENT templates from the evaluation set)
10% of the training data is held out for Platt calibration and for the WARN / BLOCK thresholds (1% / 0.1% false alarms).

Run:  python -m AIML.eval.train_v2_heads email      |   python -m AIML.eval.train_v2_heads text
"""
import json
import sys
import time
from pathlib import Path

import numpy as np
import pandas as pd

ROOT = Path(__file__).resolve().parents[2]
sys.path.insert(0, str(ROOT))
from AIML.embed_head import EmbedHead, build_spec  # noqa: E402
from AIML.eval.email_embed_experiment import build_pool, embed_cached, modern_train, text_of  # noqa: E402
from AIML.eval.eval_email import HF, OUT, load_sets as load_email_eval  # noqa: E402

VERSION = "2.0.0"


def _split(n, frac=0.1, seed=3):
    idx = np.random.default_rng(seed).permutation(n)
    k = int(n * frac)
    return idx[k:], idx[:k]


def email():
    from AIML.email.features_v2 import NAMES, batch_features
    ev = load_email_eval(500, 500)
    pool = build_pool(3000)
    mod = modern_train(ev)
    legacy = pd.read_csv(ROOT / "AIML/email/final_phishing_dataset_email.csv")
    extra = []
    for src, g in legacy.groupby("source"):
        if src in ("enron_data",):          # already well covered by the seven corpora
            continue
        k = 1500
        a, b = g[g.label == 1], g[g.label == 0]
        extra.append(pd.concat([a.sample(min(k, len(a)), random_state=5), b.sample(min(k // 2, len(b)), random_state=5)]))
    ex = pd.concat(extra)
    ex = pd.DataFrame({"src": "aegis_" + ex.source.astype(str), "sender": ex.sender.fillna("").astype(str), "subject": ex.subject.fillna("").astype(str),
                       "body": ex.body.fillna("").astype(str).str.slice(0, 4000), "label": ex.label.astype(int)})
    from AIML.eval.export_message_data import hard_rows
    hr = hard_rows()
    hard = hr[hr.channel == "email"].drop(columns="channel").reset_index(drop=True)   # look-alike genuine mail + paired scams
    data = pd.concat([pool, mod, ex, hard], ignore_index=True)
    print("training data:", data.groupby(["src", "label"]).size().to_string(), flush=True)

    def design(df, tag):
        e = embed_cached([text_of(s, b) for s, b in zip(df.subject, df.body)], "en", tag)
        return np.hstack([e, batch_features(df.sender, df.subject, df.body)])

    X = np.vstack([design(pool, "pool"), design(mod, "modern"), design(ex, "aegis_extra"), design(hard, "hard_email")])
    y = data.label.values.astype(int)
    tr, cal = _split(len(y))
    Xe = design(ev, "eval")
    spec = build_spec("email", "en", X[tr], y[tr], NAMES, l2=2.0, holdout=(X[cal], y[cal]), legit_for_thresholds=X[cal][y[cal] == 0],
                      meta={"version": f"email-{VERSION}", "backbone": "BAAI/bge-small-en-v1.5", "trained": time.strftime("%Y-%m-%d"),
                            "train_n": int(len(tr)), "calibration_n": int(len(cal)),
                            "sources": sorted(data.src.unique().tolist())})
    _write("email", spec, X, y, tr, Xe, ev.label.values.astype(int))


def text():
    from AIML.text_general.features_v2 import NAMES, batch_features
    from AIML.eval.eval_text import load_sets as load_text_eval
    ev = load_text_eval()
    used = set(ev.text)
    rows = []
    u = pd.read_parquet(HF / "sms_spam/plain_text/train-00000-of-00001.parquet")
    rows += [("uci", str(t).strip(), int(y)) for t, y in zip(u.sms, u.label) if str(t).strip() not in used]
    ip = pd.read_parquet(HF / "india-spam-sms/data/train-00000-of-00001.parquet")
    ip = ip[~ip.text.isin(used)]
    ip = pd.concat([ip[ip.label == 1].sample(1500, random_state=5), ip[ip.label == 0].sample(1500, random_state=5)])
    rows += [("india", t, int(y)) for t, y in zip(ip.text, ip.label)]
    g = pd.read_csv(HF / "LLMGen-Phishing-Email-Dataset/GPT_Phishing_Email_dataset.csv")
    from AIML.eval.eval_email import parse_llmgen
    eval_bodies = set(load_email_eval(500, 500).body.str.slice(0, 80))
    short = []
    for c, y in zip(g.content, g.label):
        _, _, b = parse_llmgen(str(c))
        if b[:80] in eval_bodies:
            continue
        short.append(("llmgen_short", " ".join(b.split()[:45]), int(y)))
    rows += short[:1600]
    for name, src in (("pk_sms_train.csv", "pk_seed"), ("transactional_train.csv", "transactional_seed")):
        f = ROOT / "AIML/eval" / name
        if f.exists():
            p = pd.read_csv(f)
            rows += [(src, t, int(y)) for t, y in zip(p.text, p.label)]
    from AIML.eval.export_message_data import hard_rows
    hr = hard_rows()
    for src, ch, subj, body, y in zip(hr.src, hr.channel, hr.subject, hr.body, hr.label):
        rows.append((src, (body if ch == "sms" else " ".join(body.split()[:45])), int(y)))   # short form, like the other sources
    from AIML.message.english import is_english
    data = pd.DataFrame(rows, columns=["src", "text", "label"])
    data = data[data.text.map(is_english)].sort_values("src", kind="stable").reset_index(drop=True)   # English only
    print("training data:", data.groupby(["src", "label"]).size().to_string(), flush=True)
    # one cache per source, so adding a source does not re-embed the others
    emb = np.vstack([embed_cached(g.text.tolist(), "en", f"text_{src}") for src, g in data.groupby("src", sort=True)])
    X = np.hstack([emb, batch_features(data.text)])
    y = data.label.values.astype(int)
    tr, cal = _split(len(y))
    Xe = np.hstack([embed_cached(ev.text.tolist(), "en", "text_eval"), batch_features(ev.text)])
    spec = build_spec("text", "en", X[tr], y[tr], NAMES, l2=2.0, holdout=(X[cal], y[cal]), legit_for_thresholds=X[cal][y[cal] == 0],
                      meta={"version": f"text-{VERSION}", "backbone": "BAAI/bge-small-en-v1.5", "trained": time.strftime("%Y-%m-%d"),
                            "train_n": int(len(tr)), "calibration_n": int(len(cal)), "sources": sorted(data.src.unique().tolist())})
    _write("text", spec, X, y, tr, Xe, ev.label.values.astype(int))


def _write(kind, spec, X, y, tr, X_ref, y_ref):
    out = ROOT / ("AIML/email/v2" if kind == "email" else "AIML/text_general/v2")
    out.mkdir(parents=True, exist_ok=True)
    (out / f"{kind}_head.json").write_text(json.dumps(spec))
    rng = np.random.default_rng(11)
    pos, neg = tr[y[tr] == 1], tr[y[tr] == 0]
    rep = np.concatenate([rng.choice(pos, min(600, len(pos)), replace=False), rng.choice(neg, min(600, len(neg)), replace=False)])
    np.savez_compressed(out / f"{kind}_reference.npz", X_ref=X_ref.astype(np.float32), y_ref=y_ref.astype(np.int8),
                        X_replay=X[rep].astype(np.float32), y_replay=y[rep].astype(np.int8))
    h = EmbedHead(spec, lambda *a: None)
    from sklearn.metrics import roc_auc_score
    p = h.proba_from_design(X_ref)
    summary = {"kind": kind, "meta": spec["meta"], "thresholds": spec["thresholds"], "platt": spec["platt"],
               "reference_auc": float(roc_auc_score(y_ref, p)), "reference_n": int(len(y_ref))}
    (OUT / f"{kind}_v2_training.json").write_text(json.dumps(summary, indent=2))
    print(json.dumps(summary, indent=2))


if __name__ == "__main__":
    {"email": email, "text": text}[sys.argv[1]]()
