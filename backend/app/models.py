"""SQLAlchemy models mirroring the sheets in the (now legacy) excel_store.py.

Column names intentionally match the old sheet columns / current Pydantic
schema field names (e.g. `participant_id`, not `id`) so cutting routers over
in Phase B is a near-zero API-contract change. IDs stay as 32-char UUID hex
strings (matching `excel_store.new_id()`), not Postgres's native UUID type,
for the same reason.

New here (not in the Excel schema): real foreign keys, `UNIQUE` constraints
that replace the old `excel_store.transaction()` check-then-act locking
(duplicate registration/sign-in are now rejected by the database itself),
and `EventCertificateCounter` for atomic per-event sequential numbering.
"""

import uuid
from datetime import datetime

from sqlalchemy import (
    ARRAY,
    Boolean,
    Date,
    DateTime,
    ForeignKey,
    Numeric,
    String,
    Text,
    UniqueConstraint,
    func,
)
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.database import Base


def _new_id() -> str:
    return uuid.uuid4().hex


class User(Base):
    __tablename__ = "users"

    user_id: Mapped[str] = mapped_column(String(32), primary_key=True, default=_new_id)
    name: Mapped[str] = mapped_column(String, nullable=False)
    role: Mapped[str] = mapped_column(String, nullable=False)
    email: Mapped[str] = mapped_column(String, nullable=False, unique=True)
    password_hash: Mapped[str] = mapped_column(String, nullable=False)


class Participant(Base):
    __tablename__ = "participants"

    participant_id: Mapped[str] = mapped_column(String(32), primary_key=True, default=_new_id)
    name: Mapped[str] = mapped_column(String, nullable=False)
    designation: Mapped[str] = mapped_column(String, nullable=False)
    email: Mapped[str] = mapped_column(String, nullable=False)
    phone: Mapped[str] = mapped_column(String, nullable=False)
    whatsapp_number: Mapped[str] = mapped_column(String, nullable=False)
    place_of_work: Mapped[str] = mapped_column(String, nullable=False)
    country: Mapped[str | None] = mapped_column(String, nullable=True)
    medical_license_no: Mapped[str | None] = mapped_column(String, nullable=True)
    participant_type: Mapped[str] = mapped_column(String, nullable=False)
    source: Mapped[str] = mapped_column(String, nullable=False)
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), nullable=False, server_default=func.now()
    )


class Event(Base):
    __tablename__ = "events"

    event_id: Mapped[str] = mapped_column(String(32), primary_key=True, default=_new_id)
    event_name: Mapped[str] = mapped_column(String, nullable=False)
    event_date: Mapped[datetime] = mapped_column(Date, nullable=False)
    venue: Mapped[str] = mapped_column(String, nullable=False)
    organizing_doctors: Mapped[list[str]] = mapped_column(
        ARRAY(String), nullable=False, default=list
    )
    department: Mapped[str] = mapped_column(String, nullable=False)
    cme_credits: Mapped[bool] = mapped_column(Boolean, nullable=False)
    approx_duration_hours: Mapped[float] = mapped_column(Numeric, nullable=False)
    status: Mapped[str] = mapped_column(String, nullable=False, server_default="active")


class EventCertificateCounter(Base):
    """Backs atomic per-event sequential certificate numbering (replaces the
    old 'count existing rows, +1' race — see CONTEXT.md concurrency notes)."""

    __tablename__ = "event_certificate_counters"

    event_id: Mapped[str] = mapped_column(
        String(32), ForeignKey("events.event_id"), primary_key=True
    )
    last_no: Mapped[int] = mapped_column(nullable=False, default=0)


class Registration(Base):
    __tablename__ = "registrations"
    __table_args__ = (UniqueConstraint("participant_id", "event_id"),)

    registration_id: Mapped[str] = mapped_column(String(32), primary_key=True, default=_new_id)
    participant_id: Mapped[str] = mapped_column(
        String(32), ForeignKey("participants.participant_id"), nullable=False
    )
    event_id: Mapped[str] = mapped_column(
        String(32), ForeignKey("events.event_id"), nullable=False
    )
    source: Mapped[str] = mapped_column(String, nullable=False)
    registered_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), nullable=False, server_default=func.now()
    )


class Attendance(Base):
    __tablename__ = "attendance"

    attendance_id: Mapped[str] = mapped_column(String(32), primary_key=True, default=_new_id)
    registration_id: Mapped[str] = mapped_column(
        String(32), ForeignKey("registrations.registration_id"), nullable=False, unique=True
    )
    status: Mapped[str] = mapped_column(String, nullable=False)
    sign_in_time: Mapped[datetime] = mapped_column(DateTime(timezone=True), nullable=False)
    sign_in_signature_ref: Mapped[str] = mapped_column(String, nullable=False)
    sign_out_time: Mapped[datetime | None] = mapped_column(
        DateTime(timezone=True), nullable=True
    )
    sign_out_signature_ref: Mapped[str | None] = mapped_column(String, nullable=True)
    device_id: Mapped[str] = mapped_column(String, nullable=False)


class Certificate(Base):
    __tablename__ = "certificates"
    __table_args__ = (
        UniqueConstraint("event_id", "participant_id"),
        UniqueConstraint("event_id", "certificate_no"),
    )

    certificate_id: Mapped[str] = mapped_column(String(32), primary_key=True, default=_new_id)
    certificate_no: Mapped[str] = mapped_column(String, nullable=False)
    event_id: Mapped[str] = mapped_column(
        String(32), ForeignKey("events.event_id"), nullable=False
    )
    participant_id: Mapped[str] = mapped_column(
        String(32), ForeignKey("participants.participant_id"), nullable=False
    )
    delivery_status: Mapped[str] = mapped_column(String, nullable=False)
    issued_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), nullable=False, server_default=func.now()
    )


class ImportBatch(Base):
    __tablename__ = "import_batches"

    batch_id: Mapped[str] = mapped_column(String(32), primary_key=True, default=_new_id)
    source_file: Mapped[str] = mapped_column(String, nullable=False)
    source_type: Mapped[str] = mapped_column(String, nullable=False)
    imported_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), nullable=False, server_default=func.now()
    )
    imported_by: Mapped[str] = mapped_column(String, nullable=False)
    row_count: Mapped[int] = mapped_column(nullable=False)
    error_count: Mapped[int] = mapped_column(nullable=False)

    errors: Mapped[list["ImportError_"]] = relationship(back_populates="batch")


class ImportError_(Base):
    __tablename__ = "import_errors"

    id: Mapped[int] = mapped_column(primary_key=True, autoincrement=True)
    batch_id: Mapped[str] = mapped_column(
        String(32), ForeignKey("import_batches.batch_id"), nullable=False
    )
    row_number: Mapped[int] = mapped_column(nullable=False)
    error_message: Mapped[str] = mapped_column(Text, nullable=False)

    batch: Mapped["ImportBatch"] = relationship(back_populates="errors")


class AuditLog(Base):
    __tablename__ = "audit_logs"

    log_id: Mapped[str] = mapped_column(String(32), primary_key=True, default=_new_id)
    user_id: Mapped[str | None] = mapped_column(
        String(32), ForeignKey("users.user_id"), nullable=True
    )
    action: Mapped[str] = mapped_column(String, nullable=False)
    target_ref: Mapped[str | None] = mapped_column(String, nullable=True)
    timestamp: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), nullable=False, server_default=func.now()
    )
    details: Mapped[str | None] = mapped_column(Text, nullable=True)
