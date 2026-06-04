from datetime import datetime
from typing import Optional, Any
from pydantic import BaseModel


class SensorOut(BaseModel):
    id: int
    code: str
    section_id: int
    sensor_type_id: Optional[int] = None
    is_simulated: bool
    lng: Optional[float] = None
    lat: Optional[float] = None


class SensorMetricOut(BaseModel):
    id: int
    metric_key: str
    name_cn: Optional[str] = None
    unit: Optional[str] = None
    warn_low: Optional[float] = None
    warn_high: Optional[float] = None
    is_simulated: bool


class SensorReadingOut(BaseModel):
    id: int
    sensor_id: int
    metric_id: int
    reading_time: Optional[datetime] = None
    value_num: Optional[float] = None
    unit: Optional[str] = None
    is_simulated: bool

    class Config:
        json_encoders = {datetime: lambda v: v.isoformat() if v else None}


class ProductOut(BaseModel):
    id: int
    domain: Optional[str] = None
    name: Optional[str] = None
    version: Optional[str] = None
    valid_from: Optional[str] = None
    valid_to: Optional[str] = None
    product_type: Optional[str] = None
    path: Optional[str] = None
    meta: Optional[Any] = None
    is_simulated: bool
