from sqlalchemy.ext.asyncio import AsyncSession, async_sessionmaker, create_async_engine
from sqlalchemy.orm import DeclarativeBase

from app.core.config import settings

# Supabase pooler requires SSL — detect by checking if it's a remote host
_db_url = settings.DATABASE_URL
_is_remote = "supabase.com" in _db_url or "render.com" in _db_url

engine = create_async_engine(
    _db_url,
    echo=False,
    pool_size=5,
    max_overflow=10,
    pool_pre_ping=True,
    connect_args={
        "ssl": "require",
        "statement_cache_size": 0,  # required for Supabase Transaction pooler
        "prepared_statement_cache_size": 0,
    } if _is_remote else {},
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