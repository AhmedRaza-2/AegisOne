"""
Page-level evaluation: real pages (URL + HTML) from the PhreshPhish TEST split (later in time than every training
row of the URL and page models), scored exactly as the API serves a page scan: the extension's dom_signals are
rebuilt from the HTML (AIML/url/page_summary.signals_from_html) and passed to _predict_url_sync.

Compares URL-only against every page-fusion mode on the pages the page model runs on (credential inputs),
plus the rest. WARN = risk >= 35, as the extension uses it.

Run:  python -m AIML.eval.eval_page [--files 4] [--tag name]
"""
import argparse
import json
import os
import random
from pathlib import Path

import numpy as np

HERE = Path(__file__).resolve().parent
CACHE = HERE / "cache" / "phreshphish_test"


def load_pages(n_files):
    import pyarrow.parquet as pq
    from huggingface_hub import HfFileSystem
    from AIML.url.page_summary import signals_from_html
    CACHE.mkdir(parents=True, exist_ok=True)
    out = CACHE / f"signals_{n_files}.jsonl"
    if out.exists():
        return [json.loads(l) for l in out.open(encoding="utf-8")]
    fs = HfFileSystem()
    files = sorted(fs.glob("datasets/phreshphish/phreshphish/data/test-*.parquet"))
    random.Random(11).shuffle(files)
    rows = []
    for f in files[:n_files]:
        with fs.open(f, "rb", block_size=16 * 1024 * 1024) as fh:
            t = pq.read_table(fh, columns=["url", "label", "html"])
        for u, l, h in zip(t.column("url").to_pylist(), t.column("label").to_pylist(), t.column("html").to_pylist()):
            rows.append({"url": str(u), "y": 1 if str(l).lower().startswith("phish") else 0, "sig": signals_from_html(str(u), h)})
        print(f"{f.split('/')[-1]}: {len(rows)} pages", flush=True)
    with out.open("w", encoding="utf-8") as fo:
        for r in rows:
            fo.write(json.dumps(r) + "\n")
    return rows


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--files", type=int, default=4)
    ap.add_argument("--tag", default="page")
    ap.add_argument("--limit", type=int, default=5000, help="random sample of pages (fixed seed)")
    a = ap.parse_args()
    rows = load_pages(a.files)
    if a.limit and len(rows) > a.limit:
        rows = random.Random(5).sample(rows, a.limit)
    from api.services import model_orchestrator as mo
    mo.load_all_models()
    has_page = "page_p1" in mo.MODELS
    modes = ["url_only"] + (["geo", "mean", "max", "page"] if has_page else [])
    cred = np.array([bool(r["sig"].get("has_password") or r["sig"].get("has_email") or r["sig"].get("has_otp")) for r in rows])
    y = np.array([r["y"] for r in rows])
    res = {"n": len(rows), "n_credential_pages": int(cred.sum()), "phishing_share": float(y.mean()), "modes": {}}
    for mode in modes:
        os.environ["AEGIS_PAGE_FUSION"] = "geo" if mode == "url_only" else mode
        s = np.array([mo._predict_url_sync(r["url"], page_signals=None if mode == "url_only" else r["sig"])
                      .get("phishing_probability", 0) * 100 for r in rows])
        warn = s >= 35
        out = {}
        for name, mask in (("credential_pages", cred), ("other_pages", ~cred), ("all", np.ones_like(cred))):
            yp, wp = y[mask], warn[mask]
            out[name] = {"recall_warn": float(wp[yp == 1].mean()) if (yp == 1).any() else None,
                         "false_warn": float(wp[yp == 0].mean()) if (yp == 0).any() else None,
                         "n_phish": int((yp == 1).sum()), "n_legit": int((yp == 0).sum())}
        res["modes"][mode] = out
        c = out["credential_pages"]
        print(f"{mode:9s} credential pages: recall {c['recall_warn']:.1%}  false WARN {c['false_warn']:.1%}   "
              f"| all pages: recall {out['all']['recall_warn']:.1%}  false WARN {out['all']['false_warn']:.1%}", flush=True)
    (HERE / "results").mkdir(exist_ok=True)
    json.dump(res, open(HERE / "results" / f"{a.tag}.json", "w"), indent=2)


if __name__ == "__main__":
    main()
