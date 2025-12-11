from typing import Optional
from sqlalchemy import Integer, String, Text, ForeignKey, Boolean, JSON
from sqlalchemy.orm import Mapped, mapped_column
from app.database import Base
from app.compat import Geometry


class RasterProduct(Base):
    __tablename__ = "raster_products"

    id: Mapped[int] = mapped_column(
        Integer, primary_key=True, autoincrement=True)
    domain: Mapped[Optional[str]] = mapped_column(String(50))
    name: Mapped[Optional[str]] = mapped_column(Text)
    product_type: Mapped[Optional[str]] = mapped_column(String(50))
    path: Mapped[Optional[str]] = mapped_column(Text)
    time_start: Mapped[Optional[str]] = mapped_column(String(50))
    time_end: Mapped[Optional[str]] = mapped_column(String(50))
    bbox: Mapped[Optional[str]] = mapped_column(Geometry("POLYGON", srid=4326))
    crs: Mapped[Optional[str]] = mapped_column(String(50))
    resolution: Mapped[Optional[str]] = mapped_column(String(50))
    meta: Mapped[Optional[dict]] = mapped_column(JSON)
    ingest_file_id: Mapped[Optional[int]] = mapped_column(
        ForeignKey("ingest_files.id"))
    is_simulated: Mapped[bool] = mapped_column(Boolean, default=False)


class VectorProduct(Base):
    __tablename__ = "vector_products"

    id: Mapped[int] = mapped_column(
        Integer, primary_key=True, autoincrement=True)
    domain: Mapped[Optional[str]] = mapped_column(String(50))
    name: Mapped[Optional[str]] = mapped_column(Text)
    product_type: Mapped[Optional[str]] = mapped_column(String(50))
    path: Mapped[Optional[str]] = mapped_column(Text)
    time_start: Mapped[Optional[str]] = mapped_column(String(50))
    time_end: Mapped[Optional[str]] = mapped_column(String(50))
    srid: Mapped[Optional[int]] = mapped_column(Integer)
    bbox: Mapped[Optional[str]] = mapped_column(Geometry("POLYGON", srid=4326))
    meta: Mapped[Optional[dict]] = mapped_column(JSON)
    ingest_file_id: Mapped[Optional[int]] = mapped_column(
        ForeignKey("ingest_files.id"))
    is_simulated: Mapped[bool] = mapped_column(Boolean, default=False)


class ModelProduct(Base):
    __tablename__ = "model_products"

    id: Mapped[int] = mapped_column(
        Integer, primary_key=True, autoincrement=True)
    domain: Mapped[Optional[str]] = mapped_column(String(50))
    name: Mapped[Optional[str]] = mapped_column(Text)
    version: Mapped[Optional[str]] = mapped_column(String(50))
    valid_from: Mapped[Optional[str]] = mapped_column(String(50))
    valid_to: Mapped[Optional[str]] = mapped_column(String(50))
    product_type: Mapped[Optional[str]] = mapped_column(String(50))
    path: Mapped[Optional[str]] = mapped_column(Text)
    meta: Mapped[Optional[dict]] = mapped_column(JSON)
    ingest_file_id: Mapped[Optional[int]] = mapped_column(
        ForeignKey("ingest_files.id"))
    is_simulated: Mapped[bool] = mapped_column(Boolean, default=False)
