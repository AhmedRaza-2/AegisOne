"""
AegisOne message model M1 - one context-aware model for e-mail, SMS and WhatsApp/chat. Trained on Kaggle (T4 x2).

Backbone  intfloat/multilingual-e5-small (Wang et al. 2024; 100 languages incl. Urdu), FULLY fine-tuned - the v2
          detectors used it frozen. Input = channel + sender kind + link/registered-domain context + subject + body
          (AIML/message/context.py, the same code the API runs), plus a dense block of the structural features.
Heads     phishing/scam vs legitimate (cross-entropy) and 9 intent heads (multi-label BCE, weight 0.3): what the message
          asks for - credentials, payment, a code, secrecy, a reward, a shared file, authority, a link that is not the
          sender's. The intent heads are the basis of the explanation layer.
Data      /kaggle/input/aegisone-message-data/train.parquet (AIML/eval/export_message_data.py): 7 public e-mail corpora,
          Nazario + 3 more phishing sources, LLM-written modern phishing AND legitimate mail, UCI SMS, India SMS,
          Pakistani + transactional SMS seeds. The evaluation sets are excluded.
Weights   modern LLM-written mail and the Pakistani / transactional seeds are repeated (the weak spots of the corpora).
Holdout   --holdout-source NAME trains WITHOUT one corpus and reports AUC / TPR on it: the cross-corpus test that
          pooled in-distribution scores hide (BDCC 2026).
Output    /kaggle/working/message_m1/  weights (safetensors), config, tokenizer, calibration.json (temperature and
          WARN / BLOCK thresholds at 1% / 0.1% false alarms PER CHANNEL), metrics.json.
"""
import argparse
import glob
import json
import math
import os
import sys
import time

import numpy as np
import pandas as pd
import torch

def _find(rel):
    """Locate a dataset file wherever Kaggle mounted it (the mount layout differs between runtimes)."""
    for base, _dirs, files in os.walk("/kaggle/input"):
        if os.path.basename(rel) in files and os.path.join(base, os.path.basename(rel)).replace("\\", "/").endswith(rel):
            return os.path.join(base, os.path.basename(rel))
    return None


_ctx = _find("AIML/message/context.py")
if _ctx:
    sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.dirname(_ctx))))
sys.path.insert(0, os.environ.get("AEGIS_CODE", "."))
from AIML.message import context as C  # noqa: E402
from AIML.message.net import MAX_LEN, MessageNet, encode  # noqa: E402

BASE = os.environ.get("AEGIS_MSG_BASE", "BAAI/bge-small-en-v1.5")        # English only (round 3); was intfloat/multilingual-e5-small
PREFIX = "query: " if "e5" in BASE else ""
OUT = os.environ.get("AEGIS_OUT", "/kaggle/working/message_m1")
UPWEIGHT = {"llmgen_train": 3, "llmgen_short": 3, "pk_seed": 8, "transactional_seed": 4, "aegis_email_text": 1,
            "hard_genuine": 2, "hard_scam": 2}   # look-alike genuine messages and their paired scams (gen_hard_messages.py)


def log(*a):
    print(time.strftime("%H:%M:%S"), *a, flush=True)


def threshold_at(neg, fpr):
    neg = np.sort(neg)
    return float(neg[min(max(int(math.ceil(len(neg) * (1 - fpr))) - 1, 0), len(neg) - 1)])


def tpr_at(neg, pos, fpr):
    return float(np.mean(pos > threshold_at(neg, fpr))) if len(neg) and len(pos) else None


class Collate:
    def __init__(self, tok):
        self.tok = tok

    def __call__(self, batch):
        enc = encode(self.tok, [b[0] for b in batch], prefix=PREFIX)
        enc["labels"] = torch.tensor([b[1] for b in batch])
        enc["intents"] = torch.tensor(np.stack([b[2] for b in batch]))
        return enc


@torch.no_grad()
def predict(model, tok, rows, bs=256, device="cuda"):
    model.eval()
    z, it = [], []
    for i in range(0, len(rows), bs):
        enc = encode(tok, rows[i:i + bs], device, prefix=PREFIX)
        with torch.autocast(device_type="cuda", dtype=torch.float16, enabled=device == "cuda"):
            lg, ig = model(**enc)
        z.append((lg[:, 1] - lg[:, 0]).float().cpu().numpy())
        it.append(torch.sigmoid(ig.float()).cpu().numpy())
    return (np.concatenate(z), np.concatenate(it)) if z else (np.zeros(0), np.zeros((0, len(C.INTENTS))))


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--smoke", action="store_true")
    ap.add_argument("--holdout-source", default="")
    ap.add_argument("--epochs", type=float, default=3.0)
    ap.add_argument("--bs", type=int, default=64)
    ap.add_argument("--lr", type=float, default=3e-5)
    ap.add_argument("--head-lr", type=float, default=1e-3)
    ap.add_argument("--intent-weight", type=float, default=0.3)
    a = ap.parse_args()
    torch.manual_seed(0)
    np.random.seed(0)
    device = "cuda" if torch.cuda.is_available() else "cpu"
    log("device", device, torch.cuda.device_count(), "GPU(s)")
    path = _find("train.parquet") or os.environ.get("AEGIS_DATA", "train.parquet")
    log("data file:", path, "| code from:", _ctx)
    d = pd.read_parquet(path)
    if a.smoke:
        d = d.groupby("src", group_keys=False).apply(lambda g: g.sample(min(len(g), 40), random_state=0)).reset_index(drop=True)
    held = d[d.src == a.holdout_source] if a.holdout_source else d.iloc[0:0]
    d = d[d.src != a.holdout_source] if a.holdout_source else d
    rng = np.random.default_rng(3)
    cal_mask = rng.random(len(d)) < 0.10
    fit, cal = d[~cal_mask].reset_index(drop=True), d[cal_mask].reset_index(drop=True)
    log(f"fit {len(fit)}  calibration {len(cal)}  held-out source '{a.holdout_source}' {len(held)}")

    def rows_of(df):
        return list(zip(df.channel, df.sender, df.subject, df.body))

    fit_rows = rows_of(fit)
    log("computing intent targets ...")
    intents = [C.intent_targets(*r) for r in fit_rows]
    reps = fit.src.map(lambda s: UPWEIGHT.get(s, 1)).values
    idx = np.repeat(np.arange(len(fit)), reps)
    data = [(fit_rows[i], int(fit.label.iloc[i]), intents[i]) for i in idx]
    log(f"training examples after up-weighting: {len(data)}  intent prevalence: "
        + ", ".join(f"{k} {v:.2f}" for k, v in zip(C.INTENTS, np.mean(intents, 0))))

    from transformers import AutoModel, AutoTokenizer, get_linear_schedule_with_warmup
    tok = AutoTokenizer.from_pretrained(BASE)
    net = MessageNet(AutoModel.from_pretrained(BASE, torch_dtype=torch.float32).float()).to(device)
    model = torch.nn.DataParallel(net) if torch.cuda.device_count() > 1 else net
    dl = torch.utils.data.DataLoader(data, batch_size=a.bs, shuffle=True, collate_fn=Collate(tok), num_workers=0 if os.name == "nt" else 4,
                                     drop_last=True)
    steps = int(len(dl) * a.epochs) if not a.smoke else 6
    opt = torch.optim.AdamW([{"params": net.encoder.parameters(), "lr": a.lr},
                             {"params": list(net.dense.parameters()) + list(net.head.parameters()) + list(net.intent.parameters()), "lr": a.head_lr}],
                            weight_decay=0.01)
    sch = get_linear_schedule_with_warmup(opt, int(0.06 * steps), steps)
    scaler = torch.amp.GradScaler("cuda", enabled=device == "cuda")
    ce, bce = torch.nn.CrossEntropyLoss(), torch.nn.BCEWithLogitsLoss()
    step, t0 = 0, time.time()
    while step < steps:
        model.train()
        for batch in dl:
            batch = {k: v.to(device) for k, v in batch.items()}
            labels, tgt = batch.pop("labels"), batch.pop("intents")
            with torch.autocast(device_type="cuda", dtype=torch.float16, enabled=device == "cuda"):
                lg, ig = model(**batch)
                loss = ce(lg.float(), labels) + a.intent_weight * bce(ig.float(), tgt)
            scaler.scale(loss).backward()
            scaler.unscale_(opt)
            torch.nn.utils.clip_grad_norm_(net.parameters(), 1.0)
            scaler.step(opt)
            scaler.update()
            opt.zero_grad(set_to_none=True)
            sch.step()
            step += 1
            if step % 100 == 0 or step == steps:
                log(f"step {step}/{steps}  loss {loss.item():.4f}  {time.time() - t0:.0f}s")
            if step >= steps:
                break

    # calibration: ONE temperature, thresholds per channel (an SMS and an e-mail are different populations)
    cz, _ = predict(net, tok, rows_of(cal), device=device)
    cy = cal.label.values
    T = 1.0
    for _ in range(300):
        p = 1 / (1 + np.exp(-cz / T))
        T = max(0.05, T - 0.5 * np.mean((p - cy) * (-cz / T ** 2)))
    sig = lambda z: 1 / (1 + np.exp(-z / T))  # noqa: E731
    cp = sig(cz)
    th, metrics = {}, {"calibration_n": int(len(cal))}
    from sklearn.metrics import roc_auc_score
    for ch in C.CHANNELS:
        m = (cal.channel == ch).values
        if m.sum() < 50 or len(set(cy[m])) < 2:
            continue
        neg, pos = cp[m & (cy == 0)], cp[m & (cy == 1)]
        th[ch] = {"suspicious": threshold_at(neg, 0.05), "warn": threshold_at(neg, 0.01), "block": threshold_at(neg, 0.001),
                  "legit_n": int(len(neg))}
        metrics[f"cal_{ch}_auc"] = float(roc_auc_score(cy[m], cp[m]))
        metrics[f"cal_{ch}_tpr_at_fpr_0.01"] = tpr_at(neg, pos, 0.01)
        metrics[f"cal_{ch}_tpr_at_fpr_0.001"] = tpr_at(neg, pos, 0.001)
    for s, g in cal.groupby("src"):
        if g.label.nunique() == 2 and len(g) >= 40:
            metrics[f"cal_src_auc[{s}]"] = float(roc_auc_score(g.label, cp[g.index]))
    if len(held):
        hz, _ = predict(net, tok, rows_of(held), device=device)
        hp, hy = sig(hz), held.label.values
        ch = held.channel.iloc[0]
        metrics[f"heldout_source"] = a.holdout_source
        metrics["heldout_n"] = int(len(held))
        if len(set(hy)) == 2:
            metrics["heldout_auc"] = float(roc_auc_score(hy, hp))
            metrics["heldout_tpr_at_fpr_0.01"] = tpr_at(hp[hy == 0], hp[hy == 1], 0.01)
        if ch in th:
            metrics["heldout_recall_at_warn"] = float(np.mean(hp[hy == 1] >= th[ch]["warn"])) if (hy == 1).any() else None
            metrics["heldout_false_alarm_at_warn"] = float(np.mean(hp[hy == 0] >= th[ch]["warn"])) if (hy == 0).any() else None
    # how well do the intent heads recover the lexicon intents on unseen calibration messages?
    _, ip = predict(net, tok, rows_of(cal), device=device)
    it = np.stack([C.intent_targets(*r) for r in rows_of(cal)])
    for j, k in enumerate(C.INTENTS):
        if 0 < it[:, j].sum() < len(it):
            metrics[f"intent_auc[{k}]"] = float(roc_auc_score(it[:, j], ip[:, j]))
    log("temperature", round(T, 3), "thresholds", json.dumps(th))
    log("metrics", json.dumps(metrics, indent=1))

    os.makedirs(OUT, exist_ok=True)
    from safetensors.torch import save_file
    save_file({k: v.contiguous().cpu() for k, v in net.state_dict().items()}, os.path.join(OUT, "message_m1.safetensors"))
    net.encoder.config.save_pretrained(OUT)
    tok.save_pretrained(OUT)
    json.dump({"arch": "message_m1", "temperature": float(T), "thresholds": th, "base_model": BASE, "prefix": PREFIX, "max_len": MAX_LEN, "intents": C.INTENTS,
               "trained": time.strftime("%Y-%m-%d"), "fit_n": int(len(fit)), "holdout_source": a.holdout_source,
               "data": "aegisone-message-data (see AIML/eval/export_message_data.py)"},
              open(os.path.join(OUT, "calibration.json"), "w"), indent=2)
    json.dump(metrics, open(os.path.join(OUT, "metrics.json"), "w"), indent=2)
    log("saved to", OUT)


if __name__ == "__main__":
    main()
