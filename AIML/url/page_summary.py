"""
Compact page summary for the page model P1 (docs/MODEL_RESEARCH_AND_PLAN.md, U3b).

The same text is built in two places and must match:
  * training  - from raw HTML (PhreshPhish), `summary_from_html`
  * serving   - from the signals the extension already sends with every page scan (`dom_signals`:
                page_title, visible_text, has_password, has_email, has_otp, form_actions), `summary_from_signals`
~5% of a page's HTML carries nearly all the phishing signal (arXiv 2511.15434), so only the title, the credential
inputs, where the forms submit to, and the first visible words are used - never the whole page.
"""
import html as _h
import re
from urllib.parse import urljoin, urlsplit

TEXT_CHARS = 600
_WS = re.compile(r"\s+")


def _host(u):
    try:
        return (urlsplit(u).hostname or "").lower()
    except ValueError:
        return ""


def _relation(page_url, action_urls):
    """'none' | 'same' | 'external' | 'mixed' - where the page's forms submit, relative to the page itself."""
    ph = _host(page_url)
    rel = set()
    for a in action_urls or []:
        a = (a or "").strip()
        if not a or a.startswith(("#", "javascript:")):
            rel.add("same")
            continue
        h = _host(urljoin(page_url, a))
        if not h or h == ph or h.endswith("." + ph) or ph.endswith("." + h):
            rel.add("same")
        else:
            rel.add("external")
    if not rel:
        return "none"
    return rel.pop() if len(rel) == 1 else "mixed"


def compose(url_text, title, has_password, has_email, has_otp, relation, n_forms, text):
    inputs = " ".join(x for x, on in (("password", has_password), ("email", has_email), ("otp", has_otp)) if on) or "no-credentials"
    return (f"{url_text} [title] {_WS.sub(' ', title or '').strip()[:120] or '-'} [inputs] {inputs} "
            f"[forms] {min(int(n_forms or 0), 9)} submit {relation} [text] {_WS.sub(' ', text or '').strip()[:TEXT_CHARS]}")


def summary_from_signals(url, sig, url_text):
    sig = sig or {}
    actions = sig.get("form_actions") or []
    return compose(url_text, sig.get("page_title") or sig.get("title") or "",
                   bool(sig.get("has_password") or sig.get("login_form_found")), bool(sig.get("has_email")),
                   bool(sig.get("has_otp")), _relation(url, actions), sig.get("form_count") or len(actions),
                   sig.get("visible_text") or sig.get("full_text") or sig.get("text_snippet") or "")


def summary_from_html(url, html, url_text):
    """Training side: HTML -> the same signals dict the extension sends -> the same summary."""
    return summary_from_signals(url, signals_from_html(url, html), url_text)


def signals_from_html(url, html):
    """The extension's dom_signals, reconstructed from raw HTML (selectolax when available, else regex)."""
    html = html or ""
    try:
        from selectolax.parser import HTMLParser
        t = HTMLParser(html)
        title = t.css_first("title").text() if t.css_first("title") else ""
        pw = bool(t.css('input[type="password"]'))
        em = bool(t.css('input[type="email"]'))
        otp = bool(t.css('input[autocomplete="one-time-code"]'))
        forms = t.css("form")
        actions = [f.attributes.get("action") or "" for f in forms]
        for n in t.css("script, style, noscript, template, svg"):
            n.decompose()
        body = t.body
        text = body.text(separator=" ") if body else ""
    except ImportError:
        m = re.search(r"<title[^>]*>(.*?)</title>", html, re.I | re.S)
        title = m.group(1) if m else ""
        pw = bool(re.search(r"type\s*=\s*['\"]?password", html, re.I))
        em = bool(re.search(r"type\s*=\s*['\"]?email", html, re.I))
        otp = "one-time-code" in html
        forms = re.findall(r"<form\b[^>]*>", html, re.I)
        actions = [(re.search(r"action\s*=\s*['\"]([^'\"]*)", f, re.I) or [None, ""])[1] for f in forms]
        text = re.sub(r"<[^>]+>", " ", re.sub(r"<(script|style|noscript)[^>]*>.*?</\1>", " ", html, flags=re.I | re.S))
    # form.action in the browser is absolute and falls back to the page URL when the attribute is empty
    abs_actions = [urljoin(url, a) if a and not a.startswith(("#", "javascript:")) else url for a in actions]
    return {"page_title": _h.unescape(title)[:200], "has_password": pw, "has_email": em, "has_otp": otp,
            "login_form_found": pw, "form_actions": abs_actions, "form_count": len(forms),
            "visible_text": _WS.sub(" ", _h.unescape(text)).strip()[:4000]}
