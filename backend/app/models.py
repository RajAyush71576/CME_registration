<<<<<<< HEAD
import uuid
from datetime import date, datetime, time, timezone
from decimal import Decimal

from sqlalchemy import JSON, Boolean, Date, DateTime, ForeignKey, Integer, Numeric, String, Text, Time, TypeDecorator, UniqueConstraint, text
from sqlalchemy.orm import Mapped, mapped_column

from .db import Base, utcnow


class UTCDateTime(TypeDecorator):
    """MySQL DATETIME has no time zone: store naive UTC, hand back aware UTC."""
    impl = DateTime
    cache_ok = True

    def process_bind_param(self, value, dialect):
        if value is not None and value.tzinfo is not None:
            value = value.astimezone(timezone.utc).replace(tzinfo=None)
        return value

    def process_result_value(self, value, dialect):
        return value.replace(tzinfo=timezone.utc) if value is not None else None


def new_id() -> str:
    return uuid.uuid4().hex


def pk():
    return mapped_column(String(32), primary_key=True, default=new_id)


class User(Base):
    __tablename__ = "users"
    user_id: Mapped[str] = pk()
    name: Mapped[str] = mapped_column(String(200))
    role: Mapped[str] = mapped_column(String(20))  # admin | staff
    email: Mapped[str] = mapped_column(String(255), unique=True)
    password_hash: Mapped[str] = mapped_column(String(255))
    is_active: Mapped[bool] = mapped_column(Boolean, default=True, server_default=text("true"))
=======
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
from datetime import datetime, time

from sqlalchemy import (
    ARRAY,
    Date,
    DateTime,
    ForeignKey,
    Numeric,
    String,
    Text,
    Time,
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
>>>>>>> f6417903ef485a178711941303c1c7bbbf4c6de5


class Participant(Base):
    __tablename__ = "participants"
<<<<<<< HEAD
    participant_id: Mapped[str] = pk()
    name: Mapped[str] = mapped_column(String(200))
    designation: Mapped[str] = mapped_column(String(200))
    email: Mapped[str] = mapped_column(String(255), index=True)
    phone: Mapped[str] = mapped_column(String(50))
    whatsapp_number: Mapped[str] = mapped_column(String(50))
    place_of_work: Mapped[str] = mapped_column(String(255))
    country: Mapped[str | None] = mapped_column(String(100))
    medical_license_no: Mapped[str | None] = mapped_column(String(100))
    participant_type: Mapped[str] = mapped_column(String(20))  # Faculty | Delegate
    source: Mapped[str] = mapped_column(String(20))  # website | import | on_spot
    created_at: Mapped[datetime] = mapped_column(UTCDateTime, default=utcnow)
=======

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
>>>>>>> f6417903ef485a178711941303c1c7bbbf4c6de5


class Event(Base):
    __tablename__ = "events"
<<<<<<< HEAD
    event_id: Mapped[str] = pk()
    event_name: Mapped[str] = mapped_column(String(255))
    event_date: Mapped[date] = mapped_column(Date)
    start_time: Mapped[time] = mapped_column(Time, default=time(9, 0), server_default=text("'09:00:00'"))
    venue: Mapped[str] = mapped_column(String(255))
    organizing_doctors: Mapped[list[str]] = mapped_column(JSON, default=list)
    department: Mapped[str] = mapped_column(String(200))
    cme_credits: Mapped[Decimal] = mapped_column(Numeric(6, 2), default=0, server_default="0")
    approx_duration_hours: Mapped[Decimal] = mapped_column(Numeric(8, 4))  # minute precision
    status: Mapped[str] = mapped_column(String(20), default="active", server_default="active")
    # NULL for events created before this column existed (their creation time was never recorded).
    created_at: Mapped[datetime | None] = mapped_column(UTCDateTime, default=utcnow)


class EventCertificateCounter(Base):
    __tablename__ = "event_certificate_counters"
    event_id: Mapped[str] = mapped_column(ForeignKey("events.event_id"), primary_key=True)
    last_no: Mapped[int] = mapped_column(Integer, default=0, server_default="0")
=======

    event_id: Mapped[str] = mapped_column(String(32), primary_key=True, default=_new_id)
    event_name: Mapped[str] = mapped_column(String, nullable=False)
    event_date: Mapped[datetime] = mapped_column(Date, nullable=False)
    start_time: Mapped[time] = mapped_column(Time, nullable=False, server_default="09:00:00")
    venue: Mapped[str] = mapped_column(String, nullable=False)
    organizing_doctors: Mapped[list[str]] = mapped_column(
        ARRAY(String), nullable=False, default=list
    )
    department: Mapped[str] = mapped_column(String, nullable=False)
    cme_credits: Mapped[float] = mapped_column(Numeric, nullable=False, default=0)
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
>>>>>>> f6417903ef485a178711941303c1c7bbbf4c6de5


class Registration(Base):
    __tablename__ = "registrations"
    __table_args__ = (UniqueConstraint("participant_id", "event_id"),)
<<<<<<< HEAD
    registration_id: Mapped[str] = pk()
    participant_id: Mapped[str] = mapped_column(ForeignKey("participants.participant_id"))
    event_id: Mapped[str] = mapped_column(ForeignKey("events.event_id"), index=True)
    source: Mapped[str] = mapped_column(String(20))
    registered_at: Mapped[datetime] = mapped_column(UTCDateTime, default=utcnow)
    registered_by: Mapped[str | None] = mapped_column(ForeignKey("users.user_id"))
=======

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
>>>>>>> f6417903ef485a178711941303c1c7bbbf4c6de5


class Attendance(Base):
    __tablename__ = "attendance"
<<<<<<< HEAD
    attendance_id: Mapped[str] = pk()
    registration_id: Mapped[str] = mapped_column(ForeignKey("registrations.registration_id"), unique=True)
    status: Mapped[str] = mapped_column(String(20))
    sign_in_time: Mapped[datetime] = mapped_column(UTCDateTime)
    sign_in_signature_ref: Mapped[str] = mapped_column(String(255))
    sign_out_time: Mapped[datetime | None] = mapped_column(UTCDateTime)
    sign_out_signature_ref: Mapped[str | None] = mapped_column(String(255))
    device_id: Mapped[str] = mapped_column(String(100))
    signed_in_by: Mapped[str | None] = mapped_column(ForeignKey("users.user_id"))
    signed_out_by: Mapped[str | None] = mapped_column(ForeignKey("users.user_id"))
=======

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
>>>>>>> f6417903ef485a178711941303c1c7bbbf4c6de5


class Certificate(Base):
    __tablename__ = "certificates"
    __table_args__ = (
        UniqueConstraint("event_id", "participant_id"),
        UniqueConstraint("event_id", "certificate_no"),
    )
<<<<<<< HEAD
    certificate_id: Mapped[str] = pk()
    certificate_no: Mapped[str] = mapped_column(String(10))
    event_id: Mapped[str] = mapped_column(ForeignKey("events.event_id"))
    participant_id: Mapped[str] = mapped_column(ForeignKey("participants.participant_id"))
    delivery_status: Mapped[str] = mapped_column(String(20), default="pending", server_default="pending")
    issued_at: Mapped[datetime] = mapped_column(UTCDateTime, default=utcnow)
=======

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
>>>>>>> f6417903ef485a178711941303c1c7bbbf4c6de5


class ImportBatch(Base):
    __tablename__ = "import_batches"
<<<<<<< HEAD
    batch_id: Mapped[str] = pk()
    source_file: Mapped[str] = mapped_column(String(255))
    source_type: Mapped[str] = mapped_column(String(30))  # cme_website | external_society
    imported_at: Mapped[datetime] = mapped_column(UTCDateTime, default=utcnow)
    imported_by: Mapped[str] = mapped_column(String(255))
    row_count: Mapped[int] = mapped_column(Integer)
    error_count: Mapped[int] = mapped_column(Integer)
=======

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
>>>>>>> f6417903ef485a178711941303c1c7bbbf4c6de5


class ImportError_(Base):
    __tablename__ = "import_errors"
<<<<<<< HEAD
    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    batch_id: Mapped[str] = mapped_column(ForeignKey("import_batches.batch_id"), index=True)
    row_number: Mapped[int] = mapped_column(Integer)
    error_message: Mapped[str] = mapped_column(Text)
=======

    id: Mapped[int] = mapped_column(primary_key=True, autoincrement=True)
    batch_id: Mapped[str] = mapped_column(
        String(32), ForeignKey("import_batches.batch_id"), nullable=False
    )
    row_number: Mapped[int] = mapped_column(nullable=False)
    error_message: Mapped[str] = mapped_column(Text, nullable=False)

    batch: Mapped["ImportBatch"] = relationship(back_populates="errors")
>>>>>>> f6417903ef485a178711941303c1c7bbbf4c6de5


class AuditLog(Base):
    __tablename__ = "audit_logs"
<<<<<<< HEAD
    log_id: Mapped[str] = pk()
    user_id: Mapped[str | None] = mapped_column(ForeignKey("users.user_id"))
    action: Mapped[str] = mapped_column(String(100))
    target_ref: Mapped[str | None] = mapped_column(String(255))
    timestamp: Mapped[datetime] = mapped_column(UTCDateTime, default=utcnow)
    details: Mapped[str | None] = mapped_column(Text)


# Login rate-limit counters and revoked-token jtis live in Redis (see app/redis_ops.py) — both are
# short-lived, TTL'd data that Redis fits naturally, and it removes MySQL-only upsert SQL from the app.
=======

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
>>>>>>> f6417903ef485a178711941303c1c7bbbf4c6de5
