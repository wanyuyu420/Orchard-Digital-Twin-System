"""
Initialize database schema with PostGIS extension.
Usage: python -m backend.scripts.init_db
"""
import asyncio
from sqlalchemy import text
from app.database import engine, Base
# Ensure models are imported so metadata is populated
from app import models  # noqa: F401


async def main():
    async with engine.begin() as conn:
        # Enable PostGIS if available
        try:
            await conn.execute(text("CREATE EXTENSION IF NOT EXISTS postgis"))
        except Exception:
            # PostGIS might not be available; continue without failing
            pass
        await conn.run_sync(Base.metadata.create_all)


if __name__ == "__main__":
    asyncio.run(main())
