from typing import Optional
from datetime import datetime
from sqlalchemy import Integer, ForeignKey, String, Text, UniqueConstraint, Boolean, JSON, DateTime
from sqlalchemy.orm import Mapped, mapped_column, relationship
from app.database import Base


class SensorReading(Base):
    __tablename__ = "sensor_readings"
    __table_args__ = (
        UniqueConstraint("metric_id", "reading_time", "source_file_id", name="uq_readings_metric_time_file"),
    )

    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    sensor_id: Mapped[int] = mapped_column(ForeignKey("sensors.id"), nullable=False)
    metric_id: Mapped[int] = mapped_column(ForeignKey("sensor_metrics.id"), nullable=False)
    reading_time: Mapped[datetime] = mapped_column(DateTime, nullable=False)
    value_num: Mapped[Optional[float]] = mapped_column()
    value_text: Mapped[Optional[str]] = mapped_column(Text)
    unit: Mapped[Optional[str]] = mapped_column(String(50))
    raw_values: Mapped[Optional[dict]] = mapped_column(JSON)
    quality_flag: Mapped[str] = mapped_column(String(20), default="normal")
    remark: Mapped[Optional[str]] = mapped_column(Text)
    source_file_id: Mapped[Optional[int]] = mapped_column(ForeignKey("ingest_files.id"))
    is_simulated: Mapped[bool] = mapped_column(Boolean, default=False)

    sensor: Mapped["Sensor"] = relationship(back_populates="readings")
    metric: Mapped["SensorMetric"] = relationship(back_populates="readings")
