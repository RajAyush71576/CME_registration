"""staff accounts: active flag, event assignments, who-did-what columns

Revision ID: 0002
Revises: 0001
Create Date: 2026-09-30
"""
from alembic import op
import sqlalchemy as sa

revision = "0002"
down_revision = "0001"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.add_column("users", sa.Column("is_active", sa.Boolean, nullable=False, server_default=sa.text("true")))
    op.create_table(
        "event_staff",
        sa.Column("event_id", sa.String(32), sa.ForeignKey("events.event_id"), primary_key=True),
        sa.Column("user_id", sa.String(32), sa.ForeignKey("users.user_id"), primary_key=True),
    )
    op.add_column("registrations", sa.Column("registered_by", sa.String(32), sa.ForeignKey("users.user_id")))
    op.add_column("attendance", sa.Column("signed_in_by", sa.String(32), sa.ForeignKey("users.user_id")))
    op.add_column("attendance", sa.Column("signed_out_by", sa.String(32), sa.ForeignKey("users.user_id")))
    # Before this revision every staff account could work every event; keep that for existing data.
    op.execute(
        "INSERT INTO event_staff (event_id, user_id) "
        "SELECT e.event_id, u.user_id FROM events e CROSS JOIN users u WHERE u.role = 'staff'"
    )


def downgrade() -> None:
    for table, col in (("attendance", "signed_out_by"), ("attendance", "signed_in_by"), ("registrations", "registered_by")):
        fk = next(f["name"] for f in sa.inspect(op.get_bind()).get_foreign_keys(table) if f["constrained_columns"] == [col])
        op.drop_constraint(fk, table, type_="foreignkey")
        op.drop_column(table, col)
    op.drop_table("event_staff")
    op.drop_column("users", "is_active")
