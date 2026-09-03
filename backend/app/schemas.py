"""Pydantic request/response models for the Registration & Event API."""

from datetime import date
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
    created_at: str


class EventCreate(BaseModel):
    event_name: str
    event_date: date
    venue: str
    organizing_doctors: list[str] = Field(default_factory=list, max_length=3)
    department: str
    cme_credits: bool
    approx_duration_hours: float


class Event(EventCreate):
    event_id: str


class RegistrationCreate(BaseModel):
    participant_id: str
    event_id: str
    source: RegistrationSource = "on_spot"


class Registration(RegistrationCreate):
    registration_id: str
    registered_at: str


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
    sign_in_time: str
    sign_in_signature_ref: str
    sign_out_time: str | None = None
    sign_out_signature_ref: str | None = None
    device_id: str


class CertificateIssue(BaseModel):
    registration_id: str


class Certificate(BaseModel):
    certificate_id: str
    certificate_no: str
    event_id: str
    participant_id: str
    delivery_status: str
    issued_at: str


class ImportBatch(BaseModel):
    batch_id: str
    source_file: str
    source_type: Literal["cme_website", "external_society"]
    imported_at: str
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
