"""QR payload kinds, adversarial input normalisation, BEC detection, behavioural anomaly scoring (no models needed)."""
import asyncio

from AIML.message.normalize import normalize_message
from api.services.bec import detect_bec
from api.services.behavior_anomaly import score_users
from api.services.qr_payload import classify_qr_payload


# ── QR codes ────────────────────────────────────────────────────────────────────────────────────────────
def test_qr_links_go_to_the_url_model_including_bare_domains_and_query_only():
    assert classify_qr_payload("https://example.com/a")["kind"] == "url"
    c = classify_qr_payload("xk3-account-update.top?id=9")
    assert c["kind"] == "url" and c["url"] == "http://xk3-account-update.top?id=9"


def test_qr_dangerous_kinds_get_a_floor_no_model_can_lower():
    assert classify_qr_payload("javascript:alert(1)")["floor"] >= 0.9
    assert classify_qr_payload("data:text/html;base64,PHNjcmlwdD4=")["kind"] == "script"
    assert classify_qr_payload("upi://pay?pa=x@bank&am=5000")["floor"] >= 0.51
    assert classify_qr_payload("market://details?id=evil.app")["kind"] == "app_install"
    w = classify_qr_payload("WIFI:T:nopass;S:FreeCafe;;")
    assert w["kind"] == "wifi" and "no password" in w["reason"]


def test_qr_shortener_is_marked_for_resolution_and_text_stays_text():
    assert classify_qr_payload("https://bit.ly/3abc")["shortener"] is True
    t = classify_qr_payload("Your account is blocked, call 0300 now")
    assert t["kind"] == "text" and t["floor"] == 0


# ── adversarial rewrites ────────────────────────────────────────────────────────────────────────────────
def test_normaliser_undoes_common_evasions():
    assert normalize_message("Ver​ify your acc​ount") == "Verify your account"
    assert normalize_message("Vеrify your ассоunt") == "Verify your account"
    assert normalize_message("Your p4ssw0rd expires") == "Your password expires"
    assert normalize_message("V e r i f y now") == "Verify now"
    assert normalize_message("go to hxxps://secure-bank[.]xyz/login") == "go to https://secure-bank.xyz/login"


def test_normaliser_leaves_genuine_text_alone():
    for t in ("Meeting at 5, bring 2 copies of the 1st report!", "Call 0300-1234567 at 7pm\nthanks",
              "Привет, как дела", "Order #A1B2 ships 3/4"):
        assert normalize_message(t) == t


# ── business e-mail compromise ──────────────────────────────────────────────────────────────────────────
def test_bec_executive_on_freemail_asking_for_gift_cards_is_high():
    r = detect_bec("CEO Ahmed <ahmed.ceo@gmail.com>", "Quick favour",
                   "Are you at your desk? Buy 5 Google Play gift cards today. Keep this confidential.", "inara.com")
    assert r["level"] == "high" and r["floor"] >= 0.76


def test_bec_lookalike_domain_and_display_name_spoof():
    assert detect_bec("Accounts <billing@lnara.com>", "Bank details", "Our bank details have changed, pay the overdue invoice to the new IBAN.", "inara.com")["level"] == "high"
    assert detect_bec('"ceo@inara.com" <x92@outlook.com>', "Wire", "Wire transfer of 4,500 USD needed before 3pm.", "inara.com")["level"] == "high"


def test_bec_genuine_vendor_reminder_and_colleague_mail_get_no_floor():
    assert detect_bec("Vendor <ar@vendorltd.com>", "Invoice 2231", "Gentle reminder that invoice 2231 is outstanding. Please settle the invoice.", "inara.com")["floor"] == 0
    assert detect_bec("Sara <sara@inara.com>", "Lunch", "Team lunch at 1pm today.", "inara.com")["level"] == "none"


# ── behavioural anomalies ───────────────────────────────────────────────────────────────────────────────
def _history(n=14, **today):
    per = {f"2026-10-{d:02d}": {"scans": 30 + d % 3, "warned": 0, "blocked": 0, "new_domains": 4} for d in range(1, n + 1)}
    per["today"] = {"scans": 31, "warned": 0, "blocked": 0, "new_domains": 4, **today}
    return per


def test_anomaly_flags_a_sudden_burst_against_the_persons_own_history():
    rows = score_users({1: _history(blocked=9, warned=12), 2: _history()}, today="today")
    top = rows[0]
    assert top["user_id"] == 1 and top["level"] in ("medium", "high") and any("blocked" in r for r in top["reasons"])
    assert next(r for r in rows if r["user_id"] == 2)["score"] < top["score"]


def test_anomaly_credentials_on_flagged_site_always_reported_and_new_users_are_learning():
    rows = score_users({7: {"today": {"scans": 5, "cred_on_flagged": 1}}}, today="today")
    assert rows[0]["status"] == "learning" and rows[0]["level"] == "high" and "sign-in" in rows[0]["reasons"][0]


def test_quiet_normal_day_is_low():
    rows = score_users({1: _history()}, today="today")
    assert rows[0]["level"] == "low" and rows[0]["reasons"] == []
