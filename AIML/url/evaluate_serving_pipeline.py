"""
Evaluate the URL pipeline exactly as the API serves it (api.services.model_orchestrator).

Reports, for the current configuration:
  * recall on recent verified PhishTank URLs (AIML/url/verified_online.csv, 2026 submissions)
  * false-positive rate on held-out benign URLs (AIML/url/v7_test.csv) and on a hand-made list of
    well-known sites with typical login / deep-link paths
  * ROC-AUC between the two

Run from the repo root:
    python -m AIML.url.evaluate_serving_pipeline            # defaults used in production
    AEGIS_URL_PREP=raw python -m AIML.url.evaluate_serving_pipeline         # old (mismatched) input
    AEGIS_FAST_URL_MODE=1 python -m AIML.url.evaluate_serving_pipeline      # rules-only shortcut
    AEGIS_URL_CLEAN_CAP=0.15 python -m AIML.url.evaluate_serving_pipeline   # old score ceiling
"""
import os
import sys
from pathlib import Path

import numpy as np
import pandas as pd

ROOT = Path(__file__).resolve().parents[2]
sys.path.insert(0, str(ROOT))

N = int(os.environ.get("EVAL_N", "300"))
POPULAR = """https://www.google.com/search?q=weather https://github.com/pallets/flask/issues/123 https://www.youtube.com/watch?v=dQw4w9WgXcQ https://en.wikipedia.org/wiki/Phishing
https://www.amazon.com/dp/B08N5WRWNW https://mail.google.com/mail/u/0/#inbox https://outlook.live.com/mail/0/ https://www.linkedin.com/in/someone https://stackoverflow.com/questions/11227809
https://www.paypal.com/myaccount/summary https://www.microsoft.com/en-us/microsoft-365 https://login.microsoftonline.com/common/oauth2/authorize https://accounts.google.com/signin/v2/identifier
https://www.facebook.com/login https://twitter.com/home https://www.reddit.com/r/programming https://www.nytimes.com/2026/03/01/world/news.html https://www.bbc.com/news/world-12345678
https://docs.python.org/3/library/asyncio.html https://developer.mozilla.org/en-US/docs/Web/JavaScript https://www.dawn.com/news/1800000 https://www.daraz.pk/products/item-i123456.html
https://www.hbl.com/personal https://www.ubl.com.pk/ https://www.au.edu.pk/Pages/Student/home.aspx https://zoom.us/j/123456789 https://drive.google.com/file/d/abc/view
https://www.dropbox.com/home https://slack.com/signin https://www.netflix.com/browse https://www.apple.com/iphone/ https://support.apple.com/en-us/HT201994
https://www.cloudflare.com/learning/ https://aws.amazon.com/console/ https://console.cloud.google.com/home https://azure.microsoft.com/en-us/ https://www.office.com/
https://www.instagram.com/p/Cxyz/ https://web.whatsapp.com/ https://www.coursera.org/learn/machine-learning https://medium.com/@user/post-123 https://www.imdb.com/title/tt0111161/
https://www.booking.com/hotel/pk/pearl.html https://www.ebay.com/itm/1234567890 https://www.walmart.com/ip/12345 https://www.irs.gov/individuals https://www.who.int/health-topics""".split()


def main():
    from api.services import model_orchestrator as mo
    from sklearn.metrics import roc_auc_score
    mo.load_all_models()

    benign = pd.read_csv(ROOT / "AIML/url/v7_test.csv")
    benign = benign[benign.label == 0].sample(N, random_state=21)["url"].tolist()
    phish = pd.read_csv(ROOT / "AIML/url/verified_online.csv")
    phish = phish[phish.submission_time >= "2026-03-01"].sample(N, random_state=21)["url"].tolist()

    def probs(urls):
        return np.array([(mo._predict_url_sync(u).get("phishing_probability") or 0) for u in urls])

    pb, pp, ppop = probs(benign), probs(phish), probs(POPULAR)
    auc = roc_auc_score([0] * len(pb) + [1] * len(pp), list(pb) + list(pp))
    print(f"config: prep={os.environ.get('AEGIS_URL_PREP', 'auto')} fast_url={mo.FAST_URL_MODE} "
          f"clean_cap={os.environ.get('AEGIS_URL_CLEAN_CAP', '0.6')}")
    print(f"ROC-AUC (recent PhishTank vs held-out benign): {auc:.3f}")
    for th in (0.5, 0.35):
        print(f"threshold {th}: PhishTank-2026 recall {np.mean(pp >= th):.3f} | "
              f"benign FPR {np.mean(pb >= th):.3f} | famous-site false positives {int(np.sum(ppop >= th))}/{len(POPULAR)}")


if __name__ == "__main__":
    main()
