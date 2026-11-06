"""Organisation retraining of the v2 e-mail / text heads (module 8.11): the acceptance gate, on synthetic data.
The embedding step is replaced by fixed vectors so the test needs no model download.

World: the shipped head learned an OLD threat landscape (phishing = direction 0). Today's landscape also uses
direction 1 (a new kind of lure). The frozen reference set and the organisation's verified reports come from today's
landscape, so a good update helps both; poisoned or redundant updates must be refused."""
from types import SimpleNamespace

import numpy as np
import pytest

from AIML.embed_head import EmbedHead, build_spec
from api.services import embed_retrain as er

D = 12


def _world(seed, n, new_landscape=True):
    r = np.random.default_rng(seed)
    X = r.normal(size=(n, D)).astype(np.float32)
    z = X[:, 0] + (1.2 * X[:, 1] if new_landscape else 0.0) + 0.3 * r.normal(size=n)
    return X, (z > 0).astype(int)


@pytest.fixture
def setup(monkeypatch):
    X, y = _world(0, 1200, new_landscape=False)                       # what the shipped head was trained on
    spec = build_spec("text", "multi", X[:900], y[:900], [f"f{i}" for i in range(D)], holdout=(X[900:1000], y[900:1000]),
                      legit_for_thresholds=X[:900][y[:900] == 0])
    base = EmbedHead(spec, lambda *a: None)
    Xr, yr = _world(1, 3000)                                            # today's landscape, never trained on
    ref = {"X_ref": Xr, "y_ref": yr, "X_replay": X[:400], "y_replay": y[:400]}
    monkeypatch.setattr(er, "load_reference", lambda kind: ref)
    store = {}
    monkeypatch.setattr(er, "design", lambda head, kind, msgs: np.stack([store[m[2]] for m in msgs]))
    return base, store


def _cands(store, X, y, prefix):
    out = []
    for i, (x, lab) in enumerate(zip(X, y)):
        body = f"{prefix} message number {i} with enough text"
        store[body] = x
        out.append(SimpleNamespace(label="phishing" if lab else "benign", sample_data={"message": {"sender": "", "subject": "", "body": body}}))
    return out


def test_too_few_examples_is_refused(setup):
    base, store = setup
    X, y = _world(2, 10)
    rep = er.train_org_head("text", _cands(store, X, y, "few"), current=base)
    assert not rep["accepted"] and "at least" in rep["reason"]


def test_reports_from_the_old_landscape_bring_no_gain_and_are_refused(setup):
    base, store = setup
    X, y = _world(3, 80, new_landscape=False)
    rep = er.train_org_head("text", _cands(store, X, y, "old"), current=base)
    assert not rep["accepted"] and rep["reason"]


def test_reports_from_todays_landscape_are_learned(setup):
    base, store = setup
    X, y = _world(4, 160)
    rep = er.train_org_head("text", _cands(store, X, y, "today"), current=base)
    assert rep["accepted"], rep["reason"]
    assert rep["reference_candidate"]["auc"] > rep["reference_base"]["auc"]          # better on today's threats too
    assert rep["reference_candidate"]["fpr"] <= rep["reference_base"]["fpr"] + 0.005  # within the false-alarm budget
    assert rep["spec"]["thresholds"].get("rematched_on")                              # thresholds re-derived, budget kept


def test_poisoned_labels_are_refused(setup):
    base, store = setup
    X, y = _world(5, 160)
    rep = er.train_org_head("text", _cands(store, X, 1 - y, "poison"), current=base)   # every label flipped
    assert not rep["accepted"]
