"""
AegisOne — license & organization binding
==========================================
The vendor portal issues every customer an ORG_ID, LICENSE_KEY and DEPLOYMENT_TOKEN (and a seat
limit, `allowed_users`). The on-prem core is started with them (docker-compose env) and this module
makes them matter on EVERY request, not only during setup:

  * Verified against the vendor registry (a Supabase RPC, `verify_license`) at start-up and every
    few hours. If the registry is unreachable the last good answer is trusted for a grace period.
  * The deployment is bound to ONE organization: accounts of any other organization are refused
    (global_admin excepted), so a database restored or copied into another tenant cannot be used.
  * Seat limit: no new account can be activated beyond `allowed_users`.
  * Expired / revoked / suspended licenses put the deployment in read-only "license blocked" mode
    (strict) or show a warning banner (warn).

AEGIS_LICENSE_ENFORCE:  off | warn (default) | strict
AEGIS_REGISTRY_URL / AEGIS_REGISTRY_KEY: the vendor registry endpoint and its public (anon) key.
Without a registry the key can only be format-checked, which is reported honestly as "unverified".
"""
import os
import asyncio
import logging
from datetime import datetime, timedelta
from typing import Any, Dict, Optional, Tuple

logger = logging.getLogger("aegisone.license")

ORG_ID = os.environ.get("ORG_ID", "").strip()
LICENSE_KEY = os.environ.get("LICENSE_KEY", "").strip()
DEPLOYMENT_TOKEN = os.environ.get("DEPLOYMENT_TOKEN", "").strip()
REGISTRY_URL = os.environ.get("AEGIS_REGISTRY_URL", "").strip().rstrip("/")
REGISTRY_KEY = os.environ.get("AEGIS_REGISTRY_KEY", "").strip()
ENFORCE = os.environ.get("AEGIS_LICENSE_ENFORCE", "warn").strip().lower()
GRACE = timedelta(days=int(os.environ.get("AEGIS_LICENSE_GRACE_DAYS", "7")))
RECHECK_SECONDS = int(os.environ.get("AEGIS_LICENSE_RECHECK_HOURS", "6")) * 3600

# What a request path needs even when the license is blocked (so the owner can still sign in and fix it)
_ALWAYS_ALLOWED = ("/health", "/ready", "/license", "/auth", "/docs", "/openapi.json", "/setup")

_state: Dict[str, Any] = {
    "configured": bool(ORG_ID and LICENSE_KEY),
    "status": "unchecked",       # unchecked | active | expired | revoked | suspended | invalid | unverified | unreachable
    "valid": True,
    "org_id": ORG_ID or None,
    "org_name": None,
    "plan": None,
    "allowed_users": None,
    "expires_at": None,
    "checked_at": None,
    "last_ok_at": None,
    "reason": None,
}


def current() -> Dict[str, Any]:
    """Safe-to-expose snapshot (never contains the key or token)."""
    s = dict(_state)
    s["enforce"] = ENFORCE
    s["registry_configured"] = bool(REGISTRY_URL)
    return s


def licensed_org() -> Optional[str]:
    return ORG_ID or None


async def verify_online() -> Dict[str, Any]:
    """Ask the vendor registry about this deployment and update the cached state."""
    now = datetime.utcnow()
    _state["checked_at"] = now.isoformat()
    if not (ORG_ID and LICENSE_KEY):
        _state.update(status="unverified", valid=ENFORCE != "strict",
                      reason="ORG_ID / LICENSE_KEY are not set for this deployment.")
        return current()
    if not REGISTRY_URL:
        _state.update(status="unverified", valid=True,
                      reason="No vendor registry configured (AEGIS_REGISTRY_URL): key format only, not verified.")
        return current()
    try:
        import httpx
        async with httpx.AsyncClient(timeout=10) as client:
            r = await client.post(
                f"{REGISTRY_URL}/rest/v1/rpc/verify_license",
                headers={"apikey": REGISTRY_KEY, "Authorization": f"Bearer {REGISTRY_KEY}", "Content-Type": "application/json"},
                json={"p_org_id": ORG_ID, "p_license_key": LICENSE_KEY, "p_deployment_token": DEPLOYMENT_TOKEN},
            )
        r.raise_for_status()
        data = r.json()
        if isinstance(data, list):
            data = data[0] if data else {}
        status = str(data.get("status") or ("active" if data.get("valid") else "invalid")).lower()
        valid = bool(data.get("valid")) and status in ("active", "approved")
        _state.update(
            status="active" if valid else status, valid=valid, org_name=data.get("org_name"),
            plan=data.get("plan"), allowed_users=data.get("allowed_users"),
            expires_at=data.get("expires_at"), reason=None if valid else (data.get("reason") or f"License is {status}."),
        )
        if valid:
            _state["last_ok_at"] = now.isoformat()
    except Exception as e:
        # Registry down: keep trusting the last good answer for the grace period.
        last_ok = _state.get("last_ok_at")
        within_grace = bool(last_ok) and (now - datetime.fromisoformat(last_ok)) < GRACE
        _state.update(status="unreachable", valid=within_grace or _state.get("status") in ("unchecked", "unverified"),
                      reason=f"Vendor registry unreachable ({type(e).__name__}); using last verified state.")
        logger.warning("License registry unreachable: %s", e)
    return current()


async def refresh_loop():
    """Background re-check; started from the app lifespan."""
    while True:
        try:
            await verify_online()
            if not _state["valid"]:
                logger.error("LICENSE PROBLEM: %s (%s)", _state["status"], _state["reason"])
        except Exception:
            logger.exception("license refresh failed")
        await asyncio.sleep(RECHECK_SECONDS)


def is_blocked(path: str = "") -> Tuple[bool, Optional[str]]:
    """True when strict enforcement refuses ordinary API use."""
    if ENFORCE != "strict" or _state["valid"]:
        return False, None
    if any(path.startswith(p) for p in _ALWAYS_ALLOWED):
        return False, None
    return True, _state.get("reason") or "License is not valid."


def user_allowed(user_org: Optional[str], role: Optional[str]) -> bool:
    """A deployment is bound to the organization it was licensed for."""
    if ENFORCE == "off" or not ORG_ID or role == "global_admin":
        return True
    return (user_org or "org_default") in (ORG_ID, "org_default")


async def seat_status(db, org_id: Optional[str] = None) -> Dict[str, Any]:
    """Active accounts vs the licensed seat limit."""
    from sqlalchemy import select, func
    from api.database.models import User
    q = select(func.count(User.id)).where(User.is_active == True, User.account_status.in_(("approved", "active")))  # noqa: E712
    if org_id:
        q = q.where(User.organization_id == org_id)
    used = (await db.execute(q)).scalar() or 0
    allowed = _state.get("allowed_users")
    try:
        allowed = int(allowed) if allowed not in (None, "") else None
    except (TypeError, ValueError):
        allowed = None
    return {"used": int(used), "allowed": allowed, "available": None if allowed is None else max(0, allowed - int(used))}


async def can_add_users(db, org_id: Optional[str], adding: int = 1) -> Tuple[bool, str]:
    if ENFORCE == "off":
        return True, ""
    s = await seat_status(db, org_id)
    if s["allowed"] is not None and s["used"] + adding > s["allowed"]:
        msg = f"License seat limit reached ({s['used']} of {s['allowed']} accounts in use). Contact the vendor to add seats."
        return (ENFORCE != "strict"), msg
    return True, ""


async def verify_credentials(org_id: str, license_key: str, deployment_token: str = "") -> Dict[str, Any]:
    """Vendor-side: check an organisation's credentials against the registry (used by the Model Hub).
    Returns {"valid": bool, "reason": str|None, "org_name": str|None, ...}."""
    if not (org_id and license_key):
        return {"valid": False, "reason": "Missing organization credentials."}
    if not REGISTRY_URL:
        if os.environ.get("AEGIS_VENDOR_DEV_ALLOW", "0") == "1":
            return {"valid": True, "org_name": org_id, "reason": None, "dev": True}
        return {"valid": False, "reason": "Vendor registry is not configured on this hub."}
    try:
        import httpx
        async with httpx.AsyncClient(timeout=10) as client:
            r = await client.post(
                f"{REGISTRY_URL}/rest/v1/rpc/verify_license",
                headers={"apikey": REGISTRY_KEY, "Authorization": f"Bearer {REGISTRY_KEY}", "Content-Type": "application/json"},
                json={"p_org_id": org_id, "p_license_key": license_key, "p_deployment_token": deployment_token or ""})
        r.raise_for_status()
        data = r.json()
        if isinstance(data, list):
            data = data[0] if data else {}
        return {"valid": bool(data.get("valid")), "reason": data.get("reason"), "org_name": data.get("org_name"), "plan": data.get("plan")}
    except Exception as e:
        return {"valid": False, "reason": f"Registry unreachable ({type(e).__name__})."}
