"""Shared URL model checkpoint path helpers."""

from __future__ import annotations

import os
from pathlib import Path


PROJECT_ROOT = Path(__file__).resolve().parents[2]
URL_DIR = PROJECT_ROOT / "AIML" / "url"
V7_URL_MODEL = URL_DIR / "best_v7.pt"
DEFAULT_URL_MODEL = URL_DIR / "best_v7.pt"
LEGACY_MODEL = URL_DIR / "best.pt"


def get_url_model_path() -> Path:
    """Return the primary URL model checkpoint path.

    Order of preference:
    1. `AEGIS_URL_MODEL_CHECKPOINT` env var
    2. `best_v7.pt` (Verified 3-Class V7 model)
    3. `best.pt`
    """
    override = os.environ.get("AEGIS_URL_MODEL_CHECKPOINT")
    if override:
        return Path(override)
    if V7_URL_MODEL.exists():
        return V7_URL_MODEL
    if LEGACY_MODEL.exists():
        return LEGACY_MODEL
    return DEFAULT_URL_MODEL


def get_url_model_candidates() -> list[Path]:
    """Return checkpoints to compare."""
    candidates = [DEFAULT_URL_MODEL]
    if LEGACY_MODEL.exists() and LEGACY_MODEL != DEFAULT_URL_MODEL:
        candidates.append(LEGACY_MODEL)
    return candidates
