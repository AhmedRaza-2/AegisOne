# ===================================================================================================================
# AegisOne URL model v10 - training (Kaggle T4 x2). Built into train_url_v10.py by build.py, which prepends
# AIML/url/urlnet_v10.py (the exact preprocessing + model the server runs), so training and serving cannot drift.
#
# Data    PhreshPhish train (temporal; newest 5% held out) + allenai/c4 train-shard URLs (domain-disjoint from the
#         local evaluation shard c4-validation-00000) + benign padding copies (debias: a long path is not a cue)
#         + real brand domains with ordinary/sign-in paths (debias: a brand name is not a cue).
# Attacks five mutation families in training: padding, subdomain injection, typosquat, homoglyph/Punycode,
#         brand-in-path. TLD swap is HELD OUT and only tested (leave-one-family-out, Frontiers Comp. Sci. 2026).
# Report  PhreshPhish test (later in time) AUC / TPR at 1, 0.1, 0.01% FPR with bootstrap 95% CI; official base-rate
#         benchmark AP; recall per mutation family on test phishing (test padding strings differ from training);
#         false alarms on held-out c4 pages.
# ===================================================================================================================
import argparse
import json
import math
import os
import random
import subprocess
import sys
import time

import numpy as np

try:
    import tldextract  # noqa: F401
except ImportError:
    subprocess.run([sys.executable, "-m", "pip", "install", "-q", "tldextract"], check=True)

REPO = "phreshphish/phreshphish"
OUT = os.environ.get("AEGIS_OUT", "/kaggle/working/url_v10")
BASE_MODEL = os.environ.get("AEGIS_URL_BASE", "thenlper/gte-small")

PADS = ["/blog/2024/07/how-to-reset-your-router/", "/wp-content/uploads/2023/11/quarterly-report.pdf", "/en-us/help/article/12345",
        "/news/world/2025/03/15/story.html", "/products/category/home-kitchen?page=2&sort=popular", "?utm_source=newsletter&utm_medium=email",
        "/static/docs/guide/getting-started.html", "/user/profile/settings?tab=security", "/careers/jobs/software-engineer?location=remote"]
PADS_TEST = ["/docs/2025/annual-report/index.html?ref=google.com&lang=en", "/about/team.html", "/category/recipes/page/3/"]
INJECT = ["www.paypal.com.", "login.microsoftonline.com.", "accounts.google.com.", "www.hbl.com.", "secure.chase.com.",
          "www.meezanbank.com.", "appleid.apple.com.", "www.jazzcash.com.pk."]
INJECT_TEST = ["signin.amazon.com.", "www.easypaisa.com.pk.", "online.ubldigital.com."]
BRANDS = ["paypal.com", "microsoft.com", "office.com", "outlook.com", "google.com", "apple.com", "icloud.com", "amazon.com",
          "netflix.com", "facebook.com", "instagram.com", "whatsapp.com", "linkedin.com", "dhl.com", "fedex.com", "usps.com",
          "chase.com", "bankofamerica.com", "wellsfargo.com", "coinbase.com", "binance.com", "adobe.com", "dropbox.com",
          "docusign.com", "hbl.com", "ubldigital.com", "mcb.com.pk", "meezanbank.com", "bankalfalah.com", "jazzcash.com.pk",
          "easypaisa.com.pk", "nadra.gov.pk", "fbr.gov.pk", "daraz.pk", "jazz.com.pk", "telenor.com.pk", "zong.com.pk"]
LURE_PATHS = ["/login", "/signin", "/verify", "/account/update", "/secure/auth", "/wp-includes/login.php", "/id/confirm",
              "/billing/payment", "/claim", "/reset-password", "/webscr?cmd=_login-run", "/index.php?session=expired"]
BENIGN_PATHS = ["/", "/signin", "/login", "/help", "/help/article/12345", "/account/settings", "/en-us/support",
                "/privacy", "/careers", "/business/pricing", "/news/2025/05/product-update", "/download"]
LURE_WORDS = ["secure", "login", "verify", "account", "support", "update", "auth", "online", "portal", "help"]
CYR = {"a": "а", "e": "е", "o": "о", "p": "р", "c": "с", "y": "у", "x": "х", "i": "і"}
COMMON_TLDS = [".com", ".net", ".org", ".co", ".info", ".online", ".site", ".app"]


def log(*a):
    print(time.strftime("%H:%M:%S"), *a, flush=True)


# ── data ──────────────────────────────────────────────────────────────────────────────────────────────────────────
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
        if limit and n >= limit:
            break
    log(f"{split}: {n} rows")
    y = np.array([1 if str(l).lower().startswith("phish") else 0 for l in cols["label"]], dtype=np.int64)
    return [str(u) for u in cols["url"]], y, [str(d) for d in cols["date"]], cols["sha256"]


def reg_of(host):
    ex = _tld()(host or "")
    return ".".join(x for x in (ex.domain, ex.suffix) if x)


def c4_urls(files, exclude, per_host=3):
    import gzip
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
                if reg_of(h) in exclude:
                    continue
                cap = 50 if h.endswith(".pk") else per_host
                if hosts.get(h, 0) >= cap:
                    continue
                hosts[h] = hosts.get(h, 0) + 1
                out.append(u)
        log(f"c4 {f}: {len(out)} urls so far")
    return out


def eval_domains():
    import gzip
    from urllib.parse import urlparse
    from huggingface_hub import hf_hub_download
    p = hf_hub_download("allenai/c4", "en/c4-validation.00000-of-00008.json.gz", repo_type="dataset")
    with gzip.open(p, "rt", encoding="utf-8") as fh:
        return {reg_of(urlparse(json.loads(l).get("url", "")).hostname) for l in fh}


# ── mutation families ─────────────────────────────────────────────────────────────────────────────────────────────
def _split(u):
    from urllib.parse import urlsplit
    return urlsplit(u if "://" in u[:12] else "http://" + u)


def pad(u, rng, pads=PADS):
    from urllib.parse import urlunsplit
    p = _split(u)
    extra = rng.choice(pads)
    if extra.startswith("?"):
        return urlunsplit((p.scheme, p.netloc, p.path, (p.query + "&" if p.query else "") + extra[1:], ""))
    path, _, q = extra.partition("?")
    return urlunsplit((p.scheme, p.netloc, (p.path.rstrip("/") or "") + path, q or p.query, ""))


def inject(u, rng, prefixes=INJECT):
    from urllib.parse import urlunsplit
    p = _split(u)
    return urlunsplit((p.scheme, rng.choice(prefixes) + p.netloc, p.path, p.query, ""))


def tld_swap(u, rng):
    from urllib.parse import urlunsplit
    p = _split(u)
    host = p.hostname or ""
    ex = _tld()(host)
    if not ex.suffix or not ex.domain:
        return None
    new_host = ".".join(x for x in (ex.subdomain, ex.domain) if x) + rng.choice(COMMON_TLDS)
    return urlunsplit((p.scheme, new_host, p.path, p.query, ""))


def typosquat(brand, rng):
    for _ in range(10):
        u = _typosquat_once(brand, rng)
        if reg_of(_split(u).hostname) != brand:      # e.g. swapping the two p's of "paypal" gives the real domain back
            return u
    return f"https://{brand.partition('.')[0]}-{rng.choice(LURE_WORDS)}.com{rng.choice(LURE_PATHS)}"


def _typosquat_once(brand, rng):
    name, _, suffix = brand.partition(".")
    ops = rng.randrange(5)
    if ops == 0 and len(name) > 3:                   # omission
        i = rng.randrange(1, len(name) - 1)
        name = name[:i] + name[i + 1:]
    elif ops == 1 and len(name) > 3:                 # transposition
        i = rng.randrange(len(name) - 1)
        name = name[:i] + name[i + 1] + name[i] + name[i + 2:]
    elif ops == 2:                                   # duplication
        i = rng.randrange(len(name))
        name = name[:i] + name[i] + name[i:]
    elif ops == 3:                                   # digit look-alike
        for a, b in (("o", "0"), ("l", "1"), ("i", "1"), ("e", "3"), ("a", "4")):
            if a in name:
                name = name.replace(a, b, 1)
                break
        else:
            name += "1"
    else:                                            # combosquat
        w = rng.choice(LURE_WORDS)
        name = f"{name}-{w}" if rng.random() < 0.5 else f"{w}-{name}"
    tld = suffix if rng.random() < 0.4 else rng.choice(["com", "net", "info", "xyz", "top", "online", "site"])
    sub = rng.choice(["", "", "www.", "secure.", "login."])
    return f"https://{sub}{name}.{tld}{rng.choice(LURE_PATHS)}"


def homoglyph(brand, rng):
    name, _, suffix = brand.partition(".")
    idx = [i for i, c in enumerate(name) if c in CYR]
    if not idx:
        return None
    i = rng.choice(idx)
    fake = name[:i] + CYR[name[i]] + name[i + 1:]
    host = f"{fake}.{suffix if rng.random() < 0.6 else 'com'}"
    host = ".".join(l.encode("idna").decode("ascii") if any(ord(c) > 127 for c in l) else l for l in host.split("."))
    return f"https://{host}{rng.choice(LURE_PATHS)}"


def brand_in_path(u, rng):
    from urllib.parse import urlunsplit
    p = _split(u)
    b = rng.choice(BRANDS)
    return urlunsplit((p.scheme, p.netloc, f"/{rng.choice(['', 'www.'])}{b}{rng.choice(LURE_PATHS)}", p.query, ""))


def brand_benign(rng):
    b = rng.choice(BRANDS)
    sub = rng.choice(["www.", "www.", "", "help.", "support.", "accounts.", "login.", "business."])
    return f"https://{sub}{b}{rng.choice(BENIGN_PATHS)}"


# ── metrics ───────────────────────────────────────────────────────────────────────────────────────────────────────
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


# ── training ──────────────────────────────────────────────────────────────────────────────────────────────────────
class Collate:
    def __init__(self, tok):
        self.tok = tok

    def __call__(self, batch):
        enc = encode(self.tok, [b[0] for b in batch])
        enc["labels"] = torch.tensor([b[1] for b in batch])
        return enc


@torch.no_grad()
def predict_logits(model, tok, urls, bs=512, device="cuda"):
    model.eval()
    out = []
    for i in range(0, len(urls), bs):
        enc = encode(tok, urls[i:i + bs], device)
        with torch.autocast(device_type="cuda", dtype=torch.float16, enabled=device == "cuda"):
            lg = model(**enc).float()
        out.append((lg[:, 1] - lg[:, 0]).cpu().numpy())
    return np.concatenate(out) if out else np.zeros(0)


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--smoke", action="store_true")
    ap.add_argument("--epochs", type=float, default=2.0)
    ap.add_argument("--bs", type=int, default=256)
    ap.add_argument("--lr", type=float, default=5e-5)
    ap.add_argument("--head-lr", type=float, default=1e-3)
    ap.add_argument("--c4-shards", type=int, default=2)
    ap.add_argument("--c4-max", type=int, default=220000)
    a = ap.parse_args()
    random.seed(0)
    np.random.seed(0)
    torch.manual_seed(0)
    device = "cuda" if torch.cuda.is_available() else "cpu"
    log("device", device, torch.cuda.device_count(), "GPU(s)")
    lim = 3000 if a.smoke else None
    tr_u, tr_y, tr_d, _ = read_split("train", lim)
    te_u, te_y, te_d, te_sha = read_split("test", lim)

    order = np.argsort(np.array(tr_d))
    k = max(200, int(len(order) * 0.05))
    va_idx, fit_idx = order[-k:], order[:-k]
    fit_u, fit_y = [tr_u[i] for i in fit_idx], list(tr_y[fit_idx])
    va_u, va_y = [tr_u[i] for i in va_idx], tr_y[va_idx]
    rng = random.Random(1)

    # attack families seen in training (TLD swap held out)
    ph = [u for u, y in zip(fit_u, fit_y) if y == 1]
    fam = {"padding": [pad(u, rng) for u in rng.sample(ph, int(len(ph) * 0.10))],
           "subdomain_injection": [inject(u, rng) for u in rng.sample(ph, int(len(ph) * 0.08))],
           "brand_in_path": [brand_in_path(u, rng) for u in rng.sample(ph, int(len(ph) * 0.04))],
           "typosquat": [typosquat(rng.choice(BRANDS), rng) for _ in range(300 if a.smoke else 25000)],
           "homoglyph": [x for x in (homoglyph(rng.choice(BRANDS), rng) for _ in range(300 if a.smoke else 20000)) if x]}
    for name, xs in fam.items():
        fit_u += xs
        fit_y += [1] * len(xs)
    # debiasing benign: long-tail web, padded web, real brand domains
    excl = eval_domains()
    web = c4_urls([f"en/c4-train.{i:05d}-of-01024.json.gz" for i in range(1 if a.smoke else a.c4_shards)], excl)
    rng.shuffle(web)
    web = web[:2000 if a.smoke else a.c4_max]
    kw = max(100, int(len(web) * 0.05))
    web_va, web_fit = web[:kw], web[kw:]
    benign_extra = web_fit + [pad(u, rng) for u in rng.sample(web_fit, int(len(web_fit) * 0.15))] \
        + [brand_benign(rng) for _ in range(300 if a.smoke else 20000)]
    fit_u += benign_extra
    fit_y += [0] * len(benign_extra)
    fit_y = np.array(fit_y, dtype=np.int64)
    log(f"fit {len(fit_u)} ({fit_y.mean():.1%} phishing): " + ", ".join(f"{k} {len(v)}" for k, v in fam.items())
        + f", c4 benign {len(web_fit)}; validation {len(va_u)} + c4 {len(web_va)}")

    from transformers import AutoModel, AutoTokenizer, get_linear_schedule_with_warmup
    tok = AutoTokenizer.from_pretrained(BASE_MODEL)
    enc_model = AutoModel.from_pretrained(BASE_MODEL, torch_dtype=torch.float32).float()
    net = UrlNetV10(enc_model).to(device)
    model = torch.nn.DataParallel(net) if torch.cuda.device_count() > 1 else net
    data = list(zip(fit_u, fit_y.tolist()))
    dl = torch.utils.data.DataLoader(data, batch_size=a.bs, shuffle=True, collate_fn=Collate(tok),
                                     num_workers=0 if os.name == "nt" else 4, drop_last=True)
    steps = int(len(dl) * a.epochs) if not a.smoke else 20
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
            batch = {k: v.to(device) for k, v in batch.items()}
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

    # calibration: temperature on the time-held-out slice; thresholds must hold on BOTH benign pools
    va_z = predict_logits(net, tok, va_u, device=device)
    T = 1.0
    for _ in range(300):
        p = 1 / (1 + np.exp(-va_z / T))
        T = max(0.05, T - 0.5 * np.mean((p - va_y) * (-va_z / T ** 2)))
    sig = lambda z: 1 / (1 + np.exp(-z / T))  # noqa: E731
    pv, pw = sig(va_z), sig(predict_logits(net, tok, web_va, device=device))
    neg, pos = pv[va_y == 0], pv[va_y == 1]
    th = {name: max(threshold_at(neg, f), threshold_at(pw, f)) for name, f in (("suspicious", 0.05), ("warn", 0.01), ("block", 0.001))}
    log("temperature", round(T, 3), "thresholds", th)

    pt = sig(predict_logits(net, tok, te_u, device=device))
    from sklearn.metrics import average_precision_score, roc_auc_score
    tn, tp = pt[te_y == 0], pt[te_y == 1]
    m = {"test_n": len(te_u), "test_auc": float(roc_auc_score(te_y, pt)), "test_ap": float(average_precision_score(te_y, pt))}
    for f in (0.01, 0.001, 0.0001):
        m[f"test_tpr_at_fpr_{f}"] = tpr_at_fpr(tn, tp, f)[0]
        m[f"test_tpr_at_fpr_{f}_ci95"] = bootstrap_tpr(tn, tp, f, n=50 if a.smoke else 200)
    m["test_recall_at_warn"] = float(np.mean(tp >= th["warn"]))
    m["test_fpr_at_warn"] = float(np.mean(tn >= th["warn"]))
    m["validation_c4_fpr_at_warn"] = float(np.mean(pw >= th["warn"]))
    m["validation_c4_fpr_at_block"] = float(np.mean(pw >= th["block"]))

    # robustness on LATER test phishing, with test-only padding / injection strings and the held-out TLD swap
    trng = random.Random(7)
    tph = trng.sample([u for u, y in zip(te_u, te_y) if y == 1], min(3000, int(te_y.sum())))
    muts = {"padding_unseen_strings": [pad(u, trng, PADS_TEST) for u in tph],
            "subdomain_injection_unseen_brands": [inject(u, trng, INJECT_TEST) for u in tph],
            "tld_swap_HELD_OUT_family": [x for x in (tld_swap(u, trng) for u in tph) if x],
            "typosquat": [typosquat(trng.choice(BRANDS), trng) for _ in range(2000)],
            "homoglyph": [x for x in (homoglyph(trng.choice(BRANDS), trng) for _ in range(2000)) if x]}
    for name, xs in muts.items():
        m[f"mut_{name}_recall_at_warn"] = float(np.mean(sig(predict_logits(net, tok, xs, device=device)) >= th["warn"]))
    m["brand_benign_fpr_at_warn"] = float(np.mean(sig(predict_logits(net, tok, [brand_benign(trng) for _ in range(2000)], device=device)) >= th["warn"]))

    if not a.smoke:
        from huggingface_hub import hf_hub_download
        sc = dict(zip(te_sha, pt))
        benign = [s for s in open(hf_hub_download(REPO, "benchmark/benign.txt", repo_type="dataset")).read().split() if s in sc]
        for rate in ("005", "010", "050", "100", "500"):
            aps = []
            for i in range(50):
                try:
                    fn = hf_hub_download(REPO, f"benchmark/benchmark-{rate}/{i}.txt", repo_type="dataset")
                except Exception:
                    break
                phs = [s for s in open(fn).read().split() if s in sc]
                aps.append(float(average_precision_score([0] * len(benign) + [1] * len(phs), [sc[s] for s in benign] + [sc[s] for s in phs])))
            m[f"benchmark_{rate}_mean_ap"] = float(np.mean(aps)) if aps else None
    log("metrics", json.dumps(m, indent=1))

    os.makedirs(OUT, exist_ok=True)
    from safetensors.torch import save_file
    save_file({k: v.contiguous().cpu() for k, v in net.state_dict().items()}, os.path.join(OUT, "urlnet_v10.safetensors"))
    net.encoder.config.save_pretrained(OUT)
    tok.save_pretrained(OUT)
    json.dump({"arch": "urlnet_v10", "temperature": float(T), "thresholds": th, "base_model": BASE_MODEL, "max_len": MAX_LEN,
               "trained": time.strftime("%Y-%m-%d"), "fit_n": len(fit_u), "validation_n": len(va_u) + len(web_va),
               "held_out_family": "tld_swap",
               "data": "phreshphish v1.0.1 train (CC BY 4.0, newest 5% held out) + allenai/c4 train shards (ODC-BY, 5% held out,"
                       " domain-disjoint from c4-validation-00000) + mutation families + brand-domain benign"},
              open(os.path.join(OUT, "calibration.json"), "w"), indent=2)
    json.dump(m, open(os.path.join(OUT, "metrics.json"), "w"), indent=2)
    log("saved to", OUT)


if __name__ == "__main__":
    main()
