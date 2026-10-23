"""
AegisOne API — Additive Schema Migrations
==========================================
`Base.metadata.create_all` (see db.py) only creates tables that don't exist yet —
it never alters an existing table. Since AegisOne ships as a Docker image deployed
onto each customer's own on-prem Postgres, any new column added to an existing model
needs an explicit, idempotent ALTER here so already-running deployments pick it up
on their next container restart without losing data.

Existing columns are inspected first, so this is safe on SQLite and PostgreSQL.
"""
import logging
from sqlalchemy import inspect, text
from sqlalchemy.ext.asyncio import AsyncConnection

logger = logging.getLogger("aegisone.migrations")

_ADDITIVE_COLUMNS = [
    # (table, column, postgres column definition)
    ("incidents", "escalated_by_id", "INTEGER REFERENCES users(id) ON DELETE SET NULL"),
    ("incidents", "escalated_at", "TIMESTAMP"),
    ("incidents", "manager_notes", "TEXT"),
    ("incident_reports", "department_id", "INTEGER REFERENCES departments(id) ON DELETE SET NULL"),
    ("users", "password_changed_at", "TIMESTAMP"),
    ("users", "chat_public_key", "TEXT"),
    ("global_model_releases", "status", "VARCHAR(20) DEFAULT 'active'"),
    ("global_model_releases", "submission_id", "VARCHAR(64)"),
    ("global_model_releases", "source_org_id", "VARCHAR(64)"),
    ("incidents", "evidence", "JSON"),
    ("incident_reports", "evidence", "JSON"),
    ("credential_events", "user_id", "VARCHAR(128)"),
]


async def run_additive_migrations(conn: AsyncConnection):
    """Add any missing columns to already-existing tables. No-op if already applied."""
    def get_existing_columns(sync_conn):
        inspector = inspect(sync_conn)
        return {
            table: {column["name"] for column in inspector.get_columns(table)}
            for table in {entry[0] for entry in _ADDITIVE_COLUMNS}
        }

    existing = await conn.run_sync(get_existing_columns)
    # PostgreSQL supports this clause; SQLite requires the inspection above.
    if_missing = " IF NOT EXISTS" if conn.dialect.name == "postgresql" else ""
    failures = 0
    for table, column, coltype in _ADDITIVE_COLUMNS:
        if column in existing[table]:
            continue
        try:
            # Isolate failed statements so PostgreSQL's startup transaction
            # remains usable for the remaining migrations.
            async with conn.begin_nested():
                await conn.execute(
                    text(f"ALTER TABLE {table} ADD COLUMN{if_missing} {column} {coltype}")
                )
            existing[table].add(column)
        except Exception as e:
            failures += 1
            logger.warning(f"[migrations] Could not add {table}.{column}: {e}")
    if failures:
        logger.warning("Additive schema migrations completed with %d failure(s).", failures)
    else:
        logger.info("Additive schema migrations applied.")
