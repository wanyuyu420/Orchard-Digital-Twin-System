"""
Geometry type compatibility layer for SQLite and PostgreSQL+PostGIS.
When using SQLite, geometry fields degrade to TEXT (storing WKT).
When using PostgreSQL, native PostGIS geometry types are used.
"""
from sqlalchemy import Text
from app.config import get_settings

settings = get_settings()

if settings.is_sqlite:
    # SQLite: Use TEXT to store WKT strings
    def Geometry(geometry_type: str, srid: int = 4326):
        """Fallback Geometry type for SQLite - stores as WKT text."""
        return Text
else:
    # PostgreSQL: Use native PostGIS geometry
    from geoalchemy2 import Geometry as PostGISGeometry
    Geometry = PostGISGeometry
