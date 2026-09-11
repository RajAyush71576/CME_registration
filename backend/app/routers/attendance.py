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


@router.post("/{attendance_id}/sign-out", response_model=Attendance)
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
