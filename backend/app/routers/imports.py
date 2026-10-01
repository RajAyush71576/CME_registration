import io
from typing import Literal

from fastapi import APIRouter, Depends, File, Form, HTTPException, UploadFile
from fastapi.responses import StreamingResponse
from openpyxl import Workbook, load_workbook
from openpyxl.styles import Font, PatternFill
from sqlalchemy import func, select
from sqlalchemy.exc import IntegrityError
from sqlalchemy.orm import Session

from ..live import notify
from ..db import get_db, row_to_dict
from ..models import Event, ImportBatch, ImportError_, Participant, Registration, User
from ..schemas import EMAIL_ERROR, EMAIL_RE, PHONE_ERROR, ImportCommit, phone_ok
from ..security import require_admin
from .registrations import LICENSE_REQUIRED

router = APIRouter(prefix="/import", tags=["import"])

TEMPLATE_HEADERS = [
    "Name", "Designation", "Email", "Phone", "WhatsApp Number", "Place of Work",
    "Country", "Medical License No.", "Participant Type",
]
HEADER_TO_FIELD = {
    "name": "name", "designation": "designation", "email": "email", "phone": "phone",
    "whatsapp number": "whatsapp_number", "place of work": "place_of_work", "country": "country",
    "medical license no.": "medical_license_no", "medical license no": "medical_license_no",
    "participant type": "participant_type",
}
FIELDS = list(dict.fromkeys(HEADER_TO_FIELD.values()))
REQUIRED = ["name", "designation", "email", "phone", "whatsapp_number", "place_of_work", "participant_type"]
# Field -> the column header people see in the template, for error messages.
LABELS = {HEADER_TO_FIELD[h.lower()]: h for h in TEMPLATE_HEADERS}
MAX_UPLOAD_BYTES = 5 * 1024 * 1024
MAX_ROWS = 5000


def cell_str(v) -> str:
    if v is None:
        return ""
    if isinstance(v, float) and v.is_integer():  # phone numbers typed as numbers
        v = int(v)
    return str(v).strip()


def parse_workbook(data: bytes) -> list[dict]:
    try:
        ws = load_workbook(io.BytesIO(data), read_only=True, data_only=True).active
        rows = ws.iter_rows(values_only=True)
        header = next(rows, ())
        col = {}
        for i, h in enumerate(header):
            field = HEADER_TO_FIELD.get(cell_str(h).lower())
            if field and field not in col:
                col[field] = i
        missing = [LABELS[f] for f in REQUIRED if f not in col]
        if missing:
            raise HTTPException(400, f"Missing required columns: {', '.join(missing)}")

        out = []
        for row_number, values in enumerate(rows, start=2):
            record = {f: cell_str(values[i]) if i < len(values) else "" for f, i in col.items()}
            if not any(record.values()):
                continue
            if len(out) == MAX_ROWS:
                raise HTTPException(400, f"Too many rows — split the file into sheets of up to {MAX_ROWS} participants")
            out.append({"row_number": row_number, **{f: record.get(f, "") for f in FIELDS}})
    except HTTPException:
        raise
    except Exception:  # corrupt or non-xlsx file, possibly failing only partway through the rows
        raise HTTPException(400, "Could not read the Excel file — upload a .xlsx workbook")
    return out


def validate_rows(db: Session, event: Event, rows: list[dict]) -> list[dict]:
    """Normalises rows in place and attaches an `errors` list to each."""
    registered = set(db.scalars(
        select(func.lower(Participant.email))
        .join(Registration, Registration.participant_id == Participant.participant_id)
        .where(Registration.event_id == event.event_id)
    ))
    seen = set()
    for row in rows:
        for f in FIELDS:
            row[f] = cell_str(row.get(f))
        errors = [f"Missing {LABELS[f]}" for f in REQUIRED if not row[f]]
        for f in ("phone", "whatsapp_number"):
            if row[f] and not phone_ok(row[f]):
                errors.append(f"{LABELS[f]}: {PHONE_ERROR}")
        if row["participant_type"]:
            row["participant_type"] = row["participant_type"].title()
            if row["participant_type"] not in ("Faculty", "Delegate"):
                errors.append("Participant Type must be Faculty or Delegate")
        if event.cme_credits > 0 and not row["medical_license_no"]:
            errors.append(LICENSE_REQUIRED)
        email = row["email"].lower()
        if email and not EMAIL_RE.match(email):
            errors.append(EMAIL_ERROR)
        if email:
            if email in seen:
                errors.append("Duplicate email in this file")
            seen.add(email)
            if email in registered:
                errors.append(f"{row['email']} is already registered for this event")
        row["errors"] = errors
    return rows


@router.get("/template", dependencies=[Depends(require_admin)])
def template():
    wb = Workbook()
    ws = wb.active
    ws.title = "Participants"
    ws.append(TEMPLATE_HEADERS)
    for cell in ws[1]:
        cell.font = Font(bold=True, color="FFFFFF")
        cell.fill = PatternFill("solid", fgColor="8E1EA2")
    for letter in "ABCDEFGHI":
        ws.column_dimensions[letter].width = 22
    buf = io.BytesIO()
    wb.save(buf)
    buf.seek(0)
    return StreamingResponse(
        buf,
        media_type="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
        headers={"Content-Disposition": 'attachment; filename="cme_import_template.xlsx"'},
    )


@router.post("/preview", dependencies=[Depends(require_admin)])
async def preview(
    event_id: str = Form(...),
    source_type: Literal["cme_website", "external_society"] = Form(...),
    file: UploadFile = File(...),
    db: Session = Depends(get_db),
):
    event = db.get(Event, event_id)
    if not event:
        raise HTTPException(404, "Event not found")
    if event.status == "closed":
        raise HTTPException(400, "This event is closed")
    data = await file.read(MAX_UPLOAD_BYTES + 1)
    if len(data) > MAX_UPLOAD_BYTES:
        raise HTTPException(400, "File is too large — the limit is 5 MB")
    return {"rows": validate_rows(db, event, parse_workbook(data))}


@router.post("/commit")
def commit(body: ImportCommit, db: Session = Depends(get_db), user: User = Depends(require_admin)):
    event = db.scalar(select(Event).where(Event.event_id == body.event_id).with_for_update())
    if not event:
        raise HTTPException(404, "Event not found")
    if event.status == "closed":
        raise HTTPException(400, "This event is closed")
    source = "website" if body.source_type == "cme_website" else "import"
    rows = validate_rows(db, event, [r.model_dump() for r in body.rows])

    errors = []
    for row in rows:
        row_number = row["row_number"]
        if row["errors"]:
            errors.append({"row_number": row_number, "error_message": "; ".join(row["errors"])})
            continue
        try:
            with db.begin_nested():
                p = db.scalar(
                    select(Participant).where(func.lower(Participant.email) == row["email"].lower()).limit(1)
                )
                if not p:
                    p = Participant(
                        **{f: row[f] or None for f in ("country", "medical_license_no")},
                        **{f: row[f] for f in REQUIRED},
                        source=source,
                    )
                    db.add(p)
                    db.flush()
                elif not p.medical_license_no and row["medical_license_no"]:
                    p.medical_license_no = row["medical_license_no"]
                db.add(Registration(participant_id=p.participant_id, event_id=event.event_id, source=source,
                                    registered_by=user.user_id))
        except IntegrityError:
            errors.append({"row_number": row_number, "error_message": f"{row['email']} is already registered for this event"})

    batch = ImportBatch(
        source_file=body.source_file, source_type=body.source_type, imported_by=user.email,
        row_count=len(rows), error_count=len(errors),
    )
    db.add(batch)
    db.flush()
    db.add_all(ImportError_(batch_id=batch.batch_id, **e) for e in errors)
    db.commit()
    db.refresh(batch)
    notify("registrations", event.event_id)
    return {"batch": row_to_dict(batch), "errors": errors}


@router.get("/batches", dependencies=[Depends(require_admin)])
def list_batches(db: Session = Depends(get_db)):
    return [row_to_dict(b) for b in db.scalars(select(ImportBatch).order_by(ImportBatch.imported_at.desc()))]


@router.get("/batches/{batch_id}", dependencies=[Depends(require_admin)])
def get_batch(batch_id: str, db: Session = Depends(get_db)):
    batch = db.get(ImportBatch, batch_id)
    if not batch:
        raise HTTPException(404, "Import batch not found")
    errors = db.scalars(select(ImportError_).where(ImportError_.batch_id == batch_id).order_by(ImportError_.row_number))
    return {**row_to_dict(batch), "errors": [row_to_dict(e) for e in errors]}
