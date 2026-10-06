"""participants.speciality: optional field collected via bulk Excel import

Revision ID: 0010
Revises: 0009
Create Date: 2026-10-06
"""
from alembic import op
import sqlalchemy as sa

revision = "0010"
down_revision = "0009"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.add_column("participants", sa.Column("speciality", sa.String(200), nullable=True))


def downgrade() -> None:
    op.drop_column("participants", "speciality")
