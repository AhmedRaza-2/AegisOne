"""
AegisOne API — Logging
======================
One short, readable line per event instead of multi-line banners, with chatty libraries
and health-check polling kept out of the way:

    14:02:11 INFO  SCAN  url    SAFE     8%   14ms  pakistaniahmed627@gmail.com  myaccount.google.com/people-and-sharing
    14:02:19 INFO  SCAN  image  BLOCK   94%  412ms  nfatima2433006@gmail.com     framerusercontent.com/images/DuQINISC...
    14:02:20 INFO  XAI   page   grounded   16ms  myaccount.google.com
    14:02:31 WARN  HTTP   404 POST /reports/xyz

Query strings are dropped from logged URLs because they often carry tokens or personal data.
"""
import logging
import os
from urllib.parse import urlparse

_NOISY_LOGGERS = (
    "httpx", "httpcore", "urllib3", "huggingface_hub", "filelock", "sentence_transformers",
    "transformers", "PIL", "matplotlib", "asyncio", "multipart", "passlib",
)


class _AccessFilter(logging.Filter):
    """uvicorn access log: show failures and meaningful requests, hide routine polling."""

    def filter(self, record: logging.LogRecord) -> bool:
        try:
            _client, method, path, _ver, status = record.args  # type: ignore[misc]
        except Exception:
            return True
        status = int(status)
        if status >= 400:
            record.msg = "HTTP  %s %s %s"
            record.args = (status, method, str(path).split("?")[0])
            record.levelno = logging.WARNING if status < 500 else logging.ERROR
            record.levelname = "WARN" if status < 500 else "ERROR"
            return True
        return False   # successful requests are summarised by the SCAN / XAI / REPORT lines


class _Formatter(logging.Formatter):
    def format(self, record: logging.LogRecord) -> str:
        record.levelname = {"WARNING": "WARN", "CRITICAL": "CRIT"}.get(record.levelname, record.levelname)
        return super().format(record)


def setup_logging(level: str = "INFO") -> None:
    root = logging.getLogger()
    for h in list(root.handlers):
        root.removeHandler(h)
    handler = logging.StreamHandler()
    handler.setFormatter(_Formatter("%(asctime)s %(levelname)-5s %(message)s", datefmt="%H:%M:%S"))
    root.addHandler(handler)
    root.setLevel(getattr(logging, level.upper(), logging.INFO))

    for name in _NOISY_LOGGERS:
        logging.getLogger(name).setLevel(logging.WARNING)
    logging.getLogger("sqlalchemy.engine").setLevel(logging.WARNING)

    # Model libraries print large "LOAD REPORT" tables and progress bars on every start.
    os.environ.setdefault("HF_HUB_DISABLE_PROGRESS_BARS", "1")
    os.environ.setdefault("TRANSFORMERS_VERBOSITY", "error")
    try:
        import transformers
        transformers.logging.set_verbosity_error()
    except Exception:
        pass

    access = logging.getLogger("uvicorn.access")
    access.addFilter(_AccessFilter())
    # Route uvicorn's own loggers through our single handler/format.
    for name in ("uvicorn", "uvicorn.error", "uvicorn.access"):
        lg = logging.getLogger(name)
        lg.handlers = []
        lg.propagate = True


def short_target(target: str, width: int = 70) -> str:
    """host + path of a URL without scheme or query string; other text is just trimmed."""
    t = (target or "").strip()
    if t.lower().startswith(("http://", "https://")):
        u = urlparse(t)
        t = f"{u.netloc}{u.path}".rstrip("/")
    t = " ".join(t.split())
    return t if len(t) <= width else t[: width - 1] + "…"


_log = logging.getLogger("aegisone.events")


def scan_log(kind: str, user: str, target: str, risk: float, decision: str, ms: float, note: str = "") -> None:
    """One line per completed scan."""
    d = (decision or "").upper()
    verdict = {"ALLOW": "SAFE", "SAFE": "SAFE", "WARN": "WARN", "SUSPICIOUS": "WARN", "BLOCK": "BLOCK"}.get(d, d or "-")
    who = (user or "anonymous").replace("anonymous@aegisone.local", "anonymous")
    extra = f"  [{note}]" if note else ""
    _log.info("SCAN  %-6s %-5s %3.0f%% %5.0fms  %-26s %s%s", kind, verdict, risk, ms or 0, who, short_target(target), extra)


def event_log(tag: str, message: str) -> None:
    """Single-line operational event (XAI, REPORT, INGEST ...)."""
    _log.info("%-5s %s", tag, message)
