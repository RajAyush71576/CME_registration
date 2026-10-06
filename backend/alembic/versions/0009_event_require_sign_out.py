"""events.require_sign_out: when false, sign-in alone marks a participant present

Revision ID: 0009
Revises: 0008
Create Date: 2026-10-06
"""
from alembic import op
import sqlalchemy as sa

revision = "0009"
down_revision = "0008"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.add_column(
        "events",
        sa.Column("require_sign_out", sa.Boolean, nullable=False, server_default=sa.true()),
    )


def downgrade() -> None:
    op.drop_column("events", "require_sign_out")
