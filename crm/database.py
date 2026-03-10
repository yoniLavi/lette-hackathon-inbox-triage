"""Database engine and session factory."""

import os

from sqlalchemy.ext.asyncio import AsyncSession, async_sessionmaker, create_async_engine
from sqlalchemy.orm import DeclarativeBase
from sqlalchemy import text

DATABASE_URL = os.environ.get(
    "DATABASE_URL", "postgresql+asyncpg://crm:crm@localhost:5432/crm"
)

engine = create_async_engine(DATABASE_URL)
async_session = async_sessionmaker(engine, expire_on_commit=False)


class Base(DeclarativeBase):
    pass


async def get_db():
    async with async_session() as session:
        yield session


async def init_db():
    """Create all tables and indexes, apply lightweight migrations."""
    import models  # noqa: F401 — ensure models are registered on Base.metadata

    async with engine.begin() as conn:
        await conn.run_sync(Base.metadata.create_all)
        # Functional GIN index for full-text search on emails
        await conn.execute(
            text(
                "CREATE INDEX IF NOT EXISTS ix_emails_fts "
                "ON emails USING gin("
                "to_tsvector('english', coalesce(subject,'') || ' ' || coalesce(body,''))"
                ")"
            )
        )
        # Add manager_email column to properties if missing (lightweight migration)
        await conn.execute(
            text(
                "ALTER TABLE properties ADD COLUMN IF NOT EXISTS manager_email VARCHAR(255)"
            )
        )
