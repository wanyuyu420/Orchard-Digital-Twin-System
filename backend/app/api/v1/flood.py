"""Flood visualization API endpoints."""
from typing import Optional
from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy import select, func
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload
from geoalchemy2.shape import to_shape
from shapely.geometry import mapping

from app.database import get_session
from app.models import FloodScenario, FloodFrame
from app.schemas.flood import (
    FloodScenarioOut,
    FloodScenarioDetailOut,
    FloodFrameOut,
)

router = APIRouter()


def _frame_to_out(frame: FloodFrame) -> FloodFrameOut:
    """Convert FloodFrame model to output schema."""
    polygons_geojson = None
    if frame.polygons is not None:
        try:
            shape = to_shape(frame.polygons)
            polygons_geojson = mapping(shape)
        except Exception:
            pass
    return FloodFrameOut(
        id=frame.id,
        time_step=frame.time_step,
        water_level=frame.water_level,
        area_km2=frame.area_km2,
        polygons=polygons_geojson,
    )


@router.get("/scenarios", response_model=list[FloodScenarioOut])
async def list_scenarios(session: AsyncSession = Depends(get_session)):
    """获取所有洪水情景列表"""
    stmt = (
        select(
            FloodScenario,
            func.count(FloodFrame.id).label("frame_count")
        )
        .outerjoin(FloodFrame)
        .group_by(FloodScenario.id)
        .order_by(FloodScenario.created_at.desc())
    )
    result = await session.execute(stmt)
    scenarios = []
    for row in result.all():
        scenario = row[0]
        frame_count = row[1]
        scenarios.append(
            FloodScenarioOut(
                id=scenario.id,
                code=scenario.code,
                name=scenario.name,
                region_extent=scenario.region_extent,
                description=scenario.description,
                created_at=scenario.created_at,
                frame_count=frame_count,
            )
        )
    return scenarios


@router.get("/scenarios/{scenario_id}", response_model=FloodScenarioDetailOut)
async def get_scenario(
    scenario_id: int,
    session: AsyncSession = Depends(get_session)
):
    """获取洪水情景详情（含所有帧）"""
    stmt = (
        select(FloodScenario)
        .options(selectinload(FloodScenario.frames))
        .where(FloodScenario.id == scenario_id)
    )
    result = await session.execute(stmt)
    scenario = result.scalar_one_or_none()

    if scenario is None:
        raise HTTPException(status_code=404, detail="Scenario not found")

    # Parse region center
    center_lng, center_lat = None, None
    if scenario.region_center is not None:
        try:
            center = to_shape(scenario.region_center)
            center_lng, center_lat = center.x, center.y
        except Exception:
            pass

    return FloodScenarioDetailOut(
        id=scenario.id,
        code=scenario.code,
        name=scenario.name,
        region_extent=scenario.region_extent,
        description=scenario.description,
        created_at=scenario.created_at,
        frame_count=len(scenario.frames),
        region_center_lng=center_lng,
        region_center_lat=center_lat,
        frames=[_frame_to_out(f) for f in scenario.frames],
    )


@router.get("/scenarios/{scenario_id}/frame", response_model=FloodFrameOut)
async def get_interpolated_frame(
    scenario_id: int,
    progress: float = 50.0,
    session: AsyncSession = Depends(get_session)
):
    """根据进度获取插值后的洪水帧（用于实时动画）"""
    # Clamp progress to 0-100
    progress = max(0.0, min(100.0, progress))

    # Get frames for scenario
    stmt = (
        select(FloodFrame)
        .where(FloodFrame.scenario_id == scenario_id)
        .order_by(FloodFrame.time_step)
    )
    result = await session.execute(stmt)
    frames = result.scalars().all()

    if not frames:
        raise HTTPException(
            status_code=404, detail="No frames found for scenario")

    # Find the two frames to interpolate between
    prev_frame = frames[0]
    next_frame = frames[-1]

    for i, frame in enumerate(frames):
        if frame.time_step <= progress:
            prev_frame = frame
            next_frame = frames[min(i + 1, len(frames) - 1)]
        else:
            break

    # If exact match or at boundaries, return the frame directly
    if prev_frame.time_step == progress or prev_frame == next_frame:
        return _frame_to_out(prev_frame)

    # Linear interpolation for water_level and area
    t = (progress - prev_frame.time_step) / \
        (next_frame.time_step - prev_frame.time_step)
    water_level = prev_frame.water_level + t * \
        (next_frame.water_level - prev_frame.water_level)
    area_km2 = prev_frame.area_km2 + t * \
        (next_frame.area_km2 - prev_frame.area_km2)

    # For polygons, use the previous frame (no geometric interpolation)
    polygons_geojson = None
    if prev_frame.polygons is not None:
        try:
            shape = to_shape(prev_frame.polygons)
            polygons_geojson = mapping(shape)
        except Exception:
            pass

    return FloodFrameOut(
        id=prev_frame.id,
        time_step=int(progress),
        water_level=round(water_level, 2),
        area_km2=round(area_km2, 3),
        polygons=polygons_geojson,
    )
