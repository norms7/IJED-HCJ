from sqlalchemy.ext.asyncio import AsyncSession, async_sessionmaker, create_async_engine
from sqlalchemy.orm import DeclarativeBase

from app.core.config import settings

_db_url = settings.DATABASE_URL
_is_remote = (
    "supabase.com" in _db_url
    or "render.com" in _db_url
    or "amazonaws.com" in _db_url
)

if _is_remote:
    # Direct connection to Supabase (db.xxxx.supabase.co:5432)
    # Works on Render IPv6 free tier — no pgbouncer in the way.
    # Allows persistent pool: no new TCP handshake per request.
    # pool_size=2 — safe for Supabase free tier (15 connection limit).
    # pool_recycle=300 — recycle before Supabase's ~10min idle timeout.
    engine = create_async_engine(
        _db_url,
        echo=False,
        pool_size=2,
        max_overflow=1,
        pool_pre_ping=True,
        pool_recycle=300,
        pool_timeout=30,
        connect_args={
            "ssl": "require",
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
