# ===================================================================================================================
# AegisOne page model P1 - training (Kaggle T4 x2). build.py prepends AIML/url/urlnet_v10.py and
# AIML/url/page_summary.py, i.e. the exact text the server builds from the extension's page signals.
#
# Input   structured URL + page title + credential inputs + where forms submit + first 600 visible characters.
# Data    PhreshPhish (CC BY 4.0) WITH its page HTML: a stratified subset of train (newest 5% held out for
#         calibration), test = later in time. HTML is reduced to the summary as it streams in; never stored.
# Report  test AUC, TPR at 1 / 0.1% FPR (bootstrap 95% CI); false alarms on LEGITIMATE pages that ask for a password
#         (the pages where P1 actually runs) and recall on phishing pages with a password field.
# ===================================================================================================================
import argparse
import json
import math
import os
import random
import subprocess
import sys
import time
from concurrent.futures import ProcessPoolExecutor

import numpy as np

for _pkg in ("tldextract", "selectolax"):
    try:
        __import__(_pkg)
    except ImportError:
        subprocess.run([sys.executable, "-m", "pip", "install", "-q", _pkg], check=True)

REPO = "phreshphish/phreshphish"
OUT = os.environ.get("AEGIS_OUT", "/kaggle/working/page_p1")
BASE_MODEL = os.environ.get("AEGIS_PAGE_BASE", "thenlper/gte-small")
PAGE_LEN = 256


def log(*a):
    print(time.strftime("%H:%M:%S"), *a, flush=True)


def _summarise(args):
    url, html = args
    try:
        return summary_from_html(url, html, model_text(url))
    except Exception:
        return model_text(url) + " [title] - [inputs] no-credentials [forms] 0 submit none [text] "


def read_pages(split, max_rows, seed):
    """Stream url/label/date/html row groups from an even spread of files; HTML -> summary immediately."""
    import pyarrow.parquet as pq
    from huggingface_hub import HfFileSystem
    fs = HfFileSystem()
    files = sorted(fs.glob(f"datasets/{REPO}/data/{split}-*.parquet"))
    random.Random(seed).shuffle(files)
    urls, ys, dates, texts = [], [], [], []
    with ProcessPoolExecutor(4) as ex:
        for f in files:
            with fs.open(f, "rb", block_size=16 * 1024 * 1024) as fh:
                pf = pq.ParquetFile(fh)
                for rg in range(pf.num_row_groups):
                    t = pf.read_row_group(rg, columns=["url", "label", "date", "html"])
                    u = [str(x) for x in t.column("url").to_pylist()]
                    h = t.column("html").to_pylist()
                    texts += list(ex.map(_summarise, zip(u, h), chunksize=64))
                    urls += u
                    ys += [1 if str(l).lower().startswith("phish") else 0 for l in t.column("label").to_pylist()]
                    dates += [str(d) for d in t.column("date").to_pylist()]
                    del h, t
            log(f"{split}: {len(urls)} pages")
            if len(urls) >= max_rows:
                break
    return urls, np.array(ys, dtype=np.int64), dates, texts


def threshold_at(neg, fpr):
    neg = np.sort(neg)
    return float(neg[min(max(int(math.ceil(len(neg) * (1 - fpr))) - 1, 0), len(neg) - 1)])


def tpr_at_fpr(neg, pos, fpr):
    th = threshold_at(neg, fpr)
    return float(np.mean(pos > th)), th


def bootstrap_tpr(neg, pos, fpr, n=200, seed=0):
    r = np.random.default_rng(seed)
    vals = [tpr_at_fpr(r.choice(neg, len(neg)), r.choice(pos, len(pos)), fpr)[0] for _ in range(n)]
    return [float(np.percentile(vals, 2.5)), float(np.percentile(vals, 97.5))]


def encode_pages(tok, urls, texts, device="cpu"):
    enc = tok(texts, truncation=True, max_length=PAGE_LEN, padding=True, return_tensors="pt")
    return {"input_ids": enc["input_ids"].to(device), "attention_mask": enc["attention_mask"].to(device),
            "char_ids": char_ids(urls).to(device)}


class Collate:
    def __init__(self, tok):
        self.tok = tok

    def __call__(self, batch):
        enc = encode_pages(self.tok, [b[0] for b in batch], [b[1] for b in batch])
        enc["labels"] = torch.tensor([b[2] for b in batch])
        return enc


@torch.no_grad()
def predict_logits(model, tok, urls, texts, bs=256, device="cuda"):
    model.eval()
    out = []
    for i in range(0, len(urls), bs):
        enc = encode_pages(tok, urls[i:i + bs], texts[i:i + bs], device)
        with torch.autocast(device_type="cuda", dtype=torch.float16, enabled=device == "cuda"):
            lg = model(**enc).float()
        out.append((lg[:, 1] - lg[:, 0]).cpu().numpy())
    return np.concatenate(out) if out else np.zeros(0)


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--smoke", action="store_true")
    ap.add_argument("--train-rows", type=int, default=300000)
    ap.add_argument("--test-rows", type=int, default=60000)
    ap.add_argument("--epochs", type=float, default=2.0)
    ap.add_argument("--bs", type=int, default=128)
    ap.add_argument("--lr", type=float, default=4e-5)
    ap.add_argument("--head-lr", type=float, default=1e-3)
    a = ap.parse_args()
    random.seed(0)
    np.random.seed(0)
    torch.manual_seed(0)
    device = "cuda" if torch.cuda.is_available() else "cpu"
    log("device", device, torch.cuda.device_count(), "GPU(s)")
    tr_u, tr_y, tr_d, tr_t = read_pages("train", 2000 if a.smoke else a.train_rows, 1)
    te_u, te_y, _, te_t = read_pages("test", 1000 if a.smoke else a.test_rows, 2)
    log("example summary:", tr_t[0][:400])

    order = np.argsort(np.array(tr_d))
    k = max(100, int(len(order) * 0.05))
    va_idx, fit_idx = order[-k:], order[:-k]
    data = [(tr_u[i], tr_t[i], int(tr_y[i])) for i in fit_idx]
    va_u, va_t, va_y = [tr_u[i] for i in va_idx], [tr_t[i] for i in va_idx], tr_y[va_idx]
    log(f"fit {len(data)} ({np.mean([d[2] for d in data]):.1%} phishing), validation {len(va_u)}, test {len(te_u)}")

    from transformers import AutoModel, AutoTokenizer, get_linear_schedule_with_warmup
    tok = AutoTokenizer.from_pretrained(BASE_MODEL)
    net = UrlNetV10(AutoModel.from_pretrained(BASE_MODEL, torch_dtype=torch.float32).float()).to(device)
    model = torch.nn.DataParallel(net) if torch.cuda.device_count() > 1 else net
    dl = torch.utils.data.DataLoader(data, batch_size=a.bs, shuffle=True, collate_fn=Collate(tok),
                                     num_workers=0 if os.name == "nt" else 4, drop_last=True)
    steps = int(len(dl) * a.epochs) if not a.smoke else 10
    opt = torch.optim.AdamW([{"params": net.encoder.parameters(), "lr": a.lr},
                             {"params": list(net.char.parameters()) + list(net.head.parameters()), "lr": a.head_lr}],
                            weight_decay=0.01)
    sch = get_linear_schedule_with_warmup(opt, int(0.06 * steps), steps)
    scaler = torch.amp.GradScaler("cuda", enabled=device == "cuda")
    loss_fn = torch.nn.CrossEntropyLoss()
    step, t0 = 0, time.time()
    while step < steps:
        model.train()
        for batch in dl:
            batch = {k_: v.to(device) for k_, v in batch.items()}
            labels = batch.pop("labels")
            with torch.autocast(device_type="cuda", dtype=torch.float16, enabled=device == "cuda"):
                loss = loss_fn(model(**batch).float(), labels)
            scaler.scale(loss).backward()
            scaler.unscale_(opt)
            torch.nn.utils.clip_grad_norm_(net.parameters(), 1.0)
            scaler.step(opt)
            scaler.update()
            opt.zero_grad(set_to_none=True)
            sch.step()
            step += 1
            if step % 200 == 0 or step == steps:
                log(f"step {step}/{steps}  loss {loss.item():.4f}  {time.time() - t0:.0f}s")
            if step >= steps:
                break

    va_z = predict_logits(net, tok, va_u, va_t, device=device)
    T = 1.0
    for _ in range(300):
        p = 1 / (1 + np.exp(-va_z / T))
        T = max(0.05, T - 0.5 * np.mean((p - va_y) * (-va_z / T ** 2)))
    sig = lambda z: 1 / (1 + np.exp(-z / T))  # noqa: E731
    pv = sig(va_z)
    va_pw = np.array(["[inputs] password" in t for t in va_t])
    neg_all, neg_pw = pv[va_y == 0], pv[(va_y == 0) & va_pw]
    # thresholds must hold on legitimate pages overall AND on legitimate pages that ask for a password
    th = {}
    for name, f in (("suspicious", 0.05), ("warn", 0.01), ("block", 0.001)):
        th[name] = max(threshold_at(neg_all, f), threshold_at(neg_pw, f) if len(neg_pw) >= 200 else 0.0)
    log("temperature", round(T, 3), "thresholds", th, "legit password pages in validation", len(neg_pw))

    pt = sig(predict_logits(net, tok, te_u, te_t, device=device))
    te_pw = np.array(["[inputs] password" in t for t in te_t])
    from sklearn.metrics import average_precision_score, roc_auc_score
    tn, tp = pt[te_y == 0], pt[te_y == 1]
    m = {"test_n": len(te_u), "test_auc": float(roc_auc_score(te_y, pt)), "test_ap": float(average_precision_score(te_y, pt))}
    for f in (0.01, 0.001):
        m[f"test_tpr_at_fpr_{f}"] = tpr_at_fpr(tn, tp, f)[0]
        m[f"test_tpr_at_fpr_{f}_ci95"] = bootstrap_tpr(tn, tp, f, n=30 if a.smoke else 200)
    m["test_recall_at_warn"] = float(np.mean(tp >= th["warn"]))
    m["test_fpr_at_warn"] = float(np.mean(tn >= th["warn"]))
    m["test_legit_password_pages_n"] = int(((te_y == 0) & te_pw).sum())
    m["test_legit_password_pages_fpr_at_warn"] = float(np.mean(pt[(te_y == 0) & te_pw] >= th["warn"])) if m["test_legit_password_pages_n"] else None
    m["test_phish_password_pages_recall_at_warn"] = float(np.mean(pt[(te_y == 1) & te_pw] >= th["warn"])) if ((te_y == 1) & te_pw).any() else None
    log("metrics", json.dumps(m, indent=1))

    os.makedirs(OUT, exist_ok=True)
    from safetensors.torch import save_file
    save_file({k_: v.contiguous().cpu() for k_, v in net.state_dict().items()}, os.path.join(OUT, "urlnet_v10.safetensors"))
    net.encoder.config.save_pretrained(OUT)
    tok.save_pretrained(OUT)
    json.dump({"arch": "urlnet_v10", "input": "page_summary", "page_len": PAGE_LEN, "temperature": float(T), "thresholds": th,
               "base_model": BASE_MODEL, "trained": time.strftime("%Y-%m-%d"), "fit_n": len(data), "validation_n": len(va_u),
               "data": "phreshphish v1.0.1 (CC BY 4.0) train subset with HTML, newest 5% held out; test = later test split subset"},
              open(os.path.join(OUT, "calibration.json"), "w"), indent=2)
    json.dump(m, open(os.path.join(OUT, "metrics.json"), "w"), indent=2)
    log("saved to", OUT)


if __name__ == "__main__":
    main()
