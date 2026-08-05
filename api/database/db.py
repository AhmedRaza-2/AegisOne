"""
AegisOne API — Database Connection
Configured strictly for PostgreSQL production environment.
"""
import logging
from sqlalchemy.ext.asyncio import create_async_engine, async_sessionmaker, AsyncSession
from sqlalchemy.orm import DeclarativeBase
from api.config import DATABASE_URL, DB_POOL_SIZE

logger = logging.getLogger("aegisone.db")

if not DATABASE_URL.startswith("postgresql"):
    raise RuntimeError("AegisOne is configured to run ONLY on PostgreSQL. Check your DATABASE_URL environment variable.")

engine_kwargs = {
    "echo": False,
    "pool_pre_ping": True,
    "pool_size": DB_POOL_SIZE,
    "max_overflow": DB_POOL_SIZE // 2,
    "pool_timeout": 30
}

engine = create_async_engine(DATABASE_URL, **engine_kwargs)
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


async def init_db():
    """Create all tables on first startup using PostgreSQL schema definition."""
    async with engine.begin() as conn:
        from api.database.models import (  # noqa: F401
            Organization,
            Department,
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
    logger.info("PostgreSQL Database initialized successfully.")
