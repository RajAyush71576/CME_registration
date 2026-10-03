"""registrations.manual_status: Faculty-only present/absent call that bypasses sign-in/out

Revision ID: 0008
Revises: 0007
Create Date: 2026-10-03
"""
from alembic import op
import sqlalchemy as sa

revision = "0008"
down_revision = "0007"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.add_column("registrations", sa.Column("manual_status", sa.String(10), nullable=True))
    op.add_column("registrations", sa.Column("manual_status_by", sa.String(32), sa.ForeignKey("users.user_id")))
    op.add_column("registrations", sa.Column("manual_status_at", sa.DateTime, nullable=True))


def downgrade() -> None:
    fk = next(
        f["name"] for f in sa.inspect(op.get_bind()).get_foreign_keys("registrations")
        if f["constrained_columns"] == ["manual_status_by"]
    )
    op.drop_constraint(fk, "registrations", type_="foreignkey")
    op.drop_column("registrations", "manual_status_at")
    op.drop_column("registrations", "manual_status_by")
    op.drop_column("registrations", "manual_status")
