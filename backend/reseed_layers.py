"""
Re-seed script - Clear and re-populate gis_layers table
Run with: python reseed_layers.py
"""
from scripts.seed_layers import seed_default_layers
from app.database import AsyncSessionLocal
from sqlalchemy import text
import asyncio
import sys
sys.path.insert(0, '.')


async def reseed():
    async with AsyncSessionLocal() as session:
        # Clear existing layers
        await session.execute(text("DELETE FROM gis_layers"))
        await session.commit()
        print("[reseed] Cleared all existing layers")

        # Re-seed with new data
        count = await seed_default_layers(session)
        print(f"[reseed] Created {count} new layers")


if __name__ == "__main__":
    asyncio.run(reseed())
