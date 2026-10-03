"""
AegisOne API — Additive Schema Migrations
==========================================
`Base.metadata.create_all` (see db.py) only creates tables that don't exist yet —
it never alters an existing table. Since AegisOne ships as a Docker image deployed
onto each customer's own on-prem Postgres, any new column added to an existing model
needs an explicit, idempotent ALTER here so already-running deployments pick it up
on their next container restart without losing data.

Each entry runs `ADD COLUMN IF NOT EXISTS`, so this is safe to run on every startup.
"""
import logging
from sqlalchemy import text
from sqlalchemy.ext.asyncio import AsyncConnection

logger = logging.getLogger("aegisone.migrations")

_ADDITIVE_COLUMNS = [
    # (table, column, postgres column definition)
    ("incidents", "escalated_by_id", "INTEGER REFERENCES users(id) ON DELETE SET NULL"),
    ("incidents", "escalated_at", "TIMESTAMP"),
    ("incidents", "manager_notes", "TEXT"),
    ("incident_reports", "department_id", "INTEGER REFERENCES departments(id) ON DELETE SET NULL"),
    ("users", "password_changed_at", "TIMESTAMP"),
    ("incidents", "evidence", "JSON"),
    ("incident_reports", "evidence", "JSON"),
]


async def run_additive_migrations(conn: AsyncConnection):
    """Add any missing columns to already-existing tables. No-op if already applied."""
    for table, column, coltype in _ADDITIVE_COLUMNS:
        try:
            await conn.execute(
                text(f"ALTER TABLE {table} ADD COLUMN IF NOT EXISTS {column} {coltype}")
            )
        except Exception as e:
            logger.warning(f"[migrations] Could not add {table}.{column}: {e}")
    logger.info("Additive schema migrations applied.")
