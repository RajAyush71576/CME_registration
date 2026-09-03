from fastapi import APIRouter, Depends, HTTPException, Query

from app import excel_store as store
from app.auth import get_current_user
from app.schemas import Registration, RegistrationCreate, RegistrationDetail

router = APIRouter(
    prefix="/registrations",
    tags=["registrations"],
    dependencies=[Depends(get_current_user)],
)


@router.post("", response_model=Registration, status_code=201)
def create_registration(payload: RegistrationCreate):
    with store.transaction() as tx:
        participant = tx.find_row(
            "Participants", "participant_id", payload.participant_id
        )
        if participant is None:
            raise HTTPException(status_code=404, detail="Participant not found")

        event = tx.find_row("Events", "event_id", payload.event_id)
        if event is None:
            raise HTTPException(status_code=404, detail="Event not found")

        if event["cme_credits"] and not participant.get("medical_license_no"):
            raise HTTPException(
                status_code=400,
                detail="Medical license number is required for CME-credit events",
            )

        existing = [
            r
            for r in tx.list_rows("Registrations")
            if r["participant_id"] == payload.participant_id
            and r["event_id"] == payload.event_id
        ]
        if existing:
            raise HTTPException(
                status_code=409,
                detail="Participant is already registered for this event",
            )

        row = {
            "registration_id": store.new_id(),
            "registered_at": store.now_iso(),
            **payload.model_dump(),
        }
        tx.append_row("Registrations", row)
        return row


@router.get("", response_model=list[Registration])
def list_registrations():
    return store.list_rows("Registrations")


@router.get("/search", response_model=list[RegistrationDetail])
def search_registrations(
    event_id: str,
    q: str = Query(..., min_length=1, description="Registration ID, mobile, email, or name"),
):
    """Tablet search & auto-fill: find registrations for an event by
    registration ID, mobile, email, or (partial, case-insensitive) name."""
    needle = q.strip().lower()
    participants_by_id = {
        p["participant_id"]: p for p in store.list_rows("Participants")
    }
    attendance_by_registration = {
        a["registration_id"]: a for a in store.list_rows("Attendance")
    }
    certificates_by_event_participant = {
        (c["event_id"], c["participant_id"]): c for c in store.list_rows("Certificates")
    }

    matches = []
    for reg in store.list_rows("Registrations"):
        if reg["event_id"] != event_id:
            continue
        participant = participants_by_id.get(reg["participant_id"])
        if participant is None:
            continue
        haystacks = [
            reg["registration_id"],
            participant.get("phone") or "",
            participant.get("email") or "",
            participant.get("whatsapp_number") or "",
            participant.get("name") or "",
        ]
        if any(needle == h.lower() for h in haystacks) or needle in (
            participant.get("name") or ""
        ).lower():
            matches.append(
                {
                    **reg,
                    "participant": participant,
                    "attendance": attendance_by_registration.get(
                        reg["registration_id"]
                    ),
                    "certificate": certificates_by_event_participant.get(
                        (reg["event_id"], reg["participant_id"])
                    ),
                }
            )
    return matches


@router.get("/{registration_id}", response_model=Registration)
def get_registration(registration_id: str):
    row = store.find_row("Registrations", "registration_id", registration_id)
    if row is None:
        raise HTTPException(status_code=404, detail="Registration not found")
    return row
