"""水文站数据 Schema"""
from datetime import datetime
from typing import Optional
from pydantic import BaseModel


class HydrologicalStationOut(BaseModel):
    """水文站输出"""
    id: int
    station_code: str
    station_name: str
    river_name: Optional[str] = None
    basin_name: Optional[str] = None
    basin_name: Optional[str] = None
    datum_elevation: Optional[float] = None
    lng: Optional[float] = None
    lat: Optional[float] = None
    is_simulated: bool
    # 最新读数
    latest_flow_rate: Optional[float] = None
    latest_velocity: Optional[float] = None
    latest_water_level: Optional[float] = None
    latest_time: Optional[str] = None

    class Config:
        from_attributes = True


class FlowRateOut(BaseModel):
    """流量数据输出"""
    station_id: int
    station_code: str
    station_name: str
    latest_flow_rate: Optional[float] = None
    latest_velocity: Optional[float] = None
    latest_water_level: Optional[float] = None
    unit: Optional[str] = None
    time: Optional[str] = None
    is_simulated: bool

    class Config:
        from_attributes = True


class StationReadingOut(BaseModel):
    """站点历史读数输出"""
    reading_time: datetime
    metric_key: str
    value: Optional[float] = None
    unit: Optional[str] = None

    class Config:
        from_attributes = True


class StationReadingsResponse(BaseModel):
    """站点历史读数响应"""
    station_id: int
    station_code: str
    station_name: str
    readings: list[StationReadingOut]
    total_count: int
