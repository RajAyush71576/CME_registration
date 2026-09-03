import io
from datetime import datetime

from fastapi import APIRouter, Depends, HTTPException
from fastapi.responses import StreamingResponse

from app import excel_store as store
from app.auth import get_current_user
from app.observer_sheet_pdf import render_observer_sheet_pdf

router = APIRouter(
    prefix="/observer-sheet",
    tags=["observer-sheet"],
    dependencies=[Depends(get_current_user)],
)


def _format_time(iso: str | None) -> str:
    if not iso:
        return "-"
    return datetime.fromisoformat(iso).strftime("%d %b %Y, %I:%M %p")


@router.get("/{event_id}")
def get_observer_sheet(event_id: str):
    event = store.find_row("Events", "event_id", event_id)
    if event is None:
        raise HTTPException(status_code=404, detail="Event not found")

    participants_by_id = {
        p["participant_id"]: p for p in store.list_rows("Participants")
    }
    attendance_by_registration = {
        a["registration_id"]: a for a in store.list_rows("Attendance")
    }

    rows = []
    for reg in store.list_rows("Registrations"):
        if reg["event_id"] != event_id:
            continue
        attendance = attendance_by_registration.get(reg["registration_id"])
        if not attendance or not attendance.get("sign_out_time"):
            continue
        participant = participants_by_id.get(reg["participant_id"])
        if participant is None:
            continue
        rows.append(
            {
                "name": participant["name"],
                "designation": participant["designation"],
                "participant_type": participant["participant_type"],
                "sign_in_time": _format_time(attendance["sign_in_time"]),
                "sign_out_time": _format_time(attendance.get("sign_out_time")),
            }
        )
    rows.sort(key=lambda r: r["name"])

    pdf_bytes = render_observer_sheet_pdf(event, rows)
    filename = f"observer_sheet_{event['event_name'].replace(' ', '_')}.pdf"
    return StreamingResponse(
        io.BytesIO(pdf_bytes),
        media_type="application/pdf",
        headers={"Content-Disposition": f"attachment; filename={filename}"},
    )
