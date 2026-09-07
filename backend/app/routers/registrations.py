from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.exc import IntegrityError
from sqlalchemy.orm import Session

from app import models
from app.auth import get_current_user
from app.database import get_db
from app.db_utils import row_to_dict
from app.schemas import Registration, RegistrationCreate, RegistrationDetail

router = APIRouter(
    prefix="/registrations",
    tags=["registrations"],
    dependencies=[Depends(get_current_user)],
)


@router.post("", response_model=Registration, status_code=201)
def create_registration(payload: RegistrationCreate, db: Session = Depends(get_db)):
    participant = (
        db.query(models.Participant).filter_by(participant_id=payload.participant_id).first()
    )
    if participant is None:
        raise HTTPException(status_code=404, detail="Participant not found")

    event = db.query(models.Event).filter_by(event_id=payload.event_id).first()
    if event is None:
        raise HTTPException(status_code=404, detail="Event not found")

    if event.cme_credits and not participant.medical_license_no:
        raise HTTPException(
            status_code=400,
            detail="Medical license number is required for CME-credit events",
        )

    registration = models.Registration(**payload.model_dump())
    db.add(registration)
    try:
        db.commit()
    except IntegrityError:
        db.rollback()
        raise HTTPException(
            status_code=409,
            detail="Participant is already registered for this event",
        )
    db.refresh(registration)
    return row_to_dict(registration)


@router.get("", response_model=list[Registration])
def list_registrations(db: Session = Depends(get_db)):
    return [row_to_dict(r) for r in db.query(models.Registration).all()]


def _registration_details_for_event(db: Session, event_id: str) -> list[dict]:
    """Every registration for an event, joined with participant/attendance/
    certificate — shared by /search (filtered) and /by-event (unfiltered)."""
    participants_by_id = {
        p.participant_id: row_to_dict(p) for p in db.query(models.Participant).all()
    }
    attendance_by_registration = {
        a.registration_id: row_to_dict(a) for a in db.query(models.Attendance).all()
    }
    certificates_by_event_participant = {
        (c.event_id, c.participant_id): row_to_dict(c)
        for c in db.query(models.Certificate).all()
    }

    details = []
    for reg in db.query(models.Registration).filter_by(event_id=event_id).all():
        participant = participants_by_id.get(reg.participant_id)
        if participant is None:
            continue
        details.append(
            {
                **row_to_dict(reg),
                "participant": participant,
                "attendance": attendance_by_registration.get(reg.registration_id),
                "certificate": certificates_by_event_participant.get(
                    (reg.event_id, reg.participant_id)
                ),
            }
        )
    return details


@router.get("/search", response_model=list[RegistrationDetail])
def search_registrations(
    event_id: str,
    q: str = Query(..., min_length=1, description="Registration ID, mobile, email, or name"),
    db: Session = Depends(get_db),
):
    """Tablet search & auto-fill: find registrations for an event by
    registration ID, mobile, email, or (partial, case-insensitive) name."""
    needle = q.strip().lower()
    matches = []
    for detail in _registration_details_for_event(db, event_id):
        participant = detail["participant"]
        haystacks = [
            detail["registration_id"],
            participant.get("phone") or "",
            participant.get("email") or "",
            participant.get("whatsapp_number") or "",
            participant.get("name") or "",
        ]
        if any(needle == h.lower() for h in haystacks) or needle in (
            participant.get("name") or ""
        ).lower():
            matches.append(detail)
    return matches


@router.get("/by-event/{event_id}", response_model=list[RegistrationDetail])
def list_event_registrations(event_id: str, db: Session = Depends(get_db)):
    """Every registrant for an event, for the admin event-detail view."""
    return _registration_details_for_event(db, event_id)


@router.get("/{registration_id}", response_model=Registration)
def get_registration(registration_id: str, db: Session = Depends(get_db)):
    registration = db.query(models.Registration).filter_by(registration_id=registration_id).first()
    if registration is None:
        raise HTTPException(status_code=404, detail="Registration not found")
    return row_to_dict(registration)
