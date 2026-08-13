"""Shared URL model checkpoint path helpers."""

from __future__ import annotations

import os
from pathlib import Path


PROJECT_ROOT = Path(__file__).resolve().parents[2]
URL_DIR = PROJECT_ROOT / "AIML" / "url"
DEFAULT_URL_MODEL = URL_DIR / "best.pt"
# Renamed from "best (3).pt" — spaces in filenames break Linux Docker paths
ALT_URL_MODEL = URL_DIR / "best_v3.pt"
# Legacy path (kept for backward compatibility if someone still has the old file)
LEGACY_ALT_URL_MODEL = URL_DIR / "best (3).pt"


def get_url_model_path() -> Path:
    """Return the primary URL model checkpoint path.

    Order of preference:
    1. `AEGIS_URL_MODEL_CHECKPOINT` env var
    2. `best_v3.pt` if it exists  (compact checkpoint, matches classifier architecture)
    3. `best (3).pt` legacy name  (fallback for local dev)
    4. `best.pt`
    """
    override = os.environ.get("AEGIS_URL_MODEL_CHECKPOINT")
    if override:
        return Path(override)
    if ALT_URL_MODEL.exists():
        return ALT_URL_MODEL
    if LEGACY_ALT_URL_MODEL.exists():
        return LEGACY_ALT_URL_MODEL
    return DEFAULT_URL_MODEL


def get_url_model_candidates() -> list[Path]:
    """Return checkpoints to compare, ordered from older to newer."""
    candidates = [DEFAULT_URL_MODEL]
    if ALT_URL_MODEL.exists():
        candidates.append(ALT_URL_MODEL)
    elif LEGACY_ALT_URL_MODEL.exists():
        candidates.append(LEGACY_ALT_URL_MODEL)
    return candidates
