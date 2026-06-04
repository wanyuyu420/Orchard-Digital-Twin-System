from typing import Optional
from sqlalchemy import Integer, ForeignKey, String, Text, Boolean
from sqlalchemy.orm import Mapped, mapped_column
from app.database import Base


class AlertRule(Base):
    __tablename__ = "alert_rules"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    sensor_type_id: Mapped[Optional[int]] = mapped_column(Integer)
    sensor_id: Mapped[Optional[int]] = mapped_column(Integer)
    rule_name: Mapped[str] = mapped_column(String(100), nullable=False)
    rule_type: Mapped[Optional[str]] = mapped_column(String(50))
    warning_threshold: Mapped[Optional[float]] = mapped_column()
    alert_threshold: Mapped[Optional[float]] = mapped_column()
    critical_threshold: Mapped[Optional[float]] = mapped_column()
    rate_threshold: Mapped[Optional[float]] = mapped_column()
    rate_period_hours: Mapped[Optional[int]] = mapped_column()
    enabled: Mapped[bool] = mapped_column(Boolean, default=True)


class Alert(Base):
    __tablename__ = "alerts"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    sensor_id: Mapped[Optional[int]] = mapped_column(Integer)
    reading_id: Mapped[Optional[int]] = mapped_column(Integer)
    rule_id: Mapped[Optional[int]] = mapped_column(Integer)
    alert_level: Mapped[str] = mapped_column(String(20))
    alert_type: Mapped[Optional[str]] = mapped_column(String(50))
    message: Mapped[Optional[str]] = mapped_column(Text)
    value: Mapped[Optional[float]] = mapped_column()
    threshold: Mapped[Optional[float]] = mapped_column()
    status: Mapped[str] = mapped_column(String(20), default="active")
    acknowledged_by: Mapped[Optional[str]] = mapped_column(String(100))
    acknowledged_at: Mapped[Optional[str]] = mapped_column(String(50))
    resolved_at: Mapped[Optional[str]] = mapped_column(String(50))
    is_simulated: Mapped[bool] = mapped_column(Boolean, default=False)
