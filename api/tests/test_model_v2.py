"""Unit tests for the model-quality work: domain reputation, v2 feature extractors, embed-head training,
calibration, thresholds and the organisation-retraining gate. No network, no embedding model needed."""
import numpy as np
import pytest

from AIML.embed_head import EmbedHead, FORMAT, build_spec, fit_logistic, fit_platt, threshold_at_fpr
from AIML.email.features_v2 import NAMES as EMAIL_NAMES, email_features
from AIML.text_general.features_v2 import NAMES as TEXT_NAMES, text_features
from AIML.url import reputation as rep


# ── domain reputation ──────────────────────────────────────────────────────────────────────────────
def test_reputation_matches_the_exact_registered_domain_only():
    if rep.list_size() == 0:
        pytest.skip("reputation list not built")
    assert rep.reputation("docs.python.org")["listed"]
    assert rep.reputation("www.google.com")["listed"]
    assert not rep.reputation("google.com.evil-login.xyz")["listed"]        # suffix trick
    assert not rep.reputation("paypal-secure-login.top")["listed"]          # brand inside a new domain
    assert not rep.reputation("185.12.4.9")["listed"]                       # raw IP


def test_user_content_platforms_are_never_fully_trusted():
    if rep.list_size() == 0:
        pytest.skip("reputation list not built")
    r = rep.reputation("docs.google.com")
    assert r["user_content"] and not r["listed"]
    # a blog on a popular platform is its own registered domain (public-suffix private section)
    assert rep.registered_domain("attacker.github.io") == "attacker.github.io"
    assert not rep.reputation("attacker.github.io")["listed"]


def test_free_hosting_gets_no_reputation_even_when_the_platform_is_popular():
    for h in ("start-re-trresezer.gitbook.io", "knkddkmlmeaedd.weebly.com", "divace-coinsquare.zapier.app",
              "vmi3708922.contaboserver.net", "forms.office.com", "sites.google.com"):
        r = rep.reputation(h)
        assert r["hosting"] and not r["listed"] and not r["user_content"], h
    from AIML.url.brand_engine import _is_official_host
    assert not _is_official_host("forms.office.com") and _is_official_host("outlook.office.com")


def test_at_sign_counts_only_in_the_host_part():
    from AIML.url.lexical_engine import extract_expanded_features
    assert extract_expanded_features("http://paypal.com@evil-login.top/verify")[17] == 1.0     # user-info trick
    assert extract_expanded_features("https://www.snapchat.com/@someone?locale=en")[17] == 0.0  # profile handle
    assert extract_expanded_features("https://example.com/contact?to=a@b.com")[17] == 0.0      # e-mail in a query


def test_pakistani_sites_below_the_global_cutoff_are_reputable():
    if rep.list_size() == 0:
        pytest.skip("reputation list not built")
    assert rep.reputation("www.psx.com.pk")["listed"] and rep.reputation("www.olx.com.pk")["listed"]
    assert not rep.reputation("psx-com-pk.verify-login.top")["listed"]


# ── feature extractors ─────────────────────────────────────────────────────────────────────────────
def test_email_features_capture_the_attack_shape_not_the_words():
    f = dict(zip(EMAIL_NAMES, email_features("Microsoft 365 <no-reply@secure-verify-login.info>", "Password expires today",
                                             "Your password expires today. Confirm it here immediately: http://secure-verify-login.info/x")))
    assert f["has_url"] == 1 and f["url_bad_tld"] == 1 and f["sender_display_brand_mismatch"] == 1 and f["urgency_and_cred"] > 0
    g = dict(zip(EMAIL_NAMES, email_features("Ayesha <ayesha@company.pk>", "Lunch tomorrow?", "Are you free for lunch tomorrow?")))
    assert g["has_url"] == 0 and g["cred_ask"] == 0 and g["urgency_and_cred"] == 0
    bec = dict(zip(EMAIL_NAMES, email_features("CEO <ceo.office@gmail.com>", "Quick favour",
                                               "Buy gift cards for a client today. Keep this between us, I am in a meeting.")))
    assert bec["sender_freemail"] == 1 and bec["pay_and_secrecy"] > 0


def test_text_features_work_in_roman_urdu_and_urdu_script():
    f = dict(zip(TEXT_NAMES, text_features("Aap ke mobile par code aaya hai, ghalti se. Please woh code mujhe bhej dein.")))
    assert f["ask_code"] > 0 and f["wrong_send_story"] > 0
    u = dict(zip(TEXT_NAMES, text_features("آپ کا اکاؤنٹ بند کر دیا گیا ہے۔ دوبارہ چالو کرنے کے لیے اپنا پن کوڈ بھیجیں۔")))
    assert u["urdu_script"] == 1 and u["ask_secret"] > 0
    otp = dict(zip(TEXT_NAMES, text_features("Your OTP is 482915. Do not share this code with anyone.")))
    assert otp["safety_warning"] > 0 and otp["has_code_number"] == 1


# ── head training / calibration / thresholds ──────────────────────────────────────────────────────
def _toy(n=600, d=8, seed=0):
    r = np.random.default_rng(seed)
    X = r.normal(size=(n, d)).astype(np.float32)
    y = (X[:, 0] + 0.5 * X[:, 1] + 0.3 * r.normal(size=n) > 0).astype(int)
    return X, y


def test_logistic_fit_learns_and_prox_keeps_weights_near_the_anchor():
    X, y = _toy()
    w, b = fit_logistic(X, y.astype(float), l2=0.1, iters=300)
    assert w[0] > 1.0 and w[0] > abs(w[2])
    anchor = np.zeros_like(w)
    w2, _ = fit_logistic(X[:20], y[:20].astype(float), w0=anchor, b0=0.0, prox=50.0, iters=300)
    assert np.abs(w2).max() < np.abs(w).max()      # a strong proximal term resists 20 samples


def test_platt_and_thresholds():
    r = np.random.default_rng(1)
    x = np.concatenate([r.normal(-1, 1, 2000), r.normal(1, 1, 2000)])
    y = np.concatenate([np.zeros(2000), np.ones(2000)])
    logit = 6 * x                                   # true log-odds are 2x: these scores are 3x over-confident
    a, c = fit_platt(logit, y)
    assert abs(a - 1 / 3) < 0.08 and abs(c) < 0.1   # temperature ~3 recovered, ranking unchanged
    neg = r.uniform(size=10000)
    assert abs(threshold_at_fpr(neg, 0.01) - 0.99) < 0.01


def test_spec_roundtrip_is_json_and_scores_are_probabilities():
    X, y = _toy()
    spec = build_spec("text", "multi", X[:500], y[:500], [f"f{i}" for i in range(X.shape[1])], holdout=(X[500:], y[500:]),
                      legit_for_thresholds=X[y == 0])
    import json
    spec2 = json.loads(json.dumps(spec))
    h = EmbedHead(spec2, lambda *a: None)
    p = h.proba_from_design(X)
    assert spec2["format"] == FORMAT and ((p >= 0) & (p <= 1)).all()
    from sklearn.metrics import roc_auc_score
    assert roc_auc_score(y, p) > 0.9
    t = spec2["thresholds"]
    assert t["block"] >= t["warn"] >= t["suspicious"]
    # the product scale: 51 (WARN) is crossed by about 1% of legitimate examples, 76 (BLOCK) by about 0.1%
    risk = h.risk_from_design(X[y == 0])
    assert abs(np.mean(risk >= 0.51) - 0.01) < 0.02 and np.mean(risk >= 0.76) <= 0.01
    xs = spec2["risk_map"][0]
    assert all(b > a for a, b in zip(xs, xs[1:]))                 # strictly monotone
    assert roc_auc_score(y, h.risk_from_design(X)) == roc_auc_score(y, p)   # ranking unchanged


def test_non_json_head_file_is_refused(tmp_path):
    from AIML.embed_head import load
    bad = tmp_path / "head.json"
    bad.write_text('{"format": "pickle"}')
    with pytest.raises(ValueError):
        load(bad, lambda *a: None)
