"""
Input normalisation for the text model (adversarial-robustness layer 1).

Attackers hide scam wording from a classifier with characters a person does not notice:
zero-width characters inside words, Cyrillic/Greek look-alike letters, "p4ssw0rd" leetspeak, "v e r i f y" spacing,
and defanged links ("hxxp://evil[.]com"). The model was trained on plain text, so each trick moves the message away from
anything it has seen. This module turns all of them back into the plain text a reader would see - for the MODEL INPUT only
(the original message is still what is shown and stored). It is deliberately conservative: it only rewrites a word when the
result is a known scam-vocabulary word, so genuine text is left alone.

Measured in AIML/eval/adversarial_text.py (docs/TEST_REPORT.md section 13).
"""
import re
import unicodedata

# characters that render as nothing (or reorder text) and are never needed to read a message
_INVISIBLE = dict.fromkeys(map(ord, "­͏؜ᅟᅠ឴឵᠎​‌‍‎‏‪‫‬‭‮"
                               "⁠⁡⁢⁣⁤⁦⁧⁨⁩⁪⁫⁬⁭⁮⁯﻿︎️"), None)

# Cyrillic / Greek letters that look like Latin ones
_LOOKALIKE = str.maketrans({
    "а": "a", "е": "e", "о": "o", "р": "p", "с": "c", "у": "y", "х": "x", "і": "i", "ј": "j", "ѕ": "s", "ԁ": "d", "һ": "h", "ԛ": "q", "ԝ": "w",
    "А": "A", "В": "B", "Е": "E", "К": "K", "М": "M", "Н": "H", "О": "O", "Р": "P", "С": "C", "Т": "T", "Х": "X", "І": "I", "Ѕ": "S",
    "α": "a", "ο": "o", "ρ": "p", "ν": "v", "ε": "e", "ι": "i", "κ": "k", "τ": "t", "υ": "u", "Α": "A", "Β": "B", "Ε": "E", "Ζ": "Z",
    "Η": "H", "Ι": "I", "Κ": "K", "Μ": "M", "Ν": "N", "Ο": "O", "Ρ": "P", "Τ": "T", "Υ": "Y", "Χ": "X",
})
_LEET = str.maketrans({"0": "o", "1": "l", "3": "e", "4": "a", "5": "s", "7": "t", "@": "a", "$": "s", "!": "i"})

# words whose obfuscated spelling is worth undoing (kept small and specific on purpose)
_VOCAB = frozenset("""password passcode verify verification account login signin secure security bank banking update suspended suspend confirm
urgent payment transfer click link otp pin code refund reward prize winner gift card paypal amazon microsoft google apple netflix
blocked locked limited expire expired identity credit debit wallet crypto invoice""".split())

_DEFANG = [
    (re.compile(r"\bh(?:xx|tt|XX|TT)p(s?)\s*(?:://|:\\\\|\[:\]//|\[://\])", re.I), r"http\1://"),
    (re.compile(r"\s?[\[\(\{]\s*(?:\.|dot)\s*[\]\)\}]\s?", re.I), "."),
    (re.compile(r"\s?[\[\(\{]\s*(?:@|at)\s*[\]\)\}]\s?", re.I), "@"),
    (re.compile(r"\s?[\[\(\{]\s*:\s*[\]\)\}]\s?"), ":"),
]
_SPACED = re.compile(r"(?<![A-Za-z])(?:[A-Za-z][ .\-_*]){4,}[A-Za-z](?![A-Za-z])")
_WORD = re.compile(r"[^\s]+")


def _unspace(m: "re.Match") -> str:
    joined = re.sub(r"[ .\-_*]", "", m.group(0))
    return joined if joined.lower() in _VOCAB else m.group(0)


def _unleet(word: str) -> str:
    core = word.strip(".,;:?\"'()[]{}<>")
    if not core or not any(c.isalpha() for c in core) or not any(c in "013457@$" for c in core):
        return word
    if "://" in word or "/" in word or "." in core.strip("."):     # looks like a link / domain: leave the URL pipeline to it
        return word
    cand = core.translate(_LEET).lower()
    if cand in _VOCAB:
        return word.replace(core, cand)
    return word


def _fix_mixed_script(word: str) -> str:
    """Replace look-alike letters only inside words that also contain Latin letters (a real Russian word is left alone)."""
    has_latin = any("a" <= c.lower() <= "z" for c in word)
    has_look = any(ord(c) > 0x37F for c in word) or any(c in "αορνειτυκ" for c in word)
    return word.translate(_LOOKALIKE) if has_latin and has_look else word


def normalize_message(text: str) -> str:
    """Return the plain-reading version of a message for the model. Idempotent; never raises."""
    try:
        t = unicodedata.normalize("NFKC", str(text or ""))
        t = t.translate(_INVISIBLE)
        for pat, rep in _DEFANG:
            t = pat.sub(rep, t)
        t = _SPACED.sub(_unspace, t)
        if re.search(r"[^\x00-\x7f]", t) or re.search(r"[013457@$!]", t):
            t = _WORD.sub(lambda m: _unleet(_fix_mixed_script(m.group(0))), t)     # whitespace and line breaks are kept
        return t
    except Exception:
        return str(text or "")
