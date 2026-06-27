"""
AegisOne API — Database Connection
SQLite with WAL mode for high-concurrency, swappable to PostgreSQL by changing DATABASE_URL.
"""
import os
import logging
from sqlalchemy.ext.asyncio import create_async_engine, async_sessionmaker, AsyncSession
from sqlalchemy.orm import DeclarativeBase
from sqlalchemy import event, text
from api.config import DATABASE_URL, DB_DIR, DB_POOL_SIZE

logger = logging.getLogger("aegisone.db")

# Ensure database directory exists
os.makedirs(DB_DIR, exist_ok=True)

engine = create_async_engine(
    DATABASE_URL,
    echo=False,
    pool_pre_ping=True,
    pool_size=DB_POOL_SIZE,
    max_overflow=DB_POOL_SIZE // 2,
    pool_recycle=3600,  # Recycle connections every hour
)

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
    async with engine.begin() as conn:
        await conn.execute(text("PRAGMA journal_mode=WAL"))
        await conn.execute(text("PRAGMA synchronous=NORMAL"))
        await conn.execute(text("PRAGMA cache_size=-64000"))  # 64MB cache
        await conn.execute(text("PRAGMA temp_store=MEMORY"))
        await conn.execute(text("PRAGMA mmap_size=268435456"))  # 256MB mmap
    logger.info("SQLite WAL mode enabled with optimized pragmas")


async def init_db():
    """Create all tables on first startup and enable WAL mode."""
    async with engine.begin() as conn:
        from api.database.models import User, ScanLog  # noqa: F401
        await conn.run_sync(Base.metadata.create_all)
    await _enable_wal_mode()
    logger.info("Database initialized")
