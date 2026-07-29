"""
AegisOne API — Database Connection
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
import logging
from sqlalchemy.ext.asyncio import create_async_engine, async_sessionmaker, AsyncSession
from sqlalchemy.orm import DeclarativeBase
from sqlalchemy import text
from api.config import DATABASE_URL, DB_DIR, DB_POOL_SIZE

logger = logging.getLogger("aegisone.db")

# Ensure SQLite directory exists (no-op for PostgreSQL)
os.makedirs(DB_DIR, exist_ok=True)

is_postgres = DATABASE_URL.startswith("postgresql")

engine_kwargs = {
    "echo": False,
    "pool_pre_ping": True,
}

if not is_postgres:
    from sqlalchemy.pool import NullPool
    engine_kwargs["connect_args"] = {"check_same_thread": False}
    engine_kwargs["poolclass"]    = NullPool
else:
    engine_kwargs["pool_size"]    = DB_POOL_SIZE
    engine_kwargs["max_overflow"] = DB_POOL_SIZE // 2
    engine_kwargs["pool_timeout"] = 30

engine       = create_async_engine(DATABASE_URL, **engine_kwargs)
async_session = async_sessionmaker(engine, class_=AsyncSession, expire_on_commit=False)


class Base(DeclarativeBase):
    pass


async def get_db():
    """FastAPI dependency — yields an async DB session for request lifecycle."""
    async with async_session() as session:
        try:
            yield session
        finally:
            await session.close()


async def get_background_db() -> AsyncSession:
    """Create a standalone session for background tasks (not tied to request lifecycle)."""
    return async_session()


async def _enable_wal_mode():
    """Enable WAL journal mode for concurrent read/write access."""
    if DATABASE_URL.startswith("sqlite"):
        async with engine.begin() as conn:
            await conn.execute(text("PRAGMA journal_mode=WAL"))
            await conn.execute(text("PRAGMA synchronous=NORMAL"))
            await conn.execute(text("PRAGMA cache_size=-64000"))
            await conn.execute(text("PRAGMA temp_store=MEMORY"))
            await conn.execute(text("PRAGMA mmap_size=268435456"))
        logger.info("SQLite WAL mode enabled with optimized pragmas")


async def init_db():
    """Create all tables on first startup and enable WAL mode."""
    if not is_postgres:
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
            Message,
        )
        await conn.run_sync(Base.metadata.create_all)

        # Auto-heal missing columns in SQLite for existing databases
        if not is_postgres:
            cols_to_check = [
                ("users", "organization_id", "VARCHAR(64) DEFAULT 'org_default'"),
                ("users", "department_id", "INTEGER REFERENCES departments(id)"),
                ("users", "department", "VARCHAR(255) DEFAULT 'General'"),
                ("users", "account_status", "VARCHAR(50) DEFAULT 'pending'"),
                ("users", "approved_by", "INTEGER"),
                ("users", "status_reason", "TEXT"),
                ("users", "avatar_url", "VARCHAR(500)"),
                ("users", "is_active", "BOOLEAN DEFAULT 1"),
                ("users", "last_login", "DATETIME"),
                ("users", "last_active_at", "DATETIME"),
            ]
            for table_name, col_name, col_type in cols_to_check:
                try:
                    await conn.execute(text(f"ALTER TABLE {table_name} ADD COLUMN {col_name} {col_type}"))
                except Exception:
                    pass

    await _enable_wal_mode()
    logger.info("Database initialized with schema auto-healing")
