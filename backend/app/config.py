from functools import lru_cache
from pydantic_settings import BaseSettings
import os


class Settings(BaseSettings):
    """Application configuration loaded from environment or .env"""

    database_url: str = "sqlite+aiosqlite:///./demo.db"
    database_url_sync: str = "sqlite:///./demo.db"

    api_prefix: str = "/api"
    enable_seed_data: bool = True
    debug: bool = True

    gis_data_dir: str | None = None

    # ===== GeoScene Server - REQUIRED =====
    # System will refuse to start without these configured
    geoscene_server_url: str
    geoscene_feature_server_url: str
    geoscene_username: str
    geoscene_password: str
    geoscene_token_duration: int = 120

    class Config:
        env_file = ".env"
        env_file_encoding = "utf-8"

    @property
    def is_sqlite(self) -> bool:
        return "sqlite" in self.database_url.lower()


@lru_cache
def get_settings() -> Settings:
    return Settings()
