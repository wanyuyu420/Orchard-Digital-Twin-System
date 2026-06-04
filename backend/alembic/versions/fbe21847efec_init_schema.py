"""Init schema (creates all ORM tables, PostGIS-safe).

This migration intentionally delegates DDL to SQLAlchemy metadata to keep
alignment with the current ORM models. PostGIS extension is created if
available; missing extension will not block the migration of non-geometry
columns.
"""

from alembic import op
import sqlalchemy as sa
from app.database import Base
from app import models  # noqa: F401

# revision identifiers, used by Alembic.
revision: str = "fbe21847efec"
down_revision = None
branch_labels = None
depends_on = None


def upgrade() -> None:
    bind = op.get_bind()
    try:
        bind.execute(sa.text("CREATE EXTENSION IF NOT EXISTS postgis"))
    except Exception:
        # PostGIS might be unavailable; continue so non-geometry tables are created
        pass
    Base.metadata.create_all(bind=bind)


def downgrade() -> None:
    bind = op.get_bind()
    Base.metadata.drop_all(bind=bind)
