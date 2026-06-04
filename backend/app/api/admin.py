"""
Admin API endpoints for data management with pagination, filtering, and CRUD operations.
"""
from typing import Optional, Generic, TypeVar, List, Any
from datetime import datetime
from fastapi import APIRouter, Query, HTTPException, Depends
from pydantic import BaseModel, Field
from sqlalchemy import select, func, or_, desc, asc
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from app.database import get_session
from app.models.sensor import Sensor, SensorMetric
from app.models.facility import MonitoringFacility, MonitoringSection, SensorType
from app.models.reading import SensorReading
from app.models.hydrological import HydrologicalStation
from geoalchemy2.shape import to_shape

router = APIRouter(prefix="/admin", tags=["admin"])

T = TypeVar("T")


# ============ Schemas ============

class PaginatedResponse(BaseModel, Generic[T]):
    """Paginated response wrapper"""
    items: List[T]
    total: int
    page: int
    page_size: int
    total_pages: int


class SensorAdminOut(BaseModel):
    id: int
    point_code: str
    status: str
    section_id: int
    section_name: Optional[str] = None
    sensor_type_id: int
    sensor_type_name: Optional[str] = None
    install_date: Optional[str] = None
    is_simulated: bool

    class Config:
        from_attributes = True


class SensorCreate(BaseModel):
    point_code: str
    section_id: int
    sensor_type_id: int
    status: str = "active"
    install_date: Optional[str] = None
    is_simulated: bool = False


class SensorUpdate(BaseModel):
    point_code: Optional[str] = None
    status: Optional[str] = None
    install_date: Optional[str] = None


class ReadingAdminOut(BaseModel):
    id: int
    sensor_id: int
    sensor_name: Optional[str] = None
    metric_id: int
    metric_key: Optional[str] = None
    reading_time: datetime
    value_num: Optional[float] = None
    unit: Optional[str] = None
    quality_flag: str
    is_simulated: bool

    class Config:
        from_attributes = True


class StationAdminOut(BaseModel):
    id: int
    station_code: str
    station_name: str
    river_name: Optional[str] = None
    basin_name: Optional[str] = None
    facility_id: int
    facility_name: Optional[str] = None
    is_simulated: bool

    class Config:
        from_attributes = True


class StationCreate(BaseModel):
    station_code: str
    station_name: str
    facility_id: int
    river_name: Optional[str] = None
    basin_name: Optional[str] = None
    is_simulated: bool = False


class StationUpdate(BaseModel):
    station_name: Optional[str] = None
    river_name: Optional[str] = None
    basin_name: Optional[str] = None


class FacilityAdminOut(BaseModel):
    id: int
    code: str
    name: str
    facility_type: Optional[str] = None
    location_desc: Optional[str] = None
    lng: Optional[float] = None
    lat: Optional[float] = None
    is_simulated: bool
    section_count: int = 0

    class Config:
        from_attributes = True


class FacilityCreate(BaseModel):
    code: str
    name: str
    facility_type: Optional[str] = None
    location_desc: Optional[str] = None
    is_simulated: bool = False


class FacilityUpdate(BaseModel):
    name: Optional[str] = None
    facility_type: Optional[str] = None
    location_desc: Optional[str] = None


class SectionAdminOut(BaseModel):
    id: int
    code: str
    name: str
    facility_id: int
    facility_name: Optional[str] = None
    section_type: Optional[str] = None
    chainage: Optional[str] = None
    is_simulated: bool
    sensor_count: int = 0

    class Config:
        from_attributes = True


class SectionCreate(BaseModel):
    code: str
    name: str
    facility_id: int
    section_type: Optional[str] = None
    chainage: Optional[str] = None
    is_simulated: bool = False


class SectionUpdate(BaseModel):
    name: Optional[str] = None
    section_type: Optional[str] = None
    chainage: Optional[str] = None


# ============ Sensors ============

@router.get("/sensors", response_model=PaginatedResponse[SensorAdminOut])
async def list_sensors(
    page: int = Query(1, ge=1),
    page_size: int = Query(20, ge=10, le=100),
    search: Optional[str] = None,
    status: Optional[str] = None,
    sensor_type_id: Optional[int] = None,
    is_simulated: Optional[bool] = None,
    sort_by: str = "id",
    sort_order: str = "desc",
    db: AsyncSession = Depends(get_session),
):
    """List sensors with pagination and filtering."""
    query = select(Sensor).options(
        selectinload(Sensor.section),
        selectinload(Sensor.sensor_type),
    )

    # Apply filters
    if search:
        query = query.where(Sensor.point_code.ilike(f"%{search}%"))
    if status:
        query = query.where(Sensor.status == status)
    if sensor_type_id:
        query = query.where(Sensor.sensor_type_id == sensor_type_id)
    if is_simulated is not None:
        query = query.where(Sensor.is_simulated == is_simulated)

    # Count total
    count_query = select(func.count()).select_from(query.subquery())
    total = (await db.execute(count_query)).scalar() or 0

    # Apply sorting
    sort_col = getattr(Sensor, sort_by, Sensor.id)
    query = query.order_by(desc(sort_col) if sort_order ==
                           "desc" else asc(sort_col))

    # Apply pagination
    query = query.offset((page - 1) * page_size).limit(page_size)

    result = await db.execute(query)
    sensors = result.scalars().all()

    items = [
        SensorAdminOut(
            id=s.id,
            point_code=s.point_code,
            status=s.status,
            section_id=s.section_id,
            section_name=s.section.name if s.section else None,
            sensor_type_id=s.sensor_type_id,
            sensor_type_name=s.sensor_type.name if s.sensor_type else None,
            install_date=s.install_date.isoformat() if s.install_date else None,
            is_simulated=s.is_simulated,
        )
        for s in sensors
    ]

    return PaginatedResponse(
        items=items,
        total=total,
        page=page,
        page_size=page_size,
        total_pages=(total + page_size - 1) // page_size,
    )


@router.post("/sensors", response_model=SensorAdminOut)
async def create_sensor(
    data: SensorCreate,
    db: AsyncSession = Depends(get_session),
):
    """Create a new sensor."""
    sensor = Sensor(
        point_code=data.point_code,
        section_id=data.section_id,
        sensor_type_id=data.sensor_type_id,
        status=data.status,
        is_simulated=data.is_simulated,
    )
    db.add(sensor)
    await db.commit()
    await db.refresh(sensor)

    return SensorAdminOut(
        id=sensor.id,
        point_code=sensor.point_code,
        status=sensor.status,
        section_id=sensor.section_id,
        sensor_type_id=sensor.sensor_type_id,
        is_simulated=sensor.is_simulated,
    )


@router.put("/sensors/{sensor_id}", response_model=SensorAdminOut)
async def update_sensor(
    sensor_id: int,
    data: SensorUpdate,
    db: AsyncSession = Depends(get_session),
):
    """Update a sensor."""
    result = await db.execute(
        select(Sensor).options(
            selectinload(Sensor.section),
            selectinload(Sensor.sensor_type),
        ).where(Sensor.id == sensor_id)
    )
    sensor = result.scalar_one_or_none()
    if not sensor:
        raise HTTPException(status_code=404, detail="Sensor not found")

    if data.point_code is not None:
        sensor.point_code = data.point_code
    if data.status is not None:
        sensor.status = data.status

    await db.commit()
    await db.refresh(sensor)

    return SensorAdminOut(
        id=sensor.id,
        point_code=sensor.point_code,
        status=sensor.status,
        section_id=sensor.section_id,
        section_name=sensor.section.name if sensor.section else None,
        sensor_type_id=sensor.sensor_type_id,
        sensor_type_name=sensor.sensor_type.name if sensor.sensor_type else None,
        is_simulated=sensor.is_simulated,
    )


@router.delete("/sensors/{sensor_id}")
async def delete_sensor(
    sensor_id: int,
    db: AsyncSession = Depends(get_session),
):
    """Soft delete a sensor (set status to deleted)."""
    result = await db.execute(select(Sensor).where(Sensor.id == sensor_id))
    sensor = result.scalar_one_or_none()
    if not sensor:
        raise HTTPException(status_code=404, detail="Sensor not found")

    sensor.status = "deleted"
    await db.commit()
    return {"message": "Sensor deleted", "id": sensor_id}


# ============ Readings ============

@router.get("/readings", response_model=PaginatedResponse[ReadingAdminOut])
async def list_readings(
    page: int = Query(1, ge=1),
    page_size: int = Query(20, ge=10, le=100),
    sensor_id: Optional[int] = None,
    metric_key: Optional[str] = None,
    start_time: Optional[datetime] = None,
    end_time: Optional[datetime] = None,
    quality_flag: Optional[str] = None,
    is_simulated: Optional[bool] = None,
    sort_by: str = "reading_time",
    sort_order: str = "desc",
    db: AsyncSession = Depends(get_session),
):
    """List sensor readings with pagination and filtering."""
    query = select(SensorReading).options(
        selectinload(SensorReading.sensor),
        selectinload(SensorReading.metric),
    )

    # Apply filters
    if sensor_id:
        query = query.where(SensorReading.sensor_id == sensor_id)
    if metric_key:
        query = query.join(SensorMetric).where(
            SensorMetric.metric_key == metric_key)
    if start_time:
        query = query.where(SensorReading.reading_time >= start_time)
    if end_time:
        query = query.where(SensorReading.reading_time <= end_time)
    if quality_flag:
        query = query.where(SensorReading.quality_flag == quality_flag)
    if is_simulated is not None:
        query = query.where(SensorReading.is_simulated == is_simulated)

    # Count total
    count_query = select(func.count()).select_from(query.subquery())
    total = (await db.execute(count_query)).scalar() or 0

    # Apply sorting
    sort_col = getattr(SensorReading, sort_by, SensorReading.reading_time)
    query = query.order_by(desc(sort_col) if sort_order ==
                           "desc" else asc(sort_col))

    # Apply pagination
    query = query.offset((page - 1) * page_size).limit(page_size)

    result = await db.execute(query)
    readings = result.scalars().all()

    items = [
        ReadingAdminOut(
            id=r.id,
            sensor_id=r.sensor_id,
            sensor_name=r.sensor.point_code if r.sensor else None,
            metric_id=r.metric_id,
            metric_key=r.metric.metric_key if r.metric else None,
            reading_time=r.reading_time,
            value_num=r.value_num,
            unit=r.unit,
            quality_flag=r.quality_flag,
            is_simulated=r.is_simulated,
        )
        for r in readings
    ]

    return PaginatedResponse(
        items=items,
        total=total,
        page=page,
        page_size=page_size,
        total_pages=(total + page_size - 1) // page_size,
    )


@router.delete("/readings/{reading_id}")
async def delete_reading(
    reading_id: int,
    db: AsyncSession = Depends(get_session),
):
    """Hard delete a sensor reading."""
    result = await db.execute(select(SensorReading).where(SensorReading.id == reading_id))
    reading = result.scalar_one_or_none()
    if not reading:
        raise HTTPException(status_code=404, detail="Reading not found")

    await db.delete(reading)
    await db.commit()
    return {"message": "Reading deleted", "id": reading_id}


# ============ Hydrological Stations ============

@router.get("/hydrological_stations", response_model=PaginatedResponse[StationAdminOut])
async def list_hydrological_stations(
    page: int = Query(1, ge=1),
    page_size: int = Query(20, ge=10, le=100),
    search: Optional[str] = None,
    is_simulated: Optional[bool] = None,
    sort_by: str = "id",
    sort_order: str = "desc",
    db: AsyncSession = Depends(get_session),
):
    """List hydrological stations with pagination."""
    query = select(HydrologicalStation).options(
        selectinload(HydrologicalStation.facility))

    # Apply filters
    if search:
        query = query.where(
            or_(
                HydrologicalStation.station_code.ilike(f"%{search}%"),
                HydrologicalStation.station_name.ilike(f"%{search}%"),
            )
        )
    if is_simulated is not None:
        query = query.where(HydrologicalStation.is_simulated == is_simulated)

    # Count total
    count_query = select(func.count()).select_from(query.subquery())
    total = (await db.execute(count_query)).scalar() or 0

    # Apply sorting
    sort_col = getattr(HydrologicalStation, sort_by, HydrologicalStation.id)
    query = query.order_by(desc(sort_col) if sort_order ==
                           "desc" else asc(sort_col))

    # Apply pagination
    query = query.offset((page - 1) * page_size).limit(page_size)

    result = await db.execute(query)
    stations = result.scalars().all()

    items = [
        StationAdminOut(
            id=s.id,
            station_code=s.station_code,
            station_name=s.station_name,
            river_name=s.river_name,
            basin_name=s.basin_name,
            facility_id=s.facility_id,
            facility_name=s.facility.name if s.facility else None,
            is_simulated=s.is_simulated,
        )
        for s in stations
    ]

    return PaginatedResponse(
        items=items,
        total=total,
        page=page,
        page_size=page_size,
        total_pages=(total + page_size - 1) // page_size,
    )


@router.post("/hydrological_stations", response_model=StationAdminOut)
async def create_hydrological_station(
    data: StationCreate,
    db: AsyncSession = Depends(get_session),
):
    """Create a new hydrological station."""
    station = HydrologicalStation(
        station_code=data.station_code,
        station_name=data.station_name,
        facility_id=data.facility_id,
        river_name=data.river_name,
        basin_name=data.basin_name,
        is_simulated=data.is_simulated,
    )
    db.add(station)
    await db.commit()
    await db.refresh(station)

    return StationAdminOut(
        id=station.id,
        station_code=station.station_code,
        station_name=station.station_name,
        river_name=station.river_name,
        basin_name=station.basin_name,
        facility_id=station.facility_id,
        is_simulated=station.is_simulated,
    )


@router.put("/hydrological_stations/{station_id}", response_model=StationAdminOut)
async def update_hydrological_station(
    station_id: int,
    data: StationUpdate,
    db: AsyncSession = Depends(get_session),
):
    """Update a hydrological station."""
    result = await db.execute(
        select(HydrologicalStation)
        .options(selectinload(HydrologicalStation.facility))
        .where(HydrologicalStation.id == station_id)
    )
    station = result.scalar_one_or_none()
    if not station:
        raise HTTPException(status_code=404, detail="Station not found")

    if data.station_name is not None:
        station.station_name = data.station_name
    if data.river_name is not None:
        station.river_name = data.river_name
    if data.basin_name is not None:
        station.basin_name = data.basin_name

    await db.commit()
    await db.refresh(station)

    return StationAdminOut(
        id=station.id,
        station_code=station.station_code,
        station_name=station.station_name,
        river_name=station.river_name,
        basin_name=station.basin_name,
        facility_id=station.facility_id,
        facility_name=station.facility.name if station.facility else None,
        is_simulated=station.is_simulated,
    )


@router.delete("/hydrological_stations/{station_id}")
async def delete_hydrological_station(
    station_id: int,
    db: AsyncSession = Depends(get_session),
):
    """Delete a hydrological station."""
    result = await db.execute(
        select(HydrologicalStation).where(HydrologicalStation.id == station_id)
    )
    station = result.scalar_one_or_none()
    if not station:
        raise HTTPException(status_code=404, detail="Station not found")

    await db.delete(station)
    await db.commit()
    return {"message": "Station deleted", "id": station_id}


# ============ Facilities ============

@router.get("/facilities", response_model=PaginatedResponse[FacilityAdminOut])
async def list_facilities(
    page: int = Query(1, ge=1),
    page_size: int = Query(20, ge=10, le=100),
    search: Optional[str] = None,
    facility_type: Optional[str] = None,
    is_simulated: Optional[bool] = None,
    sort_by: str = "id",
    sort_order: str = "desc",
    db: AsyncSession = Depends(get_session),
):
    """List monitoring facilities with pagination."""
    query = select(MonitoringFacility).options(
        selectinload(MonitoringFacility.sections))

    # Apply filters
    if search:
        query = query.where(
            or_(
                MonitoringFacility.code.ilike(f"%{search}%"),
                MonitoringFacility.name.ilike(f"%{search}%"),
            )
        )
    if facility_type:
        query = query.where(MonitoringFacility.facility_type == facility_type)
    if is_simulated is not None:
        query = query.where(MonitoringFacility.is_simulated == is_simulated)

    # Count total
    count_query = select(func.count()).select_from(query.subquery())
    total = (await db.execute(count_query)).scalar() or 0

    # Apply sorting
    sort_col = getattr(MonitoringFacility, sort_by, MonitoringFacility.id)
    query = query.order_by(desc(sort_col) if sort_order ==
                           "desc" else asc(sort_col))

    # Apply pagination
    query = query.offset((page - 1) * page_size).limit(page_size)

    result = await db.execute(query)
    facilities = result.scalars().all()

    items = [
        FacilityAdminOut(
            id=f.id,
            code=f.code,
            name=f.name,
            facility_type=f.facility_type,
            location_desc=f.location_desc,
            lng=to_shape(f.location).x if f.location is not None else None,
            lat=to_shape(f.location).y if f.location is not None else None,
            is_simulated=f.is_simulated,
            section_count=len(f.sections) if f.sections else 0,
        )
        for f in facilities
    ]

    return PaginatedResponse(
        items=items,
        total=total,
        page=page,
        page_size=page_size,
        total_pages=(total + page_size - 1) // page_size,
    )


@router.post("/facilities", response_model=FacilityAdminOut)
async def create_facility(
    data: FacilityCreate,
    db: AsyncSession = Depends(get_session),
):
    """Create a new monitoring facility."""
    facility = MonitoringFacility(
        code=data.code,
        name=data.name,
        facility_type=data.facility_type,
        location_desc=data.location_desc,
        is_simulated=data.is_simulated,
    )
    db.add(facility)
    await db.commit()
    await db.refresh(facility)

    return FacilityAdminOut(
        id=facility.id,
        code=facility.code,
        name=facility.name,
        facility_type=facility.facility_type,
        location_desc=facility.location_desc,
        is_simulated=facility.is_simulated,
        section_count=0,
    )


@router.put("/facilities/{facility_id}", response_model=FacilityAdminOut)
async def update_facility(
    facility_id: int,
    data: FacilityUpdate,
    db: AsyncSession = Depends(get_session),
):
    """Update a monitoring facility."""
    result = await db.execute(
        select(MonitoringFacility)
        .options(selectinload(MonitoringFacility.sections))
        .where(MonitoringFacility.id == facility_id)
    )
    facility = result.scalar_one_or_none()
    if not facility:
        raise HTTPException(status_code=404, detail="Facility not found")

    if data.name is not None:
        facility.name = data.name
    if data.facility_type is not None:
        facility.facility_type = data.facility_type
    if data.location_desc is not None:
        facility.location_desc = data.location_desc

    await db.commit()
    await db.refresh(facility)

    return FacilityAdminOut(
        id=facility.id,
        code=facility.code,
        name=facility.name,
        facility_type=facility.facility_type,
        location_desc=facility.location_desc,
        is_simulated=facility.is_simulated,
        section_count=len(facility.sections) if facility.sections else 0,
    )


@router.delete("/facilities/{facility_id}")
async def delete_facility(
    facility_id: int,
    db: AsyncSession = Depends(get_session),
):
    """Delete a monitoring facility."""
    result = await db.execute(
        select(MonitoringFacility).where(MonitoringFacility.id == facility_id)
    )
    facility = result.scalar_one_or_none()
    if not facility:
        raise HTTPException(status_code=404, detail="Facility not found")

    await db.delete(facility)
    await db.commit()
    return {"message": "Facility deleted", "id": facility_id}


# ============ Sections ============

@router.get("/sections", response_model=PaginatedResponse[SectionAdminOut])
async def list_sections(
    page: int = Query(1, ge=1),
    page_size: int = Query(20, ge=10, le=100),
    search: Optional[str] = None,
    facility_id: Optional[int] = None,
    section_type: Optional[str] = None,
    is_simulated: Optional[bool] = None,
    sort_by: str = "id",
    sort_order: str = "desc",
    db: AsyncSession = Depends(get_session),
):
    """List monitoring sections with pagination."""
    query = select(MonitoringSection).options(
        selectinload(MonitoringSection.facility),
        selectinload(MonitoringSection.sensors),
    )

    # Apply filters
    if search:
        query = query.where(
            or_(
                MonitoringSection.code.ilike(f"%{search}%"),
                MonitoringSection.name.ilike(f"%{search}%"),
            )
        )
    if facility_id:
        query = query.where(MonitoringSection.facility_id == facility_id)
    if section_type:
        query = query.where(MonitoringSection.section_type == section_type)
    if is_simulated is not None:
        query = query.where(MonitoringSection.is_simulated == is_simulated)

    # Count total
    count_query = select(func.count()).select_from(query.subquery())
    total = (await db.execute(count_query)).scalar() or 0

    # Apply sorting
    sort_col = getattr(MonitoringSection, sort_by, MonitoringSection.id)
    query = query.order_by(desc(sort_col) if sort_order ==
                           "desc" else asc(sort_col))

    # Apply pagination
    query = query.offset((page - 1) * page_size).limit(page_size)

    result = await db.execute(query)
    sections = result.scalars().all()

    items = [
        SectionAdminOut(
            id=s.id,
            code=s.code,
            name=s.name,
            facility_id=s.facility_id,
            facility_name=s.facility.name if s.facility else None,
            section_type=s.section_type,
            chainage=s.chainage,
            is_simulated=s.is_simulated,
            sensor_count=len(s.sensors) if s.sensors else 0,
        )
        for s in sections
    ]

    return PaginatedResponse(
        items=items,
        total=total,
        page=page,
        page_size=page_size,
        total_pages=(total + page_size - 1) // page_size,
    )


@router.post("/sections", response_model=SectionAdminOut)
async def create_section(
    data: SectionCreate,
    db: AsyncSession = Depends(get_session),
):
    """Create a new monitoring section."""
    section = MonitoringSection(
        code=data.code,
        name=data.name,
        facility_id=data.facility_id,
        section_type=data.section_type,
        chainage=data.chainage,
        is_simulated=data.is_simulated,
    )
    db.add(section)
    await db.commit()
    await db.refresh(section)

    return SectionAdminOut(
        id=section.id,
        code=section.code,
        name=section.name,
        facility_id=section.facility_id,
        section_type=section.section_type,
        chainage=section.chainage,
        is_simulated=section.is_simulated,
        sensor_count=0,
    )


@router.put("/sections/{section_id}", response_model=SectionAdminOut)
async def update_section(
    section_id: int,
    data: SectionUpdate,
    db: AsyncSession = Depends(get_session),
):
    """Update a monitoring section."""
    result = await db.execute(
        select(MonitoringSection)
        .options(selectinload(MonitoringSection.facility), selectinload(MonitoringSection.sensors))
        .where(MonitoringSection.id == section_id)
    )
    section = result.scalar_one_or_none()
    if not section:
        raise HTTPException(status_code=404, detail="Section not found")

    if data.name is not None:
        section.name = data.name
    if data.section_type is not None:
        section.section_type = data.section_type
    if data.chainage is not None:
        section.chainage = data.chainage

    await db.commit()
    await db.refresh(section)

    return SectionAdminOut(
        id=section.id,
        code=section.code,
        name=section.name,
        facility_id=section.facility_id,
        facility_name=section.facility.name if section.facility else None,
        section_type=section.section_type,
        chainage=section.chainage,
        is_simulated=section.is_simulated,
        sensor_count=len(section.sensors) if section.sensors else 0,
    )


@router.delete("/sections/{section_id}")
async def delete_section(
    section_id: int,
    db: AsyncSession = Depends(get_session),
):
    """Delete a monitoring section."""
    result = await db.execute(
        select(MonitoringSection).where(MonitoringSection.id == section_id)
    )
    section = result.scalar_one_or_none()
    if not section:
        raise HTTPException(status_code=404, detail="Section not found")

    await db.delete(section)
    await db.commit()
    return {"message": "Section deleted", "id": section_id}


# ============ Sensor Types (lookup) ============

class SensorTypeOut(BaseModel):
    id: int
    code: str
    name: str
    unit: Optional[str] = None

    class Config:
        from_attributes = True


@router.get("/sensor_types", response_model=list[SensorTypeOut])
async def list_sensor_types(db: AsyncSession = Depends(get_session)):
    """List all sensor types for dropdown/select options."""
    result = await db.execute(select(SensorType).order_by(SensorType.name))
    types = result.scalars().all()
    return [
        SensorTypeOut(id=t.id, code=t.code, name=t.name, unit=t.unit)
        for t in types
    ]
