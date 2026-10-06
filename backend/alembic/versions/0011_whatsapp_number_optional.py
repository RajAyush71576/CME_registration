"""participants.whatsapp_number: now optional

Revision ID: 0011
Revises: 0010
Create Date: 2026-10-06
"""
from alembic import op
import sqlalchemy as sa

revision = "0011"
down_revision = "0010"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.alter_column("participants", "whatsapp_number", existing_type=sa.String(50), nullable=True)


def downgrade() -> None:
    op.alter_column("participants", "whatsapp_number", existing_type=sa.String(50), nullable=False)
