<<<<<<< HEAD
import base64
import binascii
import io
import math
from datetime import datetime, timezone

from fastapi import APIRouter, Depends, HTTPException
from PIL import Image, UnidentifiedImageError
from sqlalchemy import select
from sqlalchemy.exc import IntegrityError
from sqlalchemy.orm import Session

from ..live import notify
from ..db import IST, SIGNATURES_DIR, get_db, row_to_dict
from ..models import Attendance, Event, Registration, User, new_id
from ..schemas import SignInIn, SignOutIn
from ..security import get_current_user

router = APIRouter(prefix="/attendance", tags=["attendance"], dependencies=[Depends(get_current_user)])

PNG_PREFIX = "data:image/png;base64,"


def fmt_minutes(total: int) -> str:
    """45 -> "45 min", 90 -> "1 h 30 min", 120 -> "2 h"."""
    h, m = divmod(total, 60)
    if not h:
        return f"{m} min"
    return f"{h} h {m} min" if m else f"{h} h"


def fmt_clock(t) -> str:
    """09:00 -> "9:00 AM"."""
    return t.strftime("%I:%M %p").lstrip("0")


MAX_SIGNATURE_BYTES = 5 * 1024 * 1024
MAX_SIGNATURE_SIDE = 4096  # the tablet canvas is ~600x220 at 2-3x DPI


def decode_signature(data_url: str) -> bytes:
    if not data_url.startswith(PNG_PREFIX):
        raise HTTPException(400, "Signature must be a PNG data URL")
    try:
        raw = base64.b64decode(data_url[len(PNG_PREFIX):], validate=True)
    except binascii.Error:
        raise HTTPException(400, "Invalid signature image")
    if len(raw) > MAX_SIGNATURE_BYTES:
        raise HTTPException(400, "Signature image is too large")
    try:
        im = Image.open(io.BytesIO(raw))
        # Check the header's size before decoding pixels: a tiny file can claim a huge image.
        if im.format != "PNG":
            raise HTTPException(400, "Signature must be a PNG image")
        if max(im.size) > MAX_SIGNATURE_SIDE:
            raise HTTPException(400, "Signature image is too large")
        ink = im.convert("RGBA").getchannel("A").getbbox()
    except (UnidentifiedImageError, SyntaxError, OSError, ValueError, Image.DecompressionBombError):
        raise HTTPException(400, "Invalid signature image")
    if not ink:
        raise HTTPException(400, "Signature is empty — please sign again")
    return raw


def save_signature(raw: bytes, attendance_id: str, kind: str) -> str:
    SIGNATURES_DIR.mkdir(parents=True, exist_ok=True)
    name = f"{attendance_id}_{kind}.png"
    (SIGNATURES_DIR / name).write_bytes(raw)
    return f"signatures/{name}"


def commit_or_discard(db: Session, ref: str) -> None:
    """Commit; if that fails, delete the signature file just written so no orphan is left behind."""
    try:
        db.commit()
    except Exception:
        db.rollback()
        (SIGNATURES_DIR.parent / ref).unlink(missing_ok=True)
        raise


@router.post("/sign-in", status_code=201)
def sign_in(body: SignInIn, db: Session = Depends(get_db), user: User = Depends(get_current_user)):
    reg = db.get(Registration, body.registration_id)
    if not reg:
        raise HTTPException(404, "Registration not found")
    event = db.get(Event, reg.event_id)
    if event.status == "closed":
        raise HTTPException(400, "This event is closed")
    now_ist = datetime.now(IST)
    if now_ist.date() != event.event_date:
        raise HTTPException(400, "Sign-in is only available on the day of the event")
    if now_ist < datetime.combine(event.event_date, event.start_time, IST):
        raise HTTPException(400, f"Sign-in opens at {fmt_clock(event.start_time)} on the day of the event")
    raw = decode_signature(body.signature)

    attendance_id = new_id()
    att = Attendance(
        attendance_id=attendance_id,
        registration_id=reg.registration_id,
        status="PRESENT",
        sign_in_time=datetime.now(timezone.utc),
        sign_in_signature_ref=f"signatures/{attendance_id}_sign_in.png",
        device_id=body.device_id,
        signed_in_by=user.user_id,
    )
    db.add(att)
    try:
        db.flush()
    except IntegrityError:
        db.rollback()
        raise HTTPException(409, "This participant is already signed in")
    commit_or_discard(db, save_signature(raw, attendance_id, "sign_in"))
    notify("attendance", reg.event_id)
    return row_to_dict(att)


@router.post("/{attendance_id}/sign-out")
def sign_out(attendance_id: str, body: SignOutIn, db: Session = Depends(get_db), user: User = Depends(get_current_user)):
    # Row lock so two tablets can't sign the same person out at once.
    att = db.scalar(select(Attendance).where(Attendance.attendance_id == attendance_id).with_for_update())
    if not att:
        raise HTTPException(404, "Attendance not found")
    if att.sign_out_time:
        raise HTTPException(409, "This participant has already signed out")
    event = db.get(Event, db.get(Registration, att.registration_id).event_id)
    if event.status == "closed":
        raise HTTPException(400, "This event is closed")
    now = datetime.now(timezone.utc)
    elapsed = (now - att.sign_in_time).total_seconds() / 3600
    required = float(event.approx_duration_hours)
    if elapsed < required:
        raise HTTPException(
            400,
            f"Sign-out not available yet: {fmt_minutes(math.ceil((required - elapsed) * 60))} remaining to meet the "
            f"event's approximate duration ({fmt_minutes(round(required * 60))})",
        )
    att.sign_out_signature_ref = save_signature(decode_signature(body.signature), attendance_id, "sign_out")
    att.sign_out_time = now
    att.signed_out_by = user.user_id
    commit_or_discard(db, att.sign_out_signature_ref)
    notify("attendance", event.event_id)
    return row_to_dict(att)


@router.get("")
def list_attendance(db: Session = Depends(get_db)):
    return [row_to_dict(a) for a in db.scalars(select(Attendance).order_by(Attendance.sign_in_time.desc()))]


@router.get("/{attendance_id}")
def get_attendance(attendance_id: str, db: Session = Depends(get_db)):
    att = db.get(Attendance, attendance_id)
    if not att:
        raise HTTPException(404, "Attendance not found")
    return row_to_dict(att)
=======
import uuid
from datetime import datetime, timezone

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.exc import IntegrityError
from sqlalchemy.orm import Session

from app import models
from app.auth import get_current_user, require_staff
from app.database import get_db
from app.db_utils import row_to_dict
from app.schemas import Attendance, AttendanceSignIn, AttendanceSignOut
from app.signature_store import save_signature

router = APIRouter(
    prefix="/attendance", tags=["attendance"], dependencies=[Depends(get_current_user)]
)


@router.post(
    "/sign-in", response_model=Attendance, status_code=201, dependencies=[Depends(require_staff)]
)
def sign_in(payload: AttendanceSignIn, db: Session = Depends(get_db)):
    registration = (
        db.query(models.Registration)
        .filter_by(registration_id=payload.registration_id)
        .first()
    )
    if registration is None:
        raise HTTPException(status_code=404, detail="Registration not found")

    event = db.query(models.Event).filter_by(event_id=registration.event_id).first()
    if event.status == "closed":
        raise HTTPException(status_code=400, detail="This event is closed")

    now = datetime.now(timezone.utc)
    if event.event_date != now.date():
        raise HTTPException(
            status_code=400, detail="Sign-in is only available on the day of the event"
        )
    event_start = datetime.combine(event.event_date, event.start_time, tzinfo=timezone.utc)
    if now < event_start:
        raise HTTPException(
            status_code=400,
            detail=f"Sign-in opens at {event.start_time.strftime('%H:%M')} on the day of the event",
        )

    attendance_id = uuid.uuid4().hex
    signature_ref = save_signature(attendance_id, "sign_in", payload.signature)
    attendance = models.Attendance(
        attendance_id=attendance_id,
        registration_id=payload.registration_id,
        status="PRESENT",
        sign_in_time=datetime.now(timezone.utc),
        sign_in_signature_ref=signature_ref,
        device_id=payload.device_id,
    )
    db.add(attendance)
    try:
        db.commit()
    except IntegrityError:
        db.rollback()
        raise HTTPException(
            status_code=409,
            detail="Attendance already recorded for this registration",
        )
    db.refresh(attendance)
    return row_to_dict(attendance)


@router.post(
    "/{attendance_id}/sign-out",
    response_model=Attendance,
    dependencies=[Depends(require_staff)],
)
def sign_out(attendance_id: str, payload: AttendanceSignOut, db: Session = Depends(get_db)):
    attendance = db.query(models.Attendance).filter_by(attendance_id=attendance_id).first()
    if attendance is None:
        raise HTTPException(status_code=404, detail="Attendance record not found")
    if attendance.sign_out_time:
        raise HTTPException(status_code=409, detail="Already signed out")

    registration = (
        db.query(models.Registration)
        .filter_by(registration_id=attendance.registration_id)
        .first()
    )
    event = db.query(models.Event).filter_by(event_id=registration.event_id).first()
    if event.status == "closed":
        raise HTTPException(status_code=400, detail="This event is closed")

    now = datetime.now(timezone.utc)
    elapsed_hours = (now - attendance.sign_in_time).total_seconds() / 3600
    required_hours = float(event.approx_duration_hours)

    if elapsed_hours < required_hours:
        remaining = round(required_hours - elapsed_hours, 2)
        raise HTTPException(
            status_code=400,
            detail=(
                f"Sign-off not yet available: {remaining}h remaining to meet "
                f"the event's approximate duration ({required_hours}h)"
            ),
        )

    signature_ref = save_signature(attendance_id, "sign_out", payload.signature)
    attendance.sign_out_time = now
    attendance.sign_out_signature_ref = signature_ref
    db.commit()
    db.refresh(attendance)
    return row_to_dict(attendance)


@router.get("", response_model=list[Attendance])
def list_attendance(db: Session = Depends(get_db)):
    return [row_to_dict(a) for a in db.query(models.Attendance).all()]


@router.get("/{attendance_id}", response_model=Attendance)
def get_attendance(attendance_id: str, db: Session = Depends(get_db)):
    attendance = db.query(models.Attendance).filter_by(attendance_id=attendance_id).first()
    if attendance is None:
        raise HTTPException(status_code=404, detail="Attendance record not found")
    return row_to_dict(attendance)
>>>>>>> f6417903ef485a178711941303c1c7bbbf4c6de5
