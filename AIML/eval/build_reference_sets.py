"""Build the reference data the URL evaluation and the serving guard rely on.

Writes:
  AIML/url/reputation_lists/tranco_top100k.txt  registered domains of the Tranco top 100k (exact-match reputation list)
  AIML/eval/data/legit_popular.csv   real deep URLs of ~500 popular sites incl. Pakistani ones (Internet Archive CDX)
  AIML/eval/data/legit_web.csv       real URLs of ordinary web pages, mostly NOT popular sites (allenai/c4 validation)
  AIML/eval/data/phish_fresh.csv     today's OpenPhish feed (phishing URLs the training data cannot contain)

Two legitimate sets on purpose: a popularity list only helps on popular sites, so false alarms are measured
separately on the long tail of ordinary sites, where the model has to stand on its own.

Sources: Tranco https://tranco-list.eu (Le Pochat et al., NDSS 2019); Internet Archive CDX API;
allenai/c4 (ODC-BY); OpenPhish community feed.
Run:  python AIML/eval/build_reference_sets.py      (needs internet; a few minutes)
"""
import csv
import gzip
import io
import json
import random
import re
import time
import zipfile
from concurrent.futures import ThreadPoolExecutor
from pathlib import Path
from urllib.parse import urlparse

import requests

HERE = Path(__file__).resolve().parent
DATA = HERE / "data"
DATA.mkdir(exist_ok=True)
REP = HERE.parent / "url" / "reputation_lists"
REP.mkdir(exist_ok=True)
random.seed(7)
STATIC = re.compile(r"\.(js|css|png|jpe?g|gif|svg|ico|woff2?|ttf|xml|json|txt|pdf|mp4|webp|zip|rss)$", re.I)
SANE = re.compile(r"^https?://[A-Za-z0-9.-]+(:\d+)?(/[A-Za-z0-9._~%/+@,;=:-]*)?(\?[A-Za-z0-9._~%&=+/,;:-]*)?$")


def tranco():
    zp = DATA / "tranco.zip"
    if not zp.exists():
        zp.write_bytes(requests.get("https://tranco-list.eu/top-1m.csv.zip", timeout=120).content)
    rows = zipfile.ZipFile(zp).read("top-1m.csv").decode().splitlines()
    ranked = [(int(a), b) for a, b in (r.split(",", 1) for r in rows)]
    # global top 100k + every Pakistani (.pk) domain in the top 1M: the product serves Pakistani organisations, whose
    # banks, exchanges, news and shops sit below the global 100k cut-off (psx.com.pk, olx.com.pk ...)
    top = [d for _, d in ranked[:100000]]
    pk = [d for _, d in ranked[100000:] if d.endswith(".pk")]
    (REP / "tranco_top100k.txt").write_text("\n".join(top + pk) + "\n")
    print(f"reputation list written: {len(top)} global + {len(pk)} .pk")
    return ranked


def plausible(u: str) -> bool:
    if len(u) < 18 or len(u) > 220 or not SANE.match(u):
        return False
    p = urlparse(u)
    return not STATIC.search(p.path) and "//" not in p.path


def wayback(domain: str):
    q = {"url": f"{domain}/*", "output": "json", "limit": "300", "fl": "original",
         "filter": ["statuscode:200", "mimetype:text/html"], "collapse": "urlkey", "from": "2023"}
    for _ in range(2):
        try:
            r = requests.get("https://web.archive.org/cdx/search/cdx", params=q, timeout=45)
            if r.status_code == 200:
                rows = r.json()[1:]
                return [x[0] for x in rows]
        except Exception:
            time.sleep(3)
    return []


def legit_popular(ranked, n_top=420, n_pk=90):
    pk = [d for _, d in ranked if d.endswith(".pk")][:n_pk]
    domains = list(dict.fromkeys([d for _, d in ranked[:n_top]] + pk))
    print(f"wayback: {len(domains)} domains")
    rows = []

    def work(d):
        urls = [u for u in wayback(d) if plausible(u)]
        deep = [u for u in urls if urlparse(u).path.strip("/").count("/") >= 1 or urlparse(u).query]
        random.shuffle(deep)
        return [(u, d) for u in deep[:6]]

    with ThreadPoolExecutor(4) as ex:
        for res in ex.map(work, domains):
            rows.extend(res)
    with open(DATA / "legit_popular.csv", "w", newline="", encoding="utf-8") as f:
        w = csv.writer(f)
        w.writerow(["url", "listed_domain"])
        w.writerows(rows)
    print("legit_popular.csv:", len(rows), "urls from", len({d for _, d in rows}), "domains")


def legit_web(n=4000):
    from huggingface_hub import hf_hub_download
    p = hf_hub_download("allenai/c4", "en/c4-validation.00000-of-00008.json.gz", repo_type="dataset", local_dir=str(DATA / "c4"))
    urls = []
    with gzip.open(p, "rt", encoding="utf-8") as f:
        for line in f:
            u = json.loads(line).get("url", "")
            if plausible(u):
                urls.append(u)
    random.shuffle(urls)
    seen, out = set(), []
    for u in urls:  # at most 2 per host so a few big sites do not dominate
        h = urlparse(u).hostname
        if sum(1 for x in seen if x == h) >= 2:
            continue
        seen.add(h)
        out.append(u)
        if len(out) >= n:
            break
    with open(DATA / "legit_web.csv", "w", newline="", encoding="utf-8") as f:
        w = csv.writer(f)
        w.writerow(["url", "listed_domain"])
        w.writerows([(u, "") for u in out])
    print("legit_web.csv:", len(out))


def phish_fresh():
    txt = requests.get("https://openphish.com/feed.txt", timeout=60).text
    urls = [u.strip() for u in txt.splitlines() if u.strip().startswith("http")]
    with open(DATA / "phish_fresh.csv", "w", newline="", encoding="utf-8") as f:
        w = csv.writer(f)
        w.writerow(["url", "source", "fetched"])
        for u in urls:
            w.writerow([u, "openphish", time.strftime("%Y-%m-%d")])
    print("phish_fresh.csv:", len(urls))


if __name__ == "__main__":
    import sys
    ranked = tranco()
    steps = sys.argv[1:] or ["phish", "web", "popular"]
    if "phish" in steps:
        phish_fresh()
    if "web" in steps:
        legit_web()
    if "popular" in steps:
        legit_popular(ranked)
