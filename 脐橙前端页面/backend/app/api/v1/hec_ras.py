"""
HEC-RAS API endpoints for simulation scenarios.
"""
from typing import List, Optional
from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession
from pydantic import BaseModel

from app.database import get_session
from app.models.hec_ras import HecRasScenario

router = APIRouter(prefix="/hec-ras", tags=["hec-ras"])


# ============ Schemas ============

class HecRasExtent(BaseModel):
    """Geographic extent"""
    west: float
    south: float
    east: float
    north: float


class HecRasCameraConfig(BaseModel):
    """Camera configuration"""
    height: float
    heading: float
    pitch: float


class HecRasLegendConfig(BaseModel):
    """Legend configuration"""
    title: Optional[str] = None
    min: Optional[float] = None
    max: Optional[float] = None


class HecRasScenarioOut(BaseModel):
    """Scenario output schema"""
    id: int
    code: str
    name: str
    description: Optional[str] = None
    extent: HecRasExtent
    camera: HecRasCameraConfig
    frames_path: str
    stats_path: Optional[str] = None
    total_frames: int
    frame_extension: str
    legend: HecRasLegendConfig
    is_enabled: bool

    class Config:
        from_attributes = True


class HecRasScenarioListItem(BaseModel):
    """Simplified scenario for list view"""
    id: int
    code: str
    name: str
    total_frames: int
    is_enabled: bool

    class Config:
        from_attributes = True


# ============ Helpers ============

def _scenario_to_out(scenario: HecRasScenario) -> HecRasScenarioOut:
    """Convert model to output schema"""
    return HecRasScenarioOut(
        id=scenario.id,
        code=scenario.code,
        name=scenario.name,
        description=scenario.description,
        extent=HecRasExtent(
            west=scenario.extent_west,
            south=scenario.extent_south,
            east=scenario.extent_east,
            north=scenario.extent_north,
        ),
        camera=HecRasCameraConfig(
            height=scenario.camera_height,
            heading=scenario.camera_heading,
            pitch=scenario.camera_pitch,
        ),
        frames_path=scenario.frames_path,
        stats_path=scenario.stats_path,
        total_frames=scenario.total_frames,
        frame_extension=scenario.frame_extension,
        legend=HecRasLegendConfig(
            title=scenario.legend_title,
            min=scenario.legend_min,
            max=scenario.legend_max,
        ),
        is_enabled=scenario.is_enabled,
    )


# ============ Endpoints ============

@router.get("/scenarios", response_model=List[HecRasScenarioListItem])
async def list_scenarios(
    enabled_only: bool = True,
    db: AsyncSession = Depends(get_session),
):
    """Get all HEC-RAS scenarios"""
    query = select(HecRasScenario).order_by(HecRasScenario.id)
    if enabled_only:
        query = query.where(HecRasScenario.is_enabled == True)

    result = await db.execute(query)
    scenarios = result.scalars().all()
    return scenarios


@router.get("/scenarios/{scenario_id}", response_model=HecRasScenarioOut)
async def get_scenario(
    scenario_id: int,
    db: AsyncSession = Depends(get_session),
):
    """Get a specific HEC-RAS scenario by ID"""
    result = await db.execute(
        select(HecRasScenario).where(HecRasScenario.id == scenario_id)
    )
    scenario = result.scalar_one_or_none()

    if not scenario:
        raise HTTPException(status_code=404, detail="Scenario not found")

    return _scenario_to_out(scenario)


@router.get("/scenarios/code/{code}", response_model=HecRasScenarioOut)
async def get_scenario_by_code(
    code: str,
    db: AsyncSession = Depends(get_session),
):
    """Get a specific HEC-RAS scenario by code"""
    result = await db.execute(
        select(HecRasScenario).where(HecRasScenario.code == code)
    )
    scenario = result.scalar_one_or_none()

    if not scenario:
        raise HTTPException(status_code=404, detail="Scenario not found")

    return _scenario_to_out(scenario)
