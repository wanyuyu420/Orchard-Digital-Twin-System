"""rename batch_id to tree_code and add plot_type

Revision ID: c8a3f2d1b6e4
Revises: 1f2badb4efd8
Create Date: 2026-08-22 00:00:00.000000

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = 'c8a3f2d1b6e4'
down_revision: Union[str, Sequence[str], None] = '1f2badb4efd8'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    """把 batch_id 改名为 tree_code，并新增 plot_type 地块标记字段。"""
    op.drop_index('ix_orange_trees_batch_id', table_name='orange_trees')

    with op.batch_alter_table('orange_trees') as batch_op:
        batch_op.alter_column(
            'batch_id',
            new_column_name='tree_code',
            existing_type=sa.String(),
            existing_nullable=False,
            existing_comment='数据批次标签(如历史示范区或上传时间戳)',
        )
        batch_op.add_column(
            sa.Column(
                'plot_type',
                sa.String(),
                nullable=False,
                server_default='plot1',
                comment='地块类型(plot1=历史老树, plot2=上传新树)',
            )
        )

    op.create_index('ix_orange_trees_tree_code', 'orange_trees', ['tree_code'], unique=False)
    op.create_index('ix_orange_trees_plot_type', 'orange_trees', ['plot_type'], unique=False)


def downgrade() -> None:
    """回滚：删除 plot_type，tree_code 改回 batch_id。"""
    op.drop_index('ix_orange_trees_plot_type', table_name='orange_trees')
    op.drop_index('ix_orange_trees_tree_code', table_name='orange_trees')

    with op.batch_alter_table('orange_trees') as batch_op:
        batch_op.drop_column('plot_type')
        batch_op.alter_column(
            'tree_code',
            new_column_name='batch_id',
            existing_type=sa.String(),
            existing_nullable=False,
        )

    op.create_index('ix_orange_trees_batch_id', 'orange_trees', ['batch_id'], unique=False)
