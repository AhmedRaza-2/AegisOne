"""Unit tests for guided incident recovery (module 8.15): playbook progress, response tracking, SLA and timings.
Pure logic - no database or models needed."""
from datetime import datetime, timedelta
from types import SimpleNamespace

from api.services import incident_ops as ops
from api.services import playbooks as pb


def inc(severity="high", status="open", created_min_ago=120, evidence=None, **kw):
    base = dict(severity=severity, status=status, created_at=datetime.utcnow() - timedelta(minutes=created_min_ago),
                evidence=evidence or {}, escalated_at=None, verified_at=None, resolved_at=None)
    base.update(kw)
    return SimpleNamespace(**base)


def test_every_step_has_a_stable_unique_id_and_known_action():
    for t in (pb.CREDENTIAL, pb.MALWARE, pb.EMAIL, pb.BEC, pb.QR, pb.MESSAGING, pb.FALSE_POSITIVE, pb.GENERIC):
        p = pb.get_playbook(t)
        ids = [s["id"] for ph in p["phases"] for s in ph["steps"]]
        assert len(ids) == len(set(ids)) == p["steps_total"] and p["steps_done"] == 0
        assert ids == [s["id"] for ph in pb.get_playbook(t)["phases"] for s in ph["steps"]]   # stable between calls
        for ph in p["phases"]:
            for s in ph["steps"]:
                assert s.get("action") in (None, *pb.ACTIONS)


def test_marking_a_containment_step_stamps_contained_at_once():
    r = pb.mark_step({}, pb.CREDENTIAL, "1.1", done=True, by="admin@x.pk")
    first = r["contained_at"]
    assert r["steps"]["1.1"]["done"] and r["steps"]["1.1"]["by"] == "admin@x.pk"
    r = pb.mark_step(r, pb.CREDENTIAL, "1.2", done=True, by="admin@x.pk")
    assert r["contained_at"] == first                          # first containment time is kept
    r2 = pb.mark_step({}, pb.CREDENTIAL, "2.1", done=True, by="a")   # an Assess step is not containment
    assert "contained_at" not in r2


def test_progress_is_reported_back_on_the_playbook():
    r = pb.mark_step({}, pb.EMAIL, "1.1", done=True, by="a")
    r = pb.mark_step(r, pb.EMAIL, "1.2", done=True, by="a", note="deleted from 14 mailboxes")
    p = pb.get_playbook(pb.EMAIL, r["steps"])
    assert p["steps_done"] == 2 and p["phases"][0]["steps"][1]["note"] == "deleted from 14 mailboxes"
    r = pb.mark_step(r, pb.EMAIL, "1.2", done=False, by="a")
    assert pb.get_playbook(pb.EMAIL, r["steps"])["steps_done"] == 1


def test_unknown_step_is_rejected():
    try:
        pb.mark_step({}, pb.EMAIL, "9.9", done=True, by="a")
        assert False, "expected KeyError"
    except KeyError:
        pass


def test_actions_map_to_their_playbook_step():
    assert pb.step_for_action(pb.CREDENTIAL, "block_domain") == "1.1"
    assert pb.step_for_action(pb.CREDENTIAL, "reset_credentials") is not None
    assert pb.step_for_action(pb.FALSE_POSITIVE, "block_domain") is None


def test_sla_breached_when_nobody_responded_in_time():
    s = ops.sla_status(inc("high", created_min_ago=120))
    assert s["target_minutes"] == ops.SLA_MINUTES["high"] and s["breached"] and s["met"] is None


def test_sla_not_breached_before_the_deadline():
    s = ops.sla_status(inc("low", created_min_ago=30))
    assert not s["breached"] and s["acknowledged_at"] is None


def test_sla_met_when_acknowledged_in_time():
    created = datetime.utcnow() - timedelta(minutes=300)
    ack = (created + timedelta(minutes=20)).isoformat() + "Z"
    i = inc("high", created_at=created, evidence={"response": {"acknowledged_at": ack}})
    s = ops.sla_status(i)
    assert s["met"] and not s["breached"]
    t = ops.timings(i)
    assert abs(t["time_to_acknowledge_min"] - 20) < 0.2 and t["time_to_contain_min"] is None


def test_closed_incident_never_counts_as_breaching_now():
    s = ops.sla_status(inc("critical", status="resolved", created_min_ago=600, resolved_at=datetime.utcnow()))
    assert s["acknowledged_at"] is not None   # resolving is a response


def test_record_action_ticks_the_step_and_logs_it():
    i = inc("high", evidence={"findings": ["x"]})
    i.__dict__["_sa_instance_state"] = None   # flag_modified needs an ORM object; patched below
    calls = {}
    orig = ops.flag_modified
    ops.flag_modified = lambda obj, key: calls.setdefault("flag", key)
    try:
        r = ops.record_action(i, "block_domain", "admin@x.pk", 1, "evil.top", "1.1", pb.CREDENTIAL, contain=True)
    finally:
        ops.flag_modified = orig
    assert calls["flag"] == "evidence"
    assert i.evidence["findings"] == ["x"]                      # other evidence untouched
    assert r["steps"]["1.1"]["done"] and r["actions"][0]["action"] == "block_domain" and r["contained_at"] and r["acknowledged_at"]
