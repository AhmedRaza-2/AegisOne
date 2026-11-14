"""
AegisOne — URL "second opinion": an open-source model run next to AegisOne's own URL model.

Which model and why: AIML/eval/open_baselines.py scored three open-source URL models on exactly the same genuine and
fresh-phishing URLs as AegisOne. kmack/malicious-url-detection (DistilBERT, Apache-2.0) was the strongest on its own
and the only one whose combination with AegisOne helped (AP at a 1% phishing base rate 0.598 -> 0.805; a temporal
check fitted on the 1 Nov feed and tested on the 14 Nov feed blocked 90.3% -> 91.0% of phishing with false blocks
0.84% -> 0.88%). AIML/eval/fit_second_opinion.py writes the stacker and threshold to AIML/url/second_opinion/config.json.

Modes (admin-selectable, kept in app_secrets so a restart keeps the choice):
  off      the model is not run
  shadow   it runs; its score and whether it agrees are attached to the result and counted for the admin panel, but
           the verdict is AegisOne's alone
  upgrade  as shadow, and a URL AegisOne already WARNs about (0.35 <= risk < 0.60) is raised to BLOCK when the stacked
           score of both models passes the fitted threshold. It never lowers a verdict, never changes a SAFE verdict
           and never runs on rule overrides (those return before the model path).

Safety: the model loads from the local Hugging Face cache only (baked into the Docker image at a pinned revision), so
an air-gapped server never reaches the internet; when it is missing the second opinion reports "unavailable" and
AegisOne behaves exactly as before.
"""
import json
import logging
import math
import os
import threading
import time
from pathlib import Path
from typing import Any, Dict, Optional

logger = logging.getLogger(__name__)

CONFIG_PATH = Path(__file__).resolve().parents[2] / "AIML" / "url" / "second_opinion" / "config.json"
MODES = ("off", "shadow", "upgrade")
STATE_KEY = "second_opinion_url_mode"

_lock = threading.Lock()
_state: Dict[str, Any] = {"mode": None, "model": None, "tokenizer": None, "error": None, "loaded_at": None}
_stats = {"scored": 0, "agree": 0, "disagree_open_higher": 0, "disagree_aegis_higher": 0, "upgraded": 0, "ms_total": 0.0,
          "since": time.strftime("%Y-%m-%dT%H:%M:%SZ", time.gmtime())}


def config() -> Dict[str, Any]:
    try:
        return json.loads(CONFIG_PATH.read_text())
    except Exception:
        return {}


def _model_cfg() -> Optional[Dict[str, Any]]:
    models = config().get("models") or []
    return models[0] if models else None


def get_mode() -> str:
    if _state["mode"] in MODES:
        return _state["mode"]
    env = os.environ.get("AEGIS_SECOND_OPINION", "").lower()
    return env if env in MODES else (config().get("default_mode") or "shadow")


def set_mode(mode: str) -> str:
    if mode not in MODES:
        raise ValueError(f"mode must be one of {MODES}")
    _state["mode"] = mode
    return mode


def _load() -> bool:
    """Load the open model once, from the local cache only. Returns False (and remembers why) when unavailable."""
    if _state["model"] is not None:
        return True
    if _state["error"]:
        return False
    cfg = _model_cfg()
    if not cfg:
        _state["error"] = "no second-opinion config"
        return False
    with _lock:
        if _state["model"] is not None:
            return True
        try:
            import torch
            from transformers import AutoModelForSequenceClassification, AutoTokenizer
            kw = {"revision": cfg.get("revision"), "local_files_only": True, "token": False}
            _state["tokenizer"] = AutoTokenizer.from_pretrained(cfg["repo"], **kw)
            m = AutoModelForSequenceClassification.from_pretrained(cfg["repo"], **kw).eval()
            torch.set_grad_enabled(False)
            _state["model"] = m
            _state["loaded_at"] = time.strftime("%Y-%m-%dT%H:%M:%SZ", time.gmtime())
            logger.info("Second-opinion URL model loaded: %s@%s", cfg["repo"], (cfg.get("revision") or "")[:8])
            return True
        except Exception as e:                       # missing weights, offline without cache, ...
            _state["error"] = f"{type(e).__name__}: {e}"[:300]
            logger.warning("Second-opinion URL model unavailable: %s", _state["error"])
            return False


def warm() -> None:
    if get_mode() != "off":
        _load()


def score(url: str) -> Optional[float]:
    """Open model's probability that the URL is malicious, or None when unavailable."""
    if not _load():
        return None
    import torch
    cfg = _model_cfg()
    enc = _state["tokenizer"]([url], truncation=True, max_length=int(cfg.get("max_length", 128)), return_tensors="pt")
    with torch.inference_mode():
        p = torch.softmax(_state["model"](**enc).logits.float(), dim=-1)[0, int(cfg.get("bad_label_index", 1))]
    return float(p)


def _logit(p: float) -> float:
    p = min(max(p, 1e-4), 1 - 1e-4)
    return math.log(p / (1 - p))


def stacked(aegis_p: float, open_p: float, cfg: Dict[str, Any]) -> float:
    s = cfg["stacker"]
    z = s["coef_aegisone"] * _logit(aegis_p) + s["coef_open"] * _logit(open_p) + s["intercept"]
    return 1.0 / (1.0 + math.exp(-z))


def decide(aegis_p: float, open_p: float, cfg: Dict[str, Any], mode: str) -> Dict[str, Any]:
    """Pure decision (unit-tested): what the second opinion says and whether it raises the verdict."""
    warn, block = float(cfg.get("warn", 0.35)), float(cfg.get("block", 0.60))
    fused = stacked(aegis_p, open_p, cfg)
    aegis_flag, open_flag = aegis_p >= warn, open_p >= 0.5
    upgrade = mode == "upgrade" and warn <= aegis_p < block and fused >= float(cfg["upgrade_threshold"])
    return {"aegis_flag": aegis_flag, "open_flag": open_flag, "agrees": aegis_flag == open_flag,
            "fused": round(fused, 4), "upgrade": upgrade, "new_probability": max(aegis_p, 0.61) if upgrade else aegis_p}


def apply(result: Dict[str, Any], url: str) -> Dict[str, Any]:
    """Attach the second opinion to a URL result (model path only) and, in upgrade mode, raise WARN to BLOCK."""
    mode = get_mode()
    if mode == "off" or not isinstance(result, dict) or "error" in result:
        return result
    cfg = _model_cfg()
    if not cfg:
        return result
    t0 = time.perf_counter()
    try:
        p_open = score(url)
    except Exception as e:
        logger.warning("Second-opinion scoring failed: %s", e)
        p_open = None
    if p_open is None:
        result.setdefault("evidence", {})["second_opinion"] = {"model": cfg["repo"], "status": "unavailable"}
        return result
    ms = (time.perf_counter() - t0) * 1000
    p = float(result.get("phishing_probability") or 0.0)
    d = decide(p, p_open, cfg, mode)

    _stats["scored"] += 1
    _stats["ms_total"] += ms
    if d["agrees"]:
        _stats["agree"] += 1
    elif d["open_flag"]:
        _stats["disagree_open_higher"] += 1
    else:
        _stats["disagree_aegis_higher"] += 1

    result.setdefault("evidence", {})["second_opinion"] = {
        "model": cfg["repo"], "licence": cfg.get("licence"), "mode": mode, "score": round(p_open, 4),
        "aegisone_score": round(p, 4), "combined": d["fused"], "agrees": d["agrees"], "raised_to_block": d["upgrade"],
        "ms": round(ms, 1),
    }
    if d["upgrade"]:
        _stats["upgraded"] += 1
        from AIML.url.calibration import calibrate_probability
        cal = calibrate_probability(d["new_probability"])
        result["phishing_probability"] = round(d["new_probability"], 4)
        result["prediction"] = "malicious"
        result["category"] = cal["category"]
        result["confidence"] = cal["confidence"]
        result["explanation"] = (result.get("explanation") or "") + \
            " | Second opinion (open-source model) agrees: raised from warning to block."
    return result


def status() -> Dict[str, Any]:
    cfg = config()
    m = _model_cfg() or {}
    n = _stats["scored"]
    return {
        "mode": get_mode(), "modes": cfg.get("modes", {}),
        "model": {k: m.get(k) for k in ("id", "repo", "revision", "licence", "description", "upgrade_threshold")},
        "available": _state["model"] is not None, "error": _state["error"], "loaded_at": _state["loaded_at"],
        "live": {**{k: v for k, v in _stats.items() if k != "ms_total"},
                 "agreement_rate": round(_stats["agree"] / n, 4) if n else None,
                 "avg_ms": round(_stats["ms_total"] / n, 1) if n else None},
        "evaluation": cfg.get("evaluation", {}),
        "config_version": cfg.get("version"),
    }
