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
#  "website" and "import" are both Excel-upload paths (routers/imports.py) — the CME website export vs.
# a reformatted external-society sheet — so both read as "Excel" here; only on-site walk-ins differ.
SOURCE_LABELS = {"website": "Excel", "import": "Excel", "on_spot": "On-spot"}
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


def write_event_header(ws, event: Event, n_cols: int):
    """Event details block at the top of a report sheet: name, date/venue, start/closing time, department/doctors."""
    start_dt = datetime.combine(event.event_date, event.start_time)
    # Only a real closure has a real closing time; while the event is still active (or for events
    # closed before closed_at existed) there's nothing true to print, so the line is left out.
    start_line = f"Start Time: {start_dt:%I:%M %p}"
    if event.status == "closed" and event.closed_at:
        start_line += f"      Closed Time: {fmt_ist(event.closed_at, '%I:%M %p')}"
    doctors = ", ".join(event.organizing_doctors) if event.organizing_doctors else "—"
    lines = [
        (event.event_name, 14),
        (f"Date: {event.event_date:%d %b %Y}      Venue: {event.venue}", 11),
        (start_line, 11),
        (f"Department: {event.department}      Organizing Doctor(s): {doctors}", 11),
    ]
    for text, size in lines:
        ws.append([text])
        r = ws.max_row
        ws.merge_cells(start_row=r, start_column=1, end_row=r, end_column=n_cols)
        ws.cell(r, 1).font = Font(bold=True, size=size)
    ws.append([])  # blank separator row before the column headers


def attendance_status(event: Event, att: Attendance | None, reg: Registration) -> str:
    # Faculty-only manual present/absent call stands in for sign-in/out entirely when set.
    if reg.manual_status == "present":
        return "PRESENT"
    if reg.manual_status == "absent":
        return "ABSENT"
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
        status = attendance_status(event, att, reg)
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
    event = db.get(Event, event_id) if event_id else None
    n_cols = len(REPORT_COLUMNS)
    sig_in_col, sig_out_col = n_cols - 1, n_cols
    type_col = REPORT_COLUMNS.index("Participant Type")

    # Faculty, delegates, and sponsors go on separate sheets; participant_type is only ever one of these three.
    rows_by_type: dict[str, list] = {"Faculty": [], "Delegate": [], "Sponsor": []}
    for values, sig_in_ref, sig_out_ref in report_rows(db, event_id):
        rows_by_type.setdefault(values[type_col], []).append((values, sig_in_ref, sig_out_ref))

    wb = Workbook()
    wb.remove(wb.active)
    for sheet_name, type_key in (("Faculty", "Faculty"), ("Delegates", "Delegate"), ("Sponsors", "Sponsor")):
        ws = wb.create_sheet(sheet_name)
        if event:
            write_event_header(ws, event, n_cols)
        ws.append(REPORT_COLUMNS)
        header_row = ws.max_row
        for cell in ws[header_row]:
            cell.font = Font(bold=True, color="FFFFFF")
            cell.fill = PatternFill("solid", fgColor="8E1EA2")

        for values, sig_in_ref, sig_out_ref in rows_by_type.get(type_key, []):
            values[STATUS_COL] = STATUS_LABELS.get(values[STATUS_COL], values[STATUS_COL])
            ws.append(values)
            r = ws.max_row
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

    buf = io.BytesIO()
    wb.save(buf)
    buf.seek(0)
    filename = f"attendance_report_{datetime.now():%Y%m%d_%H%M%S}.xlsx"
    return StreamingResponse(
        buf,
        media_type="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
        headers={"Content-Disposition": f'attachment; filename="{filename}"'},
    )

