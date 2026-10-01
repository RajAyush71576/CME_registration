"""drop per-event staff assignment: every staff account can work every event

Revision ID: 0003
Revises: 0002
Create Date: 2026-10-01
"""
from alembic import op
import sqlalchemy as sa

revision = "0003"
down_revision = "0002"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.drop_table("event_staff")


def downgrade() -> None:
    op.create_table(
        "event_staff",
        sa.Column("event_id", sa.String(32), sa.ForeignKey("events.event_id"), primary_key=True),
        sa.Column("user_id", sa.String(32), sa.ForeignKey("users.user_id"), primary_key=True),
    )
