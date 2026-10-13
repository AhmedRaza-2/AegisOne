"""
AegisOne API — Persistent server secrets
=========================================
The token-signing key lives in the database when it is not supplied through AEGIS_JWT_SECRET.
Generated once, reused on every start, so users stay signed in across restarts and re-deployments
of the containers. Deleting the database volume (docker compose down -v) naturally starts afresh.
"""
import secrets
import logging

from sqlalchemy.future import select

from api import config
from api.database.db import get_background_db
from api.database.models import AppSecret

logger = logging.getLogger("aegisone.secrets")

JWT_KEY_NAME = "jwt_signing_key"
SETUP_KEY_NAME = "setup_wizard_key"


async def ensure_jwt_secret() -> None:
    if config.JWT_SECRET_FROM_ENV:
        logger.info("Token signing key: from AEGIS_JWT_SECRET")
        return
    db = await get_background_db()
    try:
        row = (await db.execute(select(AppSecret).where(AppSecret.key == JWT_KEY_NAME))).scalar_one_or_none()
        if row is None:
            row = AppSecret(key=JWT_KEY_NAME, value=secrets.token_urlsafe(48))
            db.add(row)
            await db.commit()
            logger.info("Token signing key: generated and stored in the database (first start)")
        else:
            logger.info("Token signing key: loaded from the database")
        config.JWT_SECRET_KEY = row.value
    finally:
        await db.close()


async def ensure_setup_key() -> None:
    """Same pattern as the JWT secret, for the one-time setup wizard's bootstrap key."""
    if config.SETUP_KEY_FROM_ENV:
        logger.info("Setup wizard key: from VITE_SETUP_KEY/SETUP_KEY")
        return
    db = await get_background_db()
    try:
        row = (await db.execute(select(AppSecret).where(AppSecret.key == SETUP_KEY_NAME))).scalar_one_or_none()
        if row is None:
            row = AppSecret(key=SETUP_KEY_NAME, value=secrets.token_urlsafe(24))
            db.add(row)
            await db.commit()
            # Printed loudly and once: this is the only way the person doing the on-prem
            # install can learn it (they have shell/log access to their own server; nobody
            # else does). Mirrors how tools like Jenkins hand over a first-run admin secret.
            logger.warning("=" * 60)
            logger.warning("SETUP WIZARD KEY (first start - save this, it will not be shown again):")
            logger.warning(f"  {row.value}")
            logger.warning("Or set VITE_SETUP_KEY / SETUP_KEY yourself to pick yours.")
            logger.warning("=" * 60)
        else:
            logger.info("Setup wizard key: loaded from the database")
        config.SETUP_KEY = row.value
    finally:
        await db.close()
