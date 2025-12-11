from typing import Optional
from datetime import date
from sqlalchemy import (
    String,
    Integer,
    ForeignKey,
    Text,
    UniqueConstraint,
    Boolean,
    Date,
    Float,
    JSON,
)
from sqlalchemy.orm import Mapped, mapped_column, relationship
from app.database import Base
from app.compat import Geometry


class Sensor(Base):
    __tablename__ = "sensors"
    __table_args__ = (UniqueConstraint(
        "section_id", "point_code", name="uq_sensors_section_point"),)

    id: Mapped[int] = mapped_column(
        Integer, primary_key=True, autoincrement=True)
    section_id: Mapped[int] = mapped_column(
        ForeignKey("monitoring_sections.id"), nullable=False)
    sensor_type_id: Mapped[int] = mapped_column(
        ForeignKey("sensor_types.id"), nullable=False)
    chainage_id: Mapped[Optional[int]] = mapped_column(
        ForeignKey("chainage_coordinates.id"))
    hydrological_station_id: Mapped[Optional[int]] = mapped_column(
        ForeignKey("hydrological_stations.id"))

    point_code: Mapped[str] = mapped_column(String(50), nullable=False)
    factory_code: Mapped[Optional[str]] = mapped_column(String(100))
    install_chainage_raw: Mapped[Optional[str]] = mapped_column(String(200))
    install_elevation: Mapped[Optional[float]] = mapped_column(Float)
    install_date: Mapped[Optional[date]] = mapped_column(Date)
    install_location_desc: Mapped[Optional[str]] = mapped_column(Text)
    instrument_model: Mapped[Optional[str]] = mapped_column(String(100))
    instrument_manufacturer: Mapped[Optional[str]] = mapped_column(String(100))
    reading_device: Mapped[Optional[str]] = mapped_column(String(100))
    parameters: Mapped[Optional[dict]] = mapped_column(JSON)
    status: Mapped[str] = mapped_column(String(20), default="active")
    source_file: Mapped[Optional[str]] = mapped_column(String(500))
    location: Mapped[Optional[str]] = mapped_column(
        Geometry("POINT", srid=4326))
    is_simulated: Mapped[bool] = mapped_column(Boolean, default=False)

    section: Mapped["MonitoringSection"] = relationship(
        back_populates="sensors")
    sensor_type: Mapped["SensorType"] = relationship(back_populates="sensors")
    chainage: Mapped["ChainageCoordinate"] = relationship(
        back_populates="sensors")
    hydrological_station: Mapped[Optional["HydrologicalStation"]] = relationship(
        back_populates="sensors")
    metrics: Mapped[list["SensorMetric"]] = relationship(
        back_populates="sensor", cascade="all, delete-orphan")
    readings: Mapped[list["SensorReading"]] = relationship(
        back_populates="sensor", cascade="all, delete-orphan")
    ingest_files: Mapped[list["IngestFile"]] = relationship(
        back_populates="sensor", cascade="all, delete-orphan")


class SensorMetric(Base):
    __tablename__ = "sensor_metrics"
    __table_args__ = (UniqueConstraint(
        "sensor_id", "metric_key", name="uq_sensor_metric_key"),)

    id: Mapped[int] = mapped_column(
        Integer, primary_key=True, autoincrement=True)
    sensor_id: Mapped[int] = mapped_column(
        ForeignKey("sensors.id"), nullable=False)
    metric_key: Mapped[str] = mapped_column(String(50), nullable=False)
    name_cn: Mapped[Optional[str]] = mapped_column(String(100))
    unit: Mapped[Optional[str]] = mapped_column(String(50))
    data_type: Mapped[str] = mapped_column(String(20), default="number")
    warn_low: Mapped[Optional[float]] = mapped_column(Float)
    warn_high: Mapped[Optional[float]] = mapped_column(Float)
    is_simulated: Mapped[bool] = mapped_column(Boolean, default=False)

    sensor: Mapped["Sensor"] = relationship(back_populates="metrics")
    readings: Mapped[list["SensorReading"]] = relationship(
        back_populates="metric", cascade="all, delete-orphan")


class IngestFile(Base):
    __tablename__ = "ingest_files"
    __table_args__ = (UniqueConstraint(
        "sensor_id", "checksum", name="uq_ingest_checksum"),)

    id: Mapped[int] = mapped_column(
        Integer, primary_key=True, autoincrement=True)
    sensor_id: Mapped[Optional[int]] = mapped_column(ForeignKey("sensors.id"))
    path: Mapped[str] = mapped_column(String, nullable=False)
    sheet: Mapped[Optional[str]] = mapped_column(String(100))
    checksum: Mapped[Optional[str]] = mapped_column(String(128))
    file_mtime: Mapped[Optional[str]] = mapped_column(String(50))
    rows_imported: Mapped[Optional[int]] = mapped_column(Integer)
    status: Mapped[str] = mapped_column(String(20), default="success")
    message: Mapped[Optional[str]] = mapped_column(Text)
    is_simulated: Mapped[bool] = mapped_column(Boolean, default=False)

    sensor: Mapped[Optional["Sensor"]] = relationship(
        back_populates="ingest_files")


class SimulatedDevice(Base):
    __tablename__ = "simulated_devices"

    id: Mapped[int] = mapped_column(
        Integer, primary_key=True, autoincrement=True)
    device_id: Mapped[str] = mapped_column(String(50), unique=True)
    name: Mapped[str] = mapped_column(String(200))
    protocol: Mapped[Optional[str]] = mapped_column(String(50))
    station_id: Mapped[Optional[str]] = mapped_column(String(50))
    metrics: Mapped[Optional[list]] = mapped_column(JSON)
    freq_sec: Mapped[Optional[int]] = mapped_column(Integer)
    status: Mapped[Optional[str]] = mapped_column(String(20))
    is_simulated: Mapped[bool] = mapped_column(Boolean, default=True)
