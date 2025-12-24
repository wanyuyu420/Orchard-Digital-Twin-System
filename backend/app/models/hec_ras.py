"""
HEC-RAS Scenario Models
Stores simulation scenario configurations and metadata.
"""
from datetime import datetime
from typing import Optional
from sqlalchemy import String, Integer, Boolean, Text, Float, DateTime, JSON
from sqlalchemy.orm import Mapped, mapped_column
from app.database import Base


class HecRasScenario(Base):
    """HEC-RAS 仿真场景配置"""
    __tablename__ = "hec_ras_scenarios"

    id: Mapped[int] = mapped_column(
        Integer, primary_key=True, autoincrement=True)
    code: Mapped[str] = mapped_column(
        String(50), unique=True, nullable=False, index=True)
    name: Mapped[str] = mapped_column(String(200), nullable=False)
    description: Mapped[Optional[str]] = mapped_column(Text, nullable=True)

    # Geographic extent (WGS84)
    extent_west: Mapped[float] = mapped_column(Float, nullable=False)
    extent_south: Mapped[float] = mapped_column(Float, nullable=False)
    extent_east: Mapped[float] = mapped_column(Float, nullable=False)
    extent_north: Mapped[float] = mapped_column(Float, nullable=False)

    # Camera settings
    camera_height: Mapped[float] = mapped_column(Float, default=150000)
    camera_heading: Mapped[float] = mapped_column(Float, default=0)
    camera_pitch: Mapped[float] = mapped_column(Float, default=-90)

    # Data paths (relative to /simulation/ endpoint)
    frames_path: Mapped[str] = mapped_column(
        String(512), nullable=False)  # e.g., "/hec-ras/kb/frames"
    stats_path: Mapped[str] = mapped_column(
        String(512), nullable=True)    # e.g., "/hec-ras/kb/stats.json"

    # Frame metadata
    total_frames: Mapped[int] = mapped_column(Integer, default=0)
    frame_extension: Mapped[str] = mapped_column(String(10), default="webp")

    # Legend configuration
    legend_title: Mapped[Optional[str]] = mapped_column(
        String(100), nullable=True)
    legend_min: Mapped[Optional[float]] = mapped_column(Float, nullable=True)
    legend_max: Mapped[Optional[float]] = mapped_column(Float, nullable=True)

    # Status
    is_enabled: Mapped[bool] = mapped_column(Boolean, default=True)
    created_at: Mapped[datetime] = mapped_column(
        DateTime, default=datetime.utcnow)

    def __repr__(self):
        return f"<HecRasScenario {self.code}: {self.name}>"
