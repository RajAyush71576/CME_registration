"""approx duration: minute precision, zero allowed

Revision ID: 0004
Revises: 0003
Create Date: 2026-10-01
"""
from alembic import op
import sqlalchemy as sa

revision = "0004"
down_revision = "0003"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.alter_column("events", "approx_duration_hours", existing_type=sa.Numeric(6, 2),
                    type_=sa.Numeric(8, 4), existing_nullable=False)


def downgrade() -> None:
    op.alter_column("events", "approx_duration_hours", existing_type=sa.Numeric(8, 4),
                    type_=sa.Numeric(6, 2), existing_nullable=False)
