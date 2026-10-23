"""Unit tests for the pure logic added in the completion push (no database, no models needed)."""
import time

import pytest

from api.services import awareness_content as ac
from api.services import integrations as integ
from api.services import license as lic
from api.services import weight_trainer as wt


# ── weight gate ─────────────────────────────────────────────────────────────────────

def m(auc, f1, recall, fpr, n=500):
    return {"n": n, "auc": auc, "f1": f1, "recall": recall, "fpr": fpr}


def test_gate_accepts_a_clear_improvement():
    base = {"hard": m(0.980, 0.868, 0.780, 0.020)}
    cand = {"hard": m(0.981, 0.890, 0.825, 0.022)}
    ok, why = wt.judge(base, cand, None, None)
    assert ok and any("F1" in w for w in why)


def test_gate_rejects_more_false_alarms():
    base = {"hard": m(0.980, 0.868, 0.780, 0.020)}
    cand = {"hard": m(0.981, 0.890, 0.825, 0.030)}      # +1 point of false positives is more than the 0.5 allowed
    ok, why = wt.judge(base, cand, None, None)
    assert not ok and any("false-positive" in w for w in why)


def test_gate_rejects_auc_regression_and_no_gain():
    base = {"a": m(0.990, 0.95, 0.94, 0.01)}
    assert not wt.judge(base, {"a": m(0.980, 0.96, 0.95, 0.01)}, None, None)[0]          # AUC fell 0.010
    ok, why = wt.judge(base, {"a": m(0.990, 0.951, 0.94, 0.01)}, None, None)              # nothing measurably better
    assert not ok and "no measurable improvement" in why[0]


def test_metrics_basic():
    import numpy as np
    r = wt.metrics(np.array([1, 1, 0, 0]), np.array([0.9, 0.4, 0.2, 0.6]))
    assert r["recall"] == 0.5 and r["fpr"] == 0.5 and r["n"] == 4


def test_train_refuses_too_little_data():
    res = wt.train_org_heads(["http://a.test"] * 5, [1] * 5)
    assert not res["trained"] and not res["accepted"] and res["heads"] is None


# ── license / organization binding ──────────────────────────────────────────────────

def test_org_binding(monkeypatch):
    monkeypatch.setattr(lic, "ORG_ID", "acme")
    monkeypatch.setattr(lic, "ENFORCE", "warn")
    assert lic.user_allowed("acme", "employee")
    assert lic.user_allowed(None, "employee")                  # legacy org_default accounts keep working
    assert not lic.user_allowed("other_org", "admin")          # another tenant's account is refused
    assert lic.user_allowed("other_org", "global_admin")       # platform operators are exempt
    monkeypatch.setattr(lic, "ENFORCE", "off")
    assert lic.user_allowed("other_org", "admin")


def test_strict_mode_blocks_only_ordinary_paths(monkeypatch):
    monkeypatch.setattr(lic, "ENFORCE", "strict")
    monkeypatch.setitem(lic._state, "valid", False)
    monkeypatch.setitem(lic._state, "reason", "License expired")
    assert lic.is_blocked("/scan/url")[0]
    assert not lic.is_blocked("/health")[0] and not lic.is_blocked("/auth/login")[0] and not lic.is_blocked("/license/status")[0]
    monkeypatch.setitem(lic._state, "valid", True)
    assert not lic.is_blocked("/scan/url")[0]


# ── webhooks / API keys / SIEM ──────────────────────────────────────────────────────

def test_webhook_signature_roundtrip_and_replay():
    body = b'{"event":"critical_scan"}'
    header = integ.sign("whsec_x", int(time.time()), body)
    assert integ.verify_signature("whsec_x", header, body)
    assert not integ.verify_signature("whsec_y", header, body)
    assert not integ.verify_signature("whsec_x", header, body + b" ")
    old = integ.sign("whsec_x", int(time.time()) - 3600, body)
    assert not integ.verify_signature("whsec_x", old, body)


def test_api_keys_are_hashed_and_unique():
    k1, p1, h1 = integ.new_api_key()
    k2, _, h2 = integ.new_api_key()
    assert k1 != k2 and h1 != h2 and h1 == integ.hash_key(k1) and k1.startswith("aegis_") and p1 == k1[:12]
    assert k1 not in h1


def test_cef_escapes_separators():
    class S:  # a WebsiteScan-shaped object
        domain = "evil|x.com"; url = "http://evil.com/?a=b"; decision = "block"; threat_type = "phish|ing"
        risk_score = 92; user_id = 7
        class created_at:
            @staticmethod
            def timestamp(): return 1_700_000_000
    line = integ.to_cef(S)
    assert line.startswith("CEF:0|AegisOne|Shield|1.0|scan.block|phish\\|ing|10|")
    assert "request=http://evil.com/?a\\=b" in line


@pytest.mark.asyncio
async def test_webhook_targets_must_be_public():
    for bad in ("http://127.0.0.1/x", "http://169.254.169.254/latest", "http://localhost:8000/hook", "ftp://example.com/x", "http://10.1.2.3/"):
        with pytest.raises(ValueError):
            await integ.assert_public_target(bad)


# ── awareness content ───────────────────────────────────────────────────────────────

def test_every_template_renders_and_points_at_a_real_module():
    for t in ac.TEMPLATES:
        out = ac.render_template(t, "Sara", "Acme", "https://x.test/sim/abc", "acme")
        assert "{" not in out["subject"] + out["body"] + out["from_address"], t["key"]
        assert "https://x.test/sim/abc" in out["body"]
        assert t["red_flags"] and ac.get_module(t["module"]), t["key"]
        assert t["difficulty"] in ac.DIFFICULTY


def test_quiz_grading_and_no_answer_leak():
    mod = ac.get_module("credential_safety")
    pub = ac.public_module(mod)
    assert all("answer" not in q and "why" not in q for q in pub["quiz"])
    perfect = ac.grade(mod, [q["answer"] for q in mod["quiz"]])
    assert perfect["score"] == 100 and perfect["passed"]
    wrong = ac.grade(mod, [(q["answer"] + 1) % len(q["options"]) for q in mod["quiz"]])
    assert wrong["score"] == 0 and not wrong["passed"]
    assert ac.grade(mod, [])["score"] == 0
