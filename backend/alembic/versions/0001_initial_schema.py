"""initial schema

Revision ID: 0001
Revises:
Create Date: 2026-09-30
"""
from alembic import op
import sqlalchemy as sa

revision = "0001"
down_revision = None
branch_labels = None
depends_on = None


def pk(name):
    return sa.Column(name, sa.String(32), primary_key=True)


def ts(name, nullable=False):
    # Naive UTC; the app's UTCDateTime type converts on the way in and out.
    return sa.Column(name, sa.DateTime, nullable=nullable)


def upgrade() -> None:
    op.create_table(
        "users",
        pk("user_id"),
        sa.Column("name", sa.String(200), nullable=False),
        sa.Column("role", sa.String(20), nullable=False),
        sa.Column("email", sa.String(255), nullable=False, unique=True),
        sa.Column("password_hash", sa.String(255), nullable=False),
    )
    op.create_table(
        "participants",
        pk("participant_id"),
        sa.Column("name", sa.String(200), nullable=False),
        sa.Column("designation", sa.String(200), nullable=False),
        sa.Column("email", sa.String(255), nullable=False),
        sa.Column("phone", sa.String(50), nullable=False),
        sa.Column("whatsapp_number", sa.String(50), nullable=False),
        sa.Column("place_of_work", sa.String(255), nullable=False),
        sa.Column("country", sa.String(100)),
        sa.Column("medical_license_no", sa.String(100)),
        sa.Column("participant_type", sa.String(20), nullable=False),
        sa.Column("source", sa.String(20), nullable=False),
        ts("created_at"),
    )
    op.create_index("ix_participants_email", "participants", ["email"])
    op.create_table(
        "events",
        pk("event_id"),
        sa.Column("event_name", sa.String(255), nullable=False),
        sa.Column("event_date", sa.Date, nullable=False),
        sa.Column("start_time", sa.Time, nullable=False, server_default=sa.text("'09:00:00'")),
        sa.Column("venue", sa.String(255), nullable=False),
        sa.Column("organizing_doctors", sa.JSON, nullable=False),
        sa.Column("department", sa.String(200), nullable=False),
        sa.Column("cme_credits", sa.Numeric(6, 2), nullable=False, server_default="0"),
        sa.Column("approx_duration_hours", sa.Numeric(6, 2), nullable=False),
        sa.Column("status", sa.String(20), nullable=False, server_default="active"),
    )
    op.create_table(
        "event_certificate_counters",
        sa.Column("event_id", sa.String(32), sa.ForeignKey("events.event_id"), primary_key=True),
        sa.Column("last_no", sa.Integer, nullable=False, server_default="0"),
    )
    op.create_table(
        "registrations",
        pk("registration_id"),
        sa.Column("participant_id", sa.String(32), sa.ForeignKey("participants.participant_id"), nullable=False),
        sa.Column("event_id", sa.String(32), sa.ForeignKey("events.event_id"), nullable=False),
        sa.Column("source", sa.String(20), nullable=False),
        ts("registered_at"),
        sa.UniqueConstraint("participant_id", "event_id"),
    )
    op.create_index("ix_registrations_event_id", "registrations", ["event_id"])
    op.create_table(
        "attendance",
        pk("attendance_id"),
        sa.Column("registration_id", sa.String(32), sa.ForeignKey("registrations.registration_id"),
                  nullable=False, unique=True),
        sa.Column("status", sa.String(20), nullable=False),
        ts("sign_in_time"),
        sa.Column("sign_in_signature_ref", sa.String(255), nullable=False),
        ts("sign_out_time", nullable=True),
        sa.Column("sign_out_signature_ref", sa.String(255)),
        sa.Column("device_id", sa.String(100), nullable=False),
    )
    op.create_table(
        "certificates",
        pk("certificate_id"),
        sa.Column("certificate_no", sa.String(10), nullable=False),
        sa.Column("event_id", sa.String(32), sa.ForeignKey("events.event_id"), nullable=False),
        sa.Column("participant_id", sa.String(32), sa.ForeignKey("participants.participant_id"), nullable=False),
        sa.Column("delivery_status", sa.String(20), nullable=False, server_default="pending"),
        ts("issued_at"),
        sa.UniqueConstraint("event_id", "participant_id"),
        sa.UniqueConstraint("event_id", "certificate_no"),
    )
    op.create_table(
        "import_batches",
        pk("batch_id"),
        sa.Column("source_file", sa.String(255), nullable=False),
        sa.Column("source_type", sa.String(30), nullable=False),
        ts("imported_at"),
        sa.Column("imported_by", sa.String(255), nullable=False),
        sa.Column("row_count", sa.Integer, nullable=False),
        sa.Column("error_count", sa.Integer, nullable=False),
    )
    op.create_table(
        "import_errors",
        sa.Column("id", sa.Integer, primary_key=True, autoincrement=True),
        sa.Column("batch_id", sa.String(32), sa.ForeignKey("import_batches.batch_id"), nullable=False),
        sa.Column("row_number", sa.Integer, nullable=False),
        sa.Column("error_message", sa.Text, nullable=False),
    )
    op.create_index("ix_import_errors_batch_id", "import_errors", ["batch_id"])
    op.create_table(
        "audit_logs",
        pk("log_id"),
        sa.Column("user_id", sa.String(32), sa.ForeignKey("users.user_id")),
        sa.Column("action", sa.String(100), nullable=False),
        sa.Column("target_ref", sa.String(255)),
        ts("timestamp"),
        sa.Column("details", sa.Text),
    )
    op.create_table(
        "login_attempts",
        sa.Column("ip", sa.String(64), primary_key=True),
        sa.Column("attempts", sa.Integer, nullable=False),
        ts("window_started_at"),
    )
    op.create_table(
        "revoked_tokens",
        sa.Column("jti", sa.String(32), primary_key=True),
        ts("expires_at"),
    )
    op.create_index("ix_revoked_tokens_expires_at", "revoked_tokens", ["expires_at"])


def downgrade() -> None:
    for table in ("revoked_tokens", "login_attempts", "audit_logs", "import_errors", "import_batches", "certificates", "attendance",
                  "registrations", "event_certificate_counters", "events", "participants", "users"):
        op.drop_table(table)
