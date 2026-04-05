from pydantic_settings import BaseSettings
from functools import lru_cache


class Settings(BaseSettings):
    DATABASE_URL: str = "postgresql+asyncpg://postgres:password@localhost:5432/lms_db"
    SECRET_KEY: str = "changeme-in-production-use-long-random-string"
    ALGORITHM: str = "HS256"
    ACCESS_TOKEN_EXPIRE_MINUTES: int = 480

    # CORS origins — space-separated in .env, split here
    CORS_ORIGINS: str = "http://localhost:3000 http://localhost:5500 http://127.0.0.1:5500"

    @property
    def cors_origins_list(self) -> list[str]:
        return self.CORS_ORIGINS.split()

    class Config:
        env_file = ".env"
        case_sensitive = True


@lru_cache
def get_settings() -> Settings:
    return Settings()


settings = get_settings()
