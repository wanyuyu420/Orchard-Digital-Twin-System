"""
GIS Layer Model - Data-driven layer configuration
"""
from sqlalchemy import Column, Integer, String, Boolean, Text, JSON
from app.database import Base


class GISLayer(Base):
    """GIS图层配置模型"""
    __tablename__ = "gis_layers"

    id = Column(Integer, primary_key=True, index=True)
    code = Column(String(64), unique=True, nullable=False, index=True)
    name = Column(String(128), nullable=False)
    # e.g., "Sensors", "Base", "Facilities"
    group_name = Column(String(64), nullable=True)
    # '3dtiles', 'api_point', 'wms', 'geojson'
    layer_type = Column(String(32), nullable=False)
    url = Column(String(512), nullable=True)  # Data source URL
    is_visible = Column(Boolean, default=False)  # Default visibility
    is_enabled = Column(Boolean, default=True)  # Whether layer is available
    icon = Column(String(256), nullable=True)  # Icon path for UI
    config = Column(JSON, nullable=True)  # Flexible JSON config
    order = Column(Integer, default=0)  # Display order
    description = Column(Text, nullable=True)

    def __repr__(self):
        return f"<GISLayer {self.code}: {self.name}>"
