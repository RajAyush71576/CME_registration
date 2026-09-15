"""add event start_time

Revision ID: d1e4b6a9f210
Revises: c7f2a9b13d84
Create Date: 2026-09-15 00:00:00.000000

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = 'd1e4b6a9f210'
down_revision: Union[str, Sequence[str], None] = 'c7f2a9b13d84'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    """Upgrade schema."""
    op.add_column(
        'events',
        sa.Column('start_time', sa.Time(), nullable=False, server_default='09:00:00'),
    )


def downgrade() -> None:
    """Downgrade schema."""
    op.drop_column('events', 'start_time')
