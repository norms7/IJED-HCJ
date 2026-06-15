from sqlalchemy.ext.asyncio import AsyncSession, async_sessionmaker, create_async_engine
from sqlalchemy.orm import DeclarativeBase

from app.core.config import settings

# Detect remote (Render / Supabase) vs local
_db_url = settings.DATABASE_URL
_is_remote = (
    "supabase.com" in _db_url
    or "render.com" in _db_url
    or "amazonaws.com" in _db_url
)

# ── Connection pool strategy ───────────────────────────────────────────────────
#
# PERF FIX (2025-06): Replaced NullPool with a small persistent pool.
#
# NullPool was safe for preventing EMAXCONNSESSION but kills performance:
# every single API call paid a full TCP + SSL + Postgres auth handshake to
# Supabase (~150–300 ms) before any SQL ran.
#
# Requirements to use a persistent pool with Supabase:
#   1. Use Session-mode pooler  → Supabase dashboard → Database → Connection
#      pooling → Mode = Session  (port 5432, NOT 6543 Transaction mode)
#   2. Remove ?pgbouncer=true from DATABASE_URL if it's there
#   3. Remove statement_cache_size=0 — those are only needed for Transaction mode
#
# pool_size=2 + max_overflow=1 → max 3 connections held by this Render instance.
# Supabase free tier cap is 15–20; we're well within that.
# pool_recycle=300 → recycle connections every 5 min to avoid Supabase's
# ~10-min idle timeout dropping them mid-session.
# pool_pre_ping=True → test stale connections before use (safe for any mode).
# ──────────────────────────────────────────────────────────────────────────────

if _is_remote:
    engine = create_async_engine(
        _db_url,
        echo=False,
        pool_size=2,          # 2 persistent connections on Render free tier
        max_overflow=1,       # 1 extra connection allowed during burst traffic
        pool_pre_ping=True,   # recycle dead connections silently
        pool_recycle=300,     # recycle every 5 min (before Supabase's idle timeout)
        connect_args={
            "ssl": "require",
            # statement_cache_size and prepared_statement_cache_size are ONLY
            # needed for PgBouncer Transaction mode. Remove them for Session mode.
            # If you ever switch back to Transaction mode, re-add:
            #   "statement_cache_size": 0,
            #   "prepared_statement_cache_size": 0,
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
