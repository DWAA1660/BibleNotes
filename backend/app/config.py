from functools import lru_cache
from pathlib import Path
from typing import Optional

from pydantic import BaseSettings, Field


class Settings(BaseSettings):
    database_url: str = Field("sqlite:///backend/bible_notes.db", env="DATABASE_URL")
    jwt_secret: str = Field("change_me", env="JWT_SECRET")
    jwt_algorithm: str = Field("HS256", env="JWT_ALGORITHM")
    access_token_expire_minutes: int = Field(120, env="ACCESS_TOKEN_EXPIRE_MINUTES")
    bible_assets_path: Path = Field(Path("bibles"), env="BIBLE_ASSETS_PATH")
    rate_limit_notes_per_minute: Optional[int] = Field(10, env="RATE_LIMIT_NOTES_PER_MINUTE")

    class Config:
        env_file = ".env"
        case_sensitive = False


@lru_cache()
def get_settings() -> Settings:
    return Settings()
