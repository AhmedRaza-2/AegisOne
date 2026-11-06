"""
AegisOne URL model v9 - v8 plus long-tail legitimate web traffic (step U3, second half).

Why    v8 (PhreshPhish only) doubled false alarms on ordinary long-tail pages (c4: 15.25% vs 8.4%): PhreshPhish's
       2024-25 benign traffic rarely contains older query-heavy CMS URLs (?page_id=, .php?id=, /index.php/...).
Adds   ~200k real URLs of ordinary web pages from allenai/c4 TRAIN shards (max 3 per host, .pk hosts kept in full),
       with every registered domain of the local evaluation shard (c4 validation 00000) removed, so the local
       long-tail test stays domain-disjoint. 15% of these benign URLs also get a padding copy, so "has a long
       benign-looking path" is no longer a phishing cue by itself (v8 learned it from padding-augmented phishing).
Calib  WARN/BLOCK thresholds at 1% / 0.1% FPR over BOTH held-out benign pools (PhreshPhish newest 5% + 5% of c4).

Original v8 notes:

Data   PhreshPhish (phreshphish/phreshphish, CC BY 4.0): ~498k train / 168k test real-world URLs, July 2024 -
       Dec 2025, TEMPORAL split (test is later than train), leakage- and diversity-filtered by its authors. Only the
       url / label / date / sha256 columns are read (Parquet column projection), never the 190 GB of page HTML.
Model  thenlper/gte-small (33M params, GTE family - the best model in the PhreshPhish benchmark was a fine-tuned GTE)
       fine-tuned end to end on the URL string, max 128 tokens; small enough to serve on a CPU.
Robust 25% of training phishing URLs get an extra evasive copy (benign-looking path padding or a famous domain
       injected as a subdomain); the local harness tests a padding NOT used here.
Output /kaggle/working/url_v8/  model + tokenizer (safetensors), calibration.json (temperature, WARN/BLOCK
       thresholds at 1% / 0.1% FPR on a time-held-out validation slice), metrics.json (test split + the official
       base-rate benchmarks: AP and recall at fixed FPR).

Run on Kaggle (GPU, internet on) via `kaggle kernels push`; locally:  python train_url_v8.py --smoke
"""
import argparse
import json
import math
import os
import random
import time

import numpy as np
import torch

REPO = "phreshphish/phreshphish"
OUT = os.environ.get("AEGIS_OUT", "/kaggle/working/url_v9")
BASE_MODEL = os.environ.get("AEGIS_URL_BASE", "thenlper/gte-small")
MAX_LEN = 128

PADS = ["/blog/2024/07/how-to-reset-your-router/", "/wp-content/uploads/2023/11/quarterly-report.pdf", "/en-us/help/article/12345",
        "/news/world/2025/03/15/story.html", "/products/category/home-kitchen?page=2&sort=popular", "?utm_source=newsletter&utm_medium=email",
        "/static/docs/guide/getting-started.html", "/user/profile/settings?tab=security", "/careers/jobs/software-engineer?location=remote"]
INJECT = ["www.paypal.com.", "login.microsoftonline.com.", "accounts.google.com.", "www.hbl.com.", "secure.chase.com."]


def log(*a):
    print(time.strftime("%H:%M:%S"), *a, flush=True)


# ── data ──────────────────────────────────────────────────────────────────────────────────────────
def read_split(split, limit=None):
    import pyarrow.parquet as pq
    from huggingface_hub import HfFileSystem
    fs = HfFileSystem()
    files = sorted(fs.glob(f"datasets/{REPO}/data/{split}-*.parquet"))
    cols, n = {"url": [], "label": [], "date": [], "sha256": []}, 0
    for f in files:
        with fs.open(f, "rb", block_size=8 * 1024 * 1024) as fh:
            pf = pq.ParquetFile(fh)
            for rg in range(pf.num_row_groups):
                t = pf.read_row_group(rg, columns=list(cols))
                for k in cols:
                    cols[k].extend(t.column(k).to_pylist())
                n += t.num_rows
                if limit and n >= limit:
                    break
        log(f"{split}: {n} rows after {os.path.basename(f)}")
        if limit and n >= limit:
            break
    y = np.array([1 if str(l).lower().startswith("phish") else 0 for l in cols["label"]], dtype=np.int64)
    return [str(u) for u in cols["url"]], y, [str(d) for d in cols["date"]], cols["sha256"]


SECOND_LEVEL = {"co", "com", "org", "net", "gov", "edu", "ac", "gob", "nic", "ltd", "plc", "web"}


def reg_domain(host):
    """Registered domain, close enough for de-duplication (example.co.uk, example.com.pk, example.org)."""
    parts = (host or "").lower().strip(".").split(".")
    if parts and parts[0] == "www":
        parts = parts[1:]
    if len(parts) >= 3 and len(parts[-1]) == 2 and parts[-2] in SECOND_LEVEL:
        return ".".join(parts[-3:])
    return ".".join(parts[-2:])


def c4_urls(files, exclude, per_host=3):
    """Real URLs of ordinary web pages from allenai/c4 (ODC-BY), same plausibility filter as the local eval."""
    import gzip
    import re
    from urllib.parse import urlparse
    from huggingface_hub import hf_hub_download
    static = re.compile(r"\.(js|css|png|jpe?g|gif|svg|ico|woff2?|ttf|xml|json|txt|pdf|mp4|webp|zip|rss)$", re.I)
    sane = re.compile(r"^https?://[A-Za-z0-9.-]+(:\d+)?(/[A-Za-z0-9._~%/+@,;=:-]*)?(\?[A-Za-z0-9._~%&=+/,;:-]*)?$")
    hosts, out = {}, []
    for f in files:
        p = hf_hub_download("allenai/c4", f, repo_type="dataset")
        with gzip.open(p, "rt", encoding="utf-8") as fh:
            for line in fh:
                u = json.loads(line).get("url", "")
                if len(u) < 18 or len(u) > 220 or not sane.match(u):
                    continue
                pu = urlparse(u)
                if static.search(pu.path) or "//" in pu.path:
                    continue
                h = (pu.hostname or "").lower()
                if reg_domain(h) in exclude:
                    continue
                cap = 50 if h.endswith(".pk") else per_host
                if hosts.get(h, 0) >= cap:
                    continue
                hosts[h] = hosts.get(h, 0) + 1
                out.append(u)
        log(f"c4 {f}: {len(out)} urls so far")
    return out


def eval_domains():
    """Registered domains of the LOCAL evaluation shard - excluded from training so the local test stays honest."""
    import gzip
    from urllib.parse import urlparse
    from huggingface_hub import hf_hub_download
    p = hf_hub_download("allenai/c4", "en/c4-validation.00000-of-00008.json.gz", repo_type="dataset")
    with gzip.open(p, "rt", encoding="utf-8") as fh:
        return {reg_domain(urlparse(json.loads(l).get("url", "")).hostname) for l in fh}


def pad_benign(u, rng):
    from urllib.parse import urlsplit, urlunsplit
    p = urlsplit(u)
    extra = rng.choice(PADS)
    if extra.startswith("?"):
        return urlunsplit((p.scheme, p.netloc, p.path, (p.query + "&" if p.query else "") + extra[1:], ""))
    path, _, q = extra.partition("?")
    return urlunsplit((p.scheme, p.netloc, (p.path.rstrip("/") or "") + path, q or p.query, ""))


def mutate(u, rng):
    from urllib.parse import urlsplit, urlunsplit
    p = urlsplit(u if "://" in u else "http://" + u)
    if rng.random() < 0.5:
        extra = rng.choice(PADS)
        if extra.startswith("?"):
            return urlunsplit((p.scheme, p.netloc, p.path, (p.query + "&" if p.query else "") + extra[1:], ""))
        path, _, q = extra.partition("?")
        return urlunsplit((p.scheme, p.netloc, (p.path.rstrip("/") or "") + path, q or p.query, ""))
    return urlunsplit((p.scheme, rng.choice(INJECT) + p.netloc, p.path, p.query, ""))


# ── metrics ───────────────────────────────────────────────────────────────────────────────────────
def tpr_at_fpr(neg, pos, fpr):
    neg = np.sort(neg)
    th = neg[min(max(int(math.ceil(len(neg) * (1 - fpr))) - 1, 0), len(neg) - 1)]
    return float(np.mean(pos > th)), float(th)


def avg_precision(y, s):
    from sklearn.metrics import average_precision_score
    return float(average_precision_score(y, s))


# ── training ──────────────────────────────────────────────────────────────────────────────────────
class UrlSet(torch.utils.data.Dataset):
    def __init__(self, urls, y, tok):
        self.urls, self.y, self.tok = urls, y, tok

    def __len__(self):
        return len(self.urls)

    def __getitem__(self, i):
        return self.urls[i], int(self.y[i])


class Collate:
    """Module-level (picklable) so DataLoader workers also start on Windows."""
    def __init__(self, tok):
        self.tok = tok

    def __call__(self, batch):
        enc = self.tok([b[0] for b in batch], truncation=True, max_length=MAX_LEN, padding=True, return_tensors="pt")
        enc["labels"] = torch.tensor([b[1] for b in batch])
        return enc


@torch.no_grad()
def predict_logits(model, tok, urls, bs=512, device="cuda"):
    model.eval()
    out = []
    for i in range(0, len(urls), bs):
        enc = tok(urls[i:i + bs], truncation=True, max_length=MAX_LEN, padding=True, return_tensors="pt").to(device)
        with torch.autocast(device_type="cuda", dtype=torch.float16, enabled=device == "cuda"):
            lg = model(**enc).logits.float()
        out.append((lg[:, 1] - lg[:, 0]).cpu().numpy())
    return np.concatenate(out)


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--smoke", action="store_true")
    ap.add_argument("--epochs", type=float, default=2.0)
    ap.add_argument("--bs", type=int, default=256)
    ap.add_argument("--lr", type=float, default=5e-5)
    ap.add_argument("--c4-shards", type=int, default=2)
    ap.add_argument("--c4-max", type=int, default=220000)
    a = ap.parse_args()
    random.seed(0)
    np.random.seed(0)
    torch.manual_seed(0)
    device = "cuda" if torch.cuda.is_available() else "cpu"
    log("device", device, torch.cuda.device_count(), "GPU(s)")
    lim = 4000 if a.smoke else None
    tr_u, tr_y, tr_d, _ = read_split("train", lim)
    te_u, te_y, te_d, te_sha = read_split("test", lim)
    log(f"train {len(tr_u)} ({tr_y.mean():.1%} phish)  test {len(te_u)} ({te_y.mean():.1%} phish)")

    # time-held-out validation: the newest 5% of TRAIN (calibration + thresholds), never the test split
    order = np.argsort(np.array(tr_d))
    k = max(200, int(len(order) * 0.05))
    va_idx, fit_idx = order[-k:], order[:-k]
    fit_u = [tr_u[i] for i in fit_idx]
    fit_y = tr_y[fit_idx]
    va_u, va_y = [tr_u[i] for i in va_idx], tr_y[va_idx]
    rng = random.Random(1)
    ph = [u for u, y in zip(fit_u, fit_y) if y == 1]
    aug = [mutate(u, rng) for u in rng.sample(ph, int(len(ph) * 0.25))]
    fit_u, fit_y = fit_u + aug, np.concatenate([fit_y, np.ones(len(aug), dtype=np.int64)])

    # long-tail legitimate web pages (c4 train shards), domain-disjoint from the local evaluation shard
    excl = eval_domains()
    log(f"excluding {len(excl)} registered domains of the local evaluation shard")
    shards = [f"en/c4-train.{i:05d}-of-01024.json.gz" for i in range(1 if a.smoke else a.c4_shards)]
    web = c4_urls(shards, excl)
    rng.shuffle(web)
    web = web[:2000 if a.smoke else a.c4_max]
    kw = max(100, int(len(web) * 0.05))
    web_va, web_fit = web[:kw], web[kw:]
    web_pad = [pad_benign(u, rng) for u in rng.sample(web_fit, int(len(web_fit) * 0.15))]
    fit_u = fit_u + web_fit + web_pad
    fit_y = np.concatenate([fit_y, np.zeros(len(web_fit) + len(web_pad), dtype=np.int64)])
    log(f"fit {len(fit_u)} (incl. {len(aug)} evasive phishing copies, {len(web_fit)} c4 pages, {len(web_pad)} padded c4)"
        f"  validation {len(va_u)} + {len(web_va)} c4")

    from transformers import AutoModelForSequenceClassification, AutoTokenizer, get_linear_schedule_with_warmup
    tok = AutoTokenizer.from_pretrained(BASE_MODEL)
    model = AutoModelForSequenceClassification.from_pretrained(BASE_MODEL, num_labels=2, torch_dtype=torch.float32).float().to(device)
    if torch.cuda.device_count() > 1:
        model = torch.nn.DataParallel(model)
    dl = torch.utils.data.DataLoader(UrlSet(fit_u, fit_y, tok), batch_size=a.bs, shuffle=True, collate_fn=Collate(tok),
                                     num_workers=0 if os.name == "nt" else 2)
    steps = int(len(dl) * a.epochs) if not a.smoke else 20
    opt = torch.optim.AdamW(model.parameters(), lr=a.lr, weight_decay=0.01)
    sch = get_linear_schedule_with_warmup(opt, int(0.06 * steps), steps)
    scaler = torch.amp.GradScaler("cuda", enabled=device == "cuda")
    step, t0 = 0, time.time()
    model.train()
    while step < steps:
        for batch in dl:
            batch = {k: v.to(device) for k, v in batch.items()}
            with torch.autocast(device_type="cuda", dtype=torch.float16, enabled=device == "cuda"):
                out = model(**batch)
                loss = out.loss.mean() if out.loss.dim() else out.loss
            scaler.scale(loss).backward()
            scaler.unscale_(opt)
            torch.nn.utils.clip_grad_norm_(model.parameters(), 1.0)
            scaler.step(opt)
            scaler.update()
            opt.zero_grad(set_to_none=True)
            sch.step()
            step += 1
            if step % 200 == 0 or step == steps:
                log(f"step {step}/{steps}  loss {loss.item():.4f}  {time.time() - t0:.0f}s")
            if step >= steps:
                break
    core = model.module if hasattr(model, "module") else model

    # calibration (temperature) and thresholds on the time-held-out validation slice
    va_z = predict_logits(core, tok, va_u, device=device)
    T = 1.0
    for _ in range(300):   # fit temperature by gradient descent on log-loss
        p = 1 / (1 + np.exp(-va_z / T))
        g = np.mean((p - va_y) * (-va_z / T ** 2))
        T = max(0.05, T - 0.5 * g)
    pv = 1 / (1 + np.exp(-va_z / T))
    pw = 1 / (1 + np.exp(-predict_logits(core, tok, web_va, device=device) / T))
    neg, pos = pv[va_y == 0], pv[va_y == 1]
    # each threshold must hold on BOTH benign pools (recent PhreshPhish traffic and the long-tail web)
    th = {name: max(tpr_at_fpr(neg, pos, f)[1], tpr_at_fpr(pw, pos, f)[1])
          for name, f in (("suspicious", 0.05), ("warn", 0.01), ("block", 0.001))}
    log("temperature", round(T, 3), "thresholds", th)

    # test split (later in time than everything above) + the official base-rate benchmarks
    te_z = predict_logits(core, tok, te_u, device=device)
    pt = 1 / (1 + np.exp(-te_z / T))
    from sklearn.metrics import roc_auc_score
    m = {"test_n": len(te_u), "test_auc": float(roc_auc_score(te_y, pt)), "test_ap": avg_precision(te_y, pt)}
    for f in (0.01, 0.001, 0.0001):
        m[f"test_tpr_at_fpr_{f}"] = tpr_at_fpr(pt[te_y == 0], pt[te_y == 1], f)[0]
    m["test_recall_at_warn"] = float(np.mean(pt[te_y == 1] >= th["warn"]))
    m["test_fpr_at_warn"] = float(np.mean(pt[te_y == 0] >= th["warn"]))
    m["validation_recall_at_warn"] = float(np.mean(pos >= th["warn"]))
    m["validation_c4_fpr_at_warn"] = float(np.mean(pw >= th["warn"]))
    m["validation_c4_fpr_at_block"] = float(np.mean(pw >= th["block"]))
    if not a.smoke:
        from huggingface_hub import hf_hub_download
        sc = dict(zip(te_sha, pt))
        lab = dict(zip(te_sha, te_y))
        benign = [s for s in open(hf_hub_download(REPO, "benchmark/benign.txt", repo_type="dataset")).read().split() if s in sc]
        for rate in ("005", "010", "050", "100", "500"):
            aps = []
            for i in range(0, 1000):
                try:
                    fn = hf_hub_download(REPO, f"benchmark/benchmark-{rate}/{i}.txt", repo_type="dataset")
                except Exception:
                    break
                phs = [s for s in open(fn).read().split() if s in sc]
                ys = np.array([0] * len(benign) + [1] * len(phs))
                ss = np.array([sc[s] for s in benign] + [sc[s] for s in phs])
                aps.append(avg_precision(ys, ss))
                if i >= 49:   # 50 benchmarks per base rate are plenty for a stable mean
                    break
            m[f"benchmark_{rate}_mean_ap"] = float(np.mean(aps)) if aps else None
            log(f"benchmark base rate {rate}: mean AP {m[f'benchmark_{rate}_mean_ap']} over {len(aps)}")
    log("metrics", json.dumps(m))

    os.makedirs(OUT, exist_ok=True)
    core.save_pretrained(OUT, safe_serialization=True)
    tok.save_pretrained(OUT)
    json.dump({"temperature": T, "thresholds": th, "base_model": BASE_MODEL, "max_len": MAX_LEN, "trained": time.strftime("%Y-%m-%d"),
               "data": "phreshphish/phreshphish v1.0.1 (CC BY 4.0) train split (newest 5% held out) + allenai/c4 train "
                       "shard URLs (ODC-BY, 5% held out), domain-disjoint from c4 validation 00000",
               "fit_n": len(fit_u), "validation_n": len(va_u)}, open(os.path.join(OUT, "calibration.json"), "w"), indent=2)
    json.dump(m, open(os.path.join(OUT, "metrics.json"), "w"), indent=2)
    log("saved to", OUT)


if __name__ == "__main__":
    main()
