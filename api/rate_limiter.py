"""
AegisOne API — Shared Rate Limiter
====================================
The Limiter instance lives here, separate from api/main.py, so individual routers
can import it and apply per-route limits (e.g. @limiter.limit("5/minute")) without
a circular import — api/main.py imports the routers before it would otherwise
define this instance itself.
"""
from slowapi import Limiter
from slowapi.util import get_remote_address
from api.config import RATE_LIMIT

limiter = Limiter(key_func=get_remote_address, default_limits=[RATE_LIMIT])
