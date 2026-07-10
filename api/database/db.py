"""
AegisOne API — Database Connection
====================================
Supports both SQLite (dev) and PostgreSQL (production).
Switch by setting DATABASE_URL environment variable:

  SQLite (default):
    sqlite+aiosqlite:///./api/database/aegisone.db

  PostgreSQL:
    postgresql+asyncpg://aegis:password@localhost:5432/aegisone

The ORM models and queries are identical for both — no code changes needed
when migrating from SQLite to PostgreSQL.
"""
import os
from sqlalchemy.ext.asyncio import create_async_engine, async_sessionmaker, AsyncSession
from sqlalchemy.orm import DeclarativeBase
from api.config import DATABASE_URL, DB_DIR


# Ensure SQLite directory exists (no-op for PostgreSQL)
os.makedirs(DB_DIR, exist_ok=True)

# PostgreSQL benefits from a connection pool; SQLite must use StaticPool
is_postgres = DATABASE_URL.startswith("postgresql")

engine_kwargs = {
    "echo": False,
    "pool_pre_ping": True,
}

if not is_postgres:
    # SQLite: use NullPool (each request gets its own connection) + WAL mode
    # for proper concurrent read/write support under load.
    # StaticPool shares a single connection which causes "SQL statements in progress"
    # errors when background tasks and request handlers access the DB simultaneously.
    from sqlalchemy.pool import NullPool
    engine_kwargs["connect_args"] = {"check_same_thread": False}
    engine_kwargs["poolclass"]    = NullPool
else:
    # PostgreSQL: sensible pool for a 50–5000 user org
    engine_kwargs["pool_size"]    = 10
    engine_kwargs["max_overflow"] = 20
    engine_kwargs["pool_timeout"] = 30

engine       = create_async_engine(DATABASE_URL, **engine_kwargs)
async_session = async_sessionmaker(engine, class_=AsyncSession, expire_on_commit=False)


class Base(DeclarativeBase):
    pass


async def get_db():
    """FastAPI dependency — yields an async DB session."""
    async with async_session() as session:
        try:
            yield session
        finally:
            await session.close()


async def init_db():
    """
    Create all tables on first startup if they don't exist.
    Also enables WAL mode for SQLite (much better concurrent read/write).
    Safe to call multiple times — uses CREATE TABLE IF NOT EXISTS semantics.
    For production migrations, use Alembic instead.
    """
    # Enable WAL mode for SQLite before creating tables
    if not is_postgres:
        from sqlalchemy import text
        async with engine.begin() as conn:
            await conn.execute(text("PRAGMA journal_mode=WAL"))
            await conn.execute(text("PRAGMA busy_timeout=5000"))

    async with engine.begin() as conn:
        from api.database.models import (  # noqa: F401 — imports needed for metadata
            Organization,
            User,
            Device,
            WebsiteScan,
            SecurityEvent,
            DownloadEvent,
            CredentialEvent,
            ManualScan,
            XAIReport,
            Policy,
            ThreatReport,
            DashboardStatistic,
            AuditLog,
            HoverScan,
        )
        await conn.run_sync(Base.metadata.create_all)

