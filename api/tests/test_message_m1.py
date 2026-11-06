"""Message model M1: the shared input builder (train/serve parity) and its structural context."""
import numpy as np

from AIML.message import context as C


def test_link_context_flags_mismatch_and_shortener():
    t = C.build_text("email", "HBL Support <noreply@hbl.com>", "Verify", "Open http://hbl-verify.top/login now")
    assert "[channel] email" in t and "link-not-sender-domain" in t and "risky-tld" in t and "hbl-verify.top" in t
    t2 = C.build_text("sms", "", "", "Abhi verify karein bit.ly/xyz")
    assert "[sender] - unknown" in t2 and "shortener" in t2


def test_same_domain_link_is_not_flagged():
    t = C.build_text("email", "Billing <billing@acme.com>", "Invoice", "See https://portal.acme.com/invoice/9")
    assert "link-not-sender-domain" not in t


def test_sender_kinds():
    assert C.sender_kind("") == "unknown"
    assert C.sender_kind("x@gmail.com") == "freemail"
    assert C.sender_kind("PayPal Support <help@random-mail.xyz>") == "display-name-brand-mismatch"
    assert C.sender_kind("Ali <ali@acme.com>") == "organisation"


def test_history_slot_is_optional_and_capped():
    assert "[history]" not in C.build_text("sms", "", "", "hello")
    t = C.build_text("sms", "", "", "send it now", ["hi", "I need the money", "x" * 1000])
    assert "[history] hi | I need the money" in t and len(t) < 2600


def test_dense_features_channel_blocks():
    e = C.dense_features("email", "a@b.com", "s", "body")
    t = C.dense_features("sms", "", "", "hello there")
    assert e.shape == t.shape == (C.N_DENSE,)
    assert e[-2:].tolist() == [1.0, 0.0] and t[-2:].tolist() == [0.0, 1.0]
    assert not t[:30].any() and not e[30:52].any()


def test_intent_targets_describe_the_request():
    y = dict(zip(C.INTENTS, C.intent_targets("email", "a@b.com", "Urgent", "Verify your password immediately at http://evil.xyz")))
    assert y["urgency"] == 1.0 and y["credential_request"] == 1.0
    z = dict(zip(C.INTENTS, C.intent_targets("sms", "", "", "Please send the code you just received")))
    assert z["code_request"] == 1.0
    assert not np.any(C.intent_targets("sms", "", "", "Lunch at 1?"))
