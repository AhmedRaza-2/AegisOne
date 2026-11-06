"""
English-only filter for the text model's training data (the product supports English only).

A cheap, dependency-free rule: reject text written in a non-Latin script (Urdu, Hindi, Arabic ...) and text written in
romanised Urdu/Hindi ("aapka account block ho gaya hai") by counting its most common function words; require a few English
function words in anything longer than a few tokens. Measured on the corpora it is conservative: it drops some English
messages with many local words rather than keeping any romanised text.
"""
import re

_TOKEN = re.compile(r"[a-zA-Z']+")
# very common romanised Urdu / Hindi function words that are not English words
_ROMAN = frozenset("""hai hain ka ki ke ko aap aapka aapki aapke apka apki apke mein mai se ho hoga hogi kar kare karein karen nahi nahin
abhi jaldi bhai baji sahab sahib wala wali rupay rupaye paisay paise bheje bhejein bhej diya gaya gayi gaye tha thi hum tum yeh yah woh wo
lekin aur ya liye lye zaroor shukriya kia kya kyun kyu ab bohat bahut acha theek mujhe tumhe unhe usko isko""".split())
_EN = frozenset("""the to your you is a and of for in on this that with it be are will we our from or if not please at by as an can has have
was were do does your account number code message call click link""".split())


def is_english(text: str) -> bool:
    t = str(text)
    letters = [c for c in t if c.isalpha()]
    if not letters:
        return False
    if sum(1 for c in letters if ord(c) > 0x024F) / len(letters) > 0.15:        # Arabic, Devanagari, Urdu script ...
        return False
    toks = [w.lower() for w in _TOKEN.findall(t)]
    if len(toks) < 3:
        return True
    roman = sum(1 for w in toks if w in _ROMAN)
    if roman >= 2 or roman / len(toks) > 0.10:
        return False
    return len(toks) < 6 or sum(1 for w in toks if w in _EN) >= 1
