from datetime import datetime

from fastapi import APIRouter, Depends, HTTPException

from app import excel_store as store
from app.auth import get_current_user
from app.schemas import Attendance, AttendanceSignIn, AttendanceSignOut
from app.signature_store import save_signature

router = APIRouter(
    prefix="/attendance", tags=["attendance"], dependencies=[Depends(get_current_user)]
)


@router.post("/sign-in", response_model=Attendance, status_code=201)
def sign_in(payload: AttendanceSignIn):
    with store.transaction() as tx:
        registration = tx.find_row(
            "Registrations", "registration_id", payload.registration_id
        )
        if registration is None:
            raise HTTPException(status_code=404, detail="Registration not found")

        if tx.find_row("Attendance", "registration_id", payload.registration_id):
            raise HTTPException(
                status_code=409,
                detail="Attendance already recorded for this registration",
            )

        attendance_id = store.new_id()
        signature_ref = save_signature(attendance_id, "sign_in", payload.signature)
        row = {
            "attendance_id": attendance_id,
            "registration_id": payload.registration_id,
            "status": "PRESENT",
            "sign_in_time": store.now_iso(),
            "sign_in_signature_ref": signature_ref,
            "sign_out_time": None,
            "sign_out_signature_ref": None,
            "device_id": payload.device_id,
        }
        tx.append_row("Attendance", row)
        return row


@router.post("/{attendance_id}/sign-out", response_model=Attendance)
def sign_out(attendance_id: str, payload: AttendanceSignOut):
    with store.transaction() as tx:
        attendance = tx.find_row("Attendance", "attendance_id", attendance_id)
        if attendance is None:
            raise HTTPException(status_code=404, detail="Attendance record not found")
        if attendance.get("sign_out_time"):
            raise HTTPException(status_code=409, detail="Already signed out")

        registration = tx.find_row(
            "Registrations", "registration_id", attendance["registration_id"]
        )
        event = tx.find_row("Events", "event_id", registration["event_id"])

        sign_in_time = datetime.fromisoformat(attendance["sign_in_time"])
        now = datetime.fromisoformat(store.now_iso())
        elapsed_hours = (now - sign_in_time).total_seconds() / 3600
        required_hours = event["approx_duration_hours"]

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
        updated = tx.update_row(
            "Attendance",
            "attendance_id",
            attendance_id,
            {"sign_out_time": now.isoformat(), "sign_out_signature_ref": signature_ref},
        )
        return updated


@router.get("", response_model=list[Attendance])
def list_attendance():
    return store.list_rows("Attendance")


@router.get("/{attendance_id}", response_model=Attendance)
def get_attendance(attendance_id: str):
    row = store.find_row("Attendance", "attendance_id", attendance_id)
    if row is None:
        raise HTTPException(status_code=404, detail="Attendance record not found")
    return row
