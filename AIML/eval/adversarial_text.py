"""
Adversarial-rewrite gate for the text model (scope: "ensemble + hard rules for adversarial robustness").

Takes scam messages the model catches in their clean form, applies the evasions real attackers use, and measures how many
are still caught - with and without the input normaliser (AIML/message/normalize.py). A release must not lose more than
MAX_DROP of the clean recall on any single evasion (exit code 1 otherwise), and the normaliser must not change what it does
to genuine messages (false alarms on the genuine set may rise by at most 0.5 points).

Run:  python -m AIML.eval.adversarial_text            (needs the models: HF_HUB_OFFLINE=1 is fine)
"""
import os
import random
import re
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parents[2]
sys.path.insert(0, str(ROOT))
os.environ.setdefault("HF_HUB_OFFLINE", "1")

import numpy as np
import pandas as pd

THRESH = 0.51
MAX_DROP = 0.05
KEYWORDS = re.compile(r"\b(password|verify|account|login|secure|bank|update|suspended|confirm|urgent|payment|click|code|otp|blocked|refund|prize|gift)\b", re.I)
HOMO = {"a": "а", "e": "е", "o": "о", "c": "с", "p": "р", "i": "і", "x": "х", "y": "у"}
LEET = {"a": "4", "e": "3", "o": "0", "i": "1", "s": "5", "t": "7"}


def zwsp(t: str) -> str:
    return KEYWORDS.sub(lambda m: "​".join(m.group(0)), t)


def homoglyph(t: str) -> str:
    return KEYWORDS.sub(lambda m: "".join(HOMO.get(c, c) if i % 2 == 0 else c for i, c in enumerate(m.group(0))), t)


def leet(t: str) -> str:
    return KEYWORDS.sub(lambda m: "".join(LEET.get(c.lower(), c) for c in m.group(0)), t)


def spaced(t: str) -> str:
    return KEYWORDS.sub(lambda m: " ".join(m.group(0)), t)


def defang(t: str) -> str:
    t = re.sub(r"https?://", lambda m: m.group(0).replace("tt", "xx"), t)
    return re.sub(r"(?<=[A-Za-z0-9])\.(?=[A-Za-z]{2,}(?:/|\b))", "[.]", t)


def altcase(t: str) -> str:
    return "".join(c.upper() if i % 2 else c.lower() for i, c in enumerate(t))


EVASIONS = {"zero-width": zwsp, "look-alike letters": homoglyph, "leetspeak": leet, "spaced letters": spaced,
            "defanged link": defang, "alternating case": altcase,
            "all combined": lambda t: defang(homoglyph(zwsp(t)))}


def load_sets():
    from AIML.eval.eval_scamguard import load
    rows = [r for r in load() if r["language"] == "en"]
    scams = [r["text"] for r in rows if r["label"] == 1]
    genuine = [r["text"] for r in rows if r["label"] == 0]
    hw = pd.read_csv(ROOT / "AIML/eval/handwritten_sms.csv")
    from AIML.message.english import is_english
    hw = hw[hw.text.map(is_english)]
    scams += list(hw[hw.label == 1].text)
    genuine += list(hw[hw.label == 0].text)
    return scams, genuine


def main():
    from api.services import model_orchestrator as mo
    mo.load_v2_heads(); mo.load_m1()
    import AIML.message.normalize as nz
    scams, genuine = load_sets()
    random.Random(7).shuffle(scams)
    scams = scams[:200]

    def score(texts):
        return np.array([float(mo._predict_text_sync(t)["phishing_probability"]) for t in texts])

    results = {}
    for use_norm in (False, True):
        mo.normalize_message = nz.normalize_message if use_norm else (lambda t: t)
        base = score(scams)
        keep = [t for t, s in zip(scams, base) if s >= THRESH]       # only scams caught in clean form are attacked
        row = {"clean caught": len(keep) / len(scams)}
        for name, fn in EVASIONS.items():
            sc = score([fn(t) for t in keep])
            row[name] = float(np.mean(sc >= THRESH)) if len(keep) else 0.0
        row["genuine flagged"] = float(np.mean(score(genuine) >= THRESH))
        results["with normaliser" if use_norm else "without normaliser"] = row

    df = pd.DataFrame(results).T
    print(f"\nScams caught after each evasion (of the {int(round(df['clean caught'].iloc[0] * len(scams)))} caught clean; n_scams={len(scams)}, genuine={len(genuine)})")
    print((df * 100).round(1).to_string())
    ok = all(results["with normaliser"][k] >= 1 - MAX_DROP for k in EVASIONS)
    ok &= results["with normaliser"]["genuine flagged"] <= results["without normaliser"]["genuine flagged"] + 0.005
    print("\nGATE:", "PASS" if ok else "FAIL", f"(each evasion keeps >= {int((1 - MAX_DROP) * 100)}% of clean recall; genuine false alarms +<=0.5 pt)")
    sys.exit(0 if ok else 1)


if __name__ == "__main__":
    main()
