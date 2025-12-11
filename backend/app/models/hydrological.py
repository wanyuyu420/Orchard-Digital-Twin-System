from typing import Optional
from sqlalchemy import String, Integer, ForeignKey, Text, Float, Boolean, UniqueConstraint
from sqlalchemy.orm import Mapped, mapped_column, relationship
from app.database import Base
from app.compat import Geometry


class HydrologicalStation(Base):
    """水文站实体，用于管理水文监测站及其断面几何"""
    __tablename__ = "hydrological_stations"

    id: Mapped[int] = mapped_column(
        Integer, primary_key=True, autoincrement=True)
    facility_id: Mapped[int] = mapped_column(
        ForeignKey("monitoring_facilities.id"), nullable=False)
    station_code: Mapped[str] = mapped_column(
        String(50), unique=True, nullable=False)
    station_name: Mapped[str] = mapped_column(String(200), nullable=False)
    river_name: Mapped[Optional[str]] = mapped_column(String(200))
    basin_name: Mapped[Optional[str]] = mapped_column(String(200))
    # 断面几何: LINESTRINGZ, CGCS2000 3度带45区 (EPSG:4549)
    cross_section: Mapped[Optional[str]] = mapped_column(
        Geometry("LINESTRINGZ", srid=4549))
    # 站点坐标 (WGS84)
    location: Mapped[Optional[str]] = mapped_column(
        Geometry("POINT", srid=4326))
    datum_elevation: Mapped[Optional[float]] = mapped_column(Float)
    description: Mapped[Optional[str]] = mapped_column(Text)
    is_simulated: Mapped[bool] = mapped_column(Boolean, default=False)

    facility: Mapped["MonitoringFacility"] = relationship(
        back_populates="hydrological_stations")
    sensors: Mapped[list["Sensor"]] = relationship(
        back_populates="hydrological_station")
