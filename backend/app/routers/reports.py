import io
from datetime import datetime

import openpyxl
from fastapi import APIRouter, Depends
from fastapi.responses import StreamingResponse

from app import excel_store as store
from app.auth import get_current_user

router = APIRouter(
    prefix="/reports", tags=["reports"], dependencies=[Depends(get_current_user)]
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
def export_attendance_report(event_id: str | None = None):
    """Consolidated attendance export for offline reporting/sharing (CONTEXT.md
    §14). The central workbook remains the live source of truth — this is a
    point-in-time snapshot."""
    participants_by_id = {
        p["participant_id"]: p for p in store.list_rows("Participants")
    }
    events_by_id = {e["event_id"]: e for e in store.list_rows("Events")}
    attendance_by_registration = {
        a["registration_id"]: a for a in store.list_rows("Attendance")
    }

    registrations = store.list_rows("Registrations")
    if event_id:
        registrations = [r for r in registrations if r["event_id"] == event_id]

    wb = openpyxl.Workbook()
    ws = wb.active
    ws.title = "Attendance"
    ws.append(COLUMNS)

    for reg in registrations:
        participant = participants_by_id.get(reg["participant_id"])
        event = events_by_id.get(reg["event_id"])
        if participant is None or event is None:
            continue
        attendance = attendance_by_registration.get(reg["registration_id"])

        if attendance and attendance.get("sign_out_time"):
            status = "PRESENT"
        elif attendance:
            status = "SIGNED IN"
        else:
            status = "NOT SIGNED IN"

        ws.append(
            [
                participant["name"],
                participant["designation"],
                participant["email"],
                participant["phone"],
                participant["participant_type"],
                event["event_name"],
                event["event_date"],
                event["venue"],
                reg["source"],
                status,
                attendance["sign_in_time"] if attendance else None,
                attendance.get("sign_out_time") if attendance else None,
                "Signature (tablet)" if attendance else None,
                attendance.get("device_id") if attendance else None,
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
