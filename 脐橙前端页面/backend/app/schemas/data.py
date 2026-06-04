from datetime import datetime
from typing import Optional
from pydantic import BaseModel


class WaterLevelOut(BaseModel):
    sensor_id: int
    station_name: str
    latest_level: Optional[float] = None
    unit: Optional[str] = None
    time: Optional[str] = None
    is_simulated: bool


class RainfallOut(BaseModel):
    sensor_id: int
    station_name: str
    latest_rainfall: Optional[float] = None
    unit: Optional[str] = None
    time: Optional[str] = None
    is_simulated: bool


class StatsOut(BaseModel):
    online_devices: int
    total_devices: int
    today_alerts: int
    reservoir_capacity_percent: float
    average_rainfall_mm: float


class WarningOut(BaseModel):
    sensor_id: Optional[int] = None
    metric: str
    level: str
    message: str
    time: Optional[str] = None
    is_simulated: bool


class MetricLatestOut(BaseModel):
    sensor_id: int
    station_name: str
    metric: str
    value: Optional[float] = None
    unit: Optional[str] = None
    time: Optional[str] = None
    is_simulated: bool
