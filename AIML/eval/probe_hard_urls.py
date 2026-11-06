"""
Hard-case URL probe (Phase 0 acceptance test of docs/MODEL_RESEARCH_AND_PLAN.md): 31 real legitimate URLs that the
old pipeline got wrong or that stress it (Google Docs/Drive links, OAuth flows, deep links, Pakistani sites) and 15
typosquat / subdomain-trick phishing URLs. Scored in-process exactly as the API serves them.

Acceptance: no legitimate URL at WARN (>= 0.35) or above; every phishing URL at WARN or above.
Run:  python -m AIML.eval.probe_hard_urls
"""
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parents[2]
sys.path.insert(0, str(ROOT))

LEGIT = ['https://www.google.com/', 'https://www.google.com/search?q=weather+islamabad&oq=weather&sourceid=chrome&ie=UTF-8', 'https://accounts.google.com/signin/v2/identifier?service=mail&flowName=GlifWebSignIn', 'https://mail.google.com/mail/u/0/#inbox', 'https://drive.google.com/drive/folders/1AbCdEfGhIjKlMnOpQrStUvWxYz012345', 'https://docs.google.com/document/d/1x2y3z4AbCdEfGhIjKlMnOpQrStUvWxYz/edit', 'https://myaccount.google.com/security', 'https://www.youtube.com/watch?v=dQw4w9WgXcQ', 'https://www.youtube.com/results?search_query=phishing+awareness', 'https://maps.google.com/maps?q=air+university+islamabad', 'https://translate.google.com/?sl=en&tl=ur&text=hello', 'https://www.gstatic.com/images/branding/product/1x/gmail_2020q4_48dp.png', 'https://login.microsoftonline.com/common/oauth2/v2.0/authorize?client_id=00000002-0000-0ff1-ce00-000000000000&response_type=code', 'https://outlook.office.com/mail/inbox', 'https://github.com/AhmedRaza-2/AegisOne/pull/12', 'https://en.wikipedia.org/wiki/Phishing', 'https://www.amazon.com/dp/B08N5WRWNW?ref=ppx_yo2ov_dt_b_product_details', 'https://www.paypal.com/signin', 'https://www.facebook.com/login/', 'https://www.linkedin.com/in/someone-name-12a345b6/', 'https://stackoverflow.com/questions/11227809/why-is-processing-a-sorted-array-faster', 'https://www.nexusmods.com/', 'https://docs.python.org/3/library/urllib.parse.html', 'https://www.dawn.com/news/1859210/budget-2026', 'https://www.hbl.com/personal/accounts', 'https://www.nytimes.com/2026/10/20/technology/ai-security.html', 'https://drive.google.com/uc?export=download&id=1AbCdEfGhIjKlMnOpQrStUv', 'https://www.google.com/url?q=https://www.example.com/&sa=D&source=editors', 'https://support.apple.com/en-us/HT201994', 'https://zoom.us/j/12345678901?pwd=abcDEFghiJKLmnoPQRstu', 'https://www.dropbox.com/s/abc123xyz/report.pdf?dl=0']
PHISH = ['http://paypa1-secure-login.xyz/verify/account', 'http://secure-update-microsoft365.top/login.php', 'https://g00gle-accounts-verify.com/signin', 'http://amazon.account-verify.cn/ap/signin?openid.return_to=', 'http://192.168.4.77/hbl/login/index.php', 'https://login-microsoftonline.com.verify-session.ru/oauth2/authorize', 'http://facebook-security-alert.tk/confirm-identity', 'https://dhl-parcel-tracking-pay.info/redeem?id=88213', 'https://appleid.apple.com.account-locked.cc/unlock', 'https://bit.ly-secure-login.site/ubl/verify', 'http://netflix-billing-update.online/payment', 'https://docs.google.com.shared-file-view.xyz/document/d/1x2y3z/edit', 'https://sbp-gov-refund.pk.web-claim.top/cnic', 'https://account-chase-verify.work/login', 'https://wetransfer-download-files.ml/file/8841']
WARN = 0.35


def main():
    from api.services import model_orchestrator as mo
    mo.load_all_models()
    bad = 0
    for label, urls in (("legit", LEGIT), ("phish", PHISH)):
        for u in urls:
            r = mo._predict_url_sync(u)
            p = float(r.get("phishing_probability") or 0)
            wrong = (p >= WARN) if label == "legit" else (p < WARN)
            bad += wrong
            print(f"{'WRONG' if wrong else 'ok   '} {label:5s} {p:5.2f}  {u[:90]}  [{(r.get('evidence') or {}).get('fusion_method', '')[:60]}]")
    print()
    print(f"{len(LEGIT) + len(PHISH) - bad}/{len(LEGIT) + len(PHISH)} correct  ({bad} wrong)")
    return bad


if __name__ == "__main__":
    sys.exit(1 if main() else 0)
