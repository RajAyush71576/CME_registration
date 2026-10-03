"""events.closed_at, so the report can show when the event actually closed

Revision ID: 0007
Revises: 0006
Create Date: 2026-10-03
"""
from alembic import op
import sqlalchemy as sa

revision = "0007"
down_revision = "0006"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.add_column("events", sa.Column("closed_at", sa.DateTime, nullable=True))


def downgrade() -> None:
    op.drop_column("events", "closed_at")
