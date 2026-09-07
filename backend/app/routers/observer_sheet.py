import io
from datetime import datetime

from fastapi import APIRouter, Depends, HTTPException
from fastapi.responses import StreamingResponse
from sqlalchemy.orm import Session

from app import models
from app.auth import require_admin
from app.database import get_db
from app.db_utils import row_to_dict
from app.observer_sheet_pdf import render_observer_sheet_pdf

router = APIRouter(
    prefix="/observer-sheet",
    tags=["observer-sheet"],
    dependencies=[Depends(require_admin)],
)


def _format_time(value: datetime | None) -> str:
    if not value:
        return "-"
    return value.strftime("%d %b %Y, %I:%M %p")


@router.get("/{event_id}")
def get_observer_sheet(event_id: str, db: Session = Depends(get_db)):
    event = db.query(models.Event).filter_by(event_id=event_id).first()
    if event is None:
        raise HTTPException(status_code=404, detail="Event not found")

    participants_by_id = {p.participant_id: p for p in db.query(models.Participant).all()}
    attendance_by_registration = {
        a.registration_id: a for a in db.query(models.Attendance).all()
    }

    rows = []
    for reg in db.query(models.Registration).filter_by(event_id=event_id).all():
        attendance = attendance_by_registration.get(reg.registration_id)
        if not attendance or not attendance.sign_out_time:
            continue
        participant = participants_by_id.get(reg.participant_id)
        if participant is None:
            continue
        rows.append(
            {
                "name": participant.name,
                "designation": participant.designation,
                "participant_type": participant.participant_type,
                "sign_in_time": _format_time(attendance.sign_in_time),
                "sign_out_time": _format_time(attendance.sign_out_time),
            }
        )
    rows.sort(key=lambda r: r["name"])

    pdf_bytes = render_observer_sheet_pdf(row_to_dict(event), rows)
    filename = f"observer_sheet_{event.event_name.replace(' ', '_')}.pdf"
    return StreamingResponse(
        io.BytesIO(pdf_bytes),
        media_type="application/pdf",
        headers={"Content-Disposition": f"attachment; filename={filename}"},
    )
