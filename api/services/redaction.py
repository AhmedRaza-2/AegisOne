"""
AegisOne API — PII / Secret Redaction
=======================================
Strips personally-identifying and secret-like substrings from incident evidence
(URLs, notes) before it's shown to a manager or admin reviewing someone else's
report. This is display-time redaction only — the underlying scan/event records
keep the raw data for the reporting employee's own view and for the detection
pipeline; only the shared incident-review surface is redacted.
"""
import re

_EMAIL_RE = re.compile(r"[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}")
_JWT_RE = re.compile(r"\beyJ[a-zA-Z0-9_-]{10,}\.[a-zA-Z0-9_-]{10,}\.[a-zA-Z0-9_-]{10,}\b")
_HEX_TOKEN_RE = re.compile(r"\b[a-fA-F0-9]{32,}\b")
_SENSITIVE_QUERY_RE = re.compile(
    r"(?i)\b(email|token|session|password|pwd|auth|secret|api_key|apikey|access_token|refresh_token)=([^&\s]+)"
)
_LONG_DIGITS_RE = re.compile(r"\b\d{9,}\b")


def redact_text(value: str | None) -> str | None:
    """Redact emails, bearer/JWT-like tokens, sensitive query params, and long digit
    runs (card/account-like numbers) from a string. None/empty pass through unchanged."""
    if not value:
        return value

    redacted = _SENSITIVE_QUERY_RE.sub(lambda m: f"{m.group(1)}=[REDACTED]", value)
    redacted = _JWT_RE.sub("[TOKEN REDACTED]", redacted)
    redacted = _EMAIL_RE.sub("[EMAIL REDACTED]", redacted)
    redacted = _HEX_TOKEN_RE.sub("[TOKEN REDACTED]", redacted)
    redacted = _LONG_DIGITS_RE.sub("[REDACTED]", redacted)
    return redacted


def redact_obj(value, _depth: int = 0):
    """Recursively redact every string inside a JSON-like structure (evidence snapshots)."""
    if _depth > 6:
        return value
    if isinstance(value, str):
        return redact_text(value)
    if isinstance(value, list):
        return [redact_obj(v, _depth + 1) for v in value]
    if isinstance(value, dict):
        return {k: redact_obj(v, _depth + 1) for k, v in value.items()}
    return value
