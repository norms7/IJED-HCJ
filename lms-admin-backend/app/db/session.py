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
    # pool_size=1 per worker × 2 workers = 2 total connections max.
    # Supabase free tier is stable with this. max_overflow=1 allows 1 burst
    # connection per worker (4 total absolute max) but only briefly.
    # pool_timeout=60 gives connections more time to establish on cold start.
    engine = create_async_engine(
        _db_url,
        echo=False,
        pool_size=1,
        max_overflow=1,
        pool_pre_ping=True,
        pool_recycle=300,
        pool_timeout=60,      # wait up to 60s for a connection on cold start
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