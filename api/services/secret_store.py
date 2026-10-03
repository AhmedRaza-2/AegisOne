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
