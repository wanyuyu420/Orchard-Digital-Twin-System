"""
Revert Flow scenario extent to original values.
"""
import asyncio
from sqlalchemy import update
from app.database import AsyncSessionLocal
from app.models.hec_ras import HecRasScenario


async def revert_flow_extent():
    async with AsyncSessionLocal() as session:
        # Revert to original values
        original_extent_west = 85.61303950442203
        original_extent_east = 90.47827004670474

        stmt = (
            update(HecRasScenario)
            .where(HecRasScenario.code == "flow")
            .values(
                extent_west=original_extent_west,
                extent_east=original_extent_east,
            )
        )

        await session.execute(stmt)
        await session.commit()
        print("[revert] Flow scenario extent reverted to original values")


if __name__ == "__main__":
    asyncio.run(revert_flow_extent())
