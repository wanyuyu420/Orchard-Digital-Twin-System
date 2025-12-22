from functools import lru_cache
from pydantic_settings import BaseSettings
import os


class Settings(BaseSettings):
    """Application configuration loaded from environment or .env"""

    # Default to SQLite for demo mode (no external DB required)
    # Set DATABASE_URL env var to use PostgreSQL in production
    database_url: str = "sqlite+aiosqlite:///./demo.db"
    database_url_sync: str = "sqlite:///./demo.db"

    # PostgreSQL example (set in .env for production):
    # database_url: str = "postgresql+asyncpg://user:password@localhost:5432/water_twin"
    # database_url_sync: str = "postgresql+psycopg2://user:password@localhost:5432/water_twin"

    api_prefix: str = "/api"
    enable_seed_data: bool = True  # Auto-seed demo data on startup
    debug: bool = True

    # GIS data directory - platform-specific absolute path
    # Windows:  D:\para\data\gis-data
    # macOS:    ~/data/gis-data
    # Ubuntu:   /home/user/data/gis-data
    gis_data_dir: str | None = None

    class Config:
        env_file = ".env"
        env_file_encoding = "utf-8"

    @property
    def is_sqlite(self) -> bool:
        """Check if using SQLite database"""
        return "sqlite" in self.database_url.lower()


@lru_cache
def get_settings() -> Settings:
    return Settings()
