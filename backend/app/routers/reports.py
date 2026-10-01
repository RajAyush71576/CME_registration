<<<<<<< HEAD
import base64
import io
from datetime import datetime

from fastapi import APIRouter, Depends
from fastapi.responses import StreamingResponse
from openpyxl import Workbook
from PIL import Image as PILImage
from openpyxl.drawing.image import Image as XLImage
from openpyxl.styles import Alignment, Font, PatternFill
from openpyxl.utils import get_column_letter
from sqlalchemy import select
from sqlalchemy.orm import Session

from ..db import DATA_DIR, fmt_ist, get_db
from ..models import Attendance, Event, Participant, Registration, User
from ..security import require_admin

router = APIRouter(tags=["reports"], dependencies=[Depends(require_admin)])

REPORT_COLUMNS = [
    "Participant Name", "Designation", "Email", "Phone", "Participant Type", "Event Name", "Event Date",
    "Venue", "Registration Source", "Attendance Status", "Sign-in Time", "Sign-out Time",
    "Registered By", "Signed In By", "Signed Out By", "CME Credits Earned",
    "Sign-in Signature", "Sign-out Signature",
]
STATUS_COL = REPORT_COLUMNS.index("Attendance Status")
# The JSON rows keep the status codes (the Reports page maps them to badges); the sheet shows words.
STATUS_LABELS = {"PRESENT": "Completed", "SIGNED IN": "Signed in", "ABSENT": "Absent", "NOT SIGNED IN": "Not signed in"}
SOURCE_LABELS = {"website": "Website", "import": "Import", "on_spot": "On-spot"}
TIME_FMT = "%Y-%m-%d %I:%M %p"


def signature_path(ref):
    path = DATA_DIR / ref if ref else None
    return path if path and path.exists() else None


def cropped_data_url(ref, pad=6):
    """Signature PNG cropped to its ink (non-transparent pixels), as a data: URL for <img>."""
    path = signature_path(ref)
    if not path:
        return None
    try:
        im = PILImage.open(path)
        if max(im.size) > 4096:  # same cap as upload; older files predate that check
            return None
        im = im.convert("RGBA")
        box = im.getchannel("A").getbbox()
        if box:
            l, t, r, b = box
            im = im.crop((max(l - pad, 0), max(t - pad, 0), min(r + pad, im.width), min(b + pad, im.height)))
        buf = io.BytesIO()
        im.save(buf, "PNG")
    except (OSError, ValueError, PILImage.DecompressionBombError):
        return None  # unreadable file: show as missing rather than fail the whole report
    return "data:image/png;base64," + base64.b64encode(buf.getvalue()).decode()


def attendance_status(event: Event, att: Attendance | None) -> str:
    if att and att.sign_out_time:
        return "PRESENT"
    if att:
        return "SIGNED IN"
    return "ABSENT" if event.status == "closed" else "NOT SIGNED IN"


def report_rows(db: Session, event_id: str | None):
    """Yields (values for every column except the two signatures, sign-in ref, sign-out ref)."""
    stmt = (
        select(Registration, Participant, Event, Attendance)
        .join(Participant, Participant.participant_id == Registration.participant_id)
        .join(Event, Event.event_id == Registration.event_id)
        .outerjoin(Attendance, Attendance.registration_id == Registration.registration_id)
        .order_by(Event.event_date, Event.event_name, Participant.name)
    )
    if event_id:
        stmt = stmt.where(Registration.event_id == event_id)

    # "Priya (Staff)" / "Admin (Admin)" so the sheet shows who took each signature and in what role.
    names = {uid: f"{n} ({r.title()})" for uid, n, r in db.execute(select(User.user_id, User.name, User.role))}
    for reg, p, event, att in db.execute(stmt):
        status = attendance_status(event, att)
        yield [
            p.name, p.designation, p.email, p.phone, p.participant_type, event.event_name,
            event.event_date, event.venue, SOURCE_LABELS.get(reg.source, reg.source), status,
            fmt_ist(att.sign_in_time, TIME_FMT) if att else "",
            fmt_ist(att.sign_out_time, TIME_FMT) if att else "",
            names.get(reg.registered_by, ""),
            names.get(att.signed_in_by, "") if att else "",
            names.get(att.signed_out_by, "") if att else "",
            float(event.cme_credits) if status == "PRESENT" else None,
        ], att and att.sign_in_signature_ref, att and att.sign_out_signature_ref


@router.get("/reports/attendance/rows")
def attendance_report_rows(event_id: str | None = None, db: Session = Depends(get_db)):
    """Same data as the Excel report, for on-screen viewing. Signatures come back as cropped data: URLs."""
    return {
        "columns": REPORT_COLUMNS,
        "rows": [values + [cropped_data_url(i), cropped_data_url(o)] for values, i, o in report_rows(db, event_id)],
    }


@router.get("/reports/attendance")
def attendance_report(event_id: str | None = None, db: Session = Depends(get_db)):
    wb = Workbook()
    ws = wb.active
    ws.title = "Attendance"
    ws.append(REPORT_COLUMNS)
    for cell in ws[1]:
        cell.font = Font(bold=True, color="FFFFFF")
        cell.fill = PatternFill("solid", fgColor="8E1EA2")
    sig_in_col, sig_out_col = len(REPORT_COLUMNS) - 1, len(REPORT_COLUMNS)

    for r, (values, sig_in_ref, sig_out_ref) in enumerate(report_rows(db, event_id), start=2):
        values[STATUS_COL] = STATUS_LABELS.get(values[STATUS_COL], values[STATUS_COL])
        ws.append(values)
        for cell in ws[r]:
            if cell.data_type == "f":  # openpyxl turns text starting with "=" into a live formula
                cell.data_type = "s"
        ws.cell(r, 7).number_format = "yyyy-mm-dd"
        ws.row_dimensions[r].height = 45
        for ref, col in ((sig_in_ref, sig_in_col), (sig_out_ref, sig_out_col)):
            path = signature_path(ref)
            if path:
                img = XLImage(str(path))
                img.width, img.height = 110, 55
                ws.add_image(img, f"{get_column_letter(col)}{r}")
        for cell in ws[r]:
            cell.alignment = Alignment(vertical="center")

    for i, name in enumerate(REPORT_COLUMNS, start=1):
        ws.column_dimensions[get_column_letter(i)].width = 18 if i >= sig_in_col else max(14, len(name) + 4)
=======
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
>>>>>>> f6417903ef485a178711941303c1c7bbbf4c6de5

    buf = io.BytesIO()
    wb.save(buf)
    buf.seek(0)
<<<<<<< HEAD
    filename = f"attendance_report_{datetime.now():%Y%m%d_%H%M%S}.xlsx"
    return StreamingResponse(
        buf,
        media_type="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
        headers={"Content-Disposition": f'attachment; filename="{filename}"'},
    )

=======

    filename = f"attendance_report_{datetime.now().strftime('%Y%m%d_%H%M%S')}.xlsx"
    return StreamingResponse(
        buf,
        media_type="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
        headers={"Content-Disposition": f"attachment; filename={filename}"},
    )
>>>>>>> f6417903ef485a178711941303c1c7bbbf4c6de5
