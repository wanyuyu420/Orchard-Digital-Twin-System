"""Flood visualization Pydantic schemas."""
from datetime import datetime
from typing import Optional, Any
from pydantic import BaseModel


class FloodFrameOut(BaseModel):
    """洪水帧输出"""
    id: int
    time_step: int
    water_level: float
    area_km2: float
    # GeoJSON 格式的多边形
    polygons: Optional[dict[str, Any]] = None

    class Config:
        from_attributes = True


class FloodScenarioOut(BaseModel):
    """洪水情景输出 (列表用)"""
    id: int
    code: str
    name: str
    region_extent: Optional[float] = None
    description: Optional[str] = None
    created_at: datetime
    frame_count: int = 0

    class Config:
        from_attributes = True


class FloodScenarioDetailOut(FloodScenarioOut):
    """洪水情景详细输出 (含帧数据)"""
    region_center_lng: Optional[float] = None
    region_center_lat: Optional[float] = None
    frames: list[FloodFrameOut] = []


class FloodScenarioCreate(BaseModel):
    """创建洪水情景"""
    code: str
    name: str
    region_center_lng: Optional[float] = None
    region_center_lat: Optional[float] = None
    region_extent: Optional[float] = None
    description: Optional[str] = None


class FloodFrameCreate(BaseModel):
    """创建洪水帧"""
    time_step: int
    water_level: float
    area_km2: float
    # GeoJSON 格式的多边形坐标
    polygons: Optional[dict[str, Any]] = None
