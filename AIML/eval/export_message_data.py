"""
Export the training data of the unified message model M1 as one Parquet file + the shared code, ready to upload as a
private Kaggle dataset (AIML/message/kaggle/README.md).

Same sources and the SAME exclusions as AIML/eval/train_v2_heads.py - nothing from the evaluation sets in AIML/eval is
used - but with far more rows per source (the v2 heads used a few thousand to keep a frozen-embedding fit fast; a
fine-tuned network profits from everything).

Columns: channel (email|sms), sender, subject, body, label (1 = phishing / scam), src.
Run:  python -m AIML.eval.export_message_data
"""
import shutil
import sys
from pathlib import Path

import pandas as pd

ROOT = Path(__file__).resolve().parents[2]
sys.path.insert(0, str(ROOT))
from AIML.eval.email_embed_experiment import build_pool, modern_train  # noqa: E402
from AIML.eval.eval_email import HF, load_sets as load_email_eval, parse_llmgen  # noqa: E402
from AIML.eval.eval_text import load_sets as load_text_eval  # noqa: E402

OUT = ROOT / "AIML/message/kaggle/dataset"


def email_rows():
    ev = load_email_eval(500, 500)
    pool = build_pool(12000)
    mod = modern_train(ev, n=20000)
    legacy = pd.read_csv(ROOT / "AIML/email/final_phishing_dataset_email.csv")
    extra = []
    for src, g in legacy.groupby("source"):
        if src == "enron_data":
            continue
        a, b = g[g.label == 1], g[g.label == 0]
        extra.append(pd.concat([a.sample(min(4000, len(a)), random_state=5), b.sample(min(2000, len(b)), random_state=5)]))
    ex = pd.concat(extra)
    ex = pd.DataFrame({"src": "aegis_" + ex.source.astype(str), "sender": ex.sender.fillna("").astype(str), "subject": ex.subject.fillna("").astype(str),
                       "body": ex.body.fillna("").astype(str).str.slice(0, 4000), "label": ex.label.astype(int)})
    d = pd.concat([pool, mod, ex], ignore_index=True)
    d["channel"] = "email"
    return d[["channel", "sender", "subject", "body", "label", "src"]]


def text_rows():
    ev = load_text_eval()
    used = set(ev.text)
    rows = []
    u = pd.read_parquet(HF / "sms_spam/plain_text/train-00000-of-00001.parquet")
    rows += [("uci", str(t).strip(), int(y)) for t, y in zip(u.sms, u.label) if str(t).strip() not in used]
    ip = pd.read_parquet(HF / "india-spam-sms/data/train-00000-of-00001.parquet")
    ip = ip[~ip.text.isin(used)]
    ip = pd.concat([ip[ip.label == 1].sample(min(4000, (ip.label == 1).sum()), random_state=5),
                    ip[ip.label == 0].sample(min(4000, (ip.label == 0).sum()), random_state=5)])
    rows += [("india", t, int(y)) for t, y in zip(ip.text, ip.label)]
    g = pd.read_csv(HF / "LLMGen-Phishing-Email-Dataset/GPT_Phishing_Email_dataset.csv")
    eval_bodies = set(load_email_eval(500, 500).body.str.slice(0, 80))
    for c, y in zip(g.content, g.label):
        _, _, b = parse_llmgen(str(c))
        if b[:80] not in eval_bodies:
            rows.append(("llmgen_short", " ".join(b.split()[:45]), int(y)))
    for name, src in (("pk_sms_train.csv", "pk_seed"), ("transactional_train.csv", "transactional_seed")):
        p = pd.read_csv(ROOT / "AIML/eval" / name)
        rows += [(src, t, int(y)) for t, y in zip(p.text, p.label)]
    d = pd.DataFrame(rows, columns=["src", "body", "label"])
    d["channel"], d["sender"], d["subject"] = "sms", "", ""
    return d[["channel", "sender", "subject", "body", "label", "src"]]


def _clean_generated(t: str) -> str:
    """Strip the generator's formatting artefacts (code fences, 'SMS Message 3', a bare sender line, 'From:' lines) so the
    classifier cannot learn them as signals: every kind of message (genuine or scam) goes through the same cleaning."""
    import re
    t = re.sub(r"```\w*", chr(10), t.replace("**", ""))
    lines = [ln.strip().strip("*").strip() for ln in t.split(chr(10)) if ln.strip().strip("*").strip()]
    lines = [ln for ln in lines if not re.match(r"^(from|to|sender|channel)\s*:", ln, re.I)]
    while len(lines) > 1 and (re.match(r"^(sms|text|message|e-?mail)[^.!?]{0,25}:?$", lines[0], re.I)
                              or (len(lines[0]) <= 28 and not re.search(r"[0-9:.!?@/]", lines[0]) and not lines[0].lower().startswith("subject"))):
        lines.pop(0)
    return chr(10).join(lines).strip()


def hard_rows():
    """Hard genuine messages + paired scams written by AIML/message/kaggle/gen_hard_messages.py (optional file)."""
    import json
    files = [f for f in (ROOT / "AIML/eval/data/hard_messages.jsonl", ROOT / "AIML/eval/data/hard_en.jsonl") if f.exists()]
    if not files:
        return pd.DataFrame(columns=["channel", "sender", "subject", "body", "label", "src"])
    import re
    lead = re.compile(r"^[\s*_`#>\-]*(?:\*\*)?(?:sms|e-?mail|message|text)(?:\*\*)?\s*[:\-]\s*", re.I)
    rows = []
    for line in (ln for f in files for ln in f.open(encoding="utf-8")):
        r = json.loads(line)
        if r["lang"] == "ur":      # the generator's Urdu-script output is too garbled to train on (checked by reading samples)
            continue
        text, subject = _clean_generated(r["text"]), ""
        text = lead.sub("", text).strip(' "“”')
        if len(text) < 25:
            continue
        if r["channel"] == "email":
            first, _, rest = text.partition(chr(10))
            if first.lower().startswith("subject:"):
                subject, text = first.split(":", 1)[1].strip(), rest.strip() or first
        rows.append((r["channel"], "", subject, text, int(r["label"]), "hard_scam" if r["label"] else "hard_genuine"))
    d = pd.DataFrame(rows, columns=["channel", "sender", "subject", "body", "label", "src"])
    from AIML.message.english import is_english
    d = d[d.body.map(is_english)]                                           # the product supports English only
    return d.drop_duplicates(subset=["channel", "body"]).reset_index(drop=True)


def main():
    e, t, h = email_rows(), text_rows(), hard_rows()
    d = pd.concat([e, t, h], ignore_index=True)
    d["body"] = d.body.astype(str).str.strip()
    d = d[d.body.str.len() >= 8]
    d = d.drop_duplicates(subset=["channel", "body"]).reset_index(drop=True)
    from AIML.message.english import is_english
    n0 = len(d)
    d = d[d.body.map(is_english)].reset_index(drop=True)                    # English only
    print("English filter kept", len(d), "of", n0)
    # the evaluation sets must stay unseen: drop any row whose body is (or starts like) an evaluation body
    ev_e, ev_t = load_email_eval(500, 500), load_text_eval()
    bad = set(ev_e.body.str.slice(0, 80)) | set(ev_t.text.str.slice(0, 80))
    d = d[~d.body.str.slice(0, 80).isin(bad)].reset_index(drop=True)
    OUT.mkdir(parents=True, exist_ok=True)
    d.to_parquet(OUT / "train.parquet", index=False)
    print(d.groupby(["channel", "src", "label"]).size().to_string())
    print("total", len(d), "phishing share", round(d.label.mean(), 3))
    # the code the kernel imports (training and serving use the same files)
    code = OUT / "code" / "AIML"
    for rel in ("message/__init__.py", "message/context.py", "message/net.py", "email/features_v2.py", "text_general/features_v2.py"):
        (code / rel).parent.mkdir(parents=True, exist_ok=True)
        shutil.copy(ROOT / "AIML" / rel, code / rel)
    (OUT / "dataset-metadata.json").write_text('{"title": "AegisOne message data", "id": "ahmedraza2009/aegisone-message-data", '
                                               '"licenses": [{"name": "other"}]}')
    print("wrote", OUT)


if __name__ == "__main__":
    main()
