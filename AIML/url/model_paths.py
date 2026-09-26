"""Shared URL model checkpoint path helpers.

Production checkpoint: best_v7.pt (FROZEN — do not substitute best.pt).
"""

from __future__ import annotations

import os
from pathlib import Path


PROJECT_ROOT = Path(__file__).resolve().parents[2]
URL_DIR = PROJECT_ROOT / "AIML" / "url"

# V7 is the frozen production model. best.pt is an older checkpoint kept for
# reference only — it must never silently replace best_v7.pt.
V7_URL_MODEL = URL_DIR / "best_v7.pt"
DEFAULT_URL_MODEL = URL_DIR / "best_v7.pt"
LEGACY_MODEL = URL_DIR / "best.pt"          # kept for audit trail, not used in inference


def get_url_model_path() -> Path:
    """Return the primary URL model checkpoint path.

    Resolution order:
    1. ``AEGIS_URL_MODEL_CHECKPOINT`` environment variable (explicit override)
    2. ``best_v7.pt`` — the frozen V7 production checkpoint
    3. Raises FileNotFoundError (never silently falls back to best.pt)
    """
    override = os.environ.get("AEGIS_URL_MODEL_CHECKPOINT")
    if override:
        p = Path(override)
        if not p.exists():
            raise FileNotFoundError(
                f"AEGIS_URL_MODEL_CHECKPOINT points to missing file: {p}"
            )
        return p

    if V7_URL_MODEL.exists():
        return V7_URL_MODEL

    raise FileNotFoundError(
        f"URL model not found at expected path: {V7_URL_MODEL}\n"
        "Ensure best_v7.pt is present (check Git LFS pull)."
    )


def get_url_model_candidates() -> list[Path]:
    """Return checkpoints available for comparison / benchmarking."""
    candidates = [DEFAULT_URL_MODEL]
    if LEGACY_MODEL.exists():
        candidates.append(LEGACY_MODEL)
    return candidates

