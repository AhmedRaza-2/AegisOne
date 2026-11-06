"""
Head-to-head on FRESH phishing URLs: AegisOne vs Google Safe Browsing vs VirusTotal vs community feeds, plus zero-day
lead time (how long after we flag a URL do the others flag it, if ever).

  python -m AIML.eval.headtohead collect  [--n-phish 2000] [--n-legit 2000]     # fresh URLs + first-seen timestamps
  python -m AIML.eval.headtohead check    [--engines aegis,gsb,vt,feeds]         # first look (time zero)
  python -m AIML.eval.headtohead poll     [--engines gsb,vt,feeds]               # re-check URLs NOT yet flagged; run at +1h, +6h, +24h, +72h
  python -m AIML.eval.headtohead report                                          # tables + lead time

Keys (environment, never stored in files):  GSB_API_KEY  (Google Cloud, Safe Browsing API, free)
                                            VT_API_KEY   (VirusTotal, free tier: 4 requests/min, 500/day -> use --vt-max)

How the comparison is kept honest
  * Ground truth is NOT "listed by a feed": phishing = URLs from feeds that publish human/automatically verified phishing at
    time T; legitimate = real deep links of popular sites (Tranco) and ordinary pages (C4), which no blacklist lists.
  * A URL taken from feed X is never used to score engine X (circular). Each URL carries the set of feeds that had it;
    the report scores every engine only on URLs it could not have copied from its own source.
  * VirusTotal aggregates many engines including community feeds; its column is shown, with that caveat.
  * Lead time is a lower bound with the polling granularity of the runs you do, and URLs nobody flags are censored.
"""
import argparse
import base64
import json
import sys
import time
from datetime import datetime, timezone
from pathlib import Path

import requests

ROOT = Path(__file__).resolve().parents[2]
sys.path.insert(0, str(ROOT))
DATA = ROOT / "AIML/eval/data"
RES = ROOT / "AIML/eval/results"
URLS = RES / "h2h_urls.jsonl"
CHECKS = RES / "h2h_checks.jsonl"
UA = {"User-Agent": "AegisOne-research/1.0 (phishing detection evaluation)"}
now = lambda: datetime.now(timezone.utc).isoformat(timespec="seconds")  # noqa: E731


# ── feeds ─────────────────────────────────────────────────────────────────────────────────────────
def feed_openphish():
    return {u.strip() for u in requests.get("https://openphish.com/feed.txt", headers=UA, timeout=60).text.splitlines() if u.startswith("http")}


def feed_phishingdb():
    base = "https://raw.githubusercontent.com/Phishing-Database/Phishing.Database/master/"
    out = set()
    for f in ("phishing-links-NEW-today.txt", "phishing-links-NEW-last-hour.txt"):
        try:
            out |= {u.strip() for u in requests.get(base + f, headers=UA, timeout=60).text.splitlines() if u.startswith("http")}
        except Exception:
            pass
    return out


PT_TIMES = {}      # url -> PhishTank submission time (the real first-seen time)


def feed_phishtank():
    cache = ROOT / "AIML/eval/cache/phishtank_online_valid.json"
    data = None
    try:
        r = requests.get("http://data.phishtank.com/data/online-valid.json", headers=UA, timeout=90, allow_redirects=True)
        if r.ok:
            data = r.json()
            cache.parent.mkdir(parents=True, exist_ok=True)
            cache.write_text(r.text, encoding="utf-8")
    except Exception:
        pass
    if data is None and cache.exists():                  # PhishTank rate-limits anonymous downloads: reuse the last good one
        print("  phishtank: download refused, using the cached dump from", datetime.fromtimestamp(cache.stat().st_mtime).isoformat(timespec="minutes"))
        data = json.loads(cache.read_text(encoding="utf-8"))
    out = set()
    for x in data or []:
        if x.get("verified") == "yes":
            out.add(x["url"])
            PT_TIMES[x["url"]] = x.get("submission_time") or ""
    return out


FEEDS = {"openphish": feed_openphish, "phishingdb": feed_phishingdb, "phishtank": feed_phishtank}


def collect(a):
    RES.mkdir(exist_ok=True)
    seen = {}
    for name, fn in FEEDS.items():
        try:
            u = fn()
        except Exception as e:
            print(name, "failed:", e)
            u = set()
        print(f"{name}: {len(u)} URLs")
        for x in u:
            seen.setdefault(x, set()).add(name)
    import random
    # fresh only: PhishTank lists everything still online (51k, months old); keep entries submitted within --max-age-h hours
    cutoff = datetime.now(timezone.utc).timestamp() - a.max_age_h * 3600
    def age_ok(u, src):
        if "phishtank" in src and not ({"openphish", "phishingdb"} & src):
            try:
                return datetime.fromisoformat(PT_TIMES.get(u, "")).timestamp() >= cutoff
            except ValueError:
                return False
        return True
    items = [(u, src) for u, src in seen.items() if age_ok(u, src)]
    random.Random(1).shuffle(items)
    print(f"fresh phishing candidates: {len(items)} (PhishTank limited to the last {a.max_age_h} h)")
    phish = items[:a.n_phish]
    import pandas as pd
    legit = pd.concat([pd.read_csv(DATA / "legit_popular.csv").url, pd.read_csv(DATA / "legit_web.csv").url]).drop_duplicates().tolist()
    random.Random(2).shuffle(legit)
    t = now()
    # accumulate across runs: a 48 h window holds only ~500 fresh phishing URLs, so run collect daily until the set is large enough
    prev = {r["url"]: r for r in (json.loads(l) for l in URLS.open(encoding="utf-8"))} if URLS.exists() else {}
    for u, src in phish:
        if u in prev:
            prev[u]["feeds"] = sorted(set(prev[u]["feeds"]) | set(src))
        else:
            prev[u] = {"url": u, "label": 1, "feeds": sorted(src), "first_seen": PT_TIMES.get(u) or t}
    have_legit = [r for r in prev.values() if r["label"] == 0]
    for u in legit[:max(0, a.n_legit - len(have_legit))]:
        prev[u] = {"url": u, "label": 0, "feeds": [], "first_seen": t}
    with URLS.open("w", encoding="utf-8") as f:
        for r in prev.values():
            f.write(json.dumps(r) + "\n")
    phish = [r for r in prev.values() if r["label"] == 1]
    legit = [r for r in prev.values() if r["label"] == 0]
    print(f"{URLS.name}: {len(phish)} phishing (accumulated) + {len(legit)} legitimate")


# ── engines ───────────────────────────────────────────────────────────────────────────────────────
def load_urls():
    return [json.loads(l) for l in URLS.open(encoding="utf-8")]


def check_aegis(rows):
    from api.services import model_orchestrator as mo
    mo.load_all_models()
    out = {}
    for i, r in enumerate(rows):
        res = mo._predict_url_sync(r["url"])
        out[r["url"]] = (res.get("phishing_probability", 0) * 100 >= 35, round(res.get("phishing_probability", 0) * 100, 1))
        if (i + 1) % 500 == 0:
            print(f"  aegis {i + 1}/{len(rows)}", flush=True)
    return out


def check_gsb(rows, key):
    out = {}
    urls = [r["url"] for r in rows]
    for i in range(0, len(urls), 500):
        chunk = urls[i:i + 500]
        body = {"client": {"clientId": "aegisone-eval", "clientVersion": "1.0"},
                "threatInfo": {"threatTypes": ["MALWARE", "SOCIAL_ENGINEERING", "UNWANTED_SOFTWARE", "POTENTIALLY_HARMFUL_APPLICATION"],
                               "platformTypes": ["ANY_PLATFORM"], "threatEntryTypes": ["URL"], "threatEntries": [{"url": u} for u in chunk]}}
        r = requests.post(f"https://safebrowsing.googleapis.com/v4/threatMatches:find?key={key}", json=body, timeout=60)
        if not r.ok:
            raise SystemExit(f"Safe Browsing error {r.status_code}: {r.text[:200]}")
        hit = {m["threat"]["url"] for m in r.json().get("matches", [])}
        for u in chunk:
            out[u] = (u in hit, None)
        time.sleep(1)
    return out


def check_vt(rows, key, max_n):
    out = {}
    for i, r in enumerate(rows[:max_n]):
        uid = base64.urlsafe_b64encode(r["url"].encode()).decode().strip("=")
        resp = requests.get(f"https://www.virustotal.com/api/v3/urls/{uid}", headers={"x-apikey": key}, timeout=30)
        if resp.status_code == 429:
            time.sleep(60)
            resp = requests.get(f"https://www.virustotal.com/api/v3/urls/{uid}", headers={"x-apikey": key}, timeout=30)
        if resp.status_code == 404:
            out[r["url"]] = (False, 0)          # never seen by VirusTotal
        elif resp.ok:
            st = resp.json()["data"]["attributes"]["last_analysis_stats"]
            out[r["url"]] = (st.get("malicious", 0) >= 1, st.get("malicious", 0))
        time.sleep(15.5)                         # free tier: 4 requests per minute
        if (i + 1) % 50 == 0:
            print(f"  vt {i + 1}/{min(max_n, len(rows))}", flush=True)
    return out


def check_feeds(rows):
    live = {n: fn() for n, fn in FEEDS.items()}
    return {f"feed:{n}": {r["url"]: (r["url"] in s, None) for r in rows} for n, s in live.items()}


def run_checks(a, only_unflagged):
    rows = load_urls()
    prior, seen = {}, {}
    if CHECKS.exists():
        for l in CHECKS.open(encoding="utf-8"):
            c = json.loads(l)
            seen.setdefault(c["engine"], set()).add(c["url"])
            if c["flagged"]:
                prior.setdefault(c["engine"], set()).add(c["url"])
    engines = a.engines.split(",")
    t = now()
    results = {}
    for e in engines:
        todo = [r for r in rows if not (only_unflagged and r["url"] in prior.get(e, set()))]
        if getattr(a, "new_only", False):          # a new cycle: only URLs this engine has never been asked about
            ask = [x for x in ("feed:openphish", "feed:phishingdb", "feed:phishtank") if e == "feeds"] or [e]
            todo = [r for r in todo if not all(r["url"] in seen.get(k, set()) for k in ask)]
        if not todo:
            print(f"  {e}: nothing new to check", flush=True)
            continue
        if e == "aegis":
            results["aegis"] = check_aegis(todo)
        elif e == "gsb":
            results["gsb"] = check_gsb(todo, _key("GSB_API_KEY"))
        elif e == "vt":
            results["vt"] = check_vt(todo, _key("VT_API_KEY"), a.vt_max)
        elif e == "feeds":
            results.update(check_feeds(todo))
    with CHECKS.open("a", encoding="utf-8") as f:
        for e, d in results.items():
            for u, (flag, score) in d.items():
                f.write(json.dumps({"url": u, "engine": e, "flagged": bool(flag), "score": score, "checked": t}) + "\n")
    print({e: sum(1 for v in d.values() if v[0]) for e, d in results.items()}, "flagged at", t)


def _key(name):
    import os
    k = os.environ.get(name)
    if not k:
        raise SystemExit(f"{name} is not set (see the module docstring)")
    return k


# ── report ────────────────────────────────────────────────────────────────────────────────────────
def report():
    rows = {r["url"]: r for r in load_urls()}
    checks = [json.loads(l) for l in CHECKS.open(encoding="utf-8")]
    first_flag, tried = {}, {}
    for c in checks:
        tried.setdefault(c["engine"], set()).add(c["url"])
        if c["flagged"]:
            k = (c["engine"], c["url"])
            if k not in first_flag or c["checked"] < first_flag[k]:
                first_flag[k] = c["checked"]
    print(f"{'engine':16s} {'phishing caught':>16s} {'(n)':>6s} {'legit flagged':>14s} {'(n)':>6s}   [URLs the engine could not have copied from its own feed]")
    for e in sorted(tried):
        own = e.split(":")[1] if e.startswith("feed:") else None
        ph = [u for u in tried[e] if rows[u]["label"] == 1 and (own is None or own not in rows[u]["feeds"])]
        lg = [u for u in tried[e] if rows[u]["label"] == 0]
        caught = sum((e, u) in first_flag for u in ph)
        fa = sum((e, u) in first_flag for u in lg)
        print(f"{e:16s} {caught / max(len(ph), 1):16.1%} {len(ph):6d} {fa / max(len(lg), 1):14.1%} {len(lg):6d}")
    print("\nZero-day lead time (phishing URLs we flagged at first sight; hours until the other engine flagged it)")
    for e in sorted(tried):
        if e == "aegis":
            continue
        lead, never = [], 0
        for u, r in rows.items():
            if r["label"] != 1 or ("aegis", u) not in first_flag or (e.startswith("feed:") and e.split(":")[1] in r["feeds"]):
                continue
            t0 = datetime.fromisoformat(r["first_seen"])
            if (e, u) in first_flag:
                lead.append((datetime.fromisoformat(first_flag[(e, u)]) - t0).total_seconds() / 3600)
            else:
                never += 1
        lead.sort()
        med = lead[len(lead) // 2] if lead else None
        print(f"{e:16s} flagged later: {len(lead):5d} (median {med if med is None else round(med, 1)} h)   not flagged by last check: {never}")


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("cmd", choices=["collect", "check", "poll", "report"])
    ap.add_argument("--n-phish", type=int, default=2000)
    ap.add_argument("--n-legit", type=int, default=2000)
    ap.add_argument("--max-age-h", type=int, default=48)
    ap.add_argument("--engines", default="aegis,gsb,vt,feeds")
    ap.add_argument("--vt-max", type=int, default=450)
    ap.add_argument("--new-only", action="store_true", help="check: only URLs the engine has not been asked about yet")
    a = ap.parse_args()
    {"collect": lambda: collect(a), "check": lambda: run_checks(a, False), "poll": lambda: run_checks(a, True), "report": report}[a.cmd]()


if __name__ == "__main__":
    main()
