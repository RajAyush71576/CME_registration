"""cme_credits boolean to numeric

Revision ID: c7f2a9b13d84
Revises: a4e5f6feff45
Create Date: 2026-09-15 00:00:00.000000

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = 'c7f2a9b13d84'
down_revision: Union[str, Sequence[str], None] = 'a4e5f6feff45'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    """Upgrade schema."""
    op.alter_column(
        'events',
        'cme_credits',
        type_=sa.Numeric(),
        existing_type=sa.Boolean(),
        postgresql_using="CASE WHEN cme_credits THEN 1 ELSE 0 END",
        nullable=False,
    )


def downgrade() -> None:
    """Downgrade schema."""
    op.alter_column(
        'events',
        'cme_credits',
        type_=sa.Boolean(),
        existing_type=sa.Numeric(),
        postgresql_using="cme_credits <> 0",
        nullable=False,
    )
