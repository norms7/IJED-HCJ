from sqlalchemy.ext.asyncio import AsyncSession, async_sessionmaker, create_async_engine
from sqlalchemy.orm import DeclarativeBase
from sqlalchemy.pool import NullPool

from app.core.config import settings

# Detect remote (Render / Supabase) vs local
_db_url = settings.DATABASE_URL
_is_remote = (
    "supabase.com" in _db_url
    or "render.com" in _db_url
    or "amazonaws.com" in _db_url
)

# ── Connection pool strategy ───────────────────────────────────────────────────
# Render free tier + Supabase session-mode both cap connections at 15-20 total.
# A persistent SQLAlchemy pool across dyno restarts stacks up stale connections
# and causes EMAXCONNSESSION once the cap is hit.
#
# FIX: NullPool on remote — every request opens and closes its own connection.
# Safe for free-tier / serverless. On a paid persistent server, switch back to
# pool_size=3, max_overflow=2.
# ──────────────────────────────────────────────────────────────────────────────

if _is_remote:
    engine = create_async_engine(
        _db_url,
        echo=False,
        poolclass=NullPool,
        connect_args={
            "ssl": "require",
            "statement_cache_size": 0,
            "prepared_statement_cache_size": 0,
        },
    )
else:
    engine = create_async_engine(
        _db_url,
        echo=False,
        pool_size=3,
        max_overflow=2,
        pool_pre_ping=True,
    )

AsyncSessionLocal = async_sessionmaker(
    bind=engine,
    class_=AsyncSession,
    expire_on_commit=False,
    autoflush=False,
    autocommit=False,
)


class Base(DeclarativeBase):
    pass


async def get_db() -> AsyncSession:  # type: ignore[return]
    async with AsyncSessionLocal() as session:
        try:
            yield session
            await session.commit()
        except Exception:
            await session.rollback()
            raise