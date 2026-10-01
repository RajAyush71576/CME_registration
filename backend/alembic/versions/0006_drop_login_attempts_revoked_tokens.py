"""drop login_attempts and revoked_tokens: both now live in Redis

Revision ID: 0006
Revises: 0005
Create Date: 2026-10-01
"""
from alembic import op
import sqlalchemy as sa

revision = "0006"
down_revision = "0005"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.drop_table("revoked_tokens")
    op.drop_table("login_attempts")


def downgrade() -> None:
    op.create_table(
        "login_attempts",
        sa.Column("ip", sa.String(64), primary_key=True),
        sa.Column("attempts", sa.Integer, nullable=False),
        sa.Column("window_started_at", sa.DateTime, nullable=False),
    )
    op.create_table(
        "revoked_tokens",
        sa.Column("jti", sa.String(32), primary_key=True),
        sa.Column("expires_at", sa.DateTime, nullable=False),
    )
    op.create_index("ix_revoked_tokens_expires_at", "revoked_tokens", ["expires_at"])
