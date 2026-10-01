<<<<<<< HEAD
from datetime import date, datetime, time
from decimal import Decimal
from typing import Annotated, Literal

import re

from pydantic import AfterValidator, BaseModel, Field, StringConstraints, field_validator
from pydantic_core import PydanticCustomError

from .db import IST


def Req(max_length: int):
    """Required, trimmed, non-empty string capped at its DB column length."""
    return Annotated[str, StringConstraints(strip_whitespace=True, min_length=1, max_length=max_length)]


def Opt(max_length: int):
    return Annotated[str, StringConstraints(strip_whitespace=True, max_length=max_length)]


ParticipantType = Literal["Faculty", "Delegate"]

# name@domain.tld — needs an @, a domain and a dot-extension of 2+ letters (rejects "abc@gmail", "abcgmail.com", "a@com").
EMAIL_RE = re.compile(r"^[A-Za-z0-9._%+-]+@[A-Za-z0-9-]+(\.[A-Za-z0-9-]+)*\.[A-Za-z]{2,}$")
EMAIL_ERROR = "Enter a valid email address, like name@gmail.com"

# "+91 9876543210", "98765 43210", "(022) 1234-5678"
PHONE_RE = re.compile(r"^\+?[0-9 ()-]{6,25}$")
PHONE_ERROR = "Enter a valid phone number"


def check_email(v: str) -> str:
    v = v.strip()
    if len(v) > 255 or not EMAIL_RE.match(v):
        raise PydanticCustomError("email", EMAIL_ERROR)
    return v


def phone_ok(v: str) -> bool:
    return bool(PHONE_RE.match(v)) and sum(c.isdigit() for c in v) >= 6


def check_phone(v: str) -> str:
    v = v.strip()
    if not phone_ok(v):
        raise PydanticCustomError("phone", PHONE_ERROR)
    return v


def check_password(v: str) -> str:
    if len(v) < 8:
        raise PydanticCustomError("password", "Password must be at least 8 characters")
    if len(v.encode()) > 72:  # bcrypt only accepts 72 bytes
        raise PydanticCustomError("password", "Password is too long (max 72 bytes)")
    return v


def check_naive(v: time) -> time:
    if v.tzinfo is not None:
        raise PydanticCustomError("time", "Start time must not include a time zone")
    return v


Email = Annotated[str, AfterValidator(check_email)]
Phone = Annotated[str, AfterValidator(check_phone)]
Password = Annotated[str, AfterValidator(check_password)]
StartTime = Annotated[time, AfterValidator(check_naive)]


def blank_to_none(v):
    if isinstance(v, str):
        v = v.strip()
    return v or None


class LoginIn(BaseModel):
    email: Req(255)
    password: str = Field(max_length=128)


Role = Literal["admin", "staff"]


class UserCreate(BaseModel):
    name: Req(200)
    email: Email
    password: Password
    role: Role = "staff"


class UserUpdate(BaseModel):
    name: Req(200) | None = None
    email: Email | None = None
    password: Password | None = None
    role: Role | None = None
    is_active: bool | None = None


class EventCreate(BaseModel):
    event_name: Req(255)
    event_date: date
    start_time: StartTime = time(9, 0)
    venue: Req(255)
    organizing_doctors: list[Req(200)] = Field(default_factory=list, max_length=3)
    department: Req(200)
    cme_credits: Decimal = Field(default=Decimal(0), ge=0, le=Decimal("9999.99"))
    approx_duration_hours: Decimal = Field(ge=0, le=72)  # 0 = sign-out allowed right after sign-in

    @field_validator("event_date")
    @classmethod
    def not_in_past(cls, v: date) -> date:
        if v < datetime.now(IST).date():
            raise PydanticCustomError("date", "Event date can't be in the past")
        return v


class EventUpdate(BaseModel):
    """Partial edit: only the fields sent are changed. Same rules as creating an event."""
    event_name: Req(255) | None = None
    event_date: date | None = None
    start_time: StartTime | None = None
    venue: Req(255) | None = None
    organizing_doctors: list[Req(200)] | None = Field(default=None, max_length=3)
    department: Req(200) | None = None
    cme_credits: Decimal | None = Field(default=None, ge=0, le=Decimal("9999.99"))
    approx_duration_hours: Decimal | None = Field(default=None, ge=0, le=72)

    @field_validator("event_date")
    @classmethod
    def not_in_past(cls, v: date | None) -> date | None:
        return v if v is None else EventCreate.not_in_past(v)


class ParticipantCreate(BaseModel):
    name: Req(200)
    designation: Req(200)
    email: Email
    phone: Phone
    whatsapp_number: Phone
    place_of_work: Req(255)
    country: Opt(100) | None = None
    medical_license_no: Opt(100) | None = None
    participant_type: ParticipantType = "Delegate"

    _clean = field_validator("country", "medical_license_no", mode="before")(blank_to_none)


class ParticipantUpdate(BaseModel):
    name: Req(200) | None = None
    designation: Req(200) | None = None
    email: Email | None = None
    phone: Phone | None = None
    whatsapp_number: Phone | None = None
    place_of_work: Req(255) | None = None
    country: Opt(100) | None = None
    medical_license_no: Opt(100) | None = None
    participant_type: ParticipantType | None = None

    _clean = field_validator("country", "medical_license_no", mode="before")(blank_to_none)
=======
"""Pydantic request/response models for the Registration & Event API."""

from datetime import date, datetime, time
from typing import Literal

from pydantic import BaseModel, Field

ParticipantType = Literal["Faculty", "Delegate"]
RegistrationSource = Literal["website", "import", "on_spot"]


class ParticipantCreate(BaseModel):
    name: str
    designation: str
    email: str
    phone: str
    whatsapp_number: str
    place_of_work: str
    country: str | None = None
    medical_license_no: str | None = None
    participant_type: ParticipantType
    source: RegistrationSource = "on_spot"


class Participant(ParticipantCreate):
    participant_id: str
    created_at: datetime


class ParticipantUpdate(BaseModel):
    name: str | None = None
    designation: str | None = None
    email: str | None = None
    phone: str | None = None
    whatsapp_number: str | None = None
    place_of_work: str | None = None
    country: str | None = None
    medical_license_no: str | None = None
    participant_type: ParticipantType | None = None


class EventCreate(BaseModel):
    event_name: str
    event_date: date
    start_time: time = time(9, 0)
    venue: str
    organizing_doctors: list[str] = Field(default_factory=list, max_length=3)
    department: str
    cme_credits: float = 0
    approx_duration_hours: float


class Event(EventCreate):
    event_id: str
    status: Literal["active", "closed"] = "active"


class EventUpdate(BaseModel):
    start_time: time
>>>>>>> f6417903ef485a178711941303c1c7bbbf4c6de5


class RegistrationCreate(BaseModel):
    participant_id: str
    event_id: str
<<<<<<< HEAD


class SignInIn(BaseModel):
    registration_id: str
    device_id: Req(100)
    signature: str = Field(max_length=7_000_000)


class SignOutIn(BaseModel):
    signature: str = Field(max_length=7_000_000)
=======
    source: RegistrationSource = "on_spot"


class Registration(RegistrationCreate):
    registration_id: str
    registered_at: datetime


class LoginRequest(BaseModel):
    email: str
    password: str


class UserOut(BaseModel):
    user_id: str
    name: str
    role: str
    email: str


class LoginResponse(BaseModel):
    access_token: str
    token_type: str = "bearer"
    user: UserOut


class AttendanceSignIn(BaseModel):
    registration_id: str
    device_id: str
    signature: str = Field(description="data:image/png;base64,... from the signature pad")


class AttendanceSignOut(BaseModel):
    signature: str = Field(description="data:image/png;base64,... from the signature pad")


class Attendance(BaseModel):
    attendance_id: str
    registration_id: str
    status: str
    sign_in_time: datetime
    sign_in_signature_ref: str
    sign_out_time: datetime | None = None
    sign_out_signature_ref: str | None = None
    device_id: str
>>>>>>> f6417903ef485a178711941303c1c7bbbf4c6de5


class CertificateIssue(BaseModel):
    registration_id: str


<<<<<<< HEAD
class ImportRow(BaseModel):
    """One spreadsheet row as the preview sent it back. Values are re-validated by validate_rows."""
    row_number: int = 0
    name: Opt(200) = ""
    designation: Opt(200) = ""
    email: Opt(255) = ""
    phone: Opt(50) = ""
    whatsapp_number: Opt(50) = ""
    place_of_work: Opt(255) = ""
    country: Opt(100) = ""
    medical_license_no: Opt(100) = ""
    participant_type: Opt(20) = ""

    @field_validator("*", mode="before")
    @classmethod
    def to_text(cls, v, info):
        if info.field_name == "row_number":
            return v
        return "" if v is None else str(v) if isinstance(v, (int, float)) else v


class ImportCommit(BaseModel):
    event_id: str
    source_type: Literal["cme_website", "external_society"]
    source_file: Req(255)
    rows: list[ImportRow] = Field(max_length=5000)
=======
class Certificate(BaseModel):
    certificate_id: str
    certificate_no: str
    event_id: str
    participant_id: str
    delivery_status: str
    issued_at: datetime


class ImportBatch(BaseModel):
    batch_id: str
    source_file: str
    source_type: Literal["cme_website", "external_society"]
    imported_at: datetime
    imported_by: str
    row_count: int
    error_count: int


class ImportRowError(BaseModel):
    row_number: int
    error_message: str


class ImportResult(BaseModel):
    batch: ImportBatch
    errors: list[ImportRowError]


class RegistrationDetail(Registration):
    """A registration joined with its participant, for tablet search/auto-fill."""

    participant: Participant
    attendance: Attendance | None = None
    certificate: Certificate | None = None
>>>>>>> f6417903ef485a178711941303c1c7bbbf4c6de5
