"""
AegisOne URL Intelligence - domain reputation
=============================================
Exact registered-domain reputation from the Tranco top-100k list (Le Pochat et al., NDSS 2019,
https://tranco-list.eu), with the rules that keep it safe:

* Matching is on the *registered domain* using the Public Suffix List including its private section, so
  ``evil.github.io`` or ``someone.blogspot.com`` are their own registered domains and are NOT covered by
  ``github.io`` / ``blogspot.com`` being popular. A suffix or substring test would let ``microsoft.com.evil.xyz`` through.
* Hosts where anyone can publish a page (docs.google.com, sites.google.com, sharepoint.com ...) are reported
  as ``user_content``: the host is reputable, the page is not. They are never treated as fully trusted.
* The list is a *reputation signal that lowers false alarms*; it never raises a verdict and never overrides a
  structural red flag (raw IP, @ trick, odd port ...), which the caller checks first.

The list file is built by AIML/eval/build_reference_sets.py. If it is missing the module degrades to "no
reputation known" and the rest of the pipeline behaves exactly as before.
"""
import os
from functools import lru_cache

import tldextract

_BASE = os.path.dirname(os.path.abspath(__file__))
_LIST = os.environ.get("AEGIS_REPUTATION_LIST", os.path.join(_BASE, "reputation_lists", "tranco_top100k.txt"))
# offline-safe: use the snapshot shipped with tldextract, include the private PSL section (github.io, blogspot.com ...)
_EXT = tldextract.TLDExtract(suffix_list_urls=(), include_psl_private_domains=True)

try:
    from AIML.url.brand_engine import USER_CONTENT_HOSTS
except Exception:  # pragma: no cover - keeps the module importable on its own
    USER_CONTENT_HOSTS = ()

# Collaboration links of the big providers: their deep links are overwhelmingly legitimate (a shared Google Doc, a
# SharePoint file), so they are held just below WARN and the page check (forms, credential fields) decides.
COLLAB_HOSTS = ("docs.google.com", "drive.google.com", "sharepoint.com", "onedrive.live.com", "1drv.ms", "dropbox.com",
                "dl.dropboxusercontent.com", "app.box.com", "box.com", "teams.microsoft.com")
# Places where ANYONE can publish a page or a file: site builders, free hosting, cloud buckets, tunnels, VPS hostnames.
# The platform's popularity says nothing about the page, so these get NO reputation at all - they are judged like an
# unknown domain. Measured on today's OpenPhish feed: 11 of 300 phishing URLs were on gitbook.io, weebly.com,
# zapier.app, an IONOS bucket and a Contabo VPS, and a popularity list had hidden all of them.
HOSTING_HOSTS = tuple(h for h in USER_CONTENT_HOSTS if h not in COLLAB_HOSTS) + (
    "gitbook.io", "weebly.com", "weeblysite.com", "wixsite.com", "wix.com", "webflow.io", "framer.website", "framer.app",
    "notion.site", "carrd.co", "godaddysites.com", "square.site", "mystrikingly.com", "strikingly.com", "jimdosite.com",
    "000webhostapp.com", "replit.app", "repl.co", "surge.sh", "r2.dev", "onrender.com", "fly.dev", "typedream.app",
    "zapier.app", "canva.site", "my.canva.site", "webnode.page", "yolasite.com", "wordpress.com", "tumblr.com",
    "forms.office.com", "forms.gle", "sites.google.com", "sway.office.com", "linktr.ee", "start.page",
    "contaboserver.net", "ionoscloud.com", "amazonaws.com", "cloudfront.net", "blob.core.windows.net",
    "digitaloceanspaces.com", "linodeobjects.com", "storage.googleapis.com", "ngrok.io", "ngrok-free.app",
    "ngrok.app", "trycloudflare.com", "duckdns.org", "github.io", "gitlab.io", "glitch.me", "vercel.app",
    "netlify.app", "pages.dev", "workers.dev", "web.app", "firebaseapp.com", "herokuapp.com", "azurewebsites.net",
    "blogspot.com", "ipfs.io", "dweb.link", "cloudflare-ipfs.com", "telegra.ph", "s3.amazonaws.com",
    # wildcard DNS (any IP becomes a hostname) and e-mail click-tracking redirectors (the real target is hidden):
    # measured on PhreshPhish test pages, phishing behind these was capped by the popularity list
    "sslip.io", "nip.io", "xip.io", "traefik.me", "sendgrid.net", "list-manage.com", "mailchi.mp", "hubspotlinks.com",
    "mjt.lu", "rs6.net", "exacttarget.com", "mandrillapp.com", "mailgun.org")
# Platforms registered under many country endings (blogspot.jp, blogspot.com.ar ...). The Public Suffix List no longer
# lists Blogspot's country domains, so `x.blogspot.it` would otherwise count as the popular site `blogspot.it`:
# 240 of 2,347 phishing pages in a PhreshPhish test sample were hidden that way.
HOSTING_LABELS = ("blogspot",)


@lru_cache(maxsize=1)
def _listed() -> frozenset:
    try:
        with open(_LIST, encoding="utf-8") as f:
            return frozenset(line.strip().lower() for line in f if line.strip())
    except OSError:
        return frozenset()


def registered_domain(host: str) -> str:
    host = (host or "").lower().strip(".")
    e = _EXT(host)
    return f"{e.domain}.{e.suffix}" if e.suffix else e.domain


def _under(host: str, suffixes) -> bool:
    return any(host == u or host.endswith("." + u) for u in suffixes)


def is_user_content_host(host: str) -> bool:
    host = (host or "").lower().strip(".")
    return _under(host, COLLAB_HOSTS) or _under(host, HOSTING_HOSTS)


def reputation(host: str) -> dict:
    """{'listed', 'user_content', 'hosting', 'registered'}.
    listed       exact registered domain in the reputation list, and NOT a place where anyone can publish
    user_content a collaboration link of a big provider (held below WARN; the page check decides)
    hosting      a site builder / free host / bucket / tunnel: no reputation, judged like an unknown domain"""
    host = (host or "").lower().strip(".")
    reg = registered_domain(host)
    hosting = _under(host, HOSTING_HOSTS) or _EXT(host).domain in HOSTING_LABELS
    collab = not hosting and _under(host, COLLAB_HOSTS)
    return {"listed": bool(reg) and reg in _listed() and not hosting and not collab,
            "user_content": collab, "hosting": hosting, "registered": reg}


def list_size() -> int:
    return len(_listed())
