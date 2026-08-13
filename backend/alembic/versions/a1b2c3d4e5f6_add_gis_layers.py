"""add gis layers table

Revision ID: a1b2c3d4e5f6
Revises: 3d5b20b9361d
Create Date: 2025-12-23 21:35:00.000000

"""
from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision = 'a1b2c3d4e5f6'
down_revision = 'fbe21847efec'
branch_labels = None
depends_on = None


def upgrade() -> None:
    conn = op.get_bind()
    inspector = sa.inspect(conn)
    if 'gis_layers' not in inspector.get_table_names():
        op.create_table(
        'gis_layers',
        sa.Column('id', sa.Integer(), nullable=False),
        sa.Column('code', sa.String(64), nullable=False),
        sa.Column('name', sa.String(128), nullable=False),
        sa.Column('group_name', sa.String(64), nullable=True),
        sa.Column('layer_type', sa.String(32), nullable=False),
        sa.Column('url', sa.String(512), nullable=True),
        sa.Column('is_visible', sa.Boolean(), default=False),
        sa.Column('is_enabled', sa.Boolean(), default=True),
        sa.Column('icon', sa.String(256), nullable=True),
        sa.Column('config', sa.JSON(), nullable=True),
        sa.Column('order', sa.Integer(), default=0),
        sa.Column('description', sa.Text(), nullable=True),
        sa.PrimaryKeyConstraint('id')
    )
    op.create_index(op.f('ix_gis_layers_code'),
                    'gis_layers', ['code'], unique=True)
    op.create_index(op.f('ix_gis_layers_id'),
                    'gis_layers', ['id'], unique=False)


def downgrade() -> None:
    op.drop_index(op.f('ix_gis_layers_id'), table_name='gis_layers')
    op.drop_index(op.f('ix_gis_layers_code'), table_name='gis_layers')
    op.drop_table('gis_layers')
