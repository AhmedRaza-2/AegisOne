"""
AegisOne API — Database Connection
SQLite for now, swappable to PostgreSQL by changing DATABASE_URL.
"""
import os
from sqlalchemy.ext.asyncio import create_async_engine, async_sessionmaker, AsyncSession
from sqlalchemy.orm import DeclarativeBase
from api.config import DATABASE_URL, DB_DIR


# Ensure database directory exists
os.makedirs(DB_DIR, exist_ok=True)

engine = create_async_engine(
    DATABASE_URL,
    echo=False,
    pool_pre_ping=True,
)

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
    """Create all tables on first startup."""
    async with engine.begin() as conn:
        from api.database.models import User, ScanLog  # noqa: F401
        await conn.run_sync(Base.metadata.create_all)
