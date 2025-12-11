from typing import Optional
from sqlalchemy import String, Integer, Text, UniqueConstraint, Boolean, Float, ForeignKey
from sqlalchemy.orm import Mapped, mapped_column, relationship
from app.database import Base
from app.compat import Geometry


class MonitoringFacility(Base):
    __tablename__ = "monitoring_facilities"

    id: Mapped[int] = mapped_column(
        Integer, primary_key=True, autoincrement=True)
    code: Mapped[str] = mapped_column(String(50), unique=True, nullable=False)
    name: Mapped[str] = mapped_column(String(200), nullable=False)
    facility_type: Mapped[Optional[str]] = mapped_column(String(50))
    location: Mapped[Optional[str]] = mapped_column(
        Geometry("POINT", srid=4326))
    location_desc: Mapped[Optional[str]] = mapped_column(Text)
    is_simulated: Mapped[bool] = mapped_column(Boolean, default=False)

    sections: Mapped[list["MonitoringSection"]
                     ] = relationship(back_populates="facility")
    hydrological_stations: Mapped[list["HydrologicalStation"]] = relationship(
        back_populates="facility")


class MonitoringSection(Base):
    __tablename__ = "monitoring_sections"
    __table_args__ = (UniqueConstraint("facility_id", "code",
                      name="uq_sections_facility_code"),)

    id: Mapped[int] = mapped_column(
        Integer, primary_key=True, autoincrement=True)
    facility_id: Mapped[int] = mapped_column(
        ForeignKey("monitoring_facilities.id"), nullable=False)
    code: Mapped[str] = mapped_column(String(50), nullable=False)
    name: Mapped[str] = mapped_column(String(200), nullable=False)
    section_type: Mapped[Optional[str]] = mapped_column(String(50))
    chainage: Mapped[Optional[str]] = mapped_column(String(100))
    is_simulated: Mapped[bool] = mapped_column(default=False)

    facility: Mapped["MonitoringFacility"] = relationship(
        back_populates="sections")
    sensors: Mapped[list["Sensor"]] = relationship(back_populates="section")


class SensorType(Base):
    __tablename__ = "sensor_types"

    id: Mapped[int] = mapped_column(
        Integer, primary_key=True, autoincrement=True)
    code: Mapped[str] = mapped_column(String(50), unique=True, nullable=False)
    name: Mapped[str] = mapped_column(String(100), nullable=False)
    unit: Mapped[Optional[str]] = mapped_column(String(50))
    prefix_pattern: Mapped[Optional[str]] = mapped_column(String(50))
    description: Mapped[Optional[str]] = mapped_column(Text)
    is_simulated: Mapped[bool] = mapped_column(default=False)

    sensors: Mapped[list["Sensor"]] = relationship(
        back_populates="sensor_type")


class ChainageCoordinate(Base):
    __tablename__ = "chainage_coordinates"
    __table_args__ = (
        UniqueConstraint(
            "facility_id",
            "chainage_normalized",
            "lateral_offset_dir",
            "lateral_offset_m",
            "elevation",
            name="uq_chainage_facility_norm",
        ),
    )

    id: Mapped[int] = mapped_column(
        Integer, primary_key=True, autoincrement=True)
    facility_id: Mapped[int] = mapped_column(Integer, nullable=False)
    chainage_raw: Mapped[str] = mapped_column(String(200))
    chainage_normalized: Mapped[Optional[str]] = mapped_column(String(100))
    chainage_value: Mapped[Optional[float]] = mapped_column(Float)
    chainage_direction: Mapped[Optional[str]] = mapped_column(String(20))
    lateral_offset_dir: Mapped[Optional[str]] = mapped_column(String(10))
    lateral_offset_m: Mapped[Optional[float]] = mapped_column(Float)
    location_desc: Mapped[Optional[str]] = mapped_column(Text)
    elevation: Mapped[Optional[float]] = mapped_column(Float)
    location: Mapped[Optional[str]] = mapped_column(
        Geometry("POINT", srid=4326))
    location_source: Mapped[Optional[str]] = mapped_column(String(50))
    is_simulated: Mapped[bool] = mapped_column(Boolean, default=False)

    sensors: Mapped[list["Sensor"]] = relationship(back_populates="chainage")
