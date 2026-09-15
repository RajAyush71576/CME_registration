import io
from datetime import datetime

import openpyxl
from fastapi import APIRouter, Depends
from fastapi.responses import StreamingResponse
from openpyxl.drawing.image import Image as XLImage
from openpyxl.utils import get_column_letter
from sqlalchemy.orm import Session

from app import models
from app.auth import require_admin
from app.database import get_db
from app.signature_store import SIGNATURES_DIR

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
    "CME Credits Earned",
    "Sign-in Signature",
    "Sign-out Signature",
]

SIGNATURE_COL_WIDTH = 18
SIGNATURE_ROW_HEIGHT = 45
SIGNATURE_IMG_SIZE = (110, 55)


def _embed_signature(ws, row: int, col: int, ref: str | None) -> None:
    if not ref:
        return
    path = SIGNATURES_DIR.parent / ref
    if not path.is_file():
        return
    img = XLImage(str(path))
    img.width, img.height = SIGNATURE_IMG_SIZE
    ws.add_image(img, f"{get_column_letter(col)}{row}")


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

    sign_in_col = COLUMNS.index("Sign-in Signature") + 1
    sign_out_col = COLUMNS.index("Sign-out Signature") + 1
    ws.column_dimensions[get_column_letter(sign_in_col)].width = SIGNATURE_COL_WIDTH
    ws.column_dimensions[get_column_letter(sign_out_col)].width = SIGNATURE_COL_WIDTH

    row_num = 1
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
                float(event.cme_credits)
                if status == "PRESENT" and event.cme_credits
                else None,
                None,
                None,
            ]
        )
        row_num += 1
        if attendance:
            ws.row_dimensions[row_num].height = SIGNATURE_ROW_HEIGHT
            _embed_signature(ws, row_num, sign_in_col, attendance.sign_in_signature_ref)
            _embed_signature(ws, row_num, sign_out_col, attendance.sign_out_signature_ref)

    buf = io.BytesIO()
    wb.save(buf)
    buf.seek(0)

    filename = f"attendance_report_{datetime.now().strftime('%Y%m%d_%H%M%S')}.xlsx"
    return StreamingResponse(
        buf,
        media_type="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
        headers={"Content-Disposition": f"attachment; filename={filename}"},
    )
