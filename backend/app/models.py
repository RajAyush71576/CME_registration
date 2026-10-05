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


class Participant(Base):
    __tablename__ = "participants"
    participant_id: Mapped[str] = pk()
    name: Mapped[str] = mapped_column(String(200))
    designation: Mapped[str] = mapped_column(String(200))
    email: Mapped[str] = mapped_column(String(255), index=True)
    phone: Mapped[str] = mapped_column(String(50))
    whatsapp_number: Mapped[str] = mapped_column(String(50))
    place_of_work: Mapped[str] = mapped_column(String(255))
    country: Mapped[str | None] = mapped_column(String(100))
    medical_license_no: Mapped[str | None] = mapped_column(String(100))
    participant_type: Mapped[str] = mapped_column(String(20))  # Faculty | Delegate | Sponsor
    source: Mapped[str] = mapped_column(String(20))  # website | import | on_spot
    created_at: Mapped[datetime] = mapped_column(UTCDateTime, default=utcnow)


class Event(Base):
    __tablename__ = "events"
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
    # NULL until the event is closed; set once, when status flips to "closed".
    closed_at: Mapped[datetime | None] = mapped_column(UTCDateTime)


class EventCertificateCounter(Base):
    __tablename__ = "event_certificate_counters"
    event_id: Mapped[str] = mapped_column(ForeignKey("events.event_id"), primary_key=True)
    last_no: Mapped[int] = mapped_column(Integer, default=0, server_default="0")


class Registration(Base):
    __tablename__ = "registrations"
    __table_args__ = (UniqueConstraint("participant_id", "event_id"),)
    registration_id: Mapped[str] = pk()
    participant_id: Mapped[str] = mapped_column(ForeignKey("participants.participant_id"))
    event_id: Mapped[str] = mapped_column(ForeignKey("events.event_id"), index=True)
    source: Mapped[str] = mapped_column(String(20))
    registered_at: Mapped[datetime] = mapped_column(UTCDateTime, default=utcnow)
    registered_by: Mapped[str | None] = mapped_column(ForeignKey("users.user_id"))
    # Faculty-only: a manual present/absent call that bypasses sign-in/sign-out entirely.
    # NULL (the default) means "not called" — falls back to the normal sign-in-derived status.
    manual_status: Mapped[str | None] = mapped_column(String(10))  # present | absent
    manual_status_by: Mapped[str | None] = mapped_column(ForeignKey("users.user_id"))
    manual_status_at: Mapped[datetime | None] = mapped_column(UTCDateTime)


class Attendance(Base):
    __tablename__ = "attendance"
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


class Certificate(Base):
    __tablename__ = "certificates"
    __table_args__ = (
        UniqueConstraint("event_id", "participant_id"),
        UniqueConstraint("event_id", "certificate_no"),
    )
    certificate_id: Mapped[str] = pk()
    certificate_no: Mapped[str] = mapped_column(String(10))
    event_id: Mapped[str] = mapped_column(ForeignKey("events.event_id"))
    participant_id: Mapped[str] = mapped_column(ForeignKey("participants.participant_id"))
    delivery_status: Mapped[str] = mapped_column(String(20), default="pending", server_default="pending")
    issued_at: Mapped[datetime] = mapped_column(UTCDateTime, default=utcnow)


class ImportBatch(Base):
    __tablename__ = "import_batches"
    batch_id: Mapped[str] = pk()
    source_file: Mapped[str] = mapped_column(String(255))
    source_type: Mapped[str] = mapped_column(String(30))  # cme_website | external_society
    imported_at: Mapped[datetime] = mapped_column(UTCDateTime, default=utcnow)
    imported_by: Mapped[str] = mapped_column(String(255))
    row_count: Mapped[int] = mapped_column(Integer)
    error_count: Mapped[int] = mapped_column(Integer)


class ImportError_(Base):
    __tablename__ = "import_errors"
    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    batch_id: Mapped[str] = mapped_column(ForeignKey("import_batches.batch_id"), index=True)
    row_number: Mapped[int] = mapped_column(Integer)
    error_message: Mapped[str] = mapped_column(Text)


class AuditLog(Base):
    __tablename__ = "audit_logs"
    log_id: Mapped[str] = pk()
    user_id: Mapped[str | None] = mapped_column(ForeignKey("users.user_id"))
    action: Mapped[str] = mapped_column(String(100))
    target_ref: Mapped[str | None] = mapped_column(String(255))
    timestamp: Mapped[datetime] = mapped_column(UTCDateTime, default=utcnow)
    details: Mapped[str | None] = mapped_column(Text)


# Login rate-limit counters and revoked-token jtis live in Redis (see app/redis_ops.py) — both are
# short-lived, TTL'd data that Redis fits naturally, and it removes MySQL-only upsert SQL from the app.
