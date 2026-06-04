import asyncio
import random
from sqlalchemy import select, update
from geoalchemy2.elements import WKTElement
from app.database import get_session, engine
from app.models.hydrological import HydrologicalStation
from app.models.facility import MonitoringFacility

# BIM Center
CENTER_LNG = 78.42108125522402
CENTER_LAT = 39.7811204696115


async def main():
    async for session in get_session():
        print("Populating Hydrological Stations...")
        stations = (await session.execute(select(HydrologicalStation))).scalars().all()
        for s in stations:
            # Random offset +/- 0.005 degrees (~500m)
            lng = CENTER_LNG + (random.random() - 0.5) * 0.01
            lat = CENTER_LAT + (random.random() - 0.5) * 0.01
            # Update
            stmt = update(HydrologicalStation).where(HydrologicalStation.id == s.id).values(
                location=WKTElement(f'POINT({lng} {lat})', srid=4326)
            )
            await session.execute(stmt)

        print("Populating Monitoring Facilities...")
        facilities = (await session.execute(select(MonitoringFacility))).scalars().all()
        for f in facilities:
            lng = CENTER_LNG + (random.random() - 0.5) * 0.01
            lat = CENTER_LAT + (random.random() - 0.5) * 0.01
            stmt = update(MonitoringFacility).where(MonitoringFacility.id == f.id).values(
                location=WKTElement(f'POINT({lng} {lat})', srid=4326)
            )
            await session.execute(stmt)

        await session.commit()
        print("Done!")
        break

if __name__ == "__main__":
    asyncio.run(main())
