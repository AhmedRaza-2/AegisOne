"""Open-source URL second opinion: the decision rule can only raise a WARN to BLOCK, never lower anything."""
import pytest

from api.services import second_opinion as so

CFG = {"stacker": {"coef_aegisone": 1.655, "coef_open": 0.273, "intercept": 0.257},
       "upgrade_threshold": 0.873, "warn": 0.35, "block": 0.60}


def test_warn_is_raised_to_block_only_when_both_models_are_confident():
    d = so.decide(0.58, 0.99, CFG, "upgrade")
    assert d["upgrade"] and d["new_probability"] >= 0.60
    assert not so.decide(0.58, 0.10, CFG, "upgrade")["upgrade"]       # open model disagrees -> stays WARN
    assert not so.decide(0.40, 0.99, CFG, "upgrade")["upgrade"]       # low in the WARN band: one confident model is not enough


def test_safe_and_block_verdicts_are_never_changed():
    for p in (0.02, 0.20, 0.34):                                        # SAFE stays SAFE even if the open model screams
        d = so.decide(p, 0.999, CFG, "upgrade")
        assert not d["upgrade"] and d["new_probability"] == p
    for p in (0.60, 0.95):                                              # BLOCK is never lowered
        d = so.decide(p, 0.001, CFG, "upgrade")
        assert not d["upgrade"] and d["new_probability"] == p


def test_shadow_mode_reports_but_never_changes():
    d = so.decide(0.55, 0.99, CFG, "shadow")
    assert not d["upgrade"] and d["new_probability"] == 0.55 and d["agrees"]


def test_agreement_flags():
    assert so.decide(0.80, 0.90, CFG, "shadow")["agrees"]
    assert not so.decide(0.05, 0.90, CFG, "shadow")["agrees"]


def test_mode_validation():
    old = so.get_mode()
    try:
        assert so.set_mode("off") == "off" and so.get_mode() == "off"
        with pytest.raises(ValueError):
            so.set_mode("always-block")
    finally:
        so.set_mode(old)


def test_apply_is_a_no_op_when_off():
    old = so.get_mode()
    try:
        so.set_mode("off")
        r = {"phishing_probability": 0.5, "prediction": "malicious", "evidence": {}}
        assert so.apply(dict(r), "http://example.com") == r
    finally:
        so.set_mode(old)


def test_shipped_config_is_consistent():
    cfg = so.config()
    m = cfg["models"][0]
    assert m["licence"] in ("apache-2.0", "mit") and len(m["revision"]) == 40
    assert cfg["default_mode"] in so.MODES and 0.5 < m["upgrade_threshold"] < 1
