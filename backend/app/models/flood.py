"""
Flood visualization models for storing simulation scenarios and frames.
"""
from datetime import datetime
from typing import Optional
from sqlalchemy import String, Integer, ForeignKey, Text, Float, DateTime
from sqlalchemy.orm import Mapped, mapped_column, relationship
from geoalchemy2 import Geometry
from app.database import Base


class FloodScenario(Base):
    """洪水情景配置 - 存储模拟场景的元信息"""
    __tablename__ = "flood_scenarios"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    code: Mapped[str] = mapped_column(String(50), unique=True, nullable=False)
    name: Mapped[str] = mapped_column(String(200), nullable=False)
    # 区域中心点 (WGS84)
    region_center: Mapped[Optional[str]] = mapped_column(Geometry("POINT", srid=4326))
    # 区域范围 (km)
    region_extent: Mapped[Optional[float]] = mapped_column(Float)
    description: Mapped[Optional[str]] = mapped_column(Text)
    created_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow)

    # Relationships
    frames: Mapped[list["FloodFrame"]] = relationship(
        back_populates="scenario", 
        cascade="all, delete-orphan",
        order_by="FloodFrame.time_step"
    )


class FloodFrame(Base):
    """洪水帧数据 - 时间步对应的淹没状态"""
    __tablename__ = "flood_frames"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    scenario_id: Mapped[int] = mapped_column(ForeignKey("flood_scenarios.id"), nullable=False)
    # 时间步 0-100 (对应 TimelineControl 的 progress)
    time_step: Mapped[int] = mapped_column(Integer, nullable=False)
    # 水位高度 (m)
    water_level: Mapped[float] = mapped_column(Float, nullable=False)
    # 淹没面积 (km²)
    area_km2: Mapped[float] = mapped_column(Float, nullable=False)
    # 淹没区域多边形 (WGS84 多多边形)
    polygons: Mapped[Optional[str]] = mapped_column(Geometry("MULTIPOLYGON", srid=4326))

    # Relationships
    scenario: Mapped["FloodScenario"] = relationship(back_populates="frames")
