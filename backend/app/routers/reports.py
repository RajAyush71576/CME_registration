import io
from datetime import datetime

import openpyxl
from fastapi import APIRouter, Depends
from fastapi.responses import StreamingResponse
from sqlalchemy.orm import Session

from app import models
from app.auth import require_admin
from app.database import get_db

router = APIRouter(
    prefix="/reports", tags=["reports"], dependencies=[Depends(require_admin)]
)

COLUMNS = [
    "Participant Name",
    "Designation",
    "Email",
    "Phone",
    "Participant Type",
    "Event Name",
    "Event Date",
    "Venue",
    "Registration Source",
    "Attendance Status",
    "Sign-in Time",
    "Sign-out Time",
    "Verification Method",
    "Device ID",
]


@router.get("/attendance")
def export_attendance_report(event_id: str | None = None, db: Session = Depends(get_db)):
    """Consolidated attendance export for offline reporting/sharing (CONTEXT.md
    §14). Postgres remains the live source of truth — this is a point-in-time
    snapshot."""
    participants_by_id = {p.participant_id: p for p in db.query(models.Participant).all()}
    events_by_id = {e.event_id: e for e in db.query(models.Event).all()}
    attendance_by_registration = {
        a.registration_id: a for a in db.query(models.Attendance).all()
    }

    query = db.query(models.Registration)
    if event_id:
        query = query.filter_by(event_id=event_id)
    registrations = query.all()

    wb = openpyxl.Workbook()
    ws = wb.active
    ws.title = "Attendance"
    ws.append(COLUMNS)

    for reg in registrations:
        participant = participants_by_id.get(reg.participant_id)
        event = events_by_id.get(reg.event_id)
        if participant is None or event is None:
            continue
        attendance = attendance_by_registration.get(reg.registration_id)

        if attendance and attendance.sign_out_time:
            status = "PRESENT"
        elif attendance:
            status = "SIGNED IN"
        elif event.status == "closed":
            status = "ABSENT"
        else:
            status = "NOT SIGNED IN"

        ws.append(
            [
                participant.name,
                participant.designation,
                participant.email,
                participant.phone,
                participant.participant_type,
                event.event_name,
                event.event_date.isoformat(),
                event.venue,
                reg.source,
                status,
                attendance.sign_in_time.isoformat() if attendance else None,
                attendance.sign_out_time.isoformat() if attendance and attendance.sign_out_time else None,
                "Signature (tablet)" if attendance else None,
                attendance.device_id if attendance else None,
            ]
        )

    buf = io.BytesIO()
    wb.save(buf)
    buf.seek(0)

    filename = f"attendance_report_{datetime.now().strftime('%Y%m%d_%H%M%S')}.xlsx"
    return StreamingResponse(
        buf,
        media_type="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
        headers={"Content-Disposition": f"attachment; filename={filename}"},
    )
